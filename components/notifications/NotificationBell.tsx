"use client"

import Link from "next/link"
import { ArrowUpRight, Bell } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Chip } from "@/components/workbench"

import NotificationItem from "./NotificationItem"
import { useNotifications } from "./notifications-provider"

/**
 * Title-bar bell. Opens a compact notification centre — the same rows the
 * Notifications view uses, at popover density.
 */
export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, deleteNotification } =
    useNotifications()

  return (
    <Popover>
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
            <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-brand ring-2 ring-chrome" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={6} className="w-88 overflow-hidden p-0">
        <div className="flex h-8 items-center gap-2 border-b border-border px-3">
          <h3 className="text-xs font-medium tracking-wide text-foreground/90 uppercase">
            Notifications
          </h3>
          {unreadCount > 0 && (
            <Chip tone="info" className="ml-auto">
              {unreadCount} new
            </Chip>
          )}
        </div>

        <div className="seq-scroll max-h-72 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">
              No notifications yet
            </p>
          ) : (
            notifications.map((n) => (
              <NotificationItem
                key={n.id}
                data={n}
                onRead={markAsRead}
                onDelete={deleteNotification}
                compact
              />
            ))
          )}
        </div>

        <div className="border-t border-border p-1">
          <Link
            href="/notifications"
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
