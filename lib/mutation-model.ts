/**
 * Generational mutation dynamics for the Mutation Simulator.
 *
 * Extracted from the view so a run is reproducible and testable. Three things
 * were wrong with the original and are fixed here:
 *
 *  - `SeededRandom` was seeded with `Date.now() + generation`, so runs were
 *    never reproducible despite the name. Worse, `seed * 9301` on a seed near
 *    1.7e12 exceeds `Number.MAX_SAFE_INTEGER`, so the generator lost precision
 *    and its output was measurably biased. It uses mulberry32 now, with the
 *    seed supplied by the caller and reported back.
 *  - Insertions and deletions were declared in the types and penalised by the
 *    fitness function, but nothing ever generated one — the "Insertions" tile
 *    on the view was hardwired to zero. They are generated now.
 *  - Coding context was decided by `position < length - 100`. It is decided by
 *    actual ORF membership now.
 */
import { findORFs, isCoding, type ORF } from "./fasta"

/** Standard genetic code. `*` marks a stop codon. */
export const CODON_MAP: Record<string, string> = {
  ATA: "I", ATC: "I", ATT: "I", ATG: "M",
  ACA: "T", ACC: "T", ACG: "T", ACT: "T",
  AAC: "N", AAT: "N", AAA: "K", AAG: "K",
  AGC: "S", AGT: "S", AGA: "R", AGG: "R",
  CTA: "L", CTC: "L", CTG: "L", CTT: "L",
  CCA: "P", CCC: "P", CCG: "P", CCT: "P",
  CAC: "H", CAT: "H", CAA: "Q", CAG: "Q",
  CGA: "R", CGC: "R", CGG: "R", CGT: "R",
  GTA: "V", GTC: "V", GTG: "V", GTT: "V",
  GCA: "A", GCC: "A", GCG: "A", GCT: "A",
  GAC: "D", GAT: "D", GAA: "E", GAG: "E",
  GGA: "G", GGC: "G", GGG: "G", GGT: "G",
  TCA: "S", TCC: "S", TCG: "S", TCT: "S",
  TTC: "F", TTT: "F", TTA: "L", TTG: "L",
  TAC: "Y", TAT: "Y", TAA: "*", TAG: "*",
  TGC: "C", TGT: "C", TGA: "*", TGG: "W",
}

/**
 * mulberry32 — a 32-bit generator that stays inside exact integer arithmetic.
 *
 * Same seed, same sequence, every time, which is what makes a run repeatable.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TRANSITIONS: Record<string, string> = { A: "G", G: "A", C: "T", T: "C" }
const TRANSVERSIONS: Record<string, string[]> = {
  A: ["C", "T"],
  G: ["C", "T"],
  C: ["A", "G"],
  T: ["A", "G"],
}

const BASES = ["A", "C", "G", "T"]

/**
 * Transitions outnumber transversions roughly 2:1 in real genomes, which is
 * what the 0.66 threshold encodes.
 */
export function mutateBase(base: string, random: () => number): string {
  if (random() < 0.66) return TRANSITIONS[base] ?? base
  const choices = TRANSVERSIONS[base] ?? [base]
  return choices[Math.floor(random() * choices.length)]
}

export type MutationType = "substitution" | "insertion" | "deletion"

export interface MutationRecord {
  generation: number
  /** 0-based index into the sequence as it stood at the start of the generation. */
  position: number
  type: MutationType
  original: string
  mutated: string
  /** `L->P`, or "none" for a synonymous change. */
  aminoAcidChange: string
  context: "coding" | "non-coding"
}

export interface GenerationStats {
  generation: number
  fitness: number
  mutationCount: number
  progress: number
  cumulativeMutations: number
}

export interface SimulationParams {
  tempUnit: "C" | "F"
  temperature: number
  substitutionRate: number
  numGenerations: number
  pH: number
  nutrients: string
  oxygen: string
}

export function toCelsius(temperature: number, unit: "C" | "F"): number {
  return unit === "F" ? ((temperature - 32) * 5) / 9 : temperature
}

/**
 * Mutation rate rises with temperature — a tenfold increase per 50 °C above
 * the 37 °C reference, compounding.
 *
 * KNOWN GAP — `pH`, `nutrients` and `oxygen` are collected by the view's
 * inspector but do not enter this calculation. See docs/BUG-REPORT.md.
 */
export function temperatureFactor(celsius: number): number {
  return Math.pow(1.1, (celsius - 37) / 5)
}

/** Indels are about an order of magnitude rarer than point substitutions. */
export const INDEL_RATE_FRACTION = 0.1

/**
 * Fitness starts at 100 and is docked for damage.
 *
 * Non-synonymous coding substitutions cost 1.5; indels cost 10 because they
 * frameshift everything downstream. Premature stops inside what was an ORF are
 * counted separately by the caller.
 */
