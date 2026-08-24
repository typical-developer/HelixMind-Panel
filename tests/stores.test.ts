import { beforeEach, describe, expect, it } from "vitest"

import {
  clearActivity,
  engineReports,
  formatRelative,
  recordActivity,
  summarise,
  type ActivityEvent,
} from "@/lib/activity-store"
import {
  CLEARABLE_KEYS,
  STORAGE_KEYS,
  clearWorkspace,
  formatBytes,
  measureUsage,
  readJSON,
  writeJSON,
} from "@/lib/storage"
import { safeFilename, fileStamp, toCSV } from "@/lib/download"

beforeEach(() => {
  clearActivity()
})

describe("storage", () => {
  it("round-trips JSON", () => {
    writeJSON("test-key", { a: 1, b: ["x"] })
    expect(readJSON("test-key", null)).toEqual({ a: 1, b: ["x"] })
  })

  it("falls back when the key is missing", () => {
    expect(readJSON("absent", "fallback")).toBe("fallback")
  })

  it("falls back on corrupt JSON rather than throwing", () => {
    window.localStorage.setItem("broken", "{not json")
    expect(readJSON("broken", "fallback")).toBe("fallback")
  })

  it("clears only the keys the panel owns", () => {
    for (const key of CLEARABLE_KEYS) writeJSON(key, { value: 1 })
    window.localStorage.setItem("someone-elses-key", "keep me")

    clearWorkspace()

    for (const key of CLEARABLE_KEYS) {
      expect(window.localStorage.getItem(key)).toBeNull()
    }
    expect(window.localStorage.getItem("someone-elses-key")).toBe("keep me")
  })

  it("does not clear the auth token", () => {
    // Signing the user out is a separate, explicit action.
    expect(CLEARABLE_KEYS).not.toContain(STORAGE_KEYS.token)
  })

  it("measures only what it wrote", () => {
    expect(measureUsage().keys).toBe(0)
    writeJSON(STORAGE_KEYS.activity, [{ a: 1 }])
    const usage = measureUsage()
    expect(usage.keys).toBe(1)
    expect(usage.bytes).toBeGreaterThan(0)
  })

  it("formats byte counts", () => {
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(2048)).toBe("2.0 KB")
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB")
  })
})

describe("activity store", () => {
  it("records an event and reads it back", () => {
    const event = recordActivity({
      kind: "scan.completed",
      engine: "scanner",
      label: "sample.fasta scanned",
      severity: "success",
      value: 3,
    })
    expect(event.id).toBeTruthy()
    expect(event.ts).toBeGreaterThan(0)
    expect(readJSON<ActivityEvent[]>(STORAGE_KEYS.activity, [])).toHaveLength(1)
  })

  it("gives every event a distinct id", () => {
    const ids = new Set<string>()
    for (let i = 0; i < 50; i++) {
      ids.add(
        recordActivity({
          kind: "scan.completed",
          engine: "scanner",
          label: `run ${i}`,
          severity: "info",
        }).id,
      )
    }
    expect(ids.size).toBe(50)
  })

  it("survives a reload", () => {
    recordActivity({
      kind: "simulation.completed",
      engine: "simulator",
      label: "run",
      severity: "success",
    })
    const stored = readJSON<ActivityEvent[]>(STORAGE_KEYS.activity, [])
    expect(stored[0].label).toBe("run")
  })

  it("caps the log", () => {
    for (let i = 0; i < 260; i++) {
      recordActivity({
        kind: "scan.completed",
        engine: "scanner",
        label: `run ${i}`,
        severity: "info",
      })
    }
    expect(readJSON<ActivityEvent[]>(STORAGE_KEYS.activity, [])).toHaveLength(200)
  })

  it("keeps the newest event first", () => {
    recordActivity({
      kind: "scan.completed",
      engine: "scanner",
      label: "older",
      severity: "info",
    })
    recordActivity({
      kind: "scan.completed",
      engine: "scanner",
      label: "newer",
      severity: "info",
    })
    expect(readJSON<ActivityEvent[]>(STORAGE_KEYS.activity, [])[0].label).toBe(
      "newer",
    )
  })
})

