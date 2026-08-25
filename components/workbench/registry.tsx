import {
  Bell,
  Database,
  History,
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
  /**
   * The channel this view publishes logs and alerts under.
   *
   * Declared here rather than typed at each call site: the Growth Lab was
   * publishing alerts as `microbe-growth-lab` and log lines as `microbe-lab`,
   * so the console filed one view's output under two sources and the run-log
   * filter listed a channel the Alerts tab had never heard of. It is also what
   * lets a tab know whether the alert that just arrived belongs to it.
   */
  source: string
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
    source: "overview",
    label: "Overview",
    group: "lab",
    icon: Gauge,
    hint: "Lab-wide metrics, sequence viewer and mutation log",
  },
  {
    href: "/dna-scanner",
    source: "dna-scanner",
    label: "DNA Scanner",
    group: "lab",
    icon: ScanLine,
    hint: "Parse FASTA input and call mutations against a reference",
    runnable: true,
  },
  {
    href: "/mutation-simulator",
    source: "mutation-simulator",
    label: "Mutation Simulator",
    group: "lab",
    icon: Split,
    hint: "Run generational mutation dynamics over a query sequence",
    runnable: true,
  },
  {
    href: "/microbe-growth-lab",
    source: "microbe-growth-lab",
    label: "Microbe Growth Lab",
    group: "lab",
    icon: FlaskConical,
    hint: "Model population growth under environmental stress",
    runnable: true,
  },
  {
    href: "/amr-analysis-engine/resistance-predictor",
    source: "amr-engine",
    label: "Resistance Predictor",
    group: "amr",
    icon: ShieldAlert,
    hint: "Score resistance markers and synergy rules for an organism",
    runnable: true,
  },
  {
    href: "/amr-analysis-engine/gene-database",
    source: "gene-library",
    label: "Gene Library",
    group: "amr",
    icon: Database,
    hint: "Browse curated antimicrobial resistance gene records",
  },
  {
    href: "/activity",
    source: "activity",
    label: "Activity",
    group: "workspace",
    icon: History,
    hint: "Every run and export this workspace has recorded, with its results",
  },
  {
    href: "/notifications",
    source: "notifications",
    label: "Notifications",
    group: "workspace",
    // Deliberately a *subset* of Activity, not a duplicate of it: this feed
    // carries read/dismissed state and only the kinds worth interrupting
    // someone about. Activity is the log itself, exports included.
    icon: Bell,
    hint: "Finished runs worth your attention, with read state",
  },
  {
    href: "/settings",
    source: "settings",
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

/** The view that publishes under a console channel. */
export function viewForSource(source: string): WorkbenchView | undefined {
  return VIEWS.find((v) => v.source === source)
}

/* ============================================================================
   Breadcrumbs
   ========================================================================= */

/** One step in the trail. A crumb with no `href` is not somewhere you can go. */
export interface Crumb {
  label: string
  href?: string
  icon?: LucideIcon
  /**
   * True for a crumb the view has to fill in itself — an archived run's name.
   * The bar uses it to hold a placeholder rather than flicker the trail.
   */
  pending?: boolean
}

/**
 * Where a route sits, as a trail.
 *
 * The registry is flat as a *list*, which is why the bar this replaced was
 * removed — it drew a view's icon and name next to a tab already carrying both.
 * But the views are grouped, and two routes go deeper than a view: an archived
 * run at `/activity/<id>` and the redirect at `/amr-analysis-engine`. So the
 * hierarchy is `group → view → detail`, and a bare `/activity/l8x2k-3` is
 * exactly the case that needs saying out loud.
 *
 * The group is not a link. Groups are sidebar headings, not routes, and a crumb
 * that looks clickable and refuses is worse than one that never offered.
 */
export function crumbsForPath(pathname: string): Crumb[] {
  const view = viewForPath(pathname)
  if (!view) return [{ label: "Workspace" }]

  const trail: Crumb[] = [
    { label: groupLabel(view) },
    { label: view.label, href: view.href, icon: view.icon },
  ]

  // Anything past the view's own route is a detail the view names itself —
  // see `useCrumb`. The id is the honest placeholder until it does.
  const rest = pathname.slice(view.href.length).replace(/^\/+|\/+$/g, "")
  if (rest) trail.push({ label: rest.split("/")[0], pending: true })

  return trail
}

/**
 * Reduce a link to the registry href it belongs to.
 *
 * Two things get in the way of a link being a tab id. A query string: the gene
 * library is opened as `…/gene-database?q=mecA` from the sidebar and the
 * palette. And a deeper segment: an archived run lives at `/activity/<id>`.
 * Neither is a registry href, and storing one in the open set produced a tab
 * that matched no view and was silently dropped from the strip — while still
 * accumulating, one entry per gene clicked, in the persisted layout.
 *
 * Resolving through {@link viewForPath} rather than only trimming the query
 * means every deep route the app grows is covered by construction instead of
 * needing its own special case here.
 */
export function normalizeHref(href: string): string {
  const index = href.indexOf("?")
  const path = index === -1 ? href : href.slice(0, index)
  return viewForPath(path)?.href ?? path
}
