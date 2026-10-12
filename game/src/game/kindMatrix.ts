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
/**
 * Input path of the bots: 'phone' = only what a touch screen sends (game/phoneInput — context buttons with the stick,
 * on-screen holds), the default since the build 9 pressing report; 'keys' = the bot's own shapes (the desktop ACTION
 * key among them), the pre-fix harness. KIND_PATH=keys in the reports to compare.
 */
export type MatrixPath = 'phone' | 'keys'
const ENV = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
export const MATRIX_PATH: MatrixPath = ENV.KIND_PATH === 'keys' ? 'keys' : 'phone'
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
export function matrixTier(kind: FeelKind, seed: number, level: number | null, input: MatrixInput, opp: OppStrength, path: MatrixPath = MATRIX_PATH): MomentTier {
  const rt = new HighlightRuntime(matrixHighlight(kind, seed, level, opp), { aimAssist: 'half', slowMoAim: true, difficulty: 'normal', seed: seed * 7919 + 13 })
  const bot = createHumanBot(BOT[input], seed, path === 'phone')
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

/**
 * The four build-9 checks every moment kind must pass (owner): a starting hero with good input succeeds about 55–75 %
 * against average opposition; success rises with the kind's own attributes (40 → 65 → 90); careless input is at
 * least 20 points worse; a stronger opponent means lower success. Tolerances cover sampling noise at n = 200.
 */
export const KIND_CHECK = { band: [0.3, 0.85], stepTol: 0.04, spread: 0.08, gap: 0.2, oppTol: 0.02, oppSpread: 0.04, floor: 0.3 } as const

/**
 * Graded value of a cell (owner, build 9 physics pass): a full success 1, a partial ½. With saves decided by physics a
 * better finisher turns placed saves (partial) into goals (full), so full + partial saturates while the quality the
 * stats buy keeps rising — the stat checks (rising, opponent) read this; band, gap and floor read success.
 */
export const graded = (r: MatrixRates): number => (r.success + r.full) / 2

export interface KindCheck {
  kind: FeelKind
  start: MatrixRates
  levels: [number, number, number]
  /** Graded value (full 1, partial ½) at 40 / 65 / 90 — what `rising` reads. */
  levelsG: [number, number, number]
  sloppy: number
  opp: { strong: number; average: number; weak: number }
  /** Graded value against strong / average / weak — what `oppOrder` reads. */
  oppG: { strong: number; average: number; weak: number }
  /** Good input, the kind's attributes at 40, against strong opposition (reported; the floor is at 40 vs average). */
  weakVsStrong: number
  band: boolean
  rising: boolean
  gap: boolean
  oppOrder: boolean
  /** Good input at 40 against the average side ≥ KIND_CHECK.floor (the owner's "3 in 10 played well, weak stats"). */
  floor: boolean
}

export function kindCheck(kind: FeelKind, n = 200): KindCheck {
  const C = KIND_CHECK
  const start = matrixRates(kind, null, 'good', 'average', n)
  const lvR = [40, 65, 90].map((lv) => matrixRates(kind, lv, 'good', 'average', n))
  const levels = lvR.map((r) => r.success) as [number, number, number]
  const levelsG = lvR.map(graded) as [number, number, number]
  const sloppy = matrixRate(kind, null, 'sloppy', 'average', n)
  const strongR = matrixRates(kind, null, 'good', 'strong', n)
  const weakR = matrixRates(kind, null, 'good', 'weak', n)
  const opp = { strong: strongR.success, average: start.success, weak: weakR.success }
  const oppG = { strong: graded(strongR), average: graded(start), weak: graded(weakR) }
  const weakVsStrong = matrixRate(kind, 40, 'good', 'strong', n)
  // The floor (owner, build 9 physics pass): correct play at stat 40 succeeds ≥ 30 % — against the average side. Under
  // the linear rule a 40 against a strong side's 77 is a 13 % duel; that column is reported (weakVsStrong), not pinned.
  // (Rates are k / n: an exact 8-point spread is 0.07999… in floating point — compare with a hair of tolerance.)
  const E = 1e-9
  return {
    kind, start, levels, levelsG, sloppy, opp, oppG, weakVsStrong,
    floor: levels[0] >= C.floor - E,
    band: start.success >= C.band[0] - E && start.success <= C.band[1] + E,
    rising: levelsG[1] >= levelsG[0] - C.stepTol - E && levelsG[2] >= levelsG[1] - C.stepTol - E && levelsG[2] - levelsG[0] >= C.spread - E,
    gap: start.success - sloppy >= C.gap - E,
    oppOrder: oppG.strong < oppG.average + C.oppTol + E && oppG.average < oppG.weak + C.oppTol + E && oppG.strong < oppG.weak - C.oppSpread + E,
  }
}

/** One line per kind (scripts, docs/BALANCE.md). */
export const kindCheckLine = (c: KindCheck): string => {
  const p = (x: number) => Math.round(x * 100)
  const ok = (b: boolean) => (b ? 'OK' : 'NO')
  return `CHK ${c.kind} | start ${p(c.start.success)}(${p(c.start.full)}) ${ok(c.band)} | 40/65/90 ${c.levels.map(p).join('/')} graded ${c.levelsG.map(p).join('/')} ${ok(c.rising)} | sloppy ${p(c.sloppy)} gap ${p(c.start.success - c.sloppy)} ${ok(c.gap)} | strong/avg/weak ${p(c.opp.strong)}/${p(c.opp.average)}/${p(c.opp.weak)} graded ${p(c.oppG.strong)}/${p(c.oppG.average)}/${p(c.oppG.weak)} ${ok(c.oppOrder)} | floor 40 ${p(c.levels[0])} ${ok(c.floor)} | 40vsStrong ${p(c.weakVsStrong)}`
}

export { FEEL_KINDS as MATRIX_KINDS }
