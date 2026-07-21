import type { ReactNode } from "react"

interface StatCardProps {
  title: string
  value: string | number
  icon?: ReactNode
  trend?: string
  alert?: boolean
}

export function StatCard({ title, value, icon, trend, alert }: StatCardProps) {
  return (
    <div
      className={`glass card-hover group relative overflow-hidden p-5 ${
        alert ? "pulse-alert !border-destructive/50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        {icon && (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 transition-colors ${
              alert
                ? "bg-destructive/15 text-destructive"
                : "bg-white/5 text-foreground group-hover:bg-white/10"
            }`}
          >
            <span className="[&_svg]:h-5 [&_svg]:w-5">{icon}</span>
          </div>
        )}
      </div>

      <p
        className={`mt-4 text-3xl font-semibold tabular-nums tracking-tight ${
          alert ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </p>

      {trend && (
        <p
          className={`mt-1.5 text-xs ${
            alert ? "text-destructive/80" : "text-muted-foreground"
          }`}
        >
          {trend}
        </p>
      )}
    </div>
  )
}
