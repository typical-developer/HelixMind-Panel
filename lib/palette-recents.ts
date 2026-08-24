/**
 * What the operator opened last.
 *
 * The palette listed every analysis in registry order every time it opened, so
 * the thing you use twenty times a day sat wherever the registry happened to
 * put it. Recents put it first.
 *
 * Only navigations are remembered. A recently-run *command* is rarely the one
 * you want next — "clear run log" at the top of the list would be a trap — but
 * a recently-opened analysis or gene almost always is.
 */
import { STORAGE_KEYS, readJSON, writeJSON } from "./storage"

export type PaletteRecent =
  | { type: "view"; href: string }
  | { type: "gene"; gene: string }

/** Enough to be useful, few enough that the list stays scannable. */
export const MAX_RECENTS = 6

function key(entry: PaletteRecent): string {
  return entry.type === "view" ? `view:${entry.href}` : `gene:${entry.gene}`
}

export function readRecents(): PaletteRecent[] {
  const stored = readJSON<PaletteRecent[]>(STORAGE_KEYS.paletteRecents, [])
  if (!Array.isArray(stored)) return []
  return stored
    .filter(
      (entry): entry is PaletteRecent =>
        Boolean(entry) &&
        ((entry.type === "view" && typeof entry.href === "string") ||
          (entry.type === "gene" && typeof entry.gene === "string")),
    )
    .slice(0, MAX_RECENTS)
}

/** Most recent first, no duplicates. */
export function pushRecent(entry: PaletteRecent): PaletteRecent[] {
  const existing = readRecents().filter((item) => key(item) !== key(entry))
  const next = [entry, ...existing].slice(0, MAX_RECENTS)
  writeJSON(STORAGE_KEYS.paletteRecents, next)
  return next
}