describe("activity selectors", () => {
  const make = (partial: Partial<ActivityEvent>): ActivityEvent => ({
    id: Math.random().toString(36),
    kind: "scan.completed",
    engine: "scanner",
    ts: Date.now(),
    label: "x",
    severity: "info",
    ...partial,
  })

  it("starts at zero for a new workspace", () => {
    const summary = summarise([])
    expect(summary.sequencesAnalysed).toBe(0)
    expect(summary.runsCompleted).toBe(0)
    expect(summary.threatCount).toBe(0)
    expect(summary.lastActivityAt).toBeNull()
  })

  it("sums sequences across scans", () => {
    const summary = summarise([
      make({ kind: "scan.completed", value: 3 }),
      make({ kind: "scan.completed", value: 5 }),
    ])
    expect(summary.sequencesAnalysed).toBe(8)
    expect(summary.runsCompleted).toBe(2)
  })

  it("counts every engine's completions as runs", () => {
    const summary = summarise([
      make({ kind: "scan.completed", engine: "scanner" }),
      make({ kind: "simulation.completed", engine: "simulator" }),
      make({ kind: "growth.completed", engine: "growth" }),
      make({ kind: "prediction.completed", engine: "amr" }),
    ])
    expect(summary.runsCompleted).toBe(4)
  })

  it("counts threats and exports separately from runs", () => {
    const summary = summarise([
      make({ kind: "threat.detected", engine: "amr", value: 2 }),
      make({ kind: "export.created", engine: "amr" }),
    ])
    expect(summary.threatCount).toBe(2)
    expect(summary.exportCount).toBe(1)
    expect(summary.runsCompleted).toBe(0)
  })

  it("reports an engine as idle until it has run", () => {
    const reports = engineReports([])
    expect(reports).toHaveLength(4)
    expect(reports.every((r) => r.state === "idle")).toBe(true)
    expect(reports.every((r) => r.lastRunAt === null)).toBe(true)
  })

  it("reports an engine as operational once it has run", () => {
    const reports = engineReports([make({ engine: "scanner" })])
    const scanner = reports.find((r) => r.id === "scanner")
    expect(scanner?.state).toBe("operational")
    expect(scanner?.runs).toBe(1)
    expect(reports.find((r) => r.id === "amr")?.state).toBe("idle")
  })

  it("does not count an export as a run", () => {
    const reports = engineReports([
      make({ kind: "export.created", engine: "scanner" }),
    ])
    expect(reports.find((r) => r.id === "scanner")?.state).toBe("idle")
  })
})

describe("formatRelative", () => {
  const now = 1_700_000_000_000

  it("describes recent times", () => {
    expect(formatRelative(now, now)).toBe("just now")
    expect(formatRelative(now - 5 * 60_000, now)).toBe("5m ago")
    expect(formatRelative(now - 3 * 3_600_000, now)).toBe("3h ago")
  })

  it("describes days", () => {
    expect(formatRelative(now - 24 * 3_600_000, now)).toBe("yesterday")
    expect(formatRelative(now - 3 * 24 * 3_600_000, now)).toBe("3d ago")
  })

  it("does not report a negative age for a clock skew", () => {
    expect(formatRelative(now + 60_000, now)).toBe("just now")
  })
})

describe("download helpers", () => {
  it("strips characters that are illegal in filenames", () => {
    expect(safeFilename("NZ_CP166085.1 chromosome, complete")).toBe(
      "NZ_CP166085.1-chromosome-complete",
    )
    expect(safeFilename("a/b\\c:d*e?f")).toBe("a-b-c-d-e-f")
  })

  it("falls back when nothing usable is left", () => {
    expect(safeFilename("///")).toBe("helixmind-export")
  })

  it("does not produce a leading dot", () => {
    expect(safeFilename("...hidden")).toBe("hidden")
  })

  it("stamps a sortable date", () => {
    expect(fileStamp(new Date(2026, 7, 24, 14, 32))).toBe("20260824-1432")
  })

  it("quotes CSV values containing separators", () => {
    const csv = toCSV(
      ["gene", "mechanism"],
      [["mecA", "PBP2a, altered"]],
    )
    expect(csv).toContain('"PBP2a, altered"')
    expect(csv.split("\r\n")).toHaveLength(2)
  })

  it("escapes embedded quotes", () => {
    expect(toCSV(["a"], [['say "hi"']])).toContain('"say ""hi"""')
  })
})
