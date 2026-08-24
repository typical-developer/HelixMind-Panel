/**
 * Population dynamics for the Microbe Growth Lab.
 *
 * Extracted from the view so the model can be tested directly. The maths is
 * unchanged: logistic growth with a Gaussian temperature response, a quadratic
 * pH response, Monod nutrient limitation, and a Hill-function antibiotic kill
 * rate whose MIC rises as the culture acquires resistance.
 *
 * KNOWN GAP — the selected strain does not feed this model. `growthRate`,
 * `tempOptimal` and `resistance` on a strain are displayed but never read here,
 * so every strain grows identically. This is recorded in docs/BUG-REPORT.md and
 * is deliberately left in place for now rather than silently removed.
 */

export const CARRYING_CAPACITY = 10_000
export const MAX_GROWTH_RATE = 0.35
/** Monod half-saturation constant. */
export const K_S = 20
export const BASE_MUTATION_RATE = 0.005
export const SELECTION_COEFFICIENT = 0.1

/** How many points the chart keeps. Beyond this the head is dropped. */
export const MAX_HISTORY_POINTS = 600

/** Adaptation log lines retained in the rolling buffer. */
const MAX_LOG_LINES = 10

export interface Environment {
  temperature: number
  pH: number
  nutrients: number
  oxygen: number
  antibioticConc: number
}

export interface GrowthPoint {
  time: number
  population: number
}

export interface SimulationState {
  population: number
  timeStep: number
  /** Percentage, 0–100, for display. */
  resistanceLevel: number
  growthHistory: GrowthPoint[]
  adaptationLog: string[]
  stressLevels: {
    temperature: number
    ph: number
    nutrients: number
    oxygen: number
  }
  /** Fraction, 0–1. */
  resistance: number
  environment: Environment
  /** True once the population has reached zero after starting. */
  collapsed: boolean
}

const DEFAULT_ENV: Environment = {
  temperature: 37,
  pH: 7.0,
  nutrients: 100,
  oxygen: 21,
  antibioticConc: 0,
}

/** Injectable so tests are deterministic. */
export type RandomSource = () => number

/* ============================================================================
   Environmental response curves
   ========================================================================= */

/** Gaussian around 37 °C, zero outside the 10–46 °C growth range. */
export function temperatureCoeff(temperature: number): number {
  const optimal = 37
  if (temperature <= 10 || temperature >= 46) return 0
  const sigma = 5
  return Math.exp(-0.5 * ((temperature - optimal) / sigma) ** 2)
}

/** Inverted parabola centred on pH 7, clamped at zero. */
export function phCoeff(pH: number): number {
  const optimal = 7.0
  const width = 2.5
  return Math.max(0, 1 - ((pH - optimal) / width) ** 2)
}

/** Monod kinetics: saturating uptake as substrate rises. */
export function nutrientCoeff(nutrients: number): number {
  if (nutrients <= 0) return 0
  return nutrients / (K_S + nutrients)
}

/** Anaerobes still manage something; below 5% it is a tenth of aerobic growth. */
export function oxygenCoeff(oxygen: number): number {
  return oxygen > 5 ? 1 : 0.1
}

/**
 * Hill-function kill rate.
 *
 * The MIC climbs from 10 to 100 as average resistance goes 0 → 1, so a fixed
 * dose becomes progressively less effective as the culture adapts.
 */
export function killRate(antibioticConc: number, resistance: number): number {
  if (antibioticConc <= 0) return 0
  const mic = 10 + resistance * 90
  const n = 2
  const efficacy = antibioticConc ** n / (mic ** n + antibioticConc ** n)
  return 0.4 * efficacy
}

/* ============================================================================
   Simulation
   ========================================================================= */

export class MicrobeSimulation {
  population = 1000
  timeStep = 0
  avgResistance = 0
  adaptationLog: string[] = ["Culture inoculated."]
  growthHistory: GrowthPoint[] = []
  env: Environment = { ...DEFAULT_ENV }

  private random: RandomSource

  constructor(random: RandomSource = Math.random) {
    this.random = random
  }

  reset() {
    this.population = 1000
    this.timeStep = 0
    this.avgResistance = 0
    this.adaptationLog = ["Culture inoculated."]
    this.growthHistory = []
    this.env = { ...DEFAULT_ENV }
  }

