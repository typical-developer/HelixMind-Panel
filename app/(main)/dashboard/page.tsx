"use client"

import dynamic from "next/dynamic"
import { StatCard } from "@/components/stat-card"
import { DNAViewer } from "@/components/dna-viewer"
import { MutationTable } from "@/components/mutation-table"
import { AlertCircle, Activity, Shield } from "lucide-react"

// Below-the-fold + pulls in recharts. Load it on the client after the shell so
// it doesn't inflate the dashboard's initial JS. Placeholder reserves height to
// avoid layout shift when the chart mounts.
const AMRChart = dynamic(
  () => import("@/components/amr-chart").then((m) => m.AMRChart),
  {
    ssr: false,
    loading: () => (
      <div className="glass p-6 rounded-lg col-span-2 h-[372px] skeleton-shimmer" />
    ),
  },
)

export default function Dashboard() {
  return (
    <div className="ml-16 pt-16">
      <main className="mx-auto max-w-7xl container pt-8 bg-background min-w-full min-h-screen space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ">
          <StatCard
            title="Total Sequences Analyzed"
            value="24,521"
            icon={<Activity />}
            trend="↑ 12% from last week"
          />
          <StatCard title="Active Simulations" value="7" icon={<Shield />} trend="2 running now" />
          <StatCard
            title="Detected AMR Threats"
            value="3"
            alert={true}
            icon={<AlertCircle />}
            trend="Critical alert"
          />
        </div>

        <div className="grid grid-cols-1 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <DNAViewer />
            <MutationTable />
            <AMRChart />
          </div>
        </div>
      </main>
    </div>
  )
}
