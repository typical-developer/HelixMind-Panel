"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  CircleSlash,
  Dna,
  Eye,
  EyeOff,
  History,
  Layers,
  MoreHorizontal,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Pill,
  Play,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Square,
  TriangleAlert,
  Type,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { AMR_RECORDS } from "@/lib/amr-records"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { SideSection, ToolbarButton, TreeRow, WBInput, Chip } from "./primitives"
import { useConsole, useWorkbench } from "./workbench-provider"
import { RUNNABLE_VIEWS, VIEWS, WORKBENCH_GROUPS } from "./registry"

const TITLES: Record<string, string> = {
  analyses: "Analyses",
  search: "Search",
  runs: "Runs",
  genes: "Gene library",
  preferences: "Preferences",
}

const GENE_LIBRARY_HREF = "/amr-analysis-engine/gene-database"

/**
 * The sidebar. Its header stays fixed while the body swaps between modes, so
 * switching never shifts the chrome around it.
 */
export function SideBar() {
  const { activity, toggleSidebar } = useWorkbench()

  return (
    <aside
      aria-label={TITLES[activity]}
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface"
    >
      <header className="flex h-9 shrink-0 items-center gap-1 pr-1 pl-3">
        <h2 className="flex-1 truncate text-sm font-medium text-foreground/85">
          {TITLES[activity]}
        </h2>
        <SideBarMenu />
        <ToolbarButton icon={X} label="Hide sidebar" onClick={toggleSidebar} />
      </header>

      <div className="seq-scroll min-h-0 flex-1 overflow-y-auto pb-4">
        <div key={activity} className="animate-fade-in">
          {activity === "analyses" && <AnalysesView />}
          {activity === "search" && <SearchView />}
          {activity === "runs" && <RunsView />}
          {activity === "genes" && <GenesView />}
          {activity === "preferences" && <PreferencesView />}
        </div>
      </div>
    </aside>
  )
}

