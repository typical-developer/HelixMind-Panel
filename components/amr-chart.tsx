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
import { Chip, Pane, PaneHeader } from "@/components/workbench"

const AMR_DATA = [
  { antibiotic: "Fluoroquinolones", resistance: 65 },
  { antibiotic: "Carbapenems", resistance: 45 },
  { antibiotic: "Cephalosporins", resistance: 72 },
  { antibiotic: "Beta-lactams", resistance: 58 },
  { antibiotic: "Aminoglycosides", resistance: 38 },
  { antibiotic: "Tetracyclines", resistance: 52 },
]

/** Bars escalate from neutral to red as predicted resistance climbs. */
const fillForValue = (v: number) => {
  if (v >= 70) return "var(--red-700)"
  if (v >= 55) return "var(--amber-700)"
  return "var(--gray-500)"
}

export function AMRChart() {
  const critical = AMR_DATA.filter((d) => d.resistance >= 70).length

  return (
    <Pane className="min-h-0">
      <PaneHeader
        icon={ShieldAlert}
        title="Resistance prediction"
        subtitle="by antibiotic class (%)"
        actions={
          critical > 0 ? <Chip tone="danger">{critical} critical</Chip> : null
        }
      />

      <div className="min-h-0 flex-1 p-3">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={AMR_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid {...CHART_GRID} />
            <XAxis dataKey="antibiotic" {...CHART_AXIS} interval={0} height={44} angle={-18} textAnchor="end" />
            <YAxis {...CHART_AXIS} unit="%" width={44} />
            <Tooltip {...CHART_TOOLTIP} formatter={(v) => [`${v}%`, "Resistance"]} />
            <Bar dataKey="resistance" radius={[3, 3, 0, 0]} maxBarSize={44}>
              {AMR_DATA.map((entry) => (
                <Cell key={entry.antibiotic} fill={fillForValue(entry.resistance)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Pane>
  )
}
