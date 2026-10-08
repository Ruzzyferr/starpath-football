import { describe, expect, it } from 'vitest'
import { ASSETS } from '../../data/assets'
import { sellAsset } from '../life/economy'
import { shelfInfo } from './assetView'
import { captureSale, undoSale } from './undoSale'

const car = ASSETS.find((a) => a.category === 'car')!
const house = ASSETS.find((a) => a.category === 'house')!
const cal = { season: 2027, week: 10 }
const mk = () => ({
  calendar: { ...cal, day: 0 },
  life: { money: 1000, assets: [{ defId: car.id, boughtSeason: 2026, boughtWeek: 10, pricePaid: car.price }, { defId: house.id, boughtSeason: 2026, boughtWeek: 10, pricePaid: house.price }] },
}) as never as { calendar: typeof cal; life: { money: number; assets: { defId: string; boughtSeason: number; boughtWeek: number; pricePaid: number }[] } }

describe('undo sale', () => {
  it('restores the asset at its index and takes the proceeds back', () => {
    const s = mk()
    const r = captureSale(s as never, 0)!
    const got = sellAsset(s.life as never, 0, s.calendar).amount
    expect(got).toBe(r.amount)
    expect(s.life.assets).toHaveLength(1)
    expect(undoSale(s as never, r)).toBe(true)
    expect(s.life.assets.map((a) => a.defId)).toEqual([car.id, house.id])
    expect(s.life.money).toBe(1000)
  })
  it('refuses when the proceeds are gone or the item is back', () => {
    const s = mk()
    const r = captureSale(s as never, 0)!
    sellAsset(s.life as never, 0, s.calendar)
    s.life.money = 0
    expect(undoSale(s as never, r)).toBe(false)
    s.life.money = 1e9
    expect(undoSale(s as never, r)).toBe(true)
    expect(undoSale(s as never, r)).toBe(false)
  })
  it('captureSale is null for a bad index', () => {
    expect(captureSale(mk() as never, 9)).toBeNull()
  })
})

describe('shelf info', () => {
  it('cars wear, houses do not; floor holds', () => {
    const o = { defId: car.id, boughtSeason: 2020, boughtWeek: 0, pricePaid: car.price }
    expect(shelfInfo(o, car, cal).condition).toBe(35)
    expect(shelfInfo({ ...o, defId: house.id }, house, cal).condition).toBe(100)
    const fresh = shelfInfo({ ...o, boughtSeason: 2027, boughtWeek: 10 }, car, cal)
    expect(fresh.condition).toBe(100)
    expect(fresh.resale).toBeGreaterThan(0)
  })
})
