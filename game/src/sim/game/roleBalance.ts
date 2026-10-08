/**
 * Role balance harness ("rol denge yaması", owner feedback): measures every position role on the same footing
 * so each role can have its own identity (different moments, different stats) while staying fair.
 *
 *  - {@link simRole}: the background match sim with auto-resolved moments (what a skipped moment does).
 *  - {@link playRole}: real highlight scenarios of the role's own moment mix, played in the headless runtime
 *    by the human-like bot (what a played moment does).
 *  - Career outcomes come from balanceSim's {@link runCareer} with the role (see roleBalance.test.ts).
 *
 * Every hero sheet is the role's real starting template (createHero.previewAttrs) lifted to a common OVR, so
 * the comparison is "same overall, different shape".
 */
import { Rng, clamp } from '../../core/rng'
import { POSITION_ROLES, ROLE_HEIGHT, withHeight } from '../../core/roles'
import type { Attributes, Formation, Position, Role } from '../../core/types'
import { ATTRIBUTE_KEYS, isGoalkeepingAttr } from '../../core/types'
import { previewAttrs } from '../career/createHero'
import { ovrFor } from '../career/progression'
import { autoResolve } from '../match/autoResolve'
import { MatchSim } from '../match/engine'
import { kindWeights } from '../match/highlightGen'
import { highlightRatingDelta } from '../match/rating'
import { makeSetup } from '../match/testFixtures'
import type { HighlightKind, HighlightOutcome } from '../match/types'
import { DEFENSIVE_KINDS } from '../match/types'
import { generatedHighlight } from '../../game/demoHighlights'
import { isSuccess } from '../../game/feelHarness'
import { createHumanBot, humanBotStep, type BotLevel } from '../../game/humanBot'
import { HighlightRuntime } from '../../game/runtime'

/** Positions measured (mirrors LB/RB and LW/RW play the same roles). */
export const BALANCE_POSITIONS: readonly Position[] = ['GK', 'CB', 'LB', 'DM', 'CM', 'AM', 'LW', 'ST']

/** The role's starting sheet lifted (or lowered) evenly to `ovr` at its position, with the role's default height. */
export function roleSheet(pos: Position, role: Role, ovr: number): Attributes {
  const base = previewAttrs(pos, role, 'academy')
  const a = { ...base }
  const movable = ATTRIBUTE_KEYS.filter((k) => pos === 'GK' || !isGoalkeepingAttr(k))
  for (let i = 0; i < 6; i++) {
    const d = ovr - ovrFor(a, pos)
    if (d === 0) break
    for (const k of movable) a[k] = clamp(a[k] + d, 1, 99)
  }
  return withHeight(a, ROLE_HEIGHT[role])
}

const FORMATION_FOR: Readonly<Record<Position, Formation>> = {
  GK: '4-4-2', CB: '4-4-2', LB: '4-4-2', RB: '4-4-2', CM: '4-4-2', ST: '4-4-2', DM: '4-3-3', LW: '4-3-3', RW: '4-3-3', AM: '4-2-3-1',
}

export interface SimRoleStats {
  matches: number
  rating: number
  /** Goals + assists per match. */
  ga: number
  /** Tackles + saves per match (defensive actions). */
  def: number
  /** Share of the hero's moments that ended well for him (auto-resolved). */
  success: number
  /** Kind → count of the hero's moments (the role's signature). */
  kinds: Partial<Record<HighlightKind, number>>
}

const GOOD: ReadonlySet<HighlightOutcome> = new Set<HighlightOutcome>(['goal', 'assist', 'pass_complete', 'defended', 'foul_won'])

