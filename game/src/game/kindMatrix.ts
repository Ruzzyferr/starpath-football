/**
 * All-kinds balance matrix (owner, build 8: "not just passing, ALL minigames"): every moment kind played by the
 * human-like bot (game/humanBot: `good` = a sensible player, `novice` = sloppy thumbs and timing) through the real
 * runtime, with the hero's moment attributes (game/matchup kindHeroAttrs) at 40…90 and the opposition weak /
 * average / strong (every opponent's sheet −15 / ±0 / +15). Report: KIND_MATRIX=1 npx vitest run src/game/kindMatrix.test.ts
 */
import type { Attributes, AttributeKey } from '../core/types'
import type { Highlight, HighlightKind } from '../sim/match/types'
import { FEEL_KINDS, feelHighlight, type FeelKind } from './feelHarness'
import { momentTier, tierSuccess, type MomentTier } from '../sim/match/tier'
import { createHumanBot, humanBotStep, type BotLevel } from './humanBot'
import { kindHeroAttrs } from './matchup'
import { HighlightRuntime } from './runtime'

export const MATRIX_LEVELS = [40, 50, 60, 70, 80, 90] as const
export type OppStrength = 'weak' | 'average' | 'strong'
export const OPP_SHIFT: Record<OppStrength, number> = { weak: -15, average: 0, strong: 15 }
/** Team-mates and opponents (a starting hero's league) and the starting hero's sheet. */
export const MATRIX_TEAM_OVR = 62
export const MATRIX_START_OVR = 57
export type MatrixInput = 'good' | 'sloppy'
const BOT: Record<MatrixInput, BotLevel> = { good: 'good', sloppy: 'novice' }

const shift = (a: Attributes, d: number): Attributes => {
  const out = { ...a }
  for (const k of Object.keys(out) as AttributeKey[]) out[k] = Math.max(1, Math.min(99, (out[k] ?? 50) + d))
  return out
}

/** The highlight for a cell: `level` = the kind's hero attributes (null = a starting hero's own sheet). */
export function matrixHighlight(kind: FeelKind, seed: number, level: number | null, opp: OppStrength): Highlight {
  const hl = feelHighlight(kind, seed, MATRIX_TEAM_OVR)
  // feelHighlight gives everyone `ovr`; the hero starts from a starting player's sheet.
  const start = feelHighlight(kind, seed, MATRIX_START_OVR).scenario.players.find((p) => p.isHero)
  for (const p of hl.scenario.players) {
    if (p.isHero) {
      p.attrs = { ...(start?.attrs ?? p.attrs) }
      if (level !== null) for (const k of kindHeroAttrs(kind)) p.attrs[k] = level
    } else if (p.side !== hl.side && OPP_SHIFT[opp]) p.attrs = shift(p.attrs, OPP_SHIFT[opp])
  }
  return hl
}

/** One trial's graded result (sim/match/tier). */
export function matrixTier(kind: FeelKind, seed: number, level: number | null, input: MatrixInput, opp: OppStrength): MomentTier {
  const rt = new HighlightRuntime(matrixHighlight(kind, seed, level, opp), { aimAssist: 'half', slowMoAim: true, difficulty: 'normal', seed: seed * 7919 + 13 })
  const bot = createHumanBot(BOT[input], seed)
  const dt = 1 / 60
  for (let f = 0; f < 60 * 90 && !rt.finished; f++) {
    humanBotStep(rt, bot, dt)
    rt.update(dt)
    rt.drainEvents()
  }
  return rt.result?.tier ?? momentTier(kind as HighlightKind, rt.result ?? { outcome: 'timeout' })
}

/** Success (full or partial) of one trial. */
export const matrixTrial = (kind: FeelKind, seed: number, level: number | null, input: MatrixInput, opp: OppStrength): boolean =>
  tierSuccess(matrixTier(kind, seed, level, input, opp))

export interface MatrixRates {
  /** Full + partial. */
  success: number
  /** Full only (a goal in the goal-oriented kinds). */
  full: number
}

export function matrixRates(kind: FeelKind, level: number | null, input: MatrixInput, opp: OppStrength, n: number): MatrixRates {
  let ok = 0
  let full = 0
  for (let s = 1; s <= n; s++) {
    const t = matrixTier(kind, s, level, input, opp)
    if (t !== 'fail') ok++
    if (t === 'full') full++
  }
  return { success: ok / n, full: full / n }
}

export const matrixRate = (kind: FeelKind, level: number | null, input: MatrixInput, opp: OppStrength, n: number): number => matrixRates(kind, level, input, opp, n).success

export { FEEL_KINDS as MATRIX_KINDS }
