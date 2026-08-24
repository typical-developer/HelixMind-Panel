"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { STORAGE_KEYS, readJSON, writeJSON } from "@/lib/storage"
import { normalizeOpenTabs } from "@/lib/open-tabs"
import { toast } from "@/hooks/use-toast"

import { VIEWS, normalizeHref, viewForPath, type WorkbenchView } from "./registry"

/* ============================================================================
   Types
   ========================================================================= */

/** The sidebar's modes, in rail order. */
export type ActivityId = "analyses" | "runs" | "genes" | "preferences"

/** The console's tabs. */
export type PanelTabId = "alerts" | "log" | "history"

export type LogLevel = "info" | "success" | "warn" | "error" | "debug" | "command"

export interface LogLine {
  id: number
  ts: number
  level: LogLevel
  /** Which view produced the line — the log's channel. */
  source: string
  message: string
}

/**
 * Something a view wants the operator to notice: bad input it cannot work
 * with, or a result that warrants attention (a high-confidence resistance
 * call, a stress threshold crossed).
 */
export interface WorkbenchAlert {
  /** Which view raised it — used for grouping in the Alerts tab. */
  source: string
  severity: "error" | "warning" | "info"
  message: string
  /** What the alert is about: an organism, a sample, a position. */
  at?: string
}

export interface StatusItem {
  /** Stable key within the publishing view. */
  id: string
  label: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  tone?: "default" | "info" | "success" | "warning" | "danger"
  title?: string
  onClick?: () => void
}

export interface RunStatus {
  /** Label shown in the status bar and the Runs sidebar. */
  label: string
  state: "idle" | "running" | "paused" | "done"
  /** 0–100; omitted when the job has no determinate progress. */
  progress?: number
  detail?: string
  /**
   * The console channel of the view running it, so the tab strip can mark the
   * right tab as busy. Matches `WorkbenchView.source`.
   */
  source?: string
}

/** What a tab shows about the view behind it. */
export type TabSignal = "running" | "attention" | "idle"

/**
 * The narrow slice the tab strip and status bar need.
 *
 * Kept in its own context because it changes only when a run's state or a
 * view's alerts change. Reading the full console state would re-render the tab
 * strip on every log line, which is the exact cost the console/layout split
 * exists to avoid.
 */
export interface ConsoleSignals {
  /** Channel of the run currently in flight, if any. */
  runSource: string | null
  runState: RunStatus["state"] | null
  /** Error and warning counts per channel. */
  alertsBySource: Record<string, { errors: number; warnings: number }>
}

/** A finished run, kept so the console can show what the bench has done. */
export interface RunRecord {
  id: number
  label: string
  detail?: string
  startedAt: number
  endedAt: number
  outcome: "completed" | "stopped"
}

interface LayoutState {
  activity: ActivityId
  sidebarVisible: boolean
  sidebarSize: number
  panelVisible: boolean
  panelSize: number
  panelMaximized: boolean
  panelTab: PanelTabId
  inspectorVisible: boolean
  statusBarVisible: boolean
  tabBarVisible: boolean
  focusMode: boolean
  zoom: number
  openTabs: string[]
}

const DEFAULT_LAYOUT: LayoutState = {
  activity: "analyses",
  sidebarVisible: true,
  sidebarSize: 18,
  panelVisible: false,
  panelSize: 32,
  panelMaximized: false,
  panelTab: "log",
  inspectorVisible: true,
  statusBarVisible: true,
  tabBarVisible: true,
  focusMode: false,
  zoom: 0,
  openTabs: ["/dashboard"],
}

const STORAGE_KEY = "helixmind.workbench.v2"

/**
 * The view the bench falls back to, and the one tab the strip is guaranteed to
 * be able to fall back on.
 *
 * The workbench is a routed app: a view is always on screen, because the URL
 * always points at one. So an empty tab strip is not a state — it is the strip
 * disagreeing with the bench it describes. Everything that removes tabs keeps
 * at least one.
 */
const HOME_HREF = "/dashboard"

const ACTIVITY_IDS: ActivityId[] = ["analyses", "runs", "genes", "preferences"]
const PANEL_TAB_IDS: PanelTabId[] = ["alerts", "log", "history"]

/** Zoom step → root font size. Index 3 (16px) is 100%. */
const ZOOM_STEPS = [13, 14, 15, 16, 17, 18, 20]
const ZOOM_BASE_INDEX = 3

interface WorkbenchContextValue extends LayoutState {
  /** False until localStorage has been read, so nothing animates on hydration. */
  hydrated: boolean

  view: WorkbenchView | undefined
  tabs: WorkbenchView[]

  setActivity: (id: ActivityId) => void
  toggleSidebar: () => void
  setSidebarVisible: (v: boolean) => void
  setSidebarSize: (n: number) => void

  togglePanel: () => void
  setPanelVisible: (v: boolean) => void
  setPanelSize: (n: number) => void
  setPanelTab: (t: PanelTabId) => void
  togglePanelMaximized: () => void

  toggleInspector: () => void
  toggleStatusBar: () => void
  toggleTabBar: () => void
  toggleFocusMode: () => void

  zoomIn: () => void
  zoomOut: () => void
  zoomReset: () => void

