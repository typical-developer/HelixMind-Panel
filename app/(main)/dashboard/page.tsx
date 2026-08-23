"use client"

import { useMemo } from "react"
import dynamic from "next/dynamic"
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Clock,
  Dna,
  FlaskConical,
  Gauge,
  Play,
  ScanLine,
  Shield,
  Split,
} from "lucide-react"

import { DNAViewer } from "@/components/dna-viewer"
import { MutationTable } from "@/components/mutation-table"
import {
  Chip,
  EditorLayout,
  EditorScroll,
  Pane,
  PaneHeader,
  Rule,
  StatTile,
  useStatusItems,
  useWorkbench,
} from "@/components/workbench"

// Below the fold and pulls in recharts, so it loads on the client after the
// shell. The placeholder reserves height to avoid a layout shift on mount.
const AMRChart = dynamic(
  () => import("@/components/amr-chart").then((m) => m.AMRChart),
  {
    ssr: false,
    loading: () => (
      <div className="skeleton-shimmer h-[332px] rounded-lg border border-border bg-surface" />
    ),
  },
)

const ACTIVITY = [
  { icon: ScanLine, label: "sample_A12.fasta scanned", time: "2m ago", tone: "info" },
  { icon: Split, label: "Simulation run · 7 generations", time: "18m ago", tone: "neutral" },
  { icon: AlertCircle, label: "blaOXA-48 detected", time: "1h ago", tone: "danger" },
  { icon: FlaskConical, label: "E. coli growth curve exported", time: "3h ago", tone: "neutral" },
  { icon: Dna, label: "Reference genome indexed", time: "yesterday", tone: "success" },
] as const

const QUICK_ACTIONS = [
  { href: "/dna-scanner", icon: ScanLine, label: "Run DNA scan" },
  { href: "/mutation-simulator", icon: Split, label: "New mutation run" },
  { href: "/microbe-growth-lab", icon: FlaskConical, label: "New growth experiment" },
  { href: "/amr-analysis-engine/resistance-predictor", icon: Shield, label: "Predict resistance" },
] as const

export default function Dashboard() {
  useStatusItems(
    useMemo(
      () => [
        { id: "sequences", label: "24,521 sequences", title: "Total analysed" },
        { id: "threats", label: "3 AMR threats", tone: "danger" as const },
      ],
      [],
    ),
  )

  return (
    <EditorLayout inspectorId="overview" inspector={<OverviewInspector />}>
      <EditorScroll>
        <div className="flex flex-col gap-3 p-3">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatTile
              icon={Activity}
              label="Sequences analysed"
              value="24,521"
              hint="↑ 12% from last week"
            />
            <StatTile
              icon={Play}
              label="Active simulations"
              value="7"
              hint="2 running now"
              tone="positive"
            />
            <StatTile
              icon={AlertCircle}
              label="AMR threats"
              value="3"
              hint="Critical — review markers"
              tone="critical"
            />
            <StatTile
              icon={Gauge}
              label="Pipeline health"
              value="99.2%"
              hint="No failed jobs in 24h"
            />
          </div>

          {/* Sequence buffer and mutation grid sit side by side on wide screens,
              the way an editor pairs a file with its problems view. */}
          <div className="grid gap-3 xl:grid-cols-[1.35fr_1fr]">
            <DNAViewer />
            <MutationTable />
          </div>

          <AMRChart />
        </div>
      </EditorScroll>
    </EditorLayout>
  )
}

function OverviewInspector() {
  const { openTab } = useWorkbench()

  return (
    <div className="seq-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      <Pane>
        <PaneHeader icon={Play} title="Quick actions" />
        <div className="p-1.5">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.href}
              type="button"
              onClick={() => openTab(action.href)}
              className="row-hover group flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
            >
              <action.icon className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{action.label}</span>
              <ArrowUpRight className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
            </button>
          ))}
        </div>
      </Pane>

      <Pane>
        <PaneHeader icon={Clock} title="Recent activity" />
        <div className="divide-y divide-border/60">
          {ACTIVITY.map((item, i) => (
            <div key={i} className="row-hover flex items-start gap-2 px-3 py-2">
              <item.icon
                className={
                  item.tone === "danger"
                    ? "mt-0.5 size-3.5 shrink-0 text-destructive"
                    : item.tone === "success"
                      ? "mt-0.5 size-3.5 shrink-0 text-success"
                      : item.tone === "info"
                        ? "mt-0.5 size-3.5 shrink-0 text-brand-bright"
                        : "mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                }
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground/85">{item.label}</p>
                <p className="text-xs text-muted-foreground/70">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </Pane>

      <Pane>
        <PaneHeader icon={Gauge} title="Workspace" />
        <div className="space-y-2.5 p-3">
          <Rule label="Storage" />
          <div className="space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">Sequence store</span>
              <span className="font-mono text-foreground/80 tabular">4.2 / 10 GB</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-[var(--wb-active)]">
              <div className="h-full w-[42%] rounded-full bg-brand" />
            </div>
          </div>

          <Rule label="Engines" />
          <div className="space-y-1.5 text-xs">
            {[
              ["Scanner", "operational"],
              ["Simulator", "operational"],
              ["AMR engine", "operational"],
            ].map(([name, state]) => (
              <div key={name} className="flex items-center justify-between">
                <span className="text-muted-foreground">{name}</span>
                <Chip tone="success">{state}</Chip>
              </div>
            ))}
          </div>
        </div>
      </Pane>
    </div>
  )
}
