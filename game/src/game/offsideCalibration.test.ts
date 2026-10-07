/**
 * WP-17 calibration: 600 seeded offside situations checked against an independent
 * reference written straight from Law 11 (own half, level with ball, second-last opponent).
 */
import { describe, expect, it } from 'vitest'
import { Rng } from '../core/rng'
import { PITCH_LENGTH } from '../sim/match/types'
import { OFFSIDE_TOLERANCE, isOffsidePosition } from './offside'

/** Reference: work in absolute x, no depth transform. */
function reference(attX: number, ballX: number, oppXs: number[], dir: 1 | -1): boolean {
  const half = PITCH_LENGTH / 2
  const inOwnHalf = dir === 1 ? attX <= half : attX >= half
  if (inOwnHalf) return false
  const aheadOfBall = dir === 1 ? attX > ballX + OFFSIDE_TOLERANCE : attX < ballX - OFFSIDE_TOLERANCE
  if (!aheadOfBall) return false
  // Furthest-forward opponents first; the second one is the offside line.
  const ordered = [...oppXs].sort((p, q) => (dir === 1 ? q - p : p - q))
  const line = ordered.length >= 2 ? ordered[1] : ordered[0]
  return dir === 1 ? attX > line + OFFSIDE_TOLERANCE : attX < line - OFFSIDE_TOLERANCE
}

describe('offside calibration (Law 11)', () => {
  it('600 random situations match the reference (both directions, 1-11 defenders)', () => {
    const rng = new Rng('offside-calibration')
    let offside = 0
    for (let i = 0; i < 600; i++) {
      const dir: 1 | -1 = i % 2 === 0 ? 1 : -1
      const n = rng.int(1, 11)
      const opp = Array.from({ length: n }, () => rng.range(0, PITCH_LENGTH))
      const att = rng.range(0, PITCH_LENGTH)
      const ball = rng.range(0, PITCH_LENGTH)
      const exp = reference(att, ball, opp, dir)
      if (exp) offside++
      expect(isOffsidePosition(att, ball, opp, dir), `case ${i} dir=${dir} att=${att} ball=${ball} opp=${opp}`).toBe(exp)
    }
    // Sanity: the generator exercises both outcomes meaningfully.
    expect(offside).toBeGreaterThan(40)
    expect(offside).toBeLessThan(560)
  })

  it('100 structured cases: just beyond / just short of the second-last defender and the ball', () => {
    const rng = new Rng('offside-structured')
    for (let i = 0; i < 100; i++) {
      const dir: 1 | -1 = i % 2 === 0 ? 1 : -1
      const line = rng.range(60, 95) // depth of second-last defender in the attacking half
      const toX = (d: number) => (dir === 1 ? d : PITCH_LENGTH - d)
      const opp = [toX(104), toX(line), toX(line - rng.range(1, 8)), toX(line - rng.range(1, 15))]
      const ball = toX(rng.range(20, line - 2))
      const beyond = toX(line + 0.5 + rng.range(0, 3))
      const level = toX(line + OFFSIDE_TOLERANCE * 0.5)
      expect(isOffsidePosition(beyond, ball, opp, dir), `beyond ${i}`).toBe(true)
      expect(isOffsidePosition(level, ball, opp, dir), `level ${i}`).toBe(false)
      // Ball played from beyond the attacker makes him onside again.
      expect(isOffsidePosition(beyond, toX(line + 10), opp, dir), `ball ahead ${i}`).toBe(false)
    }
  })
})
