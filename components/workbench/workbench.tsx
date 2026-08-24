"use client"

import * as React from "react"
import {
  useDefaultLayout,
  usePanelRef,
  type LayoutStorage,
  type PanelImperativeHandle,
  type PanelSize,
} from "react-resizable-panels"

import { cn } from "@/lib/utils"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { ActivityBar } from "./activity-bar"
import { BottomPanel } from "./panel"
import { CommandPalette } from "./command-palette"
import { SideBar } from "./side-bar"
import { StatusBar } from "./status-bar"
import { ContextBar, TabBar } from "./tab-bar"
import { TitleBar } from "./title-bar"
import { useConsoleActions, useWorkbench } from "./workbench-provider"

/**
 * The bench shell.
 *
 * Regions are laid out exactly once here and persist across navigation, so the
 * sidebar's scroll position, the run log and the resize handles all survive
 * moving between analyses. Only the bench body swaps.
 */
export function Workbench({ children }: { children: React.ReactNode }) {
  const {
    hydrated,
    focusMode,
    sidebarVisible,
    sidebarSize,
    setSidebarVisible,
    setSidebarSize,
    panelVisible,
    panelSize,
    panelMaximized,
    setPanelVisible,
    setPanelSize,
    statusBarVisible,
    tabBarVisible,
    contextBarVisible,
  } = useWorkbench()

  const sidebarRef = usePanelRef()
  const panelRef = usePanelRef()
  const restored = React.useRef(false)

  useBootLog()

  /* Restore saved sizes once, imperatively, so the group never has to remount
     (a remount would blow away whatever page is currently mounted). */
  React.useEffect(() => {
    if (!hydrated || restored.current) return
    restored.current = true
    // `resize` follows the same unit rule as the size props: a bare number is
    // pixels, so the stored percentages have to be handed over as strings.
    if (sidebarVisible) sidebarRef.current?.resize(pct(sidebarSize))
    else sidebarRef.current?.collapse()
    if (panelVisible) panelRef.current?.resize(pct(panelSize))
    else panelRef.current?.collapse()
  }, [hydrated, panelRef, panelSize, panelVisible, sidebarRef, sidebarSize, sidebarVisible])

  /* The size to reopen at, held in refs so that dragging a panel — which
     updates these continuously — does not re-run the sync effects and fight
     the drag. */
  const sidebarSizeRef = React.useRef(sidebarSize)
  const panelSizeRef = React.useRef(panelSize)
  sidebarSizeRef.current = sidebarSize || 18
  panelSizeRef.current = panelSize || 32

  /* Keep the imperative panels in step with the toggles and keybindings. */
  React.useEffect(() => {
    if (!hydrated) return
    return syncPanel(sidebarRef, sidebarVisible, sidebarSizeRef)
  }, [hydrated, sidebarRef, sidebarVisible])

  React.useEffect(() => {
    if (!hydrated) return
    return syncPanel(panelRef, panelVisible, panelSizeRef)
  }, [hydrated, panelRef, panelVisible])

  // Maximizing hands almost the whole column to the console, and restoring puts
  // it back at the size the user last dragged it to.
  React.useEffect(() => {
    if (!restored.current) return
    const panel = panelRef.current
    if (!panel) return
    panel.resize(pct(panelMaximized ? 92 : panelSize))
    // `panelSize` is intentionally omitted: it changes as the user drags, and
    // reacting to it here would fight the drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelMaximized])

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-chrome text-foreground">
      {!focusMode && <TitleBar />}

      <div className="flex min-h-0 flex-1">
        {!focusMode && <ActivityBar />}

        <ResizablePanelGroup orientation="horizontal" className="min-w-0 flex-1">
          <ResizablePanel
            id="wb-sidebar"
            panelRef={sidebarRef}
            collapsible
            /* Sizes are unit-bearing STRINGS. react-resizable-panels v4 reads a
               bare number as pixels — where v2 read it as a percent — so
               `maxSize={36}` silently capped this column at 36px.

               The minimum is expressed in pixels on purpose: how narrow this
               column can get before the tree stops being readable depends on
               the labels in it, not on how wide the window happens to be. A
               percentage floor is far too tight on a small screen and
               needlessly loose on a large one. */
            collapsedSize="0%"
            defaultSize="18%"
            minSize="208px"
            maxSize="36%"
            /* v4 dropped onCollapse/onExpand — collapse is now just "resized to
               zero", so both edges are derived from the one resize callback. */
            onResize={(size) => reportSize(size, setSidebarVisible, setSidebarSize)}
            className={cn(focusMode && "hidden")}
          >
            <SideBar />
          </ResizablePanel>

          <ResizableHandle
            className={cn("wb-resize-handle", focusMode && "hidden")}
            aria-label="Resize sidebar"
          />

          <ResizablePanel id="wb-bench" minSize="30%">
            <ResizablePanelGroup orientation="vertical">
              <ResizablePanel id="wb-content" minSize="8%">
                <div className="flex h-full min-h-0 flex-col bg-surface">
                  {!focusMode && tabBarVisible && <TabBar />}
                  {!focusMode && contextBarVisible && <ContextBar />}
                  <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
                </div>
              </ResizablePanel>

              <ResizableHandle
                className="wb-resize-handle"
                aria-label="Resize console"
              />

              <ResizablePanel
                id="wb-panel"
                panelRef={panelRef}
                collapsible
                collapsedSize="0%"
                defaultSize="0%"
                minSize="128px"
                onResize={(size) =>
                  reportSize(
                    size,
                    setPanelVisible,
                    // While maximized the panel is at 92% by our own doing, not
                    // the user's, so that size must not overwrite their choice.
                    panelMaximized ? undefined : setPanelSize,
                  )
                }
              >
                <BottomPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {!focusMode && statusBarVisible && <StatusBar />}

      <CommandPalette />
    </div>
  )
}

/**
 * Every size the workbench tracks is a percentage of its group.
 *
 * react-resizable-panels v4 interprets a bare number as *pixels* and only a
 * string as a percentage — the reverse of v2. Funnelling sizes through here
 * keeps that conversion in one place instead of relying on every call site to
 * remember it, which is exactly what went wrong the first time.
 */
function pct(value: number) {
  return `${value}%`
}

/**
 * Storage for the remembered inspector widths.
 *
 * `useDefaultLayout` reads storage *during render*, which includes the server
 * render — where `localStorage` does not exist. Handing it a guarded shim is
 * required; passing `window.localStorage` directly throws on every route that
 * has an inspector. Writes are wrapped too, so a quota error or private-mode
 * restriction degrades to "layout not remembered" rather than a crash.
 */
const LAYOUT_STORAGE: LayoutStorage = {
  getItem: (key) => {
    if (typeof window === "undefined") return null
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key, value) => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(key, value)
    } catch {
      /* Quota or private-mode failures are not worth surfacing. */
    }
  },
}

