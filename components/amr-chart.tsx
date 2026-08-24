"use client"

import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ShieldAlert } from "lucide-react"

import { CHART_AXIS, CHART_GRID, CHART_TOOLTIP } from "@/lib/chart-theme"
import { useLabSnapshot } from "@/lib/lab-snapshot"
import {
  Chip,
  EmptyState,
  Pane,
  PaneHeader,
  useWorkbench,
} from "@/components/workbench"

/** Bars escalate from neutral to red as predicted resistance climbs. */
const fillForValue = (v: number) => {
  if (v >= 90) return "var(--red-700)"
  if (v >= 70) return "var(--amber-700)"
  return "var(--gray-500)"
}

/**
 * Confidence per drug class, from the most recent prediction.
 *
 * The six bars here were a literal — Fluoroquinolones 65%, Carbapenems 45%, and
 * so on — that never moved regardless of what the Resistance Predictor had been
 * asked. They are that engine's actual output now.
 */
export function AMRChart() {
  const { prediction } = useLabSnapshot()
  const { openTab } = useWorkbench()

  if (!prediction || prediction.calls.length === 0) {
    return (
      <Pane className="min-h-0">
        <PaneHeader icon={ShieldAlert} title="Resistance prediction" />
        <EmptyState
          icon={ShieldAlert}
          title="No prediction yet"
          description="Select resistance markers in the Resistance Predictor and its confidence per drug class is charted here."
          action={
            <button
              type="button"
              onClick={() => openTab("/amr-analysis-engine/resistance-predictor")}
              className="cursor-pointer rounded-sm border border-border px-2 py-1 text-xs text-foreground/85 transition-colors hover:bg-[var(--wb-active)] focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
            >
              Open the Resistance Predictor
            </button>
          }
        />
      </Pane>
    )
  }

  const data = prediction.calls.map((call) => ({
    antibiotic: call.drugClass,
    resistance: Math.round(call.score * 100),
    genes: call.genes.join(", "),
  }))

  const critical = data.filter((d) => d.resistance >= 90).length

  return (
    <Pane className="min-h-0">
      <PaneHeader
        icon={ShieldAlert}
        title="Resistance prediction"
        subtitle={`${prediction.organism} · confidence by drug class (%)`}
        actions={
          critical > 0 ? <Chip tone="danger">{critical} high</Chip> : null
        }
      />

      <div className="min-h-0 flex-1 p-3">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid {...CHART_GRID} />
            <XAxis
              dataKey="antibiotic"
              {...CHART_AXIS}
              interval={0}
              height={44}
              angle={-18}
              textAnchor="end"
            />
            <YAxis {...CHART_AXIS} unit="%" width={44} domain={[0, 100]} />
            <Tooltip
              {...CHART_TOOLTIP}
              formatter={(value, _name, entry) => [
                `${value}% · ${entry?.payload?.genes ?? ""}`,
                "Confidence",
              ]}
            />
            <Bar dataKey="resistance" radius={[3, 3, 0, 0]} maxBarSize={44}>
              {data.map((entry) => (
                <Cell key={entry.antibiotic} fill={fillForValue(entry.resistance)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Pane>
  )
}
