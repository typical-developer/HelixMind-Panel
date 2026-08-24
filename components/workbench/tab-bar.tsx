"use client"

import * as React from "react"
import { CornerUpLeft, MoreHorizontal, PanelBottom, PanelRight, X } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
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
import {
  tabSignalFor,
  useConsole,
  useConsoleSignals,
  useWorkbench,
  type ConsoleSignals,
} from "./workbench-provider"
import { groupLabel, type WorkbenchView } from "./registry"

/**
 * One tab per open analysis.
 *
 * Each tab carries a signal for what the view behind it is doing — a pulsing
 * dot while it runs, a coloured dot when it has raised something that needs
 * looking at. Without it the only way to tell whether a background analysis had
 * produced anything was to open it.
 */
export function TabBar() {
  const {
    tabs,
    view,
    openTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    reopenClosedTab,
    closedTabCount,
    togglePanel,
    toggleInspector,
    panelVisible,
    inspectorVisible,
  } = useWorkbench()
  const signals = useConsoleSignals()

  const stripRef = React.useRef<HTMLDivElement>(null)

  // Keep the active tab in view when navigation comes from elsewhere (the
  // explorer, the palette, a keyboard chord).
  React.useEffect(() => {
    const active = stripRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    active?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [view])

  /**
   * Arrow-key navigation.
   *
   * `role="tablist"` carries a promise: arrow keys move between tabs, Home and
   * End jump to the ends. The strip declared the role without implementing any
   * of it, so keyboard users could only Tab through every close button in turn.
   */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((t) => t.href === view?.href)
    if (index === -1) return

    let next: number | null = null
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % tabs.length
        break
      case "ArrowLeft":
        next = (index - 1 + tabs.length) % tabs.length
        break
      case "Home":
        next = 0
        break
      case "End":
        next = tabs.length - 1
        break
      case "Delete":
      case "Backspace":
        event.preventDefault()
        closeTab(tabs[index].href)
        return
      default:
        return
    }

    if (next === null || next === index) return
    event.preventDefault()
    openTab(tabs[next].href)
    // Focus follows selection, which is the expected behaviour for an
    // automatically-activated tablist.
    requestAnimationFrame(() => {
      stripRef.current
        ?.querySelector<HTMLElement>('[data-active="true"]')
        ?.focus()
    })
  }

  return (
    <div className="flex h-9 shrink-0 items-stretch border-b border-border bg-chrome">
      <div
        ref={stripRef}
        role="tablist"
        aria-label="Open analyses"
        onKeyDown={onKeyDown}
        className="seq-scroll flex min-w-0 flex-1 items-stretch overflow-x-auto"
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.href}
            tab={tab}
            active={view?.href === tab.href}
            signals={signals}
            onSelect={() => openTab(tab.href)}
            onClose={() => closeTab(tab.href)}
            onCloseOthers={() => closeOtherTabs(tab.href)}
            onCloseAll={closeAllTabs}
            onReopen={reopenClosedTab}
            canReopen={closedTabCount > 0}
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

/* ============================================================================
   Activity marker
   ========================================================================= */

/**
 * The dot on a tab.
 *
 * Deliberately the same 6px dot in three colours rather than three different
 * glyphs: at tab-strip size a shape change is not legible, but a colour change
 * against the surrounding monochrome is. The running state also pulses, which
 * is the only motion in the strip and so reads as "this one is live".
 */
function TabSignalDot({
  signal,
  severity,
}: {
  signal: "running" | "attention" | "idle"
  severity: "error" | "warning" | null
}) {
  if (signal === "idle") return null

  return (
    <span
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        signal === "running" && "animate-soft-pulse bg-brand",
        signal === "attention" && severity === "error" && "bg-destructive",
        signal === "attention" && severity === "warning" && "bg-warning",
      )}
    />
  )
}

function signalTitle(
  tab: WorkbenchView,
  signals: ConsoleSignals,
  signal: "running" | "attention" | "idle",
  severity: "error" | "warning" | null,
) {
  if (signal === "running") return `${tab.label} — running`
  if (signal === "attention") {
    const counts = signals.alertsBySource[tab.source]
    const parts: string[] = []
    if (counts?.errors) parts.push(`${counts.errors} error${counts.errors === 1 ? "" : "s"}`)
    if (counts?.warnings)
      parts.push(`${counts.warnings} warning${counts.warnings === 1 ? "" : "s"}`)
    return `${tab.label} — ${parts.join(", ")}`
  }
  void severity
  return tab.hint
}

