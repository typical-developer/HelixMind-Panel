/**
 * What the lab has actually done.
 *
 * Every headline figure in the panel used to be a string literal — the Overview
 * claimed 24,521 sequences analysed and 3 AMR threats on a workspace that had
 * never run anything. This store is the replacement: analyses append an event
 * when they finish, and the Overview, the notification feed and the console's
 * history all read back from the same log.
 *
 * It is deliberately a plain module-level store rather than a React context.
 * The producers are views deep in the tree and the consumers are chrome that
 * sits above them, so a context would have to wrap the entire app and re-render
 * it on every append. `useSyncExternalStore` gives each consumer exactly the
 * slice it asked for.
 */
import * as React from "react"

import { STORAGE_KEYS, readJSON, writeJSON, removeKey } from "./storage"

/* ============================================================================
   Shape
   ========================================================================= */

/** Which analysis engine produced an event. */
export type EngineId = "scanner" | "simulator" | "growth" | "amr"

export type ActivityKind =
  | "scan.completed"
  | "simulation.completed"
  | "growth.completed"
  | "prediction.completed"
  | "export.created"
  | "threat.detected"

export type ActivitySeverity = "info" | "success" | "warning" | "danger"

export interface ActivityEvent {
  /** Monotonic within a session; the timestamp is what orders across sessions. */
  id: string
  kind: ActivityKind
  engine: EngineId
  /** Epoch milliseconds. A number, so it can be sorted and re-formatted. */
  ts: number
  /** One line, shown in the Overview's activity list and the notification feed. */
  label: string
  detail?: string
  /** Where clicking through should land, when no run was archived. */
  href?: string
  /**
   * The archived run this event produced, once it has been filed.
   *
   * Set by {@link linkActivityRun} after the write resolves rather than at
   * record time, because the archive is asynchronous and can decline — a
   * private-browsing window has no IndexedDB. An event with no `runId` still
   * links to its engine, which is what it did before the archive existed.
   *
   * Its absence is what forced the Activity view to *guess*: it paired events
   * to runs by matching the engine and allowing four seconds of slack between
   * the two timestamps. That works right up until two engines finish together.
   */
  runId?: string
  severity: ActivitySeverity
  /**
   * A count the event contributes to a headline figure — sequences parsed by a
   * scan, generations run by a simulation. Summed by the selectors below.
   */
  value?: number
}

/** Events older than this are dropped on write. */
const MAX_EVENTS = 200

/** The engines the Overview reports on, in display order. */
export const ENGINES: Array<{ id: EngineId; label: string; href: string }> = [
  { id: "scanner", label: "Scanner", href: "/dna-scanner" },
  { id: "simulator", label: "Simulator", href: "/mutation-simulator" },
  { id: "growth", label: "Growth lab", href: "/microbe-growth-lab" },
  { id: "amr", label: "AMR engine", href: "/amr-analysis-engine/resistance-predictor" },
]

/* ============================================================================
   Store
   ========================================================================= */

/** Stable empty array so the server snapshot never changes identity. */
const EMPTY: ActivityEvent[] = []

let events: ActivityEvent[] = EMPTY
let hydrated = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/**
 * Read from storage on first access.
 *
 * Lazy rather than eager at module scope: this module is imported by client
 * components that Next also evaluates on the server, where there is no
 * `localStorage` to read.
 */
function hydrate() {
  if (hydrated || typeof window === "undefined") return
  hydrated = true
  const stored = readJSON<ActivityEvent[]>(STORAGE_KEYS.activity, EMPTY)
  events = Array.isArray(stored)
    ? stored
        .filter(
          (e): e is ActivityEvent =>
            Boolean(e) && typeof e.ts === "number" && typeof e.label === "string",
        )
        .sort((a, b) => b.ts - a.ts)
        .slice(0, MAX_EVENTS)
    : EMPTY
}

function persist() {
  writeJSON(STORAGE_KEYS.activity, events)
}

let counter = 0

/**
 * Append an event. Returns the stored record so a caller can reference it.
 *
 * Newest first: every surface that reads this wants the most recent rows, and
 * sorting on read in three places is worse than inserting in order once.
 */
export function recordActivity(
  event: Omit<ActivityEvent, "id" | "ts"> & { ts?: number },
): ActivityEvent {
  hydrate()
  const record: ActivityEvent = {
    ...event,
    ts: event.ts ?? Date.now(),
    id: `${Date.now().toString(36)}-${(counter++).toString(36)}`,
  }
  events = [record, ...events].slice(0, MAX_EVENTS)
  persist()
  emit()
  return record
}

