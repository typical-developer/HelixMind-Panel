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
import { Toaster } from "@/components/ui/toaster"

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
    if (sidebarVisible) sidebarRef.current?.resize(sidebarSize)
    else sidebarRef.current?.collapse()
    if (panelVisible) panelRef.current?.resize(panelSize)
    else panelRef.current?.collapse()
  }, [hydrated, panelRef, panelSize, panelVisible, sidebarRef, sidebarSize, sidebarVisible])

  /* Keep the imperative panels in step with the toggles and keybindings.
     The assertion is repeated on the next frame because a visibility change can
     arrive in the same tick as a container resize (crossing the responsive
     breakpoint does exactly that), and the group re-measures afterwards — so a
     collapse issued before the re-measure would be undone by it. */
  React.useEffect(() => {
    if (!hydrated) return
    return syncPanel(sidebarRef, sidebarVisible)
  }, [hydrated, sidebarRef, sidebarVisible])

  React.useEffect(() => {
    if (!hydrated) return
    return syncPanel(panelRef, panelVisible)
  }, [hydrated, panelRef, panelVisible])

  // Maximizing hands almost the whole column to the console, and restoring puts
  // it back at the size the user last dragged it to.
  React.useEffect(() => {
    if (!restored.current) return
    const panel = panelRef.current
    if (!panel) return
    panel.resize(panelMaximized ? 92 : panelSize)
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
            collapsedSize={0}
            defaultSize={18}
            minSize={12}
            maxSize={36}
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

          <ResizablePanel id="wb-bench" minSize={30}>
            <ResizablePanelGroup orientation="vertical">
              <ResizablePanel id="wb-content" minSize={8}>
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
                collapsedSize={0}
                defaultSize={0}
                minSize={10}
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
      <Toaster />
    </div>
  )
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
 */
function syncPanel(
  ref: React.RefObject<PanelImperativeHandle | null>,
  visible: boolean,
) {
  const assert = () => {
    const panel = ref.current
    if (!panel) return
    // v4 exposes only `isCollapsed()`; "expanded" is its negation.
    if (visible && panel.isCollapsed()) panel.expand()
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
  minInspectorSize = 18,
  maxInspectorSize = 44,
}: {
  children: React.ReactNode
  inspector?: React.ReactNode
  /** Distinguishes one view's remembered inspector width from another's. */
  inspectorId: string
  defaultInspectorSize?: number
  minInspectorSize?: number
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
    id: `helixmind.inspector.${inspectorId}`,
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
      <ResizablePanel id={mainId} minSize={35}>
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
        collapsedSize={0}
        defaultSize={defaultInspectorSize}
        minSize={minInspectorSize}
        maxSize={maxInspectorSize}
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
