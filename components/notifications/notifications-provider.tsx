"use client"

import * as React from "react"

import type { Notification } from "./NotificationItem"

/**
 * One source of truth for the notification feed.
 *
 * Three surfaces render it — the activity-bar badge, the title-bar bell and
 * the Notifications view — and before this they each held a private copy, so
 * marking everything read in one place left the others showing stale counts.
 */
interface NotificationsContextValue {
  notifications: Notification[]
  unreadCount: number
  markAsRead: (id: number) => void
  markAllAsRead: () => void
  deleteNotification: (id: number) => void
  clearAll: () => void
  /** Lets a run publish into the feed once the backend is wired up. */
  push: (n: Omit<Notification, "id">) => void
}

const NotificationsContext =
  React.createContext<NotificationsContextValue | null>(null)

const SEED: Notification[] = [
  {
    id: 1,
    title: "Upload Complete",
    message: "FASTA file upload completed successfully.",
    time: "2 mins ago",
    read: false,
  },
  {
    id: 2,
    title: "Scan Finished",
    message: "Mutation scan completed.",
    time: "1 hour ago",
    read: true,
  },
  {
    id: 3,
    title: "Mutation Simulation",
    message: "Simulation run completed.",
    time: "3 hours ago",
    read: false,
  },
]

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [notifications, setNotifications] = React.useState<Notification[]>(SEED)
  const nextId = React.useRef(SEED.length + 1)

  const markAsRead = React.useCallback(
    (id: number) =>
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      ),
    [],
  )

  const markAllAsRead = React.useCallback(
    () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))),
    [],
  )

  const deleteNotification = React.useCallback(
    (id: number) => setNotifications((prev) => prev.filter((n) => n.id !== id)),
    [],
  )

  const clearAll = React.useCallback(() => setNotifications([]), [])

  const push = React.useCallback(
    (n: Omit<Notification, "id">) =>
      setNotifications((prev) => [{ ...n, id: nextId.current++ }, ...prev]),
    [],
  )

  const unreadCount = notifications.filter((n) => !n.read).length

  const value = React.useMemo(
    () => ({
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      clearAll,
      push,
    }),
    [
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      clearAll,
      push,
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
