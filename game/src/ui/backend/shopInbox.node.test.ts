/**
 * Inbox orchestration (review round 3, M6): which career a grant lands in, when it is acknowledged,
 * and the refund of grants whose career is gone. Network and disk are stubbed; the real session,
 * signature check and grant logic run.
 */
import { generateKeyPairSync, sign } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./persistence', () => ({
  flushAutosave: vi.fn(async () => {}),
  scheduleAutosave: vi.fn(),
  savedCareerIds: vi.fn(async () => new Set<string>()),
}))

import { newGame } from '../../sim/game/newGame'
import { careerInput, standardMix } from '../../sim/game/balanceSim'
import { readGear } from '../../sim/career/gear'
import { ensureAccount, shopApi, type ServerWallet } from '../../store-iap'
import { _resetShopApi } from '../../store-iap/shopApi'
import { replaceState } from './session'
import { applyInbox } from './shopBridge'
import * as persistence from './persistence'

const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const raw = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('base64')
let account = ''
let n = 0
const token = (p: object) => {
  const b = Buffer.from(JSON.stringify(p)).toString('base64url')
  return `${b}.${sign(null, Buffer.from(b), privateKey).toString('base64url')}`
}
const g = (o: object) => {
  const p = { v: 1, n: `nonce-${++n}`, a: account, t: Date.now(), k: 'gear', id: 'gold_boots', ...o }
  return { nonce: p.n, token: token(p), k: p.k }
}
const wallet = (inbox: ReturnType<typeof g>[]): ServerWallet => ({ accountId: account, gems: 0, starter: false, pass: { active: false, until: 0, claimable: false }, entitlements: [], inbox, ads: {}, physioDiscounts: 0, earnedToday: 0, prices: {} })
const game = (seed: number) => newGame(careerInput(standardMix(1, 1, seed)[0]!), seed)
const store = new Map<string, string>()

beforeAll(async () => {
  vi.stubEnv('VITE_SHOP_PUBKEY', raw)
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
  _resetShopApi()
  store.set('starpath.account.v1', JSON.stringify({ accountId: 'acc-1', token: 'acc-1.x' }))
  account = (await ensureAccount()).accountId
})
afterAll(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
beforeEach(() => {
  store.delete('starpath.grants.applied.v1')
  store.delete('starpath.grants.ackq.v1')
  vi.restoreAllMocks()
})

describe('applyInbox', () => {
  it('applies a grant to the loaded career, then acknowledges it (after the save)', async () => {
    const s = game(11)
    replaceState(s)
    const ack = vi.spyOn(shopApi, 'ack').mockResolvedValue(wallet([]))
    const item = g({})
    await applyInbox(wallet([item]))
    expect(readGear(s.life).inv.gold_boots).toBe(60)
    expect(persistence.flushAutosave).toHaveBeenCalled()
    expect(ack).toHaveBeenCalledWith([item.nonce])
  })
  it('with no career loaded nothing is applied or acknowledged; it lands when a career is there', async () => {
    replaceState(null)
    const ack = vi.spyOn(shopApi, 'ack').mockResolvedValue(wallet([]))
    const item = g({})
    await applyInbox(wallet([item]))
    expect(ack).not.toHaveBeenCalled()
    const s = game(12)
    replaceState(s)
    await applyInbox(wallet([item]))
    expect(readGear(s.life).inv.gold_boots).toBe(60)
    expect(ack).toHaveBeenCalledWith([item.nonce])
  })
  it('a grant bound to another career waits; if that career no longer exists, its diamonds are refunded', async () => {
    const s = game(13)
    replaceState(s)
    const ack = vi.spyOn(shopApi, 'ack').mockResolvedValue(wallet([]))
    const voidG = vi.spyOn(shopApi, 'voidGrant').mockResolvedValue({ ...wallet([]), voided: true, refunded: 200 })
    vi.mocked(persistence.savedCareerIds).mockResolvedValueOnce(new Set(['other-career']))
    const waiting = g({ c: 'other-career' })
    await applyInbox(wallet([waiting]))
    expect(readGear(s.life).inv.gold_boots).toBeUndefined()
    expect(voidG).not.toHaveBeenCalled()
    vi.mocked(persistence.savedCareerIds).mockResolvedValueOnce(new Set([s.meta.id]))
    const orphan = g({ c: 'deleted-career' })
    await applyInbox(wallet([orphan]))
    expect(voidG).toHaveBeenCalledWith(orphan.nonce)
    expect(ack).not.toHaveBeenCalledWith(expect.arrayContaining([orphan.nonce]))
  })
  it('if the save cannot be written, the grant is not acknowledged (and is not applied twice later)', async () => {
    const s = game(14)
    replaceState(s)
    const ack = vi.spyOn(shopApi, 'ack').mockResolvedValue(wallet([]))
    vi.mocked(persistence.flushAutosave).mockRejectedValueOnce(new Error('disk full'))
    const item = g({})
    await applyInbox(wallet([item]))
    expect(ack).not.toHaveBeenCalled()
    await applyInbox(wallet([item]))
    expect(readGear(s.life).inv.gold_boots).toBe(60)
    expect(ack).toHaveBeenCalledWith([item.nonce])
  })
  it('a failed acknowledgement stays queued and is sent with the next one', async () => {
    const s = game(15)
    replaceState(s)
    const ack = vi.spyOn(shopApi, 'ack').mockRejectedValueOnce(new Error('offline')).mockResolvedValue(wallet([]))
    const a = g({})
    await applyInbox(wallet([a]))
    const b = g({ k: 'train_boost' })
    await applyInbox(wallet([b]))
    expect(ack).toHaveBeenLastCalledWith(expect.arrayContaining([a.nonce, b.nonce]))
  })
  it('forged or too-old grants are never applied', async () => {
    const s = game(16)
    replaceState(s)
    vi.spyOn(shopApi, 'ack').mockResolvedValue(wallet([]))
    vi.spyOn(shopApi, 'refreshGrants').mockResolvedValue(wallet([]))
    const old = g({ t: Date.now() - 100 * 86_400_000 })
    const forged = { ...g({}), token: `${Buffer.from(JSON.stringify({ v: 1, n: 'x', a: account, t: Date.now(), k: 'gear', id: 'gold_boots' })).toString('base64url')}.${'A'.repeat(86)}` }
    await applyInbox(wallet([old, forged]))
    expect(readGear(s.life).inv.gold_boots).toBeUndefined()
  })
})
