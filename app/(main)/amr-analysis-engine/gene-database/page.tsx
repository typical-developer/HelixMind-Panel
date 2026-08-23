"use client"

import { useMemo, useState } from "react"
import { Bug, Clock, Database, Dna, Layers, Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { AMR_DATABASE_STATS, AMR_RECORDS } from "@/lib/amr-records"
import {
  Chip,
  ViewLayout,
  ViewScroll,
  EmptyState,
  Pane,
  PaneHeader,
  StatTile,
  ToolbarButton,
  WBInput,
  useStatusItems,
  useViewContext,
} from "@/components/workbench"

const STAT_ICONS = [Dna, Bug, Layers, Clock]

const COLUMNS = [
  "ID",
  "Gene",
  "Antibiotic",
  "Drug Class",
  "Mechanism",
  "Organism",
  "Impact",
] as const

export default function GeneDatabase() {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredRecords = AMR_RECORDS.filter(
    (record) =>
      record.gene.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.antibiotic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.organism.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useStatusItems(
    useMemo(
      () => [
        {
          id: "records",
          label: `${filteredRecords.length}/${AMR_RECORDS.length} records`,
        },
      ],
      [filteredRecords.length],
    ),
  )

  useViewContext(
    searchTerm.trim()
      ? `${filteredRecords.length} of ${AMR_RECORDS.length} records matching “${searchTerm.trim()}”`
      : `${AMR_RECORDS.length} curated resistance records`,
  )

  return (
    <ViewLayout inspectorId="gene-database" inspector={<DatabaseInspector />}>
      <div className="flex h-full min-h-0 flex-col">
        {/* Filtering is the primary action here, so it sits above the grid
            rather than inside the inspector. */}
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <WBInput
              type="text"
              placeholder="Filter genes, antibiotics, organisms…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-7 pl-7"
              aria-label="Filter records"
            />
          </div>
          {searchTerm && (
            <ToolbarButton
              icon={X}
              label="Clear filter"
              onClick={() => setSearchTerm("")}
            />
          )}
          <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground tabular">
            {filteredRecords.length} / {AMR_RECORDS.length}
          </span>
        </div>

        {filteredRecords.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No records found"
            description={`Nothing in the database matches “${searchTerm}”.`}
          />
        ) : (
          <ViewScroll>
            {/* Desktop grid */}
            <table className="hidden w-full text-sm lg:table">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-border">
                  {COLUMNS.map((h) => (
                    <th
                      key={h}
                      className="px-3 py-1.5 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="row-hover border-b border-border/50 last:border-0"
                  >
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">
                      {record.id}
                    </td>
                    <td className="px-3 py-1.5 font-mono font-semibold text-foreground">
                      {record.gene}
                    </td>
                    <td className="px-3 py-1.5">
                      <Chip>{record.antibiotic}</Chip>
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {record.drugClass}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {record.mechanism}
                    </td>
                    <td className="px-3 py-1.5 text-foreground/80 italic">
                      {record.organism}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-1.5 font-mono font-semibold",
                        record.impact >= 10
                          ? "text-destructive"
                          : record.impact >= 5
                            ? "text-warning"
                            : "text-foreground/80",
                      )}
                    >
                      {record.impact}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Compact cards below the grid breakpoint */}
            <div className="grid gap-2 p-3 lg:hidden">
              {filteredRecords.map((r) => (
                <div
                  key={r.id}
                  className="card-hover rounded-md border border-border bg-surface p-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-mono text-sm font-semibold text-foreground">
                      {r.gene}
                    </p>
                    <p className="font-mono text-sm text-muted-foreground tabular">
                      {r.impact}%
                    </p>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {r.id}
                  </p>
                  <div className="mt-2">
                    <Chip>{r.antibiotic}</Chip>
                  </div>
                  <dl className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    <div className="flex gap-1.5">
                      <dt className="text-foreground/70">Organism</dt>
                      <dd className="italic">{r.organism}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-foreground/70">Drug class</dt>
                      <dd>{r.drugClass}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-foreground/70">Mechanism</dt>
                      <dd>{r.mechanism}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </ViewScroll>
        )}
      </div>
    </ViewLayout>
  )
}

function DatabaseInspector() {
  const byOrganism = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of AMR_RECORDS) map.set(r.organism, (map.get(r.organism) ?? 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [])

  return (
    <div className="seq-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      <div className="grid grid-cols-2 gap-2">
        {AMR_DATABASE_STATS.map((stat, i) => {
          const Icon = STAT_ICONS[i]
          return (
            <StatTile
              key={stat.label}
              icon={Icon}
              label={stat.label}
              value={<span className="text-lg">{stat.value}</span>}
            />
          )
        })}
      </div>

      <Pane>
        <PaneHeader icon={Database} title="Coverage by organism" />
        <div className="space-y-2 p-3">
          {byOrganism.map(([organism, count]) => (
            <div key={organism} className="space-y-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="truncate text-muted-foreground italic">
                  {organism}
                </span>
                <span className="font-mono text-foreground/80 tabular">{count}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[var(--wb-active)]">
                <div
                  className="h-full rounded-full bg-brand/70"
                  style={{ width: `${(count / AMR_RECORDS.length) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Pane>
    </div>
  )
}
