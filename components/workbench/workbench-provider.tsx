"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { VIEWS, viewForPath, type WorkbenchView } from "./registry"

/* ============================================================================
   Types
   ========================================================================= */

export type ActivityId =
  | "explorer"
  | "search"
  | "run"
  | "database"
  | "notifications"
  | "settings"

export type PanelTabId = "problems" | "output" | "terminal"

export type LogLevel = "info" | "success" | "warn" | "error" | "debug" | "command"

export interface LogLine {
  id: number
  ts: number
  level: LogLevel
  source: string
  message: string
}

export interface Problem {
  /** Which view raised it — used for grouping in the Problems tab. */
  source: string
  severity: "error" | "warning" | "info"
  message: string
  /** Optional location hint, rendered like a file position. */
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
  /** Label shown in the status bar and the Run view. */
  label: string
  state: "idle" | "running" | "paused" | "done"
  /** 0–100; omitted when the job has no determinate progress. */
  progress?: number
  detail?: string
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
  breadcrumbsVisible: boolean
  tabBarVisible: boolean
  zen: boolean
  zoom: number
  openTabs: string[]
}

const DEFAULT_LAYOUT: LayoutState = {
  activity: "explorer",
  sidebarVisible: true,
  sidebarSize: 18,
  panelVisible: false,
  panelSize: 32,
  panelMaximized: false,
  panelTab: "terminal",
  inspectorVisible: true,
  statusBarVisible: true,
  breadcrumbsVisible: true,
  tabBarVisible: true,
  zen: false,
  zoom: 0,
  openTabs: ["/dashboard"],
}

const STORAGE_KEY = "helixmind.workbench.v1"

/** Zoom step → root font size, mirroring VS Code's Ctrl+= / Ctrl+- behaviour. */
const ZOOM_STEPS = [13, 14, 15, 16, 17, 18, 20] // index 3 (16px) is 100%
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
  toggleBreadcrumbs: () => void
  toggleTabBar: () => void
  toggleZen: () => void

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

  /* ---- Terminal / diagnostics ---- */
  logs: LogLine[]
  pushLog: (line: Omit<LogLine, "id" | "ts"> & { ts?: number }) => void
  clearLogs: () => void

  problems: Problem[]
  publishProblems: (source: string, problems: Problem[]) => void

  runStatus: RunStatus | null
  publishRunStatus: (status: RunStatus | null) => void

  statusItems: StatusItem[]
  publishStatusItems: (items: StatusItem[]) => void
}

const WorkbenchContext = React.createContext<WorkbenchContextValue | null>(null)

/* ============================================================================
   Provider
   ========================================================================= */

