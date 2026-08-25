/**
 * What a run actually produced, kept so you can come back to it.
 *
 * The bench had a hole in the middle of it. Results lived in the routed page's
 * component state, so opening another analysis unmounted the view and threw the
 * mutation table, the growth curve and the final sequence away. What survived
 * was a one-line label in the activity log, a label/duration/outcome row in the
 * console's History, and — for the scanner and the predictor only — a 900-base
 * preview in `lib/lab-snapshot.ts`. Everything else was gone. Export was the
 * only way to keep a result, and it had to be clicked before navigating away.
 *
 * That is the wrong shape for the people this is for. A lab doing AMR work is
 * accountable for its results: which isolate, which parameters, which build,
 * and can it be run again and land in the same place. This store is that
 * record — inputs, parameters, seed, build and the result itself, written when
 * a run finishes and readable long afterwards.
 *
 * ## Why IndexedDB
 *
 * `localStorage` is a ~5MB budget already shared by the layout, the activity
 * log, the run log and the notification feed, and it is synchronous — writing a
 * megabyte of variant calls to it would block the frame that finished the run.
 * IndexedDB is asynchronous and roomy. The cost is that everything here returns
 * a promise, which is why the metadata is mirrored into memory and only
 * payloads are fetched on demand.
 *
 * ## Two object stores, on purpose
 *
 * `runs` holds metadata; `payloads` holds the bulky part under the same id. The
 * list views — the Activity view, the console's History — only ever need the
 * former, and a listing that had to deserialise every payload to draw twenty
 * rows would get slower with every run recorded.
 */
import * as React from "react"

import { APP_VERSION } from "./app-info"
import type { EngineId } from "./activity-store"

/* ============================================================================
   Shape
   ========================================================================= */

export type RunOutcome = "completed" | "stopped"

/** Everything about a run except the result itself. Cheap to list. */
export interface RunSummary {
  id: string
  engine: EngineId
  /** The run's name, as the status bar and the History row show it. */
  label: string
  /** The supporting line — file name, generation count. */
  detail?: string
  startedAt: number
  endedAt: number
  outcome: RunOutcome
  /** Where the analysis that produced it lives. */
  href: string
  /**
   * What went in. Free-form per engine, but always enough to say which sample
   * this was: file name, sequence header, length.
   */
  inputs: Record<string, unknown>
  /** The parameters the engine ran with — the other half of reproducibility. */
  params: Record<string, unknown>
  /**
   * The seed, where the engine has one.
   *
   * This is the field that makes a run repeatable rather than merely recorded.
   * The simulator already computed it and already wrote it into its export
   * blob; it was simply never kept anywhere the panel could read back.
   */
  seed?: number | null
  /** The build that produced the result. A record without it is not evidence. */
  appVersion: string
  /** Headline numbers, so a listing can show them without loading the payload. */
  summary: Record<string, number | string>
  /** Serialised size of the payload, so eviction never has to re-measure. */
  bytes: number
}

/** A summary with its result attached. */
export interface ArchivedRun extends RunSummary {
  payload: unknown
}

/** What a caller hands in. The store fills in the rest. */
export type RunDraft = Omit<RunSummary, "id" | "appVersion" | "bytes"> & {
  payload: unknown
}

/* ============================================================================
   Limits

   Two ceilings, because either alone fails. A count alone lets four whole-genome
   scans fill the origin's quota; a byte budget alone lets ten thousand trivial
   runs accumulate and make every listing slow.
   ========================================================================= */

export const MAX_RUNS = 100
export const MAX_BYTES = 64 * 1024 * 1024

const DB_NAME = "helixmind.archive"
const DB_VERSION = 1
const STORE_RUNS = "runs"
const STORE_PAYLOADS = "payloads"

/* ============================================================================
   Pure helpers — the parts worth testing without a database
   ========================================================================= */

/**
 * Roughly how much space a payload takes.
 *
 * UTF-16 code units counted as two bytes, matching how browsers bill against
 * the quota and how `measureUsage` in `lib/storage.ts` counts `localStorage`.
 * An unserialisable payload measures zero rather than throwing — a run that
 * cannot be sized is still worth keeping the metadata for.
 */