  updateEnvironment(
    updates: Partial<Environment> & { antibioticOn?: boolean },
  ): void {
    const { antibioticOn, ...rest } = updates
    const next: Partial<Environment> = { ...rest }
    if (antibioticOn !== undefined) {
      next.antibioticConc = antibioticOn ? 50 : 0
    }
    this.env = { ...this.env, ...next }
  }

  tick(): SimulationState {
    this.timeStep += 1

    const tempK = temperatureCoeff(this.env.temperature)
    const phK = phCoeff(this.env.pH)
    const nutrientK = nutrientCoeff(this.env.nutrients)
    const oxygenK = oxygenCoeff(this.env.oxygen)

    const growthRate = MAX_GROWTH_RATE * tempK * phK * nutrientK * oxygenK
    const logisticFactor = 1 - this.population / CARRYING_CAPACITY
    const growthAmount = this.population * growthRate * logisticFactor

    const kill = killRate(this.env.antibioticConc, this.avgResistance)
    const deathAmount = this.population * kill

    if (kill > 0.01 && this.population > 0) {
      this.avgResistance = Math.min(
        1,
        this.avgResistance + kill * SELECTION_COEFFICIENT,
      )
      if (this.random() < 0.1) {
        this.log(
          `Step ${this.timeStep}: selection → resistance ${(
            this.avgResistance * 100
          ).toFixed(1)}%`,
        )
      }
    } else if (this.avgResistance > 0) {
      // Resistance is costly; it decays once the pressure is removed.
      this.avgResistance = Math.max(0, this.avgResistance - 0.001)
    }

    const stress = 1 - tempK * phK
    const mutationChance = BASE_MUTATION_RATE * (1 + stress * 5)
    if (this.random() < mutationChance) {
      this.avgResistance = Math.min(1, this.avgResistance + 0.01)
      this.log(`Step ${this.timeStep}: mutation detected.`)
    }

    const consumption = growthAmount > 0 ? growthAmount * 0.05 : 0
    this.env = {
      ...this.env,
      nutrients: Math.max(0, this.env.nutrients - consumption),
    }

    const previous = this.population
    this.population = Math.max(
      0,
      Math.round(this.population + growthAmount - deathAmount),
    )

    if (previous > 0 && this.population === 0) {
      this.log(`Step ${this.timeStep}: culture collapsed.`)
    }

    this.growthHistory.push({ time: this.timeStep, population: this.population })
    // The array was previously unbounded — a long experiment grew it without
    // limit and handed every point to Recharts on each tick.
    if (this.growthHistory.length > MAX_HISTORY_POINTS) {
      this.growthHistory.splice(0, this.growthHistory.length - MAX_HISTORY_POINTS)
    }

    return this.getState()
  }

  private log(line: string) {
    this.adaptationLog = [...this.adaptationLog, line]
    if (this.adaptationLog.length > MAX_LOG_LINES) {
      this.adaptationLog = this.adaptationLog.slice(-MAX_LOG_LINES)
    }
  }

  /**
   * A snapshot with fresh array identities.
   *
   * The previous implementation returned its live `growthHistory` array, which
   * it then mutated in place — so the chart's `useMemo` keyed on it never
   * invalidated, and React had no way to tell the data had changed.
   */
  getState(): SimulationState {
    return {
      population: this.population,
      timeStep: this.timeStep,
      resistanceLevel: Math.round(this.avgResistance * 100),
      growthHistory: [...this.growthHistory],
      adaptationLog: [...this.adaptationLog],
      stressLevels: {
        temperature: 1 - temperatureCoeff(this.env.temperature),
        ph: 1 - phCoeff(this.env.pH),
        nutrients: 1 - nutrientCoeff(this.env.nutrients),
        // Clamped: the previous expression divided by 21 and could report a
        // stress above 1, which drew progress bars past their track.
        oxygen: Math.min(1, Math.abs(this.env.oxygen - 21) / 21),
      },
      resistance: this.avgResistance,
      environment: { ...this.env },
      collapsed: this.population === 0 && this.timeStep > 0,
    }
  }
}
