"use client";

import { useState } from "react";
import { Check, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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

  const markAsRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const deleteNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
    <div className=" ml-16 pt-16">
    <main className="p-8 bg-background min-h-screen">
      <div className="  mx-auto">

        <div className="flex gap-2 mb-4">
          <Button onClick={markAllAsRead} disabled={unreadCount === 0}>
            Mark all as read
          </Button>
          <Button variant="destructive" onClick={clearAll} disabled={notifications.length === 0}>
            Clear all
          </Button>
        </div>

        <ScrollArea className="h-[70vh] border border-border rounded-lg">
          {notifications.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No notifications to show
            </p>
          ) : (
            notifications.map((n) => (
              <NotificationItem
                key={n.id}
                data={n}
                onRead={markAsRead}
                onDelete={deleteNotification}
              />
            ))
          )}
        </ScrollArea>
      </div>
    </main>
    </div>
    </>
  );
}
