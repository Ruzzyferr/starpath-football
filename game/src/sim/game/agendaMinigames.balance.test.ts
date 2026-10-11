/**
 * Agenda / bench mini-game balance study (docs/BALANCE.md "Agenda minigames").
 *
 * Every conversation scene is played by two simulated players at social stats
 * (Composure = Leadership) 40..90:
 *  - GOOD reads the speaker (the style hint / the personalities) and picks the
 *    best-fitting answer, with a 10% slip per step;
 *  - SLOPPY taps answers at random.
 * Success = a good conversation (rapport ≥ RAPPORT_GOOD: the "took note of
 * you" / "took you seriously" / "really clicked" outcomes). Targets: a
 * starting hero (~40) with good input lands 60–75%, the rate never falls as
 * the stats rise, good beats sloppy by 20+ points everywhere, and nothing is
 * a sure thing for a sloppy player.
 */
import { describe, expect, it } from 'vitest'
import type { GameState } from '../../core/types'
import { Rng } from '../../core/rng'
import { absWeek } from '../career/common'
import { ensureRelation } from '../life/relationships'
import { advanceDay, isHeroMatchday } from './calendar'
import { autoPlayHeroMatch } from './match'
import { NT_COACH_REL } from './national'
import {
  RAPPORT_GOOD, applyManagerTalk, applyNationalCamp, applyTeamDinner, managerTalkRapport, managerTalkScene,
  nationalCampRapport, nationalCampScene, teamDinnerRapport, teamDinnerScene, type Rapport, type Scene,
} from './scenes'
import { makeGame } from './testHelpers'

export const LEVELS = [40, 50, 60, 70, 80, 90] as const
const TRIALS = 400

function inSeason(seed: number): GameState {
  const s = makeGame(seed)
  for (let i = 0; i < 40; i++) {
    s.pendingEvents.length = 0
    if (isHeroMatchday(s)) autoPlayHeroMatch(s)
    advanceDay(s)
  }
  for (let i = 0; i < 7 && isHeroMatchday(s); i++) {
    autoPlayHeroMatch(s)
    advanceDay(s)
  }
  s.pendingEvents.length = 0
  s.calendar.slot = 0
  s.life.energy = 100
  ensureRelation(s.life, NT_COACH_REL, 'manager', 'Coach', 10, absWeek(s.calendar))
  return s
}

type SceneKind = 'nationalCamp' | 'managerTalk' | 'teamDinner'
const SCENE: Record<SceneKind, (s: GameState) => Scene | null> = { nationalCamp: nationalCampScene, managerTalk: managerTalkScene, teamDinner: teamDinnerScene }
const RAPPORT: Record<SceneKind, (s: GameState, p: readonly string[]) => Rapport | null> = { nationalCamp: nationalCampRapport, managerTalk: managerTalkRapport, teamDinner: teamDinnerRapport }

function combos(sc: Scene): string[][] {
  let out: string[][] = [[]]
  for (const st of sc.steps) out = out.flatMap((c) => st.options.map((o) => [...c, o.id]))
  return out
}

/** Success rate (%) per level for one scene and one player type. */
export function dialogueCurve(base: GameState, kind: SceneKind, player: 'good' | 'sloppy'): number[] {
  const s = base
  const seed0 = s.meta.seed
  const a0 = { c: s.hero.attrs.composure, l: s.hero.attrs.leadership, f: s.hero.form }
  const hits = LEVELS.map(() => 0)
  const rng = new Rng(`dialogue:${kind}:${player}`)
  for (let i = 0; i < TRIALS; i++) {
    s.meta.seed = 50_000 + i * 7919
    // The hero's form varies from week to week (it gates "demand a start").
    s.hero.form = rng.int(35, 75)
    const sc = SCENE[kind](s)
    if (!sc) continue
    let picks: string[]
    if (player === 'good') {
      // Reads the hint: the answers that fit best (the fit does not depend on the stats).
      let best: string[] = []
      let bestFit = -1
      for (const c of combos(sc)) {
        const f = RAPPORT[kind](s, c)!.fit
        if (f > bestFit) { bestFit = f; best = c }
      }
      picks = best.map((id, k) => (rng.chance(0.1) ? sc.steps[k]!.options[rng.int(0, sc.steps[k]!.options.length - 1)]!.id : id))
    } else {
      picks = sc.steps.map((st) => st.options[rng.int(0, st.options.length - 1)]!.id)
    }
    LEVELS.forEach((lv, j) => {
      s.hero.attrs.composure = lv
      s.hero.attrs.leadership = lv
      if (RAPPORT[kind](s, picks)!.score >= RAPPORT_GOOD) hits[j]!++
    })
  }
  s.meta.seed = seed0
  s.hero.attrs.composure = a0.c
  s.hero.attrs.leadership = a0.l
  s.hero.form = a0.f
  return hits.map((h) => Math.round((h / TRIALS) * 100))
}

