import { describe, expect, it } from "vitest"

import {
  AMR_BY_GENE,
  AMR_ORGANISMS,
  AMR_RECORDS,
  databaseStats,
  drugClassCounts,
  searchRecords,
} from "@/lib/amr-records"
import {
  confidenceLevel,
  highConfidenceCalls,
  predictResistance,
} from "@/lib/amr-model"
import {
  MAX_HISTORY_POINTS,
  MicrobeSimulation,
  killRate,
  nutrientCoeff,
  oxygenCoeff,
  phCoeff,
  temperatureCoeff,
} from "@/lib/growth-model"
import {
  CODON_MAP,
  calculateFitness,
  createRandom,
  nextRunAction,
  mutateBase,
  runGeneration,
  temperatureFactor,
  toCelsius,
} from "@/lib/mutation-model"

/* ========================================================================== */

describe("AMR records", () => {
  it("has unique ids and gene symbols", () => {
    expect(new Set(AMR_RECORDS.map((r) => r.id)).size).toBe(AMR_RECORDS.length)
    expect(new Set(AMR_RECORDS.map((r) => r.gene)).size).toBe(AMR_RECORDS.length)
  })

  it("covers every gene the predictor offers", () => {
    // The predictor used to keep its own table; these are the genes it had.
    for (const gene of [
      "blaCTX-M",
      "blaOXA-48",
      "mecA",
      "vanA",
      "gyrA",
      "parC",
      "tetM",
    ]) {
      expect(AMR_BY_GENE.get(gene), `${gene} missing from the library`).toBeDefined()
    }
  })

  it("keeps every gene from the original library table", () => {
    for (const gene of ["blaCTX-M", "gyrA", "rpoB", "mecA", "erm(B)"]) {
      expect(AMR_BY_GENE.get(gene), `${gene} missing from the library`).toBeDefined()
    }
  })

  it("keeps confidence within 0-1 and prevalence within 0-100", () => {
    for (const record of AMR_RECORDS) {
      expect(record.confidence).toBeGreaterThan(0)
      expect(record.confidence).toBeLessThanOrEqual(1)
      expect(record.prevalence).toBeGreaterThan(0)
      expect(record.prevalence).toBeLessThanOrEqual(100)
    }
  })

  it("lists its primary organism among its organisms", () => {
    for (const record of AMR_RECORDS) {
      expect(record.organisms).toContain(record.organism)
    }
  })

  it("reports counts that match the data", () => {
    const stats = databaseStats()
    expect(stats.find((s) => s.label === "Genes")?.value).toBe(
      String(AMR_RECORDS.length),
    )
    expect(stats.find((s) => s.label === "Organisms")?.value).toBe(
      String(AMR_ORGANISMS.length),
    )
    expect(stats.find((s) => s.label === "Drug classes")?.value).toBe(
      String(drugClassCounts().length),
    )
  })

  it("searches across gene, organism, drug and mechanism", () => {
    expect(searchRecords("mecA").map((r) => r.gene)).toContain("mecA")
    expect(searchRecords("carbapenem").length).toBeGreaterThan(0)
    expect(searchRecords("E. coli").length).toBeGreaterThan(0)
    expect(searchRecords("zzzz")).toEqual([])
  })

  it("returns everything for an empty query", () => {
    expect(searchRecords("  ")).toHaveLength(AMR_RECORDS.length)
  })
})

