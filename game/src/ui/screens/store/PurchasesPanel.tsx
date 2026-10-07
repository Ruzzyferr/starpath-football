import { useState } from 'preact/hooks'
import '../../../styles/screens/store.css'
import { t, lt, locale } from '../../../i18n'
import { Button, toast } from '../../components'
import { navigate } from '../../store'
import { PRODUCTS, PRODUCT_BY_ID, entitlements, getFlavor, isDemo, purchaseHistory, restorePurchases, storeAvailable } from '../../../store-iap'

/** Settings > Purchases: restore (store policy requires it) + what this install owns. */
export function PurchasesPanel() {
  const [busy, setBusy] = useState(false)
  const flavor = getFlavor()
  const history = purchaseHistory(entitlements.value)
  const owned = PRODUCTS.filter((p) => p.id in entitlements.value.owned)
  const restore = async () => {
    setBusy(true)
    const ids = await restorePurchases()
    setBusy(false)
    toast(t(ids.length ? 'iap.paywall.restored' : 'iap.paywall.nothingToRestore'), ids.length ? 'success' : 'info')
  }
  return (
    <div class="pp-panel" data-testid="purchases-panel">
      {flavor === 'premium' && <p class="t-sm t-mid">{t('iap.panel.premium')}</p>}
      <p class="t-sm t-mid">{t('iap.panel.restoreDesc')}</p>
      <div>
        <Button variant="secondary" disabled={busy} onClick={restore} data-testid="restore-btn">
          {t('iap.panel.restore')}
        </Button>
      </div>
      <h3 class="h4">{t('iap.panel.list')}</h3>
      <ul class="pp-list" data-testid="entitlement-list">
        {owned.length === 0 && <li class="t-lo">{t('iap.panel.none')}</li>}
        {owned.map((p) => (
          <li key={p.id}>{p.icon} {lt(p.name)}</li>
        ))}
      </ul>
      <h3 class="h4">{t('iap.panel.history')}</h3>
      <ul class="pp-list" data-testid="purchase-history">
        {history.length === 0 && <li class="t-lo">{t('iap.panel.historyNone')}</li>}
        {history.map((h) => (
          <li key={h.id} data-testid="purchase-history-row">
            {PRODUCT_BY_ID[h.id]?.icon} {lt(PRODUCT_BY_ID[h.id]?.name)}{' '}
            <span class="t-xs t-lo">
              {t('iap.panel.historyLine', { date: new Date(h.at).toLocaleDateString(locale(), { year: 'numeric', month: 'short', day: 'numeric' }), source: h.src.replace(':', ' · ') })}
            </span>
          </li>
        ))}
      </ul>
      {isDemo() && <p class="t-sm t-mid" data-testid="demo-note">{t('iap.panel.demo')}</p>}
      {storeAvailable() && (
        <div>
          <Button variant="ghost" onClick={() => navigate('store')}>{t('iap.panel.openStore')}</Button>
        </div>
      )}
      <span class="t-xs t-lo">{t('iap.panel.build', { flavor })}</span>
    </div>
  )
}