function SideBarMenu() {
  const {
    tabBarVisible,
    contextBarVisible,
    statusBarVisible,
    inspectorVisible,
    toggleTabBar,
    toggleContextBar,
    toggleStatusBar,
    toggleInspector,
  } = useWorkbench()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Sidebar options"
          className="inline-flex size-6 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-[var(--wb-hover)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Show</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked={tabBarVisible} onCheckedChange={toggleTabBar}>
          Open tabs
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={contextBarVisible}
          onCheckedChange={toggleContextBar}
        >
          Context bar
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={inspectorVisible}
          onCheckedChange={toggleInspector}
        >
          Inspector
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={statusBarVisible}
          onCheckedChange={toggleStatusBar}
        >
          Status bar
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ============================================================================
   Analyses — everything the lab can do, plus what is currently open
   ========================================================================= */

function AnalysesView() {
  const { view, tabs, openTab, closeTab } = useWorkbench()

  return (
    <div className="space-y-1">
      {tabs.length > 0 && (
        <SideSection title="Open" defaultOpen={false}>
          {tabs.map((tab) => (
            <div key={tab.href} className="group/row relative">
              <TreeRow
                icon={tab.icon}
                label={tab.label}
                active={view?.href === tab.href}
                level={1}
                onClick={() => openTab(tab.href)}
                className="pr-7"
              />
              <button
                type="button"
                aria-label={`Close ${tab.label}`}
                onClick={() => closeTab(tab.href)}
                className="absolute top-1/2 right-1.5 flex size-4 -translate-y-1/2 cursor-pointer items-center justify-center rounded-xs text-muted-foreground opacity-0 transition-opacity hover:bg-[var(--wb-active)] hover:text-foreground group-hover/row:opacity-100 focus-visible:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </SideSection>
      )}

      <SideSection title="HelixMind Lab">
        {WORKBENCH_GROUPS.map((group) => (
          <AnalysisGroup key={group.id} label={group.label}>
            {VIEWS.filter((v) => v.group === group.id).map((v) => (
              <TreeRow
                key={v.href}
                icon={v.icon}
                label={v.label}
                active={view?.href === v.href}
                level={2}
                onClick={() => openTab(v.href)}
                title={v.hint}
              />
            ))}
          </AnalysisGroup>
        ))}
      </SideSection>
    </div>
  )
}

function AnalysisGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(true)

  return (
    <div>
      <TreeRow
        icon={open ? ChevronDown : ChevronRight}
        iconClassName="text-muted-foreground"
        label={label}
        level={1}
        onClick={() => setOpen((o) => !o)}
        className="font-medium text-foreground/80"
      />
      {open && <div className="animate-fade-in">{children}</div>}
    </div>
  )
}

/* ============================================================================
   Search
   ========================================================================= */

function SearchView() {
  const { openTab, view } = useWorkbench()
  const [query, setQuery] = React.useState("")

  const needle = query.trim().toLowerCase()

  const viewMatches = React.useMemo(() => {
    if (!needle) return []
    return VIEWS.filter((v) =>
      [v.label, v.hint].some((f) => f.toLowerCase().includes(needle)),
    )
  }, [needle])

  const geneMatches = React.useMemo(() => {
    if (!needle) return []
    return AMR_RECORDS.filter((r) =>
      [r.gene, r.antibiotic, r.organism, r.drugClass, r.mechanism].some((f) =>
        f.toLowerCase().includes(needle),
      ),
    )
  }, [needle])

  const total = viewMatches.length + geneMatches.length

  return (
    <div className="space-y-2">
      <div className="px-3 pt-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <WBInput
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search analyses and genes"
            className="pl-7"
            aria-label="Search the lab"
          />
        </div>
        {needle && (
          <p className="mt-2 text-xs text-muted-foreground">
            {total} result{total === 1 ? "" : "s"} for{" "}
            <span className="font-mono text-foreground/80">{query}</span>
          </p>
        )}
      </div>

      {!needle && (
        <p className="px-3 py-2 text-xs leading-relaxed text-muted-foreground/70">
          Search across every analysis and the resistance gene library. Press{" "}
          <span className="font-mono text-foreground/80">Ctrl+K</span> to search and
          run commands from anywhere.
        </p>
      )}

      {viewMatches.length > 0 && (
        <SideSection title={`Analyses · ${viewMatches.length}`}>
          {viewMatches.map((v) => (
            <TreeRow
              key={v.href}
              icon={v.icon}
              label={v.label}
              active={view?.href === v.href}
              level={1}
              onClick={() => openTab(v.href)}
              title={v.hint}
            />
          ))}
        </SideSection>
      )}

      {geneMatches.length > 0 && (
        <SideSection title={`Genes · ${geneMatches.length}`}>
          {geneMatches.map((r) => (
            <TreeRow
              key={r.id}
              icon={Dna}
              iconClassName="text-success"
              label={<span className="font-mono">{r.gene}</span>}
              detail={`${r.impact}%`}
              level={1}
              onClick={() => openTab(GENE_LIBRARY_HREF)}
              title={`${r.organism} · ${r.mechanism}`}
            />
          ))}
        </SideSection>
      )}
    </div>
  )
}

/* ============================================================================
   Runs — what you can start, what is running, what has finished
   ========================================================================= */

function RunsView() {
  const { openTab, view, setPanelTab } = useWorkbench()
  const { runStatus, runHistory, alerts } = useConsole()

  const errors = alerts.filter((a) => a.severity === "error").length
  const warnings = alerts.filter((a) => a.severity === "warning").length

  return (
    <div className="space-y-1">
      <SideSection title="Start a run">
        {RUNNABLE_VIEWS.map((v) => (
          <TreeRow
            key={v.href}
            icon={Play}
            iconClassName="text-success"
            label={v.label}
            active={view?.href === v.href}
            level={1}
            onClick={() => openTab(v.href)}
            title={v.hint}
          />
        ))}
      </SideSection>

      <SideSection title="In progress">
        {runStatus && runStatus.state !== "idle" ? (
          <div className="space-y-2 px-3 py-2">
            <div className="flex items-center gap-2">
              {runStatus.state === "running" ? (
                <CircleDot className="size-3.5 animate-soft-pulse text-success" />
              ) : runStatus.state === "paused" ? (
                <Square className="size-3.5 text-warning" />
              ) : (
                <CheckCircle2 className="size-3.5 text-muted-foreground" />
              )}
              <span className="truncate text-sm text-foreground">
                {runStatus.label}
              </span>
              <Chip
                tone={
                  runStatus.state === "running"
                    ? "success"
                    : runStatus.state === "paused"
                      ? "warning"
                      : "neutral"
                }
                className="ml-auto"
              >
                {runStatus.state}
              </Chip>
            </div>
            {typeof runStatus.progress === "number" && (
              <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--wb-active)]">
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-300 ease-[var(--ease-out-quint)]"
                  style={{ width: `${Math.min(100, Math.max(0, runStatus.progress))}%` }}
                />
              </div>
            )}
            {runStatus.detail && (
              <p className="font-mono text-xs text-muted-foreground">
                {runStatus.detail}
              </p>
            )}
          </div>
        ) : (
          <p className="px-3 py-2 text-xs leading-relaxed text-muted-foreground/70">
            Nothing is running. Start a scan or a simulation and its progress
            appears here.
          </p>
        )}
      </SideSection>

      <SideSection title="Finished" defaultOpen={runHistory.length > 0}>
        {runHistory.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground/70">
            No runs finished this session.
          </p>
        ) : (
          runHistory.slice(0, 6).map((record) => (
            <TreeRow
              key={record.id}
              icon={record.outcome === "completed" ? CheckCircle2 : CircleSlash}
              iconClassName={
                record.outcome === "completed" ? "text-success" : "text-muted-foreground"
              }
              label={record.label}
              detail={formatAgo(record.endedAt)}
              level={1}
              onClick={() => setPanelTab("history")}
              title={record.detail}
            />
          ))
        )}
      </SideSection>

      <SideSection title="Alerts">
        <TreeRow
          icon={AlertCircle}
          iconClassName={errors ? "text-destructive" : "text-muted-foreground"}
          label="Errors"
          detail={errors}
          level={1}
          onClick={() => setPanelTab("alerts")}
        />
        <TreeRow
          icon={TriangleAlert}
          iconClassName={warnings ? "text-warning" : "text-muted-foreground"}
          label="Warnings"
          detail={warnings}
          level={1}
          onClick={() => setPanelTab("alerts")}
        />
        <TreeRow
          icon={History}
          label="Open the run log"
          level={1}
          onClick={() => setPanelTab("log")}
        />
      </SideSection>
    </div>
  )
}