export function measurePayload(payload: unknown): number {
  try {
    return JSON.stringify(payload ?? null).length * 2
  } catch {
    return 0
  }
}

/**
 * Which runs have to go, oldest first, to get back under both ceilings.
 *
 * Split out from the database work so the rule can be tested directly: given a
 * list and the limits, this is a pure function of its input. The newest run is
 * never evicted, even if it alone exceeds the byte budget — dropping the thing
 * that was just produced is never the behaviour anyone wants.
 */
export function planEviction(
  runs: Array<Pick<RunSummary, "id" | "endedAt" | "bytes">>,
  { maxRuns = MAX_RUNS, maxBytes = MAX_BYTES } = {},
): string[] {
  // Newest first, so it is the tail that gets dropped.
  const ordered = [...runs].sort((a, b) => b.endedAt - a.endedAt)
  const doomed: string[] = []

  let total = 0
  for (let i = 0; i < ordered.length; i++) {
    const run = ordered[i]
    const overCount = i >= maxRuns
    const overBytes = i > 0 && total + run.bytes > maxBytes
    if (overCount || overBytes) {
      doomed.push(run.id)
      continue
    }
    total += run.bytes
  }
  return doomed
}

let counter = 0

/** Sortable, collision-free within a session, and safe in a URL. */
export function newRunId(now = Date.now()): string {
  return `${now.toString(36)}-${(counter++).toString(36)}`
}

/** Fill in the fields the store owns, and normalise what the caller gave. */
export function prepareRun(draft: RunDraft, now = Date.now()): ArchivedRun {
  return {
    ...draft,
    id: newRunId(now),
    appVersion: APP_VERSION,
    bytes: measurePayload(draft.payload),
  }
}

/* ============================================================================
   The database
   ========================================================================= */

/**
 * `unavailable` is a real state, not an error.
 *
 * Firefox in private browsing, Safari with storage blocked, and any browser
 * where the user has denied site data all fail to open an IndexedDB. The panel
 * keeps working without an archive — it just says so, rather than throwing on
 * every finished run.
 */
export type ArchiveState = "loading" | "ready" | "unavailable"

let db: IDBDatabase | null = null
let opening: Promise<IDBDatabase | null> | null = null
let state: ArchiveState = "loading"

/** The metadata mirror, so listings can render synchronously. */
let index: RunSummary[] = []

const EMPTY: RunSummary[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function openDB(): Promise<IDBDatabase | null> {
  if (db) return Promise.resolve(db)
  if (opening) return opening

  opening = new Promise<IDBDatabase | null>((resolve) => {
    if (typeof indexedDB === "undefined") {
      state = "unavailable"
      resolve(null)
      return
    }

    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      state = "unavailable"
      resolve(null)
      return
    }

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_RUNS)) {
        const store = database.createObjectStore(STORE_RUNS, { keyPath: "id" })
        // Listings are always newest-first, so ordering is an index rather than
        // a sort over everything on every read.
        store.createIndex("endedAt", "endedAt")
      }
      if (!database.objectStoreNames.contains(STORE_PAYLOADS)) {
        database.createObjectStore(STORE_PAYLOADS, { keyPath: "id" })
      }
    }

    request.onsuccess = () => {
      db = request.result
      // A second tab upgrading the schema would otherwise leave this one
      // holding a connection that blocks the upgrade forever.
      db.onversionchange = () => {
        db?.close()
        db = null
        opening = null
      }
      resolve(db)
    }

    request.onerror = () => {
      state = "unavailable"
      resolve(null)
    }

    request.onblocked = () => {
      state = "unavailable"
      resolve(null)
    }
  })

  return opening
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

let hydrating: Promise<void> | null = null

/** Load the metadata mirror. Runs once; every caller awaits the same promise. */
function hydrate(): Promise<void> {
  if (hydrating) return hydrating
  hydrating = (async () => {
    const database = await openDB()
    if (!database) {
      state = "unavailable"
      emit()
      return
    }
    try {
      const tx = database.transaction(STORE_RUNS, "readonly")
      const rows = await promisify(
        tx.objectStore(STORE_RUNS).getAll() as IDBRequest<RunSummary[]>,
      )
      index = rows.sort((a, b) => b.endedAt - a.endedAt)
      state = "ready"
    } catch {
      state = "unavailable"
    }
    emit()
  })()
  return hydrating
}

