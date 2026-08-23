"use client"

import * as React from "react"
import type { ImperativePanelHandle } from "react-resizable-panels"

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
import { Breadcrumbs, TabBar } from "./tab-bar"
import { TitleBar } from "./title-bar"
import { useWorkbench } from "./workbench-provider"

/**
 * The workbench shell.
 *
 * Regions are laid out exactly once here and persist across navigation, so the
 * side bar's scroll position, the terminal buffer and the resize handles all
 * survive route changes. Only the editor body swaps.
 */
export function Workbench({ children }: { children: React.ReactNode }) {
  const {
    hydrated,
    zen,
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
    breadcrumbsVisible,
  } = useWorkbench()

  const sidebarRef = React.useRef<ImperativePanelHandle>(null)
  const panelRef = React.useRef<ImperativePanelHandle>(null)
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
  }, [hydrated, panelSize, panelVisible, sidebarSize, sidebarVisible])

  /* Keep the imperative panels in step with the toggles and keybindings.
     The assertion is repeated on the next frame because a visibility change can
     arrive in the same tick as a container resize (crossing the responsive
     breakpoint does exactly that), and the group re-measures afterwards — so a
     collapse issued before the re-measure would be undone by it. */
  React.useEffect(() => {
    if (!hydrated) return
    return syncPanel(sidebarRef, sidebarVisible)
  }, [hydrated, sidebarVisible])

  React.useEffect(() => {
    if (!hydrated) return
    return syncPanel(panelRef, panelVisible)
  }, [hydrated, panelVisible])

  // Maximizing hands almost the whole editor column to the panel, and restoring
  // puts it back at the size the user last dragged it to.
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
      {!zen && <TitleBar />}

      <div className="flex min-h-0 flex-1">
        {!zen && <ActivityBar />}

        <ResizablePanelGroup direction="horizontal" className="min-w-0 flex-1">
          <ResizablePanel
            id="wb-sidebar"
            order={1}
            ref={sidebarRef}
            collapsible
            collapsedSize={0}
            defaultSize={18}
            minSize={12}
            maxSize={36}
            onCollapse={() => setSidebarVisible(false)}
            onExpand={() => setSidebarVisible(true)}
            onResize={(size) => {
              if (size > 0) setSidebarSize(size)
            }}
            className={cn(zen && "hidden")}
          >
            <SideBar />
          </ResizablePanel>

          <ResizableHandle
            className={cn("wb-resize-handle w-px", zen && "hidden")}
            aria-label="Resize side bar"
          />

          <ResizablePanel id="wb-editor" order={2} minSize={30}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel id="wb-content" order={1} minSize={8}>
                <div className="flex h-full min-h-0 flex-col bg-surface">
                  {!zen && tabBarVisible && <TabBar />}
                  {!zen && breadcrumbsVisible && <Breadcrumbs />}
                  <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
                </div>
              </ResizablePanel>

              <ResizableHandle className="wb-resize-handle h-px" aria-label="Resize panel" />

              <ResizablePanel
                id="wb-panel"
                order={2}
                ref={panelRef}
                collapsible
                collapsedSize={0}
                defaultSize={0}
                minSize={10}
                onCollapse={() => setPanelVisible(false)}
                onExpand={() => setPanelVisible(true)}
                onResize={(size) => {
                  if (size > 0 && !panelMaximized) setPanelSize(size)
                }}
              >
                <BottomPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {!zen && statusBarVisible && <StatusBar />}

      <CommandPalette />
      <Toaster />
    </div>
  )
}

/**
 * Drive a collapsible panel to `visible`, then re-assert once on the next
 * frame. Returns a cleanup that cancels the pending frame.
 */
function syncPanel(
  ref: React.RefObject<ImperativePanelHandle | null>,
  visible: boolean,
) {
  const assert = () => {
    const panel = ref.current
    if (!panel) return
    if (visible && panel.isCollapsed()) panel.expand()
    if (!visible && panel.isExpanded()) panel.collapse()
  }

  assert()
  const frame = requestAnimationFrame(assert)
  return () => cancelAnimationFrame(frame)
}

/**
 * Writes a short startup banner into the terminal once per session, so opening
 * the panel for the first time shows a live buffer rather than an empty box.
 */
function useBootLog() {
  const { pushLog } = useWorkbench()
  const seeded = React.useRef(false)

  React.useEffect(() => {
    if (seeded.current) return
    seeded.current = true

    pushLog({
      level: "command",
      source: "workbench",
      message: "helixmind workbench --workspace helixmind-lab",
    })
    pushLog({
      level: "success",
      source: "workbench",
      message: "analysis engine ready",
    })
    pushLog({
      level: "debug",
      source: "workbench",
      message: "run output from scans and simulations streams into this terminal",
    })
  }, [pushLog])
}

/* ============================================================================
   Editor layout helper
   ========================================================================= */

/**
 * Splits a view into a main region and an optional inspector column on the
 * right. The inspector obeys the workbench-wide toggle (Ctrl+Alt+B), and each
 * view keeps its own remembered width via `autoSaveId`.
 */
export function EditorLayout({
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
  const inspectorRef = React.useRef<ImperativePanelHandle>(null)

  // Hiding the inspector collapses its panel rather than unmounting the group.
  // Swapping the tree would remount the main region on every toggle and throw
  // away whatever the view had on screen.
  React.useEffect(() => {
    const panel = inspectorRef.current
    if (!panel) return
    if (inspectorVisible && panel.isCollapsed()) panel.expand()
    if (!inspectorVisible && panel.isExpanded()) panel.collapse()
  }, [inspectorVisible])

  // Views with no inspector at all keep a plain container — that branch is
  // fixed per view, so it never causes a remount.
  if (!inspector) {
    return <div className="h-full min-h-0 overflow-hidden">{children}</div>
  }

  return (
    <ResizablePanelGroup
      direction="horizontal"
      autoSaveId={`helixmind.inspector.${inspectorId}`}
      className="h-full min-h-0"
    >
      <ResizablePanel id={`${inspectorId}-main`} order={1} minSize={35}>
        {children}
      </ResizablePanel>

      <ResizableHandle
        className={cn("wb-resize-handle w-px", !inspectorVisible && "hidden")}
        aria-label="Resize inspector"
      />

      <ResizablePanel
        id={`${inspectorId}-inspector`}
        order={2}
        ref={inspectorRef}
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
export function EditorScroll({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("seq-scroll h-full min-h-0 overflow-y-auto", className)}
      {...props}
    />
  )
}
