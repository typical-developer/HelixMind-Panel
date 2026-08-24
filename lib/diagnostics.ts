/**
 * The diagnostic bundle attached to a bug report.
 *
 * Assembled in the browser and shown to the operator in full before they do
 * anything with it, because it is their data: what they were doing, what the
 * lab had logged, and what browser they are on. Nothing here is collected
 * unless they open the report dialog.
 *
 * Deliberately excludes anything identifying: no email, no auth token, no
 * sequence content. A run-log line names a file the operator uploaded, which
 * is why the bundle is rendered for review rather than sent anywhere.
 */
import { APP_NAME, APP_VERSION } from "./app-info"
import type { LogLine, WorkbenchAlert } from "@/components/workbench"

/** Log lines carried with a report. Enough for context, not a transcript. */
export const DIAGNOSTIC_LOG_LINES = 50

export interface DiagnosticInput {
  /** What the operator typed. */
  summary: string
  steps: string
  /** Route they were on. */
  route: string
  logs: LogLine[]
  alerts: WorkbenchAlert[]
  /** Visible regions and sizes, straight from the workbench layout. */
  layout: Record<string, unknown>
  /** Open analyses, by route. */
  openTabs: string[]
}

export interface DiagnosticReport {
  app: { name: string; version: string }
  reportedAt: string
  route: string
  summary: string
  steps: string
  environment: {
    userAgent: string
    language: string
    platform: string
    viewport: string
    devicePixelRatio: number
    timeZone: string
    online: boolean
    prefersReducedMotion: boolean
  }
  workspace: {
    openTabs: string[]
    layout: Record<string, unknown>
  }
  alerts: Array<{ source: string; severity: string; message: string; at?: string }>
  recentLog: string[]
}

function environment(): DiagnosticReport["environment"] {
  // Guarded so the builder can also run under the test environment, where
  // there is no browser to describe.
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      userAgent: "unknown",
      language: "unknown",
      platform: "unknown",
      viewport: "unknown",
      devicePixelRatio: 1,
      timeZone: "unknown",
      online: false,
      prefersReducedMotion: false,
    }
  }

  let timeZone = "unknown"
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "unknown"
  } catch {
    /* Not worth failing a bug report over. */
  }

  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform ?? "unknown",
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    devicePixelRatio: window.devicePixelRatio ?? 1,
    timeZone,
    online: navigator.onLine,
    prefersReducedMotion:
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  }
}

export function buildDiagnostics(input: DiagnosticInput): DiagnosticReport {
  const pad = (n: number) => String(n).padStart(2, "0")

  return {
    app: { name: APP_NAME, version: APP_VERSION },
    reportedAt: new Date().toISOString(),
    route: input.route,
    summary: input.summary.trim(),
    steps: input.steps.trim(),
    environment: environment(),
    workspace: {
      openTabs: input.openTabs,
      layout: input.layout,
    },
    alerts: input.alerts.map((alert) => ({
      source: alert.source,
      severity: alert.severity,
      message: alert.message,
      at: alert.at,
    })),
    recentLog: input.logs.slice(-DIAGNOSTIC_LOG_LINES).map((line) => {
      const d = new Date(line.ts)
      const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      return `${time} [${line.source}] ${line.level}: ${line.message}`
    }),
  }
}

/** The bundle as readable text, for the clipboard and the mail body. */
export function formatDiagnostics(report: DiagnosticReport): string {
  const lines: string[] = [
    `${report.app.name} ${report.app.version} — bug report`,
    `Reported: ${report.reportedAt}`,
    `Route: ${report.route}`,
    "",
    "## What happened",
    report.summary || "(not described)",
    "",
    "## Steps to reproduce",
    report.steps || "(not described)",
    "",
    "## Environment",
    `Browser: ${report.environment.userAgent}`,
    `Platform: ${report.environment.platform} · ${report.environment.language} · ${report.environment.timeZone}`,
    `Viewport: ${report.environment.viewport} @ ${report.environment.devicePixelRatio}x`,
    `Online: ${report.environment.online} · reduced motion: ${report.environment.prefersReducedMotion}`,
    "",
    "## Workspace",
    `Open analyses: ${
      report.workspace.openTabs.length > 0
        ? report.workspace.openTabs.join(", ")
        : "none"
    }`,
    "",
    "## Alerts",
    ...(report.alerts.length > 0
      ? report.alerts.map(
          (a) => `- [${a.severity}] ${a.source}: ${a.message}${a.at ? ` (${a.at})` : ""}`,
        )
      : ["(none)"]),
    "",
    `## Recent log (last ${report.recentLog.length})`,
    ...(report.recentLog.length > 0 ? report.recentLog : ["(empty)"]),
  ]

  return lines.join("\n")
}

/**
 * A `mailto:` URL carrying the report.
 *
 * Mail clients and browsers cap URL length well below what a full log can
 * reach, so the body is truncated and the operator is told to attach the
 * downloaded JSON instead. Silently sending a half-report would be worse than
 * saying so.
 */
export const MAILTO_BODY_LIMIT = 1800

export function mailtoLink(
  report: DiagnosticReport,
  address: string,
): { href: string; truncated: boolean } {
  const full = formatDiagnostics(report)
  const truncated = full.length > MAILTO_BODY_LIMIT
  const body = truncated
    ? `${full.slice(0, MAILTO_BODY_LIMIT)}\n\n[…truncated. Please attach the downloaded report file.]`
    : full

  const subject = `${report.app.name} bug report — ${
    report.summary.slice(0, 60) || report.route
  }`

  return {
    href: `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    truncated,
  }
}