  openTab: (href: string) => void
  closeTab: (href: string) => void
  /**
   * False when only one analysis is open. The strip describes what the bench is
   * showing, and the bench always shows something, so the last tab stays —
   * `closeTab` enforces it and this lets the UI drop the affordance rather than
   * offer a button that does nothing.
   */
  canCloseTab: boolean
  closeOtherTabs: (href: string) => void
  closeAllTabs: () => void
  /** Move an open analysis to a new position in the strip. */
  moveTab: (href: string, toIndex: number) => void
  /** Put back the most recently closed analysis. Alt+Shift+T. */
  reopenClosedTab: () => void
  /** How many closes are on the undo stack, so a menu item can disable. */
  closedTabCount: number

  resetLayout: () => void

  paletteOpen: boolean
  setPaletteOpen: (v: boolean) => void
  /** Text the palette starts with — `>` puts it straight into command mode. */
  paletteSeed: string
  openPalette: (seed?: string) => void
}

/**
 * What a run produces. Kept out of the layout context because it changes many
 * times a second while a simulation is going, and almost nothing on screen
 * cares — see the note on {@link WorkbenchProvider}.
 */
interface ConsoleState {
  logs: LogLine[]
  alerts: WorkbenchAlert[]
  runStatus: RunStatus | null
  runHistory: RunRecord[]
  statusItems: StatusItem[]
  /** What the open view is working on, shown at the end of the tab strip. */
  viewContext: string | null
  /**
   * A line the status bar shows for a few seconds, then drops.
   *
   * For telling the operator why something they just did had no effect. A toast
   * would be a pop-up to dismiss for a non-event; the status strip is already
   * where the bench says what it is doing.
   */
  notice: string | null
}

/** Every console writer. Stable for the lifetime of the provider. */
interface ConsoleActions {
  pushLog: (line: Omit<LogLine, "id" | "ts"> & { ts?: number }) => void
  clearLogs: () => void
  restoreLogs: (lines: LogLine[]) => void
  publishAlerts: (source: string, alerts: WorkbenchAlert[]) => void
  /** Drop one channel's alerts, or every channel's when given nothing. */
  dismissAlerts: (source?: string) => void
  publishRunStatus: (status: RunStatus | null) => void
  clearRunHistory: () => void
  restoreRunHistory: (records: RunRecord[]) => void
  publishStatusItems: (items: StatusItem[]) => void
  publishViewContext: (detail: string | null) => void
  /** Say something in the status bar briefly. See {@link ConsoleState.notice}. */
  notify: (message: string) => void
}

const WorkbenchContext = React.createContext<WorkbenchContextValue | null>(null)
const ConsoleStateContext = React.createContext<ConsoleState | null>(null)
const ConsoleActionsContext = React.createContext<ConsoleActions | null>(null)
const ConsoleSignalsContext = React.createContext<ConsoleSignals | null>(null)

/* ============================================================================
   Provider
   ========================================================================= */

/**
 * Layout, open analyses and the palette — everything that changes only when
 * the operator does something.
 *
 * Console output lives in its own pair of contexts underneath this one. A
 * running simulation pushes log lines continuously, and when that data shared
 * a context with the layout it re-rendered the title bar, rail, sidebar, tabs
 * and the whole open view on every line. Splitting it means only the console,
 * the status bar and the Runs sidebar react to output, and splitting the
 * writers from the data again means a view that *publishes* logs is not itself
 * re-rendered by them.
 */
export function WorkbenchProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConsoleProvider>
      <LayoutProvider>{children}</LayoutProvider>
    </ConsoleProvider>
  )
}

function ConsoleProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = React.useState<LogLine[]>([])
  const logId = React.useRef(0)

  // Alerts are stored per-source so one view publishing doesn't wipe another.
  const [alertMap, setAlertMap] = React.useState<Record<string, WorkbenchAlert[]>>({})
  const [runStatus, setRunStatus] = React.useState<RunStatus | null>(null)
  const [runHistory, setRunHistory] = React.useState<RunRecord[]>([])
  // Only the view currently on the bench contributes status-bar items and a
  // context line, so these are single slots rather than per-source maps.
  const [statusItems, setStatusItems] = React.useState<StatusItem[]>([])
  const [viewContext, setViewContext] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  /* ---- Run log --------------------------------------------------------- */

  const pushLog = React.useCallback(
    (line: Omit<LogLine, "id" | "ts"> & { ts?: number }) => {
      setLogs((prev) => {
        const next = [
          ...prev,
          { id: logId.current++, ts: line.ts ?? Date.now(), ...line },
        ]
        // Cap the buffer so a long-running simulation can't grow without bound.
        return next.length > 500 ? next.slice(next.length - 500) : next
      })
    },
    [],
  )

  const clearLogs = React.useCallback(() => setLogs([]), [])

  /**
   * Put a persisted tail back, ahead of anything already logged this session.
   *
   * Restored lines are renumbered rather than keeping the ids they were saved
   * with. The workbench writes two boot lines from a child effect, which runs
   * *before* this parent effect — so a restored line carrying id 0 collided
   * with the boot line already holding id 0, and React rendered the list with
   * duplicate keys.
   */
  const restoreLogs = React.useCallback((lines: LogLine[]) => {
    if (lines.length === 0) return
    setLogs((prev) => {
      const renumbered = lines.map((line, index) => ({ ...line, id: -lines.length + index }))
      return [...renumbered, ...prev]
    })
  }, [])

  /* ---- Alerts ---------------------------------------------------------- */

  const publishAlerts = React.useCallback((source: string, next: WorkbenchAlert[]) => {
    setAlertMap((prev) => {
      const current = prev[source]
      // Bail when nothing changed so publishing from a render effect can't loop.
      if (
        current &&
        current.length === next.length &&
        current.every(
          (a, i) =>
            a.message === next[i].message &&
            a.severity === next[i].severity &&
            a.at === next[i].at,
        )
      ) {
        return prev
      }
      if (next.length === 0 && !current) return prev
      return { ...prev, [source]: next }
    })
  }, [])

  const dismissAlerts = React.useCallback((source?: string) => {
    setAlertMap((prev) => {
      if (source === undefined) return Object.keys(prev).length === 0 ? prev : {}
      if (!(source in prev)) return prev
      const next = { ...prev }
      delete next[source]
      return next
    })
  }, [])

  const alerts = React.useMemo(() => Object.values(alertMap).flat(), [alertMap])

  /* ---- Runs ------------------------------------------------------------ */

  // The run in flight, tracked outside state so recording its completion never
  // depends on a render having happened first.
  const activeRun = React.useRef<{
    label: string
    startedAt: number
    detail?: string
    source?: string
  } | null>(null)
  const runId = React.useRef(0)

  const publishRunStatus = React.useCallback((status: RunStatus | null) => {
    setRunStatus((prev) => {
      if (
        prev === status ||
        (prev &&
          status &&
          prev.label === status.label &&
          prev.state === status.state &&
          prev.progress === status.progress &&
          prev.detail === status.detail)
      ) {
        return prev
      }
      return status
    })

    // History is derived from the transition, not the value, so it is recorded
    // here rather than inside the updater above (which React may replay).
    const active = activeRun.current
    const inFlight = status?.state === "running" || status?.state === "paused"

    if (inFlight) {
      if (!active || active.label !== status.label) {
        activeRun.current = {
          label: status.label,
          startedAt: Date.now(),
          detail: status.detail,
          source: status.source,
        }
      } else if (status.detail) {
        active.detail = status.detail
      }
      return
    }

    // A run that leaves the in-flight states — or whose view unmounts — is
    // finished, one way or the other.
    if (!active) return
    activeRun.current = null

    const completed = status?.state === "done"
    const record: RunRecord = {
      id: runId.current++,
      label: active.label,
      detail: status?.detail ?? active.detail,
      startedAt: active.startedAt,
      endedAt: Date.now(),
      outcome: completed ? "completed" : "stopped",
    }

    setRunHistory((prev) => [record, ...prev].slice(0, 50))

    if (completed) {
      toast({
        variant: "success",
        title: `${active.label} finished`,
        description: record.detail,
      })
    } else {
      // A run ends when its view unmounts, which is what happens the moment
      // you open another analysis. Saying so out loud is better than the run
      // silently vanishing from the status bar — see docs/BUG-REPORT.md, where
      // running analyses in the background is recorded as a known limitation.
      toast({
        variant: "warning",
        title: `${active.label} stopped`,
        description: "Runs end when you leave the analysis that started them.",
      })
    }
  }, [])

  const clearRunHistory = React.useCallback(() => setRunHistory([]), [])

  /** Same renumbering as the log, for the same reason. */
  const restoreRunHistory = React.useCallback((records: RunRecord[]) => {
    if (records.length === 0) return
    setRunHistory((prev) => {
      const renumbered = records.map((record, index) => ({
        ...record,
        id: -records.length + index,
      }))
      return [...prev, ...renumbered].slice(0, 50)
    })
  }, [])

  /* ---- Contextual chrome ----------------------------------------------- */

  const publishStatusItems = React.useCallback((items: StatusItem[]) => {
    setStatusItems((prev) => {
      // Compare by identity fields so a view can republish every render without
      // forcing the status bar to re-render.
      if (
        prev.length === items.length &&
        prev.every((p, i) => p.id === items[i].id && p.label === items[i].label)
      ) {
        return prev
      }
      return items
    })
  }, [])

  const publishViewContext = React.useCallback(
    (detail: string | null) =>
      setViewContext((prev) => (prev === detail ? prev : detail)),
    [],
  )

  /**
   * Held in a ref so `notify` keeps an empty dependency list — see the note on
   * `actions` below. Re-notifying restarts the clock rather than stacking a
   * second timer that would clear a message it did not set.
   */
  const noticeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const notify = React.useCallback((message: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    setNotice(message)
    noticeTimer.current = setTimeout(() => {
      noticeTimer.current = null
      setNotice(null)
    }, 4000)
  }, [])

  React.useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current)
    },
    [],
  )

  // Every dependency here is a `useCallback` with an empty dep list, so this
  // object is created once. That is the whole point: publishers subscribe to it
  // and never re-render because of the data they publish.
  const actions = React.useMemo<ConsoleActions>(
    () => ({
      pushLog,
      clearLogs,
      restoreLogs,
      publishAlerts,
      dismissAlerts,
      publishRunStatus,
      clearRunHistory,
      restoreRunHistory,
      publishStatusItems,
      publishViewContext,
      notify,
    }),
    [
      pushLog,
      clearLogs,
      restoreLogs,
      publishAlerts,
      dismissAlerts,
      publishRunStatus,
      clearRunHistory,
      restoreRunHistory,
      publishStatusItems,
      publishViewContext,
      notify,
    ],
  )

  /* ---- Persistence ----------------------------------------------------- */

  // The History tab used to say "no finished runs in this session yet" after
  // every refresh, because nothing outlived the page. Both the finished runs
  // and the tail of the log are restored on mount and written back as they
  // change.
  const restored = React.useRef(false)

  React.useEffect(() => {
    if (restored.current) return
    restored.current = true
    restoreRunHistory(readJSON<RunRecord[]>(STORAGE_KEYS.runHistory, []))
    restoreLogs(readJSON<LogLine[]>(STORAGE_KEYS.runLog, []))
  }, [restoreLogs, restoreRunHistory])

  React.useEffect(() => {
    if (!restored.current) return
    writeJSON(STORAGE_KEYS.runHistory, runHistory)
  }, [runHistory])

  React.useEffect(() => {
    if (!restored.current) return
    // Only the tail: a long simulation writes hundreds of lines a minute and
    // the quota is not worth spending on all of them.
    writeJSON(STORAGE_KEYS.runLog, logs.slice(-200))
  }, [logs])

  const state = React.useMemo<ConsoleState>(
    () => ({ logs, alerts, runStatus, runHistory, statusItems, viewContext, notice }),
    [logs, alerts, runStatus, runHistory, statusItems, viewContext, notice],
  )

  /* ---- Tab signals ----------------------------------------------------- */

  // Derived from the alert map and the run status only, so appending a log line
  // never invalidates it and the tab strip stays still while output streams.
  const signals = React.useMemo<ConsoleSignals>(() => {
    const alertsBySource: ConsoleSignals["alertsBySource"] = {}
    for (const [source, list] of Object.entries(alertMap)) {
      let errors = 0
      let warnings = 0
      for (const alert of list) {
        if (alert.severity === "error") errors += 1
        else if (alert.severity === "warning") warnings += 1
      }
      if (errors > 0 || warnings > 0) alertsBySource[source] = { errors, warnings }
    }
    return {
      runSource:
        runStatus && (runStatus.state === "running" || runStatus.state === "paused")
          ? (runStatus.source ?? null)
          : null,
      runState: runStatus?.state ?? null,
      alertsBySource,
    }
  }, [alertMap, runStatus])

  return (
    <ConsoleActionsContext.Provider value={actions}>
      <ConsoleSignalsContext.Provider value={signals}>
        <ConsoleStateContext.Provider value={state}>
          {children}
        </ConsoleStateContext.Provider>
      </ConsoleSignalsContext.Provider>
    </ConsoleActionsContext.Provider>
  )
}

function LayoutProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  // Safe to read here: this provider is rendered inside `ConsoleProvider`, and
  // the actions object is created once, so it never re-renders the layout.
  const { notify } = useConsoleActions()

  const [layout, setLayout] = React.useState<LayoutState>(DEFAULT_LAYOUT)
  const [hydrated, setHydrated] = React.useState(false)
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const [paletteSeed, setPaletteSeed] = React.useState("")

  const openPalette = React.useCallback((seed = "") => {
    setPaletteSeed(seed)
    setPaletteOpen(true)
  }, [])

  const view = React.useMemo(() => viewForPath(pathname), [pathname])

  /* ---- Persistence ---------------------------------------------------- */

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as Partial<LayoutState>
        setLayout((prev) => ({
          ...prev,
          ...saved,
          // Never restore a maximized console or focus mode — both hide chrome,
          // and waking up inside them is disorienting.
          panelMaximized: false,
          focusMode: false,
          // Guard the enums: a build that renames a sidebar mode or a console
          // tab must not leave a returning operator staring at an empty region.
          activity: ACTIVITY_IDS.includes(saved.activity as ActivityId)
            ? (saved.activity as ActivityId)
            : prev.activity,
          panelTab: PANEL_TAB_IDS.includes(saved.panelTab as PanelTabId)
            ? (saved.panelTab as PanelTabId)
            : prev.panelTab,
          // Two guards, both for layouts written by an earlier build. The set
          // is deduped because a `Set` of hrefs is what the open tabs have
          // always *meant* — a duplicate entry would render two tabs sharing a
          // React key, and closing either would act on the wrong one. And an
          // empty list is floored: a build shipped before this one let "close
          // all" persist `openTabs: []`, so that is sitting in storage today.
          openTabs: normalizeOpenTabs(
            Array.isArray(saved.openTabs) ? saved.openTabs : prev.openTabs,
            VIEWS.map((v) => v.href),
            HOME_HREF,
          ),
        }))
      }
    } catch {
      /* Corrupt or unavailable storage just falls back to defaults. */
    }
    setHydrated(true)
  }, [])

  React.useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
    } catch {
      /* Quota or private-mode failures are not worth surfacing. */
    }
  }, [layout, hydrated])

  /* ---- Zoom ------------------------------------------------------------ */

  React.useEffect(() => {
    if (!hydrated) return
    const index = Math.min(
      ZOOM_STEPS.length - 1,
      Math.max(0, ZOOM_BASE_INDEX + layout.zoom),
    )
    document.documentElement.style.fontSize = `${ZOOM_STEPS[index]}px`
    return () => {
      document.documentElement.style.fontSize = ""
    }
  }, [layout.zoom, hydrated])

  /* ---- Responsive collapse --------------------------------------------- */

  // Three columns plus a 48px rail need room. Below these widths the bench
  // folds the optional columns away.
  //
  // This is deliberately kept OUT of `layout`: folding is a property of the
  // viewport, not a choice the user made. Writing it into the persisted layout
  // would mean visiting on a narrow screen silently overwrites the sidebar
  // preference they set on a wide one, and widening again would never bring it
  // back. Effective visibility is `preference && !forced`, so widening simply
  // reveals whatever they already had.
  const [forced, setForced] = React.useState({ sidebar: false, inspector: false })

  React.useEffect(() => {
    const narrow = window.matchMedia("(max-width: 1180px)")
    const veryNarrow = window.matchMedia("(max-width: 900px)")

    const apply = () =>
      setForced((prev) =>
        prev.inspector === narrow.matches && prev.sidebar === veryNarrow.matches
          ? prev
          : { inspector: narrow.matches, sidebar: veryNarrow.matches },
      )

    apply()
    narrow.addEventListener("change", apply)
    veryNarrow.addEventListener("change", apply)
    return () => {
      narrow.removeEventListener("change", apply)
      veryNarrow.removeEventListener("change", apply)
    }
  }, [])

  const sidebarVisible = layout.sidebarVisible && !forced.sidebar
  const inspectorVisible = layout.inspectorVisible && !forced.inspector

  /* ---- Open analyses --------------------------------------------------- */

  /**
   * Recently closed analyses, newest first.
   *
   * Closing a tab is the one destructive action in the workbench, and losing a
   * carefully arranged set to one mis-click is a real risk. Every editor binds
   * this to Ctrl+Shift+T, which browsers reserve for their own tabs, so the
   * workbench uses Alt+Shift+T instead.
   */
  const [closedTabs, setClosedTabs] = React.useState<string[]>([])

  const rememberClosed = React.useCallback((hrefs: string[]) => {
    if (hrefs.length === 0) return
    setClosedTabs((prev) => [...hrefs, ...prev.filter((h) => !hrefs.includes(h))].slice(0, 12))
  }, [])

  // Opening a view keeps it open, so a half-finished analysis is still one
  // click away after you go and check a gene record.
  React.useEffect(() => {
    if (!view) return
    setLayout((prev) =>
      prev.openTabs.includes(view.href)
        ? prev
        : { ...prev, openTabs: [...prev.openTabs, view.href] },
    )
  }, [view])

  const tabs = React.useMemo(
    () =>
      layout.openTabs
        .map((href) => VIEWS.find((v) => v.href === href))
        .filter((v): v is WorkbenchView => Boolean(v)),
    [layout.openTabs],
  )

  /**
   * Open a view, and navigate to it.
   *
   * The href a caller passes may carry a query — the gene library is opened as
   * `…/gene-database?q=mecA` from both the sidebar and the palette. The query
   * is for the router; only the bare route is a tab.
   */
  const openTab = React.useCallback(
    (href: string) => {
      const tabHref = normalizeHref(href)
      setLayout((prev) =>
        prev.openTabs.includes(tabHref)
          ? prev
          : { ...prev, openTabs: [...prev.openTabs, tabHref] },
      )
      router.push(href)
    },
    [router],
  )

  /**
   * False when the strip is down to its last tab, which cannot be closed.
   *
   * Counted off `tabs` rather than `openTabs` deliberately. The two only differ
   * if an href in the open set names no view — which nothing should now be able
   * to produce — but if one ever did, counting the raw set would let the last
   * *rendered* tab be closed and put the strip right back to reading "nothing
   * open" under a bench that is showing something.
   */
  const canCloseTab = tabs.length > 1

  const closeTab = React.useCallback(
    (href: string) => {
      const index = layout.openTabs.indexOf(href)
      if (index === -1) return

      // The last tab stays. Guarded here rather than at the call sites because
      // six of them reach this function — the tab's ×, middle-click, Delete in
      // the strip, Alt+W, the context menu and the palette — and a guard that
      // lives on the button is a guard middle-click walks straight past.
      //
      // It says so, too. Hiding the × explains nothing to someone who reaches
      // for Alt+W instead, and a rule enforced in silence is indistinguishable
      // from a broken control.
      if (tabs.length <= 1) {
        notify("The last analysis stays open")
        return
      }

      const next = layout.openTabs.filter((h) => h !== href)
      rememberClosed([href])
      setLayout((prev) => ({
        ...prev,
        openTabs: prev.openTabs.filter((h) => h !== href),
      }))

      if (view?.href !== href) return

      // Closing the open view hands the bench to its neighbour: the tab that
      // slid into this position, else the one before it. One of the two always
      // exists, because the guard above refuses to close the last tab.
      router.push(next[index] ?? next[index - 1])
    },
    [layout.openTabs, notify, rememberClosed, router, tabs, view],
  )

  const closeOtherTabs = React.useCallback(
    (href: string) => {
      rememberClosed(layout.openTabs.filter((h) => h !== href))
      setLayout((prev) => ({ ...prev, openTabs: [href] }))
      router.push(href)
    },
    [layout.openTabs, rememberClosed, router],
  )

  /**
   * Clear the deck: close everything and land back on the Overview.
   *
   * An earlier pass had this genuinely empty the strip, which is what an editor
   * does — but an editor can show a blank watermark and this bench cannot. It
   * left the Overview rendered under a strip that read "Nothing open". Leaving
   * the one tab is both honest and the more useful action; Alt+Shift+T brings
   * the rest back one at a time.
   */
  const closeAllTabs = React.useCallback(() => {
    // The Overview survives, so it is not something to undo.
    rememberClosed(layout.openTabs.filter((h) => h !== HOME_HREF))
    setLayout((prev) =>
      prev.openTabs.length === 1 && prev.openTabs[0] === HOME_HREF
        ? prev
        : { ...prev, openTabs: [HOME_HREF] },
    )
    if (view?.href !== HOME_HREF) router.push(HOME_HREF)
  }, [layout.openTabs, rememberClosed, router, view])

  /**
   * Move an open analysis to a new position in the strip — the drag, and
   * Alt+Shift+Arrow, both land here.
   *
   * Order is part of `layout`, so a rearranged strip is persisted with
   * everything else and survives a reload without any extra machinery.
   */
  const moveTab = React.useCallback((href: string, toIndex: number) => {
    setLayout((prev) => {
      const from = prev.openTabs.indexOf(href)
      if (from === -1) return prev

      const to = Math.max(0, Math.min(prev.openTabs.length - 1, toIndex))
      if (from === to) return prev

      const next = [...prev.openTabs]
      next.splice(from, 1)
      next.splice(to, 0, href)
      return { ...prev, openTabs: next }
    })
  }, [])

  /**
   * Put back the most recently closed analysis.
   *
   * Reads the stack rather than mutating it from inside an updater: navigation
   * and a second `setState` are side effects, and React is free to re-run an
   * updater (it does, under StrictMode in development), which would have fired
   * the router twice per press.
   */
  const reopenClosedTab = React.useCallback(() => {
    const href = closedTabs[0]
    if (!href) return
    setClosedTabs((prev) => prev.slice(1))
    setLayout((prev) =>
      prev.openTabs.includes(href)
        ? prev
        : { ...prev, openTabs: [...prev.openTabs, href] },
    )
    router.push(href)
  }, [closedTabs, router])

  /* ---- Layout actions -------------------------------------------------- */

  const patch = React.useCallback(
    (next: Partial<LayoutState>) => setLayout((prev) => ({ ...prev, ...next })),
    [],
  )

  const setActivity = React.useCallback(
    (id: ActivityId) => {
      // Picking a mode from the rail is an explicit request to see the sidebar,
      // so it clears the responsive fold the same way `toggleSidebar` does.
      // Without this, effective visibility stays `preference && !forced` and on
      // a narrow viewport clicking a rail icon set the preference but changed
      // nothing on screen — the sidebar simply refused to open.
      setForced((f) => (f.sidebar ? { ...f, sidebar: false } : f))
      // Clicking the mode you are already looking at collapses the sidebar and
      // gives the width back to the bench. That must be judged on what is
      // actually on screen: when the fold has the sidebar hidden, clicking the
      // active mode should open it rather than toggle it further shut.
      setLayout((prev) =>
        prev.activity === id && sidebarVisible
          ? { ...prev, sidebarVisible: false }
          : { ...prev, activity: id, sidebarVisible: true },
      )
    },
    [sidebarVisible],
  )

  // Toggling is always relative to what is on screen, and an explicit toggle
  // clears the responsive fold so the user can force a column open on a narrow
  // viewport if they want it.
  const toggleSidebar = React.useCallback(() => {
    setForced((f) => (f.sidebar ? { ...f, sidebar: false } : f))
    setLayout((p) => ({ ...p, sidebarVisible: !sidebarVisible }))
  }, [sidebarVisible])
  const togglePanel = React.useCallback(
    () =>
      setLayout((p) => ({
        ...p,
        panelVisible: !p.panelVisible,
        panelMaximized: p.panelVisible ? false : p.panelMaximized,
      })),
    [],
  )
  const togglePanelMaximized = React.useCallback(
    () =>
      setLayout((p) => ({
        ...p,
        panelVisible: true,
        panelMaximized: !p.panelMaximized,
      })),
    [],
  )
  const toggleInspector = React.useCallback(() => {
    setForced((f) => (f.inspector ? { ...f, inspector: false } : f))
    setLayout((p) => ({ ...p, inspectorVisible: !inspectorVisible }))
  }, [inspectorVisible])
  const toggleStatusBar = React.useCallback(
    () => setLayout((p) => ({ ...p, statusBarVisible: !p.statusBarVisible })),
    [],
  )
  const toggleTabBar = React.useCallback(
    () => setLayout((p) => ({ ...p, tabBarVisible: !p.tabBarVisible })),
    [],
  )
  const toggleFocusMode = React.useCallback(
    () => setLayout((p) => ({ ...p, focusMode: !p.focusMode })),
    [],
  )

  const zoomIn = React.useCallback(
    () => setLayout((p) => ({ ...p, zoom: Math.min(3, p.zoom + 1) })),
    [],
  )
  const zoomOut = React.useCallback(
    () => setLayout((p) => ({ ...p, zoom: Math.max(-3, p.zoom - 1) })),
    [],
  )
  const zoomReset = React.useCallback(() => setLayout((p) => ({ ...p, zoom: 0 })), [])

  const resetLayout = React.useCallback(
    () => setLayout((p) => ({ ...DEFAULT_LAYOUT, openTabs: p.openTabs })),
    [],
  )

  /* ---- Keybindings ----------------------------------------------------- */

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      const target = e.target as HTMLElement | null
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)

      if (e.key === "Escape" && layout.panelMaximized) {
        setLayout((p) => ({ ...p, panelMaximized: false }))
        return
      }
      if (e.key === "Escape" && layout.focusMode) {
        setLayout((p) => ({ ...p, focusMode: false }))
        return
      }

      // Alt+W closes the open view, Alt+Shift+T reopens the last one closed.
      //
      // Both use Alt for the same reason: the browser reserves Ctrl+W and
      // Ctrl+Shift+T for its own tabs and will not surrender either to page
      // content, so binding the editor-conventional chords here would have
      // produced a shortcut that silently did the wrong thing.
      if (e.altKey && !mod) {
        const key = e.key.toLowerCase()
        if (key === "w" && view) {
          e.preventDefault()
          closeTab(view.href)
          return
        }
        if (key === "t") {
          e.preventDefault()
          reopenClosedTab()
          return
        }
        // Alt+Shift+Arrow moves the open analysis along the strip. Dragging is
        // the discoverable way to reorder, but native HTML5 drag is mouse-only,
        // so without this the feature simply does not exist for anyone working
        // from the keyboard.
        if (e.shiftKey && view && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
          e.preventDefault()
          const from = layout.openTabs.indexOf(view.href)
          if (from === -1) return
          moveTab(view.href, from + (e.key === "ArrowRight" ? 1 : -1))
          return
        }
      }

      if (!mod) return

      // Interface zoom is bound to Ctrl+Alt rather than plain Ctrl: browsers
      // own Ctrl +/-/0 for page zoom and won't let a page take them over.
      if (e.altKey) {
        switch (e.key) {
          case "=":
          case "+":
            e.preventDefault()
            zoomIn()
            return
          case "-":
          case "_":
            e.preventDefault()
            zoomOut()
            return
          case "0":
            e.preventDefault()
            zoomReset()
            return
        }
      }

      // Ctrl+K / Ctrl+P open the palette on views; Ctrl+Shift+P opens it in
      // command mode.
      if (e.key.toLowerCase() === "k" || e.key.toLowerCase() === "p") {
        e.preventDefault()
        openPalette(e.shiftKey && e.key.toLowerCase() === "p" ? ">" : "")
        return
      }

      // The remaining chords would fight with text editing.
      if (typing && e.key.toLowerCase() === "b") return

      switch (e.key.toLowerCase()) {
        case "b":
          e.preventDefault()
          if (e.altKey) toggleInspector()
          else toggleSidebar()
          break
        case "j":
          e.preventDefault()
          togglePanel()
          break
        case "`":
          e.preventDefault()
          setLayout((p) => ({ ...p, panelVisible: true, panelTab: "log" }))
          break
        case ",":
          if (!typing) {
            e.preventDefault()
            router.push("/settings")
          }
          break
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    closeTab,
    reopenClosedTab,
    moveTab,
    layout.openTabs,
    layout.panelMaximized,
    layout.focusMode,
    openPalette,
    router,
    toggleInspector,
    togglePanel,
    toggleSidebar,
    view,
    zoomIn,
    zoomOut,
    zoomReset,
  ])

  const value = React.useMemo<WorkbenchContextValue>(
    () => ({
      ...layout,
      // Effective values win over the raw persisted preference.
      sidebarVisible,
      inspectorVisible,
      hydrated,
      view,
      tabs,
      setActivity,
      toggleSidebar,
      setSidebarVisible: (v: boolean) => {
        // The resizable panel reports its own collapse. When that collapse was
        // the responsive rule's doing rather than the user's, swallow it so the
        // stored preference survives the narrow viewport.
        if (!v && forced.sidebar) return
        patch({ sidebarVisible: v })
      },
      setSidebarSize: (n) => patch({ sidebarSize: n }),
      togglePanel,
      setPanelVisible: (v) => patch({ panelVisible: v }),
      setPanelSize: (n) => patch({ panelSize: n }),
      setPanelTab: (t) => patch({ panelTab: t, panelVisible: true }),
      togglePanelMaximized,
      toggleInspector,
      toggleStatusBar,
      toggleTabBar,
      toggleFocusMode,
      zoomIn,
      zoomOut,
      zoomReset,
      openTab,
      closeTab,
      canCloseTab,
      closeOtherTabs,
      closeAllTabs,
      moveTab,
      reopenClosedTab,
      closedTabCount: closedTabs.length,
      resetLayout,
      paletteOpen,
      setPaletteOpen,
      paletteSeed,
      openPalette,
    }),
    [
      layout,
      sidebarVisible,
      inspectorVisible,
      forced.sidebar,
      hydrated,
      view,
      tabs,
      setActivity,
      toggleSidebar,
      patch,
      togglePanel,
      togglePanelMaximized,
      toggleInspector,
      toggleStatusBar,
      toggleTabBar,
      toggleFocusMode,
      zoomIn,
      zoomOut,
      zoomReset,
      openTab,
      closeTab,
      canCloseTab,
      closeOtherTabs,
      closeAllTabs,
      moveTab,
      reopenClosedTab,
      closedTabs.length,
      resetLayout,
      paletteOpen,
      paletteSeed,
      openPalette,
    ],
  )

  return (
    <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>
  )
}