/** Coarse relative time — the sidebar only needs "how recently". */
function formatAgo(ts: number) {
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.round(minutes / 60)}h ago`
}

/* ============================================================================
   Gene library
   ========================================================================= */

function GenesView() {
  const { openTab } = useWorkbench()
  const [query, setQuery] = React.useState("")

  const needle = query.trim().toLowerCase()
  const records = React.useMemo(
    () =>
      AMR_RECORDS.filter((r) =>
        needle
          ? [r.gene, r.organism, r.antibiotic].some((f) =>
              f.toLowerCase().includes(needle),
            )
          : true,
      ),
    [needle],
  )

  const byClass = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const r of AMR_RECORDS) map.set(r.drugClass, (map.get(r.drugClass) ?? 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [])

  return (
    <div className="space-y-1">
      <div className="px-3 pt-2 pb-1">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <WBInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter genes"
            className="pl-7"
            aria-label="Filter genes"
          />
        </div>
      </div>

      <SideSection title={`Resistance genes · ${records.length}`}>
        {records.map((r) => (
          <TreeRow
            key={r.id}
            icon={Dna}
            iconClassName="text-success"
            label={<span className="font-mono">{r.gene}</span>}
            detail={r.organism}
            level={1}
            onClick={() => openTab(GENE_LIBRARY_HREF)}
            title={`${r.antibiotic} · ${r.mechanism}`}
          />
        ))}
        {records.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground/70">
            No gene matches “{query}”.
          </p>
        )}
      </SideSection>

      <SideSection title="Drug classes" defaultOpen={false}>
        {byClass.map(([label, count]) => (
          <TreeRow
            key={label}
            icon={Pill}
            label={label}
            detail={count}
            level={1}
            onClick={() => openTab(GENE_LIBRARY_HREF)}
          />
        ))}
      </SideSection>
    </div>
  )
}

/* ============================================================================
   Preferences — the layout controls, close at hand
   ========================================================================= */

function PreferencesView() {
  const wb = useWorkbench()
  const router = useRouter()

  const toggles: Array<{
    icon: typeof Layers
    label: string
    hint: string
    checked: boolean
    onChange: () => void
  }> = [
    {
      icon: PanelLeft,
      label: "Sidebar",
      hint: "Ctrl+B",
      checked: wb.sidebarVisible,
      onChange: wb.toggleSidebar,
    },
    {
      icon: PanelRight,
      label: "Inspector",
      hint: "Ctrl+Alt+B",
      checked: wb.inspectorVisible,
      onChange: wb.toggleInspector,
    },
    {
      icon: PanelBottom,
      label: "Console",
      hint: "Ctrl+J",
      checked: wb.panelVisible,
      onChange: wb.togglePanel,
    },
    {
      icon: Layers,
      label: "Open tabs",
      hint: "Switch between open analyses",
      checked: wb.tabBarVisible,
      onChange: wb.toggleTabBar,
    },
    {
      icon: SlidersHorizontal,
      label: "Context bar",
      hint: "What the open analysis is working on",
      checked: wb.contextBarVisible,
      onChange: wb.toggleContextBar,
    },
    {
      icon: SlidersHorizontal,
      label: "Status bar",
      hint: "Bottom summary strip",
      checked: wb.statusBarVisible,
      onChange: wb.toggleStatusBar,
    },
    {
      icon: wb.focusMode ? EyeOff : Eye,
      label: "Focus mode",
      hint: "Bench only · Esc to exit",
      checked: wb.focusMode,
      onChange: wb.toggleFocusMode,
    },
  ]

  return (
    <div className="space-y-1">
      <SideSection title="Layout">
        <div className="space-y-0.5 px-2 py-1">
          {toggles.map((t) => (
            <label
              key={t.label}
              className="row-hover flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1.5"
            >
              <t.icon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">
                  {t.label}
                </span>
                <span className="block truncate text-xs text-muted-foreground/70">
                  {t.hint}
                </span>
              </span>
              <Switch
                checked={t.checked}
                onCheckedChange={t.onChange}
                aria-label={t.label}
              />
            </label>
          ))}
        </div>
      </SideSection>

      <SideSection title="Appearance">
        <div className="space-y-2 px-3 py-2">
          <div className="flex items-center gap-2">
            <Type className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm text-foreground">Interface scale</span>
            <div className="flex items-center gap-1">
              <ToolbarButton icon={MinusIcon} label="Smaller" onClick={wb.zoomOut} />
              <span className="w-9 text-center font-mono text-xs text-muted-foreground tabular">
                {wb.zoom === 0 ? "100%" : `${wb.zoom > 0 ? "+" : ""}${wb.zoom}`}
              </span>
              <ToolbarButton icon={PlusIcon} label="Larger" onClick={wb.zoomIn} />
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground/70">
            Ctrl+Alt+= and Ctrl+Alt+- resize the whole panel. Ctrl+Alt+0 resets it.
          </p>
        </div>
      </SideSection>

      <SideSection title="Workspace">
        <TreeRow
          icon={RotateCcw}
          label="Reset layout"
          level={1}
          onClick={wb.resetLayout}
        />
        <TreeRow
          icon={SlidersHorizontal}
          label="All settings"
          level={1}
          onClick={() => router.push("/settings")}
        />
      </SideSection>
    </div>
  )
}

/* Minimal +/- glyphs so the scale stepper matches the 14px toolbar icons. */
function MinusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={cn(className)} aria-hidden>
      <path d="M3.5 8h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={cn(className)} aria-hidden>
      <path
        d="M8 3.5v9M3.5 8h9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}
