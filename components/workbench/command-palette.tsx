"use client"

import * as React from "react"
import {
  AlertCircle,
  Bug,
  ChevronRight,
  Clock,
  CornerUpLeft,
  Dna,
  Eye,
  History,
  Info,
  Keyboard,
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
  Trash2,
  Type,
  X,
  XSquare,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "@/hooks/use-toast"
import { AMR_BY_GENE, searchRecords } from "@/lib/amr-records"
import {
  MAX_RECENTS,
  pushRecent,
  readRecents,
  type PaletteRecent,
} from "@/lib/palette-recents"
import { useSupport } from "@/components/support/support-provider"
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

import { useConsoleActions, useWorkbench } from "./workbench-provider"
import { VIEWS, groupLabel } from "./registry"

const GENE_LIBRARY = "/amr-analysis-engine/gene-database"

/** The prefixes that switch what the palette is searching. */
const MODES = [
  { prefix: ">", label: "commands", hint: "run a workbench command" },
  { prefix: "@", label: "genes", hint: "search the gene library" },
  { prefix: "?", label: "help", hint: "shortcuts, support and about" },
] as const

type ModePrefix = (typeof MODES)[number]["prefix"]

function modeFor(query: string): ModePrefix | null {
  const prefix = query.charAt(0)
  return MODES.some((m) => m.prefix === prefix) ? (prefix as ModePrefix) : null
}

/**
 * Bold the part of a label that matched.
 *
 * Results were previously rendered as flat text, so on a fuzzy-looking list it
 * was not obvious *why* any given row was there — which is most of what makes
 * an editor's palette feel like it is helping rather than guessing.
 */
function Highlight({ text, needle }: { text: string; needle: string }) {
  const term = needle.trim()
  if (!term) return <>{text}</>

  const index = text.toLowerCase().indexOf(term.toLowerCase())
  if (index === -1) return <>{text}</>

  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-transparent font-semibold text-foreground">
        {text.slice(index, index + term.length)}
      </mark>
      {text.slice(index + term.length)}
    </>
  )
}

/**
 * Ctrl/Cmd+K (or Ctrl+P) command palette.
 *
 * Every analysis, every layout control and every support action is reachable
 * from here, which is what keeps them discoverable rather than buried in menus.
 * Three prefixes narrow it: `>` for commands, `@` for genes, `?` for help.
 */
