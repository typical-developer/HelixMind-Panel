"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { ShieldAlert } from "lucide-react"

const AMR_DATA = [
  { antibiotic: "Fluoroquinolones", resistance: 65 },
  { antibiotic: "Carbapenems", resistance: 45 },
  { antibiotic: "Cephalosporins", resistance: 72 },
  { antibiotic: "Beta-lactams", resistance: 58 },
  { antibiotic: "Aminoglycosides", resistance: 38 },
  { antibiotic: "Tetracyclines", resistance: 52 },
]

// Higher resistance reads as brighter (monochrome emphasis, no colour coding).
const fillForValue = (v: number) => {
  const opacity = 0.35 + (Math.min(v, 100) / 100) * 0.65
  return `rgba(244,244,244,${opacity.toFixed(2)})`
}

export function AMRChart() {
  return (
    <div className="glass p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold leading-tight">AMR Resistance Prediction</h3>
          <p className="text-xs text-muted-foreground">
            Predicted resistance level by antibiotic class (%)
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={AMR_DATA} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="antibiotic"
            stroke="#8b949e"
            tickLine={false}
            axisLine={false}
            style={{ fontSize: "11px" }}
          />
          <YAxis
            stroke="#8b949e"
            tickLine={false}
            axisLine={false}
            style={{ fontSize: "11px" }}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              backgroundColor: "oklch(0.225 0 0)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              color: "#e6e6e6",
              fontSize: "12px",
              boxShadow: "0 12px 32px -16px rgba(0,0,0,0.8)",
            }}
          />
          <Bar dataKey="resistance" radius={[6, 6, 0, 0]} maxBarSize={56}>
            {AMR_DATA.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={fillForValue(entry.resistance)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
