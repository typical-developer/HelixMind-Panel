"use client"

import { useMemo } from "react"
import dynamic from "next/dynamic"
import {
  Activity,
  ArrowRight,
  Clock,
  Gauge,
  ScanLine,
  ShieldAlert,
  Split,
  FlaskConical,
  type LucideIcon,
} from "lucide-react"

import { ChartFallback } from "@/components/chart-fallback"
import { DNAViewer } from "@/components/dna-viewer"
import { MutationTable } from "@/components/mutation-table"
import { Skeleton } from "@/components/ui/skeleton"
import { formatBytes, measureUsage } from "@/lib/storage"
import { archiveUsage, useArchiveState, useArchivedRuns } from "@/lib/run-archive"
import {
  formatRelative,
  useActivity,
  useActivitySummary,
  useEngineReports,
  useRelativeClock,
  type ActivityEvent,
  type EngineId,
} from "@/lib/activity-store"
import {
  Chip,
  EmptyState,
  InspectorScroll,
  ViewLayout,
  ViewScroll,
  Pane,
  PaneHeader,
  Row,
  RowIcon,
  Rule,
  StatTile,
  useConsole,
  useStatusItems,
  useViewContext,
  useWorkbench,
} from "@/components/workbench"

// Below the fold and pulls in recharts, so it loads on the client after the
// shell. The placeholder reserves height to avoid a layout shift on mount.
const AMRChart = dynamic(
  () => import("@/components/amr-chart").then((m) => m.AMRChart),
  {
    ssr: false,
    loading: () => (
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex h-8 items-center gap-2 border-b border-border px-3">
          <Skeleton className="size-3.5 rounded-xs" />
          <Skeleton className="h-2.5 w-32" />
        </div>
        <ChartFallback height={292} />
      </div>
    ),
  },
)

/**
 * Icons for the activity feed, by the engine that raised the event.
 *
 * The feed used to be a hardcoded array of five plausible-looking rows —
 * "sample_A12.fasta scanned, 2m ago", "blaOXA-48 detected, 1h ago" — on a
 * workspace that had never run anything. It reads from the activity log now,
 * so an empty lab looks empty.
 */
const EVENT_ICON: Record<EngineId, LucideIcon> = {
  scanner: ScanLine,
  simulator: Split,
  growth: FlaskConical,
  amr: ShieldAlert,
}

/** Rows in the Overview's activity pane before it defers to the Activity view. */
const RECENT_EVENTS = 12

const SEVERITY_CLASS = {
  danger: "text-destructive",
  warning: "text-warning",
  success: "text-success",
  info: "text-info",
} as const

export default function Dashboard() {
  const { openTab } = useWorkbench()
  const { runStatus, alerts } = useConsole()
  const summary = useActivitySummary()

  /**
   * Every readout below is derived, and every one of them can be zero.
   *
   * The four tiles previously read 24,521 / 7 / 3 / 99.2% as string literals.
   * A number a workspace cannot account for is worse than no number: it tells
   * an operator the lab has done work it has not done.
   */
  useStatusItems(
    useMemo(
      () => [
        {
          id: "sequences",
          label: `${summary.sequencesAnalysed.toLocaleString()} sequence${
            summary.sequencesAnalysed === 1 ? "" : "s"
          }`,
          title: "Total sequences parsed by the scanner in this workspace",
          onClick: () => openTab("/dna-scanner"),
        },
        {
          id: "threats",
          icon: ShieldAlert,
          label: `${summary.threatCount} AMR threat${
            summary.threatCount === 1 ? "" : "s"
          }`,
          tone: summary.threatCount > 0 ? ("danger" as const) : ("default" as const),
          // The reported bug: this item had no handler at all, so the status
          // bar rendered it as inert text. High-confidence calls come from the
          // Resistance Predictor, so that is where it goes.
          title:
            summary.threatCount > 0
              ? "High-confidence resistance calls — open the Resistance Predictor"
              : "No high-confidence resistance calls yet — open the Resistance Predictor",
          onClick: () => openTab("/amr-analysis-engine/resistance-predictor"),
        },
      ],
      [openTab, summary.sequencesAnalysed, summary.threatCount],
    ),
  )

  useViewContext(
    summary.lastActivityAt === null
      ? "No analyses run in this workspace yet"
      : `${summary.runsCompleted} run${
          summary.runsCompleted === 1 ? "" : "s"
        } · last activity ${formatRelative(summary.lastActivityAt)}`,
  )

  const activeRuns = runStatus?.state === "running" ? 1 : 0
  const openAlerts = alerts.filter((a) => a.severity !== "info").length

  return (
    <ViewLayout inspectorId="overview" inspector={<OverviewInspector />}>
      <ViewScroll>
        <div className="flex flex-col gap-3 p-3">
          {/* Keyed to the bench's width, not the window's: with the inspector
              open a "wide" viewport can still leave a narrow bench, and four
              metric tiles across it would be unreadable. */}
          <div className="grid grid-cols-1 gap-3 @sm/bench:grid-cols-2 @4xl/bench:grid-cols-4">
            <StatTile
              label="Sequences analysed"
              value={summary.sequencesAnalysed.toLocaleString()}
              hint={
                summary.sequencesAnalysed === 0
                  ? "Run a scan to get started"
                  : `across ${summary.runsCompleted} run${
                      summary.runsCompleted === 1 ? "" : "s"
                    }`
              }
            />
            <StatTile
              label="Running now"
              value={activeRuns}
              hint={
                activeRuns > 0
                  ? (runStatus?.label ?? "in progress")
                  : "nothing in progress"
              }
              tone={activeRuns > 0 ? "positive" : "default"}
            />
            <StatTile
              label="AMR threats"
              value={summary.threatCount}
              hint={
                summary.threatCount === 0
                  ? "no high-confidence calls"
                  : "high-confidence resistance calls"
              }
              tone={summary.threatCount > 0 ? "critical" : "default"}
            />
            <StatTile
              label="Open alerts"
              value={openAlerts}
              hint={
                openAlerts === 0 ? "nothing needs attention" : "in the console"
              }
              tone={openAlerts > 0 ? "warning" : "default"}
            />
          </div>

          {/* Every panel below this point is empty until something has been
              run, which is honest but unhelpful on a first visit. This is the
              way in, and it disappears the moment the lab has been used. */}
          {summary.runsCompleted === 0 && <GettingStarted />}

          {/* Sequence readout and mutation grid sit side by side once the bench
              is wide enough, so a sequence and the calls made against it read
              together; below that they stack rather than both being squeezed. */}
          <div className="grid gap-3 @5xl/bench:grid-cols-[1.35fr_1fr]">
            <DNAViewer />
            <MutationTable />
          </div>

          <AMRChart />
        </div>
      </ViewScroll>
    </ViewLayout>
  )
}

