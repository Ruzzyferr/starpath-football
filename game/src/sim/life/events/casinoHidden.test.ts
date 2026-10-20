/**
 * Casino hidden (no-casino build such as iOS, or the player's setting): no gambling or betting event
 * may fire, spontaneously, as a follow-up, or carried in from an older save. Also covers the other
 * sim-side gambling surfaces (weekly casino tick, achievements, perks).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { Rng } from '../../../core/rng'
import type { GameState } from '../../../core/types'
import { contentFlags } from '../../../core/contentFlags'
import { ALL_EVENTS } from './content'
import { FLAG_FOLLOWUPS, isEligible, isGamblingEvent, purgeHiddenGambling, rollEvents, scheduledFollowUps } from './engine'
import { makeTestState } from './testFixture'
import type { EventDef } from './types'
import { weeklyCasinoTick } from '../casino'
import { ACHIEVEMENTS, CASINO_ACHIEVEMENTS, activeAchievements } from '../../game/achievements'
import { availablePerks } from '../../career/perks'

/**
 * Gambling / betting words in TR and EN, with Unicode word edges ("nöbet" is not a bet, and
 * "bahsetmek" = to mention is not betting).
 */
const GAMBLING = /(?<!\p{L})(casino|roulette|blackjack|gambl\p{L}*|bets?|betting|wager\p{L}*|horse rac\p{L}*|slot machine|bahse gir|bahsi|bahsin)(?!\p{L})|kumar|bahis|rulet|at yarış/iu

/** Everything an event can show: title, text, labels, hints and (via the source) outcome texts. */
function eventSource(def: EventDef): string {
  const parts: string[] = [JSON.stringify(def.title), JSON.stringify(def.text)]
  for (const c of def.choices) {
    parts.push(JSON.stringify(c.label), JSON.stringify(c.hint ?? ''), JSON.stringify(c.lockedHint ?? ''), String(c.effects))
  }
  return parts.join('\n')
}

const byId = (id: string): EventDef => {
  const d = ALL_EVENTS.find((e) => e.id === id)
  if (!d) throw new Error(`no event ${id}`)
  return d
}

/** Roll `weeks` weeks of events with casino-heavy tags; returns every fired event id. */
function rollWeeks(s: GameState, rng: Rng, weeks: number): Set<string> {
  const fired = new Set<string>()
  for (let w = 0; w < weeks; w++) {
    s.life.casino.visitsThisWeek = 2
    for (const p of rollEvents(s, rng, ['weekly', 'casino', 'gambling', 'nightlife'], 3, { fireChance: 1 })) fired.add(p.defId)
    s.pendingEvents = []
    s.calendar.week++
    if (s.calendar.week >= 44) {
      s.calendar.week = 0
      s.calendar.season++
    }
  }
  return fired
}

afterEach(() => {
  contentFlags.hideCasino = false
})

