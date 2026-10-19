/**
 * The shop server prices and credits from server/catalog.json; the app shows prices and amounts from
 * catalog.ts and sim/career/gear.ts. They must say the same thing, both ways.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AD_GEMS, COSMETIC_GEM_PRICE, COSMETIC_PRODUCTS, EARN_GEMS, PHYSIO_DISCOUNT_PRICE, SALE_PRODUCTS } from './catalog'
import { AD_TRAIN_BOOST } from '../sim/career/gear'
import { GEAR, PHYSIO_PRICE } from '../sim/career/gear'

interface ServerProduct { kind: string; consumable: boolean; gems?: number; gear?: string; cashWeeks?: number; cashFloor?: number; cashCap?: number }
const server = JSON.parse(readFileSync(join(process.cwd(), '..', 'server', 'catalog.json'), 'utf8')) as {
  products: Record<string, ServerProduct>
  spend: Record<string, { price: number; discounted?: number; grant: { k: string; id?: string } }>
  ads: Record<string, { perDay: number; reward: { gems?: number } }>
  earn: Record<string, { gems: number; perDay: number }>
}

describe('client ↔ server catalogue parity', () => {
  it('every product on sale exists on the server with the same kind, type and amounts, and vice versa', () => {
    const client = Object.fromEntries(SALE_PRODUCTS.map((p) => [p.id, p]))
    expect(Object.keys(server.products).sort()).toEqual(Object.keys(client).sort())
    for (const [id, sp] of Object.entries(server.products)) {
      const cp = client[id]!
      expect(cp.kind, id).toBe(sp.kind)
      expect(cp.consumable, id).toBe(sp.consumable)
      expect(cp.gems ?? null, `${id} gems`).toBe(sp.gems ?? null)
      expect(cp.gear ?? null, `${id} gear`).toBe(sp.gear ?? null)
      expect(cp.cashWeeks ?? null, `${id} weeks`).toBe(sp.cashWeeks ?? null)
      expect(cp.cashFloor ?? null, `${id} floor`).toBe(sp.cashFloor ?? null)
      expect(cp.cashCap ?? null, `${id} cap`).toBe(sp.cashCap ?? null)
    }
  })
  it('gear prices, physio and cosmetic diamond prices match the server spend table', () => {
    for (const g of GEAR) {
      expect(server.spend[g.id]?.price, g.id).toBe(g.price)
      expect(server.spend[g.id]?.grant).toMatchObject({ k: 'gear', id: g.id })
    }
    expect(server.spend.physio?.price).toBe(PHYSIO_PRICE)
    for (const p of COSMETIC_PRODUCTS) {
      const item = Object.values(server.spend).find((x) => x.grant.k === 'cosmetic' && x.grant.id === p.id)
      expect(item?.price, p.id).toBe(COSMETIC_GEM_PRICE)
    }
  })
  it('free diamonds, ad rewards and the physio discount shown in the app match the server', () => {
    for (const [k, v] of Object.entries(EARN_GEMS)) expect(server.earn[k]?.gems, k).toBe(v)
    expect(server.ads.gems?.reward.gems).toBe(AD_GEMS)
    expect(server.spend.physio?.discounted).toBe(PHYSIO_DISCOUNT_PRICE)
    expect(AD_TRAIN_BOOST).toBe(0.2)
  })
})