/**
 * Point an event at the run it produced.
 *
 * Called once the archive write has resolved, so an event only ever claims a
 * run that is actually there to open. Silently does nothing for an event that
 * has already aged out of the log.
 */
export function linkActivityRun(eventId: string, runId: string): void {
  hydrate()
  const index = events.findIndex((event) => event.id === eventId)
  if (index === -1 || events[index].runId === runId) return
  const next = [...events]
  next[index] = { ...next[index], runId }
  events = next
  persist()
  emit()
}

export function clearActivity() {
  events = EMPTY
  removeKey(STORAGE_KEYS.activity)
  emit()
}

function subscribe(listener: () => void) {
  hydrate()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  hydrate()
  return events
}

function getServerSnapshot() {
  return EMPTY
}

/**
 * The raw log, newest first.
 *
 * The returned array keeps its identity until something is appended, so the
 * selectors below can memoise on it safely.
 */
export function useActivity(): ActivityEvent[] {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/* ============================================================================
   Selectors
   ========================================================================= */

export interface ActivitySummary {
  /** Sequences parsed across every completed scan. */
  sequencesAnalysed: number
  /** Runs of any engine that reached completion. */
  runsCompleted: number
  /** Distinct resistance markers flagged at high confidence. */
  threatCount: number
  /** Exports produced. */
  exportCount: number
  /** Most recent event, for the "last activity" line. */
  lastActivityAt: number | null
}

export function summarise(list: ActivityEvent[]): ActivitySummary {
  let sequencesAnalysed = 0
  let runsCompleted = 0
  let threatCount = 0
  let exportCount = 0

  for (const event of list) {
    switch (event.kind) {
      case "scan.completed":
        sequencesAnalysed += event.value ?? 1
        runsCompleted += 1
        break
      case "simulation.completed":
      case "growth.completed":
      case "prediction.completed":
        runsCompleted += 1
        break
      case "threat.detected":
        threatCount += event.value ?? 1
        break
      case "export.created":
        exportCount += 1
        break
    }
  }

  return {
    sequencesAnalysed,
    runsCompleted,
    threatCount,
    exportCount,
    lastActivityAt: list.length > 0 ? list[0].ts : null,
  }
}

export function useActivitySummary(): ActivitySummary {
  const list = useActivity()
  return React.useMemo(() => summarise(list), [list])
}

export type EngineState = "operational" | "idle"

export interface EngineReport {
  id: EngineId
  label: string
  href: string
  state: EngineState
  /** When the engine last produced anything, or null if it never has. */
  lastRunAt: number | null
  runs: number
}

/**
 * How each engine is doing, judged only on what it has actually produced.
 *
 * There is no health check to call — the panel runs its analyses in the
 * browser — so "operational" here means "has completed work in this workspace",
 * not "a server said it was up". The Overview labels it accordingly rather than
 * implying uptime monitoring that does not exist.
 */
export function engineReports(list: ActivityEvent[]): EngineReport[] {
  return ENGINES.map((engine) => {
    let runs = 0
    let lastRunAt: number | null = null
    for (const event of list) {
      if (event.engine !== engine.id) continue
      if (event.kind === "export.created") continue
      runs += 1
      if (lastRunAt === null || event.ts > lastRunAt) lastRunAt = event.ts
    }
    return {
      ...engine,
      runs,
      lastRunAt,
      state: runs > 0 ? ("operational" as const) : ("idle" as const),
    }
  })
}

export function useEngineReports(): EngineReport[] {
  const list = useActivity()
  return React.useMemo(() => engineReports(list), [list])
}

/* ============================================================================
   Formatting
   ========================================================================= */

/**
 * "just now", "18m ago", "yesterday".
 *
 * The notification feed previously stored its times as literal strings, so
 * "2 mins ago" stayed "2 mins ago" forever and was already wrong by the time
 * the page loaded. Events carry epoch milliseconds and get formatted here.
 */
export function formatRelative(ts: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - ts) / 1000))
  if (seconds < 45) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

/**
 * Re-render on a timer so relative timestamps stay honest while a view is open.
 *
 * Ticks once a minute, which is the resolution `formatRelative` reports at.
 */
export function useRelativeClock(intervalMs = 60_000): number {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}
