import { describe, expect, it } from 'vitest'
import type { Relationship } from '../../core/types'
import {
  buildRelationChanges, buildTrustReasons, expectedMomentsFor, heroMapView, ratingLogView, relationValues, topKinds,
} from './postMatch'
import { trustRawFromMatch } from '../../sim/career/squadRole'
import { postSteps, ratingExtremes, ratingGroups, signedDelta } from '../screens/match/postFlow'

const sum = (xs: { value: number }[]) => Math.round(xs.reduce((a, x) => a + x.value, 0) * 10) / 10

describe('buildTrustReasons', () => {
  const base = { goals: 0, assists: 0, yellow: 0, red: 0, won: false, drew: true }

  it('reasons add up exactly to the shown change', () => {
    const cases = [
      { before: 50, after: 53.4, rating: 7.6, minutes: 90, goals: 1, assists: 1, won: true, drew: false },
      { before: 62.2, after: 58.1, rating: 5.0, minutes: 90, yellow: 1, won: false, drew: false },
      { before: 40, after: 40.9, rating: 7.4, minutes: 25 },
      { before: 70, after: 70, rating: 6.3, minutes: 90 },
    ]
    for (const c of cases) {
      const r = buildTrustReasons({ ...base, ...c })
      expect(sum(r.reasons)).toBeCloseTo(Math.round((r.after - r.before) * 10) / 10, 5)
    }
  })

  it('reasons still sum when goal contributions soften a poor rating', () => {
    const raw = trustRawFromMatch(5, 90, 1, 0, true)
    const r = buildTrustReasons({ ...base, before: 50, after: 50 + raw, rating: 5, minutes: 90, goals: 1, won: true, drew: false })
    expect(r.reasons.find((x) => x.key === 'fair')?.value).toBeGreaterThan(0)
    expect(sum(r.reasons)).toBeCloseTo(Math.round((r.after - r.before) * 10) / 10, 5)
  })

  it('explains a goal + win with positive goal and result lines', () => {
    const r = buildTrustReasons({ ...base, before: 50, after: 54, rating: 7.8, minutes: 90, goals: 1, won: true, drew: false, resultPts: 0.3 })
    expect(r.reasons.find((x) => x.key === 'goals')?.value).toBeGreaterThan(0)
    expect(r.reasons.find((x) => x.key === 'result')?.value).toBeGreaterThan(0)
  })

  it('a red card shows a negative card line, a cameo a minutes line', () => {
    const red = buildTrustReasons({ ...base, before: 50, after: 45, rating: 4.6, minutes: 60, red: 1, won: false, drew: false })
    expect(red.reasons.find((x) => x.key === 'card')?.value).toBeLessThan(0)
    const cameo = buildTrustReasons({ ...base, before: 50, after: 51, rating: 7.5, minutes: 20 })
    expect(cameo.reasons.find((x) => x.key === 'minutes')?.value).toBeLessThan(0)
  })

  it('no minutes → only an "other" line (or nothing)', () => {
    expect(buildTrustReasons({ ...base, before: 50, after: 50, rating: 0, minutes: 0 }).reasons).toEqual([])
  })
})

const rel = (id: string, kind: Relationship['kind'], value: number, why?: string): Relationship => ({
  id, kind, name: id.toUpperCase(), value, memory: [], lastContactWeek: 0, ...(why ? { log: [{ w: 1, d: 1, v: value, cause: 'match', why: { tr: why, en: why } }] } : {}),
})

describe('buildRelationChanges', () => {
  it('lists changed relations with why, biggest first, and collapses a uniform squad', () => {
    const after: Record<string, Relationship> = {
      fans: rel('fans', 'fans', 30, 'show'),
      manager: rel('manager', 'manager', 12, 'rating'),
      mum: rel('mum', 'mother', 50),
      t1: rel('t1', 'teammate', 22, 'win'),
      t2: rel('t2', 'teammate', 12, 'win'),
      t3: rel('t3', 'teammate', 2, 'win'),
      t4: rel('t4', 'teammate', 40, 'assist'),
    }
    const before = { fans: 24, manager: 10, mum: 50, t1: 20, t2: 10, t3: 0, t4: 36 }
    const rows = buildRelationChanges(before, after)
    expect(rows.map((r) => r.id)).toEqual(['fans', 't4', 'manager', 'squad'])
    expect(rows[0].why?.en).toBe('show')
    const squad = rows.find((r) => r.kind === 'squad')!
    expect(squad.name).toBe('3')
    expect(squad.after - squad.before).toBe(2)
  })

  it('relationValues snapshots values', () => {
    expect(relationValues({ a: rel('a', 'fans', 7) })).toEqual({ a: 7 })
  })
})