function commit(tx: IDBTransaction): Promise<boolean> {
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => resolve(false)
    tx.onabort = () => resolve(false)
  })
}

/**
 * Record a finished run.
 *
 * Resolves with the stored id, or `null` when there is no archive to write to.
 * Deliberately never rejects: a run whose result could not be filed is a
 * degraded experience, not a failed analysis, and the caller has already put
 * the result on screen.
 */
export async function archiveRun(draft: RunDraft): Promise<string | null> {
  await hydrate()
  const database = await openDB()
  if (!database) return null

  const record = prepareRun(draft)
  const { payload, ...summary } = record

  try {
    const tx = database.transaction([STORE_RUNS, STORE_PAYLOADS], "readwrite")
    tx.objectStore(STORE_RUNS).put(summary)
    tx.objectStore(STORE_PAYLOADS).put({ id: record.id, payload })
    if (!(await commit(tx))) return null
  } catch {
    // Quota exceeded is the likely cause. Not worth failing the run over.
    return null
  }

  index = [summary, ...index].sort((a, b) => b.endedAt - a.endedAt)
  emit()
  void evict()
  return record.id
}

/** Drop whatever is over the ceilings. Called after every write. */
async function evict(): Promise<void> {
  const doomed = planEviction(index)
  if (doomed.length === 0) return
  await Promise.all(doomed.map((id) => deleteRun(id, { silent: true })))
  const gone = new Set(doomed)
  index = index.filter((run) => !gone.has(run.id))
  emit()
}

/** The result itself. Loaded only when something is about to show it. */
export async function loadRun(id: string): Promise<ArchivedRun | null> {
  await hydrate()
  const database = await openDB()
  if (!database) return null

  const summary = index.find((run) => run.id === id)
  if (!summary) return null

  try {
    const tx = database.transaction(STORE_PAYLOADS, "readonly")
    const row = await promisify(
      tx.objectStore(STORE_PAYLOADS).get(id) as IDBRequest<
        { id: string; payload: unknown } | undefined
      >,
    )
    return { ...summary, payload: row?.payload ?? null }
  } catch {
    return null
  }
}

export async function deleteRun(
  id: string,
  { silent = false }: { silent?: boolean } = {},
): Promise<void> {
  const database = await openDB()
  if (!database) return
  try {
    const tx = database.transaction([STORE_RUNS, STORE_PAYLOADS], "readwrite")
    tx.objectStore(STORE_RUNS).delete(id)
    tx.objectStore(STORE_PAYLOADS).delete(id)
    await commit(tx)
  } catch {
    return
  }
  // The eviction path updates the mirror itself, in one pass.
  if (!silent) {
    index = index.filter((run) => run.id !== id)
    emit()
  }
}

/** Empty the archive. Wired into Settings → Danger zone → Delete all data. */
export async function clearArchive(): Promise<void> {
  const database = await openDB()
  if (!database) return
  try {
    const tx = database.transaction([STORE_RUNS, STORE_PAYLOADS], "readwrite")
    tx.objectStore(STORE_RUNS).clear()
    tx.objectStore(STORE_PAYLOADS).clear()
    await commit(tx)
  } catch {
    return
  }
  index = []
  emit()
}

/* ============================================================================
   React bindings — the same `useSyncExternalStore` shape as the other stores
   ========================================================================= */

function subscribe(listener: () => void) {
  void hydrate()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return index
}

function getServerSnapshot() {
  return EMPTY
}

/** Every archived run, newest first. */
export function useArchivedRuns(): RunSummary[] {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * Whether the archive is usable.
 *
 * Separate from the list because "nothing has been run yet" and "this browser
 * will not let the panel keep anything" are different things to tell someone,
 * and the second one needs saying out loud.
 */
export function useArchiveState(): ArchiveState {
  return React.useSyncExternalStore(
    subscribe,
    () => state,
    () => "loading" as const,
  )
}

/** Runs and bytes held, for the Overview's storage readout. */
export function archiveUsage(runs: RunSummary[]): { runs: number; bytes: number } {
  let bytes = 0
  for (const run of runs) bytes += run.bytes
  return { runs: runs.length, bytes }
}