function Tab({
  tab,
  active,
  signals,
  onSelect,
  onClose,
  onCloseOthers,
  onCloseAll,
  onReopen,
  canReopen,
}: {
  tab: WorkbenchView
  active: boolean
  signals: ConsoleSignals
  onSelect: () => void
  onClose: () => void
  onCloseOthers: () => void
  onCloseAll: () => void
  onReopen: () => void
  canReopen: boolean
}) {
  const Icon = tab.icon
  const { signal, severity } = tabSignalFor(tab, signals)
  const busy = signal === "running"

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
          // Only the active tab is in the tab order; arrows move within the
          // strip. This is the roving-tabindex pattern a tablist expects.
          tabIndex={active ? 0 : -1}
          title={signalTitle(tab, signals, signal, severity)}
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

          {/* The marker sits where the close button goes and swaps for it on
              hover, the way an editor shows an unsaved dot. A busy tab keeps
              its marker until you actually reach for the close button, so the
              strip does not flicker as the pointer crosses it. */}
          <span className="relative -mr-1 flex size-4 shrink-0 items-center justify-center">
            <span
              className={cn(
                "absolute inset-0 flex items-center justify-center transition-opacity duration-100",
                signal === "idle"
                  ? "opacity-0"
                  : "opacity-100 group-hover:opacity-0 group-focus-within:opacity-0",
              )}
            >
              <TabSignalDot signal={signal} severity={severity} />
            </span>
            <button
              type="button"
              aria-label={`Close ${tab.label}`}
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              className={cn(
                "flex size-4 cursor-pointer items-center justify-center rounded-xs transition-opacity duration-100",
                "hover:bg-[var(--wb-selected)] hover:text-foreground",
                signal !== "idle"
                  ? "opacity-0 group-hover:opacity-70 group-hover:hover:opacity-100 focus-visible:opacity-100"
                  : active
                    ? "opacity-60 hover:opacity-100"
                    : "opacity-0 group-hover:opacity-60 group-hover:hover:opacity-100 focus-visible:opacity-100",
              )}
            >
              <X className="size-3" />
            </button>
          </span>

          {busy && <span className="sr-only">Running</span>}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={onClose}>
          Close
          <ContextMenuShortcut>Alt W</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={onCloseOthers}>Close others</ContextMenuItem>
        <ContextMenuItem onClick={onCloseAll}>Close all</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onReopen} disabled={!canReopen}>
          Reopen closed
          <ContextMenuShortcut>Alt Shift T</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * The list of everything currently open — the one place that owns the open set,
 * now that the sidebar no longer keeps a second copy of it.
 *
 * Modelled on VS Code's "Open Editors": every open analysis, the active one
 * marked, each row closable in place, and a count on the trigger so you can see
 * how much is open without opening the menu. It earns its keep when tabs
 * overflow the strip and some are scrolled out of sight.
 */
function TabOverflowMenu() {
  const {
    tabs,
    view,
    openTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    reopenClosedTab,
    closedTabCount,
  } = useWorkbench()
  const signals = useConsoleSignals()

  // A count on the trigger is not much use if it cannot say *why* you should
  // look; this mirrors the strip's markers so an overflowed tab still reports.
  const flagged = tabs.filter(
    (tab) => tabSignalFor(tab, signals).signal !== "idle",
  ).length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Open analyses (${tabs.length}${
            flagged > 0 ? `, ${flagged} needing attention` : ""
          })`}
          className="relative inline-flex h-6 min-w-6 cursor-pointer items-center justify-center gap-1 rounded-sm px-1 text-muted-foreground transition-colors hover:bg-[var(--wb-hover)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
        >
          <MoreHorizontal className="size-3.5" />
          {tabs.length > 0 && (
            <span className="text-2xs font-medium tabular">{tabs.length}</span>
          )}
          {flagged > 0 && (
            <span className="absolute top-0 right-0 size-1.5 rounded-full bg-warning ring-2 ring-chrome" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 p-0">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Open analyses
          </span>
          <span className="font-mono text-2xs text-muted-foreground/70 tabular">
            {tabs.length}
          </span>
        </div>

        {tabs.length === 0 ? (
          <p className="px-2 pb-2 text-xs text-muted-foreground/70">Nothing open.</p>
        ) : (
          <div className="seq-scroll max-h-72 overflow-y-auto pb-1">
            {tabs.map((tab) => {
              const active = view?.href === tab.href
              const { signal, severity } = tabSignalFor(tab, signals)
              return (
                <div key={tab.href} className="group/item relative px-1">
                  <button
                    type="button"
                    onClick={() => openTab(tab.href)}
                    title={signalTitle(tab, signals, signal, severity)}
                    className={cn(
                      "row-hover flex w-full cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-7 pl-2 text-left text-sm",
                      "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
                      active
                        ? "bg-[var(--wb-active)] text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <tab.icon className="size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                    <TabSignalDot signal={signal} severity={severity} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Close ${tab.label}`}
                    onClick={(e) => {
                      // Keep the menu open so several can be closed in a row.
                      e.stopPropagation()
                      closeTab(tab.href)
                    }}
                    className={cn(
                      "absolute top-1/2 right-2 flex size-4 -translate-y-1/2 cursor-pointer items-center justify-center rounded-xs",
                      "text-muted-foreground transition-opacity hover:bg-[var(--wb-selected)] hover:text-foreground",
                      "opacity-0 group-hover/item:opacity-70 focus-visible:opacity-100",
                    )}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <DropdownMenuSeparator className="my-0" />
        {view && tabs.length > 1 && (
          <DropdownMenuItem
            onClick={() => closeOtherTabs(view.href)}
            className="mx-1 mt-1 text-sm"
          >
            Close others
          </DropdownMenuItem>
        )}
        {tabs.length > 0 && (
          <DropdownMenuItem onClick={closeAllTabs} className="mx-1 mt-1 text-sm">
            Close all
          </DropdownMenuItem>
        )}
        {/* Reachable even with the strip empty — which is exactly when
            "close all" has just been used and undo is wanted most. */}
        <DropdownMenuItem
          onClick={reopenClosedTab}
          disabled={closedTabCount === 0}
          className="m-1 gap-2 text-sm"
        >
          <CornerUpLeft className="size-3.5" />
          Reopen closed
          <span className="ml-auto font-mono text-2xs text-muted-foreground">
            Alt Shift T
          </span>
        </DropdownMenuItem>
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
