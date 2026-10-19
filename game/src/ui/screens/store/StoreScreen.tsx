import { useEffect, useState } from 'preact/hooks'
import '../../../styles/screens/store.css'
import { t, lt, currentLang, locale } from '../../../i18n'
import { Avatar, Button, Card, Page, Tabs, toast } from '../../components'
import { Icon } from '../../icons'
import { gameState } from '../../store'
import type { Appearance, LText } from '../../../core/types'
import { GEAR, GEAR_XP_CAP, PHYSIO_PRICE, gearXpBonus, readGear, type GearSlot } from '../../../sim/career/gear'
import {
  COSMETIC_GEM_PRICE, COSMETIC_PRODUCTS, adsAvailable, hasEntitlement, loadProducts, productsOfKind, purchase, refreshWallet, retryUnredeemed, serverWallet, shopOffline, storeAvailable, storeReady, watchAd,
  type AdOffer, type ProductDef,
} from '../../../store-iap'
import { buyCosmeticWithGems, buyGear, buyPhysio, cashGrantAmount, claimPassDaily, equipGearAction, gemsToCash, physioUsedOnThisInjury, unequipGearAction } from '../../backend/shopBridge'
import { fmtMoney } from '../../../sim/career/common'

const FALLBACK_LOOK: Appearance = { skin: 2, hairStyle: 3, hairColor: 1, beard: 0, eyeColor: 1, face: 1, accessory: 0 }
const L = (tr: string, en: string): LText => ({ tr, en })
const num = (n: number): string => n.toLocaleString(locale())

/** Diamonds in euros at the most popular pack's rate (EU consumer rule: show the real-money value). */
const EUR_PER_GEM = 4.99 / 600
const eur = (gems: number): string => `≈ ${new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR' }).format(gems * EUR_PER_GEM)}`
const COSMETIC_GEMS = COSMETIC_GEM_PRICE

