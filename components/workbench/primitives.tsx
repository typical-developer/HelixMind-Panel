"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

/**
 * Icons are typed structurally rather than as `LucideIcon` so the workbench can
 * also pass the handful of bespoke 16px glyphs it draws inline.
 */
export type IconComponent = React.ComponentType<{ className?: string }>

/* ============================================================================
   Panes

   A pane is the bench's unit of content — a flat, hairline-bordered region with
   an optional 32px header. Panes replace the floating cards the dashboard used
   to stack, so density and alignment stay consistent across every view.
   ========================================================================= */

export function Pane({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="pane"
      className={cn(
        // `@container` lets a pane's contents respond to the pane's own width.
        // Viewport breakpoints are the wrong signal here: panes sit inside
        // resizable columns, so a pane can be narrow on a wide screen (a
        // dragged-in inspector) or wide on a small one.
        "@container flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  )
}

export function PaneHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  className,
  ...props
}: {
  icon?: IconComponent
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
} & Omit<React.ComponentProps<"header">, "title">) {
  return (
    <header
      data-slot="pane-header"
      className={cn(
        "flex h-8 shrink-0 items-center gap-2 border-b border-border px-3",
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" />}
      {/* `truncate` only takes effect on a flex child that is allowed to shrink
          below its content, hence `min-w-0` on the text group. The subtitle
          gives way before the title does, and the actions never shrink. */}
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <h2 className="truncate text-sm font-medium text-foreground/90">{title}</h2>
        {subtitle && (
          <span className="hidden min-w-0 truncate text-xs text-muted-foreground @xs:inline">
            {subtitle}
          </span>
        )}
      </div>
      {actions && (
        <div className="ml-auto flex shrink-0 items-center gap-0.5">{actions}</div>
      )}
    </header>
  )
}

export function PaneBody({
  className,
  scroll = true,
  ...props
}: React.ComponentProps<"div"> & { scroll?: boolean }) {
  return (
    <div
      data-slot="pane-body"
      className={cn(
        "min-h-0 flex-1 p-3",
        scroll && "seq-scroll overflow-auto",
        className,
      )}
      {...props}
    />
  )
}

/**
 * The scrolling column an inspector's panes stack down.
 *
 * `[&>*]:shrink-0` is the point of this component. A `<Pane>` is a flex column
 * with `min-h-0` and `overflow-hidden` so that panes which *own* a height can
 * scroll internally — but that same rule makes a pane in a flex stack shrink
 * below its content and silently clip it, with no scrollbar anywhere, instead
 * of growing the column. Pinning children at their natural height hands the
 * overflow to this container, which is the one that actually scrolls.
 */
export function InspectorScroll({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="inspector-scroll"
      className={cn(
        "seq-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3",
        "[&>*]:shrink-0",
        className,
      )}
      {...props}
    />
  )
}

/* ============================================================================
   Toolbar controls
   ========================================================================= */

/**
 * The small square icon button used across every toolbar and title bar. Sized
 * to VS Code's 22px action item so a row of them stays under 32px tall.
 */
export function ToolbarButton({
  icon: Icon,
  label,
  active,
  side = "bottom",
  className,
  ...props
}: {
  icon: IconComponent
  label: string
  active?: boolean
  side?: "top" | "bottom" | "left" | "right"
} & React.ComponentProps<"button">) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          className={cn(
            "inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm",
            "text-muted-foreground transition-[background-color,color,transform] duration-100",
            "hover:bg-[var(--wb-hover)] hover:text-foreground",
            // A hair of travel on press — enough to confirm the hit without
            // reading as a bounce on a toolbar you click all day.
            "active:scale-[0.92]",
            "focus-visible:ring-ring/60 focus-visible:ring-2 focus-visible:outline-none",
            "disabled:pointer-events-none disabled:opacity-40",
            active && "bg-[var(--wb-active)] text-foreground",
            className,
          )}
          {...props}
        >
          <Icon className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}

/** A horizontal strip of controls above a pane's content. */
export function Toolbar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="toolbar"
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 border-b border-border px-2",
        className,
      )}
      {...props}
    />
  )
}

/* ============================================================================
   Sidebar sections — collapsible groups stacked down the sidebar
   ========================================================================= */

