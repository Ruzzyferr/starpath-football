/**
 * Playtester build 8 (owner: "every fix follows the stats, perfect balance"). Pins the four complaints and their
 * stat curves (docs/BALANCE.md "Build 8"): clean short passes are received, nobody steals it in the first beat,
 * the scripted build-up never loses the ball, a chaser only catches a runner he is clearly quicker than, and
 * team-mates show for the ball. Every curve must move with the attributes that drive it, both ways (weak hero vs
 * strong opposition struggles, strong vs weak wins clearly). Deterministic seeds.
 */
import { describe, expect, it } from 'vitest'
import type { AttributeKey } from '../core/types'
import { Rng } from '../core/rng'
import { ovrFor } from '../sim/career/progression'
import { autoResolve } from '../sim/match/autoResolve'
import { MatchSim } from '../sim/match/engine'
import { makeSetup } from '../sim/match/testFixtures'
import { generatedHighlight } from './demoHighlights'
import {
  ON_BALL_KINDS, SETUP_KINDS, breakawayRate, intentRate, pressureRate, setupLossRate, shortPassReception, supportRate,
} from './intentHarness'
import { keyOpponent, momentMatchup } from './matchup'
import { RECEIVE, SUPPORT_KINDS, dribblePace, receiveReact, receiveWeight, startGrace } from './runtime'
import { CONTROL_EASY, firstTouchChance } from './chanceEvents'

const all = (keys: readonly AttributeKey[], v: number): Partial<Record<AttributeKey, number>> => Object.fromEntries(keys.map((k) => [k, v]))
/** Non-decreasing within `tol` (sampling noise between neighbouring levels). */
const rising = (xs: readonly number[], tol = 0.01) => xs.every((x, i) => i === 0 || x >= xs[i - 1]! - tol)
const falling = (xs: readonly number[], tol = 0.01) => xs.every((x, i) => i === 0 || x <= xs[i - 1]! + tol)
const L3 = [40, 65, 90] as const

describe('build 8: clean short pass to a free man is received', () => {
  // Build 9 physics pass: a clean short pass to a free man arrives soft (≤ CONTROL_EASY m/s) and is simply his — physics,
  // not a roll — so reception sits near 100 % at every level; the passer's quality shows in where the ball goes (the
  // intent pass curves), the receiver's First Touch on a hard ball (below).
  it('≥ 90 % at pass attributes 40, never falling with them (good input; the pass target ring is read)', () => {
    const r = [40, 50, 60, 70, 80, 90].map((lv) => shortPassReception(lv, 150).rate)
    expect(r[0]!).toBeGreaterThanOrEqual(0.9)
    expect(rising(r)).toBe(true)
  }, 300_000)

  it('follows the receiver on a hard ball: First Touch, +1 % a point (a soft one is simply his)', () => {
    const ft = (v: number, rel: number) => firstTouchChance({ attrs: { firstTouch: v } as never }, rel)
    expect(ft(40, CONTROL_EASY)).toBe(1)
    expect(ft(90, CONTROL_EASY)).toBe(1)
    expect(ft(60, 18) - ft(40, 18)).toBeCloseTo(0.2, 9)
    expect(ft(90, 22)).toBeGreaterThan(ft(65, 22))
    // A harder ball is harder to bring down (3 points per m/s).
    expect(ft(50, 20)).toBeLessThan(ft(50, 16))
    const r = [40, 65, 90].map((lv) => shortPassReception('start', 150, 'good', { mates: all(['firstTouch', 'anticipation'], lv) }).rate)
    expect(rising(r)).toBe(true)
  }, 300_000)

  it('sloppy input stays ≥ 20 points below good (wrong man, late, no look at the ring)', () => {
    const good = intentRate('shortPass', 40, 150).rate
    const sloppy = intentRate('shortPass', 40, 150, 'sloppy').rate
    expect(good).toBeGreaterThanOrEqual(0.9)
    expect(good - sloppy).toBeGreaterThanOrEqual(0.2)
  }, 300_000)

  it('receiving help follows the receiver and the pass quality', () => {
    expect(receiveReact(90)).toBeLessThan(receiveReact(40))
    expect(receiveWeight(0.9)).toBeGreaterThan(receiveWeight(0.4))
    expect(RECEIVE.cushionSkill).toBeGreaterThan(0)
  })
})