/**
 * Translate a v4 resize event into the two things the workbench tracks:
 * whether the region is on screen, and how big the user last made it.
 *
 * A collapsed panel reports 0%, which is how visibility is derived now that
 * v4 no longer fires separate collapse/expand callbacks.
 */
function reportSize(
  size: PanelSize,
  setVisible: (v: boolean) => void,
  setSize?: (n: number) => void,
) {
  const percentage = size.asPercentage
  setVisible(percentage > 0)
  if (percentage > 0) setSize?.(percentage)
}

/**
 * Drive a collapsible panel to `visible`, then re-assert once on the next
 * frame. Returns a cleanup that cancels the pending frame.
 *
 * The re-assert matters because a visibility change can arrive in the same tick
 * as a container resize (crossing the responsive breakpoint does exactly that),
 * and the group re-measures afterwards — a collapse issued before the
 * re-measure would be undone by it.
 *
 * Opening resizes to an explicit size rather than calling v4's `expand()`.
 * `expand()` restores a panel's "most recent size", which is undefined for a
 * panel that has never been open — the console starts collapsed, so expanding
 * it had nothing to restore and it simply stayed shut.
 */
function syncPanel(
  ref: React.RefObject<PanelImperativeHandle | null>,
  visible: boolean,
  sizeWhenVisible: React.RefObject<number>,
) {
  const assert = () => {
    const panel = ref.current
    if (!panel) return
    // v4 exposes only `isCollapsed()`; "expanded" is its negation.
    if (visible && panel.isCollapsed()) panel.resize(pct(sizeWhenVisible.current))
    if (!visible && !panel.isCollapsed()) panel.collapse()
  }

  assert()
  const frame = requestAnimationFrame(assert)
  return () => cancelAnimationFrame(frame)
}

