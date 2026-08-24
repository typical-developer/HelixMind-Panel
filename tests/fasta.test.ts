import { describe, expect, it } from "vitest"

import {
  callMutations,
  classifySubstitution,
  countORFs,
  findORFs,
  isCoding,
  parseFasta,
  qualityWarnings,
  sequenceStats,
  validateFastaFile,
  MAX_FASTA_BYTES,
} from "@/lib/fasta"

/** Build a File without a DOM — Node's undici provides the constructor. */
function fakeFile(name: string, size: number): File {
  return { name, size } as File
}

describe("parseFasta", () => {
  it("reads a single record", () => {
    const [record] = parseFasta(">seq1 a description here\nACGT\nACGT\n")
    expect(record.header).toBe("seq1")
    expect(record.description).toBe("a description here")
    expect(record.sequence).toBe("ACGTACGT")
  })

  it("reads multiple records", () => {
    const records = parseFasta(">a\nACGT\n>b\nTTTT\n>c\nGGGG\n")
    expect(records.map((r) => r.header)).toEqual(["a", "b", "c"])
    expect(records.map((r) => r.sequence)).toEqual(["ACGT", "TTTT", "GGGG"])
  })

  it("uppercases lowercase input", () => {
    expect(parseFasta(">a\nacgt\n")[0].sequence).toBe("ACGT")
  })

  it("handles CRLF line endings", () => {
    expect(parseFasta(">a\r\nACGT\r\nACGT\r\n")[0].sequence).toBe("ACGTACGT")
  })

  it("folds IUPAC ambiguity codes to N rather than dropping them", () => {
    // Dropping them would shift every downstream coordinate.
    const record = parseFasta(">a\nACRGT\n")[0]
    expect(record.sequence).toBe("ACNGT")
    expect(record.sequence).toHaveLength(5)
  })

  it("counts characters it had to skip", () => {
    const record = parseFasta(">a\nACGT123\n")[0]
    expect(record.sequence).toBe("ACGT")
    expect(record.skipped).toBe(3)
  })

  it("does not split a record on a '>' that is not at line start", () => {
    // The previous parser split the whole document on ">", so this produced
    // two records, the second with a garbage header.
    const records = parseFasta(">a some > note\nACGT\n")
    expect(records).toHaveLength(1)
    expect(records[0].sequence).toBe("ACGT")
  })

  it("ignores ';' comment lines", () => {
    expect(parseFasta(">a\n;a comment\nACGT\n")[0].sequence).toBe("ACGT")
  })

  it("drops records with no sequence", () => {
    expect(parseFasta(">empty\n>real\nACGT\n")).toHaveLength(1)
  })

  it("returns nothing for input that is not FASTA", () => {
    expect(parseFasta("just some text\nwith no header\n")).toEqual([])
  })

  it("gives records stable ids across repeated parses", () => {
    const a = parseFasta(">a\nACGT\n")[0].id
    const b = parseFasta(">a\nACGT\n")[0].id
    expect(a).toBe(b)
  })
})

describe("validateFastaFile", () => {
  it("accepts known extensions", () => {
    expect(validateFastaFile(fakeFile("genome.fna", 1024)).ok).toBe(true)
    expect(validateFastaFile(fakeFile("reads.fasta", 1024)).ok).toBe(true)
  })

  it("rejects an unknown extension", () => {
    const result = validateFastaFile(fakeFile("report.pdf", 1024))
    expect(result.ok).toBe(false)
    expect(result.error).toContain("not a FASTA file")
  })

  it("rejects an empty file", () => {
    expect(validateFastaFile(fakeFile("empty.fa", 0)).ok).toBe(false)
  })

  it("rejects a file over the size limit", () => {
    const result = validateFastaFile(fakeFile("huge.fa", MAX_FASTA_BYTES + 1))
    expect(result.ok).toBe(false)
    expect(result.error).toContain("limit")
  })
})

