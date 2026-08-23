import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Stand-in shown while a chart's code chunk loads.
 *
 * Charting pulls in a large dependency, so every chart in the app is imported
 * dynamically and renders this first. It reserves the chart's exact height —
 * the plot never pushes the surrounding pane around when it arrives — and
 * draws a plausible plot area rather than an empty box.
 */
export function ChartFallback({
  height = 300,
  className,
}: {
  height?: number
  className?: string
}) {
  return (
    <div
      className={cn("flex flex-col gap-2 p-3", className)}
      style={{ height }}
      role="status"
      aria-label="Loading chart"
    >
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
