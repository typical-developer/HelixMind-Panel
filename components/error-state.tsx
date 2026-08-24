"use client"

import * as React from "react"
import { RotateCcw, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * The shared body of every error boundary in the app.
 *
 * Next.js only surfaces its own "missing required error components" message
 * when a segment throws and no boundary exists to catch it, so every segment
 * that can throw gets one of these. It shows what broke, offers the retry that
 * `reset()` provides, and — in development — the stack, since that is the one
 * place the digest alone is not enough to work from.
 */
export function ErrorState({
  title = "Something went wrong",
  description,
  error,
  reset,
  className,
  actions,
}: {
  title?: string
  description?: React.ReactNode
  error?: Error & { digest?: string }
  reset?: () => void
  className?: string
  actions?: React.ReactNode
}) {
  const isDev = process.env.NODE_ENV === "development"

  React.useEffect(() => {
    if (error) console.error(error)
  }, [error])

  return (
    <div
      role="alert"
      className={cn(
        "flex h-full min-h-0 w-full flex-col items-center justify-center gap-4 overflow-auto p-6 text-center",
        className,
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-raised">
        <TriangleAlert className="size-4 text-warning" />
      </div>

      <div className="max-w-md space-y-1.5">
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description ??
            "This view failed to render. Nothing else in the lab is affected — retry, or move to another analysis."}
        </p>
      </div>

      {/* The digest is the only handle on a production error, so it is always
          shown when present rather than hidden behind the dev check. */}
      {error?.digest && (
        <p className="font-mono text-xs text-muted-foreground/70">
          Reference {error.digest}
        </p>
      )}

      {isDev && error?.message && (
        <pre className="well seq-scroll max-h-48 w-full max-w-2xl overflow-auto p-3 text-left font-mono text-xs leading-5 whitespace-pre-wrap text-[var(--log-error)]">
          {error.message}
          {error.stack ? `\n\n${error.stack}` : null}
        </pre>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {reset && (
          <Button size="sm" onClick={reset} className="h-8">
            <RotateCcw className="size-3.5" />
            Try again
          </Button>
        )}
        {actions}
      </div>
    </div>
  )
}
