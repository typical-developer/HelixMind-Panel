"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  CircleDot,
  Database,
  Dna,
  Eye,
  EyeOff,
  FileCode2,
  Layout,
  MoreHorizontal,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Play,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Square,
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

import {
  SideSection,
  ToolbarButton,
  TreeRow,
  WBInput,
  Chip,
} from "./primitives"
import { useWorkbench } from "./workbench-provider"
import { TONE_CLASS, VIEWS, WORKBENCH_GROUPS } from "./registry"

const TITLES: Record<string, string> = {
  explorer: "Explorer",
  search: "Search",
  run: "Run & Analyze",
  database: "Gene Database",
  notifications: "Notifications",
  settings: "Manage",
}

/**
 * The contextual side bar. Its header stays fixed while the body swaps between
 * activity views, so switching views never shifts the chrome.
 */
export function SideBar() {
  const { activity, toggleSidebar } = useWorkbench()

  return (
    <aside
      aria-label={TITLES[activity]}
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface"
    >
      <header className="flex h-9 shrink-0 items-center gap-1 pr-1 pl-3">
        <h2 className="flex-1 truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {TITLES[activity]}
        </h2>
        <SideBarMenu />
        <ToolbarButton icon={X} label="Close side bar" onClick={toggleSidebar} />
      </header>

      <div className="seq-scroll min-h-0 flex-1 overflow-y-auto pb-4">
        <div key={activity} className="animate-fade-in">
          {activity === "explorer" && <ExplorerView />}
          {activity === "search" && <SearchView />}
          {activity === "run" && <RunView />}
          {activity === "database" && <DatabaseView />}
          {activity === "settings" && <ManageView />}
          {activity === "notifications" && <ExplorerView />}
        </div>
      </div>
    </aside>
  )
}