export function SideSection({
  title,
  actions,
  defaultOpen = true,
  children,
  className,
}: {
  title: string
  actions?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <div className="group/section flex h-6 items-center gap-1 px-1">
        <CollapsibleTrigger className="flex min-w-0 flex-1 cursor-pointer items-center gap-0.5 rounded-sm text-left focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none">
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
              open && "rotate-90",
            )}
          />
          <span className="truncate text-xs font-semibold text-foreground/70">
            {title}
          </span>
        </CollapsibleTrigger>
        {actions && (
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/section:opacity-100 focus-within:opacity-100">
            {actions}
          </div>
        )}
      </div>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="pb-1">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * A single row in a sidebar tree. Indentation is expressed in levels so nested
 * groups line up on a consistent 12px rhythm.
 */
export function TreeRow({
  icon: Icon,
  iconClassName,
  label,
  detail,
  active,
  level = 0,
  className,
  ...props
}: {
  icon?: IconComponent
  iconClassName?: string
  label: React.ReactNode
  detail?: React.ReactNode
  active?: boolean
  level?: number
} & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      data-active={active}
      className={cn(
        "active-rail row-hover group flex h-6 w-full cursor-pointer items-center gap-2 pr-2 text-left text-sm",
        "focus-visible:ring-1 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset",
        active
          ? "bg-[var(--wb-active)] text-foreground"
          : "text-muted-foreground hover:text-foreground/90",
        className,
      )}
      style={{ paddingLeft: `${8 + level * 12}px` }}
      {...props}
    >
      {Icon && <Icon className={cn("size-3.5 shrink-0", iconClassName)} />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {detail && (
        <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground/70 tabular">
          {detail}
        </span>
      )}
    </button>
  )
}

/* ============================================================================
   Rows — a glyph beside a label

   One alignment contract for every "icon and text" row in the bench: the icon
   sits in the vertical middle of the text beside it.

   ## Why the middle of the block, and not the first line

   An earlier revision aligned the icon to the *first line* of the text, inset
   by half the difference between the line box and the icon. That is the right
   rule for a wrapping paragraph, and the wrong one for the shape this app is
   actually built from — a title with one short supporting line under it. On a
   two-line block it put the glyph roughly ten pixels above the block's centre,
   which reads as "top-aligned", not "centred", and it was reported as such.

   ## Why every row, rather than centring short blocks and top-aligning long ones

   The typographically pure rule is to centre at two lines and fall back to the
   first line beyond that. It behaves badly here. Whether a row runs to two
   lines or three depends on the width of a resizable panel, so that rule would
   flip a row between two alignments as the sidebar is dragged. A row that
   changes treatment when you resize it is worse than either rule applied
   consistently.

   ## Why there is no table of offsets any more

   Centring is what `align-self: center` already does, against the flex line's
   cross size — which is the text block. It needs no arithmetic, holds at every
   interface-scale step without a per-size entry, and cannot drift out of step
   with the type ramp. The nine `mt-*` constants that used to live here are
   gone; `align="first-line"` below is the one escape hatch, kept for a
   genuinely long prose block should one ever appear.
   ========================================================================= */

/** Icon sizes the bench uses. Anything else wants a one-off, not this table. */
export type RowIconSize = "3" | "3.5" | "4"

/**
 * What the icon lines up with.
 *
 * `block` — the vertical middle of the whole text block. The default, and what
 * every row in the app wants.
 *
 * `first-line` — the top line only. Nothing uses it today. It exists so that a
 * future row carrying a genuine paragraph has somewhere to go other than back
 * to a hand-written margin.
 */
export type RowIconAlign = "block" | "first-line"

const ICON_SIZE: Record<RowIconSize, string> = {
  "3": "size-3",
  "3.5": "size-3.5",
  "4": "size-4",
}

/**
 * A leading icon, centred on the text beside it.
 *
 * Exported on its own for rows whose layout is too particular for {@link Row} —
 * the notification row, which overlays its own action buttons, and the toast,
 * whose body is a grid. Those rows still get the alignment contract.
 *
 * `self-center` rather than `items-center` on the parent: it centres the icon
 * without the caller having to change how its row lays out anything else, so a
 * container that is `items-start` for reasons of its own keeps working.
 */
