"use client"

import * as React from "react"
import dynamic from "next/dynamic"

import { cn } from "@/lib/utils"
import { ChartFallback } from "@/components/chart-fallback"
import { Chip, CodeSurface, DataTable, Th } from "@/components/workbench"
import type { EngineId } from "@/lib/activity-store"

/**
 * An archived run's result, drawn the way its engine drew it.
 *
 * The detail view could show the stored payload as JSON and be *complete* — but
 * a reopened run should read like the analysis did, not like a database dump.
 * Someone coming back to a scan from last week wants the variant table they
 * were looking at, not to parse `{"position":31,"refBase":"A"}` by eye.
 *
 * These are deliberately separate from the live views rather than shared with
 * them. `components/mutation-table.tsx` and the engine pages read from stores —
 * the lab snapshot, component state — so reusing them would mean rewiring the
 * live path to render archived data, and a bug there would break the analysis
 * itself. The charts *are* reused, because they already take their data as
 * props.
 *
 * Unknown or malformed payloads fall through to the JSON, so a record written
 * by an older build is still readable rather than a blank pane.
 */

const RunChart = dynamic(
  () => import("../../mutation-simulator/run-chart").then((m) => m.RunChart),
  { ssr: false, loading: () => <ChartFallback height={260} /> },
)

const PopulationChart = dynamic(
  () =>
    import("../../microbe-growth-lab/population-chart").then(
      (m) => m.PopulationChart,
    ),
  { ssr: false, loading: () => <ChartFallback height={260} /> },
)

export function ResultView({
  engine,
  payload,
}: {
  engine: EngineId
  payload: unknown
}) {
  if (!payload || typeof payload !== "object") return <RawResult payload={payload} />
  const data = payload as Record<string, unknown>

  if (engine === "scanner") return <ScanResult data={data} />
  if (engine === "simulator") return <SimulationResult data={data} />
  if (engine === "growth") return <GrowthResult data={data} />
  if (engine === "amr") return <PredictionResult data={data} />
  return <RawResult payload={payload} />
}

/* ============================================================================
   Scanner — called variants
   ========================================================================= */

interface ArchivedMutation {
  position: number
  refBase: string
  varBase: string
  substitution: "transition" | "transversion"
}

