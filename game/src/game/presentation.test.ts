import { describe, expect, it } from 'vitest'
import {
  CELEBRATIONS, celebrationJoiners, celebrationPose, celebrationSeconds, dominantAngle, isEveningFixture, replayAngleWeights, replayRate,
  resolveCelebration, stadiumLook, stadiumTier, upper, windReadout,
} from './presentation'
import { clearMoments, compactFrames, listMoments, recordMoment, topMoments } from './moments'
import type { Highlight } from '../sim/match/types'

describe('upper', () => {
  it('uses Turkish casing for İ/ı', () => {
    expect(upper('izmir', 'tr')).toBe('İZMİR')
    expect(upper('ılgaz', 'tr')).toBe('ILGAZ')
    expect(upper('izmir', 'en')).toBe('IZMIR')
  })
})

describe('stadium tiers', () => {
  it('maps capacity to four tiers', () => {
    expect(stadiumTier(3_000)).toBe('local')
    expect(stadiumTier(12_000)).toBe('mid')
    expect(stadiumTier(38_000)).toBe('large')
    expect(stadiumTier(75_000)).toBe('mega')
    expect(stadiumTier(Number.NaN)).toBe('local')
  })
  it('bigger grounds are fuller, deeper and brighter; low fx thins the crowd', () => {
    const tiers = [3_000, 12_000, 38_000, 75_000].map((c) => stadiumLook(c))
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].density).toBeGreaterThan(tiers[i - 1].density)
      expect(tiers[i].endDepth).toBeGreaterThan(tiers[i - 1].endDepth)
    }
    expect(new Set(tiers.map((t) => t.lights)).size).toBe(4)
    expect(stadiumLook(75_000, true).density).toBeLessThan(stadiumLook(75_000).density)
  })
})

describe('evening fixtures & wind', () => {
  it('midweek games are under the lights, weekend ones deterministic', () => {
    expect(isEveningFixture('f1', 2)).toBe(true)
    expect(isEveningFixture('abc', 5)).toBe(isEveningFixture('abc', 5))
    const weekend = Array.from({ length: 300 }, (_, i) => isEveningFixture(`fx${i}`, 5)).filter(Boolean).length
    expect(weekend).toBeGreaterThan(60)
    expect(weekend).toBeLessThan(150)
  })
  it('wind read-out in km/h with strength bands; calm is null', () => {
    expect(windReadout({ x: 0, y: 0 })).toBeNull()
    const w = windReadout({ x: 0, y: 6.5 })!
    expect(w.kmh).toBe(23)
    expect(w.strength).toBe(2)
    expect(w.dir.y).toBeCloseTo(1)
  })
})

describe('celebrations', () => {
  const rookie = { reputation: 5, perks: [], achievements: [] }
  it('has twelve (WP-16), each with a unique id and icon', () => {
    expect(CELEBRATIONS).toHaveLength(12)
    expect(new Set(CELEBRATIONS.map((c) => c.id)).size).toBe(12)
    expect(new Set(CELEBRATIONS.map((c) => c.icon)).size).toBe(12)
    const robot = CELEBRATIONS.find((c) => c.id === 'robot')!
    expect(robot.isUnlocked({ ...rookie, achievements: ['first_goal'] })).toBe(true)
    expect(CELEBRATIONS.find((c) => c.id === 'ice_cold')!.isUnlocked({ ...rookie, perks: ['penalty_ice'] })).toBe(true)
    expect(CELEBRATIONS.find((c) => c.id === 'cartwheel')!.isUnlocked({ ...rookie, achievements: ['hat_trick'] })).toBe(true)
    expect(CELEBRATIONS.find((c) => c.id === 'heart_hands')!.isUnlocked({ ...rookie, perks: ['family_first'] })).toBe(true)
  })
  it('has at least six, three open from the start, the rest unlocked by fame/perks/achievements', () => {
    expect(CELEBRATIONS.length).toBeGreaterThanOrEqual(6)
    expect(CELEBRATIONS.filter((c) => c.isUnlocked(rookie)).length).toBe(3)
    const star = { reputation: 90, perks: ['captain_spirit', 'media_darling'], achievements: [] }
    expect(CELEBRATIONS.every((c) => c.isUnlocked(star))).toBe(true)
    expect(CELEBRATIONS.find((c) => c.id === 'backflip')!.isUnlocked({ ...rookie, achievements: ['goals_100'] })).toBe(true)
  })
  it('resolves a locked choice to an unlocked one', () => {
    expect(resolveCelebration('backflip', ['knee_slide', 'airplane'], 0.9)).toBe('airplane')
    expect(resolveCelebration('airplane', ['knee_slide', 'airplane'], 0)).toBe('airplane')
    expect(resolveCelebration('auto', [], 0.5)).toBe('knee_slide')
  })
  it('team-mates with bad relations do not join; keepers stay', () => {
    const mates = [
      { id: 'a', relationToHero: 40, isKeeper: false, distToHero: 10 },
      { id: 'b', relationToHero: -60, isKeeper: false, distToHero: 3 },
      { id: 'c', relationToHero: 0, isKeeper: false, distToHero: 5 },
      { id: 'gk', relationToHero: 90, isKeeper: true, distToHero: 2 },
    ]
    expect(celebrationJoiners(mates).map((m) => m.id)).toEqual(['c', 'a'])
  })
  it('poses are finite for every celebration; reduced motion is shorter and has no flip', () => {
    for (const c of CELEBRATIONS) {
      for (let u = 0; u <= 1; u += 0.05) {
        const p = celebrationPose(c.id, u)
        expect(Number.isFinite(p.rot + p.lift)).toBe(true)
      }
    }
    expect(celebrationSeconds(true)).toBeLessThan(celebrationSeconds(false))
    expect(celebrationPose('backflip', 0.55, true).rot).toBe(0)
    expect(Math.abs(celebrationPose('backflip', 0.55).rot)).toBeGreaterThan(1)
    expect(celebrationPose('cartwheel', 0.55, true).rot).toBe(0)
    expect(Math.abs(celebrationPose('cartwheel', 0.55).rot)).toBeGreaterThan(1)
    // The robot alternates its arm pose on a beat.
    const arms = new Set([0.5, 0.58, 0.66, 0.74].map((u) => celebrationPose('robot', u).arms))
    expect(arms).toEqual(new Set(['robotL', 'robotR']))
  })
})

