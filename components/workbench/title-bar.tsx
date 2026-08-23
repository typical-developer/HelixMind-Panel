"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  ChevronDown,
  LayoutGrid,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Search,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar"
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
import { VIEWS } from "./registry"

/**
 * The 36px title bar: menus on the left, a search field in the middle that
 * opens the command palette, and layout controls on the right. Deliberately
 * not a page header — the open analysis names itself in the tab and the
 * context bar directly below.
 */
export function TitleBar() {
  const wb = useWorkbench()

  return (
    <header className="relative z-20 flex h-9 shrink-0 items-center gap-1 border-b border-border bg-chrome pr-1.5 pl-2">
      <div className="flex shrink-0 items-center gap-2">
        <Image
          src="/logo_white.png"
          alt=""
          width={16}
          height={16}
          className="size-4 shrink-0"
          unoptimized
        />
        <WorkbenchMenus />
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
   Menu bar
   ========================================================================= */

function WorkbenchMenus() {
  const wb = useWorkbench()
  const router = useRouter()
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    router.push("/signin")
  }

  return (
    <Menubar className="h-auto gap-0 border-0 bg-transparent p-0 shadow-none">
      <MenubarMenu>
        <MenubarTrigger className={MENU_TRIGGER}>Lab</MenubarTrigger>
        <MenubarContent align="start" className="w-60">
          <MenubarItem onClick={() => wb.openTab("/dna-scanner")}>
            New DNA scan
          </MenubarItem>
          <MenubarItem onClick={() => wb.openTab("/mutation-simulator")}>
            New mutation simulation
          </MenubarItem>
          <MenubarItem onClick={() => wb.openTab("/microbe-growth-lab")}>
            New growth experiment
          </MenubarItem>
          <MenubarItem
            onClick={() => wb.openTab("/amr-analysis-engine/resistance-predictor")}
          >
            New resistance prediction
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={() => wb.openTab("/settings")}>
            Settings
            <MenubarShortcut>Ctrl ,</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={handleSignOut} variant="destructive">
            Sign out
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className={MENU_TRIGGER}>Go</MenubarTrigger>
        <MenubarContent align="start" className="w-64">
          <MenubarItem onClick={() => wb.openPalette()}>
            Go to analysis
            <MenubarShortcut>Ctrl K</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={() => wb.openPalette(">")}>
            Run a command
            <MenubarShortcut>Ctrl Shift P</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          {VIEWS.map((v) => (
            <MenubarItem key={v.href} onClick={() => wb.openTab(v.href)}>
              <v.icon className="size-3.5" />
              {v.label}
              {v.chord && <MenubarShortcut>Ctrl {v.chord}</MenubarShortcut>}
            </MenubarItem>
          ))}
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className={MENU_TRIGGER}>Layout</MenubarTrigger>
        <MenubarContent align="start" className="w-64">
          <MenubarSub>
            <MenubarSubTrigger>Sidebar</MenubarSubTrigger>
            <MenubarSubContent className="w-56">
              <MenubarItem onClick={() => wb.setActivity("analyses")}>
                Analyses
              </MenubarItem>
              <MenubarItem onClick={() => wb.setActivity("search")}>Search</MenubarItem>
              <MenubarItem onClick={() => wb.setActivity("runs")}>Runs</MenubarItem>
              <MenubarItem onClick={() => wb.setActivity("genes")}>
                Gene library
              </MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSub>
            <MenubarSubTrigger>Console</MenubarSubTrigger>
            <MenubarSubContent className="w-56">
              <MenubarItem onClick={() => wb.setPanelTab("alerts")}>Alerts</MenubarItem>
              <MenubarItem onClick={() => wb.setPanelTab("log")}>
                Run log
                <MenubarShortcut>Ctrl `</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={() => wb.setPanelTab("history")}>
                History
              </MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarCheckboxItem
            checked={wb.sidebarVisible}
            onCheckedChange={wb.toggleSidebar}
          >
            Sidebar
            <MenubarShortcut>Ctrl B</MenubarShortcut>
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={wb.panelVisible}
            onCheckedChange={wb.togglePanel}
          >
            Console
            <MenubarShortcut>Ctrl J</MenubarShortcut>
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={wb.inspectorVisible}
            onCheckedChange={wb.toggleInspector}
          >
            Inspector
            <MenubarShortcut>Ctrl Alt B</MenubarShortcut>
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={wb.tabBarVisible}
            onCheckedChange={wb.toggleTabBar}
          >
            Open tabs
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={wb.contextBarVisible}
            onCheckedChange={wb.toggleContextBar}
          >
            Context bar
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={wb.statusBarVisible}
            onCheckedChange={wb.toggleStatusBar}
          >
            Status bar
          </MenubarCheckboxItem>
          <MenubarSeparator />
          <MenubarCheckboxItem
            checked={wb.focusMode}
            onCheckedChange={wb.toggleFocusMode}
          >
            Focus mode
            <MenubarShortcut>Esc</MenubarShortcut>
          </MenubarCheckboxItem>
          <MenubarSeparator />
          <MenubarItem onClick={wb.zoomIn}>
            Larger
            <MenubarShortcut>Ctrl Alt +</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={wb.zoomOut}>
            Smaller
            <MenubarShortcut>Ctrl Alt -</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={wb.zoomReset}>
            Reset scale
            <MenubarShortcut>Ctrl Alt 0</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  )
}

const MENU_TRIGGER =
  "h-6 cursor-pointer rounded-sm px-2 text-xs font-normal text-muted-foreground data-[state=open]:bg-[var(--wb-active)] data-[state=open]:text-foreground hover:bg-[var(--wb-hover)] hover:text-foreground focus:bg-[var(--wb-hover)] focus:text-foreground"

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
          checked={wb.contextBarVisible}
          onCheckedChange={wb.toggleContextBar}
        >
          Context bar
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
