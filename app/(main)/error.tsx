"use client"

import Link from "next/link"
import { Bug } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/error-state"
import { useOptionalSupport } from "@/components/support/support-provider"

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
  const support = useOptionalSupport()

  return (
    <ErrorState
      title="This analysis failed to load"
      description="The view threw while rendering. The rest of the lab is unaffected — retry, or open another analysis from the sidebar."
      error={error}
      reset={reset}
      actions={
        <>
          {/* The moment something breaks is the moment a report is worth
              collecting, so the diagnostic bundle is one click away here —
              pre-filled with the error, and carrying the digest that is
              otherwise the only handle on a production failure. */}
          {support && (
            <Button
              variant="secondary"
              size="sm"
              className="h-8"
              onClick={() =>
                support.openReport(
                  `The view failed to render: ${error.message}${
                    error.digest ? ` (reference ${error.digest})` : ""
                  }`,
                )
              }
            >
              <Bug className="size-3.5" />
              Report this error
            </Button>
          )}
          <Button asChild variant="secondary" size="sm" className="h-8">
            <Link href="/dashboard">Go to Overview</Link>
          </Button>
        </>
      }
    />
  )
}
