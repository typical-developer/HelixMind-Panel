"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight, Bell, CheckCheck } from "lucide-react"

import { cn } from "@/lib/utils"
import { useRelativeClock } from "@/lib/activity-store"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Chip, useWorkbench } from "@/components/workbench"

import NotificationItem from "./NotificationItem"
import { useNotifications } from "./notifications-provider"

/**
 * Title-bar bell. Opens a compact notification centre — the same rows the
 * Notifications view uses, at popover density.
 */
export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } =
    useNotifications()
  const { openTab } = useWorkbench()
  const [open, setOpen] = React.useState(false)
  const now = useRelativeClock()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
          className={cn(
            "relative inline-flex size-6 cursor-pointer items-center justify-center rounded-sm",
            "text-muted-foreground transition-colors duration-100",
            "hover:bg-[var(--wb-hover)] hover:text-foreground",
            "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
          )}
        >
          <Bell className="size-3.5" />
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full",
                "bg-brand px-0.5 text-[9px] font-semibold text-brand-foreground ring-2 ring-chrome tabular",
              )}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={6} className="w-88 overflow-hidden p-0">
        <div className="flex h-9 items-center gap-2 border-b border-border pr-1.5 pl-3">
          <h3 className="text-sm font-medium text-foreground/90">Notifications</h3>
          {unreadCount > 0 && <Chip tone="info">{unreadCount} new</Chip>}
          {/* Clearing the badge is the reason most people open this, so it does
              not require a trip to the full view first. */}
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className={cn(
              "ml-auto flex cursor-pointer items-center gap-1 rounded-sm px-1.5 py-1 text-xs",
              "text-muted-foreground transition-colors hover:bg-[var(--wb-hover)] hover:text-foreground",
              "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            <CheckCheck className="size-3.5" />
            Mark all read
          </button>
        </div>

        <div className="seq-scroll max-h-72 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs leading-relaxed text-muted-foreground">
              No notifications yet.
              <br />
              Finished scans and simulations appear here.
            </p>
          ) : (
            notifications.map((n) => (
              <NotificationItem
                key={n.id}
                data={n}
                now={now}
                onRead={markAsRead}
                onDelete={deleteNotification}
                onOpen={(notification) => {
                  if (!notification.href) return
                  // Close first, then navigate on the next microtask.
                  // Doing both synchronously has the router re-render the tree
                  // while Radix is still tearing the popover down, which React
                  // reports as a setState during another component's render.
                  setOpen(false)
                  queueMicrotask(() => openTab(notification.href!))
                }}
                compact
              />
            ))
          )}
        </div>

        <div className="border-t border-border p-1">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="row-hover flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            View all notifications
            <ArrowUpRight className="ml-auto size-3" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
