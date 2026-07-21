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
    <div className={`glass card-hover p-6 rounded-lg ${alert ? "pulse-alert border-destructive" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-sm mb-2">{title}</p>
          <p className={`text-3xl font-bold ${alert ? "text-destructive" : ""}`}>{value}</p>
          {trend && <p className="text-xs text-primary mt-2">{trend}</p>}
        </div>
        {icon && <div className="text-2xl">{icon}</div>}
      </div>
    </div>
  )
}
