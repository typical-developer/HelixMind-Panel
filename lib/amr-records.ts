/**
 * Curated antimicrobial-resistance gene records.
 *
 * This file's previous docstring claimed to be the single source of truth so
 * the Gene Library and the sidebar "never drift apart". They didn't — but the
 * Resistance Predictor kept a *second*, different table inline, with seven
 * genes to this file's five and only two in common. A user could score `vanA`
 * in the predictor and then find nothing for it in the library or the command
 * palette. The two tables are merged here and the predictor now reads from it.
 *
 * The two tables also both had a field called `impact` that meant different
 * things — a prevalence percentage in one and a 0–1 confidence score in the
 * other. They are named separately below.
 */

/**
 * Version of this table.
 *
 * A resistance call is only reproducible if you can say which reference data
 * produced it — and the field's own literature makes that the practical
 * problem, not the calling. The same isolates run against AMRFinderPlus, CARD
 * and ResFinder yield materially different gene sets, and even `mecA`
 * detection ranges from 82% to 100% between them (see docs/DOMAIN-RESEARCH.md
 * §3). A stored result that does not name its reference data cannot be
 * compared with anything, including a later run of itself.
 *
 * Bump this whenever a record is added, removed or has its `confidence` or
 * `prevalence` changed. It is written into every archived run.
 */
export const AMR_DATA_VERSION = "helixmind-curated-2026.08.1"

export interface AMRRecord {
  id: string
  /** Gene symbol, as it appears in ResFinder/CARD. */
  gene: string
  /** The drug most often reported against this marker. */
  antibiotic: string
  drugClass: string
  mechanism: string
  /** The organism this marker is most associated with. */
  organism: string
  /** Organisms the marker is commonly reported in. */
  organisms: string[]
  /**
   * Share of surveyed clinical isolates carrying the marker, as a percentage.
   * Shown in the Gene Library's "Impact" column.
   */
  prevalence: number
  /**
   * How strongly presence of the marker predicts a resistant phenotype, 0–1.
   * Used by the Resistance Predictor's scoring.
   */
  confidence: number
}

export const AMR_RECORDS: AMRRecord[] = [
  {
    id: "AMR001",
    gene: "blaCTX-M",
    antibiotic: "Ceftriaxone",
    drugClass: "Cephalosporins",
    mechanism: "Extended-spectrum beta-lactamase",
    organism: "E. coli",
    organisms: ["E. coli", "K. pneumoniae"],
    prevalence: 12.5,
    confidence: 0.95,
  },
  {
    id: "AMR002",
    gene: "blaOXA-48",
    antibiotic: "Meropenem",
    drugClass: "Carbapenems",
    mechanism: "Carbapenemase",
    organism: "K. pneumoniae",
    organisms: ["K. pneumoniae", "E. coli"],
    prevalence: 3.1,
    confidence: 0.98,
  },
  {
    id: "AMR003",
    gene: "mecA",
    antibiotic: "Oxacillin",
    drugClass: "Beta-lactams",
    mechanism: "Alternative penicillin-binding protein (PBP2a)",
    organism: "S. aureus",
    organisms: ["S. aureus"],
    prevalence: 9.23,
    confidence: 0.99,
  },
  {
    id: "AMR004",
    gene: "vanA",
    antibiotic: "Vancomycin",
    drugClass: "Glycopeptides",
    mechanism: "Cell-wall precursor remodelling",
    organism: "Enterococcus faecium",
    organisms: ["Enterococcus faecium"],
    prevalence: 2.4,
    confidence: 0.99,
  },
  {
    id: "AMR005",
    gene: "gyrA",
    antibiotic: "Ciprofloxacin",
    drugClass: "Fluoroquinolones",
    mechanism: "DNA gyrase target mutation",
    organism: "E. coli",
    organisms: ["E. coli", "K. pneumoniae", "Salmonella"],
    prevalence: 8.4,
    confidence: 0.4,
  },
  {
    id: "AMR006",
    gene: "parC",
    antibiotic: "Ciprofloxacin",
    drugClass: "Fluoroquinolones",
    mechanism: "Topoisomerase IV target mutation",
    organism: "E. coli",
    organisms: ["E. coli", "K. pneumoniae"],
    prevalence: 5.9,
    confidence: 0.4,
  },
  {
    id: "AMR007",
    gene: "tetM",
    antibiotic: "Tetracycline",
    drugClass: "Tetracyclines",
    mechanism: "Ribosomal protection protein",
    organism: "Enterococcus faecium",
    organisms: ["Enterococcus faecium", "S. aureus"],
    prevalence: 7.2,
    confidence: 0.7,
  },
  {
    id: "AMR008",
    gene: "rpoB",
    antibiotic: "Rifampicin",
    drugClass: "RNA polymerase inhibitors",
    mechanism: "RNA polymerase beta-subunit mutation",
    organism: "M. tuberculosis",
    organisms: ["M. tuberculosis", "S. aureus"],
    prevalence: 1.56,
    confidence: 0.92,
  },
  {
    id: "AMR009",
    gene: "erm(B)",
    antibiotic: "Erythromycin",
    drugClass: "Macrolides",
    mechanism: "23S rRNA methylation",
    organism: "S. pneumoniae",
    organisms: ["S. pneumoniae", "Enterococcus faecium"],
    prevalence: 6.78,
    confidence: 0.88,
  },
]

/** Lookup by gene symbol. */
export const AMR_BY_GENE = new Map(AMR_RECORDS.map((r) => [r.gene, r]))

/** Every organism named by at least one record, for the predictor's picker. */
export const AMR_ORGANISMS = Array.from(
  new Set(AMR_RECORDS.flatMap((r) => r.organisms)),
).sort()

/** Every drug class, with how many markers target it. */
export function drugClassCounts(): Array<[string, number]> {
  const map = new Map<string, number>()
  for (const record of AMR_RECORDS) {
    map.set(record.drugClass, (map.get(record.drugClass) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

/**
 * Headline counts for the Gene Library.
 *
 * These were literals — "2,847" total genes, "456" organisms, "128" drug
 * classes and a "Last Updated" of 2024-01-12 — against a table holding five
 * records. They are counted from the data now, so the panel cannot claim to
 * hold a library it does not have.
 */
export function databaseStats(): Array<{ label: string; value: string }> {
  return [
    { label: "Genes", value: String(AMR_RECORDS.length) },
    { label: "Version", value: AMR_DATA_VERSION },
    { label: "Organisms", value: String(AMR_ORGANISMS.length) },
    { label: "Drug classes", value: String(drugClassCounts().length) },
    {
      label: "Mechanisms",
      value: String(new Set(AMR_RECORDS.map((r) => r.mechanism)).size),
    },
  ]
}

/** Free-text match across every field a user might search by. */
export function searchRecords(query: string): AMRRecord[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return AMR_RECORDS
  return AMR_RECORDS.filter((record) =>
    [
      record.gene,
      record.antibiotic,
      record.drugClass,
      record.mechanism,
      record.organism,
      ...record.organisms,
    ].some((field) => field.toLowerCase().includes(needle)),
  )
}