/* ============================================================================
   Hooks
   ========================================================================= */

/** Layout, open analyses and the palette. */
export function useWorkbench() {
  const ctx = React.useContext(WorkbenchContext)
  if (!ctx) throw new Error("useWorkbench must be used inside <WorkbenchProvider>")
  return ctx
}

/**
 * Everything a run has produced, plus the writers.
 *
 * Reading this subscribes the component to log output, so it belongs only to
 * things that actually display it: the console, the status bar, the Runs
 * sidebar and the context bar. To *write* without subscribing, use
 * {@link useConsoleActions} or one of the publishing hooks below.
 */
export function useConsole() {
  const state = React.useContext(ConsoleStateContext)
  const actions = React.useContext(ConsoleActionsContext)
  if (!state || !actions) {
    throw new Error("useConsole must be used inside <WorkbenchProvider>")
  }
  return React.useMemo(() => ({ ...state, ...actions }), [state, actions])
}

/** The console's writers alone. This value never changes identity. */
export function useConsoleActions() {
  const ctx = React.useContext(ConsoleActionsContext)
  if (!ctx) {
    throw new Error("useConsoleActions must be used inside <WorkbenchProvider>")
  }
  return ctx
}

/**
 * Run and alert state only — no log output.
 *
 * For chrome that needs to know *whether* something is happening without
 * re-rendering every time a line is written: the tab strip and the rail badge.
 */