function ScanResult({ data }: { data: Record<string, unknown> }) {
  const mutations = asArray<ArchivedMutation>(data.mutations)
  const total = typeof data.mutationCount === "number" ? data.mutationCount : mutations.length
  const preview = typeof data.preview === "string" ? data.preview : ""
  const previewOf = typeof data.previewOf === "number" ? data.previewOf : preview.length

  if (mutations.length === 0) {
    return (
      <div className="space-y-3">
        <p className="px-3 py-3 text-xs leading-relaxed text-muted-foreground">
          {total === 0
            ? "No differences were called. The target matched its reference at every compared position."
            : "This run recorded no variant detail."}
        </p>
        {preview && <SequencePreview preview={preview} previewOf={previewOf} />}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <DataTable minWidth="22rem" containerClassName="max-h-80 flex-none">
        <thead>
          <tr>
            {["Position", "Change", "Class"].map((h) => (
              <Th key={h}>{h}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
            {mutations.map((m) => (
              <tr
                key={m.position}
                className="row-hover border-b border-border/50 last:border-0"
              >
                <td className="px-3 py-2 font-mono text-foreground tabular">
                  {m.position.toLocaleString()}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 font-mono font-medium",
                    m.substitution === "transversion"
                      ? "text-warning"
                      : "text-foreground",
                  )}
                >
                  {m.refBase}→{m.varBase}
                </td>
                <td className="px-3 py-2">
                  <Chip tone={m.substitution === "transversion" ? "warning" : "neutral"}>
                    {m.substitution}
                  </Chip>
                </td>
              </tr>
            ))}
          </tbody>
      </DataTable>

      {/* The archive bounds what a scan contributes, so a listing that stopped
          silently would misreport how many variants the run actually found. */}
      {total > mutations.length && (
        <p className="px-3 text-xs text-muted-foreground/70">
          Showing {mutations.length.toLocaleString()} of {total.toLocaleString()}{" "}
          variants. The rest were not archived — re-run the scan to see them all.
        </p>
      )}

      {preview && <SequencePreview preview={preview} previewOf={previewOf} />}
    </div>
  )
}

function SequencePreview({
  preview,
  previewOf,
}: {
  preview: string
  previewOf: number
}) {
  return (
    <div className="space-y-1 px-3 pb-3">
      <p className="text-xs font-medium text-foreground/80">Sequence</p>
      <CodeSurface className="max-h-40 break-all">{preview}</CodeSurface>
      {previewOf > preview.length && (
        <p className="text-xs text-muted-foreground/70">
          First {preview.length.toLocaleString()} of{" "}
          {previewOf.toLocaleString()} bases. The whole strand stays in your own
          file — the archive keeps what the panel derived.
        </p>
      )}
    </div>
  )
}

/* ============================================================================
   Simulator — the generation series
   ========================================================================= */

function SimulationResult({ data }: { data: Record<string, unknown> }) {
  const stats = asArray<{
    generation: number
    fitness: number
    cumulativeMutations: number
    mutationCount: number
    progress: number
  }>(data.generationStats)

  if (stats.length === 0) {
    return (
      <p className="px-3 py-3 text-xs text-muted-foreground">
        This run recorded no generations.
      </p>
    )
  }

  return (
    <div className="space-y-3 p-3">
      <RunChart data={stats} />
      <DataTable containerClassName="max-h-56 flex-none rounded-md border border-border">
        <thead>
          <tr>
            {["Generation", "New", "Cumulative", "Fitness"].map((h) => (
              <Th key={h} className="py-1.5">
                {h}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
            {stats.map((s) => (
              <tr
                key={s.generation}
                className="row-hover border-b border-border/50 last:border-0"
              >
                <td className="px-3 py-1.5 font-mono tabular">{s.generation}</td>
                <td className="px-3 py-1.5 font-mono tabular">{s.mutationCount}</td>
                <td className="px-3 py-1.5 font-mono tabular">
                  {s.cumulativeMutations}
                </td>
                <td
                  className={cn(
                    "px-3 py-1.5 font-mono tabular",
                    s.fitness < 60 ? "text-warning" : "text-foreground",
                  )}
                >
                  {s.fitness.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
      </DataTable>
      <Note text={data.note} />
    </div>
  )
}

/* ============================================================================
   Growth lab — the curve, and what the culture did
   ========================================================================= */

function GrowthResult({ data }: { data: Record<string, unknown> }) {
  const history = asArray<{ time: number; population: number }>(data.growthHistory)
  const log = asArray<string>(data.adaptationLog)

  if (history.length === 0) {
    return (
      <p className="px-3 py-3 text-xs text-muted-foreground">
        This experiment recorded no growth points.
      </p>
    )
  }

  return (
    <div className="space-y-3 p-3">
      <div className="h-64">
        <PopulationChart data={history} />
      </div>
      {log.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground/80">Adaptation log</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {log.map((line, i) => (
              <li key={i} className="font-mono">
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Note text={data.note} />
    </div>
  )
}

/* ============================================================================
   Resistance predictor — the calls
   ========================================================================= */

interface ArchivedCall {
  drugClass: string
  antibiotics?: string[]
  genes?: string[]
  mechanisms?: string[]
  isSynergistic?: boolean
  confidence?: { level?: string; score?: number }
}

function PredictionResult({ data }: { data: Record<string, unknown> }) {
  const calls = asArray<ArchivedCall>(data.calls)

  if (calls.length === 0) {
    return (
      <p className="px-3 py-3 text-xs text-muted-foreground">
        No drug classes were implicated by the selected markers.
      </p>
    )
  }

  return (
    <div className="space-y-2 p-3">
      {calls.map((call) => {
        const level = call.confidence?.level ?? "Unknown"
        const score = call.confidence?.score
        return (
          <div
            key={call.drugClass}
            className="rounded-md border border-border bg-[var(--wb-raised)] p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {call.drugClass}
              </span>
              <Chip
                tone={
                  level === "High" ? "danger" : level === "Moderate" ? "warning" : "neutral"
                }
              >
                {level}
                {typeof score === "number" ? ` · ${Math.round(score * 100)}%` : ""}
              </Chip>
              {call.isSynergistic && <Chip tone="warning">synergistic</Chip>}
            </div>
            <dl className="mt-2 space-y-1 text-xs">
              <Detail label="Markers" values={call.genes} mono />
              <Detail label="Antibiotics" values={call.antibiotics} />
              <Detail label="Mechanism" values={call.mechanisms} />
            </dl>
          </div>
        )
      })}
      <Note text={data.note} />
    </div>
  )
}

function Detail({
  label,
  values,
  mono,
}: {
  label: string
  values?: string[]
  mono?: boolean
}) {
  if (!values || values.length === 0) return null
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 text-foreground/85", mono && "font-mono")}>
        {values.join(", ")}
      </dd>
    </div>
  )
}

/* ============================================================================
   Shared
   ========================================================================= */

/**
 * The caveat an engine recorded with its result.
 *
 * Carried through to here on purpose: an archived resistance profile has to
 * keep saying it is marker scoring rather than a susceptibility report, or the
 * caveat only ever applies to the run you are watching happen.
 */
function Note({ text }: { text: unknown }) {
  if (typeof text !== "string" || !text) return null
  return <p className="text-xs leading-relaxed text-muted-foreground/70">{text}</p>
}

function RawResult({ payload }: { payload: unknown }) {
  return (
    <div className="p-3">
      <CodeSurface className="max-h-96">
        {JSON.stringify(payload, null, 2)}
      </CodeSurface>
    </div>
  )
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}
