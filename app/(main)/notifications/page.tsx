"use client"

import { useMemo, useState } from "react"
import { Bell, BellOff, CheckCheck, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ToastAction } from "@/components/ui/toast"
import { toast } from "@/hooks/use-toast"
import { useRelativeClock } from "@/lib/activity-store"
import NotificationItem, {
  type Notification,
} from "@/components/notifications/NotificationItem"
import { useNotifications } from "@/components/notifications/notifications-provider"
import {
  Chip,
  ViewScroll,
  EmptyState,
  Pane,
  PaneHeader,
  useStatusItems,
  useViewContext,
  useWorkbench,
} from "@/components/workbench"

type Filter = "all" | "unread"

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    restore,
    snapshot,
  } = useNotifications()
  const { openTab, setPanelTab } = useWorkbench()
  const [filter, setFilter] = useState<Filter>("all")
  const now = useRelativeClock()

  const visible = useMemo(
    () => (filter === "unread" ? notifications.filter((n) => !n.read) : notifications),
    [filter, notifications],
  )

  /**
   * Every destructive action here is undoable.
   *
   * Dismissing and clearing were both silent and irreversible: one click and a
   * list of finished runs was gone with no confirmation, no feedback and no way
   * back. Because the feed is derived from the activity log, undo is just
   * restoring the dismissed set.
   */
  const withUndo = (
    run: () => void,
    title: string,
    description?: string,
  ) => {
    const previous = snapshot()
    run()
    toast({
      title,
      description,
      action: (
        <ToastAction altText="Undo" onClick={() => restore(previous)}>
          Undo
        </ToastAction>
      ),
    })
  }

  const openNotification = (notification: Notification) => {
    if (notification.href) openTab(notification.href)
  }

  useStatusItems(
    useMemo(
      () => [
        {
          id: "unread",
          label: `${unreadCount} unread`,
          title:
            unreadCount > 0
              ? "Unread notifications — the console keeps the full run history"
              : "Everything has been read",
          tone: unreadCount > 0 ? ("info" as const) : ("default" as const),
          onClick: () => setPanelTab("history"),
        },
      ],
      [unreadCount, setPanelTab],
    ),
  )

  useViewContext(
    `${notifications.length} notification${notifications.length === 1 ? "" : "s"} · ${
      unreadCount === 0 ? "all read" : `${unreadCount} unread`
    }`,
  )

  return (
    <ViewScroll>
      <div className="mx-auto max-w-3xl p-3">
        <Pane>
          <PaneHeader
            icon={Bell}
            title="Notifications"
            subtitle={
              unreadCount > 0 ? `${unreadCount} unread` : "you're all caught up"
            }
            actions={
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    withUndo(
                      markAllAsRead,
                      "Marked all as read",
                      `${unreadCount} notification${unreadCount === 1 ? "" : "s"}.`,
                    )
                  }
                  disabled={unreadCount === 0}
                  className="h-6 px-2 text-xs"
                >
                  <CheckCheck className="size-3.5" />
                  Mark all read
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    withUndo(
                      clearAll,
                      "Notifications cleared",
                      `${notifications.length} dismissed. The runs themselves are kept in the console's History tab.`,
                    )
                  }
                  disabled={notifications.length === 0}
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Clear
                </Button>
              </>
            }
          />

          {/* Filter strip, styled like the panel's tab headings. */}
          <div className="flex h-8 shrink-0 items-center gap-4 border-b border-border px-3">
            {(
              [
                ["all", "All", notifications.length],
                ["unread", "Unread", unreadCount],
              ] as const
            ).map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={cn(
                  "relative flex cursor-pointer items-center gap-1.5 text-sm transition-colors duration-100",
                  "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
                  filter === id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground/80",
                )}
              >
                {label}
                {count > 0 && <Chip>{count}</Chip>}
                <span
                  className={cn(
                    "absolute inset-x-0 -bottom-[9px] h-px transition-colors duration-150",
                    filter === id ? "bg-brand" : "bg-transparent",
                  )}
                />
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={BellOff}
              title={
                filter === "unread" ? "Nothing unread" : "No notifications to show"
              }
              description={
                filter === "unread"
                  ? "Every notification in this workspace has been read."
                  : "Finished scans, simulations and predictions land here."
              }
            />
          ) : (
            <div>
              {visible.map((n) => (
                <NotificationItem
                  key={n.id}
                  data={n}
                  now={now}
                  onRead={markAsRead}
                  onDelete={(id) =>
                    withUndo(() => deleteNotification(id), "Notification dismissed")
                  }
                  onOpen={openNotification}
                />
              ))}
            </div>
          )}
        </Pane>
      </div>
    </ViewScroll>
  )
}
