/**
 * Shop grant layer (owner/reviewers: "rewards really arrive, once, in the right career"). Grants are
 * applied from their SIGNED payload; these tests cover what applyGrant does with one and what
 * verifyGrant refuses.
 */
import { generateKeyPairSync, sign } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { newGame } from '../../sim/game/newGame'
import { careerInput, standardMix } from '../../sim/game/balanceSim'
import { readGear } from '../../sim/career/gear'
import { verifyGrant, type GrantPayload } from '../../store-iap'
import { CASH_PER_SEASON, applyGrant, boughtCashThisSeason, cashGrantAmount } from './shopBridge'

const game = () => newGame(careerInput(standardMix(1, 1, 4242)[0]!), 4242)
const grant = (o: Partial<GrantPayload>): GrantPayload => ({ v: 1, n: `n-${Math.random()}`, a: 'acc', t: Date.now(), k: 'gear', ...o })

describe('applyGrant', () => {
  it('applies a gear grant once; the same nonce again is "done"', () => {
    const s = game()
    const g = grant({ k: 'gear', id: 'gold_boots' })
    expect(applyGrant(s, g).applied).toBe(true)
    expect(readGear(s.life).inv.gold_boots).toBe(60)
    expect(applyGrant(s, g)).toEqual({ applied: false, why: 'done' })
    expect(readGear(s.life).inv.gold_boots).toBe(60)
  })
  it('a grant bound to another career is not applied here', () => {
    const s = game()
    expect(applyGrant(s, grant({ k: 'gear', id: 'gold_boots', c: 'some-other-career' }))).toEqual({ applied: false, why: 'other_career' })
    expect(applyGrant(s, grant({ k: 'gear', id: 'gold_boots', c: s.meta.id })).applied).toBe(true)
  })
  it('physio needs an injury of 2+ weeks and halves it (rounded up)', () => {
    const s = game()
    s.hero.injury = null
    expect(applyGrant(s, grant({ k: 'physio' }))).toEqual({ applied: false, why: 'not_applicable' })
    s.hero.injury = { name: { tr: 'x', en: 'x' }, weeksLeft: 5, severity: 2 }
    expect(applyGrant(s, grant({ k: 'physio' })).applied).toBe(true)
    expect(s.hero.injury.weeksLeft).toBe(3)
  })
  it('match bonus ×2 pays the bonus of THAT fixture once', () => {
    const s = game()
    s.life.flags['g:lastBonus'] = JSON.stringify({ key: 'fx1', amount: 1200, doubled: false })
    const m0 = s.life.money
    expect(applyGrant(s, grant({ k: 'match_bonus', ref: 'fx-other' })).applied).toBe(false)
    expect(applyGrant(s, grant({ k: 'match_bonus', ref: 'fx1' })).applied).toBe(true)
    expect(s.life.money - m0).toBe(1200)
    expect(applyGrant(s, grant({ k: 'match_bonus', ref: 'fx1' })).applied).toBe(false)
  })
  it('cash: weeks × wage, at least the floor, at most the cap, and never past the season ceiling', () => {
    const s = game()
    s.hero.contract!.wage = 100
    expect(cashGrantAmount(s, 4, 5000, 50000)).toBe(5000)
    s.hero.contract!.wage = 1_000_000
    expect(cashGrantAmount(s, 30, 40000, 400000)).toBe(400000)
    const m0 = s.life.money
    for (let i = 0; i < 3; i++) applyGrant(s, grant({ k: 'cash', weeks: 30, floor: 40000, cap: 400000 }))
    expect(s.life.money - m0).toBe(CASH_PER_SEASON)
    expect(boughtCashThisSeason(s)).toBe(CASH_PER_SEASON)
  })
  it('training boost banks one +20% session', () => {
    const s = game()
    expect(applyGrant(s, grant({ k: 'train_boost' })).applied).toBe(true)
    expect(s.life.flags['g:adTrain']).toBe(1)
  })
})

describe('verifyGrant', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const raw = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('base64')
  const tok = (p: object, key = privateKey) => {
    const b = Buffer.from(JSON.stringify(p)).toString('base64url')
    return `${b}.${sign(null, Buffer.from(b), key).toString('base64url')}`
  }
  beforeAll(() => vi.stubEnv('VITE_SHOP_PUBKEY', raw))
  afterAll(() => vi.unstubAllEnvs())

  it('accepts a server-signed grant for this account and returns the signed fields', async () => {
    const p = await verifyGrant(tok({ v: 1, n: 'a', a: 'acc', t: Date.now(), k: 'gear', id: 'gold_boots' }), 'acc')
    expect(p?.id).toBe('gold_boots')
  })
  it('refuses another key, another account, a tampered payload and an old grant', async () => {
    const other = generateKeyPairSync('ed25519').privateKey
    expect(await verifyGrant(tok({ v: 1, n: 'a', a: 'acc', t: Date.now(), k: 'gear' }, other), 'acc')).toBeNull()
    expect(await verifyGrant(tok({ v: 1, n: 'a', a: 'acc', t: Date.now(), k: 'gear' }), 'someone-else')).toBeNull()
    const good = tok({ v: 1, n: 'a', a: 'acc', t: Date.now(), k: 'cash', weeks: 4 })
    const forged = `${Buffer.from(JSON.stringify({ v: 1, n: 'a', a: 'acc', t: Date.now(), k: 'cash', weeks: 400 })).toString('base64url')}.${good.split('.')[1]}`
    expect(await verifyGrant(forged, 'acc')).toBeNull()
    expect(await verifyGrant(tok({ v: 1, n: 'a', a: 'acc', t: Date.now() - 100 * 86_400_000, k: 'gear' }), 'acc')).toBeNull()
    expect(await verifyGrant('garbage', 'acc')).toBeNull()
  })
})