describe('build 8: no steal in the first beat', () => {
  it('nobody wins it inside the opening grace (Composure 40 → 1.02 s … 90 → 1.42 s), even standing still', () => {
    expect(startGrace(90)).toBeGreaterThan(startGrace(40))
    expect(pressureRate(ON_BALL_KINDS, 30, 'idle', 1.0).lostEarly).toBe(0)
  }, 300_000)

  // Build 9 pressing fix: bodies are solid, so a man who closed the carrier down inside the grace is still at his
  // shoulder when it ends (he used to be left behind by a carrier running through him) — 5 % → 12 % (measured 9 %).
  // Inside the grace it stays 0 (above).
  it('carrying it on: tackled within 1.5 s ≤ 12 % (hold-up excluded: running into the marker is the wrong input)', () => {
    expect(pressureRate(ON_BALL_KINDS.filter((k) => k !== 'hold_up'), 30, 'run', 1.5).lostEarly).toBeLessThanOrEqual(0.12)
  }, 300_000)

  it('losing the ball follows Dribbling/Strength/Balance/Agility vs Tackling/Aggression, both ways', () => {
    const kinds = ['build_up', 'dribble', 'counter', 'switch_play'] as const
    const lost = (h: number, d: number) => pressureRate(kinds, 25, 'run', 1.5, { hero: all(['dribbling', 'strength', 'balance', 'agility'], h), opps: all(['tackling', 'aggression'], d) }).lost
    const m = L3.map((h) => L3.map((d) => lost(h, d)))
    for (const row of m) expect(rising(row, 0.02)).toBe(true)
    for (let j = 0; j < 3; j++) expect(falling(m.map((r) => r[j]!), 0.02)).toBe(true)
    // A weak carrier against strong tacklers struggles; a strong one against weak tacklers clearly keeps it.
    expect(m[0]![2]! - m[2]![0]!).toBeGreaterThanOrEqual(0.3)
  }, 600_000)
})

describe('build 8: the scripted build-up never loses the ball', () => {
  it('setup-phase possession loss is 0 in every kind that opens with a team-mate on the ball', () => {
    expect(setupLossRate(SETUP_KINDS, 60).rate).toBe(0)
  }, 300_000)
})

describe('build 8: a chaser only catches a runner he is clearly quicker than', () => {
  const caught = (hero: number, chaser: number) => breakawayRate(80, { hero: { pace: hero, acceleration: hero }, opps: { pace: chaser, acceleration: chaser } })

  it('equal pace: caught ≤ 5 % (40, 65 and 90)', () => {
    for (const p of L3) expect(caught(p, p)).toBeLessThanOrEqual(0.05)
  }, 300_000)

  it('rises with the chaser’s pace, falls with the runner’s', () => {
    expect(rising([caught(50, 40), caught(50, 65), caught(50, 90)])).toBe(true)
    const vsFast = [50, 60, 70, 80].map((h) => caught(h, 90))
    expect(falling(vsFast)).toBe(true)
    // A much quicker chaser is still a real threat to a slow runner.
    expect(vsFast[0]!).toBeGreaterThanOrEqual(0.1)
  }, 600_000)

  it('running with the ball costs a little pace (Dribbling), not a lot', () => {
    expect(dribblePace(40)).toBeGreaterThanOrEqual(0.96)
    expect(dribblePace(90)).toBeGreaterThan(dribblePace(40))
  })
})

describe('build 8: there is always a pass on', () => {
  it('every build-up moment offers at least one viable option while he carries it', () => {
    const kinds = ON_BALL_KINDS.filter((k) => SUPPORT_KINDS.has(k))
    expect(kinds.length).toBeGreaterThanOrEqual(6)
    expect(supportRate(kinds, 30).moments).toBeGreaterThanOrEqual(0.95)
  }, 300_000)
})

