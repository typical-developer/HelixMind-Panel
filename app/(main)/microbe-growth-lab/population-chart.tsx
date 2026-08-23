"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { CHART_AXIS, CHART_GRID, CHART_TOOLTIP, SERIES } from "@/lib/chart-theme"

export interface PopulationPoint {
  time: number
  population: number
}

/**
 * Population over time.
 *
 * Split out of the page so recharts loads as its own chunk. The PNG export
 * reads the rendered SVG out of the container the page owns, so it is
 * unaffected by the chart arriving a moment later.
 */
export function PopulationChart({
  data,
  width,
}: {
  data: PopulationPoint[]
  width: number | string
}) {
  return (
    <ResponsiveContainer width={width} height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid {...CHART_GRID} />
        <XAxis
          dataKey="time"
          {...CHART_AXIS}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis {...CHART_AXIS} width={56} />
        <Tooltip
          {...CHART_TOOLTIP}
          formatter={(v: number) => [v.toLocaleString(), "Population"]}
          labelFormatter={(l) => `Step ${l}`}
        />
        <Line
          type="monotone"
          dataKey="population"
          stroke={SERIES.primary}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive
          animationDuration={280}
          animationEasing="linear"
          animationBegin={0}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
