import { beforeEach, describe, expect, it } from 'vitest'
import { START_YEAR } from '../core/config'
import { COSMETIC_PRODUCTS, FULL_CAREER, PRODUCTS, packFor } from './catalog'
import { _resetEntitlements, cosmeticUnlocked, emptyRecord, grantIn, hasEntitlement, isCareerLocked, parseRecord, purchaseHistory } from './entitlements'
import { isDemoFlag, resolveFlavor } from './flavor'
import { DEMO_IDLE_MS, DEMO_SEED, DEMO_SESSION_MS, demoResetDue } from './demo'
import { DevProvider, UnavailableProvider } from './provider'
import { purchase, restorePurchases, setProvider } from './service'

describe('flavor', () => {
  it('auto = trial on mobile native only', () => {
    expect(resolveFlavor('auto', 'android')).toBe('trial')
    expect(resolveFlavor('auto', 'ios')).toBe('trial')
    expect(resolveFlavor('auto', 'electron')).toBe('premium')
    expect(resolveFlavor('auto', 'web')).toBe('premium')
  })
  it('explicit flag and override win', () => {
    expect(resolveFlavor('trial', 'electron')).toBe('trial')
    expect(resolveFlavor('premium', 'android')).toBe('premium')
    expect(resolveFlavor('premium', 'android', 'trial')).toBe('trial')
  })
})

describe('career lock', () => {
  it('season 1 is free, later seasons need the unlock, premium never locks', () => {
    expect(isCareerLocked('trial', false, START_YEAR)).toBe(false)
    expect(isCareerLocked('trial', false, START_YEAR + 1)).toBe(true)
    expect(isCareerLocked('trial', true, START_YEAR + 5)).toBe(false)
    expect(isCareerLocked('premium', false, START_YEAR + 5)).toBe(false)
  })
})

describe('record', () => {
  it('round-trips, ignores junk and unknown ids', () => {
    const r = grantIn(emptyRecord(), [FULL_CAREER, 'nope'], 'test', 5)
    expect(Object.keys(r.owned)).toEqual([FULL_CAREER])
    expect(parseRecord(JSON.stringify(r))).toEqual(r)
    expect(parseRecord('{bad')).toEqual(emptyRecord())
    expect(parseRecord(null)).toEqual(emptyRecord())
  })
  it('grant is idempotent (keeps the first timestamp)', () => {
    const a = grantIn(emptyRecord(), [FULL_CAREER], 'a', 1)
    expect(grantIn(a, [FULL_CAREER], 'b', 2).owned[FULL_CAREER]).toEqual({ at: 1, src: 'a' })
  })
})

describe('catalog', () => {
  it('has unique ids, and cosmetic packs are gated by their own entitlement', () => {
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(PRODUCTS.length)
    expect(COSMETIC_PRODUCTS.length).toBeGreaterThanOrEqual(2)
    expect(packFor('celebration', 'backflip')?.id).toBe('pack_celebrations')
    expect(packFor('celebration', 'knee_slide')).toBeUndefined()
  })
})

describe('purchase flow (DevProvider)', () => {
  beforeEach(() => {
    _resetEntitlements()
    setProvider(new DevProvider())
  })
  it('buy grants, cosmetics unlock, restore re-grants after the local record is lost', async () => {
    expect(cosmeticUnlocked('celebration', 'backflip')).toBe(false)
    expect(cosmeticUnlocked('celebration', 'knee_slide')).toBe(true)
    expect((await purchase('pack_celebrations')).ok).toBe(true)
    expect(hasEntitlement('pack_celebrations')).toBe(true)
    expect(cosmeticUnlocked('celebration', 'backflip')).toBe(true)
    _resetEntitlements() // simulates a wiped install
    expect(hasEntitlement('pack_celebrations')).toBe(false)
    // no localStorage in node: DevProvider has nothing to restore, a store-backed fake does
    setProvider({ id: 'fake', real: false, products: async () => [], buy: async () => ({ ok: true }), restore: async () => [FULL_CAREER, 'bogus'] })
    expect(await restorePurchases()).toEqual([FULL_CAREER])
    expect(hasEntitlement(FULL_CAREER)).toBe(true)
  })
  it('unavailable provider never grants', async () => {
    setProvider(new UnavailableProvider())
    expect((await purchase(FULL_CAREER)).ok).toBe(false)
    expect(hasEntitlement('pack_avatar')).toBe(false)
  })
})

describe('sim isolation', () => {
  it('nothing under src/sim or src/core imports the store', () => {
    const files = import.meta.glob(['../sim/**/*.ts', '../core/**/*.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    expect(Object.keys(files).length).toBeGreaterThan(20)
    for (const [f, src] of Object.entries(files)) expect(src, f).not.toMatch(/store-iap/)
  })
})

describe('purchase history', () => {
  it('lists newest first with dates and sources, stable on ties', () => {
    let rec = grantIn(emptyRecord(), [FULL_CAREER], 'google', 1000)
    rec = grantIn(rec, [PRODUCTS[1]!.id, PRODUCTS[2]!.id], 'restore:google', 5000)
    const h = purchaseHistory(rec)
    expect(h.map((x) => x.at)).toEqual([5000, 5000, 1000])
    expect(h[2]).toEqual({ id: FULL_CAREER, at: 1000, src: 'google' })
    expect(h[0]!.id.localeCompare(h[1]!.id)).toBeLessThan(0)
  })
  it('is empty for a fresh record and ignores unknown ids', () => {
    expect(purchaseHistory(emptyRecord())).toEqual([])
    expect(purchaseHistory(grantIn(emptyRecord(), ['nope'], 'x'))).toEqual([])
  })
  it('a real purchase appears in the history', async () => {
    _resetEntitlements()
    setProvider(new DevProvider())
    await purchase(FULL_CAREER)
    const { entitlements } = await import('./entitlements')
    expect(purchaseHistory(entitlements.value).map((x) => x.id)).toContain(FULL_CAREER)
    setProvider(null)
  })
})

describe('demo flavor', () => {
  it('demo flag resolves to an unlocked (premium) build everywhere', () => {
    expect(resolveFlavor('demo', 'android')).toBe('premium')
    expect(resolveFlavor('demo', 'web')).toBe('premium')
    expect(isCareerLockedFor('demo')).toBe(false)
  })
  it('isDemoFlag honours the build flag and a dev override', () => {
    expect(isDemoFlag('demo')).toBe(true)
    expect(isDemoFlag('auto')).toBe(false)
    expect(isDemoFlag('auto', 'demo')).toBe(true)
    expect(isDemoFlag('demo', 'trial')).toBe(false)
  })
  it('fixed seed, idle and session resets', () => {
    expect(DEMO_SEED).toBe(20261007)
    expect(demoResetDue(1000, 1000, 1000)).toBeNull()
    expect(demoResetDue(DEMO_IDLE_MS, 0, 0)).toBe('idle')
    expect(demoResetDue(DEMO_IDLE_MS - 1, 0, 0)).toBeNull()
    expect(demoResetDue(DEMO_SESSION_MS, DEMO_SESSION_MS - 1, 0)).toBe('session')
  })
})

function isCareerLockedFor(flag: 'demo'): boolean {
  return isCareerLocked(resolveFlavor(flag, 'android'), false, START_YEAR + 1)
}
