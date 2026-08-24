/**
 * Guarded `localStorage` access.
 *
 * Every persisted feature in the panel goes through here rather than touching
 * `window.localStorage` directly, for three reasons:
 *
 *  - It is read during render in places (`useSyncExternalStore`'s snapshot),
 *    which includes the server render, where `localStorage` does not exist.
 *  - Safari in private mode throws on `setItem` once the quota is reached, and
 *    a thrown quota error inside a state updater takes the whole view down.
 *  - Keys are versioned. A shape change ships a new suffix rather than trying
 *    to migrate whatever an earlier build happened to write.
 */

/** Every key the panel persists, in one place so nothing collides. */
export const STORAGE_KEYS = {
  /** Workbench layout: visible regions, sizes, open tabs. */
  layout: "helixmind.workbench.v2",
  /** The event log behind the Overview, notifications and history. */
  activity: "helixmind.activity.v1",
  /** Results of the most recent scan and prediction, for the Overview's panes. */
  snapshot: "helixmind.snapshot.v1",
  /** Finished runs, so the console's History tab survives a reload. */
  runHistory: "helixmind.runs.v1",
  /** The tail of the run log, for the same reason. */
  runLog: "helixmind.runlog.v1",
  /** Notification feed. */
  notifications: "helixmind.notifications.v1",
  /** Preferences owned by the Settings view. */
  preferences: "helixmind.preferences.v1",
  /** Recently chosen command-palette entries. */
  paletteRecents: "helixmind.palette.recents.v1",
  /** Auth token. Owned by `api/main.ts`; named here so "delete all" can find it. */
  token: "Helix_user_token",
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

/** Keys wiped by Settings → Danger zone → Delete all data. */
export const CLEARABLE_KEYS: StorageKey[] = [
  STORAGE_KEYS.layout,
  STORAGE_KEYS.activity,
  STORAGE_KEYS.snapshot,
  STORAGE_KEYS.runHistory,
  STORAGE_KEYS.runLog,
  STORAGE_KEYS.notifications,
  STORAGE_KEYS.preferences,
  STORAGE_KEYS.paletteRecents,
]

export function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as T
    return parsed ?? fallback
  } catch {
    // Corrupt JSON, or storage blocked entirely. Either way the caller gets a
    // usable value instead of an exception mid-render.
    return fallback
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    // Quota exceeded or private-mode restriction. Persistence is a convenience
    // here, never a correctness requirement, so this degrades silently.
    return false
  }
}

export function removeKey(key: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* Nothing useful to do. */
  }
}

/** Clear everything the panel owns, leaving other origins' keys untouched. */
export function clearWorkspace(): void {
  for (const key of CLEARABLE_KEYS) removeKey(key)
}

/**
 * Roughly how many bytes the panel is using.
 *
 * `navigator.storage.estimate()` reports the whole origin including caches and
 * IndexedDB, which is not what the workspace pane is asking about, so this
 * measures only the keys we wrote. UTF-16 code units are counted as 2 bytes,
 * which is what browsers actually bill against the quota.
 */
export function measureUsage(): { bytes: number; keys: number } {
  if (typeof window === "undefined") return { bytes: 0, keys: 0 }
  let bytes = 0
  let keys = 0
  for (const key of CLEARABLE_KEYS) {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw === null) continue
      bytes += (raw.length + key.length) * 2
      keys += 1
    } catch {
      /* Skip anything unreadable. */
    }
  }
  return { bytes, keys }
}

/** `1.4 KB`, `2.3 MB` — sized for a status readout, not a file manager. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
