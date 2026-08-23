"use client"

import { useMemo, useState } from "react"
import { Bell, BellOff, CheckCheck, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import NotificationItem from "@/components/notifications/NotificationItem"
import { useNotifications } from "@/components/notifications/notifications-provider"
import {
  Chip,
  EditorScroll,
  EmptyState,
  Pane,
  PaneHeader,
  useStatusItems,
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
  } = useNotifications()
  const [filter, setFilter] = useState<Filter>("all")

  const visible = useMemo(
    () => (filter === "unread" ? notifications.filter((n) => !n.read) : notifications),
    [filter, notifications],
  )

  useStatusItems(
    useMemo(
      () => [
        {
          id: "unread",
          label: `${unreadCount} unread`,
          tone: unreadCount > 0 ? ("info" as const) : ("default" as const),
        },
      ],
      [unreadCount],
    ),
  )

  return (
    <EditorScroll>
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
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                  className="h-6 px-2 text-xs"
                >
                  <CheckCheck className="size-3.5" />
                  Mark all read
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
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
                  "relative flex cursor-pointer items-center gap-1.5 text-xs font-medium tracking-wide uppercase transition-colors duration-100",
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
                  : "Activity from scans, uploads and simulation runs lands here."
              }
            />
          ) : (
            <div>
              {visible.map((n) => (
                <NotificationItem
                  key={n.id}
                  data={n}
                  onRead={markAsRead}
                  onDelete={deleteNotification}
                />
              ))}
            </div>
          )}
        </Pane>
      </div>
    </EditorScroll>
  )
}
