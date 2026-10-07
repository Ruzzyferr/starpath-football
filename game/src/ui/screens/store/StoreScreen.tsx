import { useEffect, useState } from 'preact/hooks'
import '../../../styles/screens/store.css'
import { t, lt } from '../../../i18n'
import { Avatar, Button, Card, Page, toast } from '../../components'
import { Icon } from '../../icons'
import { gameState } from '../../store'
import type { Appearance } from '../../../core/types'
import { COSMETIC_PRODUCTS, hasEntitlement, loadProducts, purchase, storeAvailable } from '../../../store-iap'

const FALLBACK_LOOK: Appearance = { skin: 2, hairStyle: 3, hairColor: 1, beard: 0, eyeColor: 1, face: 1, accessory: 0 }

/** Procedural pack art: the avatar pack previews the player's own face with
 *  the extra accessories; the celebrations pack gets a confetti burst. */
function PackArt({ id }: { id: string }) {
  if (id === 'pack_avatar') {
    const look = gameState.value?.hero.appearance ?? FALLBACK_LOOK
    return (
      <div class="st-art st-art-avatar" aria-hidden="true">
        {[2, 4, 5].map((acc, i) => (
          <span key={acc} class={`st-art-face st-art-face-${i}`}>
            <Avatar appearance={{ ...look, accessory: acc }} size={i === 1 ? 84 : 64} background="#3a2a78" />
          </span>
        ))}
      </div>
    )
  }
  return (
    <div class="st-art st-art-party" aria-hidden="true">
      <span class="st-art-burst" />
      <span class="st-art-badge"><Icon name={id === 'pack_celebrations' ? 'party' : 'trophy'} size={40} weight={2} /></span>
    </div>
  )
}

/** Cosmetic packs only. Nothing here touches stats or results. */
export function StoreScreen() {
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => {
    void loadProducts().then((p) => setPrices(Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.priceString]))))
  }, [])
  const buy = async (id: string) => {
    setBusy(id)
    const r = await purchase(id)
    setBusy(null)
    if (!r.ok) toast(t(r.error === 'cancelled' ? 'iap.paywall.cancelled' : r.error === 'unavailable' ? 'iap.paywall.unavailable' : 'iap.paywall.failed'), 'info')
  }
  return (
    <Page title={t('iap.store.title')} sub={t('iap.store.sub')} backTo="settings" showBack>
      {!storeAvailable() && <p class="t-mid">{t('iap.store.noStore')}</p>}
      <div class="st-grid">
        {COSMETIC_PRODUCTS.map((p) => (
          <Card key={p.id} class="st-card" data-testid={`pack-${p.id}`}>
            <PackArt id={p.id} />
            <h2 class="h3">{lt(p.name)}</h2>
            <p class="t-sm t-mid">{lt(p.desc)}</p>
            <span class="t-xs t-lo">{t('iap.store.cosmeticOnly')}</span>
            {hasEntitlement(p.id) ? (
              <span class="st-owned">{t('iap.store.owned')}</span>
            ) : (
              <Button variant="primary" block disabled={busy !== null || !storeAvailable()} onClick={() => buy(p.id)}>
                {prices[p.id] ? t('iap.store.buy', { price: prices[p.id] }) : t('iap.store.buyNoPrice')}
              </Button>
            )}
          </Card>
        ))}
      </div>
    </Page>
  )
}
