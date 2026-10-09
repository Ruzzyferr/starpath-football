/**
 * Attribute sensitivity of the background match sim (owner requirement: every stat must tangibly change the
 * game). The same matches (same seeds, same auto-resolve stream) are simulated with the hero's attribute low
 * (40) and high (85), everything else equal, and the hero's involvement / outcomes are compared.
 * Used by attrSensitivity.test.ts and the "Özellik etki tablosu" in docs/BALANCE.md.
 */
import { Rng } from '../../core/rng'
import type { AttributeKey, Attributes, Formation, Position } from '../../core/types'
import { ATTRIBUTE_KEYS, isGoalkeepingAttr } from '../../core/types'
import { autoResolve, outcomeProbabilities } from './autoResolve'
import { highlightRatingDelta } from './rating'
import { MatchSim } from './engine'
import { makeSetup } from './testFixtures'
import type { HighlightKind, HighlightOutcome } from './types'

export const SENS_LOW = 40
export const SENS_HIGH = 85

/** Even sheet: every attribute at `base`, a keeper's goalkeeping at `base`, an outfielder's at 25. */
export function evenSheet(pos: Position, base = 65): Attributes {
  const a = {} as Attributes
  for (const k of ATTRIBUTE_KEYS) a[k] = pos !== 'GK' && isGoalkeepingAttr(k) ? 25 : base
  return a
}

export interface SimSensStats {
  matches: number
  /** Final match rating. */
  rating: number
  /** Goals + assists per match. */
  ga: number
  shots: number
  /** Tackles per match. */
  tackles: number
  saves: number
  /** Pass completion share. */
  passPct: number
  passes: number
  /** Share of hero moments that ended well (auto-resolved). */
  success: number
  /** Hero's team goals for / against per match. */
  gf: number
  gaTeam: number
  /** Hero moments per match. */
  moments: number
  cards: number
  /** The hero's own rating contribution (moments + background duels/involvement; no team result). */
  own: number
  /** Team goal difference per match. */
  gd: number
  /**
   * Expected own contribution per match: the expected rating of every moment the hero got (auto-resolve odds,
   * so no outcome noise) plus the background duels / involvement actually booked.
   */
  xOwn: number
}

/** Expected rating change of a skipped moment of `kind` for a hero sheet (outcome odds × outcome delta). */
export function expectedMomentDelta(kind: HighlightKind, attrs: Attributes, difficulty = 1): number {
  const p = outcomeProbabilities(kind, attrs, difficulty)
  let e = 0
  for (const [o, w] of Object.entries(p) as [HighlightOutcome, number][]) {
    e += w * highlightRatingDelta(kind, { outcome: o, passes: 0, passesCompleted: 0, shots: 0, shotsOnTarget: 0, dribbles: 0, tackles: 0 })
  }
  return e
}

const GOOD: ReadonlySet<HighlightOutcome> = new Set<HighlightOutcome>(['goal', 'assist', 'pass_complete', 'defended', 'foul_won'])
const FORMATION: Partial<Record<Position, Formation>> = { DM: '4-3-3', LW: '4-3-3', RW: '4-3-3', AM: '4-2-3-1' }

