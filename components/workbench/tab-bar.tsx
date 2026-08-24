"use client"

import * as React from "react"
import { CornerUpLeft, MoreHorizontal, PanelBottom, PanelRight, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { movedHref } from "@/lib/open-tabs"
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
import { type WorkbenchView } from "./registry"

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
    canCloseTab,
    closeOtherTabs,
    closeAllTabs,
    moveTab,
    reopenClosedTab,
    closedTabCount,
    togglePanel,
    toggleInspector,
    panelVisible,
    inspectorVisible,
  } = useWorkbench()
  const signals = useConsoleSignals()

  const stripRef = React.useRef<HTMLDivElement>(null)

  /* ---- Reordering ------------------------------------------------------ */

  /** The tab being dragged, and where it would land if dropped now. */
  const [dragHref, setDragHref] = React.useState<string | null>(null)
  const [dropIndex, setDropIndex] = React.useState<number | null>(null)

  /**
   * What the last move did, for screen readers.
   *
   * A drag is invisible to assistive tech and an Alt+Shift+Arrow press moves a
   * tab that may well be scrolled out of sight, so neither reports anything on
   * its own. This is the only channel that says what happened.
   */
  const [announcement, setAnnouncement] = React.useState("")

  const endDrag = React.useCallback(() => {
    setDragHref(null)
    setDropIndex(null)
  }, [])

  /**
   * The tab the operator just aimed at, which is the one the announcement is
   * about. Swapping two neighbours looks identical from the order alone, so
   * this is what tells the two readings apart — see `movedHref`.
   */
  const intent = React.useRef<string | null>(null)

  const dropAt = React.useCallback(
    (index: number) => {
      if (!dragHref) return
      const from = tabs.findIndex((t) => t.href === dragHref)
      intent.current = dragHref
      endDrag()
      if (from === -1) return
      // Removing the dragged tab shifts everything after it down one, so a slot
      // to its right means one index less than the gap the pointer is in.
      moveTab(dragHref, from < index ? index - 1 : index)
    },
    [dragHref, endDrag, moveTab, tabs],
  )

  /**
   * Announce a reorder however it was made.
   *
   * Watching the resulting order rather than hooking each gesture is what keeps
   * this correct for both: the drag lives here, but Alt+Shift+Arrow is bound in
   * the provider, which owns the chord table and has no idea a strip exists.
   * Deriving from the order covers whatever else moves a tab later, too.
   */
  const previous = React.useRef<string[] | null>(null)
  React.useEffect(() => {
    const order = tabs.map((t) => t.href)
    const before = previous.current
    previous.current = order

    // A drag names its own tab; Alt+Shift+Arrow always moves the open one.
    const aimedAt = intent.current ?? view?.href ?? null
    intent.current = null

    if (!before || before.length !== order.length) return
    const href = movedHref(before, order, aimedAt)
    if (!href) return

    const index = order.indexOf(href)
    const label = tabs[index]?.label
    if (label) setAnnouncement(`${label} moved to position ${index + 1} of ${order.length}`)
  }, [tabs, view])

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
    // A query container, so the analysis context hides on a narrow *bench*
    // rather than a narrow window — dragging the sidebar out changes the
    // strip's width without the viewport changing at all.
    <div className="@container flex h-9 shrink-0 items-stretch border-b border-border bg-chrome">
      <div
        ref={stripRef}
        role="tablist"
        aria-label="Open analyses"
        onKeyDown={onKeyDown}
        className="seq-scroll flex min-w-0 flex-1 items-stretch overflow-x-auto"
      >
        {tabs.map((tab, index) => (
          <Tab
            key={tab.href}
            tab={tab}
            active={view?.href === tab.href}
            signals={signals}
            onSelect={() => openTab(tab.href)}
            onClose={() => closeTab(tab.href)}
            canClose={canCloseTab}
            onCloseOthers={() => closeOtherTabs(tab.href)}
            onCloseAll={closeAllTabs}
            onReopen={reopenClosedTab}
            canReopen={closedTabCount > 0}
            index={index}
            total={tabs.length}
            onMove={(to) => moveTab(tab.href, to)}
            reordering={dragHref !== null}
            dragging={dragHref === tab.href}
            /* Where the insertion bar sits: before this tab, or — for the last
               one — after it, so a tab can be dropped at the end of the strip. */
            dropBefore={dropIndex === index}
            dropAfter={dropIndex === tabs.length && index === tabs.length - 1}
            onDragStart={() => setDragHref(tab.href)}
            onDragEnd={endDrag}
            onDragOverSide={(after) => setDropIndex(index + (after ? 1 : 0))}
            onDropSide={(after) => dropAt(index + (after ? 1 : 0))}
          />
        ))}

        {tabs.length === 0 && (
          <span className="flex items-center px-3 text-xs text-muted-foreground/70">
            Nothing open
          </span>
        )}
      </div>

      {/* Sibling of the tablist, never a child: an element inside a `tablist`
          is announced as one of its tabs. */}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>

      <AnalysisContext />

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
  /** False on the last tab open, which says so rather than just losing its ×. */
  canClose = true,
) {
  if (!canClose) return `${tab.label} — stays open, the bench always has a view`
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
  canClose,
  onCloseOthers,
  onCloseAll,
  onReopen,
  canReopen,
  index,
  total,
  onMove,
  reordering,
  dragging,
  dropBefore,
  dropAfter,
  onDragStart,
  onDragEnd,
  onDragOverSide,
  onDropSide,
}: {
  tab: WorkbenchView
  active: boolean
  signals: ConsoleSignals
  onSelect: () => void
  onClose: () => void
  canClose: boolean
  onCloseOthers: () => void
  onCloseAll: () => void
  onReopen: () => void
  canReopen: boolean
  index: number
  total: number
  onMove: (toIndex: number) => void
  /** True while a tab from this strip is in flight. */
  reordering: boolean
  dragging: boolean
  dropBefore: boolean
  dropAfter: boolean
  onDragStart: () => void
  onDragEnd: () => void
  /** `after` is true once the pointer passes the tab's midpoint. */
  onDragOverSide: (after: boolean) => void
  onDropSide: (after: boolean) => void
}) {
  const Icon = tab.icon
  const { signal, severity } = tabSignalFor(tab, signals)
  const busy = signal === "running"

  // Reordering from the context menu, for anyone who would rather not drag —
  // and the only place the Alt+Shift+Arrow chord is written down.
  const canMoveLeft = index > 0
  const canMoveRight = index < total - 1
  const onMoveLeft = () => onMove(index - 1)
  const onMoveRight = () => onMove(index + 1)

  /** Which half of the tab the pointer is in, for the insertion bar. */
  const sideFrom = (event: React.DragEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    return event.clientX > box.left + box.width / 2
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="tab"
          aria-selected={active}
          data-active={active}
          /* Reordering. Native HTML5 drag rather than a library: the strip is
             one flat row of at most eight items, and the browser already draws
             the drag image. It also suppresses the trailing click, so dragging
             a tab does not also select it. */
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move"
            // Firefox refuses to start a drag unless something is on the
            // transfer; the payload itself is never read.
            e.dataTransfer.setData("text/plain", tab.href)
            onDragStart()
          }}
          onDragOver={(e) => {
            // Only a tab from this strip is a valid drop. Calling
            // `preventDefault` unconditionally would advertise the strip as a
            // drop target for anything dragged in — a file, a selection — and
            // then silently swallow it.
            if (!reordering) return
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            onDragOverSide(sideFrom(e))
          }}
          onDrop={(e) => {
            if (!reordering) return
            e.preventDefault()
            onDropSide(sideFrom(e))
          }}
          onDragEnd={onDragEnd}
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
          title={signalTitle(tab, signals, signal, severity, canClose)}
          className={cn(
            "group relative flex min-w-0 shrink-0 cursor-pointer items-center gap-1.5 border-r border-border px-3 text-sm",
            "transition-colors duration-100 focus-visible:ring-1 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset",
            active
              ? "bg-surface text-foreground"
              : "text-muted-foreground hover:bg-[var(--wb-hover)] hover:text-foreground/90",
            // The tab being dragged fades so the insertion bar is what the eye
            // follows, rather than two things competing for it.
            dragging && "opacity-40",
          )}
        >
          {/* Accent line across the top of the tab you are working in. */}
          <span
            className={cn(
              "absolute inset-x-0 top-0 h-px transition-colors duration-150",
              active ? "bg-brand" : "bg-transparent",
            )}
          />

          {/* Where the dragged tab would land. Drawn on the tab either side of
              the gap so it needs no element of its own in the strip. */}
          {(dropBefore || dropAfter) && (
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-0 z-10 w-0.5 bg-brand",
                dropBefore ? "left-0" : "right-0",
              )}
            />
          )}
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
            {/* No close button on the last tab. The bench always has a view on
                screen, so the strip that describes it is never empty — and a
                protected tab reads better with the control removed than with
                one that is present and refuses, which is how a pinned browser
                tab shows the same thing. */}
            {canClose && (
              <button
                type="button"
                aria-label={`Close ${tab.label}`}
                // Grabbing the × should close the tab, not start dragging it.
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
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
            )}
          </span>

          {busy && <span className="sr-only">Running</span>}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={onClose} disabled={!canClose}>
          Close
          <ContextMenuShortcut>Alt W</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={onCloseOthers} disabled={!canClose}>
          Close others
        </ContextMenuItem>
        <ContextMenuItem onClick={onCloseAll} disabled={!canClose}>
          Close all
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onReopen} disabled={!canReopen}>
          Reopen closed
          <ContextMenuShortcut>Alt Shift T</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onMoveLeft} disabled={!canMoveLeft}>
          Move left
          <ContextMenuShortcut>Alt Shift ←</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={onMoveRight} disabled={!canMoveRight}>
          Move right
          <ContextMenuShortcut>Alt Shift →</ContextMenuShortcut>
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
    canCloseTab,
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
                  {/* Same rule as the strip: the last one open keeps no close
                      control, because it is not going anywhere. */}
                  {canCloseTab && (
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
                  )}
                </div>
              )
            })}
          </div>
        )}

        <DropdownMenuSeparator className="my-0" />
        {view && canCloseTab && (
          <DropdownMenuItem
            onClick={() => closeOtherTabs(view.href)}
            className="mx-1 mt-1 text-sm"
          >
            Close others
          </DropdownMenuItem>
        )}
        {canCloseTab && (
          <DropdownMenuItem onClick={closeAllTabs} className="mx-1 mt-1 text-sm">
            Close all
          </DropdownMenuItem>
        )}
        {/* Stays put after "close all" has just cut the strip back to the
            Overview — which is exactly when undo is wanted most. */}
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
 * What the open analysis is working on — the sample loaded, the organism
 * selected — falling back to what the analysis is *for* until it has one.
 *
 * This used to be a 28px band of its own beneath the tabs, which also drew the
 * view's icon, its name and its group. The active tab already carries the first
 * two and the sidebar carries the third, and `VIEWS` is a flat registry, so
 * there was no hierarchy for it to breadcrumb — a whole horizontal band, on top
 * of three others, for one string. The string is the part worth keeping, so it
 * rides at the end of the strip that already names the view.
 */
function AnalysisContext() {
  const { view } = useWorkbench()
  const { viewContext } = useConsole()

  if (!view) return null

  return (
    <span
      // Given away first when the strip runs out of room: the tabs themselves
      // and the toolbar are both load-bearing, and this is a detail line.
      className="hidden min-w-0 shrink items-center truncate px-2 text-xs text-muted-foreground @2xl:flex"
      title={viewContext ?? view.hint}
    >
      {viewContext ?? view.hint}
    </span>
  )
}