export function CommandPalette() {
  const wb = useWorkbench()
  const { signOut } = useAuth()
  const { openReport, openAbout } = useSupport()
  const consoleActions = useConsoleActions()

  const [query, setQuery] = React.useState("")
  const [recents, setRecents] = React.useState<PaletteRecent[]>([])

  const mode = modeFor(query)
  const term = mode ? query.slice(1) : query
  const trimmed = term.trim()

  // Re-seed on open so Ctrl+K and Ctrl+Shift+P land in the right mode, a stale
  // query never lingers, and the recents list reflects the latest visit.
  React.useEffect(() => {
    if (!wb.paletteOpen) return
    setQuery(wb.paletteSeed)
    setRecents(readRecents())
  }, [wb.paletteOpen, wb.paletteSeed])

  const remember = React.useCallback((entry: PaletteRecent) => {
    setRecents(pushRecent(entry))
  }, [])

  const run = React.useCallback(
    (action: () => void) => {
      wb.setPaletteOpen(false)
      // Let the dialog's close animation start before the view swaps under it.
      queueMicrotask(action)
    },
    [wb],
  )

  const goToView = React.useCallback(
    (href: string) => {
      remember({ type: "view", href })
      run(() => wb.openTab(href))
    },
    [remember, run, wb],
  )

  const goToGene = React.useCallback(
    (gene: string) => {
      remember({ type: "gene", gene })
      run(() => wb.openTab(`${GENE_LIBRARY}?q=${encodeURIComponent(gene)}`))
    },
    [remember, run, wb],
  )

  /* ---- Matching --------------------------------------------------------- */

  // cmdk scores against the raw input, so the mode prefix has to be stripped
  // before matching or every command would have to literally contain it.
  const filter = React.useCallback((value: string, search: string) => {
    const raw = modeFor(search) ? search.slice(1) : search
    const needle = raw.trim().toLowerCase()
    if (!needle) return 1
    return value.toLowerCase().includes(needle) ? 1 : 0
  }, [])

  const geneMatches = React.useMemo(() => {
    if (mode === ">" || mode === "?") return []
    if (mode !== "@" && !trimmed) return []
    return searchRecords(trimmed)
  }, [mode, trimmed])

  const viewMatches = React.useMemo(() => {
    if (mode) return []
    if (!trimmed) return VIEWS
    const needle = trimmed.toLowerCase()
    return VIEWS.filter((v) =>
      `${v.label} ${v.hint}`.toLowerCase().includes(needle),
    )
  }, [mode, trimmed])

  /**
   * Tab completes the input to the best match.
   *
   * The palette had no completion at all, so a half-remembered name meant
   * deleting and retrying. This fills the field the way a shell would, and
   * leaves the selection where cmdk had it so Enter still does the obvious
   * thing.
   */
  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Tab" || event.shiftKey) return
    const best = viewMatches[0]?.label ?? geneMatches[0]?.gene
    if (!best || !trimmed || best.toLowerCase() === trimmed.toLowerCase()) return
    event.preventDefault()
    setQuery(mode ? `${mode}${best}` : best)
  }

  /* ---- Command groups --------------------------------------------------- */

  const tabCommands = [
    {
      icon: X,
      label: "Close the open analysis",
      shortcut: "Alt W",
      // The last analysis open cannot be closed — the bench always has a view
      // on screen, so the strip describing it is never empty.
      disabled: !wb.view || !wb.canCloseTab,
      action: () => wb.view && wb.closeTab(wb.view.href),
    },
    {
      icon: XSquare,
      label: "Close other analyses",
      disabled: !wb.view || !wb.canCloseTab,
      action: () => wb.view && wb.closeOtherTabs(wb.view.href),
    },
    {
      icon: XSquare,
      label: "Close all analyses",
      disabled: !wb.canCloseTab,
      action: wb.closeAllTabs,
    },
    {
      icon: CornerUpLeft,
      label: "Reopen closed analysis",
      shortcut: "Alt Shift T",
      disabled: wb.closedTabCount === 0,
      action: wb.reopenClosedTab,
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
    { icon: Trash2, label: "Clear run log", action: consoleActions.clearLogs },
    {
      icon: Trash2,
      label: "Clear run history",
      action: consoleActions.clearRunHistory,
    },
    {
      icon: Trash2,
      label: "Dismiss all alerts",
      action: () => consoleActions.dismissAlerts(),
    },
  ]

  const toggles = [
    { icon: PanelLeft, label: "Toggle sidebar", shortcut: "Ctrl B", action: wb.toggleSidebar },
    { icon: PanelBottom, label: "Toggle console", shortcut: "Ctrl J", action: wb.togglePanel },
    { icon: PanelRight, label: "Toggle inspector", shortcut: "Ctrl Alt B", action: wb.toggleInspector },
    { icon: LayoutGrid, label: "Toggle open tabs", action: wb.toggleTabBar },
    { icon: LayoutGrid, label: "Toggle context bar", action: wb.toggleContextBar },
    { icon: LayoutGrid, label: "Toggle status bar", action: wb.toggleStatusBar },
    { icon: Eye, label: "Toggle focus mode", shortcut: "Esc to exit", action: wb.toggleFocusMode },
    { icon: Maximize2, label: "Maximize console", action: wb.togglePanelMaximized },
  ]

  const sideViews = [
    { icon: Microscope, label: "Sidebar: Analyses", action: () => wb.setActivity("analyses") },
    { icon: PlayCircle, label: "Sidebar: Runs", action: () => wb.setActivity("runs") },
    { icon: Dna, label: "Sidebar: Gene library", action: () => wb.setActivity("genes") },
  ]

  const helpItems = [
    {
      icon: Bug,
      label: "Report a problem",
      hint: "Collects a diagnostic bundle you can review before sharing",
      action: () => openReport(),
    },
    {
      icon: Keyboard,
      label: "Keyboard shortcuts",
      hint: "Every chord the workbench binds",
      action: () => wb.openTab("/settings"),
    },
    {
      icon: Info,
      label: "About HelixMind Panel",
      hint: "Version, where your data lives, known limitations",
      action: openAbout,
    },
  ]

  const showRecents = !mode && !trimmed && recents.length > 0

  return (
    <CommandDialog
      open={wb.paletteOpen}
      onOpenChange={wb.setPaletteOpen}
      showCloseButton={false}
      className="top-[18%] max-w-2xl translate-y-0 gap-0 border-border bg-popover p-0 shadow-[var(--shadow-modal)]"
      title="Command palette"
      description="Jump to a view, search genes, or run a workbench command"
      commandProps={{ filter, shouldFilter: true }}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        onKeyDown={onInputKeyDown}
        placeholder={
          mode === ">"
            ? "Run a command…"
            : mode === "@"
              ? "Search resistance genes…"
              : mode === "?"
                ? "Help and support…"
                : "Search analyses and genes — > commands, @ genes, ? help"
        }
      />

      {/* The mode banner names how to get back out. Without it, a stray `>`
          silently changed what the palette searched with no way to tell. */}
      {mode && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
          <span className="rounded-xs bg-[var(--wb-active)] px-1.5 py-0.5 font-mono text-2xs tracking-wide text-foreground/80 uppercase">
            {MODES.find((m) => m.prefix === mode)?.label}
          </span>
          <span className="text-xs text-muted-foreground">
            Clear the{" "}
            <span className="font-mono text-foreground/70">{mode}</span> to search
            analyses again
          </span>
        </div>
      )}

      <CommandList className="seq-scroll max-h-[min(60vh,26rem)]">
        <CommandEmpty>
          {mode === ">"
            ? `No command matches "${trimmed}".`
            : mode === "@"
              ? `No gene matches "${trimmed}".`
              : `Nothing matches "${trimmed}". Try > for commands or @ for genes.`}
        </CommandEmpty>

        {showRecents && (
          <CommandGroup heading="Recent">
            {recents.map((entry) => {
              if (entry.type === "view") {
                const view = VIEWS.find((v) => v.href === entry.href)
                if (!view) return null
                return (
                  <CommandItem
                    key={`recent-${entry.href}`}
                    value={`recent ${view.label}`}
                    onSelect={() => goToView(view.href)}
                  >
                    <Clock className="text-muted-foreground" />
                    {view.label}
                    <CommandShortcut>{groupLabel(view)}</CommandShortcut>
                  </CommandItem>
                )
              }
              const record = AMR_BY_GENE.get(entry.gene)
              if (!record) return null
              return (
                <CommandItem
                  key={`recent-${entry.gene}`}
                  value={`recent ${record.gene}`}
                  onSelect={() => goToGene(record.gene)}
                >
                  <Clock className="text-muted-foreground" />
                  <span className="font-mono">{record.gene}</span>
                  <CommandShortcut>Gene library</CommandShortcut>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {!mode && !trimmed && (
          <CommandGroup heading="Modes">
            {MODES.map((m) => (
              <CommandItem
                key={m.prefix}
                value={`show ${m.label}`}
                onSelect={() => setQuery(m.prefix)}
              >
                <ChevronRight />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">Show {m.label}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {m.hint}
                  </span>
                </span>
                <CommandShortcut className="font-mono">{m.prefix}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!mode && (
          <CommandGroup heading="Go to">
            {VIEWS.map((v) => (
              <CommandItem
                key={v.href}
                value={`${v.label} ${v.hint}`}
                onSelect={() => goToView(v.href)}
              >
                <v.icon />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">
                    <Highlight text={v.label} needle={trimmed} />
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {v.hint}
                  </span>
                </span>
                <CommandShortcut>{groupLabel(v)}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Genes appear once you type, or immediately in `@` mode. Listing the
            whole library unprompted would bury the analyses above them. */}
        {geneMatches.length > 0 && (
          <>
            {!mode && <CommandSeparator />}
            <CommandGroup heading={`Genes · ${geneMatches.length}`}>
              {geneMatches.slice(0, 8).map((r) => (
                <CommandItem
                  key={r.id}
                  value={`${r.gene} ${r.organism} ${r.antibiotic} ${r.drugClass} ${r.mechanism}`}
                  onSelect={() => goToGene(r.gene)}
                >
                  <Dna className="text-success" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-mono">
                      <Highlight text={r.gene} needle={trimmed} />
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {r.organism} · {r.antibiotic}
                    </span>
                  </span>
                  <CommandShortcut>Gene library</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {mode === "?" && (
          <CommandGroup heading="Help">
            {helpItems.map((item) => (
              <CommandItem key={item.label} onSelect={() => run(item.action)}>
                <item.icon />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{item.label}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {item.hint}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {mode !== "@" && mode !== "?" && (
          <>
            <CommandSeparator />

            <CommandGroup heading="Open analyses">
              {tabCommands.map((c) => (
                <CommandItem
                  key={c.label}
                  disabled={c.disabled}
                  onSelect={() => run(c.action)}
                >
                  <c.icon />
                  {c.label}
                  {c.shortcut && <CommandShortcut>{c.shortcut}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

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
              <CommandItem
                onSelect={() =>
                  run(() => {
                    wb.resetLayout()
                    toast({ title: "Layout reset to defaults" })
                  })
                }
              >
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

            <CommandGroup heading="Help and account">
              <CommandItem onSelect={() => run(() => openReport())}>
                <Bug />
                Report a problem
              </CommandItem>
              <CommandItem onSelect={() => run(openAbout)}>
                <Info />
                About HelixMind Panel
              </CommandItem>
              <CommandItem
                onSelect={() =>
                  run(() => {
                    // `signOut` navigates; the palette no longer pushes a route
                    // of its own and race with it.
                    signOut()
                    toast({
                      title: "Signed out",
                      description: "Your workspace stays on this device.",
                    })
                  })
                }
              >
                <LogOut />
                Sign out
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>

      <div
        className={cn(
          "flex items-center gap-3 border-t border-border px-3 py-1.5",
          "text-2xs text-muted-foreground/70",
        )}
      >
        <span>
          <kbd className="font-mono text-foreground/70">Tab</kbd> complete
        </span>
        <span>
          <kbd className="font-mono text-foreground/70">↑↓</kbd> navigate
        </span>
        <span>
          <kbd className="font-mono text-foreground/70">Enter</kbd> open
        </span>
        {recents.length > 0 && (
          <span className="ml-auto">
            {Math.min(recents.length, MAX_RECENTS)} recent
          </span>
        )}
      </div>
    </CommandDialog>
  )
}