export function RowIcon({
  icon: Icon,
  align = "block",
  size = "3.5",
  className,
}: {
  icon: IconComponent
  align?: RowIconAlign
  size?: RowIconSize
  className?: string
}) {
  return (
    <Icon
      aria-hidden
      className={cn(
        "shrink-0",
        ICON_SIZE[size],
        align === "block" ? "self-center" : "self-start",
        className,
      )}
    />
  )
}

/**
 * The bench's standard list row: icon, title, optional supporting line, and
 * optional trailing content.
 *
 * Renders a `<button>` when given an `onClick` and a plain `<div>` otherwise,
 * so a static row never lands in the tab order.
 */
type RowOwnProps = {
  icon?: IconComponent
  /** Tone for the icon — severity colour, usually. */
  iconClassName?: string
  iconSize?: RowIconSize
  /** The row's first line. Named to leave `title` free for the tooltip. */
  label: React.ReactNode
  description?: React.ReactNode
  /** Right-aligned content: a chip, a duration, a switch. Vertically centred. */
  trailing?: React.ReactNode
  trailingClassName?: string
  /** Let the description wrap instead of truncating to one line. */
  wrap?: boolean
  className?: string
}

export type RowProps = RowOwnProps &
  Omit<React.ComponentProps<"button">, "children">

export function Row({
  icon,
  iconClassName,
  iconSize = "3.5",
  label,
  description,
  trailing,
  trailingClassName,
  wrap,
  className,
  onClick,
  ...props
}: RowProps) {
  const body = (
    <>
      {icon && (
        <RowIcon
          icon={icon}
          size={iconSize}
          className={cn("text-muted-foreground", iconClassName)}
        />
      )}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm text-foreground/90",
            wrap ? "leading-[1.125rem]" : "truncate",
          )}
        >
          {label}
        </span>
        {description && (
          <span
            className={cn(
              "mt-0.5 block text-xs text-muted-foreground/70",
              wrap ? "leading-relaxed" : "truncate",
            )}
          >
            {description}
          </span>
        )}
      </span>
      {trailing && (
        <span
          className={cn("flex shrink-0 items-center gap-2 pl-2", trailingClassName)}
        >
          {trailing}
        </span>
      )}
    </>
  )

  // `items-center`: the icon, the text block and the trailing content all sit
  // on the row's middle, so a row with a description reads the same as one
  // without. See the note above the primitive for why this is not first-line
  // alignment.
  const shared = "flex w-full items-center gap-2 px-3 py-2 text-left"

  if (!onClick) {
    // Spreading button props onto a div would be a lie, so a static row takes
    // only the handful of attributes that mean the same thing on both.
    return (
      <div className={cn(shared, className)} title={props.title} id={props.id}>
        {body}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        shared,
        "row-hover cursor-pointer",
        "focus-visible:ring-1 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset",
        className,
      )}
      {...props}
    >
      {body}
    </button>
  )
}

/* ============================================================================
   Metrics
   ========================================================================= */

/**
 * A metric tile: label, large tabular value, supporting line. Flat fill,
 * hairline border, no hover lift.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: "default" | "positive" | "warning" | "critical"
  className?: string
}) {
  // The border stays neutral at every tone. A grid of tiles each ringed in its
  // own colour turns a metrics row into a set of warning boxes; the value and
  // its supporting line carry the state instead, which is where the eye
  // already is.
  const toneText = {
    default: "text-foreground",
    positive: "text-success",
    warning: "text-warning",
    critical: "text-destructive",
  }[tone]

  const toneHint = {
    default: "text-muted-foreground",
    positive: "text-success/80",
    warning: "text-warning/80",
    critical: "text-destructive/80",
  }[tone]

  return (
    <div
      className={cn(
        // `min-w-0` so a tile in a grid can shrink below its content instead of
        // forcing the whole row wider than its column.
        "card-hover @container flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface p-3.5",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {/* No icon. A tile is a label, a number and a line of support; a glyph
            beside the label is a fourth mark saying nothing the label does not,
            and a row of four of them reads as decoration. Tone still colours
            the value and its hint. */}
        <p className="min-w-0 truncate text-xs font-medium text-muted-foreground">
          {label}
        </p>
      </div>
      {/* The value steps down a size in a narrow tile rather than overflowing
          or wrapping a long figure onto two lines. */}
      <p
        className={cn(
          "truncate text-xl leading-none font-semibold tabular @2xs:text-2xl",
          toneText,
        )}
        title={typeof value === "string" || typeof value === "number" ? String(value) : undefined}
      >
        {value}
      </p>
      {hint && <p className={cn("truncate text-xs", toneHint)}>{hint}</p>}
    </div>
  )
}

