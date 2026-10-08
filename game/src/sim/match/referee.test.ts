import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import { MatchSim } from './engine'
import { makeSetup } from './testFixtures'
import {
  banMatches,
  bookHabit,
  copyBook,
  emptyBook,
  fadeBook,
  goalZoneOf,
  noteShot,
  refCardMult,
  refFoulMult,
  refHighlightFoulMult,
  yellowAccumulationBan,
  type Referee,
} from './referee'
import type { EngineState } from './engineState'
import type { HighlightResult } from './types'
import { addNpcBan, refereeFor, refereePool, serveClubBans } from '../world/referees'
import { selectLineupFromPlayers } from '../world/formations'
import { generateWorld } from '../world/generate'

const ref = (strictness: Referee['strictness']): Referee => ({ name: 'Ref', strictness, advantage: 0.5 })

function cards(strictness: Referee['strictness'] | null, n = 150): { yellow: number; red: number; fk: number } {
  const out = { yellow: 0, red: 0, fk: 0 }
  for (let i = 0; i < n; i++) {
    const setup = makeSetup({ seed: 31_000 + i })
    if (strictness) setup.referee = ref(strictness)
    const snap = new MatchSim(setup, 'en').simulateToEnd()
    for (const e of snap.events) {
      if (e.type === 'yellow') out.yellow++
      if (e.type === 'red') out.red++
      if (e.type === 'freekick') out.fk++
    }
  }
  return out
}

describe('referee multipliers (WP-14)', () => {
  it('strictness 3 is exactly neutral; stricter means more fouls, cards and highlight fouls', () => {
    expect(refFoulMult(3)).toBe(1)
    expect(refCardMult(3)).toBe(1)
    expect(refHighlightFoulMult(3)).toBe(1)
    expect(refFoulMult(undefined)).toBe(1)
    for (let s = 1; s < 5; s++) {
      expect(refFoulMult(s + 1)).toBeGreaterThan(refFoulMult(s))
      expect(refCardMult(s + 1)).toBeGreaterThan(refCardMult(s))
      expect(refHighlightFoulMult(s + 1)).toBeGreaterThan(refHighlightFoulMult(s))
    }
  })

  it('a strictness-3 referee plays the match exactly like no referee', () => {
    for (let i = 0; i < 20; i++) {
      const a = makeSetup({ seed: 32_000 + i })
      const b = makeSetup({ seed: 32_000 + i })
      b.referee = ref(3)
      const sa = new MatchSim(a, 'en').simulateToEnd()
      const sb = new MatchSim(b, 'en').simulateToEnd()
      expect(sb.score).toEqual(sa.score)
      expect(sb.events.length).toBe(sa.events.length)
    }
  })

  it('foul probability and card rate rise with strictness in the minute sim', () => {
    const lenient = cards(1)
    const strict = cards(5)
    expect(strict.yellow).toBeGreaterThan(lenient.yellow * 1.8)
    expect(strict.fk).toBeGreaterThan(lenient.fk)
  })
})

