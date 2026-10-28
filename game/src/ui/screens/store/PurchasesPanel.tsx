import { useEffect, useState } from 'preact/hooks'
import { downloadText } from '../../share/cards'
import '../../../styles/screens/store.css'
import { t, lt, locale } from '../../../i18n'
import { Button, toast } from '../../components'
import { navigate } from '../../store'
import { PRODUCTS, PRODUCT_BY_ID, accountLost, adPrivacyOptionsRequired, currentAccountId, showAdPrivacyOptions, entitlements, getFlavor, isDemo, purchaseHistory, restorePurchases, shopApi, storeAvailable } from '../../../store-iap'

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
      {storeAvailable() && <ShopAccount />}
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

/**
 * The anonymous shop account: a recovery code to write down (a new phone or a reinstall gets the
 * diamonds back) and deleting the shop data (GDPR / KVKK). Shown only once the store has been used.
 */
function ShopAccount() {
  const [code, setCode] = useState<string | null>(null)
  const [entry, setEntry] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const has = !!currentAccountId()
  const L = (tr: string, en: string) => lt({ tr, en })
  const getCode = async () => {
    setBusy(true)
    try {
      setCode((await shopApi.recoveryCode()).code)
    } catch {
      toast(L('Kod alınamadı. Bağlantını kontrol et.', 'Could not get a code. Check your connection.'), 'info')
    }
    setBusy(false)
  }
  const useCode = async () => {
    setBusy(true)
    const ok = await shopApi.recoverCode(entry.trim())
    setBusy(false)
    toast(ok ? L('Hesabın geri geldi.', 'Your account is back.') : L('Kod geçersiz veya kullanılmış.', 'The code is invalid or already used.'), ok ? 'success' : 'info')
  }
  const [adPrivacy, setAdPrivacy] = useState(false)
  useEffect(() => {
    void adPrivacyOptionsRequired().then(setAdPrivacy)
  }, [])
  const exportData = async () => {
    setBusy(true)
    try {
      downloadText(JSON.stringify(await shopApi.exportAccount(), null, 2), 'kickborn-shop-data.json', 'application/json')
    } catch {
      toast(L('Dışa aktarılamadı. Bağlantını kontrol et.', 'Could not export. Check your connection.'), 'info')
    }
    setBusy(false)
  }
  const del = async () => {
    setBusy(true)
    try {
      await shopApi.deleteAccount()
      toast(L('Mağaza verilerin silindi.', 'Your shop data was deleted.'), 'success')
    } catch {
      toast(L('Silinemedi. Bağlantını kontrol et.', 'Could not delete. Check your connection.'), 'info')
    }
    setBusy(false)
    setConfirmDelete(false)
  }
  return (
    <div class="pp-panel" data-testid="shop-account">
      <h3 class="h4">{L('Mağaza hesabı', 'Shop account')}</h3>
      {accountLost.value && <p class="t-sm" data-testid="account-lost">{L('Mağaza hesabın bu cihazda açılamadı. Elmasların kaybolmadı: kurtarma kodunla ya da "Satın alımları geri yükle" ile geri al.', 'Your shop account could not be opened on this device. Your diamonds are not lost: bring them back with your recovery code or "Restore purchases".')}</p>}
      <p class="t-sm t-mid">{L('Elmasların sunucumuzdaki isimsiz bir hesapta durur. Telefon değiştirirsen bu kodla geri alırsın; kodu bir yere yaz, kimseyle paylaşma.', 'Your diamonds live in an anonymous account on our server. On a new phone this code brings them back; write it down and never share it.')}</p>
      {has && (code
        ? <p class="score-font" data-testid="recovery-code" style={{ fontSize: '1.4rem', letterSpacing: '0.08em' }}>{code}</p>
        : <div><Button variant="secondary" disabled={busy} onClick={getCode} data-testid="recovery-get">{L('Kurtarma kodu oluştur', 'Create a recovery code')}</Button></div>)}
      <label class="t-sm">
        {L('Kodun var mı?', 'Have a code?')}{' '}
        <input class="input" value={entry} onInput={(e) => setEntry((e.target as HTMLInputElement).value)} placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off" data-testid="recovery-input" />{/* i18n-ok code format mask */}
      </label>
      <div><Button variant="ghost" disabled={busy || entry.trim().length < 8} onClick={useCode} data-testid="recovery-use">{L('Hesabı geri al', 'Restore account')}</Button></div>
      {has && <div><Button variant="ghost" disabled={busy} onClick={exportData} data-testid="shop-export">{L('Mağaza verilerimi dışa aktar', 'Export my shop data')}</Button></div>}
      {adPrivacy && <div><Button variant="ghost" onClick={() => void showAdPrivacyOptions()} data-testid="ad-privacy">{L('Reklam gizlilik seçenekleri', 'Ad privacy choices')}</Button></div>}
      {has && (confirmDelete
        ? (
          <div>
            <p class="t-sm">{L('Elmasların, mağaza geçmişin ve hesabın silinir; geri alınamaz. Mağaza işlemlerinin anonim kaydı yasal süre boyunca saklanır.', 'Your diamonds, shop history and account are deleted and cannot be restored. An anonymous record of store transactions is kept for the legal period.')}</p>
            <Button variant="danger" disabled={busy} onClick={del} data-testid="shop-delete-confirm">{L('Evet, sil', 'Yes, delete')}</Button>{' '}
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>{L('Vazgeç', 'Cancel')}</Button>
          </div>
        )
        : <div><Button variant="ghost" onClick={() => setConfirmDelete(true)} data-testid="shop-delete">{L('Mağaza verilerimi sil', 'Delete my shop data')}</Button></div>)}
    </div>
  )
}
