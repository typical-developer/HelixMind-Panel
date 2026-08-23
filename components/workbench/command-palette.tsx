"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ChevronRight,
  Database,
  Eye,
  Files,
  LayoutGrid,
  LogOut,
  Maximize2,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PlayCircle,
  RotateCcw,
  Search,
  Terminal,
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
import { TONE_CLASS, VIEWS } from "./registry"

/**
 * Ctrl/Cmd+K (or Ctrl+P) command palette. Every navigation target and layout
 * toggle in the workbench is reachable from here, which is what makes the
 * customisation options discoverable rather than hidden in menus.
 */
export function CommandPalette() {
  const wb = useWorkbench()
  const router = useRouter()
  const { signOut } = useAuth()

  const [query, setQuery] = React.useState("")

  // VS Code's convention: a leading `>` switches from "go to file" to
  // "run a command". Ctrl+Shift+P opens straight into it by seeding the `>`.
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
      label: "Toggle side bar",
      shortcut: "Ctrl B",
      action: wb.toggleSidebar,
    },
    {
      icon: PanelBottom,
      label: "Toggle panel",
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
      label: "Toggle editor tabs",
      action: wb.toggleTabBar,
    },
    {
      icon: LayoutGrid,
      label: "Toggle breadcrumbs",
      action: wb.toggleBreadcrumbs,
    },
    {
      icon: LayoutGrid,
      label: "Toggle status bar",
      action: wb.toggleStatusBar,
    },
    {
      icon: Eye,
      label: "Toggle zen mode",
      shortcut: "Esc to exit",
      action: wb.toggleZen,
    },
    {
      icon: Maximize2,
      label: "Maximize panel",
      action: wb.togglePanelMaximized,
    },
  ]

  const sideViews = [
    { icon: Files, label: "Show explorer", action: () => wb.setActivity("explorer") },
    { icon: Search, label: "Show search", action: () => wb.setActivity("search") },
    {
      icon: PlayCircle,
      label: "Show run & analyze",
      action: () => wb.setActivity("run"),
    },
    {
      icon: Database,
      label: "Show gene database",
      action: () => wb.setActivity("database"),
    },
  ]

  const panels = [
    {
      icon: AlertCircle,
      label: "Panel: Problems",
      action: () => wb.setPanelTab("problems"),
    },
    {
      icon: Terminal,
      label: "Panel: Output",
      action: () => wb.setPanelTab("output"),
    },
    {
      icon: Terminal,
      label: "Panel: Terminal",
      shortcut: "Ctrl `",
      action: () => wb.setPanelTab("terminal"),
    },
    { icon: Trash2, label: "Clear terminal output", action: wb.clearLogs },
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
            ? "Run a workbench command…"
            : "Search views, or type > to run a command…"
        }
      />

      {commandMode && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
          <span className="rounded-xs bg-[var(--wb-active)] px-1.5 py-0.5 font-mono text-2xs tracking-wide text-foreground/80 uppercase">
            commands
          </span>
          <span className="text-xs text-muted-foreground">
            Clear the <span className="font-mono text-foreground/70">&gt;</span> to
            search views again
          </span>
        </div>
      )}

      <CommandList className="max-h-[min(60vh,26rem)]">
        <CommandEmpty>
          {commandMode
            ? `No command matches "${term.trim()}".`
            : `No view matches "${term.trim()}".`}
        </CommandEmpty>

        {!commandMode && !term.trim() && (
          <CommandGroup heading="Modes">
            <CommandItem
              value="show all commands workbench"
              onSelect={() => setQuery(">")}
            >
              <ChevronRight />
              Show all commands
              <CommandShortcut>Ctrl Shift P</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        )}

        {!commandMode && (
          <CommandGroup heading="Go to view">
            {VIEWS.map((v) => (
              <CommandItem
                key={v.href}
                value={`${v.label} ${v.fileName} ${v.hint}`}
                onSelect={() => run(() => wb.openTab(v.href))}
              >
                <v.icon className={TONE_CLASS[v.tone]} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{v.label}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {v.hint}
                  </span>
                </span>
                <CommandShortcut className="font-mono">{v.fileName}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!commandMode && <CommandSeparator />}

        <CommandGroup heading="Side bar">
          {sideViews.map((c) => (
            <CommandItem key={c.label} onSelect={() => run(c.action)}>
              <c.icon />
              {c.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Panel">
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
            Zoom in
            <CommandShortcut>Ctrl Alt +</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(wb.zoomOut)}>
            <Type />
            Zoom out
            <CommandShortcut>Ctrl Alt -</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(wb.zoomReset)}>
            <Type />
            Reset zoom
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
