"use client";

import { Search, Database, Dna, Bug, Layers, Clock } from "lucide-react";
import { useState } from "react";

interface AMRRecord {
  id: string;
  gene: string;
  antibiotic: string;
  drugClass: string;
  mechanism: string;
  organism: string;
  impact: number;
}

const AMR_RECORDS: AMRRecord[] = [
  { id: "AMR001", gene: "blaCTX-M", antibiotic: "Cephalosporins", drugClass: "Beta-lactams", mechanism: "Beta-lactamase", organism: "E. coli", impact: 12.5 },
  { id: "AMR002", gene: "gyrA", antibiotic: "Fluoroquinolones", drugClass: "Quinolones", mechanism: "DNA gyrase mutation", organism: "Salmonella", impact: 8.4 },
  { id: "AMR003", gene: "rpoB", antibiotic: "Rifamycins", drugClass: "RNA polymerase inhibitors", mechanism: "RNA polymerase mutation", organism: "M. tuberculosis", impact: 1.56 },
  { id: "AMR004", gene: "mecA", antibiotic: "Oxacillin", drugClass: "Beta-lactams", mechanism: "Penicillin-binding protein", organism: "S. aureus", impact: 9.23 },
  { id: "AMR005", gene: "erm(B)", antibiotic: "Macrolides", drugClass: "Protein synthesis inhibitors", mechanism: "rRNA methylation", organism: "S. pneumoniae", impact: 6.78 },
];

const STATS = [
  { icon: Dna, label: "Total Genes", value: "2,847" },
  { icon: Bug, label: "Organisms", value: "456" },
  { icon: Layers, label: "Drug Classes", value: "128" },
  { icon: Clock, label: "Last Updated", value: "2024-01-12" },
];

export default function GeneDatabase() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRecords = AMR_RECORDS.filter(
    (record) =>
      record.gene.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.antibiotic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.organism.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="ml-16">
      <main className="min-h-screen space-y-6 px-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STATS.map(({ icon: Icon, label, value }) => (
            <div key={label} className="glass card-hover p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
            </div>
          ))}
        </div>

        {/* Search + Content */}
        <div className="glass w-full p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold leading-tight">Resistance Gene Database</h3>
              <p className="text-xs text-muted-foreground">
                {filteredRecords.length} of {AMR_RECORDS.length} records
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search genes, antibiotics, organisms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-card/60 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-ring focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["ID", "Gene", "Antibiotic", "Drug Class", "Mechanism", "Organism", "Impact"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="border-b border-border/40 transition-colors last:border-0 hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-mono text-muted-foreground">{record.id}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-foreground">{record.gene}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs">
                        {record.antibiotic}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{record.drugClass}</td>
                    <td className="px-4 py-3 text-muted-foreground">{record.mechanism}</td>
                    <td className="px-4 py-3 italic">{record.organism}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums">{record.impact}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 lg:hidden">
            {filteredRecords.map((r) => (
              <div key={r.id} className="rounded-lg border border-border bg-card/50 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-xs text-muted-foreground">{r.id}</p>
                  <p className="font-semibold tabular-nums">{r.impact}%</p>
                </div>
                <p className="mt-1 font-mono text-lg font-semibold">{r.gene}</p>
                <span className="mt-2 inline-block rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs">
                  {r.antibiotic}
                </span>
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <p><span className="text-foreground/70">Organism:</span> {r.organism}</p>
                  <p><span className="text-foreground/70">Drug class:</span> {r.drugClass}</p>
                  <p><span className="text-foreground/70">Mechanism:</span> {r.mechanism}</p>
                </div>
              </div>
            ))}
          </div>

          {filteredRecords.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No records found matching your search.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
