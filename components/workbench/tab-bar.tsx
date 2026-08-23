"use client"

import * as React from "react"
import { ChevronRight, MoreHorizontal, PanelBottom, PanelRight, X } from "lucide-react"

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
import { useWorkbench } from "./workbench-provider"
import { TONE_CLASS, breadcrumbsForView, type WorkbenchView } from "./registry"

/**
 * Editor tabs for the views currently open. Tabs are opened by navigating and
 * closed with the X, Ctrl+W, or the right-click menu — the same contract as an
 * editor, so the panel behaves the way the shell looks.
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
        aria-label="Open views"
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
            No open views
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
          label="Toggle panel"
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
          {/* Accent line across the top of the active tab — VS Code's
              `tab.activeBorderTop`. */}
          <span
            className={cn(
              "absolute inset-x-0 top-0 h-px transition-colors duration-150",
              active ? "bg-brand" : "bg-transparent",
            )}
          />
          <Icon className={cn("size-3.5 shrink-0", TONE_CLASS[tab.tone])} />
          <span className="max-w-44 truncate">{tab.fileName}</span>
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
          aria-label="Open views"
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
            <tab.icon className={cn("size-3.5", TONE_CLASS[tab.tone])} />
            <span className="truncate">{tab.label}</span>
          </DropdownMenuItem>
        ))}
        {tabs.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={closeAllTabs}>Close all views</DropdownMenuItem>
        <DropdownMenuItem onClick={resetLayout}>Reset layout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The path strip beneath the tabs. Purely orienting — it mirrors the explorer's
 * folder structure so you always know where the open view sits.
 */
export function Breadcrumbs() {
  const { view } = useWorkbench()
  const crumbs = breadcrumbsForView(view)

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex h-[26px] shrink-0 items-center gap-0.5 overflow-hidden border-b border-border bg-surface px-3 text-xs text-muted-foreground"
    >
      {crumbs.map((crumb, i) => (
        <React.Fragment key={`${crumb.label}-${i}`}>
          {i > 0 && <ChevronRight className="size-3 shrink-0 opacity-50" />}
          <span
            className={cn(
              "truncate rounded-xs px-1 py-0.5 transition-colors",
              i === crumbs.length - 1
                ? "text-foreground/80"
                : "hover:text-foreground/70",
            )}
          >
            {crumb.label}
          </span>
        </React.Fragment>
      ))}
    </nav>
  )
}
