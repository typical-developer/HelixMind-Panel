"use client"

import * as React from "react"
import Link from "next/link"
import {
  Dna,
  LogOut,
  Microscope,
  PlayCircle,
  Settings,
  User,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
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

import { HelpMenu } from "@/components/support/help-menu"

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
  { id: "analyses", icon: Microscope, label: "Analyses" },
  { id: "runs", icon: PlayCircle, label: "Runs" },
  { id: "genes", icon: Dna, label: "Gene library" },
]

/**
 * The 48px rail on the far left — the lab's four working modes. Selecting one
 * swaps what the sidebar shows; selecting the mode you are already in collapses
 * the sidebar and hands the width back to the bench.
 */
export function ActivityBar() {
  const { activity, sidebarVisible, setActivity } = useWorkbench()

  return (
    <nav
      aria-label="Lab modes"
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

      <HelpMenu />
      <AccountButton />
      <PreferencesButton />
    </nav>
  )
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


function AccountButton() {
  const { user, signOut } = useAuth()
  const initial = user?.name?.charAt(0).toUpperCase() ?? "G"

  // Navigation belongs to `signOut` now — every call site used to push
  // `/signin` itself, so the two had to be kept in step by hand.
  const handleSignOut = () => {
    signOut()
    toast({ title: "Signed out", description: "Your workspace stays on this device." })
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

function PreferencesButton() {
  const { setActivity, activity, sidebarVisible } = useWorkbench()
  const active = activity === "preferences" && sidebarVisible

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => setActivity("preferences")}
          aria-label="Preferences"
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
          <Settings className="size-5 transition-transform duration-150 active:scale-90" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={6}>
        Preferences
      </TooltipContent>
    </Tooltip>
  )
}
