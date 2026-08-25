"use client"

import { useMemo, useState } from "react"
import {
  Download,
  FlaskConical,
  History,
  ScanLine,
  Search,
  ShieldAlert,
  Split,
  X,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { downloadCSV, downloadJSON, fileStamp } from "@/lib/download"
import {
  ENGINES,
  formatRelative,
  useActivity,
  useRelativeClock,
  type ActivityEvent,
  type ActivityKind,
  type ActivitySeverity,
  type EngineId,
} from "@/lib/activity-store"
import { useArchivedRuns } from "@/lib/run-archive"
import {
  Chip,
  EmptyState,
  Pane,
  PaneHeader,
  Row,
  ToolbarButton,
  ViewScroll,
  WBInput,
  WBSelect,
  useStatusItems,
  useViewContext,
  useWorkbench,
} from "@/components/workbench"

/**
 * Everything the lab has done, in one filterable list.
 *
 * The activity log has held 200 events since it was written, and the only place
 * that read it back showed `events.slice(0, 12)` in the Overview's inspector.
 * There was no "view all" anywhere, so 188 of those events were recorded,
 * persisted across reloads, counted in the headline figures — and unreachable.
 *
 * This is where they go. It is not a second notification feed: the feed carries
 * read/dismissed state and deliberately excludes exports, while this shows the
 * log as it actually is, and links each event to the archived run behind it.
 */

const ENGINE_ICON: Record<EngineId, LucideIcon> = {
  scanner: ScanLine,
  simulator: Split,
  growth: FlaskConical,
  amr: ShieldAlert,
}

const SEVERITY_CLASS: Record<ActivitySeverity, string> = {
  danger: "text-destructive",
  warning: "text-warning",
  success: "text-success",
  info: "text-info",
}

/** Kinds grouped the way an operator thinks about them, not the way they parse. */
const KIND_LABEL: Record<ActivityKind, string> = {
  "scan.completed": "Scans",
  "simulation.completed": "Simulations",
  "growth.completed": "Experiments",
  "prediction.completed": "Predictions",
  "threat.detected": "Resistance calls",
  "export.created": "Exports",
}

/** How many rows are drawn before the "show more" footer. */
const PAGE = 40

type EngineFilter = EngineId | "all"
type KindFilter = ActivityKind | "all"
type SeverityFilter = ActivitySeverity | "all"

export default function ActivityPage() {
  const events = useActivity()
  const runs = useArchivedRuns()
  const { openTab } = useWorkbench()
  const now = useRelativeClock()

  const [engine, setEngine] = useState<EngineFilter>("all")
  const [kind, setKind] = useState<KindFilter>("all")
  const [severity, setSeverity] = useState<SeverityFilter>("all")
  const [needle, setNeedle] = useState("")
  const [shown, setShown] = useState(PAGE)

  /**
   * An event and the archived run it produced, matched on the engine and the
   * completion time. The activity log and the archive are written in the same
   * tick by the same handler, so a couple of seconds of tolerance is enough to
   * pair them without threading an id through both stores.
   */
  const runFor = useMemo(() => {
    const map = new Map<string, string>()
    for (const event of events) {
      const match = runs.find(
        (run) => run.engine === event.engine && Math.abs(run.endedAt - event.ts) < 4000,
      )
      if (match) map.set(event.id, match.id)
    }
    return map
  }, [events, runs])

  const filtered = useMemo(() => {
    const term = needle.trim().toLowerCase()
    return events.filter(
      (event) =>
        (engine === "all" || event.engine === engine) &&
        (kind === "all" || event.kind === kind) &&
        (severity === "all" || event.severity === severity) &&
        (!term ||
          event.label.toLowerCase().includes(term) ||
          (event.detail ?? "").toLowerCase().includes(term)),
    )
  }, [engine, events, kind, needle, severity])

  const narrowed =
    engine !== "all" || kind !== "all" || severity !== "all" || needle.trim() !== ""

  const clearFilters = () => {
    setEngine("all")
    setKind("all")
    setSeverity("all")
    setNeedle("")
    setShown(PAGE)
  }

  useStatusItems(
    useMemo(
      () => [
        {
          id: "activity-count",
          label: narrowed
            ? `${filtered.length} of ${events.length} events`
            : `${events.length} event${events.length === 1 ? "" : "s"}`,
          title: "Everything this workspace has recorded. Kept in this browser.",
        },
      ],
      [events.length, filtered.length, narrowed],
    ),
  )

  useViewContext(
    events.length === 0
      ? "Nothing recorded yet"
      : `${runs.length} archived run${runs.length === 1 ? "" : "s"} · oldest event ${formatRelative(
          events[events.length - 1].ts,
          now,
        )}`,
  )

  const visible = filtered.slice(0, shown)

  return (
    <ViewScroll>
      <div className="mx-auto max-w-4xl p-3">
        <Pane>
          <PaneHeader
            icon={History}
            title="Activity"
            subtitle={
              narrowed
                ? `${filtered.length} of ${events.length}`
                : `${events.length} event${events.length === 1 ? "" : "s"}`
            }
            actions={
              <>
                <ToolbarButton
                  icon={Download}
                  label="Export what is shown as CSV"
                  disabled={filtered.length === 0}
                  onClick={() =>
                    downloadCSV(
                      ["When", "Engine", "Kind", "Severity", "Label", "Detail"],
                      filtered.map((e) => [
                        new Date(e.ts).toISOString(),
                        e.engine,
                        e.kind,
                        e.severity,
                        e.label,
                        e.detail ?? "",
                      ]),
                      {
                        filename: `helixmind-activity-${fileStamp()}.csv`,
                        description: `${filtered.length} event${filtered.length === 1 ? "" : "s"}.`,
                      },
                    )
                  }
                />
                <ToolbarButton
                  icon={Download}
                  label="Export what is shown as JSON"
                  disabled={filtered.length === 0}
                  onClick={() =>
                    downloadJSON(
                      {
                        exportedAt: new Date().toISOString(),
                        filters: { engine, kind, severity, search: needle.trim() },
                        events: filtered.map((e) => ({
                          ...e,
                          at: new Date(e.ts).toISOString(),
                        })),
                      },
                      {
                        filename: `helixmind-activity-${fileStamp()}.json`,
                        description: `${filtered.length} event${filtered.length === 1 ? "" : "s"}.`,
                      },
                    )
                  }
                />
              </>
            }
          />

          {/* Filters. Four controls on one strip, matching the run log's — the
              console already taught this shape, so it needs no explaining. */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <div className="relative min-w-40 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-muted-foreground" />
              <WBInput
                value={needle}
                onChange={(e) => {
                  setNeedle(e.target.value)
                  setShown(PAGE)
                }}
                placeholder="Filter by name or detail"
                aria-label="Filter activity"
                className="h-6 pl-6 text-xs"
              />
            </div>

            <WBSelect
              value={engine}
              onChange={(e) => {
                setEngine(e.target.value as EngineFilter)
                setShown(PAGE)
              }}
              aria-label="Filter activity by engine"
              className="h-6 w-36 text-xs"
            >
              <option value="all">All engines</option>
              {ENGINES.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </WBSelect>

            <WBSelect
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as KindFilter)
                setShown(PAGE)
              }}
              aria-label="Filter activity by kind"
              className="h-6 w-40 text-xs"
            >
              <option value="all">Everything</option>
              {(Object.keys(KIND_LABEL) as ActivityKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </WBSelect>

            <WBSelect
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value as SeverityFilter)
                setShown(PAGE)
              }}
              aria-label="Filter activity by severity"
              className="h-6 w-28 text-xs"
            >
              <option value="all">Any severity</option>
              <option value="danger">Danger</option>
              <option value="warning">Warning</option>
              <option value="success">Success</option>
              <option value="info">Info</option>
            </WBSelect>

            {narrowed && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex h-6 cursor-pointer items-center gap-1 rounded-sm px-1.5 text-xs text-muted-foreground transition-colors hover:bg-[var(--wb-hover)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
              >
                <X className="size-3" />
                Clear
              </button>
            )}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={narrowed ? Search : History}
              title={narrowed ? "Nothing matches these filters" : "Nothing recorded yet"}
              description={
                narrowed
                  ? "Widen the filters, or clear them to see the whole log."
                  : "Scans, simulations, experiments, predictions and exports are all recorded here as you run them."
              }
            />
          ) : (
            // Keyed on the filters, not on the rows: changing a filter replaces
            // the whole list at once and reads as a flicker without it, while
            // paging appends to the same key and stays still. Same treatment the
            // console's tab bodies use.
            <div key={`${engine}|${kind}|${severity}`} className="animate-fade-in">
              {visible.map((event) => (
                <ActivityRow
                  key={event.id}
                  event={event}
                  now={now}
                  runId={runFor.get(event.id)}
                  onOpen={(href) => openTab(href)}
                />
              ))}
            </div>
          )}

          {/* The count is the point. A list that silently stops at forty tells
              you nothing about how much you have not seen. */}
          {filtered.length > visible.length && (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="row-hover w-full cursor-pointer border-t border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset"
            >
              Show {Math.min(PAGE, filtered.length - visible.length)} more ·{" "}
              {filtered.length - visible.length} remaining
            </button>
          )}
        </Pane>

        {/* What the log does *not* say, said out loud. */}
        <p className="px-1 py-3 text-xs leading-relaxed text-muted-foreground/70">
          The log keeps the most recent 200 events in this browser. Runs that
          produced a result also keep that result — open one to see its
          parameters, its seed and what it found.
        </p>
      </div>
    </ViewScroll>
  )
}

function ActivityRow({
  event,
  now,
  runId,
  onOpen,
}: {
  event: ActivityEvent
  now: number
  runId?: string
  onOpen: (href: string) => void
}) {
  const href = runId ? `/activity/${runId}` : event.href

  return (
    <Row
      icon={ENGINE_ICON[event.engine] ?? History}
      iconClassName={SEVERITY_CLASS[event.severity]}
      label={event.label}
      description={`${event.detail ? `${event.detail} · ` : ""}${formatRelative(
        event.ts,
        now,
      )}`}
      onClick={href ? () => onOpen(href) : undefined}
      title={
        runId
          ? "Open the archived run"
          : event.href
            ? "Open the analysis that raised this"
            : new Date(event.ts).toLocaleString()
      }
      trailing={
        <>
          {runId && <Chip tone="neutral">result</Chip>}
          <span
            className={cn(
              "hidden w-24 text-right font-mono text-xs text-muted-foreground/60 tabular @lg:inline",
            )}
          >
            {new Date(event.ts).toLocaleDateString()}
          </span>
        </>
      }
    />
  )
}
