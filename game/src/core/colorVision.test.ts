import { describe, expect, it } from 'vitest'
import { cvdDistance, distinctOpponentKit } from './colorVision'
import type { KitColors } from './types'

const kit = (primary: string, secondary = '#ffffff', pattern: KitColors['pattern'] = 'plain'): KitColors => ({ primary, secondary, pattern })

describe('colour vision', () => {
  it('red and green are close under deuteranopia but far for normal vision', () => {
    expect(cvdDistance('#d02020', '#20a030', 'off')).toBeGreaterThan(cvdDistance('#d02020', '#20a030', 'deuteranopia'))
  })
  it('keeps an already distinct opponent kit', () => {
    const opp = kit('#ffffff')
    expect(distinctOpponentKit(kit('#101080'), opp, 'deuteranopia')).toBe(opp)
  })
  it('changes a confusable opponent kit and adds a pattern', () => {
    const hero = kit('#c01818', '#c01818')
    const opp = kit('#2a9a30', '#2a9a30')
    const out = distinctOpponentKit(hero, opp, 'deuteranopia')
    expect(cvdDistance(hero.primary, out.primary, 'deuteranopia')).toBeGreaterThan(120)
    expect(out.pattern).not.toBe(hero.pattern)
  })
})
