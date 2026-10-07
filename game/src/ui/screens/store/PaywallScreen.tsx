import { useEffect, useState } from 'preact/hooks'
import '../../../styles/screens/store.css'
import { t } from '../../../i18n'
import { Button, Card, Page, toast } from '../../components'
import { actions, data, navigate } from '../../store'
import { FULL_CAREER, hasEntitlement, loadProducts, purchase, restorePurchases, storeAvailable } from '../../../store-iap'
import { seasonLabel } from '../../format'

/** Friendly end-of-trial screen. Save, trophies and Hall of Fame stay reachable ("Not now" = read-only mode). */
export function PaywallScreen() {
  const [price, setPrice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const s = data.seasonSummary()
  const owned = hasEntitlement(FULL_CAREER)

  useEffect(() => {
    void loadProducts().then((p) => setPrice(p[FULL_CAREER]?.priceString ?? null))
  }, [])

  const done = () => {
    toast(t('iap.paywall.thanks'), 'success')
    actions.continueSeason()
    navigate('home', undefined, { tab: true })
  }
  const buy = async () => {
    if (!storeAvailable()) return toast(t('iap.paywall.unavailable'), 'error')
    setBusy(true)
    const r = await purchase(FULL_CAREER)
    setBusy(false)
    if (r.ok) done()
    else toast(t(r.error === 'cancelled' ? 'iap.paywall.cancelled' : r.error === 'unavailable' ? 'iap.paywall.unavailable' : 'iap.paywall.failed'), r.error === 'cancelled' ? 'info' : 'error')
  }
  const restore = async () => {
    setBusy(true)
    const ids = await restorePurchases()
    setBusy(false)
    if (ids.includes(FULL_CAREER)) done()
    else toast(t(ids.length ? 'iap.paywall.restored' : 'iap.paywall.nothingToRestore'), 'info')
  }
  const notNow = () => {
    toast(t('iap.paywall.readOnly'), 'info')
    navigate('home', undefined, { tab: true })
  }

  return (
    <Page title={t('iap.paywall.title')} sub={t('iap.paywall.sub')} showBack={false} class="pw-page">
      {s && (
        <Card class="pw-recap">
          <h2 class="h3">{t('iap.paywall.recap', { season: seasonLabel(s.season) })}</h2>
          <p class="t-sm t-mid">{s.club.name}</p>
          <p>{t('iap.paywall.recapLine', { a: s.stats.apps, g: s.stats.goals, as: s.stats.assists, pos: s.leaguePosition })}</p>
        </Card>
      )}
      <Card class="pw-list">
        <h2 class="h3">{t('iap.paywall.continues')}</h2>
        <ul>
          <li>{t('iap.paywall.b1')}</li>
          <li>{t('iap.paywall.b2')}</li>
          <li>{t('iap.paywall.b3')}</li>
          <li>{t('iap.paywall.b4')}</li>
        </ul>
      </Card>
      <div class="pw-actions">
        <Button variant="gold" size="lg" block disabled={busy || owned} onClick={buy} data-testid="pw-buy">
          {price ? t('iap.paywall.buy', { price }) : t('iap.paywall.buyNoPrice')}
        </Button>
        <Button variant="secondary" block disabled={busy} onClick={restore} data-testid="pw-restore">
          {t('iap.paywall.restore')}
        </Button>
        <Button variant="ghost" block disabled={busy} onClick={notNow} data-testid="pw-notnow">
          {t('iap.paywall.notNow')}
        </Button>
      </div>
    </Page>
  )
}
