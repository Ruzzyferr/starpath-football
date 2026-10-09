import { describe, expect, it } from 'vitest'
import { radarShape, type RadarSlot } from './radarShape'

// 4-4-2 in team-relative metres (x 0 own goal → 52.5 halfway).
const XI: RadarSlot[] = [
  { id: 'gk', number: 1, x: 3, y: 34, isKeeper: true },
  { id: 'lb', number: 3, x: 16, y: 8 }, { id: 'cb1', number: 4, x: 14, y: 26 }, { id: 'cb2', number: 5, x: 14, y: 42 }, { id: 'rb', number: 2, x: 16, y: 60 },
  { id: 'lm', number: 11, x: 32, y: 10 }, { id: 'cm1', number: 8, x: 30, y: 28 }, { id: 'cm2', number: 6, x: 30, y: 40 }, { id: 'rm', number: 7, x: 32, y: 58 },
  { id: 'st1', number: 9, x: 46, y: 28, isHero: true }, { id: 'st2', number: 10, x: 46, y: 40 },
]

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

describe('radarShape', () => {
  it('returns all 22 players inside the pitch, hero flagged', () => {
    for (const ballX of [0.02, 0.3, 0.5, 0.8, 0.98]) {
      const r = radarShape({ home: XI, away: XI, ballX, ballY: 0.3, minute: 37 })
      expect(r.home).toHaveLength(11)
      expect(r.away).toHaveLength(11)
      for (const p of [...r.home, ...r.away]) {
        expect(p.x).toBeGreaterThanOrEqual(0.02)
        expect(p.x).toBeLessThanOrEqual(0.98)
        expect(p.y).toBeGreaterThanOrEqual(0.04)
        expect(p.y).toBeLessThanOrEqual(0.96)
      }
      expect(r.home.filter((p) => p.isHero).map((p) => p.id)).toEqual(['st1'])
    }
  })

  it('keepers stay at their own goal; teams defend opposite ends', () => {
    const r = radarShape({ home: XI, away: XI, ballX: 0.5, ballY: 0.5, minute: 10 })
    expect(r.home.find((p) => p.id === 'gk')!.x).toBeLessThan(0.1)
    expect(r.away.find((p) => p.id === 'gk')!.x).toBeGreaterThan(0.9)
    expect(mean(r.home.map((p) => p.x))).toBeLessThan(mean(r.away.map((p) => p.x)))
  })

  it('both blocks slide with the ball', () => {
    const back = radarShape({ home: XI, away: XI, ballX: 0.2, ballY: 0.5, minute: 10 })
    const fwd = radarShape({ home: XI, away: XI, ballX: 0.8, ballY: 0.5, minute: 10 })
    expect(mean(fwd.home.map((p) => p.x))).toBeGreaterThan(mean(back.home.map((p) => p.x)) + 0.1)
    expect(mean(fwd.away.map((p) => p.x))).toBeGreaterThan(mean(back.away.map((p) => p.x)) + 0.1)
  })

  it('is deterministic and tolerates bad input', () => {
    const a = radarShape({ home: XI, away: XI, ballX: 0.6, ballY: 0.7, minute: 55 })
    expect(radarShape({ home: XI, away: XI, ballX: 0.6, ballY: 0.7, minute: 55 })).toEqual(a)
    const bad = radarShape({ home: XI, away: XI, ballX: Number.NaN, ballY: Number.POSITIVE_INFINITY, minute: Number.NaN })
    for (const p of [...bad.home, ...bad.away]) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
  })
})
