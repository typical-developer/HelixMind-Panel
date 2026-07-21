"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Zap,
  Shuffle,
  Microscope,
  Settings,
  Beaker,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Logo from "./ui/Logo";
import { useAuth } from "@/contexts/AuthContext";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dna-scanner", icon: Zap, label: "DNA Scanner" },
  { href: "/mutation-simulator", icon: Shuffle, label: "Mutation Simulator" },
  { href: "/microbe-growth-lab", icon: Beaker, label: "Microbe Lab" },
  { href: "/amr-analysis-engine", icon: Microscope, label: "AMR Analysis Engine" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const { user } = useAuth();

  // Reveal labels a beat after the panel starts widening so text doesn't
  // squash during the transition.
  useEffect(() => {
    if (!expanded) {
      setShowLabels(false);
      return;
    }
    const timer = setTimeout(() => setShowLabels(true), 120);
    return () => clearTimeout(timer);
  }, [expanded]);

  const initial = user?.name?.charAt(0).toUpperCase() ?? "G";

  return (
    <>
      {/* Dim + blur the app when the drawer is open */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          expanded ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setExpanded(false)}
      />

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col bg-sidebar",
          "border-r border-sidebar-border shadow-[0_0_40px_-10px_rgba(0,0,0,0.6)]",
          "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          expanded ? "w-64" : "w-16"
        )}
      >
        {/* Floating expand / collapse toggle — always visible on the edge */}
        <button
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          className={cn(
            "absolute -right-3 top-[68px] z-50 flex h-6 w-6 items-center justify-center rounded-full",
            "border border-border bg-card text-muted-foreground shadow-md",
            "transition-all duration-200 hover:scale-110 hover:bg-accent hover:text-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring/50"
          )}
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-300",
              expanded && "rotate-180"
            )}
          />
        </button>

        {/* Brand */}
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-sidebar-border/70",
            expanded ? "px-4" : "justify-center px-3"
          )}
        >
          {showLabels ? (
            <div className="animate-in fade-in slide-in-from-left-2 duration-200 text-sm font-semibold">
              <Logo />
            </div>
          ) : (
            <img src="/logo_white.png" alt="HelixMind" className="h-7 w-7" />
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {showLabels && (
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              Menu
            </p>
          )}

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

            const link = (
              <Link
                href={item.href}
                title={!expanded ? item.label : undefined}
                className={cn(
                  "group relative flex h-10 items-center rounded-lg text-sm font-medium transition-colors",
                  expanded ? "gap-3 px-3" : "justify-center",
                  isActive
                    ? "bg-white/[0.08] text-foreground"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                )}
              >
                {/* Active indicator bar */}
                <span
                  className={cn(
                    "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-all duration-300",
                    isActive ? "opacity-100" : "opacity-0"
                  )}
                />
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110",
                    isActive ? "text-foreground" : ""
                  )}
                />
                {showLabels && <span className="truncate">{item.label}</span>}
              </Link>
            );

            return expanded ? (
              <div key={item.href}>{link}</div>
            ) : (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Profile */}
        <div className="shrink-0 border-t border-sidebar-border/70 p-3">
          <Link
            href="/settings"
            className={cn(
              "flex items-center rounded-lg transition-colors hover:bg-white/5",
              expanded ? "gap-3 p-2" : "justify-center p-1"
            )}
          >
            <div className="relative shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground ring-1 ring-white/10">
                {initial}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-emerald-400" />
            </div>
            {showLabels && (
              <div className="min-w-0 flex-1 animate-in fade-in slide-in-from-left-2 duration-200">
                <p className="truncate text-sm font-medium text-foreground">
                  {user?.name ?? "Guest"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.email ?? "Not signed in"}
                </p>
              </div>
            )}
          </Link>
        </div>
      </aside>
    </>
  );
}
