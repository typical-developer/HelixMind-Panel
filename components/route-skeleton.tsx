import { Skeleton } from "@/components/ui/skeleton"

/**
 * Structured placeholder shown by each route's `loading.tsx` while its segment
 * loads. It mirrors the real page's offset (so it sits correctly under the
 * persistent sidebar/header shell) and its rough block layout, so navigation
 * shows an instant skeleton instead of a blank flash — and nothing shifts when
 * the real content swaps in.
 */
export function RouteSkeleton({
  variant = "default",
  offset = "ml-16 pt-16",
}: {
  variant?: "default" | "list" | "split"
  offset?: string
}) {
  return (
    <div className={offset}>
      <main className="mx-auto max-w-7xl container pt-8 min-w-full min-h-screen space-y-8">
        {variant === "list" ? (
          <ListSkeleton />
        ) : variant === "split" ? (
          <SplitSkeleton />
        ) : (
          <DefaultSkeleton />
        )}
      </main>
    </div>
  )
}

function Panel({ className = "" }: { className?: string }) {
  return (
    <div
      className={`glass skeleton-shimmer rounded-lg ${className}`}
      aria-hidden="true"
    />
  )
}

function StatSkeleton() {
  return (
    <div className="glass p-6 rounded-lg space-y-3">
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  )
}

function DefaultSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>
      <Panel className="h-72" />
      <Panel className="h-96" />
    </>
  )
}

function SplitSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <Panel className="h-[520px] lg:col-span-1" />
      <Panel className="h-[520px] lg:col-span-3" />
    </div>
  )
}

function ListSkeleton() {
  return (
    <>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="glass rounded-lg divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