describe('build 8: the opponent plays to his own stats', () => {
  it('a better keeper saves more 1v1 finishes (Reflexes / Diving / GK Positioning / Handling)', () => {
    const r = L3.map((v) => intentRate('shot', 'start', 150, 'good', 'normal', 'half', { keeper: all(['reflexes', 'diving', 'gkPositioning', 'handling'], v) }).rate)
    expect(falling(r)).toBe(true)
    expect(r[0]! - r[2]!).toBeGreaterThanOrEqual(0.15)
  }, 300_000)

  it('a better dribbler is harder to tackle (Dribbling / Agility / Balance / Strength)', () => {
    const r = L3.map((v) => intentRate('tackle', 'start', 150, 'good', 'normal', 'half', { opps: all(['dribbling', 'agility', 'balance', 'strength'], v) }).rate)
    expect(falling(r)).toBe(true)
    expect(r[0]! - r[2]!).toBeGreaterThanOrEqual(0.15)
  }, 300_000)

  it('the matchup card shows the real key opponent from the opposing lineup', () => {
    for (const kind of ['one_on_one', 'build_up', 'defend', 'gk_save', 'header'] as const) {
      const hl = generatedHighlight(kind, 3, { ovr: 62, heroOvr: 57 })
      const opp = keyOpponent(hl)!
      expect(opp.side).not.toBe(hl.side)
      const m = momentMatchup(hl)!
      expect(m.rows.length).toBeGreaterThanOrEqual(3)
      expect(m.opp.id).toBe(opp.id)
      if (kind === 'one_on_one') expect(opp.role).toBe('GK')
      // The values are the players' own (no team average, no flat constant).
      for (const r of m.rows) expect(r.oppV).toBe(opp.attrs[r.opp] ?? 50)
    }
  })

  it('a stronger key opponent shifts the matchup edge his way', () => {
    const hl = generatedHighlight('one_on_one', 5, { ovr: 62, heroOvr: 57 })
    const gk = keyOpponent(hl)!
    const at = (d: number) => {
      gk.attrs = { ...gk.attrs, reflexes: 50 + d, diving: 50 + d, gkPositioning: 50 + d, handling: 50 + d }
      return momentMatchup(hl)!.diff
    }
    expect(at(-15)).toBeGreaterThan(at(0))
    expect(at(0)).toBeGreaterThan(at(15))
  })

  it('real matches: the key opponent is a real player of the opposing lineup, not boosted above his team', () => {
    const rel: number[] = []
    const arng = new Rng('fair')
    for (let i = 0; i < 36; i++) {
      const teamOvr = [55, 62, 70, 78][i % 4]!
      const setup = makeSetup({ seed: 1 + i * 37, heroSide: 'home', home: { ovr: teamOvr, heroOvr: teamOvr, heroPosition: (['ST', 'LW', 'CM', 'CB', 'RB', 'GK'] as const)[i % 6] }, away: { ovr: teamOvr } })
      const sim = new MatchSim(setup, 'en')
      for (let g = 0; g < 5000 && !sim.finished; g++) {
        const h = sim.pendingHighlight
        if (!h) {
          sim.step()
          continue
        }
        const m = momentMatchup(h)!
        const lineup = setup.away.lineup
        const p = lineup.concat(setup.away.bench).find((q) => q.id === m.opp.id)
        expect(p, `${h.kind}: key opponent ${m.opp.id} is in the opposing squad`).toBeTruthy()
        rel.push(ovrFor(p!.attrs, p!.position) - lineup.reduce((s, q) => s + ovrFor(q.attrs, q.position), 0) / lineup.length)
        sim.resolveHighlight(autoResolve(h.kind, setup.home.lineup.find((q) => q.isHero)!.attrs, 1, arng))
      }
    }
    expect(rel.length).toBeGreaterThan(100)
    expect(Math.abs(rel.reduce((a, b) => a + b, 0) / rel.length)).toBeLessThan(2)
  }, 300_000)
})