export function WorkbenchProvider({ children }: { children: React.ReactNode }) {
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

  const [logs, setLogs] = React.useState<LogLine[]>([])
  const logId = React.useRef(0)

  // Problems are stored per-source so one view publishing doesn't wipe another.
  const [problemMap, setProblemMap] = React.useState<Record<string, Problem[]>>({})
  const [runStatus, setRunStatus] = React.useState<RunStatus | null>(null)
  // Only the view currently in the editor contributes status-bar items, so this
  // is a single slot rather than a per-source map.
  const [statusItems, setStatusItems] = React.useState<StatusItem[]>([])

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
          // Never restore a maximized panel or zen mode — both hide chrome, and
          // waking up inside them is disorienting.
          panelMaximized: false,
          zen: false,
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

  // Three columns plus a 48px rail need room. Below these widths the workbench
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

  /* ---- Tabs ------------------------------------------------------------ */

  // Visiting a route opens a tab for it, the way clicking a file in the
  // explorer opens an editor.
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

      // Closing the active tab hands focus to its neighbour, VS Code-style.
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
    // Clicking the active icon collapses the side bar, exactly like VS Code.
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
  const toggleBreadcrumbs = React.useCallback(
    () => setLayout((p) => ({ ...p, breadcrumbsVisible: !p.breadcrumbsVisible })),
    [],
  )
  const toggleTabBar = React.useCallback(
    () => setLayout((p) => ({ ...p, tabBarVisible: !p.tabBarVisible })),
    [],
  )
  const toggleZen = React.useCallback(
    () => setLayout((p) => ({ ...p, zen: !p.zen })),
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

  /* ---- Terminal -------------------------------------------------------- */

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

  const publishProblems = React.useCallback((source: string, next: Problem[]) => {
    setProblemMap((prev) => {
      const current = prev[source]
      // Bail when nothing changed so publishing from a render effect can't loop.
      if (
        current &&
        current.length === next.length &&
        current.every(
          (p, i) =>
            p.message === next[i].message &&
            p.severity === next[i].severity &&
            p.at === next[i].at,
        )
      ) {
        return prev
      }
      if (next.length === 0 && !current) return prev
      return { ...prev, [source]: next }
    })
  }, [])

  const problems = React.useMemo(
    () => Object.values(problemMap).flat(),
    [problemMap],
  )

  const publishRunStatus = React.useCallback((status: RunStatus | null) => {
    setRunStatus((prev) => {
      if (prev === status) return prev
      if (
        prev &&
        status &&
        prev.label === status.label &&
        prev.state === status.state &&
        prev.progress === status.progress &&
        prev.detail === status.detail
      ) {
        return prev
      }
      return status
    })
  }, [])

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
      if (e.key === "Escape" && layout.zen) {
        setLayout((p) => ({ ...p, zen: false }))
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

      // Command palette. Ctrl+K / Ctrl+P open it in "go to view" mode;
      // Ctrl+Shift+P opens it in command mode, exactly like VS Code.
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
          setLayout((p) => ({ ...p, panelVisible: true, panelTab: "terminal" }))
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
    layout.zen,
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
      toggleBreadcrumbs,
      toggleTabBar,
      toggleZen,
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
      logs,
      pushLog,
      clearLogs,
      problems,
      publishProblems,
      runStatus,
      publishRunStatus,
      statusItems,
      publishStatusItems,
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
      toggleBreadcrumbs,
      toggleTabBar,
      toggleZen,
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
      logs,
      pushLog,
      clearLogs,
      problems,
      publishProblems,
      runStatus,
      publishRunStatus,
      statusItems,
      publishStatusItems,
    ],
  )

  return (
    <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>
  )
}

/* ============================================================================
   Hooks
   ========================================================================= */

export function useWorkbench() {
  const ctx = React.useContext(WorkbenchContext)
  if (!ctx) throw new Error("useWorkbench must be used inside <WorkbenchProvider>")
  return ctx
}

/**
 * Mirror a producer's log strings into the terminal panel.
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
  const { pushLog } = useWorkbench()
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

/** Publish a view's diagnostics to the Problems tab and the status bar. */
export function useProblems(source: string, problems: Problem[]) {
  const { publishProblems } = useWorkbench()

  React.useEffect(() => {
    publishProblems(source, problems)
  }, [problems, publishProblems, source])

  // Clear this view's problems when it unmounts so stale entries don't linger.
  React.useEffect(() => {
    return () => publishProblems(source, [])
  }, [publishProblems, source])
}

/**
 * Publish the open view's contextual status-bar items — the workbench analogue
 * of an editor showing "Ln 42, Col 8 · UTF-8 · TypeScript".
 */
export function useStatusItems(items: StatusItem[]) {
  const { publishStatusItems } = useWorkbench()

  React.useEffect(() => {
    publishStatusItems(items)
  }, [items, publishStatusItems])

  React.useEffect(() => {
    return () => publishStatusItems([])
  }, [publishStatusItems])
}

/** Publish the current long-running job to the status bar and Run view. */
export function useRunStatus(status: RunStatus | null) {
  const { publishRunStatus } = useWorkbench()

  React.useEffect(() => {
    publishRunStatus(status)
  }, [publishRunStatus, status])

  React.useEffect(() => {
    return () => publishRunStatus(null)
  }, [publishRunStatus])
}
