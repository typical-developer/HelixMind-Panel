/**
 * FASTA parsing, sequence statistics and mutation calling.
 *
 * The DNA Scanner and the Mutation Simulator each shipped their own parser, and
 * they disagreed: the scanner split the whole file on `>` and stripped every
 * character outside `ATGCN`, while the simulator walked lines and kept whatever
 * it found — so the same file produced different sequence lengths, and
 * therefore different statistics, depending on which view you opened it in.
 * This is the one implementation both now use.
 */

export interface FastaSequence {
  /** Stable within a parse — index-based, so it does not change between renders. */
  id: string
  /** The identifier: the first whitespace-delimited token after `>`. */
  header: string
  /** Everything after the identifier on the header line, if any. */
  description: string
  /** Uppercase, `ACGTN` only. */
  sequence: string
  /** Characters dropped as not being nucleotides. */
  skipped: number
}

/** Extensions the upload controls accept. */
export const FASTA_EXTENSIONS = [".fasta", ".fa", ".fna", ".ffn", ".faa", ".frn", ".txt"]

/** Anything larger is refused rather than freezing the tab. */
export const MAX_FASTA_BYTES = 32 * 1024 * 1024

/**
 * IUPAC ambiguity codes are folded to `N` rather than dropped.
 *
 * Dropping them shifted every downstream coordinate, so a variant called at
 * position 4,001 in a sequence containing one `R` was actually at 4,002 in the
 * file the user uploaded. Folding to `N` preserves the coordinate and marks the
 * base as ambiguous, which is what it is.
 */
const AMBIGUITY_CODES = new Set("RYSWKMBDHVN".split(""))

export interface FastaValidation {
  ok: boolean
  error?: string
}

/**
 * Check a file before reading it.
 *
 * All three upload paths previously accepted anything, read it as text and
 * carried on — dropping a PDF in produced an empty sequence list and a results
 * pane that simply said "select a target sequence".
 */
export function validateFastaFile(file: File): FastaValidation {
  if (file.size === 0) {
    return { ok: false, error: `${file.name} is empty.` }
  }
  if (file.size > MAX_FASTA_BYTES) {
    return {
      ok: false,
      error: `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${
        MAX_FASTA_BYTES / 1024 / 1024
      } MB.`,
    }
  }
  const lower = file.name.toLowerCase()
  if (!FASTA_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return {
      ok: false,
      error: `${file.name} is not a FASTA file. Expected one of ${FASTA_EXTENSIONS.join(", ")}.`,
    }
  }
  return { ok: true }
}

/**
 * Parse FASTA text.
 *
 * Walks lines rather than splitting the whole document on `>`, because `>` is
 * only a record separator at the start of a line — a description containing one
 * used to split a single record into two, the second with a garbage header.
 */
export function parseFasta(text: string): FastaSequence[] {
  const sequences: FastaSequence[] = []
  const lines = text.split(/\r?\n/)

  let header: string | null = null
  let description = ""
  let chunks: string[] = []
  let skipped = 0
  let index = 0

  const flush = () => {
    if (header === null) return
    const sequence = chunks.join("")
    if (sequence.length > 0) {
      sequences.push({
        id: `seq-${index}`,
        header: header || `Sequence_${index + 1}`,
        description,
        sequence,
        skipped,
      })
      index += 1
    }
    header = null
    description = ""
    chunks = []
    skipped = 0
  }

  for (const raw of lines) {
    if (raw.startsWith(">")) {
      flush()
      const label = raw.slice(1).trim()
      const space = label.search(/\s/)
      header = space === -1 ? label : label.slice(0, space)
      description = space === -1 ? "" : label.slice(space + 1).trim()
      continue
    }
    // `;` is a comment line in the original Pearson FASTA definition.
    if (header === null || raw.startsWith(";")) continue

    let clean = ""
    for (const char of raw.trim().toUpperCase()) {
      if (char === "A" || char === "C" || char === "G" || char === "T") {
        clean += char
      } else if (AMBIGUITY_CODES.has(char)) {
        clean += "N"
      } else if (char !== "-" && char !== "*" && char !== " ") {
        skipped += 1
      }
    }
    chunks.push(clean)
  }

  flush()
  return sequences
}

/* ============================================================================
   Statistics
   ========================================================================= */

export interface SequenceStats {
  length: number
  /** Percentage, 0–100. */
  gcContent: number
  /** Count of ambiguous bases. */
  nCount: number
  /** Open reading frames found on the forward strand. */
  orfs: number
}

/** An ORF shorter than this is noise at genome scale. 30 codons. */
const MIN_ORF_LENGTH = 90

const STOP_CODONS = new Set(["TAA", "TAG", "TGA"])

/** Half-open `[start, end)` interval, 0-based. */
export type ORF = { start: number; end: number }

/**
 * Locate forward-strand open reading frames.
 *
 * The previous implementation used the regex `ATG(?:.{3})+?(?:TAA|TAG|TGA)`.
 * On the 3 MB genome in `test-files/` that lazy quantifier backtracks
 * catastrophically and pins the main thread for minutes. This walks each of the
 * three reading frames once — O(n) with no allocation per codon — and applies a
 * minimum length so single-codon "ORFs" are not counted.
 */
