/**
 * Preferences the Settings view owns.
 *
 * "Save changes" used to set a flag that flipped the button's label to "Saved"
 * for two seconds and did nothing else — the notification toggles were plain
 * `useState`, so every preference was gone on reload. These persist, and the
 * things that read them actually read them.
 */
import * as React from "react"

import { STORAGE_KEYS, readJSON, writeJSON } from "./storage"

export interface Preferences {
  /** Show a toast when a run finishes or an upload is rejected. */
  inAppNotifications: boolean
  /**
   * Email updates.
   *
   * KNOWN GAP — there is no endpoint behind this. It is stored so the choice
   * survives, and the row says plainly that it is not connected yet rather
   * than implying mail is being sent. See docs/BUG-REPORT.md.
   */
  emailNotifications: boolean
  /** Ask before clearing history, dismissing all alerts, or deleting data. */
  confirmDestructive: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  inAppNotifications: true,
  emailNotifications: false,
  confirmDestructive: true,
}

let current: Preferences = DEFAULT_PREFERENCES
let hydrated = false
const listeners = new Set<() => void>()

function hydrate() {
  if (hydrated || typeof window === "undefined") return
  hydrated = true
  const stored = readJSON<Partial<Preferences>>(STORAGE_KEYS.preferences, {})
  current = { ...DEFAULT_PREFERENCES, ...stored }
}

export function getPreferences(): Preferences {
  hydrate()
  return current
}

export function setPreferences(next: Partial<Preferences>): Preferences {
  hydrate()
  current = { ...current, ...next }
  writeJSON(STORAGE_KEYS.preferences, current)
  for (const listener of listeners) listener()
  return current
}

export function resetPreferences() {
  current = DEFAULT_PREFERENCES
  writeJSON(STORAGE_KEYS.preferences, current)
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  hydrate()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function usePreferences(): Preferences {
  return React.useSyncExternalStore(
    subscribe,
    getPreferences,
    () => DEFAULT_PREFERENCES,
  )
}
