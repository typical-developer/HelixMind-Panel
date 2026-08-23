"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Bell,
  Database,
  Files,
  LogOut,
  PlayCircle,
  Search,
  Settings,
  User,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { useNotifications } from "@/components/notifications/notifications-provider"

import { useWorkbench, type ActivityId } from "./workbench-provider"

interface ActivityItem {
  id: ActivityId
  icon: LucideIcon
  label: string
  chord?: string
  /** Items that navigate instead of swapping the side-bar view. */
  href?: string
}

const PRIMARY: ActivityItem[] = [
  { id: "explorer", icon: Files, label: "Explorer" },
  { id: "search", icon: Search, label: "Search" },
  { id: "run", icon: PlayCircle, label: "Run & Analyze" },
  { id: "database", icon: Database, label: "Gene Database" },
]

/**
 * The 48px icon rail on the far left. Selecting an icon swaps the side bar's
 * contents; selecting the already-active icon collapses the side bar, which is
 * the behaviour VS Code users reach for without thinking.
 */
export function ActivityBar() {
  const { activity, sidebarVisible, setActivity, unreadCount } = useActivityState()

  return (
    <nav
      aria-label="Primary"
      className="flex w-12 shrink-0 flex-col items-center border-r border-border bg-chrome py-1"
    >
      {PRIMARY.map((item) => (
        <ActivityButton
          key={item.id}
          item={item}
          active={activity === item.id && sidebarVisible}
          onClick={() => setActivity(item.id)}
        />
      ))}

      <div className="flex-1" />

      <NotificationsButton count={unreadCount} />
      <AccountButton />
      <SettingsButton />
    </nav>
  )
}

function useActivityState() {
  const { activity, sidebarVisible, setActivity } = useWorkbench()
  const { unreadCount } = useNotifications()
  return { activity, sidebarVisible, setActivity, unreadCount }
}

function ActivityButton({
  item,
  active,
  onClick,
}: {
  item: ActivityItem
  active: boolean
  onClick: () => void
}) {
  const Icon = item.icon

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={item.label}
          aria-current={active ? "true" : undefined}
          className={cn(
            "relative flex size-12 shrink-0 cursor-pointer items-center justify-center",
            "text-muted-foreground transition-colors duration-100",
            "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset",
            active && "text-foreground",
          )}
        >
          {/* Active indicator — grows out from the centre so switching views
              reads as a slide rather than a jump. */}
          <span
            className={cn(
              "absolute top-1/2 left-0 w-0.5 -translate-y-1/2 rounded-r-full bg-brand transition-all duration-200 ease-[var(--ease-out-quint)]",
              active ? "h-7 opacity-100" : "h-0 opacity-0",
            )}
          />
          <Icon className="size-5 transition-transform duration-150 active:scale-90" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={6} className="flex items-center gap-2">
        {item.label}
        {item.chord && (
          <span className="font-mono text-2xs text-muted-foreground">{item.chord}</span>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

function NotificationsButton({ count }: { count: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="relative flex size-12 shrink-0 items-center justify-center text-muted-foreground transition-colors duration-100 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset"
        >
          <Bell className="size-5" />
          {count > 0 && (
            <span className="absolute top-2.5 right-2.5 flex size-4 items-center justify-center rounded-full bg-brand text-2xs font-semibold text-white tabular">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={6}>
        Notifications
      </TooltipContent>
    </Tooltip>
  )
}

function AccountButton() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const initial = user?.name?.charAt(0).toUpperCase() ?? "G"

  const handleSignOut = async () => {
    await signOut()
    router.push("/signin")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account"
          className="flex size-12 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset"
        >
          <span className="flex size-6 items-center justify-center rounded-full border border-border bg-raised text-xs font-semibold text-foreground">
            {user ? initial : <User className="size-3.5" />}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{user?.name ?? "Guest"}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {user?.email ?? "Not signed in"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings" className="cursor-pointer gap-2">
            <Settings className="size-3.5" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="size-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SettingsButton() {
  const { setActivity, activity, sidebarVisible } = useWorkbench()
  const active = activity === "settings" && sidebarVisible

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => setActivity("settings")}
          aria-label="Manage"
          className={cn(
            "relative flex size-12 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset",
            active && "text-foreground",
          )}
        >
          <span
            className={cn(
              "absolute top-1/2 left-0 w-0.5 -translate-y-1/2 rounded-r-full bg-brand transition-all duration-200 ease-[var(--ease-out-quint)]",
              active ? "h-7 opacity-100" : "h-0 opacity-0",
            )}
          />
          <Settings className="size-5 transition-transform duration-300 hover:rotate-45" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={6}>
        Manage
      </TooltipContent>
    </Tooltip>
  )
}
