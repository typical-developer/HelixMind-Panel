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
 * The rail, sidebar, open tabs, context bar and command palette all read from
 * here, so adding a view is a one-line change instead of six parallel edits.
 */
export interface WorkbenchView {
  /** Route the view lives at — also the tab id. */
  href: string
  /** The view's name. The only name the user ever sees. */
  label: string
  /** Group heading in the sidebar. */
  group: WorkbenchGroupId
  icon: LucideIcon
  /** What the view is for — shown in the context bar and the palette. */
  hint: string
  /** True for views that execute a job, so the Runs sidebar can list them. */
  runnable?: boolean
  /** Keyboard hint shown next to the palette entry. */
  chord?: string
}

export type WorkbenchGroupId = "lab" | "amr" | "workspace"

export const WORKBENCH_GROUPS: Array<{ id: WorkbenchGroupId; label: string }> = [
  { id: "lab", label: "Lab" },
  { id: "amr", label: "AMR Engine" },
  { id: "workspace", label: "Workspace" },
]

export const VIEWS: WorkbenchView[] = [
  {
    href: "/dashboard",
    label: "Overview",
    group: "lab",
    icon: Gauge,
    hint: "Lab-wide metrics, sequence viewer and mutation log",
  },
  {
    href: "/dna-scanner",
    label: "DNA Scanner",
    group: "lab",
    icon: ScanLine,
    hint: "Parse FASTA input and call mutations against a reference",
    runnable: true,
  },
  {
    href: "/mutation-simulator",
    label: "Mutation Simulator",
    group: "lab",
    icon: Split,
    hint: "Run generational mutation dynamics over a query sequence",
    runnable: true,
  },
  {
    href: "/microbe-growth-lab",
    label: "Microbe Growth Lab",
    group: "lab",
    icon: FlaskConical,
    hint: "Model population growth under environmental stress",
    runnable: true,
  },
  {
    href: "/amr-analysis-engine/resistance-predictor",
    label: "Resistance Predictor",
    group: "amr",
    icon: ShieldAlert,
    hint: "Score resistance markers and synergy rules for an organism",
    runnable: true,
  },
  {
    href: "/amr-analysis-engine/gene-database",
    label: "Gene Library",
    group: "amr",
    icon: Database,
    hint: "Browse curated antimicrobial resistance gene records",
  },
  {
    href: "/notifications",
    label: "Notifications",
    group: "workspace",
    icon: Bell,
    hint: "Activity from scans, uploads and simulation runs",
  },
  {
    href: "/settings",
    label: "Settings",
    group: "workspace",
    icon: Settings2,
    hint: "Profile, notification preferences and appearance",
    chord: ",",
  },
]

/* View icons are deliberately untinted. Giving each view its own hue made the
   sidebar, tabs and palette read as a colour chart and left no colour free to
   mean anything — so colour is reserved for state (severity, run outcome,
   nucleotide) and icons take their weight from the active/idle foreground. */

/** Views that execute a job, in registry order. */
export const RUNNABLE_VIEWS = VIEWS.filter((v) => v.runnable)

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

/** The group a view belongs to, e.g. `AMR Engine`. */
export function groupLabel(view: WorkbenchView | undefined) {
  if (!view) return "Workspace"
  return WORKBENCH_GROUPS.find((g) => g.id === view.group)?.label ?? "Workspace"
}
