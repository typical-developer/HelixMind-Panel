"use client"

import * as React from "react"
import { MoreHorizontal, PanelBottom, PanelRight, X } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { ToolbarButton } from "./primitives"
import { useConsole, useWorkbench } from "./workbench-provider"
import { groupLabel, type WorkbenchView } from "./registry"

/**
 * One tab per open analysis. Opening a view keeps it open, so a half-finished
 * simulation survives a detour into the gene library and comes back exactly as
 * it was left.
 */
export function TabBar() {
  const {
    tabs,
    view,
    openTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    togglePanel,
    toggleInspector,
    panelVisible,
    inspectorVisible,
  } = useWorkbench()

  const stripRef = React.useRef<HTMLDivElement>(null)

  // Keep the active tab in view when navigation comes from elsewhere (the
  // explorer, the palette, a keyboard chord).
  React.useEffect(() => {
    const active = stripRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    active?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [view])

  return (
    <div className="flex h-9 shrink-0 items-stretch border-b border-border bg-chrome">
      <div
        ref={stripRef}
        role="tablist"
        aria-label="Open analyses"
        className="seq-scroll flex min-w-0 flex-1 items-stretch overflow-x-auto"
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.href}
            tab={tab}
            active={view?.href === tab.href}
            onSelect={() => openTab(tab.href)}
            onClose={() => closeTab(tab.href)}
            onCloseOthers={() => closeOtherTabs(tab.href)}
            onCloseAll={closeAllTabs}
          />
        ))}

        {tabs.length === 0 && (
          <span className="flex items-center px-3 text-xs text-muted-foreground/70">
            Nothing open
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 border-l border-border px-1.5">
        <ToolbarButton
          icon={PanelRight}
          label="Toggle inspector"
          active={inspectorVisible}
          onClick={toggleInspector}
        />
        <ToolbarButton
          icon={PanelBottom}
          label="Toggle console"
          active={panelVisible}
          onClick={togglePanel}
        />
        <TabOverflowMenu />
      </div>
    </div>
  )
}

function Tab({
  tab,
  active,
  onSelect,
  onClose,
  onCloseOthers,
  onCloseAll,
}: {
  tab: WorkbenchView
  active: boolean
  onSelect: () => void
  onClose: () => void
  onCloseOthers: () => void
  onCloseAll: () => void
}) {
  const Icon = tab.icon

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="tab"
          aria-selected={active}
          data-active={active}
          onClick={onSelect}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onSelect()
            }
          }}
          onAuxClick={(e) => {
            // Middle-click closes, matching every tabbed editor.
            if (e.button === 1) {
              e.preventDefault()
              onClose()
            }
          }}
          tabIndex={0}
          title={tab.hint}
          className={cn(
            "group relative flex min-w-0 shrink-0 cursor-pointer items-center gap-1.5 border-r border-border px-3 text-sm",
            "transition-colors duration-100 focus-visible:ring-1 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset",
            active
              ? "bg-surface text-foreground"
              : "text-muted-foreground hover:bg-[var(--wb-hover)] hover:text-foreground/90",
          )}
        >
          {/* Accent line across the top of the tab you are working in. */}
          <span
            className={cn(
              "absolute inset-x-0 top-0 h-px transition-colors duration-150",
              active ? "bg-brand" : "bg-transparent",
            )}
          />
          <Icon className="size-3.5 shrink-0" />
          <span className="max-w-48 truncate">{tab.label}</span>
          <button
            type="button"
            aria-label={`Close ${tab.label}`}
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className={cn(
              "-mr-1 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-xs transition-all duration-100",
              "hover:bg-[var(--wb-selected)] hover:text-foreground",
              active
                ? "opacity-60 hover:opacity-100"
                : "opacity-0 group-hover:opacity-60 group-hover:hover:opacity-100 focus-visible:opacity-100",
            )}
          >
            <X className="size-3" />
          </button>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={onClose}>Close</ContextMenuItem>
        <ContextMenuItem onClick={onCloseOthers}>Close others</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onCloseAll}>Close all</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function TabOverflowMenu() {
  const { tabs, view, openTab, closeAllTabs, resetLayout } = useWorkbench()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open analyses"
          className="inline-flex size-6 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-[var(--wb-hover)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {tabs.map((tab) => (
          <DropdownMenuItem
            key={tab.href}
            onClick={() => openTab(tab.href)}
            className={cn("gap-2", view?.href === tab.href && "bg-[var(--wb-active)]")}
          >
            <tab.icon className="size-3.5" />
            <span className="truncate">{tab.label}</span>
          </DropdownMenuItem>
        ))}
        {tabs.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={closeAllTabs}>Close all</DropdownMenuItem>
        <DropdownMenuItem onClick={resetLayout}>Reset layout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The strip beneath the tabs. Where an editor would print a file path, this
 * prints what the open analysis is actually working on — the sample loaded,
 * the organism selected — falling back to what the analysis is for when the
 * view has nothing loaded yet.
 */
export function ContextBar() {
  const { view } = useWorkbench()
  const { viewContext } = useConsole()

  if (!view) return null

  const Icon = view.icon

  return (
    <div
      aria-label="Analysis context"
      className="flex h-7 shrink-0 items-center gap-2 overflow-hidden border-b border-border bg-surface px-3 text-xs"
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="shrink-0 font-medium text-foreground/85">{view.label}</span>
      <span aria-hidden className="h-3 w-px shrink-0 bg-border" />
      <span
        className={cn(
          "min-w-0 truncate",
          viewContext ? "text-foreground/70" : "text-muted-foreground/70",
        )}
      >
        {viewContext ?? view.hint}
      </span>
      <span className="ml-auto shrink-0 pl-2 text-muted-foreground/60">
        {groupLabel(view)}
      </span>
    </div>
  )
}
