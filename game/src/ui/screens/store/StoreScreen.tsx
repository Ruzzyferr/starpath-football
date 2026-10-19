import { useEffect, useState } from 'preact/hooks'
import '../../../styles/screens/store.css'
import { t, lt, currentLang } from '../../../i18n'
import { Avatar, Button, Card, Page, Tabs, toast } from '../../components'
import { Icon } from '../../icons'
import { gameState } from '../../store'
import type { Appearance, LText } from '../../../core/types'
import { GEAR, PHYSIO_PRICE, readGear, type GearSlot } from '../../../sim/career/gear'
import {
  COSMETIC_PRODUCTS, adsAvailable, hasEntitlement, loadProducts, productsOfKind, purchase, refreshWallet, serverWallet, shopOffline, storeAvailable, watchAd,
  type AdOffer, type ProductDef,
} from '../../../store-iap'
import { buyGear, buyPhysio, cashGrantAmount, claimPassDaily, equipGearAction, gemsToCash, unequipGearAction } from '../../backend/shopBridge'
import { fmtMoney } from '../../../sim/career/common'

const FALLBACK_LOOK: Appearance = { skin: 2, hairStyle: 3, hairColor: 1, beard: 0, eyeColor: 1, face: 1, accessory: 0 }
const L = (tr: string, en: string): LText => ({ tr, en })

/** Diamonds in euros at the most popular pack's rate (EU consumer rule: show the real-money value). */
const EUR_PER_GEM = 4.99 / 600
const eur = (gems: number): string => `≈ €${(gems * EUR_PER_GEM).toFixed(2).replace('.', currentLang.value === 'tr' ? ',' : '.')}`

const ERR: Record<string, LText> = {
  offline: L('Mağaza sunucusuna ulaşılamadı. İnternet bağlantını kontrol et.', 'Could not reach the shop server. Check your connection.'),
  insufficient_gems: L('Yeterli elmasın yok.', 'Not enough diamonds.'),
  ad_cap: L('Bugünlük bu reklam hakkın doldu. Yarın yine gel.', 'You have used today’s ads for this. Come back tomorrow.'),
  dismissed: L('Reklam yarıda kapandı. Hakkın yanmadı.', 'The ad was closed early. Nothing was used up.'),
  failed: L('Reklam şu an yüklenemedi. Hakkın yanmadı, sonra yine dene.', 'The ad could not load. Nothing was used up; try again later.'),
  no_career: L('Önce bir kariyer başlat veya yükle.', 'Start or load a career first.'),
  not_injured: L('Fizyoterapi yalnızca sakatken (2+ hafta) kullanılabilir.', 'Physio is only for an injury of 2+ weeks.'),
  already_claimed: L('Bugünkü elmasını zaten aldın.', 'You already claimed today’s diamonds.'),
  no_pass: L('Pro Sözleşme aktif değil.', 'Pro Contract is not active.'),
  rejected: L('Satın alma doğrulanamadı. Ödeme alındıysa bir sonraki açılışta tekrar denenecek.', 'The purchase could not be verified. If you were charged it is retried on the next launch.'),
  cancelled: L('Satın alma iptal edildi.', 'Purchase cancelled.'),
  unavailable: L('Bu ürün şu an satın alınamıyor.', 'This item cannot be bought right now.'),
}
const errText = (code: string | undefined): string => lt(ERR[code ?? 'failed'] ?? ERR.failed!)

type TabId = 'gems' | 'gear' | 'cash' | 'cosmetic' | 'pro'

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

function AdButton({ offer, label, busy, run }: { offer: AdOffer; label: string; busy: boolean; run: (offer: AdOffer) => void }) {
  const w = serverWallet.value
  const cap = w?.ads[offer]
  const left = cap ? cap.max - cap.used : undefined
  if (!adsAvailable()) return null
  const pro = !!w?.pass.active
  return (
    <Button variant="secondary" icon="play" disabled={busy || left === 0} onClick={() => run(offer)} data-testid={`ad-${offer}`}>
      {label}{left !== undefined ? ` (${left}/${cap!.max})` : ''}{pro ? ` · ${lt(L('Pro: reklamsız', 'Pro: no ad'))}` : ''}
    </Button>
  )
}