export function calculateFitness(mutations: MutationRecord[]): number {
  let fitness = 100

  for (const mutation of mutations) {
    if (mutation.type === "substitution") {
      if (
        mutation.context === "coding" &&
        mutation.aminoAcidChange !== "none"
      ) {
        // A new stop codon truncates the protein — far worse than a swap.
        fitness -= mutation.aminoAcidChange.endsWith("->*") ? 6 : 1.5
      }
    } else {
      fitness -= 10
    }
  }

  return Math.max(0, Math.round(fitness * 10) / 10)
}

/* ============================================================================
   Run control
   ========================================================================= */

export type RunAction =
  /** Stop where it is, keeping every generation already computed. */
  | "pause"
  /** Continue from the current generation. */
  | "resume"
  /** Clear the previous run and begin again from generation zero. */
  | "restart"
  /** Cannot start: no sequence loaded, or a parameter is invalid. */
  | "blocked"

export interface RunControlState {
  isRunning: boolean
  hasSequence: boolean
  currentGeneration: number
  numGenerations: number
  /** True when any inspector field is showing a validation error. */
  hasInvalidParams: boolean
}

/**
 * What pressing the run button should do.
 *
 * Extracted because getting this wrong is invisible in the UI until you try it,
 * and it *was* wrong: `handleStart` called `handleReset()` unconditionally on
 * its first line, which set `isRunning` to false — so the `if (isRunning)`
 * check immediately below could never be true. The button labelled "Pause"
 * threw the run away and restarted it from generation zero. It had never
 * paused anything.
 */
export function nextRunAction(state: RunControlState): RunAction {
  if (state.isRunning) return "pause"
  if (!state.hasSequence || state.hasInvalidParams) return "blocked"
  // A finished run starts over; a partial one picks up where it stopped.
  if (state.currentGeneration >= state.numGenerations) return "restart"
  return "resume"
}

export interface GenerationResult {
  sequence: string
  mutations: MutationRecord[]
  substitutions: number
  insertions: number
  deletions: number
}

/**
 * Run one generation over `sequence`.
 *
 * Positions are visited once, back to front for indels so that an insertion
 * does not shift the indices still to be examined.
 */
export function runGeneration(
  sequence: string,
  generation: number,
  params: Pick<SimulationParams, "substitutionRate" | "temperature" | "tempUnit">,
  random: () => number,
  orfs?: ORF[],
): GenerationResult {
  const frames = orfs ?? findORFs(sequence)
  const factor = temperatureFactor(toCelsius(params.temperature, params.tempUnit))
  const substitutionRate = params.substitutionRate * factor
  const indelRate = substitutionRate * INDEL_RATE_FRACTION

  const bases = sequence.split("")
  const mutations: MutationRecord[] = []
  let substitutions = 0
  let insertions = 0
  let deletions = 0

  // Substitutions first, in place — they do not move any coordinates.
  for (let i = 0; i < bases.length; i++) {
    if (random() >= substitutionRate) continue

    const original = bases[i]
    const mutated = mutateBase(original, random)
    if (mutated === original) continue

    const coding = isCoding(frames, i)
    let aminoAcidChange = "none"

    if (coding) {
      const codonStart = Math.floor(i / 3) * 3
      const originalCodon = sequence.substring(codonStart, codonStart + 3)
      if (originalCodon.length === 3) {
        const codon = originalCodon.split("")
        codon[i % 3] = mutated
        const newCodon = codon.join("")
        const from = CODON_MAP[originalCodon]
        const to = CODON_MAP[newCodon]
        if (from && to && from !== to) aminoAcidChange = `${from}->${to}`
      }
    }

    bases[i] = mutated
    mutations.push({
      generation,
      position: i,
      type: "substitution",
      original,
      mutated,
      aminoAcidChange,
      context: coding ? "coding" : "non-coding",
    })
    substitutions += 1
  }

  // Indels back to front, so each edit leaves the untouched prefix's
  // coordinates valid for the next iteration.
  for (let i = bases.length - 1; i >= 0; i--) {
    if (random() >= indelRate) continue

    const coding = isCoding(frames, i)
    if (random() < 0.5) {
      const inserted = BASES[Math.floor(random() * BASES.length)]
      bases.splice(i, 0, inserted)
      mutations.push({
        generation,
        position: i,
        type: "insertion",
        original: "-",
        mutated: inserted,
        aminoAcidChange: coding ? "frameshift" : "none",
        context: coding ? "coding" : "non-coding",
      })
      insertions += 1
    } else {
      const removed = bases[i]
      bases.splice(i, 1)
      mutations.push({
        generation,
        position: i,
        type: "deletion",
        original: removed,
        mutated: "-",
        aminoAcidChange: coding ? "frameshift" : "none",
        context: coding ? "coding" : "non-coding",
      })
      deletions += 1
    }
  }

  mutations.sort((a, b) => a.position - b.position)

  return {
    sequence: bases.join(""),
    mutations,
    substitutions,
    insertions,
    deletions,
  }
}