/**
 * Notes the session start in the run log, so opening the console for the first
 * time shows what the lab has been doing rather than an empty box.
 */
function useBootLog() {
  const { pushLog } = useConsoleActions()
  const seeded = React.useRef(false)

  React.useEffect(() => {
    if (seeded.current) return
    seeded.current = true

    pushLog({
      level: "success",
      source: "lab",
      message: "Analysis engines ready",
    })
    pushLog({
      level: "debug",
      source: "lab",
      message: "Output from scans, simulations and predictions streams in here",
    })
  }, [pushLog])
}

/* ============================================================================
   Bench layout helper
   ========================================================================= */

/**
 * Splits a view into a main region and an optional inspector column on the
 * right, where its inputs and parameters live. The inspector obeys the
 * lab-wide toggle (Ctrl+Alt+B), and each view keeps its own remembered width
 * via `autoSaveId`.
 */
export function ViewLayout({
  children,
  inspector,
  inspectorId,
  defaultInspectorSize = 26,
  minInspectorPx = 260,
  maxInspectorSize = 44,
}: {
  children: React.ReactNode
  inspector?: React.ReactNode
  /** Distinguishes one view's remembered inspector width from another's. */
  inspectorId: string
  /** Starting width, as a percentage of the view. */
  defaultInspectorSize?: number
  /**
   * Narrowest the column may be dragged, in pixels. A pixel floor rather than
   * a percentage one: the limit is set by the labelled controls inside, which
   * do not get narrower just because the window did.
   */
  minInspectorPx?: number
  /** Widest the column may be dragged, as a percentage of the view. */
  maxInspectorSize?: number
}) {
  const { inspectorVisible } = useWorkbench()
  const inspectorRef = usePanelRef()

  const mainId = `${inspectorId}-main`
  const panelId = `${inspectorId}-inspector`

  // v4 replaced `autoSaveId` with an explicit hook, which is the better shape
  // anyway: the remembered layout is a value we hand to the group rather than
  // a side effect it performs behind our back.
  const defaultLayout = useDefaultLayout({
    // `v2` deliberately orphans layouts saved by an earlier build, which stored
    // widths produced while panel sizes were being read as pixels. Restoring
    // those would reinstate a ~44px inspector on machines that already loaded
    // it; a new key starts everyone from the correct default.
    id: `helixmind.inspector.v2.${inspectorId}`,
    panelIds: [mainId, panelId],
    storage: LAYOUT_STORAGE,
  })

  // Hiding the inspector collapses its panel rather than unmounting the group.
  // Swapping the tree would remount the main region on every toggle and throw
  // away whatever the view had on screen.
  React.useEffect(() => {
    const panel = inspectorRef.current
    if (!panel) return
    if (inspectorVisible && panel.isCollapsed()) panel.expand()
    if (!inspectorVisible && !panel.isCollapsed()) panel.collapse()
  }, [inspectorRef, inspectorVisible])

  // Views with no inspector at all keep a plain container — that branch is
  // fixed per view, so it never causes a remount.
  if (!inspector) {
    return <div className="h-full min-h-0 overflow-hidden">{children}</div>
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-full min-h-0"
      {...defaultLayout}
    >
      <ResizablePanel id={mainId} minSize="35%">
        {children}
      </ResizablePanel>

      <ResizableHandle
        className={cn("wb-resize-handle", !inspectorVisible && "hidden")}
        aria-label="Resize inspector"
      />

      <ResizablePanel
        id={panelId}
        panelRef={inspectorRef}
        collapsible
        collapsedSize="0%"
        defaultSize={`${defaultInspectorSize}%`}
        minSize={`${minInspectorPx}px`}
        maxSize={`${maxInspectorSize}%`}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden border-l border-border bg-surface">
          {inspector}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

/**
 * Standard scroll container for a view's main region. Views that need their own
 * internal scrolling (a chart that fills the height, say) skip this.
 */
export function ViewScroll({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        // A query container named `bench`, so a view's grids can respond to the
        // width they actually have rather than the viewport's. The two diverge
        // constantly here: opening the inspector or dragging the sidebar
        // changes the bench width without the window changing at all.
        "@container/bench seq-scroll h-full min-h-0 overflow-y-auto",
        className,
      )}
      {...props}
    />
  )
}
