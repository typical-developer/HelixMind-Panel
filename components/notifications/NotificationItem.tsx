"use client"

import { AlertTriangle, Bell, Check, CheckCircle2, Info, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatRelative, type ActivitySeverity } from "@/lib/activity-store"

export type Notification = {
  /** The activity event's id — the feed is derived, so ids come from there. */
  id: string
  title: string
  message: string
  /**
   * Epoch milliseconds.
   *
   * This used to be a literal string ("2 mins ago"), which meant the age never
   * changed and was already wrong the moment the page loaded. A timestamp can
   * be sorted and re-formatted; a sentence cannot.
   */
  createdAt: number
  read: boolean
  href?: string
  severity: ActivitySeverity
}

type Props = {
  data: Notification
  onRead: (id: string) => void
  onDelete: (id: string) => void
  /** Follow the notification through to whatever raised it. */
  onOpen?: (notification: Notification) => void
  /** Compact rows are used inside the title-bar popover. */
  compact?: boolean
  /** Passed down so every visible row re-formats on the same tick. */
  now?: number
}

const GLYPH: Record<ActivitySeverity, { Icon: typeof Bell; className: string }> = {
  success: { Icon: CheckCircle2, className: "text-success" },
  danger: { Icon: AlertTriangle, className: "text-destructive" },
  warning: { Icon: AlertTriangle, className: "text-warning" },
  info: { Icon: Info, className: "text-info" },
}

export default function NotificationItem({
  data,
  onRead,
  onDelete,
  onOpen,
  compact,
  now,
}: Props) {
  // Severity comes from the event that raised it. It used to be guessed from
  // whether the title happened to contain the word "complete" or "fail".
  const { Icon, className } = GLYPH[data.severity] ?? {
    Icon: Bell,
    className: "text-muted-foreground",
  }

  const interactive = Boolean(onOpen && data.href)

  const body = (
    <>
      <Icon className={cn("mt-0.5 size-3.5 shrink-0", className)} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p
            className={cn(
              "truncate text-sm",
              data.read ? "text-foreground/80" : "font-medium text-foreground",
            )}
          >
            {data.title}
          </p>
          {!data.read && <span className="size-1.5 shrink-0 rounded-full bg-brand" />}
          <span className="ml-auto shrink-0 pl-2 font-mono text-xs text-muted-foreground/70">
            {formatRelative(data.createdAt, now)}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {data.message}
        </p>
      </div>
    </>
  )

  return (
    <div
      className={cn(
        "group relative flex items-start gap-2.5 border-b border-border/60 transition-colors duration-100 last:border-0",
        "hover:bg-[var(--wb-hover)]",
        compact ? "px-3 py-2" : "px-3 py-2.5",
        !data.read && "bg-[var(--wb-hover)]",
      )}
    >
      {/* Unread accent bar, matching the sidebar's active-item rail. */}
      {!data.read && (
        <span className="absolute top-1/2 left-0 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-brand" />
      )}

      {interactive ? (
        <button
          type="button"
          onClick={() => {
            onRead(data.id)
            onOpen?.(data)
          }}
          // The row is padded to leave the action buttons clear, so clicking
          // "mark as read" cannot also navigate away from the list.
          className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 pr-12 text-left focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-2.5 pr-12">{body}</div>
      )}

      <div className="absolute top-2 right-3 flex shrink-0 gap-0.5 opacity-0 transition-opacity duration-100 group-hover:opacity-100 focus-within:opacity-100">
        {!data.read && (
          <button
            type="button"
            onClick={() => onRead(data.id)}
            aria-label="Mark as read"
            title="Mark as read"
            className="flex size-6 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-[var(--wb-active)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
          >
            <Check className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(data.id)}
          aria-label="Dismiss notification"
          title="Dismiss"
          className="flex size-6 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
