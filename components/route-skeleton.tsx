import { Skeleton } from "@/components/ui/skeleton"

/**
 * Placeholder rendered by each route's `loading.tsx` while its segment loads.
 *
 * It fills the editor region of the persistent workbench shell (the title bar,
 * activity bar, side bar, tabs and status bar are already on screen), and
 * mirrors the rough block layout of the view it stands in for so nothing
 * shifts when the real content swaps in.
 */
export function RouteSkeleton({
  variant = "default",
}: {
  variant?: "default" | "list" | "split" | "inspector"
}) {
  return (
    <div className="seq-scroll h-full min-h-0 overflow-y-auto">
      {variant === "list" ? (
        <ListSkeleton />
      ) : variant === "split" ? (
        <SplitSkeleton />
      ) : variant === "inspector" ? (
        <InspectorSkeleton />
      ) : (
        <DefaultSkeleton />
      )}
    </div>
  )
}

function Panel({ className = "" }: { className?: string }) {
  return (
    <div
      className={`skeleton-shimmer rounded-lg border border-border bg-surface ${className}`}
      aria-hidden="true"
    />
  )
}

function StatSkeleton() {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
      <Skeleton className="h-2.5 w-1/2" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-2.5 w-1/3" />
    </div>
  )
}

function DefaultSkeleton() {
  return (
    <div className="space-y-3 p-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>
      <Panel className="h-64" />
      <Panel className="h-80" />
    </div>
  )
}

function SplitSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-4">
      <Panel className="h-[460px] lg:col-span-1" />
      <Panel className="h-[460px] lg:col-span-3" />
    </div>
  )
}

function InspectorSkeleton() {
  return (
    <div className="flex h-full min-h-0 gap-3 p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Panel className="h-72 shrink-0" />
        <Panel className="min-h-40 flex-1" />
      </div>
      <Panel className="hidden w-72 shrink-0 lg:block" />
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-3 p-3">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="divide-y divide-border rounded-lg border border-border bg-surface">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="size-7 shrink-0 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-2.5 w-1/3" />
              <Skeleton className="h-2.5 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
