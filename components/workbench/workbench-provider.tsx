"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { VIEWS, viewForPath, type WorkbenchView } from "./registry"

/* ============================================================================
   Types
   ========================================================================= */

/** The sidebar's modes, in rail order. */
export type ActivityId = "analyses" | "search" | "runs" | "genes" | "preferences"

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
  contextBarVisible: boolean
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
  contextBarVisible: true,
  tabBarVisible: true,
  focusMode: false,
  zoom: 0,
  openTabs: ["/dashboard"],
}

const STORAGE_KEY = "helixmind.workbench.v2"

const ACTIVITY_IDS: ActivityId[] = [
  "analyses",
  "search",
  "runs",
  "genes",
  "preferences",
]
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
  toggleContextBar: () => void
  toggleTabBar: () => void
  toggleFocusMode: () => void

  zoomIn: () => void
  zoomOut: () => void
  zoomReset: () => void

  openTab: (href: string) => void
  closeTab: (href: string) => void
  closeOtherTabs: (href: string) => void
  closeAllTabs: () => void

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
  /** What the open view is working on, shown in the context bar. */
  viewContext: string | null
}

/** Every console writer. Stable for the lifetime of the provider. */
interface ConsoleActions {
  pushLog: (line: Omit<LogLine, "id" | "ts"> & { ts?: number }) => void
  clearLogs: () => void
  publishAlerts: (source: string, alerts: WorkbenchAlert[]) => void
  publishRunStatus: (status: RunStatus | null) => void
  clearRunHistory: () => void
  publishStatusItems: (items: StatusItem[]) => void
  publishViewContext: (detail: string | null) => void
}

const WorkbenchContext = React.createContext<WorkbenchContextValue | null>(null)
const ConsoleStateContext = React.createContext<ConsoleState | null>(null)
const ConsoleActionsContext = React.createContext<ConsoleActions | null>(null)

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

  const alerts = React.useMemo(() => Object.values(alertMap).flat(), [alertMap])

  /* ---- Runs ------------------------------------------------------------ */

  // The run in flight, tracked outside state so recording its completion never
  // depends on a render having happened first.
  const activeRun = React.useRef<{
    label: string
    startedAt: number
    detail?: string
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
    setRunHistory((prev) =>
      [
        {
          id: runId.current++,
          label: active.label,
          detail: status?.detail ?? active.detail,
          startedAt: active.startedAt,
          endedAt: Date.now(),
          outcome:
            status?.state === "done" ? ("completed" as const) : ("stopped" as const),
        },
        ...prev,
      ].slice(0, 50),
    )
  }, [])

  const clearRunHistory = React.useCallback(() => setRunHistory([]), [])

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

  // Every dependency here is a `useCallback` with an empty dep list, so this
  // object is created once. That is the whole point: publishers subscribe to it
  // and never re-render because of the data they publish.
  const actions = React.useMemo<ConsoleActions>(
    () => ({
      pushLog,
      clearLogs,
      publishAlerts,
      publishRunStatus,
      clearRunHistory,
      publishStatusItems,
      publishViewContext,
    }),
    [
      pushLog,
      clearLogs,
      publishAlerts,
      publishRunStatus,
      clearRunHistory,
      publishStatusItems,
      publishViewContext,
    ],
  )

  const state = React.useMemo<ConsoleState>(
    () => ({ logs, alerts, runStatus, runHistory, statusItems, viewContext }),
    [logs, alerts, runStatus, runHistory, statusItems, viewContext],
  )

  return (
    <ConsoleActionsContext.Provider value={actions}>
      <ConsoleStateContext.Provider value={state}>
        {children}
      </ConsoleStateContext.Provider>
    </ConsoleActionsContext.Provider>
  )
}

function LayoutProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

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
          openTabs: Array.isArray(saved.openTabs)
            ? saved.openTabs.filter((h) => VIEWS.some((v) => v.href === h))
            : prev.openTabs,
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

  // Opening a view keeps it open, so a half-finished simulation is still one
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

  const openTab = React.useCallback(
    (href: string) => {
      setLayout((prev) =>
        prev.openTabs.includes(href)
          ? prev
          : { ...prev, openTabs: [...prev.openTabs, href] },
      )
      router.push(href)
    },
    [router],
  )

  const closeTab = React.useCallback(
    (href: string) => {
      const index = layout.openTabs.indexOf(href)
      if (index === -1) return

      const next = layout.openTabs.filter((h) => h !== href)
      setLayout((prev) => ({
        ...prev,
        openTabs: prev.openTabs.filter((h) => h !== href),
      }))

      // Closing the open view hands the bench to its neighbour.
      if (view?.href === href) {
        router.push(next[index] ?? next[index - 1] ?? "/dashboard")
      }
    },
    [layout.openTabs, router, view],
  )

  const closeOtherTabs = React.useCallback(
    (href: string) => {
      setLayout((prev) => ({ ...prev, openTabs: [href] }))
      router.push(href)
    },
    [router],
  )

  const closeAllTabs = React.useCallback(() => {
    setLayout((prev) => ({ ...prev, openTabs: [] }))
    router.push("/dashboard")
  }, [router])

  /* ---- Layout actions -------------------------------------------------- */

  const patch = React.useCallback(
    (next: Partial<LayoutState>) => setLayout((prev) => ({ ...prev, ...next })),
    [],
  )

  const setActivity = React.useCallback((id: ActivityId) => {
    // Clicking the mode you are already in collapses the sidebar and gives the
    // width back to the bench.
    setLayout((prev) =>
      prev.activity === id && prev.sidebarVisible
        ? { ...prev, sidebarVisible: false }
        : { ...prev, activity: id, sidebarVisible: true },
    )
  }, [])

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
  const toggleContextBar = React.useCallback(
    () => setLayout((p) => ({ ...p, contextBarVisible: !p.contextBarVisible })),
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

      // Alt+W closes the open view. Ctrl+W is reserved by the browser for
      // closing its own tab and cannot be intercepted, so it is not bound.
      if (e.altKey && !mod && e.key.toLowerCase() === "w") {
        if (view) {
          e.preventDefault()
          closeTab(view.href)
        }
        return
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
      toggleContextBar,
      toggleTabBar,
      toggleFocusMode,
      zoomIn,
      zoomOut,
      zoomReset,
      openTab,
      closeTab,
      closeOtherTabs,
      closeAllTabs,
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
      toggleContextBar,
      toggleTabBar,
      toggleFocusMode,
      zoomIn,
      zoomOut,
      zoomReset,
      openTab,
      closeTab,
      closeOtherTabs,
      closeAllTabs,
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

/** Publish a view's alerts to the console and the status bar. */
export function useAlerts(source: string, alerts: WorkbenchAlert[]) {
  const { publishAlerts } = useConsoleActions()

  React.useEffect(() => {
    publishAlerts(source, alerts)
  }, [alerts, publishAlerts, source])

  // Clear this view's alerts when it unmounts so stale entries don't linger.
  React.useEffect(() => {
    return () => publishAlerts(source, [])
  }, [publishAlerts, source])
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
