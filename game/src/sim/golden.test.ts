/**
 * Golden-master determinism (WP-17).
 *
 * A fixed seed must always produce the same digests: 1000 AI matches and a full
 * auto-played career season. If you CHANGE simulation behaviour on purpose,
 * regenerate the expectations and commit `golden.json` together with the change:
 *
 *   UPDATE_GOLDEN=1 npx vitest run src/sim/golden.test.ts
 *
 * An unintended diff here means determinism or balance drifted; investigate first.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { hashString, Rng } from '../core/rng'
import { MatchSim } from './match/engine'
import { makeSetup } from './match/testFixtures'
import { runCareer } from './game/balanceSim'
import { makeGame } from './game/testHelpers'
import { advanceToNextMatch, isHeroMatchday } from './game/calendar'
import { firstEnabledChoice, resolveEventChoice } from './game/actions'
import { startHeroMatch, matchSeed } from './game/match'

const GOLDEN_PATH = new URL('./golden.json', import.meta.url)
const UPDATE = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env?.UPDATE_GOLDEN === '1'
const hex = (s: string): string => hashString(s).toString(16).padStart(8, '0')

function matchesDigest(): string {
  let acc = ''
  for (let i = 0; i < 1000; i++) {
    const s = new MatchSim(makeSetup({ seed: 90_000 + i }), 'en').simulateToEnd()
    acc += `${s.score[0]}-${s.score[1]}:${s.shots[0]}/${s.shots[1]};`
  }
  return hex(acc) + hex(acc.split('').reverse().join(''))
}

function seasonDigest(): string {
  const t = runCareer({ seed: 424242, nationality: 'TR', archetype: 'poacher', background: 'academy', gender: 'male', persona: 'pro', seasons: 1 })
  const slim = t.samples.map((s) => ({ ovr: s.ovr, apps: s.apps, goals: s.goals, money: s.money, rep: s.reputation, trophies: s.trophies, events: s.events }))
  const json = JSON.stringify({ slim, clubs: t.clubs })
  return hex(json) + hex(json.split('').reverse().join(''))
}

describe('golden master', () => {
  const current = { matches1000: matchesDigest(), careerSeason: seasonDigest() }

  it('digests are stable across two runs in-process', () => {
    expect(matchesDigest()).toBe(current.matches1000)
    expect(seasonDigest()).toBe(current.careerSeason)
  })

  it('matches the committed golden.json', () => {
    if (UPDATE) {
      writeFileSync(GOLDEN_PATH, JSON.stringify(current, null, 2) + '\n')
      return
    }
    const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as typeof current
    expect(current).toEqual(golden)
  })
})

describe('per-match RNG independence (fork "match:<id>")', () => {
  it('matchSeed depends only on career seed and fixture id', () => {
    expect(matchSeed(7, 'f1')).toBe(matchSeed(7, 'f1'))
    expect(matchSeed(7, 'f1')).not.toBe(matchSeed(7, 'f2'))
    expect(matchSeed(7, 'f1')).not.toBe(matchSeed(8, 'f1'))
  })

  it('a hero match is unchanged by unrelated RNG consumption beforehand', () => {
    const a = makeGame(9)
    const b = makeGame(9)
    for (const g of [a, b]) {
      for (let guard = 0; !isHeroMatchday(g) && guard < 100; guard++) {
        while (g.pendingEvents.length) resolveEventChoice(g, 0, firstEnabledChoice(g, 0))
        advanceToNextMatch(g)
      }
    }
    // Burn the career stream on one copy only (selection roll aside, nothing else may matter).
    const burn = new Rng(b.rng)
    for (let i = 0; i < 977; i++) burn.next()
    b.rng = burn.state
    const simA = startHeroMatch(a, 'en')
    const simB = startHeroMatch(b, 'en')
    expect(simA && simB).toBeTruthy()
    if (!simA || !simB) return
    const sa = simA.serialize()
    const sb = simB.serialize()
    expect(JSON.parse(sa).setup.seed).toBe(JSON.parse(sb).setup.seed)
    expect(JSON.parse(sa).setup.weather).toBe(JSON.parse(sb).setup.weather)
  })
})