describe('replay director', () => {
  it('auto cuts tactical → broadcast → goal-cam with weights summing to 1', () => {
    expect(dominantAngle(replayAngleWeights('auto', 0.05))).toBe('tactical')
    expect(dominantAngle(replayAngleWeights('auto', 0.5))).toBe('broadcast')
    expect(dominantAngle(replayAngleWeights('auto', 0.95))).toBe('goalcam')
    for (let u = 0; u <= 1; u += 0.01) {
      const w = replayAngleWeights('auto', u)
      expect(w.broadcast + w.goalcam + w.tactical).toBeCloseTo(1, 6)
    }
    expect(replayAngleWeights('goalcam', 0.1).goalcam).toBe(1)
  })
  it('slows down around the key moment', () => {
    expect(replayRate(5, 5)).toBeLessThan(replayRate(3, 5))
    expect(replayRate(5, 5, true)).toBe(0.6)
  })
})

describe('moments store', () => {
  const frames = Array.from({ length: 60 }, (_, i) => ({ t: i / 60, bx: 0, by: 0, bz: 0, agents: new Float32Array(10) }))
  const hl = (id: string) => ({ id, minute: 10, side: 'home', kind: 'counter', scenario: { kind: 'counter', players: [], ball: { pos: { x: 0, y: 0 }, z: 0, ownerId: null }, timeLimit: 10, prompt: '' }, score: [0, 0] }) as Highlight
  const view = { heroTeamColors: { primary: '#f00', secondary: '#fff', pattern: 'plain' }, oppColors: { primary: '#00f', secondary: '#fff', pattern: 'plain' }, weather: 'clear', lang: 'en' } as const
  it('compacts, lists by minute, ranks the best and keeps only recent matches', () => {
    clearMoments()
    expect(compactFrames(frames).length).toBe(31)
    recordMoment({ matchKey: 'm1', minute: 50, kind: 'counter', outcome: 'missed', highlight: hl('h1'), frames, keyTime: -1, view: { ...view } })
    recordMoment({ matchKey: 'm1', minute: 20, kind: 'counter', outcome: 'goal', highlight: hl('h2'), frames, keyTime: 0.5, view: { ...view } })
    recordMoment({ matchKey: 'm1', minute: 70, kind: 'counter', outcome: 'pass_complete', highlight: hl('h3'), frames, keyTime: -1, view: { ...view } })
    expect(listMoments('m1').map((m) => m.minute)).toEqual([20, 50, 70])
    expect(topMoments('m1', 1)[0].outcome).toBe('goal')
    recordMoment({ matchKey: 'm2', minute: 5, kind: 'counter', outcome: 'goal', highlight: hl('h1'), frames, keyTime: 0.5, view: { ...view } })
    recordMoment({ matchKey: 'm3', minute: 5, kind: 'counter', outcome: 'goal', highlight: hl('h1'), frames, keyTime: 0.5, view: { ...view } })
    expect(listMoments('m1')).toHaveLength(0)
    expect(listMoments('m3')).toHaveLength(1)
    expect(recordMoment({ matchKey: 'm3', minute: 6, kind: 'counter', outcome: 'goal', highlight: hl('x'), frames: frames.slice(0, 3), keyTime: 0, view: { ...view } })).toBeNull()
  })
})
