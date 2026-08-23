/**
 * Shared Recharts styling.
 *
 * Every chart in the workbench reads from here so axes, gridlines and tooltips
 * stay identical across the overview, the simulators and the AMR engine —
 * hairline grids, muted 11px labels and a bordered popover tooltip, matching
 * the rest of the panel chrome.
 */

export const CHART_GRID = {
  stroke: "var(--alpha-100)",
  strokeDasharray: "3 3",
  vertical: false,
} as const

export const CHART_AXIS = {
  stroke: "var(--gray-700)",
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--gray-700)", fontSize: 11 },
} as const

export const CHART_TOOLTIP = {
  cursor: { fill: "var(--alpha-100)", stroke: "var(--alpha-200)" },
  contentStyle: {
    background: "var(--wb-overlay)",
    border: "1px solid var(--alpha-400)",
    borderRadius: "6px",
    boxShadow: "var(--shadow-menu)",
    fontSize: "12px",
    padding: "6px 10px",
  },
  labelStyle: { color: "var(--gray-1000)", fontWeight: 500, marginBottom: 2 },
  itemStyle: { color: "var(--gray-900)", padding: 0 },
} as const

export const CHART_LEGEND = {
  wrapperStyle: { fontSize: 11, color: "var(--gray-900)", paddingTop: 4 },
  iconType: "plainline",
  iconSize: 10,
} as const

/** Series colours, drawn from the Geist accent ramp. */
export const SERIES = {
  primary: "var(--blue-900)",
  secondary: "var(--teal-700)",
  tertiary: "var(--amber-700)",
  quaternary: "var(--purple-700)",
  danger: "var(--red-900)",
} as const
