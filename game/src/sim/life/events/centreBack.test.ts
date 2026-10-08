/**
 * Centre-back story pack (Tur 3b): reachable for a CB, absent for other roles,
 * every chain step reachable, placeholders resolve in both languages, and the
 * pass-network link feeds the chain.
 */
import { describe, expect, it } from 'vitest'
import { Rng } from '../../../core/rng'
import type { GameState } from '../../../core/types'
import { centreBackEvents } from './content/centreBack'
import { ALL_EVENTS } from './content'
import { buildVars, formatBoth, getEventDef, isEligible } from './engine'
import { makeTestState } from './testFixture'
import { LAST_MATCH_FLAG, type MatchFeats } from '../../game/records'
import { LINKS_FLAG, recordPassLinks, topPassLink } from '../../game/passLinks'

const TAGS = ['weekly', 'season_end', 'new_season', 'post_match', 'scored', 'match_loss']

const feats = (over: Partial<MatchFeats>): string => JSON.stringify({
  fixtureId: 'f', season: 2026, week: 5, compType: 'league', final: false, opponent: 'X', opponentReputation: 60, minutes: 90, started: true,
  goals: 0, assists: 0, freeKickGoals: 0, penaltyGoals: 0, headerGoals: 0, rating: 7, motm: false, won: false, drew: false, goalsFor: 0, goalsAgainst: 1,
  cleanSheet: false, saves: 0, isKeeper: false, red: false, injured: false, ...over,
})

function cb(seed: number, tweak?: (s: GameState) => void): GameState {
  const s = makeTestState({ seed, partner: true, money: 3_000_000, reputation: 70 })
  s.hero.position = 'CB'
  s.hero.birthYear = s.calendar.season - 27
  s.hero.contract!.role = 'captain'
  s.calendar.week = 20
  s.hero.attrs.heading = 70; s.hero.attrs.setPieces = 70; s.hero.attrs.passing = 60; s.hero.attrs.leadership = 70; s.hero.attrs.tackling = 60
  s.hero.seasonStats.cleanSheets = 9
  s.hero.seasonStats.apps = 20
  s.hero.awards = [{ season: s.calendar.season - 1, key: 'defender_of_season', name: { tr: 'x', en: 'x' } }]
  tweak?.(s)
  return s
}

const firstTeammate = (s: GameState) => Object.values(s.life.relationships).find((r) => r.kind === 'teammate' && r.npcId)!

describe('centre-back story pack', () => {
  it('has 15+ spontaneous cards plus the chain steps, all with unique, registered ids', () => {
    expect(centreBackEvents.filter((e) => !e.followUpOnly).length).toBeGreaterThanOrEqual(15)
    expect(centreBackEvents.length).toBeGreaterThanOrEqual(20)
    const ids = new Set(ALL_EVENTS.map((e) => e.id))
    for (const e of centreBackEvents) { expect(ids.has(e.id), e.id).toBe(true); expect(e.choices.length).toBeGreaterThanOrEqual(2) }
  })

  it('every spontaneous card is reachable for a centre-back and none for a striker', () => {
    const tm = (s: GameState) => {
      const r = firstTeammate(s)
      recordPassLinks(s, { [r.npcId!]: { from: 30, to: 25 } })
    }
    const variants = [
      cb(1, tm),
      cb(2, (s) => { tm(s); s.life.flags[LAST_MATCH_FLAG] = feats({ headerGoals: 1, goals: 1 }) }),
      cb(3, (s) => { s.life.flags[LAST_MATCH_FLAG] = feats({ red: true }) }),
      cb(4, (s) => { s.life.flags[LAST_MATCH_FLAG] = feats({ goalsAgainst: 1, rating: 5.5 }) }),
      cb(5, (s) => { s.life.flags[LAST_MATCH_FLAG] = feats({ goalsAgainst: 3, goalsFor: 2, rating: 5.2 }) }),
    ]
    const missing = centreBackEvents.filter((e) => !e.followUpOnly).filter((e) => !variants.some((s) => TAGS.some((t) => isEligible(s, e, [t]))))
    expect(missing.map((e) => e.id)).toEqual([])
    const striker = cb(6, (s) => { s.hero.position = 'ST'; tm(s); s.life.flags[LAST_MATCH_FLAG] = feats({ headerGoals: 1, red: true }) })
    for (const e of centreBackEvents) expect(TAGS.some((t) => isEligible(striker, e, [t])), e.id).toBe(false)
  })

  it('chain steps are reachable from a parent choice and all text resolves in TR and EN', () => {
    const reached = new Set<string>()
    const s0 = cb(7, (s) => { const r = firstTeammate(s); recordPassLinks(s, { [r.npcId!]: { from: 30, to: 25 } }) })
    for (const def of centreBackEvents) {
      def.choices.forEach((c, i) => {
        const s = structuredClone(s0)
        const rng = new Rng(11 + i)
        const vars = buildVars(s, rng, def, [])
        const res = c.effects({ state: s, vars, absWeek: 0, tags: [] }, rng)
        for (const f of res.followUps ?? []) reached.add(f.eventId)
        for (const lt of [def.title, def.text, c.label, res.text]) {
          const b = formatBoth(lt, vars)
          expect(b.tr, def.id).not.toMatch(/\{\w+(:\w+)?\}/)
          expect(b.en, def.id).not.toMatch(/\{\w+(:\w+)?\}/)
        }
      })
    }
    const orphans = centreBackEvents.filter((e) => e.followUpOnly && !reached.has(e.id)).map((e) => e.id)
    expect(orphans).toEqual([])
    expect(getEventDef('teammates.cb_link_routine')?.followUpOnly).toBe(true)
  })
})

describe('pass-network links', () => {
  it('tallies passes per season, ignores strangers and surfaces the busiest partner', () => {
    const s = cb(8)
    const [a, b] = Object.values(s.life.relationships).filter((r) => r.kind === 'teammate' && r.npcId)
    expect(topPassLink(s)).toBeNull()
    recordPassLinks(s, { [a!.npcId!]: { from: 10, to: 8 }, [b!.npcId!]: { from: 30, to: 20 }, nobody: { from: 99, to: 99 } })
    expect(topPassLink(s)).toMatchObject({ npcId: b!.npcId, passes: 50, relId: b!.id })
    recordPassLinks(s, { [a!.npcId!]: { from: 40, to: 10 } })
    expect(topPassLink(s)!.npcId).toBe(a!.npcId) // 18 + 50 = 68 > 50
    s.calendar.season += 1
    expect(topPassLink(s)).toBeNull() // new season: tally resets
    recordPassLinks(s, { [a!.npcId!]: { from: 5, to: 5 } })
    expect(JSON.parse(String(s.life.flags[LINKS_FLAG])).tally).toEqual({ [a!.npcId!]: 10 })
  })
})