/** F2P shop: diamonds, gear, cash, cosmetics, Pro Contract. Nothing here changes a match result. */
export function StoreScreen() {
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('gems')
  const w = serverWallet.value
  const s = gameState.value
  const gear = s ? readGear(s.life) : { inv: {}, eq: {} }

  useEffect(() => {
    void loadProducts().then((p) => setPrices(Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.priceString]))))
    // Opening the shop is the player's choice to go online with it (creates the anonymous account).
    void refreshWallet(true)
  }, [])

  const run = async (key: string, fn: () => Promise<{ ok: boolean; reason?: string; error?: string }>, done?: LText) => {
    setBusy(key)
    const r = await fn()
    setBusy(null)
    if (r.ok) {
      if (done) toast(lt(done), 'success')
    } else toast(errText(r.reason ?? r.error), 'info')
  }
  const buy = (p: ProductDef) => run(p.id, () => purchase(p.id), L(`${p.icon} ${p.name.tr}: teşekkürler!`, `${p.icon} ${p.name.en}: thank you!`))
  const ad = (offer: AdOffer) => run(`ad:${offer}`, () => watchAd(offer), offer === 'gems' ? L('+10💎', '+10💎') : offer === 'physio_disc' ? L('Fizyoterapi indirimi hazır: 50💎.', 'Physio discount ready: 50💎.') : undefined)
  const price = (p: ProductDef) => (prices[p.id] ? t('iap.store.buy', { price: prices[p.id]! }) : t('iap.store.buyNoPrice'))
  const can = storeAvailable()

  const buyBtn = (p: ProductDef, owned = false) =>
    owned ? (
      <span class="st-owned">{t('iap.store.owned')}</span>
    ) : (
      <Button variant="primary" block disabled={busy !== null || !can} onClick={() => buy(p)} data-testid={`buy-${p.id}`}>{price(p)}</Button>
    )

  const tabs = [
    { id: 'gems' as const, label: lt(L('Elmas', 'Diamonds')), icon: 'star' as const },
    { id: 'gear' as const, label: lt(L('Ekipman', 'Gear')), icon: 'boot' as const },
    { id: 'cash' as const, label: lt(L('Para', 'Cash')), icon: 'coins' as const },
    { id: 'cosmetic' as const, label: lt(L('Kozmetik', 'Cosmetics')), icon: 'party' as const },
    { id: 'pro' as const, label: 'Pro', icon: 'crown' as const },
  ]

  return (
    <Page title={t('iap.store.title')} sub={lt(L('Satın aldığın hiçbir şey maç sonucunu değiştirmez.', 'Nothing you buy changes a match result.'))} backTo="settings" showBack>
      <div class="st-wallet" data-testid="st-wallet">
        <span class="st-gems" data-testid="st-gems">💎 {w ? w.gems.toLocaleString() : '—'}</span>
        {w?.pass.active && <span class="st-pro">PRO</span>}
        {shopOffline.value && <span class="t-xs t-lo">{lt(L('Çevrimdışı: bakiye son bilinen değer.', 'Offline: last known balance.'))}</span>}
      </div>
      {!can && <p class="t-mid">{t('iap.store.noStore')}</p>}
      <Tabs items={tabs} value={tab} onChange={setTab} label={t('iap.store.title')} idPrefix="st" />

      {tab === 'gems' && (
        <div class="st-grid" data-testid="st-tab-gems">
          {productsOfKind('starter').map((p) => (
            <Card key={p.id} class="st-card st-starter" data-testid={`pack-${p.id}`}>
              <div class="st-big">{p.icon}</div>
              <h2 class="h3">{lt(p.name)}</h2>
              <p class="t-sm t-mid">{lt(p.desc)}</p>
              {buyBtn(p, !!w?.starter)}
            </Card>
          ))}
          {productsOfKind('gems').map((p) => (
            <Card key={p.id} class="st-card" data-testid={`pack-${p.id}`}>
              {p.badge && <span class="st-badge">{lt(p.badge === 'best' ? L('En iyi değer', 'Best value') : L('En popüler', 'Most popular'))}</span>}
              <div class="st-big">💎</div>
              <h2 class="h3">{lt(p.name)}</h2>
              {buyBtn(p)}
            </Card>
          ))}
          <Card class="st-card">
            <h2 class="h4">{lt(L('Ücretsiz elmas', 'Free diamonds'))}</h2>
            <p class="t-sm t-mid">{lt(L('Reklam izle (isteğe bağlı) veya oynayarak kazan: Maçın Oyuncusu, haftalık hedefler, sezon sonu.', 'Watch an optional ad, or earn by playing: Man of the Match, weekly goals, end of season.'))}</p>
            <AdButton offer="gems" label={lt(L('İzle: +10💎', 'Watch: +10💎'))} busy={busy !== null} run={ad} />
          </Card>
        </div>
      )}

      {tab === 'gear' && (
        <div class="st-gear" data-testid="st-tab-gear">
          <p class="t-sm t-mid">{lt(L('Ekipman yalnızca antrenmanı hızlandırır (toplam en fazla +%25). Süre, oynadığın maçla düşer. Maçta hiçbir sayıya girmez.', 'Gear only speeds up training (+25% at most in total). It lasts a number of matches you play and never enters a match.'))}</p>
          {!s && <p class="t-mid">{errText('no_career')}</p>}
          {s?.hero.injury && s.hero.injury.weeksLeft > 1 && (
            <Card class="st-card st-physio" data-testid="st-physio">
              <h2 class="h4">🩺 {lt(L('Fizyoterapi Seansı', 'Physio Session'))}</h2>
              <p class="t-sm t-mid">{lt(L(`Sakatlığın kalan ${s.hero.injury.weeksLeft} haftası yarıya iner.`, `Halves the ${s.hero.injury.weeksLeft} weeks left on your injury.`))}</p>
              {(w?.physioDiscounts ?? 0) > 0 ? (
                <Button variant="primary" disabled={busy !== null} onClick={() => run('physio', () => buyPhysio(true))}>50💎 ({eur(50)})</Button>
              ) : (
                <>
                  <Button variant="primary" disabled={busy !== null || (w?.gems ?? 0) < PHYSIO_PRICE} onClick={() => run('physio', () => buyPhysio(false))} data-testid="buy-physio">{PHYSIO_PRICE}💎 ({eur(PHYSIO_PRICE)})</Button>
                  <AdButton offer="physio_disc" label={lt(L('İzle: yarı fiyat', 'Watch: half price'))} busy={busy !== null} run={ad} />
                </>
              )}
            </Card>
          )}
          <div class="st-grid">
            {GEAR.map((g) => {
              const left = gear.inv[g.id] ?? 0
              const on = gear.eq[g.slot] === g.id
              return (
                <Card key={g.id} class={`st-card${on ? ' st-on' : ''}`} data-testid={`gear-${g.id}`}>
                  <div class="st-big">{g.icon}</div>
                  <h2 class="h4">{lt(g.name)}</h2>
                  <p class="t-sm t-mid">{lt(g.desc)}</p>
                  <span class="t-xs t-lo">{lt(L(`${g.matches} maç · yuva: `, `${g.matches} matches · slot: `))}{lt(SLOT[g.slot])}</span>
                  {left > 0 && (
                    <div class="st-row">
                      <span class="t-sm" data-testid={`gear-left-${g.id}`}>{lt(L(`Kalan: ${left} maç`, `Left: ${left} matches`))}</span>
                      {on
                        ? <Button size="sm" variant="ghost" onClick={() => unequipGearAction(g.slot)}>{lt(L('Çıkar', 'Take off'))}</Button>
                        : <Button size="sm" variant="secondary" onClick={() => equipGearAction(g.id)} data-testid={`equip-${g.id}`}>{lt(L('Tak', 'Wear'))}</Button>}
                    </div>
                  )}
                  <Button variant="primary" block disabled={busy !== null || !s || (w?.gems ?? 0) < g.price} onClick={() => run(g.id, () => buyGear(g.id), L(`${g.icon} ${g.name.tr} alındı.`, `${g.icon} ${g.name.en} bought.`))} data-testid={`buy-gear-${g.id}`}>
                    {g.price}💎 <span class="t-xs">({eur(g.price)})</span>
                  </Button>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'cash' && (
        <div class="st-grid" data-testid="st-tab-cash">
          <p class="t-sm t-mid st-span">{lt(L('Para kariyer cüzdanına eklenir. Miktar güncel maaşınla büyür, fiyatı sabittir. Oyun içi para gerçek paraya çevrilemez.', 'Cash goes into your career wallet. The amount grows with your wage; the price stays the same. In-game money can never be turned into real money.'))}</p>
          {productsOfKind('cash').map((p) => (
            <Card key={p.id} class="st-card" data-testid={`pack-${p.id}`}>
              <div class="st-big">💶</div>
              <h2 class="h4">{lt(p.name)}</h2>
              {s && <p class="t-sm">{lt(L('Şu an: ', 'Right now: '))}<b>{lt(fmtMoney(cashGrantAmount(s, p.cashWeeks ?? 0, p.cashFloor ?? 0)))}</b></p>}
              <p class="t-xs t-lo">{lt(p.desc)}</p>
              {buyBtn(p)}
            </Card>
          ))}
          <Card class="st-card">
            <div class="st-big">💎→💶</div>
            <h2 class="h4">{lt(L('Elmas → Para', 'Diamonds → Cash'))}</h2>
            <p class="t-sm t-mid">{lt(L('100💎 = 2 haftalık maaş (en az €2.500).', '100💎 = 2 weeks’ wages (at least €2,500).'))}</p>
            <Button variant="primary" block disabled={busy !== null || !s || (w?.gems ?? 0) < 100} onClick={() => run('g2c', () => gemsToCash())} data-testid="gems-to-cash">100💎</Button>
          </Card>
        </div>
      )}

      {tab === 'cosmetic' && (
        <div class="st-grid" data-testid="st-tab-cosmetic">
          {COSMETIC_PRODUCTS.map((p) => (
            <Card key={p.id} class="st-card" data-testid={`pack-${p.id}`}>
              <PackArt id={p.id} />
              <h2 class="h3">{lt(p.name)}</h2>
              <p class="t-sm t-mid">{lt(p.desc)}</p>
              <span class="t-xs t-lo">{t('iap.store.cosmeticOnly')}</span>
              {buyBtn(p, hasEntitlement(p.id))}
            </Card>
          ))}
        </div>
      )}

      {tab === 'pro' && (
        <div class="st-grid" data-testid="st-tab-pro">
          {productsOfKind('pass').map((p) => (
            <Card key={p.id} class="st-card st-starter" data-testid={`pack-${p.id}`}>
              <div class="st-big">⭐</div>
              <h2 class="h3">{lt(p.name)}</h2>
              <p class="t-sm t-mid">{lt(p.desc)}</p>
              {w?.pass.active ? (
                <>
                  <span class="st-owned">{lt(L('Aktif · yenilenme: ', 'Active · renews: '))}{new Date(w.pass.until).toLocaleDateString()}</span>
                  <Button variant="primary" block disabled={busy !== null || !w.pass.claimable} onClick={() => run('pass', () => claimPassDaily(), L('+50💎', '+50💎'))} data-testid="pass-claim">
                    {w.pass.claimable ? lt(L('Bugünün 50💎’unu al', 'Claim today’s 50💎')) : lt(L('Bugünkü alındı', 'Claimed today'))}
                  </Button>
                </>
              ) : (
                <>
                  <p class="t-xs t-lo">{lt(L('Aylık yenilenir, App Store / Google Play hesabından istediğin an iptal edersin. Kaçırılan günün elması birikmez.', 'Renews monthly; cancel any time in your App Store / Google Play account. Missed days do not stack.'))}</p>
                  {buyBtn(p)}
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </Page>
  )
}

const SLOT: Record<GearSlot, LText> = {
  boots: L('krampon', 'boots'),
  accessory: L('aksesuar', 'accessory'),
  recovery: L('toparlanma', 'recovery'),
}