/* ============================================================================
   Empty states
   ========================================================================= */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: IconComponent
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex size-9 items-center justify-center rounded-md border border-border bg-raised">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/* ============================================================================
   Dense form rows — used by inspectors and the settings view
   ========================================================================= */

export function Field({
  label,
  hint,
  value,
  error,
  children,
  className,
}: {
  label: React.ReactNode
  hint?: React.ReactNode
  /** Rendered right-aligned next to the label, like VS Code's slider readouts. */
  value?: React.ReactNode
  error?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  // The wrapper is the <label> so the caption is implicitly associated with the
  // first control inside it. Callers pass raw inputs as children without ids,
  // so an explicit htmlFor pairing isn't available — and without the wrapper
  // the caption would be a floating <label> bound to nothing.
  return (
    <label className={cn("block space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-foreground/80">{label}</span>
        {value !== undefined && (
          <span className="font-mono text-xs text-muted-foreground tabular">
            {value}
          </span>
        )}
      </div>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground/70">{hint}</p>}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </label>
  )
}

/** Dense text/number input matched to Geist's 32px small control. */
export function WBInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-8 w-full rounded-sm border border-border bg-[var(--wb-raised)] px-2 text-sm text-foreground",
        "placeholder:text-muted-foreground/70",
        "transition-[border-color,box-shadow] duration-100",
        "focus:border-ring focus:ring-2 focus:ring-ring/25 focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

/** Dense native select styled to match {@link WBInput}. */
export function WBSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 w-full cursor-pointer appearance-none rounded-sm border border-border bg-[var(--wb-raised)] px-2 text-sm text-foreground",
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2016%2016%22%20fill%3D%22none%22%20stroke%3D%22%238f8f8f%22%20stroke-width%3D%221.5%22%3E%3Cpath%20d%3D%22M4%206l4%204%204-4%22/%3E%3C/svg%3E')] bg-[length:14px] bg-[position:right_6px_center] bg-no-repeat pr-7",
        "transition-[border-color,box-shadow] duration-100",
        "focus:border-ring focus:ring-2 focus:ring-ring/25 focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

/* ============================================================================
   Code surfaces
   ========================================================================= */

/**
 * A monospace readout that borrows the editor's furniture: inset well, optional
 * line-number gutter and a floating action slot in the top-right corner.
 */
export function CodeSurface({
  actions,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { actions?: React.ReactNode }) {
  return (
    <div className="relative min-h-0">
      {actions && (
        <div className="absolute top-1.5 right-2.5 z-10 flex items-center gap-1">
          {actions}
        </div>
      )}
      <div
        className={cn(
          "well seq-scroll overflow-auto p-3 font-mono text-xs leading-5 text-foreground/85",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  )
}

/* ============================================================================
   Misc
   ========================================================================= */

/** A hairline divider with an optional inline label, used inside inspectors. */
export function Rule({ label, className }: { label?: string; className?: string }) {
  if (!label) return <div className={cn("h-px w-full bg-border", className)} />
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-xs font-medium text-muted-foreground/80">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

/** Small pill used for counts and states in headers and status rows. */
export function Chip({
  tone = "neutral",
  className,
  ...props
}: React.ComponentProps<"span"> & {
  tone?: "neutral" | "info" | "success" | "warning" | "danger"
}) {
  const tones = {
    neutral: "border-border bg-raised text-muted-foreground",
    info: "border-info/30 bg-info/10 text-info",
    success: "border-success/30 bg-success/10 text-success",
    warning: "border-warning/30 bg-warning/10 text-warning",
    danger: "border-destructive/35 bg-destructive/12 text-destructive",
  }[tone]

  return (
    <span
      className={cn(
        "inline-flex h-[18px] items-center gap-1 rounded-full border px-1.5 text-2xs font-medium",
        tones,
        className,
      )}
      {...props}
    />
  )
}

export { Button }
