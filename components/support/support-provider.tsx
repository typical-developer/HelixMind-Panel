"use client"

import * as React from "react"

import { ReportDialog } from "./report-dialog"

interface SupportContextValue {
  /** Open the report dialog, optionally pre-describing the problem. */
  openReport: (summary?: string) => void
  /** Open the "about this build" panel. */
  openAbout: () => void
  aboutOpen: boolean
  setAboutOpen: (open: boolean) => void
}

const SupportContext = React.createContext<SupportContextValue | null>(null)

/**
 * One report dialog for the whole bench.
 *
 * Four surfaces open it — the help menu on the rail, the command palette,
 * the Support section in Settings, and the error boundary — and each of them
 * mounting its own copy would mean four snapshots of the console state and
 * four dialogs competing for the same focus trap.
 *
 * Sits inside `WorkbenchProvider` because the report needs the run log, the
 * alerts and the layout.
 */
export function SupportProvider({ children }: { children: React.ReactNode }) {
  const [reportOpen, setReportOpen] = React.useState(false)
  const [aboutOpen, setAboutOpen] = React.useState(false)
  const [seed, setSeed] = React.useState("")

  const openReport = React.useCallback((summary = "") => {
    setSeed(summary)
    setReportOpen(true)
  }, [])

  const openAbout = React.useCallback(() => setAboutOpen(true), [])

  const value = React.useMemo<SupportContextValue>(
    () => ({ openReport, openAbout, aboutOpen, setAboutOpen }),
    [openReport, openAbout, aboutOpen],
  )

  return (
    <SupportContext.Provider value={value}>
      {children}
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        initialSummary={seed}
      />
    </SupportContext.Provider>
  )
}

export function useSupport() {
  const ctx = React.useContext(SupportContext)
  if (!ctx) {
    throw new Error("useSupport must be used inside <SupportProvider>")
  }
  return ctx
}

/**
 * Non-throwing variant for chrome that may render outside the provider — the
 * root error boundary sits above the workbench, so it has no support context
 * to read and must degrade rather than crash inside an error screen.
 */
export function useOptionalSupport() {
  return React.useContext(SupportContext)
}