describe('suspensions (WP-14)', () => {
  it('red card bans are 1..3 matches by reason', () => {
    expect(banMatches('secondYellow')).toBe(1)
    expect(banMatches('dogso')).toBe(1)
    expect(banMatches('serious')).toBe(2)
    expect(banMatches('serious', 5)).toBe(3)
    expect(banMatches('violent')).toBe(3)
    expect(yellowAccumulationBan(5)).toBe(true)
    expect(yellowAccumulationBan(4)).toBe(false)
    expect(yellowAccumulationBan(10)).toBe(true)
  })

  it('a hero straight red from a moment carries its ban into the hero stats', () => {
    let found = false
    for (let i = 0; i < 40 && !found; i++) {
      const sim = new MatchSim(makeSetup({ seed: 33_000 + i, heroSide: 'home', home: { heroPosition: 'CB' } }), 'en')
      for (let g = 0; g < 200 && !sim.finished; g++) {
        if (!sim.pendingHighlight) {
          sim.step()
          continue
        }
        const r: HighlightResult = { outcome: 'foul_committed', passes: 0, passesCompleted: 0, shots: 0, shotsOnTarget: 0, dribbles: 0, tackles: 0, card: 'red', redReason: 'violent' }
        sim.resolveHighlight(r)
        found = true
        break
      }
      if (found) {
        const snap = sim.snapshot()
        expect(snap.heroStats.red).toBe(1)
        expect(snap.heroStats.ban).toBe(3)
        const st = JSON.parse(sim.serialize()) as EngineState
        expect(st.players[st.hero.id as string]!.ban).toBe(3)
      }
    }
    expect(found).toBe(true)
  })

  it('background reds ban NPCs 1..3 matches', () => {
    let reds = 0
    for (let i = 0; i < 300 && reds < 5; i++) {
      const setup = makeSetup({ seed: 34_000 + i })
      setup.referee = ref(5)
      const sim = new MatchSim(setup, 'en')
      sim.simulateToEnd()
      const st = JSON.parse(sim.serialize()) as EngineState
      for (const p of Object.values(st.players)) {
        if (!p.red) continue
        reds++
        expect(p.ban).toBeGreaterThanOrEqual(1)
        expect(p.ban).toBeLessThanOrEqual(3)
      }
    }
    expect(reds).toBeGreaterThan(0)
  })

  it('NPC bans are booked, keep the player out of the lineup and are served match by match', () => {
    const world = generateWorld(new Rng(77), { season: 2025, heroCountryId: 'TR', countryIds: ['TR'] })
    const club = Object.values(world.clubs)[0]!
    const best = club.squad.map((id) => world.players[id]).sort((a, b) => b!.ovr - a!.ovr)[0]!
    const before = selectLineupFromPlayers(club.squad.map((id) => world.players[id]!), club.formation)
    expect(before.playerIds).toContain(best.id)
    addNpcBan(best!, { red: true, ban: 2 }, 'k')
    expect(best.suspendedMatches).toBe(2)
    const during = selectLineupFromPlayers(club.squad.map((id) => world.players[id]!), club.formation)
    expect(during.playerIds).not.toContain(best.id)
    serveClubBans(world, club.id)
    expect(best.suspendedMatches).toBe(1)
    serveClubBans(world, club.id)
    expect(best.suspendedMatches).toBeUndefined()
    // Fifth yellow of the season: one match.
    best.stats.yellow = 5
    addNpcBan(best!, { yellowAdded: true }, 'y')
    expect(best.suspendedMatches).toBe(1)
  })
})

describe('referee pool', () => {
  it('is deterministic per seed and country, with strictness 1..5', () => {
    const a = refereePool(5, 'TR')
    expect(refereePool(5, 'TR')).toEqual(a)
    expect(refereePool(6, 'TR')).not.toEqual(a)
    for (const r of a) {
      expect(r.strictness).toBeGreaterThanOrEqual(1)
      expect(r.strictness).toBeLessThanOrEqual(5)
      expect(r.advantage).toBeGreaterThan(0)
      expect(r.advantage).toBeLessThan(1)
      expect(r.name.length).toBeGreaterThan(3)
    }
    expect(refereeFor(5, 'TR', 'fx1')).toEqual(refereeFor(5, 'TR', 'fx1'))
    expect(new Set(a.map((r) => r.strictness)).size).toBeGreaterThan(1)
  })

  it('highlights carry the referee brief and the keepers book', () => {
    const setup = makeSetup({ seed: 35_000, heroSide: 'home', home: { heroPosition: 'ST' } })
    setup.referee = ref(4)
    setup.keeperBook = { pen: [3, 0, 0], shot: [0, 0, 0] }
    const sim = new MatchSim(setup, 'en')
    for (let g = 0; g < 120 && !sim.pendingHighlight; g++) sim.step()
    const h = sim.pendingHighlight
    expect(h).not.toBeNull()
    expect(h?.referee).toEqual({ strictness: 4, advantage: 0.5 })
    expect(h?.keeperBook?.pen).toEqual([3, 0, 0])
  })
})

describe("keepers' book", () => {
  it('learns a habit after a couple of attempts and fades it', () => {
    const b = emptyBook()
    expect(bookHabit(b, true)).toBeNull()
    noteShot(b, goalZoneOf(31), true)
    expect(bookHabit(b, true)).toBeNull()
    noteShot(b, goalZoneOf(30.5), true)
    expect(bookHabit(b, true)).toEqual({ zone: 0, share: 1, n: 2 })
    noteShot(b, goalZoneOf(37), true)
    noteShot(b, goalZoneOf(34), true)
    expect(bookHabit(b, true)).toBeNull() // mixing it up hides the habit
    const f = fadeBook(copyBook(b), 0.5)
    expect(f.pen[0]).toBe(1)
  })

  it('the engine adds the hero attempts of a moment to the book', () => {
    const sim = new MatchSim(makeSetup({ seed: 36_000, heroSide: 'home', home: { heroPosition: 'ST' } }), 'en')
    for (let g = 0; g < 120 && !sim.pendingHighlight; g++) sim.step()
    sim.resolveHighlight({ outcome: 'saved', passes: 0, passesCompleted: 0, shots: 1, shotsOnTarget: 1, dribbles: 0, tackles: 0, shotLog: [{ x: 94, y: 34, zone: 2, pen: true }] })
    const st = JSON.parse(sim.serialize()) as EngineState
    expect(st.hero.book?.pen).toEqual([0, 0, 1])
  })
})
