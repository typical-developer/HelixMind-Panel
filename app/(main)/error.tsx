"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/error-state"

/**
 * Catches a failure inside the bench. The workbench chrome around it — rail,
 * sidebar, tabs, console, status bar — is owned by the layout above, so it
 * stays put and the operator can simply open something else.
 */
export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      title="This analysis failed to load"
      description="The view threw while rendering. The rest of the lab is unaffected — retry, or open another analysis from the sidebar."
      error={error}
      reset={reset}
      actions={
        <Button asChild variant="secondary" size="sm" className="h-8">
          <Link href="/dashboard">Go to Overview</Link>
        </Button>
      }
    />
  )
}
