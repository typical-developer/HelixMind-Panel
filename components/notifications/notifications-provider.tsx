"use client"

import * as React from "react"

import { STORAGE_KEYS, readJSON, writeJSON } from "@/lib/storage"
import { useActivity, type ActivityEvent } from "@/lib/activity-store"

import type { Notification } from "./NotificationItem"

/**
 * The notification feed.
 *
 * Two things were wrong with the previous version. It opened with three seeded
 * notifications — "Upload Complete, 2 mins ago" on a workspace that had never
 * uploaded anything — and its `push` method, the only way a real event could
 * ever have entered the feed, was never called by anything. So the feed showed
 * fiction and could not show fact.
 *
 * It is now *derived* from the activity log rather than being a second copy of
 * it. What this provider owns is the small amount of state the log does not:
 * which notifications have been read and which have been dismissed. That makes
 * drift between the Overview's activity list and the bell impossible, because
 * there is only one list.
 */
interface NotificationsContextValue {
  notifications: Notification[]
  unreadCount: number
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  deleteNotification: (id: string) => void
  clearAll: () => void
  /** Put back whatever the last destructive action removed. */
  restore: (snapshot: FeedState) => void
  /** The current read/dismissed sets, for an undo action to capture. */
  snapshot: () => FeedState
}

export interface FeedState {
  read: string[]
  dismissed: string[]
}

const NotificationsContext =
  React.createContext<NotificationsContextValue | null>(null)

/** Activity kinds worth interrupting someone about. */
const NOTIFIABLE = new Set<ActivityEvent["kind"]>([
  "scan.completed",
  "simulation.completed",
  "growth.completed",
  "prediction.completed",
  "threat.detected",
])

/**
 * Keep only ids that still name an event in the log, de-duplicated.
 *
 * The log is capped at 200 events, so an id whose event has aged out is dead
 * weight: it can never match a row again, and it can never be removed by any
 * user action, because the row it referred to is gone.
 */
function prune(ids: string[], events: ActivityEvent[]): string[] {
  const live = new Set(events.map((e) => e.id))
  return Array.from(new Set(ids)).filter((id) => live.has(id))
}

const TITLES: Record<string, string> = {
  "scan.completed": "Scan finished",
  "simulation.completed": "Simulation finished",
  "growth.completed": "Experiment finished",
  "prediction.completed": "Prediction ready",
  "threat.detected": "Resistance detected",
}

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const events = useActivity()
  const [state, setState] = React.useState<FeedState>({ read: [], dismissed: [] })
  const [hydrated, setHydrated] = React.useState(false)

  /**
   * The events this feed is about.
   *
   * Held separately from the mapped rows because the read/dismissed bookkeeping
   * needs the same set, and computing it twice invited the two to drift.
   */
  const notifiable = React.useMemo(
    () => events.filter((event) => NOTIFIABLE.has(event.kind)),
    [events],
  )

  React.useEffect(() => {
    const stored = readJSON<FeedState>(STORAGE_KEYS.notifications, {
      read: [],
      dismissed: [],
    })
    setState({
      read: Array.isArray(stored.read) ? stored.read : [],
      dismissed: Array.isArray(stored.dismissed) ? stored.dismissed : [],
    })
    setHydrated(true)
  }, [])

  React.useEffect(() => {
    if (!hydrated) return
    writeJSON(STORAGE_KEYS.notifications, state)
  }, [state, hydrated])

  /**
   * Drop bookkeeping for events that have aged out of the log.
   *
   * `markAsRead` and `deleteNotification` each add one id, and the log they
   * refer to is capped at 200 events — so without this the two arrays only ever
   * grow, and every entry past the cap is an id that can never match a row
   * again. Guarded on the length so a no-op pass cannot re-enter.
   */
  React.useEffect(() => {
    if (!hydrated) return
    setState((prev) => {
      const read = prune(prev.read, notifiable)
      const dismissed = prune(prev.dismissed, notifiable)
      if (read.length === prev.read.length && dismissed.length === prev.dismissed.length) {
        return prev
      }
      return { read, dismissed }
    })
  }, [hydrated, notifiable])

  const notifications = React.useMemo<Notification[]>(() => {
    const read = new Set(state.read)
    const dismissed = new Set(state.dismissed)
    return notifiable
      .filter((event) => !dismissed.has(event.id))
      .map((event) => ({
        id: event.id,
        title: TITLES[event.kind] ?? "Activity",
        message: event.detail ? `${event.label} — ${event.detail}` : event.label,
        createdAt: event.ts,
        read: read.has(event.id),
        href: event.href,
        severity: event.severity,
      }))
  }, [notifiable, state])

  const unreadCount = React.useMemo(
    () => notifications.reduce((total, n) => total + (n.read ? 0 : 1), 0),
    [notifications],
  )

  const markAsRead = React.useCallback((id: string) => {
    setState((prev) =>
      prev.read.includes(id) ? prev : { ...prev, read: [...prev.read, id] },
    )
  }, [])

  /**
   * Mark everything in the feed as read.
   *
   * Scoped to notifiable events, and pruned against the log.
   *
   * Both of those are fixes. It used to fold in the id of *every* activity
   * event, exports included — ids that can never appear in this feed, so they
   * could never be cleaned up by dismissing a row. And nothing ever removed an
   * id whose event had aged out of the 200-event log. The two together meant
   * these arrays grew without bound and were written back to `localStorage` on
   * every change: a workspace in daily use would accumulate thousands of dead
   * ids, permanently.
   */
  const markAllAsRead = React.useCallback(() => {
    setState((prev) => ({
      ...prev,
      read: prune([...prev.read, ...notifiable.map((e) => e.id)], notifiable),
    }))
  }, [notifiable])

  const deleteNotification = React.useCallback((id: string) => {
    setState((prev) =>
      prev.dismissed.includes(id)
        ? prev
        : { ...prev, dismissed: [...prev.dismissed, id] },
    )
  }, [])

  const clearAll = React.useCallback(() => {
    setState((prev) => ({
      ...prev,
      dismissed: prune(
        [...prev.dismissed, ...notifiable.map((e) => e.id)],
        notifiable,
      ),
    }))
  }, [notifiable])

  const snapshot = React.useCallback(
    () => ({ read: [...state.read], dismissed: [...state.dismissed] }),
    [state],
  )

  const restore = React.useCallback((next: FeedState) => setState(next), [])

  const value = React.useMemo(
    () => ({
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      clearAll,
      restore,
      snapshot,
    }),
    [
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      clearAll,
      restore,
      snapshot,
    ],
  )

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = React.useContext(NotificationsContext)
  if (!ctx) {
    throw new Error(
      "useNotifications must be used inside <NotificationsProvider>",
    )
  }
  return ctx
}