describe("sequenceStats", () => {
  it("computes GC content", () => {
    expect(sequenceStats("GGCC").gcContent).toBe(100)
    expect(sequenceStats("ATAT").gcContent).toBe(0)
    expect(sequenceStats("ACGT").gcContent).toBe(50)
  })

  it("counts ambiguous bases", () => {
    expect(sequenceStats("ACGTNN").nCount).toBe(2)
  })

  it("does not divide by zero on an empty sequence", () => {
    const stats = sequenceStats("")
    expect(stats.gcContent).toBe(0)
    expect(stats.length).toBe(0)
  })
})

describe("findORFs", () => {
  it("finds an ORF that meets the minimum length", () => {
    // ATG + 30 codons + stop clears the 90bp floor.
    const orf = "ATG" + "AAA".repeat(30) + "TAA"
    expect(countORFs(orf)).toBe(1)
  })

  it("ignores an ORF below the minimum length", () => {
    expect(countORFs("ATGAAATAA")).toBe(0)
  })

  it("reports coding membership by real ORF bounds", () => {
    const sequence = "TTTT" + "ATG" + "AAA".repeat(30) + "TAA" + "TTTT"
    const orfs = findORFs(sequence)
    expect(orfs.length).toBeGreaterThan(0)
    expect(isCoding(orfs, 0)).toBe(false)
    expect(isCoding(orfs, orfs[0].start)).toBe(true)
    expect(isCoding(orfs, orfs[0].end)).toBe(false)
  })

  it("completes quickly on a megabase sequence", () => {
    // The previous regex-based implementation backtracked catastrophically
    // here and pinned the thread for minutes.
    const sequence = "ATGAAACCCGGGTTT".repeat(70_000)
    const started = Date.now()
    countORFs(sequence)
    expect(Date.now() - started).toBeLessThan(3000)
  })
})

describe("callMutations", () => {
  it("calls a substitution at a 1-based position", () => {
    const mutations = callMutations("ACGT", "ACTT")
    expect(mutations).toHaveLength(1)
    expect(mutations[0].position).toBe(3)
    expect(mutations[0].refBase).toBe("T")
    expect(mutations[0].varBase).toBe("G")
  })

  it("skips positions where either base is ambiguous", () => {
    expect(callMutations("ANGT", "ACGT")).toHaveLength(0)
    expect(callMutations("ACGT", "ANGT")).toHaveLength(0)
  })

  it("stops at the shorter of the two sequences", () => {
    expect(callMutations("ACGTACGT", "TCGT")).toHaveLength(1)
  })

  it("honours the result limit", () => {
    const target = "A".repeat(500)
    const reference = "T".repeat(500)
    expect(callMutations(target, reference, 10)).toHaveLength(10)
  })

  it("classifies transitions and transversions", () => {
    expect(classifySubstitution("A", "G")).toBe("transition")
    expect(classifySubstitution("C", "T")).toBe("transition")
    expect(classifySubstitution("A", "C")).toBe("transversion")
    expect(classifySubstitution("G", "T")).toBe("transversion")
  })
})

describe("qualityWarnings", () => {
  it("flags an empty sequence as an error", () => {
    const warnings = qualityWarnings(sequenceStats(""), null, null)
    expect(warnings[0].severity).toBe("error")
  })

  it("flags a short sequence", () => {
    const warnings = qualityWarnings(sequenceStats("ACGT"), null, null)
    expect(warnings.some((w) => w.message.includes("too short"))).toBe(true)
  })

  it("flags high ambiguity", () => {
    const sequence = "N".repeat(300) + "A".repeat(300)
    const warnings = qualityWarnings(sequenceStats(sequence), null, null)
    expect(warnings.some((w) => w.message.includes("ambiguous"))).toBe(true)
  })

  it("flags a large length discrepancy against the reference", () => {
    const target = parseFasta(">t\n" + "A".repeat(500))[0]
    const reference = parseFasta(">r\n" + "A".repeat(50))[0]
    const warnings = qualityWarnings(
      sequenceStats(target.sequence),
      target,
      reference,
    )
    expect(warnings.some((w) => w.message.includes("indel"))).toBe(true)
  })

  it("is silent on a clean sequence", () => {
    const sequence = "ACGT".repeat(200)
    expect(qualityWarnings(sequenceStats(sequence), null, null)).toEqual([])
  })
})
