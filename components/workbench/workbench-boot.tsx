"use client"

import * as React from "react"

import { Skeleton } from "@/components/ui/skeleton"

const STEPS = [
  "Connecting to lab core",
  "Restoring your layout",
  "Indexing resistance markers",
  "Starting analysis engines",
]

/**
 * Startup state. Rather than a spinner on an empty page, this draws the
 * shell's own regions as skeletons so it appears to assemble in place —
 * nothing jumps when the real regions take over.
 */
export function WorkbenchBoot() {
  const [step, setStep] = React.useState(0)

  React.useEffect(() => {
    const timer = window.setInterval(
      () => setStep((s) => (s + 1) % STEPS.length),
      1400,
    )
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div
      className="flex h-svh flex-col overflow-hidden bg-chrome text-foreground"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Title bar */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2">
        <Skeleton className="size-4 rounded-xs" />
        <Skeleton className="h-2.5 w-16" delay={60} />
        <Skeleton className="h-2.5 w-10" delay={110} />
        <Skeleton className="mx-auto h-6 w-full max-w-md rounded-sm" delay={160} />
        <Skeleton className="h-2.5 w-16" delay={220} />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Rail */}
        <div className="flex w-12 shrink-0 flex-col items-center gap-4 border-r border-border py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="size-5 rounded-sm" delay={i * 90} />
          ))}
        </div>

        {/* Sidebar */}
        <div className="hidden w-56 shrink-0 flex-col gap-2.5 border-r border-border bg-surface p-3 sm:flex">
          <Skeleton className="h-2.5 w-24" delay={120} />
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-2.5"
              delay={200 + i * 80}
              style={{ width: `${55 + ((i * 13) % 40)}%` }}
            />
          ))}
        </div>

        {/* Bench */}
        <div className="flex min-w-0 flex-1 flex-col bg-surface">
          <div className="flex h-9 shrink-0 items-center gap-3 border-b border-border px-3">
            <Skeleton className="h-2.5 w-28" delay={260} />
            <Skeleton className="h-2.5 w-24" delay={320} />
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
            <div className="flex items-center text-sm text-muted-foreground">
              <span>{STEPS[step]}</span>
            </div>

            <div className="h-0.5 w-56 overflow-hidden rounded-full bg-[var(--wb-active)]">
              <div className="animate-progress-sweep h-full w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex h-6 shrink-0 items-center border-t border-border">
        <div className="flex h-full items-center gap-1.5 bg-brand px-2 text-xs font-medium text-brand-foreground">
          HelixMind Lab
        </div>
        <span className="px-2 text-xs text-muted-foreground">Starting the lab…</span>
      </div>
    </div>
  )
}
