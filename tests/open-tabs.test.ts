import { describe, expect, it } from "vitest"

import { movedHref, normalizeOpenTabs } from "@/lib/open-tabs"

const KNOWN = [
  "/dashboard",
  "/dna-scanner",
  "/mutation-simulator",
  "/settings",
]
const HOME = "/dashboard"

describe("normalizeOpenTabs", () => {
  it("keeps a healthy list in the order it was saved", () => {
    const saved = ["/settings", "/dashboard", "/dna-scanner"]
    expect(normalizeOpenTabs(saved, KNOWN, HOME)).toEqual(saved)
  })

  it("drops hrefs that no longer name a view", () => {
    expect(
      normalizeOpenTabs(["/dashboard", "/retired-view", "/settings"], KNOWN, HOME),
    ).toEqual(["/dashboard", "/settings"])
  })

  it("collapses repeats, keeping the first position", () => {
    // What an older build left behind before query strings were stripped from
    // tab ids. Two tabs sharing a React key render as twins, and closing one
    // closes the other.
    expect(
      normalizeOpenTabs(
        ["/dashboard", "/settings", "/dashboard", "/settings"],
        KNOWN,
        HOME,
      ),
    ).toEqual(["/dashboard", "/settings"])
  })

  it("falls back to the home view rather than leaving the strip empty", () => {
    // `openTabs: []` is what the previous "close all" persisted, so this is
    // sitting in real browsers today.
    expect(normalizeOpenTabs([], KNOWN, HOME)).toEqual([HOME])
  })

  it("falls back when nothing saved is still a known view", () => {
    expect(normalizeOpenTabs(["/gone", "/also-gone"], KNOWN, HOME)).toEqual([HOME])
  })
})

describe("movedHref", () => {
  it("reports nothing when the order is unchanged", () => {
    expect(movedHref(["a", "b", "c"], ["a", "b", "c"])).toBeNull()
  })

  it("reports nothing for lists of different lengths", () => {
    // A close is not a move, and the announcement must not claim otherwise.
    expect(movedHref(["a", "b", "c"], ["a", "c"])).toBeNull()
  })

  it("finds a tab dragged to the front", () => {
    expect(movedHref(["a", "b", "c", "d"], ["d", "a", "b", "c"])).toBe("d")
  })

  it("finds a tab dragged to the end", () => {
    expect(movedHref(["a", "b", "c", "d"], ["b", "c", "d", "a"])).toBe("a")
  })

  it("finds a one-step move, as Alt+Shift+Arrow makes", () => {
    expect(movedHref(["a", "b", "c"], ["b", "a", "c"])).toBe("a")
    expect(movedHref(["a", "b", "c"], ["a", "c", "b"])).toBe("b")
  })

  it("handles a two-item strip", () => {
    expect(movedHref(["a", "b"], ["b", "a"])).toBe("a")
    expect(movedHref(["a"], ["a"])).toBeNull()
  })
})
