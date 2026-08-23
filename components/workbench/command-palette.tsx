"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ChevronRight,
  Dna,
  Eye,
  History,
  LayoutGrid,
  LogOut,
  Maximize2,
  Microscope,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PlayCircle,
  RotateCcw,
  ScrollText,
  Search,
  Trash2,
  Type,
} from "lucide-react"

import { useAuth } from "@/contexts/AuthContext"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"

import { useWorkbench } from "./workbench-provider"
import { TONE_CLASS, VIEWS, groupLabel } from "./registry"

/**
 * Ctrl/Cmd+K (or Ctrl+P) command palette. Every analysis and every layout
 * control is reachable from here, which is what keeps them discoverable rather
 * than buried in menus.
 */
export function CommandPalette() {
  const wb = useWorkbench()
  const router = useRouter()
  const { signOut } = useAuth()

  const [query, setQuery] = React.useState("")

  // A leading `>` switches from "go to an analysis" to "run a command".
  // Ctrl+Shift+P opens straight into it by seeding the `>`.
  const commandMode = query.startsWith(">")
  const term = commandMode ? query.slice(1) : query

  // Re-seed on open so Ctrl+K and Ctrl+Shift+P land in the right mode, and a
  // stale query from last time never lingers.
  React.useEffect(() => {
    if (wb.paletteOpen) setQuery(wb.paletteSeed)
  }, [wb.paletteOpen, wb.paletteSeed])

  // cmdk scores against the raw input, so the `>` has to be stripped before
  // matching or every command would have to literally contain it.
  const filter = React.useCallback(
    (value: string, search: string) => {
      const needle = (search.startsWith(">") ? search.slice(1) : search)
        .trim()
        .toLowerCase()
      if (!needle) return 1
      return value.toLowerCase().includes(needle) ? 1 : 0
    },
    [],
  )

  const run = React.useCallback(
    (action: () => void) => {
      wb.setPaletteOpen(false)
      // Let the dialog's close animation start before the view swaps under it.
      queueMicrotask(action)
    },
    [wb],
  )

  const toggles = [
    {
      icon: PanelLeft,
      label: "Toggle sidebar",
      shortcut: "Ctrl B",
      action: wb.toggleSidebar,
    },
    {
      icon: PanelBottom,
      label: "Toggle console",
      shortcut: "Ctrl J",
      action: wb.togglePanel,
    },
    {
      icon: PanelRight,
      label: "Toggle inspector",
      shortcut: "Ctrl Alt B",
      action: wb.toggleInspector,
    },
    {
      icon: LayoutGrid,
      label: "Toggle open tabs",
      action: wb.toggleTabBar,
    },
    {
      icon: LayoutGrid,
      label: "Toggle context bar",
      action: wb.toggleContextBar,
    },
    {
      icon: LayoutGrid,
      label: "Toggle status bar",
      action: wb.toggleStatusBar,
    },
    {
      icon: Eye,
      label: "Toggle focus mode",
      shortcut: "Esc to exit",
      action: wb.toggleFocusMode,
    },
    {
      icon: Maximize2,
      label: "Maximize console",
      action: wb.togglePanelMaximized,
    },
  ]

  const sideViews = [
    {
      icon: Microscope,
      label: "Sidebar: Analyses",
      action: () => wb.setActivity("analyses"),
    },
    { icon: Search, label: "Sidebar: Search", action: () => wb.setActivity("search") },
    {
      icon: PlayCircle,
      label: "Sidebar: Runs",
      action: () => wb.setActivity("runs"),
    },
    {
      icon: Dna,
      label: "Sidebar: Gene library",
      action: () => wb.setActivity("genes"),
    },
  ]

  const panels = [
    {
      icon: AlertCircle,
      label: "Console: Alerts",
      action: () => wb.setPanelTab("alerts"),
    },
    {
      icon: ScrollText,
      label: "Console: Run log",
      shortcut: "Ctrl `",
      action: () => wb.setPanelTab("log"),
    },
    {
      icon: History,
      label: "Console: History",
      action: () => wb.setPanelTab("history"),
    },
    { icon: Trash2, label: "Clear run log", action: wb.clearLogs },
    { icon: Trash2, label: "Clear run history", action: wb.clearRunHistory },
  ]

  return (
    <CommandDialog
      open={wb.paletteOpen}
      onOpenChange={wb.setPaletteOpen}
      showCloseButton={false}
      className="top-[18%] max-w-2xl translate-y-0 gap-0 border-border bg-popover p-0 shadow-[var(--shadow-modal)]"
      title="Command palette"
      description="Jump to a view or run a workbench command"
      commandProps={{ filter, shouldFilter: true }}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={
          commandMode
            ? "Run a command…"
            : "Search analyses, or type > to run a command…"
        }
      />

      {commandMode && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
          <span className="rounded-xs bg-[var(--wb-active)] px-1.5 py-0.5 font-mono text-2xs tracking-wide text-foreground/80 uppercase">
            commands
          </span>
          <span className="text-xs text-muted-foreground">
            Clear the <span className="font-mono text-foreground/70">&gt;</span> to
            search analyses again
          </span>
        </div>
      )}

      <CommandList className="max-h-[min(60vh,26rem)]">
        <CommandEmpty>
          {commandMode
            ? `No command matches "${term.trim()}".`
            : `No analysis matches "${term.trim()}".`}
        </CommandEmpty>

        {!commandMode && !term.trim() && (
          <CommandGroup heading="Modes">
            <CommandItem value="show all commands" onSelect={() => setQuery(">")}>
              <ChevronRight />
              Show all commands
              <CommandShortcut>Ctrl Shift P</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        )}

        {!commandMode && (
          <CommandGroup heading="Go to">
            {VIEWS.map((v) => (
              <CommandItem
                key={v.href}
                value={`${v.label} ${v.hint}`}
                onSelect={() => run(() => wb.openTab(v.href))}
              >
                <v.icon className={TONE_CLASS[v.tone]} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{v.label}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {v.hint}
                  </span>
                </span>
                <CommandShortcut>{groupLabel(v)}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!commandMode && <CommandSeparator />}

        <CommandGroup heading="Sidebar">
          {sideViews.map((c) => (
            <CommandItem key={c.label} onSelect={() => run(c.action)}>
              <c.icon />
              {c.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Console">
          {panels.map((c) => (
            <CommandItem key={c.label} onSelect={() => run(c.action)}>
              <c.icon />
              {c.label}
              {c.shortcut && <CommandShortcut>{c.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Layout">
          {toggles.map((c) => (
            <CommandItem key={c.label} onSelect={() => run(c.action)}>
              <c.icon />
              {c.label}
              {c.shortcut && <CommandShortcut>{c.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
          <CommandItem onSelect={() => run(wb.resetLayout)}>
            <RotateCcw />
            Reset layout to defaults
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Appearance">
          <CommandItem onSelect={() => run(wb.zoomIn)}>
            <Type />
            Larger interface
            <CommandShortcut>Ctrl Alt +</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(wb.zoomOut)}>
            <Type />
            Smaller interface
            <CommandShortcut>Ctrl Alt -</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(wb.zoomReset)}>
            <Type />
            Reset interface scale
            <CommandShortcut>Ctrl Alt 0</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Account">
          <CommandItem
            onSelect={() =>
              run(async () => {
                await signOut()
                router.push("/signin")
              })
            }
          >
            <LogOut />
            Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
