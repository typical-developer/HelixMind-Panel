"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Database, Dna, Search, ShieldAlert, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { AMR_RECORDS, databaseStats, searchRecords } from "@/lib/amr-records"
import { copyToClipboard } from "@/lib/download"
import {
  Chip,
  ViewLayout,
  DataTable,
  Th,
  ViewScroll,
  EmptyState,
  InspectorScroll,
  Pane,
  PaneHeader,
  StatTile,
  ToolbarButton,
  WBInput,
  useStatusItems,
  useViewContext,
  useWorkbench,
} from "@/components/workbench"

const COLUMNS = [
  "ID",
  "Gene",
  "Antibiotic",
  "Drug Class",
  "Mechanism",
  "Organism",
  "Prevalence",
  "",
] as const

export default function GeneDatabase() {
  const searchParams = useSearchParams()
  const { openTab } = useWorkbench()
  const [searchTerm, setSearchTerm] = useState("")

  /** Score a marker in the Resistance Predictor, with it already selected. */
  const analyseGene = (gene: string) =>
    openTab(
      `/amr-analysis-engine/resistance-predictor?genes=${encodeURIComponent(gene)}`,
    )

  /* Arriving from a gene hit in the command palette pre-fills the filter, so
     picking a specific gene lands on that gene rather than on the full library
     with the search you just typed thrown away. Seeded rather than controlled:
     once here, the field is yours to edit. */
  const seededQuery = searchParams.get("q") ?? ""
  useEffect(() => {
    if (seededQuery) setSearchTerm(seededQuery)
  }, [seededQuery])

  /* One matcher for every surface. The grid used to search four fields, the
     sidebar three and the palette five, so the same query returned different
     results depending on where it was typed. */
  const filteredRecords = useMemo(() => searchRecords(searchTerm), [searchTerm])

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
          <>
            {/* Desktop grid. Seven columns need real width, so below the
                min-width the grid scrolls sideways rather than crushing every
                column — the bench can be narrow at any viewport size once the
                inspector is open.

                Both axes belong to one element. This used to be an
                `overflow-x-auto` div inside a `ViewScroll`, and a box that
                scrolls in x has its `overflow-y: visible` computed to `auto`
                too — so that div became the scrollport the sticky header
                pinned to, while the vertical scrolling actually happened in
                the container outside it. The header stayed faithfully pinned
                to a viewport that never moved, and never stuck to anything. */}
            <DataTable minWidth="52rem" containerClassName="hidden lg:block">
              <thead>
                <tr>
                  {COLUMNS.map((h) => (
                    <Th key={h}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="group/row row-hover border-b border-border/50 last:border-0"
                  >
                    <td className="px-3 py-2 font-mono text-muted-foreground">
                      {record.id}
                    </td>
                    <td className="px-3 py-2 font-mono font-semibold text-foreground">
                      {record.gene}
                    </td>
                    <td className="px-3 py-2">
                      <Chip>{record.antibiotic}</Chip>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {record.drugClass}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {record.mechanism}
                    </td>
                    <td className="px-3 py-2 text-foreground/80 italic">
                      {record.organism}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 font-mono font-semibold",
                        record.prevalence >= 10
                          ? "text-destructive"
                          : record.prevalence >= 5
                            ? "text-warning"
                            : "text-foreground/80",
                      )}
                    >
                      {record.prevalence}%
                    </td>
                    <td className="w-16 px-2 py-2">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
                        <ToolbarButton
                          icon={ShieldAlert}
                          label={`Analyse ${record.gene} in the Resistance Predictor`}
                          onClick={() => analyseGene(record.gene)}
                        />
                        <ToolbarButton
                          icon={Dna}
                          label={`Copy ${record.gene}`}
                          onClick={() =>
                            copyToClipboard(record.gene, `Copied ${record.gene}`)
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>

            {/* Compact cards below the grid breakpoint. Its own scroller, so
                neither layout has to share a scrollport with the other. */}
            <ViewScroll className="lg:hidden">
              <div className="grid gap-2 p-3">
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
                      {r.prevalence}%
                    </p>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {r.id}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Chip>{r.antibiotic}</Chip>
                    <button
                      type="button"
                      onClick={() => analyseGene(r.gene)}
                      className="ml-auto flex cursor-pointer items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 text-xs text-foreground/85 transition-colors hover:bg-[var(--wb-active)] focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                    >
                      <ShieldAlert className="size-3" />
                      Analyse
                    </button>
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
          </>
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
    <InspectorScroll>
      <div className="grid grid-cols-2 gap-2">
        {databaseStats().map((stat) => {
          return (
            <StatTile
              key={stat.label}
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
    </InspectorScroll>
  )
}