export function useConsoleSignals() {
  const ctx = React.useContext(ConsoleSignalsContext)
  if (!ctx) {
    throw new Error("useConsoleSignals must be used inside <WorkbenchProvider>")
  }
  return ctx
}

/**
 * What a given view's tab should show: a pulse while it runs, a dot when it has
 * raised something, nothing otherwise.
 */
export function tabSignalFor(
  view: WorkbenchView,
  signals: ConsoleSignals,
): { signal: TabSignal; severity: "error" | "warning" | null } {
  if (signals.runSource && signals.runSource === view.source) {
    return { signal: "running", severity: null }
  }
  const counts = signals.alertsBySource[view.source]
  if (counts) {
    return {
      signal: "attention",
      severity: counts.errors > 0 ? "error" : "warning",
    }
  }
  return { signal: "idle", severity: null }
}

/**
 * Mirror a producer's log strings into the console's run log.
 *
 * Tracks the last line it emitted rather than a count, so it works for both
 * append-only histories and fixed-size rolling buffers (a simulation that keeps
 * only its most recent ten entries still streams every line exactly once).
 */
export function useLogStream(
  source: string,
  lines: string[],
  level: LogLevel = "info",
) {
  const { pushLog } = useConsoleActions()
  const lastSent = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (lines.length === 0) {
      lastSent.current = null
      return
    }

    // Resume after the last line already mirrored. If it has rolled out of the
    // buffer (or the producer reset), fall back to emitting everything present.
    const resumeAt =
      lastSent.current === null ? -1 : lines.lastIndexOf(lastSent.current)

    if (resumeAt === lines.length - 1) return

    for (let i = resumeAt + 1; i < lines.length; i++) {
      pushLog({ level, source, message: lines[i] })
    }
    lastSent.current = lines[lines.length - 1]
  }, [lines, level, pushLog, source])
}

