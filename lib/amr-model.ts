/**
 * Rule-based resistance prediction.
 *
 * Lifted out of the Resistance Predictor view so the scoring can be tested
 * without rendering anything, and so it reads from `lib/amr-records.ts` rather
 * than the private gene table the view used to carry.
 *
 * This is a lookup with a synergy pass, not a model. It reports what is known
 * about the markers it is given; it does not infer anything from sequence.
 */
import { AMR_BY_GENE, type AMRRecord } from "./amr-records"

export interface SynergyRule {
  /** Every gene must be present for the rule to fire. */
  genes: string[]
  drugClass: string
  /** Replaces the highest single-marker confidence when the rule fires. */
  boostedConfidence: number
  note: string
}

/**
 * Combinations that are worse than the sum of their parts.
 *
 * A single QRDR mutation raises the fluoroquinolone MIC without necessarily
 * crossing the clinical breakpoint; gyrA and parC together reliably do, which
 * is why the pair scores far above either alone.
 */
export const SYNERGY_RULES: SynergyRule[] = [
  {
    genes: ["gyrA", "parC"],
    drugClass: "Fluoroquinolones",
    boostedConfidence: 0.9,
    note: "Mutations in both gyrA and parC confer high-level fluoroquinolone resistance.",
  },
  {
    genes: ["blaCTX-M", "blaOXA-48"],
    drugClass: "Carbapenems",
    boostedConfidence: 0.99,
    note: "An ESBL alongside a carbapenemase leaves few beta-lactam options.",
  },
]

export type ConfidenceLevel = "High" | "Medium" | "Low"

export function confidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.9) return "High"
  if (score >= 0.7) return "Medium"
  return "Low"
}

export interface ResistanceCall {
  drugClass: string
  /** The drugs the contributing markers are reported against. */
  antibiotics: string[]
  confidence: { level: ConfidenceLevel; score: number }
  genes: string[]
  mechanisms: string[]
  isSynergistic: boolean
  synergyNote?: string
}

export interface PredictionResult {
  organism: string
  selectedGenes: string[]
  calls: ResistanceCall[]
  /** Markers that were requested but are not in the library. */
  unknownGenes: string[]
  /**
   * Markers not normally reported in the selected organism.
   *
   * Surfaced as an advisory only — the organism does not currently affect
   * scoring. See docs/BUG-REPORT.md.
   */
  unexpectedForOrganism: string[]
  /** ISO 8601, so it sorts and does not depend on the reader's locale. */
  timestamp: string
}

/**
 * Score a set of markers.
 *
 * Grouped by drug class because that is the unit a clinician acts on: three
 * markers hitting the same class is one finding, not three.
 */
export function predictResistance(
  selectedGenes: string[],
  organism: string,
): PredictionResult {
  const byClass = new Map<
    string,
    {
      drugClass: string
      antibiotics: Set<string>
      genes: string[]
      mechanisms: string[]
      score: number
    }
  >()

  const unknownGenes: string[] = []
  const unexpectedForOrganism: string[] = []

  for (const gene of selectedGenes) {
    const record: AMRRecord | undefined = AMR_BY_GENE.get(gene)
    if (!record) {
      unknownGenes.push(gene)
      continue
    }

    if (organism && !record.organisms.includes(organism)) {
      unexpectedForOrganism.push(gene)
    }

    const existing = byClass.get(record.drugClass)
    if (existing) {
      existing.genes.push(gene)
      existing.antibiotics.add(record.antibiotic)
      if (!existing.mechanisms.includes(record.mechanism)) {
        existing.mechanisms.push(record.mechanism)
      }
      existing.score = Math.max(existing.score, record.confidence)
    } else {
      byClass.set(record.drugClass, {
        drugClass: record.drugClass,
        antibiotics: new Set([record.antibiotic]),
        genes: [gene],
        mechanisms: [record.mechanism],
        score: record.confidence,
      })
    }
  }

  const calls: ResistanceCall[] = [...byClass.values()].map((entry) => ({
    drugClass: entry.drugClass,
    antibiotics: [...entry.antibiotics].sort(),
    confidence: { level: confidenceLevel(entry.score), score: entry.score },
    genes: [...entry.genes].sort(),
    mechanisms: entry.mechanisms,
    isSynergistic: false,
  }))

  for (const rule of SYNERGY_RULES) {
    if (!rule.genes.every((gene) => selectedGenes.includes(gene))) continue
    const call = calls.find((c) => c.drugClass === rule.drugClass)
    if (!call) continue
    // A rule only ever raises the score; a synergy that scored below the
    // single-marker confidence would be a downgrade dressed up as a warning.
    if (rule.boostedConfidence <= call.confidence.score) continue
    call.confidence = {
      score: rule.boostedConfidence,
      level: confidenceLevel(rule.boostedConfidence),
    }
    call.isSynergistic = true
    call.synergyNote = rule.note
  }

  // Worst first — the reason anyone opens this view is to find the top call.
  calls.sort((a, b) => b.confidence.score - a.confidence.score)

  return {
    organism,
    selectedGenes: [...selectedGenes],
    calls,
    unknownGenes,
    unexpectedForOrganism,
    timestamp: new Date().toISOString(),
  }
}

/** Calls at High confidence — what the Overview counts as a threat. */
export function highConfidenceCalls(result: PredictionResult): ResistanceCall[] {
  return result.calls.filter((call) => call.confidence.level === "High")
}
