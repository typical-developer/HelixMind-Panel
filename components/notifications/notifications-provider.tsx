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

  const notifications = React.useMemo<Notification[]>(() => {
    const read = new Set(state.read)
    const dismissed = new Set(state.dismissed)
    return events
      .filter((event) => NOTIFIABLE.has(event.kind) && !dismissed.has(event.id))
      .map((event) => ({
        id: event.id,
        title: TITLES[event.kind] ?? "Activity",
        message: event.detail ? `${event.label} — ${event.detail}` : event.label,
        createdAt: event.ts,
        read: read.has(event.id),
        href: event.href,
        severity: event.severity,
      }))
  }, [events, state])

  const unreadCount = React.useMemo(
    () => notifications.reduce((total, n) => total + (n.read ? 0 : 1), 0),
    [notifications],
  )

  const markAsRead = React.useCallback((id: string) => {
    setState((prev) =>
      prev.read.includes(id) ? prev : { ...prev, read: [...prev.read, id] },
    )
  }, [])

  const markAllAsRead = React.useCallback(() => {
    setState((prev) => ({
      ...prev,
      read: Array.from(new Set([...prev.read, ...events.map((e) => e.id)])),
    }))
  }, [events])

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
      dismissed: Array.from(
        new Set([...prev.dismissed, ...events.map((e) => e.id)]),
      ),
    }))
  }, [events])

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