export function findORFs(sequence: string): ORF[] {
  const orfs: ORF[] = []

  for (let frame = 0; frame < 3; frame++) {
    let start = -1
    for (let i = frame; i + 2 < sequence.length; i += 3) {
      const codon = sequence.substring(i, i + 3)
      if (start === -1) {
        if (codon === "ATG") start = i
        continue
      }
      if (STOP_CODONS.has(codon)) {
        if (i + 3 - start >= MIN_ORF_LENGTH) orfs.push({ start, end: i + 3 })
        start = -1
      }
    }
  }

  return orfs.sort((a, b) => a.start - b.start)
}

export function countORFs(sequence: string): number {
  return findORFs(sequence).length
}

/**
 * Is a position inside a coding region?
 *
 * The Mutation Simulator previously decided this with
 * `position < length - 100`, i.e. everything except the last 100 bases was
 * called "coding" regardless of the sequence. Membership of a real ORF is the
 * honest answer.
 */
export function isCoding(orfs: ORF[], position: number): boolean {
  // Linear scan is fine here: callers pass the ORF list for one sequence and
  // the list is small relative to the sequence.
  for (const orf of orfs) {
    if (position >= orf.start && position < orf.end) return true
    if (orf.start > position) break
  }
  return false
}

export function sequenceStats(sequence: string): SequenceStats {
  const length = sequence.length
  let gc = 0
  let n = 0

  for (let i = 0; i < length; i++) {
    const base = sequence.charCodeAt(i)
    // G=71, C=67, N=78
    if (base === 71 || base === 67) gc += 1
    else if (base === 78) n += 1
  }

  return {
    length,
    gcContent: length > 0 ? (gc / length) * 100 : 0,
    nCount: n,
    orfs: countORFs(sequence),
  }
}

/* ============================================================================
   Mutation calling
   ========================================================================= */

export interface CalledMutation {
  /** 1-based, matching how coordinates are reported in genomics. */
  position: number
  refBase: string
  varBase: string
  type: "SNP"
  /** Transitions (purine↔purine, pyrimidine↔pyrimidine) versus transversions. */
  substitution: "transition" | "transversion"
}

const PURINES = new Set(["A", "G"])

export function classifySubstitution(
  ref: string,
  variant: string,
): "transition" | "transversion" {
  const bothPurine = PURINES.has(ref) && PURINES.has(variant)
  const bothPyrimidine = !PURINES.has(ref) && !PURINES.has(variant)
  return bothPurine || bothPyrimidine ? "transition" : "transversion"
}

/**
 * Ungapped position-by-position comparison.
 *
 * This is a naive alignment and is labelled as such in the UI: it compares
 * index to index, so a single indel shifts every subsequent base and the caller
 * reports a wall of false positives. `qualityWarnings` raises that case.
 */
export function callMutations(
  target: string,
  reference: string,
  limit = 50_000,
): CalledMutation[] {
  const mutations: CalledMutation[] = []
  const end = Math.min(target.length, reference.length)

  for (let i = 0; i < end; i++) {
    const varBase = target[i]
    const refBase = reference[i]
    if (varBase === refBase || varBase === "N" || refBase === "N") continue

    mutations.push({
      position: i + 1,
      refBase,
      varBase,
      type: "SNP",
      substitution: classifySubstitution(refBase, varBase),
    })

    // Bound the result. A mismatched pair of genomes can differ at millions of
    // positions, and rendering that many rows is not useful to anyone.
    if (mutations.length >= limit) break
  }

  return mutations
}

export interface QualityWarning {
  message: string
  severity: "warning" | "error"
}

export function qualityWarnings(
  stats: SequenceStats | null,
  target: FastaSequence | null,
  reference: FastaSequence | null,
): QualityWarning[] {
  const list: QualityWarning[] = []
  if (!stats) return list

  if (stats.length === 0) {
    list.push({ message: "Sequence is empty.", severity: "error" })
    return list
  }
  if (stats.length < 200) {
    list.push({
      message: `Sequence is only ${stats.length} bp — too short for reliable statistics.`,
      severity: "warning",
    })
  }
  if (stats.nCount > stats.length * 0.1) {
    list.push({
      message: `${((stats.nCount / stats.length) * 100).toFixed(1)}% of bases are ambiguous (N).`,
      severity: "warning",
    })
  }
  if (target && target.skipped > 0) {
    list.push({
      message: `${target.skipped.toLocaleString()} non-nucleotide character${
        target.skipped === 1 ? " was" : "s were"
      } ignored while reading ${target.header}.`,
      severity: "warning",
    })
  }
  if (
    reference &&
    target &&
    Math.abs(reference.sequence.length - target.sequence.length) > 100
  ) {
    list.push({
      message:
        "Target and reference differ in length by more than 100 bp. This caller aligns position-to-position, so an indel will shift every downstream call.",
      severity: "warning",
    })
  }

  return list
}
