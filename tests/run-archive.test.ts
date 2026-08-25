import { describe, expect, it } from "vitest"

import {
  MAX_RUNS,
  measurePayload,
  newRunId,
  planEviction,
  prepareRun,
  type RunDraft,
  type RunSummary,
} from "@/lib/run-archive"
import { APP_VERSION } from "@/lib/app-info"

/**
 * The archive's rules, tested without a database.
 *
 * The IndexedDB plumbing is verified by driving the running app — jsdom has no
 * IndexedDB and a shim would be testing the shim. What is worth pinning down
 * here is the part that decides which results a workspace keeps, because
 * getting it wrong loses someone's data quietly.
 */

function run(
  id: string,
  endedAt: number,
  bytes: number,
): Pick<RunSummary, "id" | "endedAt" | "bytes"> {
  return { id, endedAt, bytes }
}

describe("measurePayload", () => {
  it("counts UTF-16 code units as two bytes, matching the storage meter", () => {
    // `"ab"` serialises to `"ab"` — four characters including the quotes.
    expect(measurePayload("ab")).toBe(8)
  })

  it("measures null rather than throwing on an absent payload", () => {
    expect(measurePayload(undefined)).toBe(measurePayload(null))
  })

  it("returns zero for a payload that cannot be serialised", () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(measurePayload(cyclic)).toBe(0)
  })
})

describe("planEviction", () => {
  it("keeps everything while under both ceilings", () => {
    const runs = [run("a", 3, 10), run("b", 2, 10), run("c", 1, 10)]
    expect(planEviction(runs, { maxRuns: 10, maxBytes: 1000 })).toEqual([])
  })

  it("drops the oldest first when over the count", () => {
    const runs = [run("new", 3, 1), run("mid", 2, 1), run("old", 1, 1)]
    expect(planEviction(runs, { maxRuns: 2, maxBytes: 1000 })).toEqual(["old"])
  })

  it("drops the oldest first when over the byte budget", () => {
    const runs = [run("new", 3, 60), run("mid", 2, 60), run("old", 1, 60)]
    // 60 fits; 120 does not.
    expect(planEviction(runs, { maxRuns: 100, maxBytes: 100 })).toEqual([
      "mid",
      "old",
    ])
  })

  it("never evicts the newest run, even if it alone blows the budget", () => {
    const runs = [run("huge", 2, 5000), run("old", 1, 1)]
    const doomed = planEviction(runs, { maxRuns: 100, maxBytes: 100 })
    expect(doomed).not.toContain("huge")
    expect(doomed).toContain("old")
  })

  it("orders by time, not by the order it was handed", () => {
    const runs = [run("old", 1, 1), run("new", 3, 1), run("mid", 2, 1)]
    expect(planEviction(runs, { maxRuns: 1, maxBytes: 1000 })).toEqual([
      "mid",
      "old",
    ])
  })

  it("defaults to the shipped ceilings", () => {
    const many = Array.from({ length: MAX_RUNS + 3 }, (_, i) =>
      run(`r${i}`, i, 1),
    )
    expect(planEviction(many)).toHaveLength(3)
  })
})

describe("newRunId", () => {
  it("is unique across calls in the same millisecond", () => {
    const ids = new Set([newRunId(1000), newRunId(1000), newRunId(1000)])
    expect(ids.size).toBe(3)
  })

  it("is safe to put in a URL path segment", () => {
    expect(newRunId()).toMatch(/^[a-z0-9-]+$/)
  })
})

describe("prepareRun", () => {
  const draft: RunDraft = {
    engine: "simulator",
    label: "Simulation · 10 generations",
    startedAt: 1000,
    endedAt: 2000,
    outcome: "completed",
    href: "/mutation-simulator",
    inputs: { file: "isolate.fasta" },
    params: { numGenerations: 10 },
    seed: 42,
    summary: { generations: 10 },
    payload: { generationStats: [1, 2, 3] },
  }

  it("stamps the build that produced the result", () => {
    // A record with no build behind it cannot be reproduced later.
    expect(prepareRun(draft).appVersion).toBe(APP_VERSION)
  })

  it("keeps the seed, which is what makes the run repeatable", () => {
    expect(prepareRun(draft).seed).toBe(42)
  })

  it("sizes the payload so eviction never has to re-measure", () => {
    expect(prepareRun(draft).bytes).toBe(measurePayload(draft.payload))
  })

  it("does not disturb what the caller passed", () => {
    const prepared = prepareRun(draft)
    expect(prepared.params).toEqual(draft.params)
    expect(prepared.inputs).toEqual(draft.inputs)
    expect(prepared.summary).toEqual(draft.summary)
  })
})
