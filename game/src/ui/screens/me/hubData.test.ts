import { describe, expect, it } from 'vitest'
import { ATTRIBUTE_KEYS, type Attributes, type Relationship } from '../../../core/types'
import { emptyAttrHistory } from '../../../sim/game/saveHistory'
import { tr } from '../../../i18n/tr'
import { en } from '../../../i18n/en'
import { GROUPS, keysOf } from '../career/attrs'
import {
  FAME_MAX_LEVEL, FAME_THRESHOLDS, RELATION_EFFECTS, RELATION_ROWS, STAT_EFFECTS, fameLevel, recentAttrDeltas, relationRows,
} from './hubData'

const attrs = (v: number): Attributes => Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, v])) as Attributes

describe('fameLevel', () => {
  it('maps reputation onto the ladder with the next threshold', () => {
    expect(fameLevel(0)).toMatchObject({ level: 0, floor: 0, next: 15, progress: 0 })
    expect(fameLevel(14.6)).toMatchObject({ level: 1, value: 15, next: 30 })
    expect(fameLevel(37)).toMatchObject({ level: 2, floor: 30, next: 45 })
    expect(fameLevel(37).progress).toBeCloseTo(7 / 15)
    expect(fameLevel(89)).toMatchObject({ level: 5, next: 90 })
  })
  it('tops out at the last level with no next threshold', () => {
    expect(fameLevel(90)).toMatchObject({ level: FAME_MAX_LEVEL, next: null, progress: 1 })
    expect(fameLevel(140)).toMatchObject({ level: FAME_MAX_LEVEL, value: 100 })
  })
  it('clamps junk input', () => {
    expect(fameLevel(-5)).toMatchObject({ level: 0, value: 0 })
    expect(fameLevel(Number.NaN)).toMatchObject({ level: 0, value: 0 })
  })
  it('levels are monotonic in reputation', () => {
    let last = 0
    for (let r = 0; r <= 100; r++) {
      const l = fameLevel(r).level
      expect(l).toBeGreaterThanOrEqual(last)
      last = l
    }
    expect(FAME_THRESHOLDS.length).toBe(FAME_MAX_LEVEL + 1)
  })
})

describe('recentAttrDeltas', () => {
  it('is all zero without history', () => {
    const d = recentAttrDeltas(undefined, attrs(50))
    expect(Object.keys(d)).toHaveLength(ATTRIBUTE_KEYS.length)
    expect(Object.values(d).every((v) => v === 0)).toBe(true)
  })
  it('compares with the sample `weeks` back (or the oldest one)', () => {
    const h = emptyAttrHistory()
    const row = (week: number, v: number) => [2026, week, ...h.keys.map(() => v)]
    h.rows.push(row(0, 40), row(1, 41), row(2, 42), row(3, 43), row(4, 44), row(5, 45))
    const now = { ...attrs(45), pace: 50, tackling: 40 }
    const d = recentAttrDeltas(h, now, 4)
    // 4 weeks back from the newest sample (week 5) is week 1 (41).
    expect(d.pace).toBe(9)
    expect(d.tackling).toBe(-1)
    expect(d.vision).toBe(4)
    const short = recentAttrDeltas({ ...h, rows: h.rows.slice(0, 2) }, now, 4)
    expect(short.pace).toBe(10)
  })
})

describe('relationRows', () => {
  const rel = (id: string, kind: Relationship['kind'], value: number, name = id): Relationship => ({ id, kind, name, value, memory: [], lastContactWeek: 0 })
  it('averages family and teammates, keeps single names, marks missing kinds', () => {
    const rows = relationRows({
      m: rel('m', 'mother', 60), f: rel('f', 'father', 20), t1: rel('t1', 'teammate', 10), t2: rel('t2', 'teammate', -32),
      p: rel('p', 'partner', 45, 'Ayşe'), fans: rel('fans', 'fans', -12),
    })
    const by = Object.fromEntries(rows.map((r) => [r.kind, r]))
    expect(rows.map((r) => r.kind)).toEqual([...RELATION_ROWS])
    expect(by.family).toMatchObject({ value: 40, count: 2, name: null })
    expect(by.teammate).toMatchObject({ value: -11, count: 2 })
    expect(by.partner).toMatchObject({ value: 45, count: 1, name: 'Ayşe' })
    expect(by.fans!.value).toBe(-12)
    expect(by.agent).toMatchObject({ value: null, count: 0 })
  })
})

describe('hub i18n', () => {
  const both = (x: { tr: string; en: string }) => x.tr.trim().length > 0 && x.en.trim().length > 0 && x.tr !== x.en
  it('every "what it affects" line has distinct Turkish and English text', () => {
    for (const [k, v] of Object.entries(STAT_EFFECTS)) expect(both(v), k).toBe(true)
    for (const [k, v] of Object.entries(RELATION_EFFECTS)) expect(both(v), k).toBe(true)
  })
  it('every relation row has an effect line and a label', () => {
    for (const k of RELATION_ROWS) {
      expect(RELATION_EFFECTS[k], k).toBeTruthy()
      if (k !== 'family' && k !== 'teammate') {
        expect(tr.data.relation[k], k).toBeTruthy()
        expect(en.data.relation[k], k).toBeTruthy()
      }
    }
  })
  it('every fame level has a name in both languages', () => {
    for (let i = 0; i <= FAME_MAX_LEVEL; i++) {
      const key = String(i) as keyof typeof tr.hub.fame.levels
      expect(tr.hub.fame.levels[key], `tr ${i}`).toBeTruthy()
      expect(en.hub.fame.levels[key], `en ${i}`).toBeTruthy()
    }
  })
  it('all 30 attributes are grouped and have a name and description in both languages', () => {
    const shown = GROUPS.flatMap((g) => keysOf(g))
    expect(shown).toHaveLength(30)
    expect(new Set(shown)).toEqual(new Set(ATTRIBUTE_KEYS))
    for (const k of ATTRIBUTE_KEYS) {
      expect(tr.data.attr[k], k).toBeTruthy()
      expect(en.data.attr[k], k).toBeTruthy()
      expect(tr.data.attrDesc[k], k).toBeTruthy()
      expect(en.data.attrDesc[k], k).toBeTruthy()
    }
  })
  it('the hub section and nav entry exist in both dictionaries', () => {
    expect(tr.nav.me).toBe('Ben')
    expect(en.nav.me).toBe('Me')
    expect(Object.keys(tr.hub.tabs)).toEqual(Object.keys(en.hub.tabs))
  })
})
