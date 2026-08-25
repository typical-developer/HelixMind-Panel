"use client"

import * as React from "react"
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
 * Rows the popover draws before deferring to the full view.
 *
 * It used to render every notification into a 288px scroller — two hundred
 * rows of DOM behind a box that shows four, rebuilt every time the bell was
 * opened, and with no indication that the list continued past the fold.
 */
const POPOVER_ROWS = 8

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
          {/* Keyed on the count, so the badge is placed when the first
              notification arrives *and* re-placed each time the number moves.
              A scale-from-0.85 rather than a rise: it is a 14px circle, and
              3px of vertical travel on something that small reads as a
              wobble. */}
          {unreadCount > 0 && (
            <span
              key={unreadCount}
              className={cn(
                "animate-pop-in absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full",
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
            notifications.slice(0, POPOVER_ROWS).map((n) => (
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

        {/* Both go through `openTab` rather than a bare `<Link>`. Navigating
            with a link left the open-tab set to be backfilled by the provider's
            pathname effect after the route had already changed, so the strip
            caught up a beat late; every other route into these views registers
            the tab as it navigates. Closing first, then pushing on the next
            microtask, for the reason given on the rows above. */}
        <div className="border-t border-border p-1">
          <PopoverLink
            label={
              notifications.length > POPOVER_ROWS
                ? `View all ${notifications.length} notifications`
                : "View all notifications"
            }
            onClick={() => {
              setOpen(false)
              queueMicrotask(() => openTab("/notifications"))
            }}
          />
          <PopoverLink
            label="Activity and past runs"
            onClick={() => {
              setOpen(false)
              queueMicrotask(() => openTab("/activity"))
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function PopoverLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="row-hover flex w-full cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
    >
      {label}
      <ArrowUpRight className="ml-auto size-3 shrink-0" />
    </button>
  )
}
