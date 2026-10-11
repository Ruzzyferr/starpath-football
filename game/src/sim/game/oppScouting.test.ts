import { describe, expect, it } from 'vitest'
import type { GameState } from '../../core/types'
import { advanceDay, isHeroMatchday } from './calendar'
import { autoPlayHeroMatch, prepareHeroMatch } from './match'
import { SCOUT_BONUS, applyScouting, scoutAttrs, scoutBuff, scoutReading, scoutingReport } from './oppScouting'
import { nextClubFixture } from './selection'
import { makeGame } from './testHelpers'

function run(s: GameState, days: number, until?: (s: GameState) => boolean): void {
  for (let i = 0; i < days; i++) {
    s.pendingEvents.length = 0
    if (until?.(s)) return
    if (isHeroMatchday(s)) autoPlayHeroMatch(s)
    advanceDay(s)
  }
  s.pendingEvents.length = 0
}

describe('opponent video scouting (sim)', () => {
  it('reads the next opponent into at least four real tendencies, deterministically', () => {
    const s = makeGame(611)
    run(s, 40, (x) => x.calendar.week >= 3 && !!scoutingReport(x))
    const r = scoutingReport(s)!
    expect(r).not.toBeNull()
    expect(r.fixtureId).toBe(nextClubFixture(s)!.fixture.id)
    expect(r.tendencies.length).toBeGreaterThanOrEqual(4)
    expect(new Set(r.tendencies.map((t) => t.id)).size).toBe(r.tendencies.length)
    for (let i = 1; i < r.tendencies.length; i++) expect(r.tendencies[i - 1]!.strength).toBeGreaterThanOrEqual(r.tendencies[i]!.strength)
    expect(JSON.stringify(scoutingReport(s))).toBe(JSON.stringify(r))
    expect(r.tendencies.some((t) => !!t.player)).toBe(true)
  })

  it('a good session buffs anticipation/positioning for that match only and gives XP', () => {
    const s = makeGame(612)
    run(s, 40, (x) => x.calendar.week >= 3 && !!scoutingReport(x))
    const fx = nextClubFixture(s)!
    const xpBefore = JSON.stringify(s.hero.attrXp ?? {})
    const res = applyScouting(s, 0.85, ['fbLeft'])!
    expect(res.buff.grade).toBe('A')
    expect(res.buff.bonus).toBe(SCOUT_BONUS.A)
    expect(scoutBuff(s, fx.fixture.id)?.bonus).toBe(3)
    expect(scoutBuff(s, 'other-fixture')).toBeNull()
    expect(JSON.stringify(s.hero.attrXp ?? {})).not.toBe(xpBefore)
    // A worse second try never lowers the buff.
    applyScouting(s, 0.2, [])
    expect(scoutBuff(s, fx.fixture.id)?.bonus).toBe(3)
    // The buff reaches the hero's match attributes.
    run(s, 14, (x) => isHeroMatchday(x))
    if (!isHeroMatchday(s) || nextClubFixture(s)?.fixture.id !== fx.fixture.id) return
    const keys = scoutAttrs(s.hero.position)
    const before = Object.fromEntries(keys.map((k) => [k, s.hero.attrs[k]]))
    const prep = prepareHeroMatch(s)!
    const team = prep.isHome ? prep.setup.home : prep.setup.away
    const hp = [...team.lineup, ...team.bench].find((p) => p.isHero)
    if (!hp) return
    for (const k of keys) expect(hp.attrs[k]).toBeGreaterThanOrEqual(Math.min(99, (before[k] ?? 0) + 3))
  })

  it('the same answers count for more with a sharper reading of the game (Anticipation, Vision, Positioning)', () => {
    const base = makeGame(614)
    run(base, 40, (x) => x.calendar.week >= 3 && !!scoutingReport(x))
    const at = (lv: number) => {
      const s = JSON.parse(JSON.stringify(base)) as GameState
      s.hero.attrs.anticipation = lv
      s.hero.attrs.vision = lv
      s.hero.attrs.positioning = lv
      s.hero.attrs.gkPositioning = lv
      expect(scoutReading(s.hero)).toBe(lv)
      return applyScouting(s, 0.75, ['fbLeft'])!
    }
    const lo = at(40)
    const hi = at(90)
    expect(hi.effective).toBeGreaterThan(lo.effective)
    expect(hi.buff.bonus).toBeGreaterThan(lo.buff.bonus)
    expect(hi.xp[0]!.xp).toBeGreaterThan(lo.xp[0]!.xp)
  })

  it('a D grade gives no match bonus', () => {
    const s = makeGame(613)
    run(s, 40, (x) => x.calendar.week >= 3 && !!scoutingReport(x))
    const fx = nextClubFixture(s)!
    applyScouting(s, 0.1, [])
    expect(scoutBuff(s, fx.fixture.id)).toBeNull()
  })
})