describe('gambling events', () => {
  it('every casino / casinoCareer event is a gambling event', () => {
    const casino = ALL_EVENTS.filter((d) => d.id.startsWith('casino.') || d.category === 'casino')
    expect(casino.length).toBeGreaterThan(20)
    for (const d of casino) expect(isGamblingEvent(d), d.id).toBe(true)
  })

  it('every event whose text offers or mentions a bet or gambling is a gambling event', () => {
    const missed = ALL_EVENTS.filter((d) => GAMBLING.test(eventSource(d)) && !isGamblingEvent(d)).map((d) => d.id)
    expect(missed).toEqual([])
  })

  it('betting outside the casino is flagged too (dinner bet, haircut bet, gambling debt, coin punt)', () => {
    for (const id of ['rivals.academy_old_friend', 'weird.hairstyle_bet', 'weird.hairstyle_reveal', 'friends.debt_trouble', 'friends.debt_aftermath', 'money.coin_hype']) {
      expect(isGamblingEvent(byId(id)), id).toBe(true)
    }
  })

  it('with the casino hidden no gambling event is eligible, whatever the tags', () => {
    const s = makeTestState({ seed: 3 })
    s.hero.birthYear = s.calendar.season - 30
    s.life.casino.addiction = 90
    s.life.casino.visitsThisWeek = 3
    const tags = ['weekly', 'casino', 'gambling', 'nightlife', 'post_match', 'social_post']
    contentFlags.hideCasino = true
    for (const d of ALL_EVENTS.filter(isGamblingEvent)) expect(isEligible(s, d, tags), d.id).toBe(false)
    // Non-gambling events stay eligible (the filter is not a blanket off switch).
    expect(ALL_EVENTS.filter((d) => !isGamblingEvent(d)).some((d) => isEligible(s, d, tags))).toBe(true)
  })

  it('with the casino hidden, a hundred weeks of casino-heavy rolls never fire a gambling card', () => {
    contentFlags.hideCasino = true
    const fired = new Set<string>()
    for (let seed = 1; seed <= 4; seed++) {
      const s = makeTestState({ seed })
      s.hero.birthYear = s.calendar.season - 28
      s.life.casino.addiction = 80
      for (const id of rollWeeks(s, new Rng(seed), 100)) fired.add(id)
    }
    expect(fired.size).toBeGreaterThan(10)
    expect([...fired].filter((id) => isGamblingEvent(byId(id)))).toEqual([])
  })

  it('the default build still fires casino events (behaviour unchanged)', () => {
    const s = makeTestState({ seed: 7 })
    s.hero.birthYear = s.calendar.season - 28
    s.life.casino.addiction = 80
    const fired = rollWeeks(s, new Rng(7), 120)
    expect([...fired].some((id) => byId(id).category === 'casino')).toBe(true)
  })

  it('queued gambling follow-ups are dropped, not fired, while the casino is hidden', () => {
    const s = makeTestState({ seed: 5 })
    s.hero.birthYear = s.calendar.season - 28
    s.life.flags.hair_bet = true
    s.life.flags[FLAG_FOLLOWUPS] = JSON.stringify([
      { id: 'weird.hairstyle_reveal', due: 0, vars: {}, from: 'weird.hairstyle_bet' },
      { id: 'casino.recovery_week', due: 0, vars: {}, from: 'casino.manager_warning' },
    ])
    contentFlags.hideCasino = true
    const out = rollEvents(s, new Rng(5), ['weekly'], 3, { fireChance: 0 })
    expect(out.map((p) => p.defId)).toEqual([])
    expect(scheduledFollowUps(s)).toEqual([])
  })

  it('an old save loads cleanly: gambling cards and follow-ups are purged, the rest is kept', () => {
    const s = makeTestState({ seed: 9 })
    s.pendingEvents = [
      { defId: 'casino.manager_warning', vars: {}, firedAt: { ...s.calendar } },
      { defId: 'weird.hairstyle_bet', vars: {}, firedAt: { ...s.calendar } },
      { defId: 'friends.scene_talk', vars: {}, firedAt: { ...s.calendar } },
    ]
    s.life.flags[FLAG_FOLLOWUPS] = JSON.stringify([
      { id: 'casino.recovery_week', due: 999_999, vars: {}, from: 'x' },
      { id: 'friends.debt_aftermath', due: 999_999, vars: {}, from: 'x' },
      { id: 'friends.debt_press', due: 999_999, vars: {}, from: 'x' },
    ])
    expect(purgeHiddenGambling(s)).toBe(0) // casino shown: nothing touched
    expect(s.pendingEvents).toHaveLength(3)
    contentFlags.hideCasino = true
    expect(purgeHiddenGambling(s)).toBe(2)
    expect(s.pendingEvents.map((p) => p.defId)).toEqual(['friends.scene_talk'])
    expect(scheduledFollowUps(s).map((q) => q.id)).toEqual(['friends.debt_press'])
  })
})

describe('other gambling surfaces with the casino hidden', () => {
  it('the weekly casino tick says nothing, leaks nothing and lets the habit fade', () => {
    const s = makeTestState({ seed: 2 })
    s.life.casino.addiction = 90
    s.life.casino.visitsThisWeek = 2
    const news = s.life.news.length
    contentFlags.hideCasino = true
    for (let i = 0; i < 30; i++) expect(weeklyCasinoTick(s.life, s.hero, { rng: new Rng(i), calendar: s.calendar, hero: s.hero })).toEqual([])
    expect(s.life.news.length).toBe(news)
    expect(s.life.casino.addiction).toBe(0)
    expect(s.life.casino.visitsThisWeek).toBe(0)
  })

  it('casino achievements are neither listed nor unlockable', () => {
    expect(activeAchievements()).toBe(ACHIEVEMENTS)
    contentFlags.hideCasino = true
    const ids = activeAchievements().map((a) => a.id)
    for (const id of CASINO_ACHIEVEMENTS) expect(ids).not.toContain(id)
    for (const a of activeAchievements()) expect(GAMBLING.test(`${a.name.en} ${a.desc.en} ${a.name.tr} ${a.desc.tr}`), a.id).toBe(false)
  })

  it('the gambling perk is not offered', () => {
    const s = makeTestState({ seed: 4 })
    s.hero.perkPoints = 50
    s.hero.attrs.composure = 90
    expect(availablePerks(s.hero, true).map((p) => p.id)).toContain('poker_face')
    contentFlags.hideCasino = true
    expect(availablePerks(s.hero, true).map((p) => p.id)).not.toContain('poker_face')
  })
})
