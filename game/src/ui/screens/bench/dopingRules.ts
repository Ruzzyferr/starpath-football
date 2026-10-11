/**
 * Doping test rules (headless; DopingTest.tsx renders them, dopingRules.test.ts
 * plays them with simulated players). Balance study 2026-10: the test used the
 * same band and the same clock for every hero, so Composure meant nothing.
 * Now the hero's state sets the difficulty:
 *  - Composure widens the green band and steadies the needle (low Composure
 *    adds a hand tremor on top of the breath);
 *  - Composure + discipline (how the hero handles officials) set how long the
 *    forms can take before slow signing starts to cost.
 * The score (0..1) is 65% calm breathing + 35% forms, and the sim's reward
 * (Composure XP, morale, discipline) scales with it (sim/game/agenda).
 */

export const BREATH_SECONDS = 12
export const FORMS_SECONDS = 15
/** Needle speed (per second) while breathing in / out. */
export const BREATH_IN = 0.62
export const BREATH_OUT = 0.5
/** Band centre swing and period (s). */
export const BAND_SWING = 0.24
export const BAND_PERIOD = 5.2
/** Grade B and up = a passing test. */
export const DOPING_PASS = 0.6

export interface DopingParams {
  /** Half-height of the green band (0..1 gauge). */
  band: number
  /** Amplitude of the hand tremor on the needle. */
  tremor: number
  /** Seconds the three forms can take at full marks. */
  formsFull: number
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)
/** 0..1 from a 0..100 stat: 30 → 0, 90 → 1. */
const s01 = (v: number): number => clamp01((v - 30) / 60)

/** The test's difficulty for a hero (Composure, life discipline). */
export function dopingParams(composure: number, discipline: number): DopingParams {
  const c = s01(composure)
  const d = s01((composure + discipline) / 2)
  return {
    band: Math.round((0.06 + 0.09 * c) * 1000) / 1000,
    tremor: Math.round(0.1 * (1 - c) * 1000) / 1000,
    formsFull: Math.round((3.8 + 5 * d) * 10) / 10,
  }
}

/** Band centre at time t (s) for a seeded phase. */
export const bandCenter = (t: number, phase: number): number => 0.5 + BAND_SWING * Math.sin((2 * Math.PI * t) / BAND_PERIOD + phase)

/** The hand tremor at time t (two incommensurate wobbles, no RNG: same every frame rate). */
export const tremorAt = (t: number, amp: number, phase: number): number =>
  amp * (0.6 * Math.sin(2 * Math.PI * 1.7 * t + phase) + 0.4 * Math.sin(2 * Math.PI * 3.1 * t + 2 * phase))

/** One breathing step: the lungs' level after dt seconds. */
export const breathStep = (v: number, hold: boolean, dt: number): number => clamp01(v + (hold ? BREATH_IN : -BREATH_OUT) * dt)

/** The needle as drawn and judged: the breath plus the tremor. */
export const needleAt = (v: number, t: number, p: DopingParams, phase: number): number => clamp01(v + tremorAt(t, p.tremor, phase))

export const inBand = (needle: number, center: number, p: DopingParams): boolean => Math.abs(needle - center) <= p.band

/** Calm 0..1 from the seconds spent in the band. */
export const calmScore = (inBandSeconds: number): number => clamp01((inBandSeconds / BREATH_SECONDS - 0.15) / 0.7)

/** Forms 0..1: order mistakes, time past the full-marks window, unsigned forms. */
export function formsScore(elapsed: number, mistakes: number, signed: number, p: DopingParams): number {
  const speed = elapsed <= p.formsFull ? 1 : Math.max(0.5, 1 - (elapsed - p.formsFull) / 12)
  return Math.max(0, 1 - 0.3 * mistakes) * speed * (signed / 3)
}

export const dopingPerformance = (calm: number, forms: number): number => Math.round((0.65 * calm + 0.35 * forms) * 100) / 100

export const dopingGrade = (p: number): string => (p >= 0.9 ? 'S' : p >= 0.78 ? 'A' : p >= DOPING_PASS ? 'B' : p >= 0.4 ? 'C' : 'D')
