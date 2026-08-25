"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleSlash,
  Download,
  FileWarning,
  FlaskConical,
  Info,
  ScanLine,
  ShieldAlert,
  Split,
  type LucideIcon,
} from "lucide-react"

import { downloadJSON, fileStamp, safeFilename } from "@/lib/download"
import { formatBytes } from "@/lib/storage"
import { formatRelative, useRelativeClock, type EngineId } from "@/lib/activity-store"
import {
  loadRun,
  useArchiveState,
  type ArchivedRun,
} from "@/lib/run-archive"
import { Button } from "@/components/ui/button"
import {
  Chip,
  CodeSurface,
  EmptyState,
  Pane,
  PaneHeader,
  Row,
  Rule,
  ViewScroll,
  useStatusItems,
  useViewContext,
  useWorkbench,
} from "@/components/workbench"

import { ResultView } from "./result-view"

/**
 * One archived run, reopened.
 *
 * This is the view the panel was missing. A finished analysis used to leave
 * behind a label and a duration; the numbers it produced went with the
 * component that computed them. Everything here comes out of the archive, so a
 * run from last week reads exactly as it did the moment it finished — including
 * the two fields that make it evidence rather than an anecdote: the parameters
 * it ran with, and the seed that would reproduce it.
 */

const ENGINE: Record<EngineId, { icon: LucideIcon; label: string }> = {
  scanner: { icon: ScanLine, label: "DNA Scanner" },
  simulator: { icon: Split, label: "Mutation Simulator" },
  growth: { icon: FlaskConical, label: "Microbe Growth Lab" },
  amr: { icon: ShieldAlert, label: "Resistance Predictor" },
}

export default function RunDetailPage() {
  const params = useParams<{ runId: string }>()
  const runId = params?.runId
  const archiveState = useArchiveState()
  const { openTab } = useWorkbench()
  const now = useRelativeClock()

  const [run, setRun] = React.useState<ArchivedRun | null>(null)
  const [status, setStatus] = React.useState<"loading" | "ready" | "missing">(
    "loading",
  )

  React.useEffect(() => {
    let live = true
    if (!runId) return
    setStatus("loading")
    loadRun(runId).then((found) => {
      if (!live) return
      setRun(found)
      setStatus(found ? "ready" : "missing")
    })
    return () => {
      live = false
    }
  }, [runId])

  useStatusItems(
    React.useMemo(
      () =>
        run
          ? [
              {
                id: "run-outcome",
                label: run.outcome,
                title: `Recorded ${new Date(run.endedAt).toLocaleString()} by ${run.appVersion}`,
                tone:
                  run.outcome === "completed"
                    ? ("success" as const)
                    : ("default" as const),
              },
            ]
          : [],
      [run],
    ),
  )

  useViewContext(
    run
      ? `${ENGINE[run.engine]?.label ?? run.engine} · ${formatRelative(run.endedAt, now)}`
      : null,
  )

  if (status === "loading") {
    return (
      <ViewScroll>
        <div className="mx-auto max-w-3xl p-3">
          <Pane>
            <div className="sk h-8 rounded-none" />
            <div className="space-y-2 p-3">
              <div className="sk h-4 w-1/2" />
              <div className="sk h-4 w-1/3" style={{ "--sk-delay": "80ms" } as React.CSSProperties} />
            </div>
          </Pane>
        </div>
      </ViewScroll>
    )
  }

  if (status === "missing" || !run) {
    return (
      <ViewScroll>
        <div className="mx-auto max-w-3xl p-3">
          <Pane>
            <EmptyState
              icon={FileWarning}
              title="That run is not in the archive"
              description={
                archiveState === "unavailable"
                  ? "This browser will not let the panel store results — private browsing and blocked site data both do this. Runs still work; they just cannot be kept."
                  : "It may have been cleared, or evicted to make room for newer runs. The archive keeps the 100 most recent."
              }
              action={
                <Button variant="secondary" size="sm" onClick={() => openTab("/activity")}>
                  <ArrowLeft className="size-3.5" />
                  Back to activity
                </Button>
              }
            />
          </Pane>
        </div>
      </ViewScroll>
    )
  }

  const engine = ENGINE[run.engine]
  const duration = run.endedAt - run.startedAt

  return (
    <ViewScroll>
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-3">
        <Pane>
          <PaneHeader
            icon={engine?.icon ?? Info}
            title={run.label}
            subtitle={run.detail}
            actions={
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => openTab(run.href)}
                >
                  Open {engine?.label ?? "analysis"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() =>
                    downloadJSON(
                      {
                        exportedAt: new Date().toISOString(),
                        run: {
                          ...run,
                          startedAt: new Date(run.startedAt).toISOString(),
                          endedAt: new Date(run.endedAt).toISOString(),
                          durationMs: duration,
                        },
                      },
                      {
                        filename: `${safeFilename(run.label)}-${fileStamp(new Date(run.endedAt))}.json`,
                        engine: run.engine,
                        description: "Archived run, with its parameters and result.",
                      },
                    )
                  }
                >
                  <Download className="size-3.5" />
                  Export
                </Button>
              </>
            }
          />

          <Row
            icon={run.outcome === "completed" ? CheckCircle2 : CircleSlash}
            iconClassName={
              run.outcome === "completed" ? "text-success" : "text-muted-foreground"
            }
            label={new Date(run.endedAt).toLocaleString()}
            description={`ran for ${formatDuration(duration)} · ${formatRelative(run.endedAt, now)}`}
            trailing={
              <Chip tone={run.outcome === "completed" ? "success" : "neutral"}>
                {run.outcome}
              </Chip>
            }
          />
        </Pane>

        {/* The headline numbers, straight off the record. */}
        <Pane>
          <PaneHeader title="Result" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 @xl/bench:grid-cols-3">
            {Object.entries(run.summary).map(([key, value]) => (
              <div key={key} className="min-w-0">
                <dt className="truncate text-xs text-muted-foreground">
                  {humanise(key)}
                </dt>
                <dd className="truncate text-sm font-medium text-foreground tabular">
                  {typeof value === "number" ? value.toLocaleString() : value}
                </dd>
              </div>
            ))}
          </dl>
        </Pane>

        {/*
          Provenance.

          This pane is the reason the archive exists. A result nobody can trace
          back to its inputs, its parameters, its seed and the build that
          produced it is not reproducible, and reproducibility is the whole
          complaint the AMR-genomics literature keeps making about tools like
          this one — see docs/DOMAIN-RESEARCH.md.
        */}
        <Pane>
          <PaneHeader title="Provenance" subtitle="what would reproduce this" />
          <div className="space-y-3 p-3">
            <Rule label="Input" />
            <KeyValues values={run.inputs} />

            <Rule label="Parameters" />
            <KeyValues values={run.params} />

            <Rule label="Run" />
            <KeyValues
              values={{
                seed: run.seed ?? "not seeded",
                build: run.appVersion,
                engine: engine?.label ?? run.engine,
                "result size": formatBytes(run.bytes),
              }}
            />
          </div>
        </Pane>

        {/* The result, drawn the way its engine drew it — see result-view.tsx
            for why these renderers are separate from the live views. */}
        <Pane>
          <PaneHeader title="What it found" subtitle="as archived" />
          <ResultView engine={run.engine} payload={run.payload} />
        </Pane>

        <details className="group rounded-lg border border-border bg-surface">
          <summary className="row-hover flex h-8 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground select-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none">
            <ChevronRight className="size-3.5 shrink-0 transition-transform duration-150 group-open:rotate-90" />
            Raw record
          </summary>
          {/* Kept, and kept collapsed. The rendered view above is what someone
              reads; this is what they hand to a colleague or paste into a
              ticket, and it is the fallback if a renderer ever misses a field. */}
          <div className="border-t border-border p-3">
            <CodeSurface className="max-h-96">
              {JSON.stringify(run.payload, null, 2)}
            </CodeSurface>
          </div>
        </details>
      </div>
    </ViewScroll>
  )
}

