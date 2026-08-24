"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Bug, Copy, DownloadIcon, Mail, ShieldCheck } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { SUPPORT_EMAIL, BUILD_LABEL } from "@/lib/app-info"
import { copyToClipboard, downloadJSON, fileStamp } from "@/lib/download"
import {
  buildDiagnostics,
  formatDiagnostics,
  mailtoLink,
  type DiagnosticReport,
} from "@/lib/diagnostics"
import { CodeSurface, useConsole, useWorkbench } from "@/components/workbench"

/**
 * Report a problem.
 *
 * The panel has no support endpoint — the API exposes signup, login and
 * `me/auth` and nothing else — so this does not pretend to file a ticket. It
 * assembles a diagnostic bundle, shows the operator every byte of it, and
 * offers the three things that genuinely work from a browser: copy it,
 * download it, or open it in their mail client.
 */
export function ReportDialog({
  open,
  onOpenChange,
  /** Pre-filled when opened from an error boundary. */
  initialSummary = "",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSummary?: string
}) {
  const pathname = usePathname()
  const workbench = useWorkbench()
  const { logs, alerts } = useConsole()

  const [summary, setSummary] = React.useState(initialSummary)
  const [steps, setSteps] = React.useState("")
  const [showDetails, setShowDetails] = React.useState(false)

  // Re-seed each time it opens so a report raised from an error boundary
  // arrives with the error already described.
  React.useEffect(() => {
    if (open) {
      setSummary(initialSummary)
      setSteps("")
      setShowDetails(false)
    }
  }, [open, initialSummary])

  /**
   * Built on demand rather than on every keystroke: it snapshots the log and
   * the alert list, and re-deriving that as the operator types would make the
   * preview flicker while they read it.
   */
  const buildReport = React.useCallback(
    (): DiagnosticReport =>
      buildDiagnostics({
        summary,
        steps,
        route: pathname,
        logs,
        alerts,
        openTabs: workbench.tabs.map((tab) => tab.href),
        layout: {
          activity: workbench.activity,
          sidebarVisible: workbench.sidebarVisible,
          panelVisible: workbench.panelVisible,
          panelTab: workbench.panelTab,
          inspectorVisible: workbench.inspectorVisible,
          statusBarVisible: workbench.statusBarVisible,
          contextBarVisible: workbench.contextBarVisible,
          tabBarVisible: workbench.tabBarVisible,
          focusMode: workbench.focusMode,
          zoom: workbench.zoom,
        },
      }),
    [alerts, logs, pathname, steps, summary, workbench],
  )

  const preview = React.useMemo(
    () => (showDetails ? formatDiagnostics(buildReport()) : ""),
    [buildReport, showDetails],
  )

  const handleCopy = async () => {
    await copyToClipboard(formatDiagnostics(buildReport()), "Report copied")
    onOpenChange(false)
  }

  const handleDownload = () => {
    downloadJSON(buildReport(), {
      filename: `helixmind-bug-report-${fileStamp()}.json`,
      description: "Attach this file to your support message.",
    })
    onOpenChange(false)
  }

  const handleEmail = () => {
    const { href, truncated } = mailtoLink(buildReport(), SUPPORT_EMAIL)
    // A mailto: that exceeds the client's URL limit silently drops its body,
    // so the operator is told to attach the file when that happens.
    if (truncated) {
      toast({
        variant: "warning",
        title: "Report shortened for email",
        description:
          "The log was too long for a mail link. Download the report and attach it instead.",
      })
    }
    window.location.href = href
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="space-y-1 border-b border-border p-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bug className="size-4" />
            Report a problem
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Describe what went wrong. A diagnostic bundle is attached — you can
            read all of it before you share anything.
          </DialogDescription>
        </DialogHeader>

        <div className="seq-scroll max-h-[55vh] space-y-4 overflow-y-auto p-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-foreground/80">
              What happened?
            </span>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="The tab kept showing a running dot after the simulation finished."
              rows={3}
              className="resize-none text-sm"
              autoFocus
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-foreground/80">
              How can we reproduce it?{" "}
              <span className="font-normal text-muted-foreground">optional</span>
            </span>
            <Textarea
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder={"1. Open the Mutation Simulator\n2. Upload a FASTA file\n3. Press Start"}
              rows={4}
              className="resize-none text-sm"
            />
          </label>

          <div className="rounded-md border border-border">
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="row-hover flex w-full cursor-pointer items-center gap-2 rounded-t-md px-3 py-2 text-left text-xs focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
            >
              <ShieldCheck className="size-3.5 shrink-0 text-success" />
              <span className="min-w-0 flex-1 text-foreground/85">
                Nothing is sent automatically. Review what will be shared.
              </span>
              <span className="shrink-0 text-muted-foreground">
                {showDetails ? "Hide" : "Show"}
              </span>
            </button>

            {showDetails && (
              <CodeSurface className="max-h-64 overflow-auto rounded-t-none border-0 border-t border-border text-2xs leading-5">
                {preview}
              </CodeSurface>
            )}
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground/80">
            Includes the route you are on, your open analyses, the current
            alerts, the last 50 run-log lines and your browser details. It does
            not include your sequences, your email or your sign-in token.
          </p>
        </div>

        <DialogFooter
          className={cn(
            "flex-col gap-2 border-t border-border p-4 sm:flex-row sm:items-center",
          )}
        >
          <span className="mr-auto font-mono text-2xs text-muted-foreground/70">
            {BUILD_LABEL}
          </span>
          <Button variant="secondary" size="sm" onClick={handleCopy} className="h-8">
            <Copy className="size-3.5" />
            Copy report
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownload}
            className="h-8"
          >
            <DownloadIcon className="size-3.5" />
            Download
          </Button>
          <Button size="sm" onClick={handleEmail} className="h-8">
            <Mail className="size-3.5" />
            Open in email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
