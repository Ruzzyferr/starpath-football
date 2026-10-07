import { Rng } from '../../../core/rng'
import type { GameState } from '../../../core/types'
import { ALL_EVENTS } from './content'
import { chain, fx, happy, money, rel, t } from './dsl'
import {
  absoluteWeek,
  describeEvent,
  formatText,
  MAX_EVENTS_PER_WEEK,
  MAX_PENDING,
  MAX_REGULAR_PER_WEEK,
  resolveEvent,
  rollEvents,
  scheduledFollowUps,
} from './engine'
import { makeTestState } from './testFixture'
import type { EventCategory, EventDef } from './types'

const mk = (id: string, category: EventCategory, extra: Partial<EventDef> = {}): EventDef => ({
  id,
  category,
  weight: 1,
  cooldownWeeks: 0,
  conditions: () => true,
  title: t('Başlık {heroName}', 'Title {heroName}'),
  text: t('Metin', 'Text'),
  icon: '*',
  choices: [
    { label: t('A', 'A'), effects: () => fx(t('Oldu {clubName}', 'Done {clubName}'), money(100), happy(5), rel('mother', 7)) },
    { label: t('B', 'B'), requires: (c) => c.state.life.money > 1e12, effects: () => fx(t('x', 'x')) },
  ],
  ...extra,
})

/** Advance one week and clear pending cards (as if the player answered them). */
function nextWeek(s: GameState): void {
  s.pendingEvents = []
  s.calendar.week++
  if (s.calendar.week >= 44) {
    s.calendar.week = 0
    s.calendar.season++
  }
}

describe('formatText', () => {
  it('fills vars and formats money per language', () => {
    const tx = t('{name} {amount:money} kazandı ({n})', '{name} won {amount:money} ({n})')
    expect(formatText(tx, { name: 'Ali', amount: 12500, n: 1234567 }, 'en')).toBe('Ali won €12,500 (1,234,567)')
    expect(formatText(tx, { name: 'Ali', amount: 12500, n: 1234567 }, 'tr')).toBe('Ali 12.500 € kazandı (1.234.567)')
    expect(formatText(t('{x}', '{x}'), {}, 'en')).toBe('{x}')
  })
})

describe('rollEvents', () => {
  it('respects cooldown', () => {
    const s = makeTestState()
    const pool = [mk('a.cool', 'weird', { cooldownWeeks: 5 })]
    const rng = new Rng(1)
    const fired: number[] = []
    for (let w = 0; w < 20; w++) {
      if (rollEvents(s, rng, ['weekly'], 1, { events: pool, fireChance: 1 }).length) fired.push(w)
      nextWeek(s)
    }
    expect(fired).toEqual([0, 5, 10, 15])
  })

  it('respects once', () => {
    const s = makeTestState()
    const pool = [mk('a.once', 'weird', { once: true })]
    const rng = new Rng(2)
    let n = 0
    for (let w = 0; w < 10; w++) {
      n += rollEvents(s, rng, ['weekly'], 1, { events: pool, fireChance: 1 }).length
      nextWeek(s)
    }
    expect(n).toBe(1)
  })

  it('only fires triggered events on matching tags, ambient events only on weekly', () => {
    const s = makeTestState()
    const pool = [mk('a.casino', 'casino', { triggers: ['casino'] }), mk('a.ambient', 'weird')]
    const rng = new Rng(3)
    const got = rollEvents(s, rng, ['casino'], 2, { events: pool, fireChance: 1 })
    expect(got.map((p) => p.defId)).toEqual(['a.casino'])
  })

  it('caps cards per week, per roll category and pending', () => {
    const s = makeTestState()
    const cats: EventCategory[] = ['weird', 'press', 'fans', 'money', 'family', 'club']
    const pool = cats.map((c, i) => mk(`${c}.e${i}`, c))
    const rng = new Rng(4)
    for (let i = 0; i < 10; i++) rollEvents(s, rng, ['weekly'], 5, { events: pool, fireChance: 1 })
    expect(s.pendingEvents.length).toBeLessThanOrEqual(MAX_REGULAR_PER_WEEK)
    expect(new Set(s.pendingEvents.map((p) => p.defId.split('.')[0])).size).toBe(s.pendingEvents.length)
    s.pendingEvents = []
    for (let i = 0; i < 10; i++) rollEvents(s, rng, ['weekly'], 5, { events: pool, fireChance: 1 })
    expect(s.pendingEvents.length).toBe(0) // weekly regular budget already spent
    expect(MAX_PENDING).toBeGreaterThanOrEqual(MAX_REGULAR_PER_WEEK)
  })

  it('schedules and fires follow-ups with inherited vars, bypassing cooldown', () => {
    const s = makeTestState()
    const pool: EventDef[] = [
      mk('a.start', 'weird', {
        once: true,
        vars: () => ({ secret: 'parrot' }),
        choices: [{ label: t('go', 'go'), effects: () => fx(t('ok', 'ok'), { followUps: [chain('a.next', 2)] }) }, { label: t('no', 'no'), effects: () => fx(t('no', 'no')) }],
      }),
      mk('a.next', 'press', { followUpOnly: true, text: t('{secret}', '{secret}') }),
    ]
    const rng = new Rng(5)
    const [p] = rollEvents(s, rng, ['weekly'], 1, { events: pool, fireChance: 1 })
    expect(p.defId).toBe('a.start')
    resolveEvent(s, rng, p, 0, pool)
    expect(scheduledFollowUps(s)).toHaveLength(1)
    expect(scheduledFollowUps(s)[0].due).toBe(absoluteWeek(s.calendar) + 2)
    nextWeek(s)
    expect(rollEvents(s, rng, ['weekly'], 1, { events: pool, fireChance: 0 })).toHaveLength(0)
    nextWeek(s)
    const [f] = rollEvents(s, rng, ['weekly'], 1, { events: pool, fireChance: 0 })
    expect(f.defId).toBe('a.next')
    expect(describeEvent(s, f, 'en', pool)!.text).toBe('parrot')
    expect(scheduledFollowUps(s)).toHaveLength(0)
  })

  it('resolveEvent applies deltas once, logs, removes the card and rejects locked choices', () => {
    const s = makeTestState()
    const pool = [mk('a.apply', 'weird')]
    const rng = new Rng(6)
    const [p] = rollEvents(s, rng, ['weekly'], 1, { events: pool, fireChance: 1 })
    expect(() => resolveEvent(s, rng, p, 1, pool)).toThrow()
    const m0 = s.life.money
    const mom0 = s.life.relationships.mother.value
    const res = resolveEvent(s, rng, p, 0, pool)
    expect(s.life.money).toBe(m0 + 100)
    expect(s.life.relationships.mother.value).toBe(mom0 + 7)
    expect(s.life.relationships.mother.memory[0].en).toBe('Title Aliço')
    expect(res.text.en).toBe('Done Kuzey Yıldızı')
    expect(res.deltas.map((d) => d.kind)).toEqual(['money', 'stat', 'relation'])
    expect(s.pendingEvents).toHaveLength(0)
    expect(s.life.log.at(-1)!.text.tr).toBe('Oldu Kuzey Yıldızı')
  })

  it('describeEvent marks locked choices', () => {
    const s = makeTestState()
    const pool = [mk('a.view', 'weird')]
    const [p] = rollEvents(s, new Rng(7), ['weekly'], 1, { events: pool, fireChance: 1 })
    const v = describeEvent(s, p, 'tr', pool)!
    expect(v.title).toBe('Başlık Aliço')
    expect(v.choices.map((c) => c.enabled)).toEqual([true, false])
  })
})