function SideBarMenu() {
  const {
    tabBarVisible,
    breadcrumbsVisible,
    statusBarVisible,
    inspectorVisible,
    toggleTabBar,
    toggleBreadcrumbs,
    toggleStatusBar,
    toggleInspector,
  } = useWorkbench()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Side bar options"
          className="inline-flex size-6 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-[var(--wb-hover)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Views</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked={tabBarVisible} onCheckedChange={toggleTabBar}>
          Editor tabs
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={breadcrumbsVisible}
          onCheckedChange={toggleBreadcrumbs}
        >
          Breadcrumbs
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={inspectorVisible}
          onCheckedChange={toggleInspector}
        >
          Inspector panel
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
   Explorer
   ========================================================================= */

function ExplorerView() {
  const { view, tabs, openTab, closeTab } = useWorkbench()

  return (
    <div className="space-y-1">
      {tabs.length > 0 && (
        <SideSection title="Open Editors" defaultOpen={false}>
          {tabs.map((tab) => (
            <div key={tab.href} className="group/row relative">
              <TreeRow
                icon={tab.icon}
                iconClassName={TONE_CLASS[tab.tone]}
                label={tab.fileName}
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

      <SideSection title="helixmind-lab">
        {WORKBENCH_GROUPS.map((group) => (
          <ExplorerFolder key={group.id} label={group.label}>
            {VIEWS.filter((v) => v.group === group.id).map((v) => (
              <TreeRow
                key={v.href}
                icon={v.icon}
                iconClassName={TONE_CLASS[v.tone]}
                label={v.fileName}
                active={view?.href === v.href}
                level={2}
                onClick={() => openTab(v.href)}
                title={v.hint}
              />
            ))}
          </ExplorerFolder>
        ))}
      </SideSection>

      <SideSection title="Outline" defaultOpen={false}>
        <p className="px-3 py-2 text-xs leading-relaxed text-muted-foreground/70">
          {view ? view.hint : "No view is open."}
        </p>
      </SideSection>
    </div>
  )
}

function ExplorerFolder({
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
        icon={open ? FolderOpenIcon : FolderIcon}
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

/* Folder glyphs kept local — lucide's folder icons carry more visual weight
   than the tree needs at 14px. */
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path
        d="M1.5 3.5h4l1.2 1.6h7.8v7.4H1.5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FolderOpenIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path
        d="M1.5 12.5V3.5h4l1.2 1.6h7.8v1.9M1.5 12.5l2-5.5h12l-2 5.5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
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
      [v.label, v.fileName, v.hint].some((f) => f.toLowerCase().includes(needle)),
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
            placeholder="Search views and genes"
            className="pl-7"
            aria-label="Search the workspace"
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
          Search across analysis views and the resistance gene database. Press{" "}
          <span className="font-mono text-foreground/80">Ctrl+K</span> for the full
          command palette.
        </p>
      )}

      {viewMatches.length > 0 && (
        <SideSection title={`Views · ${viewMatches.length}`}>
          {viewMatches.map((v) => (
            <TreeRow
              key={v.href}
              icon={v.icon}
              iconClassName={TONE_CLASS[v.tone]}
              label={v.fileName}
              active={view?.href === v.href}
              level={1}
              onClick={() => openTab(v.href)}
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
              onClick={() => openTab("/amr-analysis-engine/gene-database")}
              title={`${r.organism} · ${r.mechanism}`}
            />
          ))}
        </SideSection>
      )}
    </div>
  )
}

/* ============================================================================
   Run & Analyze
   ========================================================================= */

const RUNNABLE = VIEWS.filter((v) =>
  ["/dna-scanner", "/mutation-simulator", "/microbe-growth-lab"].includes(v.href),
)

function RunView() {
  const { openTab, view, runStatus, problems, setPanelTab } = useWorkbench()

  const errors = problems.filter((p) => p.severity === "error").length
  const warnings = problems.filter((p) => p.severity === "warning").length

  return (
    <div className="space-y-1">
      <SideSection title="Run configurations">
        {RUNNABLE.map((v) => (
          <TreeRow
            key={v.href}
            icon={Play}
            iconClassName="text-success"
            label={v.label}
            active={view?.href === v.href}
            level={1}
            onClick={() => openTab(v.href)}
          />
        ))}
      </SideSection>

      <SideSection title="Active job">
        {runStatus ? (
          <div className="space-y-2 px-3 py-2">
            <div className="flex items-center gap-2">
              {runStatus.state === "running" ? (
                <CircleDot className="size-3.5 animate-soft-pulse text-success" />
              ) : runStatus.state === "paused" ? (
                <Square className="size-3.5 text-warning" />
              ) : (
                <CircleDot className="size-3.5 text-muted-foreground" />
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
                className="ml-auto capitalize"
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
          <p className="px-3 py-2 text-xs text-muted-foreground/70">
            Nothing is running. Start a simulation to track it here.
          </p>
        )}
      </SideSection>

      <SideSection title="Diagnostics">
        <TreeRow
          icon={AlertTriangle}
          iconClassName={errors ? "text-destructive" : "text-muted-foreground"}
          label="Errors"
          detail={errors}
          level={1}
          onClick={() => setPanelTab("problems")}
        />
        <TreeRow
          icon={AlertTriangle}
          iconClassName={warnings ? "text-warning" : "text-muted-foreground"}
          label="Warnings"
          detail={warnings}
          level={1}
          onClick={() => setPanelTab("problems")}
        />
      </SideSection>
    </div>
  )
}

/* ============================================================================
   Gene database
   ========================================================================= */

function DatabaseView() {
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

      <SideSection title={`Markers · ${records.length}`}>
        {records.map((r) => (
          <TreeRow
            key={r.id}
            icon={Dna}
            iconClassName="text-success"
            label={<span className="font-mono">{r.gene}</span>}
            detail={r.organism}
            level={1}
            onClick={() => openTab("/amr-analysis-engine/gene-database")}
            title={`${r.antibiotic} · ${r.mechanism}`}
          />
        ))}
        {records.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground/70">No matches.</p>
        )}
      </SideSection>

      <SideSection title="Drug classes" defaultOpen={false}>
        {byClass.map(([label, count]) => (
          <TreeRow
            key={label}
            icon={Database}
            label={label}
            detail={count}
            level={1}
            onClick={() => openTab("/amr-analysis-engine/gene-database")}
          />
        ))}
      </SideSection>
    </div>
  )
}

/* ============================================================================
   Manage — the layout customisation surface
   ========================================================================= */

function ManageView() {
  const wb = useWorkbench()
  const router = useRouter()

  const toggles: Array<{
    icon: typeof Layout
    label: string
    hint: string
    checked: boolean
    onChange: () => void
  }> = [
    {
      icon: PanelLeft,
      label: "Side bar",
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
      label: "Bottom panel",
      hint: "Ctrl+J",
      checked: wb.panelVisible,
      onChange: wb.togglePanel,
    },
    {
      icon: FileCode2,
      label: "Editor tabs",
      hint: "Show open views",
      checked: wb.tabBarVisible,
      onChange: wb.toggleTabBar,
    },
    {
      icon: Layout,
      label: "Breadcrumbs",
      hint: "Path above the editor",
      checked: wb.breadcrumbsVisible,
      onChange: wb.toggleBreadcrumbs,
    },
    {
      icon: SlidersHorizontal,
      label: "Status bar",
      hint: "Bottom summary strip",
      checked: wb.statusBarVisible,
      onChange: wb.toggleStatusBar,
    },
    {
      icon: wb.zen ? EyeOff : Eye,
      label: "Zen mode",
      hint: "Hide all chrome · Esc to exit",
      checked: wb.zen,
      onChange: wb.toggleZen,
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
            <span className="flex-1 text-sm text-foreground">Interface zoom</span>
            <div className="flex items-center gap-1">
              <ToolbarButton icon={MinusIcon} label="Zoom out" onClick={wb.zoomOut} />
              <span className="w-9 text-center font-mono text-xs text-muted-foreground tabular">
                {wb.zoom === 0 ? "100%" : `${wb.zoom > 0 ? "+" : ""}${wb.zoom}`}
              </span>
              <ToolbarButton icon={PlusIcon} label="Zoom in" onClick={wb.zoomIn} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground/70">
            Ctrl+Alt+= and Ctrl+Alt+- resize the whole workbench. Ctrl+Alt+0 resets it.
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
          label="Open settings"
          level={1}
          onClick={() => router.push("/settings")}
        />
      </SideSection>
    </div>
  )
}

/* Minimal +/- glyphs so the zoom stepper matches the 14px toolbar icons. */
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
