import { describe, expect, it } from 'vitest'
import { PERKS } from '../../data/perks'
import { kickSkill, maxSpin, shotSpeed } from '../../game/kick'
import { flatAttrs } from '../../game/setup'
import { CONSUMED_MATCH_EFFECTS, heroMatchAttributes, heroMatchPerkBoosts, heroMatchPerkFlags } from './matchPerks'

const base = flatAttrs(60, false)
const hero = (perks: string[]) => ({ perks })
const a01 = (v: number) => v / 100

describe('match perk hook', () => {
  it('consumes at least 10 distinct match perk effects that exist in the catalogue', () => {
    const keys = new Set(PERKS.map((p) => p.effect.key))
    const consumed = CONSUMED_MATCH_EFFECTS.filter((k) => keys.has(k))
    expect(consumed.length).toBeGreaterThanOrEqual(10)
  })

  it('no perks = identical attributes', () => {
    expect(heroMatchAttributes(hero([]), base)).toEqual(base)
  })

  it('Finesse Master adds curl and shot skill (kick.maxSpin / kickSkill)', () => {
    const a = heroMatchAttributes(hero(['finesse_master']), base)
    expect(maxSpin('shot', a)).toBeGreaterThan(maxSpin('shot', base))
    expect(kickSkill('shot', a)).toBeGreaterThan(kickSkill('shot', base))
  })

  it('Clinical widens the slow-mo aim window (runtime: 0.85 + composure × 1.35)', () => {
    const a = heroMatchAttributes(hero(['clinical']), base)
    expect(0.85 + a01(a.composure) * 1.35).toBeGreaterThan(0.85 + a01(base.composure) * 1.35)
  })

  it('Aerial King improves headers', () => {
    const a = heroMatchAttributes(hero(['header_king']), base)
    expect(kickSkill('header', a)).toBeGreaterThan(kickSkill('header', base))
    expect(shotSpeed(1, a, 'header')).toBeGreaterThan(shotSpeed(1, base, 'header'))
  })

  it('Marathon / Speed Demon slow the engine stamina drain', () => {
    const drain = (s: number) => 0.0085 * (1.3 - s / 100)
    expect(drain(heroMatchAttributes(hero(['marathon']), base).stamina)).toBeLessThan(drain(base.stamina))
    expect(heroMatchAttributes(hero(['speed_demon']), base).pace).toBeGreaterThan(base.pace)
  })

  it('Cat Reflexes speeds up the keeper (reflexes feed ai reaction + bullet time)', () => {
    const gk = flatAttrs(60, true)
    const a = heroMatchAttributes(hero(['cat_reflexes']), gk)
    expect(a.reflexes).toBeGreaterThan(gk.reflexes)
    expect(a.diving).toBeGreaterThan(gk.diving)
  })

  it('Set-piece wizard, cross specialist, through-ball, penalty ice all raise their kick skill', () => {
    const cases: [string, Parameters<typeof kickSkill>[0]][] = [
      ['set_piece_wizard', 'freekick'], ['cross_specialist', 'cross'], ['through_ball', 'through'], ['penalty_ice', 'penalty'], ['chip_artist', 'chip'],
    ]
    for (const [perk, kind] of cases) expect(kickSkill(kind, heroMatchAttributes(hero([perk]), base))).toBeGreaterThan(kickSkill(kind, base))
  })

  it('defensive perks boost tackling / heading', () => {
    expect(heroMatchAttributes(hero(['slide_tackle']), base).tackling).toBeGreaterThan(base.tackling)
    expect(heroMatchAttributes(hero(['interceptor']), base).positioning).toBeGreaterThan(base.positioning)
    expect(heroMatchAttributes(hero(['aerial_wall']), base).heading).toBeGreaterThan(base.heading)
  })

  it('big game composure only applies in important matches', () => {
    expect(heroMatchPerkBoosts(hero(['big_game']), { importance: 0.4 }).composure).toBeUndefined()
    expect(heroMatchPerkBoosts(hero(['big_game']), { importance: 1 }).composure).toBe(8)
  })

  it('caps at 99 and stacks', () => {
    const a = heroMatchAttributes(hero(['finesse_master', 'set_piece_wizard']), flatAttrs(95))
    expect(a.setPieces).toBe(99)
  })

  it('reports flag perks', () => {
    expect(heroMatchPerkFlags(hero(['long_throw', 'two_footed']))).toEqual(['match_long_throw', 'match_weak_foot'])
  })
})