/**
 * Publish a view's alerts to the console, the status bar and its tab.
 *
 * Alerts deliberately survive the view unmounting. They used to be cleared on
 * unmount, which meant the Alerts tab could only ever show the analysis you
 * were looking at — scan three files across three views and the console still
 * showed one view's warnings. Keeping them is also what lets a tab carry an
 * attention marker for a view you are not currently on. They are replaced when
 * the view republishes, and dismissed explicitly from the console.
 */
export function useAlerts(source: string, alerts: WorkbenchAlert[]) {
  const { publishAlerts } = useConsoleActions()

  React.useEffect(() => {
    publishAlerts(source, alerts)
  }, [alerts, publishAlerts, source])
}

/**
 * Publish the open view's readouts to the right of the status bar — the counts
 * and settings that describe what is currently loaded.
 */
export function useStatusItems(items: StatusItem[]) {
  const { publishStatusItems } = useConsoleActions()

  React.useEffect(() => {
    publishStatusItems(items)
  }, [items, publishStatusItems])

  React.useEffect(() => {
    return () => publishStatusItems([])
  }, [publishStatusItems])
}

/** Publish the current long-running job to the status bar and Runs sidebar. */
export function useRunStatus(status: RunStatus | null) {
  const { publishRunStatus } = useConsoleActions()

  React.useEffect(() => {
    publishRunStatus(status)
  }, [publishRunStatus, status])

  React.useEffect(() => {
    return () => publishRunStatus(null)
  }, [publishRunStatus])
}

/**
 * Name what the open view is working on — the sample loaded, the organism
 * selected, the reference in use. Shown in the context bar above the bench,
 * which otherwise falls back to describing what the view is for.
 */
export function useViewContext(detail: string | null) {
  const { publishViewContext } = useConsoleActions()

  React.useEffect(() => {
    publishViewContext(detail)
  }, [detail, publishViewContext])

  React.useEffect(() => {
    return () => publishViewContext(null)
  }, [publishViewContext])
}