/**
 * The way into an empty lab.
 *
 * This is not a fifth copy of the sidebar tree — it appears only while
 * `runsCompleted` is zero and vanishes permanently after the first run. Each
 * row says what the engine needs from you, which the tree's one-line hints do
 * not, and the whole thing exists because every panel on this page is now
 * genuinely empty until you have done something.
 */
function GettingStarted() {
  const { openTab } = useWorkbench()

  const steps = [
    {
      icon: ScanLine,
      href: "/dna-scanner",
      title: "Scan a sequence",
      body: "Upload a FASTA file to get length, GC content and ORFs. Add a reference and it calls variants too.",
      hint: "Start here",
    },
    {
      icon: Split,
      href: "/mutation-simulator",
      title: "Simulate mutations",
      body: "Run a sequence forward through generations and watch fitness respond.",
    },
    {
      icon: FlaskConical,
      href: "/microbe-growth-lab",
      title: "Model growth",
      body: "Grow a culture under temperature, pH and antibiotic pressure.",
    },
    {
      icon: ShieldAlert,
      href: "/amr-analysis-engine/resistance-predictor",
      title: "Predict resistance",
      body: "Score resistance markers and see which drug classes they implicate.",
    },
  ]

  return (
    <Pane>
      <PaneHeader
        icon={Activity}
        title="Get started"
        subtitle="nothing has been run in this workspace yet"
      />
      <div className="grid gap-2 p-3 @3xl/bench:grid-cols-2">
        {steps.map((step) => (
          <button
            key={step.href}
            type="button"
            onClick={() => openTab(step.href)}
            className="card-hover flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-[var(--wb-raised)] p-3 text-left focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
          >
            <RowIcon icon={step.icon} size="4" className="text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {step.title}
                </span>
                {step.hint && <Chip tone="info">{step.hint}</Chip>}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {step.body}
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground/70">
        Press{" "}
        <kbd className="rounded-xs border border-border px-1 font-mono">Ctrl K</kbd>{" "}
        to search analyses and genes from anywhere.
      </p>
    </Pane>
  )
}

/**
 * There is no "Quick actions" pane here any more. It was a fourth copy of the
 * same four links already in the sidebar tree, the palette and the Runs panel.
 * What belongs in the Overview's inspector is state you cannot get elsewhere:
 * what just happened, and how the workspace is doing.
 */
function OverviewInspector() {
  const { openTab } = useWorkbench()
  const events = useActivity()
  const engines = useEngineReports()
  // Relative times go stale while a view sits open, so they are re-rendered on
  // the same cadence they are reported at.
  const now = useRelativeClock()

  // Measured once per mount, not once per event.
  //
  // This was keyed on `events`, which meant a synchronous sweep of every
  // `localStorage` key the panel owns ran on the completion of every scan,
  // simulation and export — with the dependency suppressed by a lint comment
  // because `measureUsage` does not actually read `events`. The figure is a
  // rough "how much is kept here", not a live meter, and a mount is often
  // enough for it.
  const usage = useMemo(() => measureUsage(), [])
  const runs = useArchivedRuns()
  const archiveState = useArchiveState()
  const archive = useMemo(() => archiveUsage(runs), [runs])

  return (
    <InspectorScroll>
      <Pane>
        <PaneHeader
          icon={Clock}
          title="Recent activity"
          subtitle={events.length > 0 ? `${events.length} events` : undefined}
        />
        {events.length === 0 ? (
          <p className="px-3 py-3 text-xs leading-relaxed text-muted-foreground/70">
            Nothing yet. Scans, simulations and predictions are logged here as
            you run them.
          </p>
        ) : (
          <div>
            {events.slice(0, RECENT_EVENTS).map((event) => (
              <ActivityRow
                key={event.id}
                event={event}
                now={now}
                onOpen={() => event.href && openTab(event.href)}
              />
            ))}
          </div>
        )}
        {/* The log holds 200 events and this pane shows twelve. Until there
            was somewhere to send you, the other 188 were recorded, persisted
            and counted in the figures above — and unreachable. */}
        {events.length > RECENT_EVENTS && (
          <button
            type="button"
            onClick={() => openTab("/activity")}
            className="row-hover flex w-full cursor-pointer items-center gap-1.5 border-t border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset"
          >
            View all {events.length} events
            <ArrowRight className="ml-auto size-3" />
          </button>
        )}
      </Pane>

      <Pane>
        <PaneHeader icon={Gauge} title="Workspace" />
        <div className="space-y-2.5 p-3">
          <Rule label="Storage" />
          <div className="space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">Log, layout and feed</span>
              <span className="font-mono text-foreground/80 tabular">
                {formatBytes(usage.bytes)}
              </span>
            </div>
            {/* Archived results are the bulky half and live in a different
                store, so reporting one total would understate what is actually
                on this machine.

                Held back until the archive has hydrated. IndexedDB is
                asynchronous, so the honest reading for the first frame or two is
                "not known yet" — printing "0 archived results" and then
                correcting it to eleven is the same class of untruth the rest of
                this pane exists to avoid, just briefer. */}
            {archiveState !== "loading" && (
              <button
                type="button"
                onClick={() => openTab("/activity")}
                className="row-hover animate-fade-in flex w-full cursor-pointer items-baseline justify-between rounded-sm text-left text-xs focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                title="Open Activity to browse, reopen or export archived runs"
              >
                <span className="text-muted-foreground">
                  {archive.runs} archived result{archive.runs === 1 ? "" : "s"}
                </span>
                <span className="font-mono text-foreground/80 tabular">
                  {formatBytes(archive.bytes)}
                </span>
              </button>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground/70">
              {/* The pane used to draw a "4.2 / 10 GB" bar at a hardcoded 42%.
                  There is no server-side store and no quota to report — the
                  panel keeps everything in this browser, so that is what it
                  says. */}
              {archiveState === "unavailable"
                ? "This browser will not let the panel store results, so runs cannot be reopened later. Export them instead."
                : "Runs, their results, notifications and layout are kept on this device. Nothing is uploaded."}
            </p>
          </div>

          <Rule label="Engines" />
          <div className="space-y-1.5 text-xs">
            {engines.map((engine) => (
              <button
                key={engine.id}
                type="button"
                onClick={() => openTab(engine.href)}
                title={
                  engine.lastRunAt
                    ? `${engine.runs} run${
                        engine.runs === 1 ? "" : "s"
                      } · last ${formatRelative(engine.lastRunAt, now)}`
                    : "Not used in this workspace yet"
                }
                className="row-hover flex w-full cursor-pointer items-center justify-between rounded-sm px-1 py-0.5 text-left focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
              >
                <span className="truncate text-muted-foreground">
                  {engine.label}
                </span>
                <Chip tone={engine.state === "operational" ? "success" : "neutral"}>
                  {engine.state === "operational" ? "used" : "idle"}
                </Chip>
              </button>
            ))}
          </div>
        </div>
      </Pane>
    </InspectorScroll>
  )
}

function ActivityRow({
  event,
  now,
  onOpen,
}: {
  event: ActivityEvent
  now: number
  onOpen: () => void
}) {
  return (
    <Row
      icon={EVENT_ICON[event.engine] ?? Activity}
      iconClassName={SEVERITY_CLASS[event.severity] ?? "text-muted-foreground"}
      label={event.label}
      description={`${event.detail ? `${event.detail} · ` : ""}${formatRelative(
        event.ts,
        now,
      )}`}
      onClick={event.href ? onOpen : undefined}
      title={event.href ? "Open the analysis that raised this" : undefined}
    />
  )
}
