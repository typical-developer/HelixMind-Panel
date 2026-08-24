import { describe, expect, it } from "vitest"

import {
  DIAGNOSTIC_LOG_LINES,
  MAILTO_BODY_LIMIT,
  buildDiagnostics,
  formatDiagnostics,
  mailtoLink,
  type DiagnosticInput,
} from "@/lib/diagnostics"
import { APP_VERSION } from "@/lib/app-info"

const input = (over: Partial<DiagnosticInput> = {}): DiagnosticInput => ({
  summary: "  The tab kept pulsing after the run finished.  ",
  steps: "1. Start a simulation\n2. Wait",
  route: "/mutation-simulator",
  logs: [],
  alerts: [],
  layout: { sidebarVisible: true, zoom: 0 },
  openTabs: ["/dashboard", "/mutation-simulator"],
  ...over,
})

const line = (i: number) => ({
  id: i,
  ts: 1_700_000_000_000 + i * 1000,
  level: "info" as const,
  source: "mutation-simulator",
  message: `gen ${i}`,
})

describe("buildDiagnostics", () => {
  it("records what the user typed, trimmed", () => {
    const report = buildDiagnostics(input())
    expect(report.summary).toBe("The tab kept pulsing after the run finished.")
    expect(report.steps).toBe("1. Start a simulation\n2. Wait")
  })

  it("stamps the build and an ISO timestamp", () => {
    const report = buildDiagnostics(input())
    expect(report.app.version).toBe(APP_VERSION)
    expect(report.reportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it("carries the route and open analyses", () => {
    const report = buildDiagnostics(input())
    expect(report.route).toBe("/mutation-simulator")
    expect(report.workspace.openTabs).toEqual([
      "/dashboard",
      "/mutation-simulator",
    ])
  })

  it("keeps only the tail of a long log", () => {
    const logs = Array.from({ length: 200 }, (_, i) => line(i))
    const report = buildDiagnostics(input({ logs }))
    expect(report.recentLog).toHaveLength(DIAGNOSTIC_LOG_LINES)
    expect(report.recentLog.at(-1)).toContain("gen 199")
  })

  it("flattens alerts to their essentials", () => {
    const report = buildDiagnostics(
      input({
        alerts: [
          {
            source: "dna-scanner",
            severity: "warning",
            message: "High ambiguity",
            at: "SEQ1",
          },
        ],
      }),
    )
    expect(report.alerts).toEqual([
      {
        source: "dna-scanner",
        severity: "warning",
        message: "High ambiguity",
        at: "SEQ1",
      },
    ])
  })

  it("never carries a token, an email, or sequence data", () => {
    // The bundle is meant to be shareable; anything identifying must not be in
    // it, no matter what the caller passes.
    const serialised = JSON.stringify(
      buildDiagnostics(input({ logs: [line(1)] })),
    )
    expect(serialised).not.toContain("Helix_user_token")
    expect(serialised.toLowerCase()).not.toContain("password")
    expect(serialised).not.toMatch(/"email"/)
  })
})

describe("formatDiagnostics", () => {
  it("renders every section", () => {
    const text = formatDiagnostics(buildDiagnostics(input()))
    for (const heading of [
      "## What happened",
      "## Steps to reproduce",
      "## Environment",
      "## Workspace",
      "## Alerts",
    ]) {
      expect(text).toContain(heading)
    }
  })

  it("says so when a field was left blank", () => {
    const text = formatDiagnostics(
      buildDiagnostics(input({ summary: "", steps: "" })),
    )
    expect(text).toContain("(not described)")
  })

  it("reports no alerts as none rather than an empty gap", () => {
    expect(formatDiagnostics(buildDiagnostics(input()))).toContain("(none)")
  })
})

describe("mailtoLink", () => {
  it("addresses and subjects the mail", () => {
    const { href } = mailtoLink(buildDiagnostics(input()), "help@example.com")
    expect(href.startsWith("mailto:help@example.com?")).toBe(true)
    expect(decodeURIComponent(href)).toContain("The tab kept pulsing")
  })

  it("does not truncate a short report", () => {
    expect(mailtoLink(buildDiagnostics(input()), "a@b.c").truncated).toBe(false)
  })

  it("truncates and says so when the log is long", () => {
    // Mail clients silently drop an over-long body, so the caller has to know.
    const logs = Array.from({ length: 200 }, (_, i) => line(i))
    const { href, truncated } = mailtoLink(
      buildDiagnostics(input({ logs })),
      "a@b.c",
    )
    expect(truncated).toBe(true)
    expect(decodeURIComponent(href)).toContain("truncated")
  })

  it("keeps the body within the limit once truncated", () => {
    const logs = Array.from({ length: 500 }, (_, i) => line(i))
    const { href } = mailtoLink(buildDiagnostics(input({ logs })), "a@b.c")
    const body = decodeURIComponent(href.split("&body=")[1])
    expect(body.length).toBeLessThan(MAILTO_BODY_LIMIT + 200)
  })
})
