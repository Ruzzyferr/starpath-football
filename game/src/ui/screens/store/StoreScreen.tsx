import { useEffect, useState } from 'preact/hooks'
import '../../../styles/screens/store.css'
import { t, lt } from '../../../i18n'
import { Button, Card, Page, toast } from '../../components'
import { COSMETIC_PRODUCTS, hasEntitlement, loadProducts, purchase, storeAvailable } from '../../../store-iap'

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
            <div class="st-icon" aria-hidden="true">{p.icon}</div>
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
