import {
  Bell,
  Database,
  FlaskConical,
  Gauge,
  ScanLine,
  Settings2,
  ShieldAlert,
  Split,
  type LucideIcon,
} from "lucide-react"

/**
 * Single source of truth for every routed view in the workbench.
 *
 * The activity bar, explorer tree, editor tabs, breadcrumbs and command
 * palette all read from here, so adding a view is a one-line change instead of
 * six parallel edits.
 */
export interface WorkbenchView {
  /** Route the view lives at — also the tab id. */
  href: string
  /** Human label used in tabs, breadcrumbs and the palette. */
  label: string
  /** File-style name shown in the explorer tree. */
  fileName: string
  /** Group heading in the explorer tree. */
  group: WorkbenchGroupId
  icon: LucideIcon
  /** Tint applied to the file icon, mirroring VS Code's seti file colours. */
  tone: "blue" | "green" | "amber" | "purple" | "red" | "neutral"
  /** Short description surfaced in the command palette and empty states. */
  hint: string
  /** Keyboard hint shown next to the palette entry. */
  chord?: string
}

export type WorkbenchGroupId = "analysis" | "amr-engine" | "workspace"

export const WORKBENCH_GROUPS: Array<{ id: WorkbenchGroupId; label: string }> = [
  { id: "analysis", label: "analysis" },
  { id: "amr-engine", label: "amr-engine" },
  { id: "workspace", label: "workspace" },
]

export const VIEWS: WorkbenchView[] = [
  {
    href: "/dashboard",
    label: "Overview",
    fileName: "overview.dash",
    group: "analysis",
    icon: Gauge,
    tone: "blue",
    hint: "Lab-wide metrics, sequence viewer and mutation log",
  },
  {
    href: "/dna-scanner",
    label: "DNA Scanner",
    fileName: "dna-scanner.fa",
    group: "analysis",
    icon: ScanLine,
    tone: "green",
    hint: "Parse FASTA input and call mutations against a reference",
  },
  {
    href: "/mutation-simulator",
    label: "Mutation Simulator",
    fileName: "mutation-simulator.sim",
    group: "analysis",
    icon: Split,
    tone: "purple",
    hint: "Run generational mutation dynamics over a query sequence",
  },
  {
    href: "/microbe-growth-lab",
    label: "Microbe Growth Lab",
    fileName: "microbe-growth-lab.sim",
    group: "analysis",
    icon: FlaskConical,
    tone: "amber",
    hint: "Model population growth under environmental stress",
  },
  {
    href: "/amr-analysis-engine/resistance-predictor",
    label: "Resistance Predictor",
    fileName: "resistance-predictor.amr",
    group: "amr-engine",
    icon: ShieldAlert,
    tone: "red",
    hint: "Score resistance markers and synergy rules for an organism",
  },
  {
    href: "/amr-analysis-engine/gene-database",
    label: "Gene Database",
    fileName: "gene-database.db",
    group: "amr-engine",
    icon: Database,
    tone: "blue",
    hint: "Browse curated antimicrobial resistance gene records",
  },
  {
    href: "/notifications",
    label: "Notifications",
    fileName: "notifications.log",
    group: "workspace",
    icon: Bell,
    tone: "neutral",
    hint: "Activity from scans, uploads and simulation runs",
  },
  {
    href: "/settings",
    label: "Settings",
    fileName: "settings.json",
    group: "workspace",
    icon: Settings2,
    tone: "neutral",
    hint: "Profile, notification preferences and appearance",
    chord: ",",
  },
]

/** Icon tints, matched to the Geist accent ramp. */
export const TONE_CLASS: Record<WorkbenchView["tone"], string> = {
  blue: "text-brand-bright",
  green: "text-success",
  amber: "text-warning",
  purple: "text-chart-4",
  red: "text-destructive",
  neutral: "text-muted-foreground",
}

/**
 * Resolve a pathname to its view. Falls back to prefix matching so nested
 * segments (and the `/amr-analysis-engine` redirect) still land on a view.
 */
export function viewForPath(pathname: string): WorkbenchView | undefined {
  const exact = VIEWS.find((v) => v.href === pathname)
  if (exact) return exact

  // Longest prefix wins, so `/amr-analysis-engine/gene-database` never matches
  // a shorter sibling first.
  return [...VIEWS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((v) => pathname.startsWith(v.href + "/") || v.href.startsWith(pathname + "/"))
}

/** Breadcrumb segments for a view, e.g. `HelixMind › analysis › DNA Scanner`. */
export function breadcrumbsForView(view: WorkbenchView | undefined) {
  if (!view) return [{ label: "HelixMind" }]
  const group = WORKBENCH_GROUPS.find((g) => g.id === view.group)
  return [
    { label: "helixmind-lab" },
    { label: group?.label ?? view.group },
    { label: view.fileName, view },
  ]
}