/** Background sim: `n` full matches at `ovr` (both teams around `ovr`), every hero moment auto-resolved. */
export function simRole(pos: Position, role: Role, n: number, ovr = 68, seed0 = 1): SimRoleStats {
  const sheet = roleSheet(pos, role, ovr)
  const out: SimRoleStats = { matches: 0, rating: 0, ga: 0, def: 0, success: 0, kinds: {} }
  let moments = 0
  const arng = new Rng(`role-sim:${pos}:${seed0}`)
  for (let i = 0; i < n; i++) {
    const seed = seed0 + i * 31
    const setup = makeSetup({ seed, heroSide: i % 2 ? 'away' : 'home', home: { heroPosition: pos, formation: FORMATION_FOR[pos], ovr, heroOvr: ovr }, away: { ovr, formation: '4-4-2' } })
    if (i % 2) [setup.home, setup.away] = [setup.away, setup.home]
    const hero = [...setup.home.lineup, ...setup.away.lineup].find((p) => p.isHero)
    if (!hero) continue
    hero.attrs = { ...sheet }
    hero.role = role
    hero.ovr = ovr
    const sim = new MatchSim(setup, 'en')
    let guard = 0
    while (!sim.finished && guard++ < 5000) {
      const h = sim.pendingHighlight
      if (h) {
        moments++
        out.kinds[h.kind] = (out.kinds[h.kind] ?? 0) + 1
        // What a skipped moment does (engine.skipHighlight), with the harness's own stream so the outcome is visible.
        const r = autoResolve(h.kind, sheet, 1, arng)
        if (GOOD.has(r.outcome)) out.success++
        sim.resolveHighlight(r)
      } else sim.step()
    }
    const st = sim.snapshot().heroStats
    out.matches++
    out.rating += st.rating
    out.ga += st.goals + st.assists
    out.def += st.tackles + st.saves
  }
  const m = Math.max(1, out.matches)
  return { ...out, rating: out.rating / m, ga: out.ga / m, def: out.def / m, success: out.success / Math.max(1, moments) }
}

export interface PlayRoleStats {
  moments: number
  /** Share of successes by the feel harness definition (goal / defended / kept the ball…). */
  success: number
  /** Mean rating change per moment (the played rating model). */
  rating: number
  /** Goals + assists per moment. */
  ga: number
  /** Defensive wins (defended) per moment. */
  def: number
}

/** Bot-played: `n` moments drawn from the role's own mix at `ovr`, played by the human-like bot (normal difficulty). */
export function playRole(pos: Position, role: Role, n: number, ovr = 68, level: BotLevel = 'average', seed0 = 1): PlayRoleStats {
  const sheet = roleSheet(pos, role, ovr)
  const w = kindWeights(pos, ovr, 0, role)
  const kinds = Object.keys(w) as HighlightKind[]
  const rng = new Rng(`role-play:${pos}:${seed0}`)
  const out: PlayRoleStats = { moments: 0, success: 0, rating: 0, ga: 0, def: 0 }
  for (let i = 0; i < n; i++) {
    const kind = rng.weighted(kinds, (k) => w[k] ?? 0)
    const seed = seed0 + i
    const hl = generatedHighlight(kind, seed, { ovr, heroPos: pos, heroAttrs: sheet, heroRole: role })
    const rt = new HighlightRuntime(hl, { aimAssist: 'full', slowMoAim: true, difficulty: 'normal', seed: seed * 7919 + 13 })
    const bot = createHumanBot(level, seed)
    for (let f = 0; f < 60 * 90 && !rt.finished; f++) {
      humanBotStep(rt, bot, 1 / 60)
      rt.update(1 / 60)
      rt.drainEvents()
    }
    const r = rt.result
    if (!r) continue
    out.moments++
    if (isSuccess(kind, r.outcome)) out.success++
    out.rating += highlightRatingDelta(kind, r)
    if (r.outcome === 'goal' || r.outcome === 'assist') out.ga++
    if (r.outcome === 'defended' && DEFENSIVE_KINDS.has(kind)) out.def++
  }
  const m = Math.max(1, out.moments)
  return { moments: out.moments, success: out.success / m, rating: out.rating / m, ga: out.ga / m, def: out.def / m }
}

/** Relative difference of `v` to the mean of `vs` (0.05 = 5 % above). */
export const relToMean = (v: number, vs: readonly number[]): number => {
  const mean = vs.reduce((a, b) => a + b, 0) / Math.max(1, vs.length)
  return mean ? v / mean - 1 : 0
}

/** Roles of every measured position. */
export const balanceRoles = (): [Position, Role][] => BALANCE_POSITIONS.flatMap((p) => POSITION_ROLES[p].map((r) => [p, r] as [Position, Role]))