const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s)) as GameState
const row = (name: string, xs: readonly number[]): string => `| ${name} | ${xs.map((x) => `${x}%`).join(' | ')} |`

describe('agenda mini-games: dialogue scenes follow the stats and the read of the speaker', () => {
  const base = inSeason(72)
  for (const kind of ['nationalCamp', 'managerTalk', 'teamDinner'] as const) {
    it(`${kind}: achievable, monotonic, good ≫ sloppy`, () => {
      const good = dialogueCurve(base, kind, 'good')
      const sloppy = dialogueCurve(base, kind, 'sloppy')
      console.log(`\n${kind}\n| player | ${LEVELS.join(' | ')} |\n${row('good', good)}\n${row('sloppy', sloppy)}`)
      expect(good[0]).toBeGreaterThanOrEqual(58)
      expect(good[0]).toBeLessThanOrEqual(78)
      for (let i = 1; i < LEVELS.length; i++) {
        expect(good[i]).toBeGreaterThanOrEqual(good[i - 1]!)
        expect(sloppy[i]).toBeGreaterThanOrEqual(sloppy[i - 1]!)
      }
      LEVELS.forEach((_lv, i) => expect(good[i]! - sloppy[i]!).toBeGreaterThanOrEqual(20))
      expect(Math.max(...sloppy)).toBeLessThan(60)
    })
  }

  it('the effects reach the sim and scale with the rapport', () => {
    const s0 = clone(base)
    const sc = nationalCampScene(s0)
    const style = sc.cast[0]!.style
    const best = style === 'demanding' ? ['ready', 'starter', 'yes'] : style === 'fatherly' ? ['honest', 'team', 'learn'] : ['honest', 'earn', 'learn']
    const run = (lv: number, picks: string[]) => {
      const s = clone(base)
      s.hero.attrs.composure = lv
      s.hero.attrs.leadership = lv
      const before = s.life.relationships[NT_COACH_REL]!.value
      const r = applyNationalCamp(s, picks)
      return { rel: s.life.relationships[NT_COACH_REL]!.value - before, score: r.rapport!.score }
    }
    const hi = run(90, best)
    const lo = run(40, best)
    const bad = run(40, ['ready', 'starter', 'own'].map((x, i) => (i === 2 ? 'own' : x)))
    expect(hi.score).toBeGreaterThan(lo.score)
    expect(hi.rel).toBeGreaterThan(lo.rel)
    expect(lo.rel).toBeGreaterThan(bad.rel)
    // Manager trust and the dinner bond move with the stats too.
    const talk = (lv: number) => {
      const s = clone(base)
      s.hero.attrs.composure = lv
      s.hero.attrs.leadership = lv
      const t0 = s.hero.managerTrust
      applyManagerTalk(s, ['ask', 'detail'])
      return s.hero.managerTrust - t0
    }
    expect(talk(90)).toBeGreaterThan(talk(40))
    const dinner = (lv: number) => {
      const s = clone(base)
      s.hero.attrs.composure = lv
      s.hero.attrs.leadership = lv
      return applyTeamDinner(s, ['sitA', 'football', 'split']).effects.find((e) => e.key === 'mate')!.value
    }
    expect(dinner(90)).toBeGreaterThan(dinner(40))
  })
})
