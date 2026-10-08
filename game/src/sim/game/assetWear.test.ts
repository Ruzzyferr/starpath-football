import { describe, expect, it } from 'vitest'
import { WEAR_PER_YEAR, shelfInfo } from './assetView'
import { ASSETS } from '../../data/assets'

describe('asset wear (2.5#71)', () => {
  const cal = { season: 2031, week: 1 }
  const pick = (cat: string) => ASSETS.find((a) => a.category === cat)!
  it('art, watches, property, islands and pets never lose condition; vehicles do', () => {
    for (const cat of ['art', 'watch', 'house', 'island', 'pet'] as const) {
      expect(WEAR_PER_YEAR[cat]).toBe(0)
      const def = pick(cat)
      const info = shelfInfo({ defId: def.id, boughtSeason: 2026, boughtWeek: 1, pricePaid: def.price } as never, def, cal)
      expect(info.condition).toBe(100)
    }
    for (const cat of ['car', 'boat', 'jet'] as const) {
      const def = pick(cat)
      const info = shelfInfo({ defId: def.id, boughtSeason: 2026, boughtWeek: 1, pricePaid: def.price } as never, def, cal)
      expect(info.condition).toBeLessThan(80)
    }
  })
})