describe('5-season simulation with real content', () => {
  it('stays varied, within limits and numerically sane', () => {
    const s = makeTestState({ seed: 99, partner: false })
    const rng = new Rng(99)
    const perCat = new Map<string, number>()
    const perEvent = new Map<string, number>()
    let total = 0
    let weeks = 0
    for (let season = 0; season < 5; season++) {
      for (let w = 0; w < 44; w++) {
        weeks++
        let weekCount = 0
        const rolls: string[][] = [['weekly']]
        if (w === 0) rolls.unshift(['new_season'])
        if (w === 43) rolls.push(['season_end'])
        if ((w >= 0 && w < 6) || (w >= 20 && w < 24)) rolls.push(['transfer_window'])
        const r = rng.next()
        rolls.push(['post_match', r < 0.4 ? 'match_win' : r < 0.7 ? 'match_draw' : 'match_loss', ...(rng.chance(0.3) ? ['scored'] : [])])
        if (rng.chance(0.3)) rolls.push(['nightlife'])
        if (rng.chance(0.1)) rolls.push(['casino'])
        if (rng.chance(0.4)) rolls.push(['training'])
        for (const tags of rolls) {
          const got = rollEvents(s, rng, tags, 1)
          for (const p of got) {
            weekCount++
            total++
            const def = ALL_EVENTS.find((e) => e.id === p.defId)!
            perCat.set(def.category, (perCat.get(def.category) ?? 0) + 1)
            perEvent.set(def.id, (perEvent.get(def.id) ?? 0) + 1)
            const view = describeEvent(s, p, 'en')!
            const options = view.choices.map((c, i) => (c.enabled ? i : -1)).filter((i) => i >= 0)
            resolveEvent(s, rng, p, rng.pick(options))
          }
        }
        expect(weekCount).toBeLessThanOrEqual(MAX_EVENTS_PER_WEEK)
        // Light upkeep so stats don't saturate unrealistically.
        s.life.money += s.hero.contract?.wage ?? 0
        if (s.hero.injury) {
          s.hero.injury.weeksLeft--
          if (s.hero.injury.weeksLeft <= 0) s.hero.injury = null
        }
        s.hero.suspendedMatches = Math.max(0, s.hero.suspendedMatches - 1)
        s.calendar.week = w + 1
      }
      s.calendar.week = 0
      s.calendar.season++
    }
    const perWeek = total / weeks
    expect(perWeek).toBeGreaterThan(0.5)
    expect(perWeek).toBeLessThan(2.2)
    // Variety: most categories show up, none dominates, no single card spams.
    expect(perCat.size).toBeGreaterThanOrEqual(16)
    for (const [cat, n] of perCat) expect(n / total, cat).toBeLessThan(0.15)
    for (const [id, n] of perEvent) expect(n, id).toBeLessThanOrEqual(12)
    expect(perEvent.size).toBeGreaterThan(80)
    expect(Number.isFinite(s.life.money)).toBe(true)
  })
})
