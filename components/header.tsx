"use client";

import { Search, User, Settings, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NotificationBell from "@/components/notifications/NotificationBell";

// shadcn
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";

export function Header({ title }: { title: string }) {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/signin");
  };

  return (
    <header className="fixed left-16 right-0 top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/70 px-6 backdrop-blur-xl lg:px-8">
      <div className="flex min-w-0 flex-col">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
          HelixMind
        </span>
        <h1 className="truncate text-lg font-semibold leading-tight tracking-tight text-foreground lg:text-xl">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="group relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground" />
          <input
            type="text"
            placeholder="Search sequences..."
            className="h-10 w-56 rounded-lg border border-border bg-card/60 pl-9 pr-12 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-ring focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring/40 lg:w-72"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground lg:flex">
            ⌘K
          </kbd>
        </div>

        <div className="mx-1 hidden h-6 w-px bg-border md:block" />

        {/* Notifications */}
        <NotificationBell />

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Account menu"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground ring-1 ring-white/10 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring/50"
            >
              {user?.name?.charAt(0).toUpperCase() ?? (
                <User className="h-4 w-4" />
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="truncate text-sm font-medium">
                {user?.name ?? "Guest"}
              </span>
              <span className="truncate text-xs font-normal text-muted-foreground">
                {user?.email ?? "Not signed in"}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
