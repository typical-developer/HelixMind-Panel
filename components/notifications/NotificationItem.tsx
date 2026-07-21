"use client";

import { Trash2, Check, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export type Notification = {
  id: number;
  title: string;
  message: string;
  time: string;
  read: boolean;
};

type Props = {
  data: Notification;
  onRead: (id: number) => void;
  onDelete: (id: number) => void;
};

export default function NotificationItem({ data, onRead, onDelete }: Props) {
  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 border-b border-border/60 p-4 transition-colors last:border-0 hover:bg-white/[0.03]",
        !data.read && "bg-white/[0.02]"
      )}
    >
      {/* Unread accent bar */}
      {!data.read && (
        <span className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
      )}

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
        <Bell className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-foreground">{data.title}</p>
          {!data.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{data.message}</p>
        <p className="mt-1 text-xs text-muted-foreground/70">{data.time}</p>
      </div>

      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {!data.read && (
          <button
            onClick={() => onRead(data.id)}
            aria-label="Mark as read"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
          >
            <Check className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => onDelete(data.id)}
          aria-label="Delete notification"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
