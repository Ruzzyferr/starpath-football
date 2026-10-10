import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_HELP, HELP_KEY, parseHelp } from './prefs'
import { MATCH_GROUPS } from './hints'
import { TUTORIAL_KEYS, drillTutorialKey, howToFor, matchTutorialKey, shouldShowTutorial } from './howTo'
import { tr } from '../../i18n/tr'
import { en } from '../../i18n/en'

const on = { gameTips: true, hiddenTutorials: [] as string[] }

/** Resolve "a.b.c" in a dictionary (i18n keys used by the cards). */
const lookup = (dict: unknown, key: string): unknown => key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), dict)

describe('mini-game how-to cards: visibility', () => {
  it('shows before every play of every kind (no seen-once rule)', () => {
    for (const k of TUTORIAL_KEYS) {
      // Same answer every time: nothing is "learned" by playing.
      expect(shouldShowTutorial(k, on), k).toBe(true)
      expect(shouldShowTutorial(k, on), k).toBe(true)
    }
  })

  it('"don\'t show again" hides only that kind', () => {
    const prefs = { gameTips: true, hiddenTutorials: [matchTutorialKey('penalty')] }
    expect(shouldShowTutorial('match:penalty', prefs)).toBe(false)
    expect(shouldShowTutorial('match:freekick', prefs)).toBe(true)
    expect(shouldShowTutorial('drill:finishing', prefs)).toBe(true)
    expect(shouldShowTutorial('scout', prefs)).toBe(true)
  })

  it('the master switch hides every card', () => {
    for (const k of TUTORIAL_KEYS) expect(shouldShowTutorial(k, { gameTips: false, hiddenTutorials: [] })).toBe(false)
  })

  it('unknown kinds have no card', () => {
    expect(shouldShowTutorial('match:nope', on)).toBe(false)
    expect(howToFor('bogus')).toBeNull()
  })

  it('drill keys follow the variant that has its own rules', () => {
    expect(drillTutorialKey('finishing', 'setPiece')).toBe('drill:setPiece')
    expect(drillTutorialKey('finishing', 'standard')).toBe('drill:finishing')
    expect(drillTutorialKey('passing', 'rondo')).toBe('drill:rondo')
    expect(drillTutorialKey('goalkeeping', undefined)).toBe('drill:goalkeeping')
  })
})

describe('mini-game how-to cards: content', () => {
  it('every match moment kind has a card', () => {
    for (const kind of Object.keys(MATCH_GROUPS)) expect(howToFor(matchTutorialKey(kind)), kind).not.toBeNull()
  })

  it('every card has a goal, controls, a tip naming a real attribute, in both languages', () => {
    for (const k of TUTORIAL_KEYS) {
      const h = howToFor(k)!
      for (const dict of [tr, en]) {
        const text = (c: unknown) => (typeof c === 'string' ? lookup(dict, c) : (c as Record<string, string>)[dict === tr ? 'tr' : 'en'])
        expect(typeof text(h.title) === 'string' && (text(h.title) as string).length > 2, `${k} title`).toBe(true)
        expect((text(h.goal) as string)?.length, `${k} goal`).toBeGreaterThan(8)
        if (h.controls) {
          expect((text(h.controls.touch) as string)?.length, `${k} touch`).toBeGreaterThan(8)
          expect((text(h.controls.pc) as string)?.length, `${k} pc`).toBeGreaterThan(5)
        } else {
          expect(h.groups.length, `${k} groups`).toBeGreaterThan(0)
          for (const p of ['touch', 'mouse', 'pad'] as const) for (const g of h.groups) expect(dict.help.hints[p][g].length).toBeGreaterThan(10)
        }
        expect(typeof lookup(dict, `data.attr.${h.attr}`), `${k} attr`).toBe('string')
        expect(h.tip[dict === tr ? 'tr' : 'en'].length, `${k} tip`).toBeGreaterThan(10)
      }
    }
  })
})

describe('mini-game how-to prefs (persisted, migration-safe)', () => {
  it('old saves without the new fields get the defaults', () => {
    const old = parseHelp(JSON.stringify({ tips: true, seenHints: ['match:shoot', 'drill:pass'], tourOffered: true }))
    expect(old.gameTips).toBe(true)
    expect(old.hiddenTutorials).toEqual([])
    expect(old.tourOffered).toBe(true)
    expect(parseHelp('not json')).toEqual(DEFAULT_HELP)
    expect(parseHelp(null)).toEqual(DEFAULT_HELP)
    expect(parseHelp('null')).toEqual(DEFAULT_HELP)
    expect(parseHelp(JSON.stringify({ gameTips: 'yes', hiddenTutorials: ['scout', 3, 'scout'] }))).toMatchObject({ gameTips: true, hiddenTutorials: ['scout'] })
  })

  describe('storage round trip', () => {
    let store: Record<string, string>
    beforeEach(() => {
      store = {}
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => void (store[k] = v),
        removeItem: (k: string) => void delete store[k],
      })
      vi.resetModules()
    })
    afterEach(() => vi.unstubAllGlobals())

    it('"don\'t show again" persists, survives a reload, and "show all again" restores', async () => {
      // An old (seen-once era) save: every hint "learned" — must not hide any card any more.
      store[HELP_KEY] = JSON.stringify({ tips: true, seenHints: ['match:shoot', 'match:pass', 'match:move', 'drill:shoot'], tourOffered: true })
      const p = await import('./prefs')
      const h = await import('./howTo')
      expect(h.shouldShowTutorial('match:one_on_one', p.helpPrefs.value)).toBe(true)

      p.hideTutorial('match:penalty')
      p.hideTutorial('match:penalty') // idempotent
      expect(JSON.parse(store[HELP_KEY]!).hiddenTutorials).toEqual(['match:penalty'])

      vi.resetModules()
      const p2 = await import('./prefs')
      const h2 = await import('./howTo')
      expect(h2.shouldShowTutorial('match:penalty', p2.helpPrefs.value)).toBe(false)
      expect(h2.shouldShowTutorial('match:corner', p2.helpPrefs.value)).toBe(true)

      p2.updateHelp({ gameTips: false })
      expect(h2.shouldShowTutorial('match:corner', p2.helpPrefs.value)).toBe(false)
      p2.updateHelp({ gameTips: true })

      p2.resetTutorials()
      expect(h2.shouldShowTutorial('match:penalty', p2.helpPrefs.value)).toBe(true)
      expect(JSON.parse(store[HELP_KEY]!)).toMatchObject({ hiddenTutorials: [], gameTips: true, tourOffered: true })
    })
  })
})
