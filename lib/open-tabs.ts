/**
 * Pure helpers for the workbench's open-tab list.
 *
 * They live here rather than inside the provider because both guard states that
 * are awkward to reach by hand — a layout persisted by an older build, and a
 * reorder that has to be described to a screen reader — and the suite already
 * covers this kind of function directly. See `tests/open-tabs.test.ts`.
 *
 * Neither takes the view registry: passing the known hrefs in keeps these free
 * of the icon imports `components/workbench/registry.tsx` carries.
 */

/**
 * Reduce a stored open-tab list to what the strip can actually render: known
 * routes, no repeats, never empty.
 *
 * Each rule answers a real state. Unknown hrefs are what a renamed or removed
 * route leaves behind. Repeats are what an older build wrote before query
 * strings were stripped from tab ids — and two tabs sharing a React key render
 * as twins where closing one closes the other. An empty list is what the
 * previous "close all" persisted, and the bench always has a view on screen, so
 * an empty strip would describe something untrue.
 */
export function normalizeOpenTabs(
  hrefs: readonly string[],
  known: readonly string[],
  fallback: string,
): string[] {
  const kept = [...new Set(hrefs)].filter((href) => known.includes(href))
  return kept.length > 0 ? kept : [fallback]
}

/**
 * Which entry moved between two orderings of the same set, or null if the order
 * is unchanged.
 *
 * A reorder is a single splice, so the entry that moved is the one whose
 * removal leaves the two lists identical. Quadratic, over a handful of strings
 * — and it means a reorder can be reported from the resulting order alone,
 * rather than by threading "what just happened" through every gesture that can
 * cause one. The drag and the keyboard chord live in different components.
 *
 * `prefer` settles the one case the order genuinely cannot: swapping two
 * neighbours. `[A, B, C] → [A, C, B]` is equally "B moved right" and "C moved
 * left", and the caller knows which — it is the tab that was dragged, or the
 * one the chord was aimed at. Announcing the wrong one of the pair is worse
 * than saying nothing, because the listener moved the *other* tab.
 */
export function movedHref(
  before: readonly string[],
  after: readonly string[],
  prefer?: string | null,
): string | null {
  if (before.length !== after.length) return null

  const moved = (href: string) => {
    const a = before.filter((h) => h !== href)
    const b = after.filter((h) => h !== href)
    if (a.length !== b.length || !a.every((h, i) => h === b[i])) return false
    // Every candidate satisfies the test when nothing moved, so the position
    // has the final say. If an entry sits at the same index in both lists and
    // removing it leaves them identical, the lists are identical.
    return before.indexOf(href) !== after.indexOf(href)
  }

  if (prefer && before.includes(prefer) && moved(prefer)) return prefer

  for (const href of before) {
    if (moved(href)) return href
  }

  return null
}
