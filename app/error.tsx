"use client"

import { ErrorState } from "@/components/error-state"

/** Catches anything that escapes a route group's own boundary. */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex h-svh flex-col bg-chrome text-foreground">
      <ErrorState
        title="HelixMind hit an unexpected error"
        error={error}
        reset={reset}
      />
    </div>
  )
}