describe("resistance prediction", () => {
  it("groups markers by drug class", () => {
    const result = predictResistance(["gyrA", "parC"], "E. coli")
    expect(result.calls).toHaveLength(1)
    expect(result.calls[0].drugClass).toBe("Fluoroquinolones")
    expect(result.calls[0].genes).toEqual(["gyrA", "parC"])
  })

  it("applies the gyrA + parC synergy rule", () => {
    const alone = predictResistance(["gyrA"], "E. coli")
    const together = predictResistance(["gyrA", "parC"], "E. coli")
    expect(alone.calls[0].confidence.score).toBe(0.4)
    expect(alone.calls[0].isSynergistic).toBe(false)
    expect(together.calls[0].confidence.score).toBe(0.9)
    expect(together.calls[0].isSynergistic).toBe(true)
    expect(together.calls[0].synergyNote).toBeTruthy()
  })

  it("takes the strongest marker in a class", () => {
    const result = predictResistance(["mecA"], "S. aureus")
    expect(result.calls[0].confidence.score).toBe(0.99)
    expect(result.calls[0].confidence.level).toBe("High")
  })

  it("sorts the worst call first", () => {
    const result = predictResistance(["gyrA", "mecA"], "S. aureus")
    const scores = result.calls.map((c) => c.confidence.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
  })

  it("reports genes it does not know", () => {
    const result = predictResistance(["mecA", "notAGene"], "S. aureus")
    expect(result.unknownGenes).toEqual(["notAGene"])
    expect(result.calls).toHaveLength(1)
  })

  it("flags markers not normally seen in the chosen organism", () => {
    // mecA is a staphylococcal marker; in E. coli it warrants a note.
    const result = predictResistance(["mecA"], "E. coli")
    expect(result.unexpectedForOrganism).toContain("mecA")
  })

  it("returns nothing for an empty selection", () => {
    expect(predictResistance([], "E. coli").calls).toEqual([])
  })

  it("stamps an ISO timestamp, not a locale string", () => {
    const { timestamp } = predictResistance(["mecA"], "S. aureus")
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it("maps scores to confidence bands", () => {
    expect(confidenceLevel(0.95)).toBe("High")
    expect(confidenceLevel(0.9)).toBe("High")
    expect(confidenceLevel(0.7)).toBe("Medium")
    expect(confidenceLevel(0.4)).toBe("Low")
  })

  it("selects only high-confidence calls as threats", () => {
    const result = predictResistance(["gyrA", "mecA"], "S. aureus")
    expect(highConfidenceCalls(result).map((c) => c.drugClass)).toEqual([
      "Beta-lactams",
    ])
  })
})

/* ========================================================================== */

describe("growth model coefficients", () => {
  it("peaks at 37C and falls off either side", () => {
    expect(temperatureCoeff(37)).toBeCloseTo(1, 5)
    expect(temperatureCoeff(30)).toBeLessThan(temperatureCoeff(35))
    expect(temperatureCoeff(44)).toBeLessThan(temperatureCoeff(40))
  })

  it("is zero outside the growth range", () => {
    expect(temperatureCoeff(10)).toBe(0)
    expect(temperatureCoeff(46)).toBe(0)
    expect(temperatureCoeff(80)).toBe(0)
  })

  it("peaks at pH 7 and clamps at zero", () => {
    expect(phCoeff(7)).toBe(1)
    expect(phCoeff(2)).toBe(0)
    expect(phCoeff(14)).toBe(0)
    expect(phCoeff(6)).toBeGreaterThan(0)
  })

  it("saturates with nutrients", () => {
    expect(nutrientCoeff(0)).toBe(0)
    expect(nutrientCoeff(20)).toBeCloseTo(0.5, 5)
    expect(nutrientCoeff(1000)).toBeGreaterThan(0.97)
  })

  it("drops sharply below 5% oxygen", () => {
    expect(oxygenCoeff(21)).toBe(1)
    expect(oxygenCoeff(2)).toBe(0.1)
  })

  it("kills less as resistance rises", () => {
    expect(killRate(0, 0)).toBe(0)
    expect(killRate(50, 0)).toBeGreaterThan(killRate(50, 0.9))
  })
})

describe("MicrobeSimulation", () => {
  /** Deterministic: never triggers the 10% log or the mutation roll. */
  const quiet = () => 0.99

  it("grows under optimal conditions", () => {
    const sim = new MicrobeSimulation(quiet)
    const before = sim.population
    sim.tick()
    expect(sim.population).toBeGreaterThan(before)
  })

  it("does not grow at a lethal temperature", () => {
    const sim = new MicrobeSimulation(quiet)
    sim.updateEnvironment({ temperature: 80 })
    const before = sim.population
    sim.tick()
    expect(sim.population).toBe(before)
  })

  it("approaches but does not exceed carrying capacity", () => {
    const sim = new MicrobeSimulation(quiet)
    for (let i = 0; i < 500; i++) sim.tick()
    expect(sim.population).toBeLessThanOrEqual(10_000)
  })

  it("acquires resistance under antibiotic pressure", () => {
    const sim = new MicrobeSimulation(quiet)
    sim.updateEnvironment({ antibioticOn: true })
    for (let i = 0; i < 20; i++) sim.tick()
    expect(sim.avgResistance).toBeGreaterThan(0)
  })

  it("loses resistance once the pressure is removed", () => {
    const sim = new MicrobeSimulation(quiet)
    sim.updateEnvironment({ antibioticOn: true })
    for (let i = 0; i < 20; i++) sim.tick()
    const peak = sim.avgResistance
    sim.updateEnvironment({ antibioticOn: false })
    for (let i = 0; i < 20; i++) sim.tick()
    expect(sim.avgResistance).toBeLessThan(peak)
  })

  it("maps the antibiotic toggle onto a concentration", () => {
    const sim = new MicrobeSimulation(quiet)
    sim.updateEnvironment({ antibioticOn: true })
    expect(sim.env.antibioticConc).toBe(50)
    sim.updateEnvironment({ antibioticOn: false })
    expect(sim.env.antibioticConc).toBe(0)
    // The flag must not survive onto the environment object.
    expect("antibioticOn" in sim.env).toBe(false)
  })

  it("bounds the growth history", () => {
    const sim = new MicrobeSimulation(quiet)
    for (let i = 0; i < MAX_HISTORY_POINTS + 100; i++) sim.tick()
    expect(sim.growthHistory.length).toBe(MAX_HISTORY_POINTS)
  })

  it("returns a fresh history array on each snapshot", () => {
    // The old model handed out its live array and then mutated it, so the
    // chart's memo never invalidated.
    const sim = new MicrobeSimulation(quiet)
    const first = sim.tick().growthHistory
    const second = sim.tick().growthHistory
    expect(first).not.toBe(second)
    expect(second.length).toBe(first.length + 1)
  })

  it("never reports a stress level above 1", () => {
    const sim = new MicrobeSimulation(quiet)
    sim.updateEnvironment({ oxygen: 100, temperature: 80, pH: 1 })
    const { stressLevels } = sim.tick()
    for (const value of Object.values(stressLevels)) {
      expect(value).toBeLessThanOrEqual(1)
      expect(value).toBeGreaterThanOrEqual(0)
    }
  })

  it("restores its starting state on reset", () => {
    const sim = new MicrobeSimulation(quiet)
    sim.updateEnvironment({ temperature: 20, antibioticOn: true })
    for (let i = 0; i < 10; i++) sim.tick()
    sim.reset()
    expect(sim.population).toBe(1000)
    expect(sim.timeStep).toBe(0)
    expect(sim.avgResistance).toBe(0)
    expect(sim.growthHistory).toEqual([])
    expect(sim.env.temperature).toBe(37)
  })
})

/* ========================================================================== */

describe("mutation model", () => {
  it("produces the same stream for the same seed", () => {
    const a = createRandom(42)
    const b = createRandom(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it("produces different streams for different seeds", () => {
    expect(createRandom(1)()).not.toBe(createRandom(2)())
  })

  it("stays within [0, 1)", () => {
    // The old generator multiplied a Date.now() seed by 9301, overflowing the
    // safe integer range and biasing its output.
    const random = createRandom(123456789)
    for (let i = 0; i < 10_000; i++) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it("converts Fahrenheit to Celsius", () => {
    expect(toCelsius(98.6, "F")).toBeCloseTo(37, 5)
    expect(toCelsius(37, "C")).toBe(37)
  })

  it("raises the mutation rate with temperature", () => {
    expect(temperatureFactor(37)).toBeCloseTo(1, 5)
    expect(temperatureFactor(47)).toBeGreaterThan(1)
    expect(temperatureFactor(27)).toBeLessThan(1)
  })

  it("mutates a base to a different base", () => {
    const random = createRandom(7)
    for (const base of ["A", "C", "G", "T"]) {
      expect(mutateBase(base, random)).not.toBe(base)
    }
  })

  it("prefers transitions over transversions", () => {
    const random = createRandom(99)
    let transitions = 0
    for (let i = 0; i < 2000; i++) {
      if (mutateBase("A", random) === "G") transitions += 1
    }
    expect(transitions / 2000).toBeGreaterThan(0.55)
  })

  it("maps codons to amino acids and stops", () => {
    expect(CODON_MAP.ATG).toBe("M")
    expect(CODON_MAP.TAA).toBe("*")
    expect(CODON_MAP.TGA).toBe("*")
    expect(CODON_MAP.TGG).toBe("W")
  })

  it("generates insertions and deletions, not only substitutions", () => {
    // The "Insertions" readout on the view was hardwired to zero because
    // nothing ever produced one.
    const sequence = "ATGAAACCCGGGTTT".repeat(400)
    const result = runGeneration(
      sequence,
      1,
      { substitutionRate: 0.02, temperature: 37, tempUnit: "C" },
      createRandom(2024),
    )
    expect(result.substitutions).toBeGreaterThan(0)
    expect(result.insertions + result.deletions).toBeGreaterThan(0)
    expect(result.mutations.some((m) => m.type === "insertion")).toBe(true)
  })

  it("changes sequence length by the indel balance", () => {
    const sequence = "ATGAAACCCGGGTTT".repeat(400)
    const result = runGeneration(
      sequence,
      1,
      { substitutionRate: 0.02, temperature: 37, tempUnit: "C" },
      createRandom(2024),
    )
    expect(result.sequence.length).toBe(
      sequence.length + result.insertions - result.deletions,
    )
  })

  it("makes no changes at a zero rate", () => {
    const sequence = "ATGAAACCCGGGTTT".repeat(20)
    const result = runGeneration(
      sequence,
      1,
      { substitutionRate: 0, temperature: 37, tempUnit: "C" },
      createRandom(1),
    )
    expect(result.mutations).toEqual([])
    expect(result.sequence).toBe(sequence)
  })

  it("is reproducible for a given seed", () => {
    const sequence = "ATGAAACCCGGGTTT".repeat(100)
    const params = { substitutionRate: 0.01, temperature: 37, tempUnit: "C" as const }
    const a = runGeneration(sequence, 1, params, createRandom(5))
    const b = runGeneration(sequence, 1, params, createRandom(5))
    expect(a.sequence).toBe(b.sequence)
    expect(a.mutations).toEqual(b.mutations)
  })

  it("returns mutations in positional order", () => {
    const sequence = "ATGAAACCCGGGTTT".repeat(300)
    const { mutations } = runGeneration(
      sequence,
      1,
      { substitutionRate: 0.02, temperature: 37, tempUnit: "C" },
      createRandom(11),
    )
    const positions = mutations.map((m) => m.position)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it("penalises indels far more heavily than a coding substitution", () => {
    const base = {
      generation: 1,
      position: 0,
      original: "A",
      mutated: "G",
      context: "coding" as const,
    }
    const substitution = calculateFitness([
      { ...base, type: "substitution", aminoAcidChange: "K->E" },
    ])
    const insertion = calculateFitness([
      { ...base, type: "insertion", aminoAcidChange: "frameshift" },
    ])
    expect(substitution).toBe(98.5)
    expect(insertion).toBe(90)
  })

  it("does not penalise a synonymous change", () => {
    expect(
      calculateFitness([
        {
          generation: 1,
          position: 0,
          type: "substitution",
          original: "A",
          mutated: "G",
          aminoAcidChange: "none",
          context: "coding",
        },
      ]),
    ).toBe(100)
  })

  it("penalises a premature stop more than a swap", () => {
    const stop = calculateFitness([
      {
        generation: 1,
        position: 0,
        type: "substitution",
        original: "A",
        mutated: "G",
        aminoAcidChange: "W->*",
        context: "coding",
      },
    ])
    expect(stop).toBe(94)
  })

  it("never returns a negative fitness", () => {
    const mutations = Array.from({ length: 200 }, (_, i) => ({
      generation: 1,
      position: i,
      type: "deletion" as const,
      original: "A",
      mutated: "-",
      aminoAcidChange: "frameshift",
      context: "coding" as const,
    }))
    expect(calculateFitness(mutations)).toBe(0)
  })
})

describe("run control", () => {
  const base = {
    isRunning: false,
    hasSequence: true,
    currentGeneration: 0,
    numGenerations: 5,
    hasInvalidParams: false,
  }

  it("pauses a run in flight", () => {
    // The regression this exists for: the button labelled "Pause" used to
    // reset the run and start it again from generation zero.
    expect(nextRunAction({ ...base, isRunning: true, currentGeneration: 3 })).toBe(
      "pause",
    )
  })

  it("pauses even when the parameters are invalid", () => {
    // Stopping must never be blocked by a validation error.
    expect(
      nextRunAction({ ...base, isRunning: true, hasInvalidParams: true }),
    ).toBe("pause")
  })

  it("resumes a partially completed run rather than restarting it", () => {
    expect(nextRunAction({ ...base, currentGeneration: 3 })).toBe("resume")
  })

  it("restarts once every generation has run", () => {
    expect(nextRunAction({ ...base, currentGeneration: 5 })).toBe("restart")
  })

  it("blocks with no sequence loaded", () => {
    expect(nextRunAction({ ...base, hasSequence: false })).toBe("blocked")
  })

  it("blocks on an invalid parameter", () => {
    expect(nextRunAction({ ...base, hasInvalidParams: true })).toBe("blocked")
  })

  it("starts a fresh run from zero", () => {
    expect(nextRunAction(base)).toBe("resume")
  })
})