const ERR: Record<string, LText> = {
  offline: L('Mağaza sunucusuna ulaşılamadı. Ödeme alındıysa bağlantı gelince otomatik eklenir.', 'Could not reach the shop server. If you were charged, it is added automatically once you are back online.'),
  insufficient_gems: L('Yeterli elmasın yok.', 'Not enough diamonds.'),
  ad_cap: L('Bugünlük bu reklam hakkın doldu. Yarın yine gel.', 'You have used today’s ads for this. Come back tomorrow.'),
  dismissed: L('Reklam yarıda kapandı. Hakkın yanmadı.', 'The ad was closed early. Nothing was used up.'),
  failed: L('Şu an olmadı. Hakkın yanmadı, biraz sonra yine dene.', 'That did not work right now. Nothing was used up; try again in a moment.'),
  no_career: L('Önce bir kariyer başlat veya yükle.', 'Start or load a career first.'),
  not_injured: L('Fizyoterapi yalnızca 2 haftadan uzun sakatlıkta kullanılabilir.', 'Physio is only for an injury of more than 2 weeks.'),
  physio_used: L('Bu sakatlık için fizyoterapi zaten yapıldı.', 'You already had physio for this injury.'),
  already_claimed: L('Bugünkü elmasını zaten aldın.', 'You already claimed today’s diamonds.'),
  no_pass: L('Pro Sözleşme aktif değil.', 'Pro Contract is not active.'),
  rejected: L('Satın alma doğrulanamadı. Ödeme alındıysa mağaza iade eder veya bir sonraki açılışta yeniden denenir.', 'The purchase could not be verified. If you were charged, the store refunds it or it is retried on the next launch.'),
  cancelled: L('Satın alma iptal edildi.', 'Purchase cancelled.'),
  pending: L('Satın alma onay bekliyor (ör. aile onayı). Onaylanınca otomatik eklenir.', 'The purchase is waiting for approval (e.g. Ask to Buy). It is added automatically once approved.'),
  store_not_ready: L('Bu cihazda satın alma henüz açılmadı. Bedava elmaslar ve reklam ödülleri çalışıyor.', 'Purchases are not open on this device yet. Free diamonds and ad rewards work.'),
  unavailable: L('Bu ürün şu an satın alınamıyor.', 'This item cannot be bought right now.'),
  owned: L('Bu pakete zaten sahipsin.', 'You already own this pack.'),
  no_season_reward: L('Önce sezon sonu ödülü alınmalı.', 'The end-of-season reward comes first.'),
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

/** "Watch: …" with today's remaining count in words; hidden when ads are not available. */
function AdButton({ offer, label, busy, run }: { offer: AdOffer; label: LText; busy: boolean; run: (offer: AdOffer) => void }) {
  const w = serverWallet.value
  const cap = w?.ads[offer]
  const left = cap ? cap.max - cap.used : undefined
  if (!adsAvailable()) return null
  if (left === 0) return <p class="t-sm t-lo" data-testid={`ad-${offer}-done`}>{lt(L('Bugünkü reklam hakların bitti, yarın yenilenir.', 'Today’s ads are used up; they reset tomorrow.'))}</p>
  const pro = !!w?.pass.active
  return (
    <Button variant="secondary" icon="play" disabled={busy} aria-busy={busy} onClick={() => run(offer)} data-testid={`ad-${offer}`}>
      {lt(label)}
      {pro ? ` · ${lt(L('Pro: reklamsız', 'Pro: no ad'))}` : left !== undefined ? ` · ${lt(L(`bugün ${left}/${cap!.max}`, `today ${left}/${cap!.max}`))}` : ''}
    </Button>
  )
}

/** F2P shop: diamonds, gear, cash, cosmetics, Pro Contract. Nothing here changes a match result. */
export function StoreScreen() {
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('gems')
  void currentLang.value
  const w = serverWallet.value
  const s = gameState.value
  const gear = s ? readGear(s.life) : { inv: {}, eq: {} }
  const gems = w?.gems ?? 0

  useEffect(() => {
    void loadProducts().then((p) => setPrices(Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.priceString]))))
    // Opening the shop is the player's choice to go online with it (creates the anonymous account).
    void refreshWallet(true).then(() => retryUnredeemed())
  }, [])

  /** One toast per action that says what arrived; career grants announce themselves (shopBridge). */
  const run = async (key: string, fn: () => Promise<{ ok: boolean; reason?: string; error?: string }>, done?: (balance: number) => LText) => {
    setBusy(key)
    const r = await fn()
    setBusy(null)
    if (r.ok) {
      if (done) toast(lt(done(serverWallet.peek()?.gems ?? 0)), 'success')
    } else toast(errText(r.reason ?? r.error), 'info')
  }
  const balanceLine = (got: string) => (b: number) => L(`${got} · bakiye ${num(b)}💎`, `${got} · balance ${num(b)}💎`)
  const buy = (p: ProductDef) =>
    run(p.id, () => purchase(p.id), p.kind === 'gems' || p.kind === 'starter' ? balanceLine(`+${num(p.gems ?? 0)}💎`) : p.kind === 'cosmetic' || p.kind === 'pass' ? () => L(`${p.icon} ${p.name.tr}: aktif.`, `${p.icon} ${p.name.en}: active.`) : undefined)
  const ad = (offer: AdOffer) => run(`ad:${offer}`, () => watchAd(offer, { career: s?.meta.id }), offer === 'gems' ? balanceLine('+10💎') : offer === 'physio_disc' ? () => L('Fizyoterapi indirimi hazır: 50💎.', 'Physio discount ready: 50💎.') : undefined)
  const price = (p: ProductDef) => (prices[p.id] ? t('iap.store.buy', { price: prices[p.id]! }) : t('iap.store.buyNoPrice'))
  const can = storeAvailable()
  const ready = storeReady()

  const buyBtn = (p: ProductDef, owned = false) =>
    owned ? (
      <span class="st-owned">{t('iap.store.owned')}</span>
    ) : (
      <Button variant="primary" block disabled={busy !== null || !can || !ready} aria-busy={busy === p.id} onClick={() => buy(p)} data-testid={`buy-${p.id}`}>{price(p)}</Button>
    )
  const missing = (cost: number) => (gems < cost ? <span class="t-xs t-lo">{lt(L(`${num(cost - gems)}💎 eksik`, `${num(cost - gems)}💎 short`))}</span> : null)

  const tabs = [
    { id: 'gems' as const, label: lt(L('Elmas', 'Diamonds')), icon: 'star' as const },
    { id: 'gear' as const, label: lt(L('Ekipman', 'Gear')), icon: 'boot' as const },
    { id: 'cash' as const, label: lt(L('Nakit', 'Cash')), icon: 'coins' as const },
    { id: 'cosmetic' as const, label: lt(L('Stil', 'Style')), icon: 'party' as const },
    { id: 'pro' as const, label: 'Pro', icon: 'crown' as const },
  ]
  const bonusNow = s ? Math.round(Math.max(...(['physical', 'technical', 'mental', 'goalkeeping'] as const).map((g) => gearXpBonus(s.life, g))) * 100) : 0

  return (
    <Page title={t('iap.store.title')} sub={lt(L('Satın aldığın hiçbir şey maç sonucunu değiştirmez.', 'Nothing you buy changes a match result.'))} backTo="settings" showBack>
      <div class="st-wallet" data-testid="st-wallet" aria-live="polite">
        <span class="st-gems" data-testid="st-gems" aria-label={lt(L(`${num(gems)} elmas`, `${num(gems)} diamonds`))}>💎 {w ? num(w.gems) : '—'}</span>
        {w?.pass.active && <span class="st-pro">PRO</span>}
        {shopOffline.value && <span class="t-xs t-lo">{lt(L('Çevrimdışı: bakiye son bilinen değer.', 'Offline: last known balance.'))}</span>}
      </div>
      {!can && <p class="t-mid">{t('iap.store.noStore')}</p>}
      {can && !ready && <p class="t-sm t-mid" data-testid="st-not-ready">{errText('store_not_ready')}</p>}
      <Tabs items={tabs} value={tab} onChange={setTab} label={t('iap.store.title')} idPrefix="st" />

      {tab === 'gems' && (
        <div class="st-grid" data-testid="st-tab-gems">
          {productsOfKind('starter').map((p) => (
            <Card key={p.id} class="st-card st-starter" data-testid={`pack-${p.id}`}>
              <div class="st-big" aria-hidden="true">{p.icon}</div>
              <h2 class="h3">{lt(p.name)}</h2>
              <p class="t-sm t-mid">{lt(p.desc)}</p>
              {buyBtn(p, !!w?.starter)}
            </Card>
          ))}
          <Card class="st-card" data-testid="st-free">
            <h2 class="h4">{lt(L('Bedava elmas', 'Free diamonds'))}</h2>
            <p class="t-sm t-mid">{lt(L('Oynayarak kazan: Maçın Oyuncusu 5💎, haftalık hedef 5💎, başarım 10💎, sezon sonu 80💎, ödül ve kupa 25💎. İstersen reklam izle.', 'Earn by playing: Man of the Match 5💎, weekly goal 5💎, achievement 10💎, end of season 80💎, award or trophy 25💎. Or watch an optional ad.'))}</p>
            <AdButton offer="gems" label={L('İzle: +10💎', 'Watch: +10💎')} busy={busy !== null} run={ad} />
          </Card>
          {productsOfKind('gems').map((p) => (
            <Card key={p.id} class="st-card" data-testid={`pack-${p.id}`}>
              {p.badge && <span class="st-badge">{lt(p.badge === 'best' ? L('En iyi değer', 'Best value') : L('En popüler', 'Most popular'))}</span>}
              <div class="st-big" aria-hidden="true">💎</div>
              <h2 class="h3">{lt(p.name)}</h2>
              {buyBtn(p)}
            </Card>
          ))}
          <p class="t-xs t-lo st-span">{lt(L('Elmasın nakit değeri yoktur, devredilemez ve yasal haklar dışında iade edilmez. Tüketilen paketler (elmas, nakit) geri yüklenmez; iade edilen satın almanın elmasları bakiyeden düşülür. "≈ €" değerleri 600 elmas paketinin fiyatına göredir.', 'Diamonds have no cash value, cannot be transferred and are not refundable except where the law requires. Consumable packs (diamonds, cash) are not restored; diamonds from a refunded purchase are taken back. "≈ €" values use the 600-diamond pack’s price.'))}</p>
        </div>
      )}

      {tab === 'gear' && (
        <div class="st-gear" data-testid="st-tab-gear">
          <p class="t-sm t-mid">{lt(L(`Ekipman yalnızca antrenmanda kazandığın XP’yi artırır; maçta hiçbir sayıya girmez. Toplam en fazla +%${Math.round(GEAR_XP_CAP * 100)} (şu an +%${bonusNow}). Süresi oynadığın maçla düşer ve bu kariyere aittir. Ölçüm: 5 sezonda yaklaşık 2 OVR daha hızlı gelişim.`, `Gear only raises the XP you earn in training; it never enters a match. +${Math.round(GEAR_XP_CAP * 100)}% at most in total (now +${bonusNow}%). It lasts a number of matches you play and belongs to this career. Measured: about 2 OVR faster growth over 5 seasons.`))}</p>
          {!s && <p class="t-mid">{errText('no_career')}</p>}
          {s?.hero.injury && s.hero.injury.weeksLeft > 1 && (
            <Card class="st-card st-physio" data-testid="st-physio">
              <h2 class="h4">🩺 {lt(L('Fizyoterapi Seansı', 'Physio Session'))}</h2>
              <p class="t-sm t-mid">{lt(L(`Sakatlığın kalan ${s.hero.injury.weeksLeft} haftası yarıya iner. Sakatlık başına bir kez.`, `Halves the ${s.hero.injury.weeksLeft} weeks left on your injury. Once per injury.`))}</p>
              {physioUsedOnThisInjury(s) ? (
                <span class="st-owned">{errText('physio_used')}</span>
              ) : (w?.physioDiscounts ?? 0) > 0 ? (
                <Button variant="primary" disabled={busy !== null || gems < 50} onClick={() => run('physio', () => buyPhysio(true))} data-testid="buy-physio-disc">50💎 ({eur(50)})</Button>
              ) : (
                <>
                  <Button variant="primary" disabled={busy !== null || gems < PHYSIO_PRICE} onClick={() => run('physio', () => buyPhysio(false))} data-testid="buy-physio">{PHYSIO_PRICE}💎 ({eur(PHYSIO_PRICE)})</Button>
                  {missing(PHYSIO_PRICE)}
                  <AdButton offer="physio_disc" label={L('İzle: yarı fiyat', 'Watch: half price')} busy={busy !== null} run={ad} />
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
                  <div class="st-big" aria-hidden="true">{g.icon}</div>
                  <h2 class="h4">{lt(g.name)}</h2>
                  <p class="t-sm t-mid">{lt(g.desc)}</p>
                  <span class="t-xs t-lo">{lt(L(`${g.matches} maç · tür: `, `${g.matches} matches · type: `))}{lt(SLOT[g.slot])}</span>
                  {left > 0 && (
                    <div class="st-row">
                      <span class="t-sm" data-testid={`gear-left-${g.id}`}>{lt(L(`Kalan: ${left} maç`, `Left: ${left} ${left === 1 ? 'match' : 'matches'}`))}</span>
                      {on
                        ? <Button size="sm" variant="ghost" onClick={() => unequipGearAction(g.slot)}>{lt(L('Çıkar', 'Take off'))}</Button>
                        : <Button size="sm" variant="secondary" onClick={() => equipGearAction(g.id)} data-testid={`equip-${g.id}`}>{lt(L('Tak', 'Wear'))}</Button>}
                    </div>
                  )}
                  <Button variant="primary" block disabled={busy !== null || !s || gems < g.price} aria-busy={busy === g.id} onClick={() => run(g.id, () => buyGear(g.id))} data-testid={`buy-gear-${g.id}`}>
                    {num(g.price)}💎 <span class="t-xs">({eur(g.price)})</span>
                  </Button>
                  {missing(g.price)}
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'cash' && (
        <div class="st-grid" data-testid="st-tab-cash">
          <p class="t-sm t-mid st-span">{lt(L('Nakit kariyer cüzdanına eklenir. Miktar güncel maaşınla büyür (paket başına bir üst sınırla), fiyatı sabittir. Oyun içi para gerçek paraya çevrilemez. Kumarhane de bu parayı kullanır.', 'Cash goes into your career wallet. The amount grows with your wage (up to a ceiling per pack); the price stays the same. In-game money can never be turned into real money. The casino uses this money too.'))}</p>
          {productsOfKind('cash').map((p) => (
            <Card key={p.id} class="st-card" data-testid={`pack-${p.id}`}>
              <div class="st-big" aria-hidden="true">💶</div>
              <h2 class="h4">{lt(p.name)}</h2>
              {s && <p class="t-sm">{lt(L('Şu an: ', 'Right now: '))}<b>{lt(fmtMoney(cashGrantAmount(s, p.cashWeeks ?? 0, p.cashFloor ?? 0, p.cashCap ?? Infinity)))}</b></p>}
              <p class="t-xs t-lo">{lt(p.desc)}</p>
              {buyBtn(p)}
            </Card>
          ))}
          <Card class="st-card">
            <div class="st-big" aria-hidden="true">💎→💶</div>
            <h2 class="h4">{lt(L('Elmas → Nakit', 'Diamonds → Cash'))}</h2>
            <p class="t-sm t-mid">{lt(L('100💎 = 2 haftalık maaş (en az €2.500, en çok €25.000). Günde 3 kez.', '100💎 = 2 weeks’ wages (€2,500 to €25,000). 3 times a day.'))}</p>
            <Button variant="primary" block disabled={busy !== null || !s || gems < 100 || w?.limits?.gemsToCashLeft === 0} onClick={() => run('g2c', () => gemsToCash())} data-testid="gems-to-cash">100💎</Button>
            {missing(100)}
          </Card>
        </div>
      )}

      {tab === 'cosmetic' && (
        <div class="st-grid" data-testid="st-tab-cosmetic">
          {COSMETIC_PRODUCTS.map((p) => {
            const owned = hasEntitlement(p.id)
            return (
              <Card key={p.id} class="st-card" data-testid={`pack-${p.id}`}>
                <PackArt id={p.id} />
                <h2 class="h3">{lt(p.name)}</h2>
                <p class="t-sm t-mid">{lt(p.desc)}</p>
                <span class="t-xs t-lo">{t('iap.store.cosmeticOnly')}</span>
                {buyBtn(p, owned)}
                {!owned && (
                  <Button variant="secondary" block disabled={busy !== null || gems < COSMETIC_GEMS} onClick={() => run(`cos:${p.id}`, () => buyCosmeticWithGems(p.id as 'pack_celebrations' | 'pack_avatar'), () => L(`${p.icon} ${p.name.tr}: açıldı.`, `${p.icon} ${p.name.en}: unlocked.`))} data-testid={`buy-gems-${p.id}`}>
                    {lt(L(`veya ${COSMETIC_GEMS}💎`, `or ${COSMETIC_GEMS}💎`))}
                  </Button>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {tab === 'pro' && (
        <div class="st-grid" data-testid="st-tab-pro">
          {productsOfKind('pass').map((p) => (
            <Card key={p.id} class="st-card st-starter" data-testid={`pack-${p.id}`}>
              <div class="st-big" aria-hidden="true">⭐</div>
              <h2 class="h3">{lt(p.name)}</h2>
              <p class="t-sm t-mid">{lt(p.desc)}</p>
              {w?.pass.active ? (
                <>
                  <span class="st-owned">{lt(L('Aktif · şu tarihe kadar: ', 'Active until: '))}{new Date(w.pass.until).toLocaleDateString(locale())}</span>
                  <Button variant="primary" block disabled={busy !== null || !w.pass.claimable} onClick={() => run('pass', () => claimPassDaily(), balanceLine('+50💎'))} data-testid="pass-claim">
                    {w.pass.claimable ? lt(L('Bugünkü 50 elmasını al', 'Claim today’s 50 diamonds')) : lt(L('Bugünkü alındı, yarın yine', 'Claimed today, back tomorrow'))}
                  </Button>
                </>
              ) : (
                <>
                  <p class="t-sm" data-testid="pro-terms">
                    {lt(L(
                      `Aylık abonelik: ${prices[p.id] ?? p.fallbackPrice} / ay. Dönem bitmeden en az 24 saat önce iptal edilmezse otomatik yenilenir; ödeme App Store / Google Play hesabından alınır. Aboneliği cihazının mağaza ayarlarından yönetir ve iptal edersin.`,
                      `Monthly subscription: ${prices[p.id] ?? p.fallbackPrice} / month. It renews automatically unless cancelled at least 24 hours before the period ends; payment is charged to your App Store / Google Play account. Manage or cancel it in your device's store settings.`,
                    ))}
                  </p>
                  {buyBtn(p)}
                </>
              )}
              <p class="t-xs">
                <a href={`./legal/terms-${currentLang.value === 'tr' ? 'tr' : 'en'}.html`} target="_blank" rel="noopener">{t('iap.legal.terms')}</a>
                {' · '}
                <a href={`./legal/privacy-${currentLang.value === 'tr' ? 'tr' : 'en'}.html`} target="_blank" rel="noopener">{t('iap.legal.privacy')}</a>
              </p>
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
