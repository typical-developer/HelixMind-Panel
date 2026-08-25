"use client"

import * as React from "react"
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

import { crumbsForPath } from "./registry"
import { useConsole, useWorkbench } from "./workbench-provider"

/**
 * Where you are, and how to get back.
 *
 * A band under the tab strip existed before and was removed, correctly: it
 * drew the open view's icon, its name and its group beside a tab already
 * carrying the first two and a sidebar carrying the third, and called the
 * result a breadcrumb when the registry it read from was a flat list.
 *
 * What is different now is that there is somewhere to breadcrumb *to*. An
 * archived run lives at `/activity/l8x2k-3` — a slug, reachable from a
 * notification, from the activity log and from a bookmark, with nothing on
 * screen naming what it belonged to or offering a way back to the list. That
 * is the case a trail is for, and it comes with the control the bench had none
 * of anywhere: a Back button.
 *
 * The band pays for itself rather than being added on top. It takes the
 * context line — "3 archived runs · oldest event 2d ago" — off the end of the
 * tab strip, where it was competing with the tabs for width and hidden below
 * `@2xl`, and gives it a row where it always fits.
 */
export function BreadcrumbBar() {
  const { view, canGoBack, goBack, canGoForward, goForward, openTab } =
    useWorkbench()
  const { viewContext, viewCrumb } = useConsole()
  const pathname = usePathname()

  const crumbs = React.useMemo(() => crumbsForPath(pathname), [pathname])

  return (
    <nav
      aria-label="Breadcrumb"
      className="@container flex h-7 shrink-0 items-center gap-1 border-b border-border bg-chrome pr-2 pl-1.5"
    >
      <div className="flex shrink-0 items-center">
        <HistoryButton
          icon={ArrowLeft}
          label="Back"
          disabled={!canGoBack}
          onClick={goBack}
        />
        <HistoryButton
          icon={ArrowRight}
          label="Forward"
          disabled={!canGoForward}
          onClick={goForward}
        />
      </div>

      <ol className="flex min-w-0 flex-1 items-center gap-1">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1
          // The deepest crumb is the one the view names. Until it does, the
          // raw segment stands in — an id is a poor label but an honest one,
          // and better than the trail changing length as the record loads.
          const label = last && crumb.pending ? (viewCrumb ?? crumb.label) : crumb.label

          return (
            <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight
                  aria-hidden
                  className="size-3 shrink-0 text-muted-foreground/50"
                />
              )}
              {crumb.href && !last ? (
                <button
                  type="button"
                  onClick={() => openTab(crumb.href!)}
                  title={`Open ${crumb.label}`}
                  className={cn(
                    "cursor-pointer truncate rounded-sm px-1 py-0.5 text-xs text-muted-foreground",
                    "transition-colors duration-100 hover:bg-[var(--wb-hover)] hover:text-foreground",
                    "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
                  )}
                >
                  {label}
                </button>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  title={label}
                  className={cn(
                    "truncate px-1 py-0.5 text-xs",
                    last ? "font-medium text-foreground/90" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              )}
            </li>
          )
        })}
      </ol>

      {/* What the open view is working on. Given away first when the row runs
          out of room — the trail and the history controls are both load-bearing
          and this is a detail line. */}
      {view && (
        <span
          className="hidden min-w-0 shrink truncate pl-2 text-xs text-muted-foreground/80 @xl:block"
          title={viewContext ?? view.hint}
        >
          {viewContext ?? view.hint}
        </span>
      )}
    </nav>
  )
}

function HistoryButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      // A plain `title` rather than the toolbar's tooltip: these two sit at the
      // very top-left of the bench, where a tooltip below them lands on the
      // trail they describe.
      title={disabled ? `${label} — nothing to go ${label.toLowerCase()} to` : label}
      className={cn(
        "inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm",
        "text-muted-foreground transition-[background-color,color] duration-100",
        "hover:bg-[var(--wb-hover)] hover:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
        // Kept in place and dimmed rather than hidden: a control that appears
        // and disappears as you navigate moves everything beside it.
        "disabled:pointer-events-none disabled:opacity-30",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  )
}