/** `n` full matches (both teams ~`ovr`) with the hero's sheet `attrs` at `pos`; every moment auto-resolved. */
export function simSheet(pos: Position, attrs: Attributes, n: number, opts: { ovr?: number; captain?: boolean; seed0?: number } = {}): SimSensStats {
  const ovr = opts.ovr ?? 65
  const out: SimSensStats = { matches: 0, rating: 0, ga: 0, shots: 0, tackles: 0, saves: 0, passPct: 0, passes: 0, success: 0, gf: 0, gaTeam: 0, moments: 0, cards: 0, own: 0, gd: 0, xOwn: 0 }
  let moments = 0
  let passes = 0
  let done = 0
  const arng = new Rng(`attr-sim:${pos}:${opts.seed0 ?? 1}`)
  for (let i = 0; i < n; i++) {
    const seed = (opts.seed0 ?? 1) + i * 37
    const setup = makeSetup({ seed, heroSide: 'home', home: { heroPosition: pos, formation: FORMATION[pos] ?? '4-4-2', ovr, heroOvr: ovr }, away: { ovr, formation: '4-4-2' } })
    if (opts.captain) setup.heroCaptain = true
    const hero = setup.home.lineup.find((p) => p.isHero)
    if (!hero) continue
    hero.attrs = { ...attrs }
    hero.ovr = ovr
    const sim = new MatchSim(setup, 'en')
    let guard = 0
    while (!sim.finished && guard++ < 6000) {
      const h = sim.pendingHighlight
      if (h) {
        moments++
        out.xOwn += expectedMomentDelta(h.kind, attrs)
        const r = autoResolve(h.kind, attrs, 1, arng)
        if (GOOD.has(r.outcome)) out.success++
        sim.resolveHighlight(r)
      } else sim.step()
    }
    const snap = sim.snapshot()
    const st = snap.heroStats
    out.matches++
    out.rating += st.rating
    out.ga += st.goals + st.assists
    out.shots += st.shots
    out.tackles += st.tackles
    out.saves += st.saves
    passes += st.passes
    done += st.passesCompleted
    out.gf += snap.score[0]
    out.gaTeam += snap.score[1]
    out.cards += st.yellow + st.red
    for (const e of snap.heroLog ?? []) {
      if (e.source === 'moment' || e.source === 'background') out.own += e.delta
      if (e.source === 'background') out.xOwn += e.delta
    }
  }
  const m = Math.max(1, out.matches)
  return {
    matches: out.matches, rating: out.rating / m, ga: out.ga / m, shots: out.shots / m, tackles: out.tackles / m, saves: out.saves / m,
    passPct: passes ? done / passes : 0, passes: passes / m, success: out.success / Math.max(1, moments), gf: out.gf / m, gaTeam: out.gaTeam / m,
    moments: moments / m, cards: out.cards / m, own: out.own / m, gd: (out.gf - out.gaTeam) / m, xOwn: out.xOwn / m,
  }
}

export type SimMetric = keyof Omit<SimSensStats, 'matches'>

export interface SimProbe {
  attr: AttributeKey
  pos: Position
  /** The metric the attribute must move (and the sign it must move it with). */
  metric: SimMetric
  sign: 1 | -1
  /** Minimum |high − low| for the metric. */
  min: number
  captain?: boolean
}

/**
 * One probe per attribute: the hero position the attribute matters most for, and the involvement /
 * outcome metric it must move in the background sim.
 */
export const SIM_PROBES: readonly SimProbe[] = [
  { attr: 'pace', pos: 'LW', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'acceleration', pos: 'ST', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'stamina', pos: 'CM', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'strength', pos: 'CB', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'balance', pos: 'ST', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'agility', pos: 'LW', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'jumping', pos: 'CB', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'passing', pos: 'CM', metric: 'passPct', sign: 1, min: 0.05 },
  { attr: 'longPassing', pos: 'CM', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'crossing', pos: 'LW', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'dribbling', pos: 'LW', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'firstTouch', pos: 'ST', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'shooting', pos: 'AM', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'finishing', pos: 'ST', metric: 'ga', sign: 1, min: 0.08 },
  { attr: 'curve', pos: 'AM', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'heading', pos: 'CB', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'tackling', pos: 'CB', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'setPieces', pos: 'AM', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'vision', pos: 'CM', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'composure', pos: 'ST', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'positioning', pos: 'CB', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'anticipation', pos: 'CB', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'aggression', pos: 'CB', metric: 'tackles', sign: 1, min: 0.1 },
  // The trade-off: the aggressive defender is booked more often.
  { attr: 'aggression', pos: 'CB', metric: 'cards', sign: 1, min: 0.02 },
  { attr: 'leadership', pos: 'CB', metric: 'gd', sign: 1, min: 0.2, captain: true },
  { attr: 'workRate', pos: 'CM', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'reflexes', pos: 'GK', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'diving', pos: 'GK', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'handling', pos: 'GK', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'gkPositioning', pos: 'GK', metric: 'xOwn', sign: 1, min: 0.08 },
  { attr: 'gkDistribution', pos: 'GK', metric: 'xOwn', sign: 1, min: 0.08 },
]

export interface SimSensRow {
  probe: SimProbe
  low: SimSensStats
  high: SimSensStats
  /** Signed effect on the probe metric (high − low, times the sign). */
  effect: number
}

/** Runs one probe: `n` matches low, the same `n` matches high. */
export function runSimProbe(p: SimProbe, n: number): SimSensRow {
  const sheet = (v: number): Attributes => ({ ...evenSheet(p.pos), [p.attr]: v })
  const opts = { captain: !!p.captain, seed0: 11 }
  const low = simSheet(p.pos, sheet(SENS_LOW), n, opts)
  const high = simSheet(p.pos, sheet(SENS_HIGH), n, opts)
  return { probe: p, low, high, effect: (high[p.metric] - low[p.metric]) * p.sign }
}
