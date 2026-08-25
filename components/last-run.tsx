"use client"

import { History } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatRelative, useRelativeClock, type EngineId } from "@/lib/activity-store"
import { useArchivedRuns } from "@/lib/run-archive"
import { useWorkbench } from "@/components/workbench"

/**
 * "You have run this before — here it is."
 *
 * An engine's view is empty every time you arrive at it, because its state
 * lives in the routed component and that component was just mounted. Filing
 * results in the archive fixed the *losing* half of that problem, but not the
 * half the operator actually experiences: they run a scan, go and check a gene
 * record, come back — and the bench is blank again. The result is a click away
 * in Activity, and nothing on the empty screen says so.
 *
 * So each engine's empty state ends with this. It renders nothing at all until
 * there is something to offer, which keeps a first-time workspace honestly
 * empty — the property the whole "no fabricated data" pass was about.
 */
export function LastRunLink({
  engine,
  className,
}: {
  engine: EngineId
  className?: string
}) {
  const runs = useArchivedRuns()
  const { openTab } = useWorkbench()
  const now = useRelativeClock()

  const last = runs.find((run) => run.engine === engine)
  if (!last) return null

  return (
    <button
      type="button"
      onClick={() => openTab(`/activity/${last.id}`)}
      title={`${last.label}${last.detail ? ` — ${last.detail}` : ""} · ${new Date(
        last.endedAt,
      ).toLocaleString()}`}
      className={cn(
        // Fades in rather than snapping: the archive is read asynchronously, so
        // this always arrives a frame or two after the empty state around it.
        "animate-fade-in row-hover flex max-w-full cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 py-1.5",
        "text-xs text-muted-foreground transition-colors hover:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
        className,
      )}
    >
      <History className="size-3.5 shrink-0" />
      <span className="truncate">
        Your last run finished {formatRelative(last.endedAt, now)}
      </span>
      <span className="shrink-0 text-foreground/80">Open it</span>
    </button>
  )
}