/**
 * Field names, as a person would write them.
 *
 * `finalPopulation` → `Final population`, `gcContent` → `GC content`.
 *
 * The acronym table is the point. Naive camel-case splitting turns `gcContent`
 * into "Gc Content", which in a genomics tool reads as a typo — GC content is
 * the name of the measurement, not two words. Same for the rest of these:
 * they are terms of art, and a panel that mangles them looks like it does not
 * know the domain.
 */
const ACRONYMS: Record<string, string> = {
  gc: "GC",
  amr: "AMR",
  orf: "ORF",
  orfs: "ORFs",
  dna: "DNA",
  rna: "RNA",
  id: "ID",
  ph: "pH",
  mic: "MIC",
}

function humanise(key: string): string {
  // Whole-key match first. `pH` is lower-then-upper, so splitting on the case
  // change would tear it into "p H" before the table ever sees it — and "P h"
  // in a growth-lab readout is worse than no formatting at all.
  const whole = ACRONYMS[key.toLowerCase()]
  if (whole) return whole

  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)

  return words
    .map((word, i) => {
      const acronym = ACRONYMS[word.toLowerCase()]
      if (acronym) return acronym
      // Sentence case, not title case — only the first word is capitalised.
      return i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word.toLowerCase()
    })
    .join(" ")
}

function KeyValues({ values }: { values: Record<string, unknown> }) {
  const entries = Object.entries(values).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  )

  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground/70">Nothing recorded.</p>
  }

  return (
    <dl className="space-y-1">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-baseline justify-between gap-3 text-xs">
          <dt className="shrink-0 text-muted-foreground">{humanise(key)}</dt>
          <dd className="min-w-0 truncate text-right font-mono text-foreground/85 tabular">
            {Array.isArray(value)
              ? value.join(", ")
              : typeof value === "object"
                ? JSON.stringify(value)
                : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${Math.round(seconds % 60)}s`
}
