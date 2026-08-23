"use client"

import * as React from "react"

const STEPS = [
  "Connecting to lab core",
  "Restoring workspace layout",
  "Indexing resistance markers",
  "Starting analysis engine",
]

/**
 * Startup state. Rather than a spinner on an empty page, this draws the
 * workbench's own chrome as skeletons so the shell appears to assemble in
 * place — nothing jumps when the real regions take over.
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
        <div className="size-4 rounded-xs bg-[var(--wb-active)]" />
        <div className="h-3 w-16 rounded-xs bg-[var(--wb-hover)]" />
        <div className="h-3 w-10 rounded-xs bg-[var(--wb-hover)]" />
        <div className="mx-auto h-6 w-full max-w-md skeleton-shimmer rounded-sm border border-border bg-surface" />
        <div className="h-3.5 w-16 rounded-xs bg-[var(--wb-hover)]" />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Activity bar */}
        <div className="flex w-12 shrink-0 flex-col items-center gap-4 border-r border-border py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="size-5 rounded-sm bg-[var(--wb-hover)]" />
          ))}
        </div>

        {/* Side bar */}
        <div className="hidden w-56 shrink-0 flex-col gap-2 border-r border-border bg-surface p-3 sm:flex">
          <div className="h-3 w-24 rounded-xs bg-[var(--wb-active)]" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-3 skeleton-shimmer rounded-xs bg-[var(--wb-hover)]"
              style={{ width: `${55 + ((i * 13) % 40)}%` }}
            />
          ))}
        </div>

        {/* Editor */}
        <div className="flex min-w-0 flex-1 flex-col bg-surface">
          <div className="flex h-9 shrink-0 items-center gap-3 border-b border-border px-3">
            <div className="h-3 w-28 rounded-xs bg-[var(--wb-active)]" />
            <div className="h-3 w-24 rounded-xs bg-[var(--wb-hover)]" />
          </div>

          <div className="bg-grid flex flex-1 flex-col items-center justify-center gap-4 p-6">
            <div className="flex items-center gap-2.5 font-mono text-sm text-muted-foreground">
              <span className="inline-flex size-1.5 animate-soft-pulse rounded-full bg-brand" />
              <span>{STEPS[step]}</span>
              <span className="inline-block h-3.5 w-[7px] animate-soft-pulse bg-muted-foreground/70" />
            </div>

            <div className="h-0.5 w-56 overflow-hidden rounded-full bg-[var(--wb-active)]">
              <div className="animate-progress-sweep h-full w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex h-6 shrink-0 items-center border-t border-border">
        <div className="flex h-full items-center gap-1.5 bg-brand px-2 text-xs font-medium text-white">
          HelixMind
        </div>
        <span className="px-2 text-xs text-muted-foreground">Starting workbench…</span>
      </div>
    </div>
  )
}
