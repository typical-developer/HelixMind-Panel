"use client";

import { useState } from "react";
import { Bell, CheckCheck, Trash2, BellOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import NotificationItem, { Notification } from "@/components/notifications/NotificationItem";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([
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
  ]);

  const markAsRead = (id: number) =>
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  const deleteNotification = (id: number) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  const markAllAsRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  const clearAll = () => setNotifications([]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="ml-16 pt-16">
      <main className="mx-auto min-h-screen max-w-3xl px-6 pt-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Notifications</h2>
              <p className="text-sm text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0}>
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
              disabled={notifications.length === 0}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Clear all
            </Button>
          </div>
        </div>

        {/* List */}
        <div className="glass overflow-hidden p-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <BellOff className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No notifications to show</p>
            </div>
          ) : (
            <ScrollArea className="h-[68vh]">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  data={n}
                  onRead={markAsRead}
                  onDelete={deleteNotification}
                />
              ))}
            </ScrollArea>
          )}
        </div>
      </main>
    </div>
  );
}
