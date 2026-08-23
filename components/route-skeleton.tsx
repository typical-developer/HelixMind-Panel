import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Placeholder rendered by each route's `loading.tsx` while its segment loads.
 *
 * It fills the bench of the persistent shell (the title bar, rail, sidebar,
 * tabs and status bar are already on screen), and mirrors the structure of the
 * view it stands in for — pane headers, toolbars, table rows — rather than
 * blank rectangles, so nothing jumps when the real content swaps in.
 *
 * The whole thing is held back for ~140ms by `sk-reveal`: a navigation that
 * resolves quickly never flashes a skeleton at all.
 */
export function RouteSkeleton({
  variant = "default",
}: {
  variant?: "default" | "list" | "split" | "inspector" | "table"
}) {
  return (
    <div
      className="sk-reveal seq-scroll h-full min-h-0 overflow-y-auto"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      {variant === "list" ? (
        <ListSkeleton />
      ) : variant === "split" ? (
        <SplitSkeleton />
      ) : variant === "inspector" ? (
        <InspectorSkeleton />
      ) : variant === "table" ? (
        <TableSkeleton />
      ) : (
        <DefaultSkeleton />
      )}
    </div>
  )
}

/* ============================================================================
   Building blocks — each mirrors a real piece of workbench furniture
   ========================================================================= */

/** A pane with its 32px header bar, matching `<Pane>` + `<PaneHeader>`. */
function PaneShell({
  className,
  children,
  delay = 0,
}: {
  className?: string
  children?: React.ReactNode
  delay?: number
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface",
        className,
      )}
      aria-hidden="true"
    >
      <header className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3">
        <Skeleton className="size-3.5 rounded-xs" delay={delay} />
        <Skeleton className="h-2.5 w-28" delay={delay} />
        <Skeleton className="ml-auto h-2.5 w-16" delay={delay + 60} />
      </header>
      {children}
    </section>
  )
}

/** Rows of text lines at decreasing widths, the way real copy sits in a pane. */
function Lines({
  count = 4,
  delay = 0,
  className,
}: {
  count?: number
  delay?: number
  className?: string
}) {
  return (
    <div className={cn("space-y-2.5 p-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-2.5"
          delay={delay + i * 70}
          style={{ width: `${88 - ((i * 17) % 45)}%` }}
        />
      ))}
    </div>
  )
}

/** Mirrors `<StatTile>`: caption, large value, supporting line. */
function StatSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3.5"
      aria-hidden="true"
    >
      <div className="flex items-center gap-1.5">
        <Skeleton className="size-3.5 rounded-xs" delay={delay} />
        <Skeleton className="h-2.5 w-24" delay={delay} />
      </div>
      <Skeleton className="h-5 w-20 rounded-md" delay={delay + 80} />
      <Skeleton className="h-2.5 w-28" delay={delay + 140} />
    </div>
  )
}

/** Mirrors the 36px toolbar that sits above filtered views. */
function ToolbarSkeleton() {
  return (
    <div
      className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2"
      aria-hidden="true"
    >
      <Skeleton className="h-7 w-full max-w-sm rounded-sm" />
      <Skeleton className="ml-auto h-2.5 w-16" delay={80} />
    </div>
  )
}

/** A chart's plot area: gridlines and a run of bars at varying heights. */
function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 p-3", className)} aria-hidden="true">
      <div className="flex min-h-0 flex-1 items-end gap-1.5">
        {Array.from({ length: 24 }).map((_, i) => (
          <Skeleton
            key={i}
            className="min-h-1 flex-1 rounded-xs"
            delay={i * 35}
            // A gentle wave rather than random noise, so it reads as data.
            style={{ height: `${28 + Math.sin(i / 2.4) * 22 + (i % 3) * 6}%` }}
          />
        ))}
      </div>
      <div className="flex shrink-0 gap-4 pt-1">
        <Skeleton className="h-2 w-16" delay={200} />
        <Skeleton className="h-2 w-16" delay={260} />
      </div>
    </div>
  )
}

/* ============================================================================
   Variants
   ========================================================================= */

function DefaultSkeleton() {
  return (
    <div className="space-y-3 p-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 90, 180, 270].map((delay) => (
          <StatSkeleton key={delay} delay={delay} />
        ))}
      </div>
      <div className="grid gap-3 xl:grid-cols-[1.35fr_1fr]">
        <PaneShell className="h-64" delay={320}>
          <Lines count={6} delay={340} />
        </PaneShell>
        <PaneShell className="h-64" delay={380}>
          <Lines count={6} delay={400} />
        </PaneShell>
      </div>
      <PaneShell className="h-80" delay={460}>
        <ChartSkeleton className="min-h-0 flex-1" />
      </PaneShell>
    </div>
  )
}

function SplitSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-4">
      <PaneShell className="h-[460px] lg:col-span-1">
        <Lines count={8} delay={60} />
      </PaneShell>
      <PaneShell className="h-[460px] lg:col-span-3" delay={120}>
        <ChartSkeleton className="min-h-0 flex-1" />
      </PaneShell>
    </div>
  )
}

function InspectorSkeleton() {
  return (
    <div className="flex h-full min-h-0 gap-3 p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="grid shrink-0 grid-cols-3 gap-3">
          {[0, 90, 180].map((delay) => (
            <StatSkeleton key={delay} delay={delay} />
          ))}
        </div>
        <PaneShell className="min-h-40 flex-1" delay={260}>
          <ChartSkeleton className="min-h-0 flex-1" />
        </PaneShell>
      </div>
      <PaneShell className="hidden w-72 shrink-0 lg:flex" delay={340}>
        <Lines count={9} delay={360} />
      </PaneShell>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ToolbarSkeleton />
      <div className="min-h-0 flex-1 p-3">
        <div
          className="overflow-hidden rounded-lg border border-border bg-surface"
          aria-hidden="true"
        >
          <div className="flex items-center gap-3 border-b border-border px-3 py-2">
            {[24, 16, 20, 14, 18].map((w, i) => (
              <Skeleton
                key={i}
                className="h-2.5"
                delay={i * 50}
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
          {Array.from({ length: 10 }).map((_, row) => (
            <div
              key={row}
              className="flex items-center gap-3 border-b border-border/50 px-3 py-2 last:border-0"
            >
              {[24, 16, 20, 14, 18].map((w, i) => (
                <Skeleton
                  key={i}
                  className="h-2.5"
                  delay={row * 45 + i * 25}
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-3 p-3">
      <PaneShell>
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 border-b border-border/50 px-3 py-3 last:border-0"
          >
            <Skeleton className="size-6 shrink-0 rounded-md" delay={i * 70} />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton
                className="h-2.5"
                delay={i * 70}
                style={{ width: `${52 - ((i * 11) % 24)}%` }}
              />
              <Skeleton
                className="h-2.5"
                delay={i * 70 + 50}
                style={{ width: `${84 - ((i * 13) % 30)}%` }}
              />
            </div>
            <Skeleton className="h-2 w-12 shrink-0" delay={i * 70 + 90} />
          </div>
        ))}
      </PaneShell>
    </div>
  )
}
