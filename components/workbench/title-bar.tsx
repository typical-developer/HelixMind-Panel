"use client"

import * as React from "react"
import Image from "next/image"
import { ChevronDown, LayoutGrid, PanelBottom, PanelLeft, PanelRight, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import NotificationBell from "@/components/notifications/NotificationBell"

import { ToolbarButton } from "./primitives"
import { useWorkbench } from "./workbench-provider"

/**
 * The 36px title bar: the lab mark, a search field that opens the command
 * palette, and the layout controls.
 *
 * There is deliberately no menu bar. It used to carry Lab / Go / Layout menus,
 * and every single item in them existed somewhere else — "Go" repeated the
 * sidebar tree and the palette verbatim, "Lab" repeated the tree plus the
 * account menu, and "Layout" repeated the Customize control immediately to its
 * right. Three menus, nothing of their own.
 */
export function TitleBar() {
  const wb = useWorkbench()

  return (
    <header className="relative z-20 flex h-9 shrink-0 items-center gap-1 border-b border-border bg-chrome pr-1.5 pl-2.5">
      <div className="flex shrink-0 items-center gap-2">
        <Image
          src="/logo_white.png"
          alt=""
          width={16}
          height={16}
          className="size-4 shrink-0"
          unoptimized
        />
        <span className="hidden text-sm font-medium text-foreground/85 sm:inline">
          HelixMind
        </span>
      </div>

      <QuickInput />

      <div className="flex shrink-0 items-center gap-0.5">
        <NotificationBell />
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          icon={PanelLeft}
          label="Toggle sidebar (Ctrl+B)"
          active={wb.sidebarVisible}
          onClick={wb.toggleSidebar}
        />
        <ToolbarButton
          icon={PanelBottom}
          label="Toggle console (Ctrl+J)"
          active={wb.panelVisible}
          onClick={wb.togglePanel}
        />
        <ToolbarButton
          icon={PanelRight}
          label="Toggle inspector (Ctrl+Alt+B)"
          active={wb.inspectorVisible}
          onClick={wb.toggleInspector}
        />
        <CustomizeLayoutMenu />
      </div>
    </header>
  )
}

/* ============================================================================
   Search field
   ========================================================================= */

function QuickInput() {
  const { openPalette } = useWorkbench()

  return (
    <div className="flex min-w-0 flex-1 justify-center px-2">
      <button
        type="button"
        onClick={() => openPalette()}
        className={cn(
          "group flex h-6 w-full max-w-md min-w-0 cursor-pointer items-center gap-2 rounded-sm border border-border bg-surface px-2",
          "text-xs text-muted-foreground transition-colors duration-100",
          "hover:border-[var(--wb-border-strong)] hover:bg-raised hover:text-foreground/80",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none",
        )}
      >
        <Search className="size-3 shrink-0" />
        <span className="truncate">Search analyses, genes and commands</span>
        <kbd className="ml-auto hidden shrink-0 rounded-xs border border-border px-1 font-mono text-2xs text-muted-foreground/80 sm:inline">
          Ctrl K
        </kbd>
      </button>
    </div>
  )
}

/* ============================================================================
   Customize layout
   ========================================================================= */

function CustomizeLayoutMenu() {
  const wb = useWorkbench()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Customize layout"
          className="inline-flex h-6 cursor-pointer items-center gap-0.5 rounded-sm px-1 text-muted-foreground transition-colors hover:bg-[var(--wb-hover)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
        >
          <LayoutGrid className="size-3.5" />
          <ChevronDown className="size-2.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Show</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={wb.sidebarVisible}
          onCheckedChange={wb.toggleSidebar}
        >
          Sidebar
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={wb.panelVisible}
          onCheckedChange={wb.togglePanel}
        >
          Console
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={wb.inspectorVisible}
          onCheckedChange={wb.toggleInspector}
        >
          Inspector
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={wb.tabBarVisible}
          onCheckedChange={wb.toggleTabBar}
        >
          Open tabs
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={wb.breadcrumbsVisible}
          onCheckedChange={wb.toggleBreadcrumbs}
        >
          Breadcrumbs
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={wb.statusBarVisible}
          onCheckedChange={wb.toggleStatusBar}
        >
          Status bar
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={wb.focusMode}
          onCheckedChange={wb.toggleFocusMode}
        >
          Focus mode
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