describe('engine → views', () => {
  it('ratingLogView drops zero lines and keeps flags', () => {
    const v = ratingLogView([
      { minute: 12, source: 'moment', key: 'goal', kind: 'one_on_one', outcome: 'goal', delta: 1 },
      { minute: 30, source: 'team', key: 'goalFor', delta: 0 },
      { minute: 50, source: 'moment', key: 'saved', kind: 'edge_of_box', outcome: 'saved', delta: 0.123, auto: true },
    ])
    expect(v).toHaveLength(2)
    expect(v[1]).toMatchObject({ delta: 0.12, auto: true, kind: 'edge_of_box' })
    expect(ratingLogView(undefined)).toEqual([])
  })

  it('heroMapView rejects malformed / empty maps', () => {
    expect(heroMapView(undefined)).toBeUndefined()
    expect(heroMapView({ cols: 2, rows: 2, heat: [0, 0, 0], shots: [] })).toBeUndefined()
    expect(heroMapView({ cols: 2, rows: 1, heat: [0, 0], shots: [] })).toBeUndefined()
    expect(heroMapView({ cols: 2, rows: 1, heat: [1, 0], shots: [] })?.heat).toEqual([1, 0])
  })
})

describe('expected moments', () => {
  const input = { position: 'ST' as const, relationAvg: 0, morale: 1, form: 50, minutes: 90 }
  it('gives a sane range and kind shares summing to 1', () => {
    const e = expectedMomentsFor(input)
    expect(e.min).toBeGreaterThanOrEqual(4)
    expect(e.max).toBeLessThanOrEqual(10)
    expect(e.max).toBeGreaterThanOrEqual(e.min)
    expect(e.kinds.reduce((a, k) => a + k.share, 0)).toBeCloseTo(1, 5)
    expect(e.kinds[0].share).toBeGreaterThanOrEqual(e.kinds[e.kinds.length - 1].share)
  })
  it('a bench cameo expects fewer moments', () => {
    expect(expectedMomentsFor({ ...input, minutes: 25 }).max).toBeLessThan(expectedMomentsFor(input).min + 1)
  })
  it('expectedMomentsFor always returns a sane preview', () => {
    const e = expectedMomentsFor({ ...input, position: 'CB' })
    expect(e.max).toBeGreaterThanOrEqual(e.min)
    expect(topKinds(e).length).toBeGreaterThan(0)
  })
})

describe('post flow', () => {
  const stats = { minutes: 90, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, passes: 0, passesCompleted: 0, tackles: 0, dribbles: 0, saves: 0, rating: 6.8 }
  it('skips data-less steps', () => {
    expect(postSteps({ stats })).toEqual(['result', 'rating', 'interview'])
    expect(postSteps({ stats: { ...stats, minutes: 0 } })).toEqual(['result', 'interview'])
    expect(postSteps({
      stats, heroMap: { cols: 1, rows: 1, heat: [1], shots: [] }, trust: { before: 1, after: 2, reasons: [] },
      relations: [{ id: 'a', name: 'A', kind: 'fans', before: 0, after: 2 }],
    })).toEqual(['result', 'rating', 'map', 'trust', 'relations', 'interview'])
  })

  it('rating groups add up to the final rating via an "other" line', () => {
    const log = [
      { minute: 10, source: 'moment' as const, key: 'goal', delta: 1 },
      { minute: 5, source: 'moment' as const, key: 'missed', delta: -0.15 },
      { minute: 90, source: 'final' as const, key: 'result', delta: 0.3 },
    ]
    const g = ratingGroups(6, 7.2, log)
    expect(g.groups.map((x) => x.source)).toEqual(['moment', 'final'])
    expect(g.groups[0].lines[0].minute).toBe(5)
    expect(6 + log.reduce((a, l) => a + l.delta, 0) + g.other).toBeCloseTo(7.2, 5)
    expect(ratingGroups(6, 7.15, log).other).toBe(0)
    const ex = ratingExtremes(log)
    expect(ex.best?.key).toBe('goal')
    expect(ex.worst?.key).toBe('missed')
  })

  it('signedDelta', () => {
    expect(signedDelta(0.4)).toBe('+0.4')
    expect(signedDelta(-1.25, 2)).toBe('−1.25')
    expect(signedDelta(0.05)).toBe('+0.05')
    expect(signedDelta(-0.15)).toBe('−0.15')
    expect(signedDelta(0.3)).toBe('+0.3')
    expect(signedDelta(0)).toBe('±0.0')
  })
})
