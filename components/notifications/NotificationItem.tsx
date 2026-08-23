"use client"

import { AlertTriangle, Bell, Check, CheckCircle2, Info, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"

export type Notification = {
  id: number
  title: string
  message: string
  time: string
  read: boolean
}

type Props = {
  data: Notification
  onRead: (id: number) => void
  onDelete: (id: number) => void
  /** Compact rows are used inside the title-bar popover. */
  compact?: boolean
}

/**
 * Picks an icon from the notification's wording so the list scans like a log
 * rather than a wall of identical bells.
 */
function glyphFor(title: string) {
  const t = title.toLowerCase()
  if (t.includes("complete") || t.includes("finished"))
    return { Icon: CheckCircle2, className: "text-success" }
  if (t.includes("fail") || t.includes("error") || t.includes("alert"))
    return { Icon: AlertTriangle, className: "text-destructive" }
  if (t.includes("simulation") || t.includes("scan"))
    return { Icon: Info, className: "text-brand-bright" }
  return { Icon: Bell, className: "text-muted-foreground" }
}

export default function NotificationItem({
  data,
  onRead,
  onDelete,
  compact,
}: Props) {
  const { Icon, className } = glyphFor(data.title)

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
          {!data.read && (
            <span className="size-1.5 shrink-0 rounded-full bg-brand" />
          )}
          <span className="ml-auto shrink-0 pl-2 font-mono text-xs text-muted-foreground/70">
            {data.time}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {data.message}
        </p>
      </div>

      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity duration-100 group-hover:opacity-100 focus-within:opacity-100">
        {!data.read && (
          <button
            type="button"
            onClick={() => onRead(data.id)}
            aria-label="Mark as read"
            className="flex size-6 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-[var(--wb-active)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
          >
            <Check className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(data.id)}
          aria-label="Delete notification"
          className="flex size-6 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
