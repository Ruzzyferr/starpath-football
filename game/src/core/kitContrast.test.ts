import { describe, expect, it } from 'vitest'
import { BALL_MIN_CONTRAST, ballDistance, deltaE, pickBallStyle, resolveMatchKits } from './kitContrast'
import { PITCH_COLORS } from './pitchColors'
import { KIT_CLASH_DISTANCE, KIT_PALETTE, colorDistance } from '../sim/world/colors'
import { generateWorld } from '../sim/world/generate'
import { Rng } from './rng'
import type { KitColors } from './types'

const kit = (primary: string, secondary = '#111111'): KitColors => ({ primary, secondary, pattern: 'plain' })
const TURFS = Object.entries(PITCH_COLORS) as [keyof typeof PITCH_COLORS, readonly [string, string, string]][]
// Every primary a club can wear: the palette plus the neutral change / national kits.
const PRIMARIES = [...KIT_PALETTE.map((c) => c.hex), '#F4F4F4', '#1B1B1B', '#f4f4f4', '#15161a']

function ballFor(a: KitColors, b: KitColors, turf: readonly string[], snow = false) {
  return pickBallStyle([a.primary, b.primary, turf[0]!, turf[1]!], { snow })
}

describe('kit contrast', () => {
  it('Lab ΔE sanity: identical = 0, black/white ≈ 100', () => {
    expect(deltaE('#ffffff', '#ffffff')).toBeCloseTo(0, 5)
    expect(deltaE('#000000', '#ffffff')).toBeGreaterThan(99)
    // Small-object distance is lightness-led: white vs yellow is far closer than plain ΔE says.
    expect(ballDistance('#fbfbf7', '#FFD100')).toBeLessThan(deltaE('#fbfbf7', '#FFD100') / 2)
  })

  it('tester case: white and yellow kits never get the white ball', () => {
    for (const [, turf] of TURFS) {
      const st = ballFor(kit('#FFFFFF'), kit('#FFD100'), turf)
      expect(st.fill).not.toBe('#fbfbf7')
      expect(st.contrast).toBeGreaterThanOrEqual(BALL_MIN_CONTRAST)
    }
  })

  it('keeper kits steer the hi-vis ball away from them (pink keeper → no magenta ball)', () => {
    const st = pickBallStyle(['#FFFFFF', '#FFD100', ...PITCH_COLORS.clear.slice(0, 2)], { soft: ['#ff4fa3', '#2ee87a'] })
    expect(st.fill).not.toBe('#ff2bd6')
    expect(ballDistance(st.fill, '#ff4fa3')).toBeGreaterThanOrEqual(BALL_MIN_CONTRAST)
    // A yellow keeper alone never pushes the white ball out.
    expect(pickBallStyle(['#C8102E', '#0B1F41', ...PITCH_COLORS.clear.slice(0, 2)], { soft: ['#f5c400'] }).fill).toBe('#fbfbf7')
  })

  it('keeps the classic white ball for dark kits on day turf', () => {
    const st = ballFor(kit('#C8102E'), kit('#0B1F41'), PITCH_COLORS.clear)
    expect(st.fill).toBe('#fbfbf7')
    expect(st.switched).toBe(false)
  })

  it('every kit pair × every turf: the ball clears the contrast bar against both kits and the grass', () => {
    let worst = Infinity
    for (const a of PRIMARIES) for (const b of PRIMARIES) for (const [w, turf] of TURFS) {
      const st = ballFor(kit(a), kit(b), turf, w === 'snow')
      for (const c of [a, b, turf[0], turf[1]]) worst = Math.min(worst, ballDistance(st.fill, c))
      expect(st.halo).toBe(false)
    }
    expect(worst).toBeGreaterThanOrEqual(BALL_MIN_CONTRAST)
  })

  it('the ball rim always contrasts with the ball body', () => {
    for (const a of PRIMARIES) {
      const st = ballFor(kit(a), kit('#FFFFFF'), PITCH_COLORS.clear)
      expect(deltaE(st.rim, st.fill)).toBeGreaterThan(40)
    }
  })

  it('kit vs kit: the worn kits never clash for any palette combination', () => {
    for (const h of PRIMARIES) for (const a of PRIMARIES) for (const alt of PRIMARIES) {
      const k = resolveMatchKits(kit(h, '#FFFFFF'), kit(a, '#111111'), kit(alt, '#FFD100'))
      expect(colorDistance(k.home.primary, k.away.primary)).toBeGreaterThanOrEqual(KIT_CLASH_DISTANCE)
    }
  })

  it('every club pair in a generated world: kits stay apart and the ball reads against both', () => {
    const world = generateWorld(new Rng(42), { season: 2026, heroCountryId: 'TR', countryIds: ['TR', 'EN'] })
    const clubs = Object.values(world.clubs)
    expect(clubs.length).toBeGreaterThan(40)
    let clashes = 0
    for (const home of clubs) for (const away of clubs) {
      if (home === away) continue
      if (colorDistance(home.colors.primary, away.colors.primary) < KIT_CLASH_DISTANCE) clashes++
      const k = resolveMatchKits(home.colors, away.colors, away.awayColors)
      expect(colorDistance(k.home.primary, k.away.primary)).toBeGreaterThanOrEqual(KIT_CLASH_DISTANCE)
      const st = ballFor(k.home, k.away, PITCH_COLORS.clear)
      expect(Math.min(ballDistance(st.fill, k.home.primary), ballDistance(st.fill, k.away.primary))).toBeGreaterThanOrEqual(BALL_MIN_CONTRAST)
    }
    // The data really does contain clashing pairs, so the rule is exercised.
    expect(clashes).toBeGreaterThan(0)
  })

  it('away side keeps its home kit when there is no clash', () => {
    const home = kit('#C8102E')
    const away = kit('#0057B8')
    expect(resolveMatchKits(home, away, kit('#FFFFFF')).away).toBe(away)
    const clash = resolveMatchKits(kit('#FFFFFF'), kit('#F4F4F4'), kit('#111111'))
    expect(clash.away.primary).toBe('#111111')
  })
})
