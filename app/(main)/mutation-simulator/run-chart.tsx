"use client"

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import {
  CHART_AXIS,
  CHART_GRID,
  CHART_LEGEND,
  CHART_TOOLTIP,
  SERIES,
} from "@/lib/chart-theme"

export interface GenerationPoint {
  generation: number
  fitness: number
  cumulativeMutations: number
}

/**
 * Fitness against cumulative mutations across generations.
 *
 * Split out of the page so recharts loads as its own chunk — the simulator's
 * controls and readouts are interactive before the plot's code arrives.
 */
export function RunChart({ data }: { data: GenerationPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid {...CHART_GRID} />
        <XAxis dataKey="generation" {...CHART_AXIS} />
        <YAxis yAxisId="left" {...CHART_AXIS} width={40} />
        <YAxis yAxisId="right" orientation="right" {...CHART_AXIS} width={40} />
        <Tooltip {...CHART_TOOLTIP} />
        <Legend {...CHART_LEGEND} />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="fitness"
          stroke={SERIES.quaternary}
          strokeWidth={1.5}
          dot={{ fill: SERIES.quaternary, r: 2.5, strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          name="Fitness score"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="cumulativeMutations"
          stroke={SERIES.secondary}
          strokeWidth={1.5}
          dot={{ fill: SERIES.secondary, r: 2.5, strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          name="Total mutations"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
