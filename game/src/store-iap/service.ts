/** Purchase flow glue: picks a provider, grants entitlements, restore. */
import { detectPlatform, isMobileNative } from '../platform/detect'
import { CapacitorProvider } from './capacitorProvider'
import { PRODUCT_BY_ID } from './catalog'
import { grant } from './entitlements'
import { DevProvider, UnavailableProvider, type PurchaseProvider, type PurchaseResult, type StoreProduct } from './provider'

let provider: PurchaseProvider | null = null

/** Native shells use the real store; dev builds use the instant fake; production web has no store. */
export function getProvider(): PurchaseProvider {
  if (provider) return provider
  if (isMobileNative(detectPlatform())) provider = new CapacitorProvider()
  else if (import.meta.env?.DEV) provider = new DevProvider()
  else provider = new UnavailableProvider()
  return provider
}

/** Tests only (or a future Steam/other adapter). */
export function setProvider(p: PurchaseProvider | null): void {
  provider = p
}

/** Show store UI at all? Premium builds with no provider have nothing to sell. */
export function storeAvailable(): boolean {
  return getProvider().id !== 'none'
}

export async function loadProducts(): Promise<Record<string, StoreProduct>> {
  const list = await getProvider().products()
  return Object.fromEntries(list.map((p) => [p.id, p]))
}

export async function purchase(id: string): Promise<PurchaseResult> {
  if (!PRODUCT_BY_ID[id]) return { ok: false, error: 'unavailable' }
  const p = getProvider()
  const r = await p.buy(id)
  if (r.ok) grant([id], p.id)
  return r
}

/** Re-grant everything the store account owns. Returns the ids confirmed. */
export async function restorePurchases(): Promise<string[]> {
  const p = getProvider()
  const ids = (await p.restore()).filter((id) => PRODUCT_BY_ID[id])
  if (ids.length) grant(ids, `restore:${p.id}`)
  return ids
}
