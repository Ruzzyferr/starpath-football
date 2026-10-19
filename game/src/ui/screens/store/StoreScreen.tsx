import { useEffect, useState } from 'preact/hooks'
import '../../../styles/screens/store.css'
import { t, lt, currentLang, locale } from '../../../i18n'
import { Avatar, Button, Card, Page, Tabs, toast } from '../../components'
import { Icon } from '../../icons'
import { gameState } from '../../store'
import type { Appearance, LText } from '../../../core/types'
import { GEAR, GEAR_XP_CAP, PHYSIO_PRICE, gearXpBonus, readGear, type GearSlot } from '../../../sim/career/gear'
import {
  AD_GEMS, COSMETIC_GEM_PRICE, COSMETIC_PRODUCTS, EARN_GEMS, PHYSIO_DISCOUNT_PRICE, adsAvailable, hasEntitlement, loadProducts, productsOfKind, purchase, refreshWallet, restorePurchases, retryUnredeemed, serverWallet, shopOffline, storeAvailable, storeReady, watchAd,
  type AdOffer, type ProductDef,
} from '../../../store-iap'
import { CASH_PER_SEASON, boughtCashThisSeason, buyCosmeticWithGems, buyGear, buyPhysio, cashGrantAmount, claimPassDaily, equipGearAction, gemsToCash, physioUsedOnThisInjury, unequipGearAction } from '../../backend/shopBridge'
import { LegalLinksInline } from './LegalModal'
import { AgeQuestionInline, isAdultPlayer } from '../../ageGate'
import { detectPlatform } from '../../../platform/detect'
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
  nothing: L('Geri yüklenecek satın alım bulunamadı.', 'No purchases found to restore.'),
  pending: L('Satın alma onay bekliyor (ör. aile onayı). Onaylanınca otomatik eklenir.', 'The purchase is waiting for approval (e.g. Ask to Buy). It is added automatically once approved.'),
  store_not_ready: L('Bu cihazda satın alma henüz açılmadı. Bedava elmaslar ve reklam ödülleri çalışıyor.', 'Purchases are not open on this device yet. Free diamonds and ad rewards work.'),
  unavailable: L('Bu ürün şu an satın alınamıyor.', 'This item cannot be bought right now.'),
  owned: L('Bu pakete zaten sahipsin.', 'You already own this pack.'),
  no_season_reward: L('Önce sezon sonu ödülü alınmalı.', 'The end-of-season reward comes first.'),
  spend_cap: L('Bugünlük bu işlemin hakkı doldu, yarın yenilenir.', 'That is used up for today; it resets tomorrow.'),
  rate_limited: L('Çok hızlı denendi. Birkaç saniye sonra yine dene.', 'Too many tries. Try again in a few seconds.'),
  no_discount: L('Önce indirim reklamını izlemelisin.', 'Watch the discount ad first.'),
  sandbox_cap: L('Test satın alma sınırına ulaşıldı.', 'The test-purchase limit was reached.'),
  play_not_configured: L('Bu cihazda satın alma henüz açılmadı.', 'Purchases are not open on this device yet.'),
  ad_too_short: L('Reklam tamamlanmadı. Hakkın yanmadı.', 'The ad did not finish. Nothing was used up.'),
  too_many_open_ads: L('Birkaç reklam yarım kaldı. Birkaç dakika sonra yine dene.', 'A few ads were left unfinished. Try again in a few minutes.'),
  pending_reward: L('Reklamı izledin; ödül bağlantı gelince otomatik eklenecek.', 'You watched the ad; the reward is added automatically once you are back online.'),
  refund_hold: L('İade edilen bir satın alma yüzünden harcama ve reklam ödülleri şimdilik durdu.', 'Spending and ad rewards are paused because of a refunded purchase.'),
  cash_season_cap: L(`Bu sezonun nakit satın alma sınırına ulaştın (${fmtMoney(CASH_PER_SEASON).tr}). Yeni sezonda açılır.`, `You reached this season’s cash purchase limit (${fmtMoney(CASH_PER_SEASON).en}). It opens again next season.`),
  adult_only: L('Nakit satın almak 18 yaş ve üstü içindir.', 'Buying cash is for players 18 and over.'),
  family_shared: L('Aile Paylaşımı ile gelen satın alımlar elmas/nakit olarak eklenmez.', 'Purchases shared through Family Sharing are not added as diamonds or cash.'),
  purchase_pending: L('Ödeme henüz tamamlanmadı; tamamlanınca otomatik eklenir.', 'The payment is not complete yet; it is added automatically once it is.'),
  play_unavailable: L('Google Play şu an doğrulanamadı; ödeme otomatik yeniden denenir.', 'Google Play could not be reached; the payment is retried automatically.'),
  keeper_only: L('Bu eldiven yalnızca kaleciler için.', 'These gloves are for goalkeepers only.'),
}
/** Outside ad flows the fallback must not promise "nothing was used up". */
const errNeutral = (code: string | undefined): string => (code && ERR[code] ? lt(ERR[code]!) : lt(L('İşlem tamamlanamadı. Biraz sonra yine dene.', 'That did not go through. Try again in a moment.')))
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
      {pro ? ` · ${lt(L('Pro: reklamsız', 'Pro: no ad'))}` : left !== undefined ? ` · ${lt(L(`bugün ${left} hak`, `${left} left today`))}` : ''}
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
  const cashLeft = s ? Math.max(0, CASH_PER_SEASON - boughtCashThisSeason(s)) : 0

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
    } else toast(key.startsWith('ad:') ? errText(r.reason ?? r.error) : errNeutral(r.reason ?? r.error), 'info')
  }
  const balanceLine = (got: string) => (b: number) => L(`${got} · bakiye ${num(b)}💎`, `${got} · balance ${num(b)}💎`)
  const buy = (p: ProductDef) =>
    run(p.id, () => purchase(p.id), p.kind === 'gems' || p.kind === 'starter' ? balanceLine(`+${num(p.gems ?? 0)}💎`) : p.kind === 'cosmetic' || p.kind === 'pass' ? () => L(`${p.icon} ${p.name.tr}: aktif.`, `${p.icon} ${p.name.en}: active.`) : undefined)
  const ad = (offer: AdOffer) => run(`ad:${offer}`, () => watchAd(offer, { career: s?.meta.id }), offer === 'gems' ? balanceLine(`+${AD_GEMS}💎`) : offer === 'physio_disc' ? () => L(`Fizyoterapi indirimi hazır: ${PHYSIO_DISCOUNT_PRICE}💎.`, `Physio discount ready: ${PHYSIO_DISCOUNT_PRICE}💎.`) : undefined)
  const price = (p: ProductDef) => (prices[p.id] ? t('iap.store.buy', { price: prices[p.id]! }) : t('iap.store.buyNoPrice'))
  /** Store-localised price when the store gave one; otherwise none (never the euro fallback as a price). */
  const priceText = (p: ProductDef) => prices[p.id] ?? lt(L('mağaza fiyatı', 'store price'))
  const can = storeAvailable()
  const android = detectPlatform() === 'android'
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
    <Page title={t('iap.store.title')} sub={lt(L('Satın aldığın hiçbir şey maç motoruna girmez.', 'Nothing you buy enters the match engine.'))} backTo="settings" showBack>
      <div class="st-wallet" data-testid="st-wallet">
        <span class="st-gems" data-testid="st-gems" role="status" aria-live="polite"><span aria-hidden="true">💎 </span>{w ? num(w.gems) : '—'}<span class="sr-only">{lt(L(' elmas', ' diamonds'))}</span></span>
        {w?.pass.active && <span class="st-pro">PRO</span>}
        {shopOffline.value && <span class="t-xs t-lo">{lt(L('Çevrimdışı: bakiye son bilinen değer.', 'Offline: last known balance.'))}</span>}
      </div>
      {!can && <p class="t-mid">{t('iap.store.noStore')}</p>}
      {can && !ready && <p class="t-sm t-mid" data-testid="st-not-ready">{errText('store_not_ready')}</p>}
      {w?.refundHold && <p class="t-sm" data-testid="st-refund-hold">{errText('refund_hold')}</p>}
      <div class="st-tabs"><Tabs items={tabs} value={tab} onChange={setTab} label={t('iap.store.title')} idPrefix="st" panels /></div>

      {tab === 'gems' && (
        <div class="st-grid" data-testid="st-tab-gems" role="tabpanel" id="st-gems-panel" aria-labelledby="st-gems">
          {productsOfKind('starter').map((p) => (
            <Card key={p.id} class="st-card st-starter" data-testid={`pack-${p.id}`}>
              <div class="st-big" aria-hidden="true">{p.icon}</div>
              <h2 class="h3">{lt(p.name)}</h2>
              <p class="t-sm t-mid">{lt(p.desc)}</p>
              <span class="t-xs t-lo">{lt(L('Altın Krampon o an açık olan kariyerine gider; elmaslar hesabında kalır.', 'The Golden Boots go to the career you have open; the diamonds stay in your account.'))}</span>
              {buyBtn(p, !!w?.starter)}
            </Card>
          ))}
          <Card class="st-card" data-testid="st-free">
            <h2 class="h4">{lt(L('Bedava elmas', 'Free diamonds'))}</h2>
            <p class="t-sm t-mid">{lt(L(`Oynayarak kazan: Maçın Oyuncusu ${EARN_GEMS.motm}💎, haftalık hedef ${EARN_GEMS.objective}💎, başarım ${EARN_GEMS.first}💎, sezon sonu ${EARN_GEMS.season}💎, ödül ve kupa ${EARN_GEMS.award}💎 (günde en çok 300💎; fazlası ertesi gün gelir). İstersen reklam izle.`, `Earn by playing: Man of the Match ${EARN_GEMS.motm}💎, weekly goal ${EARN_GEMS.objective}💎, achievement ${EARN_GEMS.first}💎, end of season ${EARN_GEMS.season}💎, award or trophy ${EARN_GEMS.award}💎 (300💎 a day at most; the rest arrives the next day). Or watch an optional ad.`))}</p>
            <AdButton offer="gems" label={L(`İzle: +${AD_GEMS}💎`, `Watch: +${AD_GEMS}💎`)} busy={busy !== null} run={ad} />
          </Card>
          {productsOfKind('gems').map((p) => (
            <Card key={p.id} class="st-card" data-testid={`pack-${p.id}`}>
              {p.badge && <span class="st-badge">{lt(p.badge === 'best' ? L('En iyi değer', 'Best value') : L('En popüler', 'Most popular'))}</span>}
              <div class="st-big" aria-hidden="true">💎</div>
              <h2 class="h3">{lt(p.name)}</h2>
              {packBonus(p) > 0 && <span class="st-badge st-badge-value">{lt(L(`+%${packBonus(p)} elmas`, `+${packBonus(p)}% diamonds`))}</span>}
              {buyBtn(p)}
            </Card>
          ))}
          <p class="t-sm t-mid st-span">{lt(L('Elmasın nakit değeri yoktur, devredilemez ve yasal haklar dışında iade edilmez. Tüketilen paketler (elmas, nakit) geri yüklenmez; iade edilen satın almanın elmasları bakiyeden düşülür. "≈ €" değerleri 600 elmas paketinin fiyatına göredir.', 'Diamonds have no cash value, cannot be transferred and are not refundable except where the law requires. Consumable packs (diamonds, cash) are not restored; diamonds from a refunded purchase are taken back. "≈ €" values use the 600-diamond pack’s price.'))}</p>
        </div>
      )}

      {tab === 'gear' && (
        <div class="st-gear" data-testid="st-tab-gear" role="tabpanel" id="st-gear-panel" aria-labelledby="st-gear">
          <p class="t-sm t-mid">{lt(L(`Ekipman yalnızca antrenmanda gelişimini hızlandırır, maçta hiçbir şeyi değiştirmez. Toplam en fazla +%${Math.round(GEAR_XP_CAP * 100)} (şu an +%${bonusNow}). Oynadığın her maçta 1 kullanım azalır; bu kariyerine aittir. Etkisi: 5 sezonda yaklaşık 2 puan daha hızlı gelişim.`, `Gear only speeds up your training; it changes nothing in a match. +${Math.round(GEAR_XP_CAP * 100)}% at most in total (now +${bonusNow}%). Each match you play uses one; it belongs to this career. Effect: about 2 rating points faster growth over 5 seasons.`))}</p>
          {!s && <p class="t-mid">{errText('no_career')}</p>}
          {s?.hero.injury && s.hero.injury.weeksLeft > 1 && (
            <Card class="st-card st-physio" data-testid="st-physio">
              <h2 class="h4">🩺 {lt(L('Fizyoterapi Seansı', 'Physio Session'))}</h2>
              <p class="t-sm t-mid">{lt(L(`Sakatlığın kalan ${s.hero.injury.weeksLeft} haftası yarıya iner. Sakatlık başına bir kez.`, `Halves the ${s.hero.injury.weeksLeft} weeks left on your injury. Once per injury.`))}</p>
              {physioUsedOnThisInjury(s) ? (
                <span class="st-owned">{errText('physio_used')}</span>
              ) : (w?.physioDiscounts ?? 0) > 0 ? (
                <Button variant="primary" disabled={busy !== null || gems < PHYSIO_DISCOUNT_PRICE} onClick={() => run('physio', () => buyPhysio(true))} data-testid="buy-physio-disc">{PHYSIO_DISCOUNT_PRICE}💎 ({eur(PHYSIO_DISCOUNT_PRICE)})</Button>
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
            {GEAR.filter((g) => g.xpGroup?.group !== 'goalkeeping' || s?.hero.position === 'GK').map((g) => {
              const left = gear.inv[g.id] ?? 0
              const on = gear.eq[g.slot] === g.id
              const gain = s ? effectiveGain(s.life, g.id) : null
              return (
                <Card key={g.id} class={`st-card${on ? ' st-on' : ''}`} data-testid={`gear-${g.id}`}>
                  <div class="st-big" aria-hidden="true">{g.icon}</div>
                  <h2 class="h4">{lt(g.name)}</h2>
                  <p class="t-sm t-mid">{lt(g.desc)}</p>
                  <span class="t-xs t-lo">{lt(L(`${g.matches} maç sürer · `, `lasts ${g.matches} matches · `))}{lt(SLOT[g.slot])}</span>
                  {gain !== null && !on && <span class="t-xs" data-testid={`gear-gain-${g.id}`}>{lt(gain > 0 ? L(`Takarsan toplam bonus: +%${gain}`, `If worn, total bonus: +${gain}%`) : L('Tavanda: ek kazanç yok', 'At the cap: no extra gain'))}</span>}
                  {left > 0 && left <= 5 && <span class="t-xs t-gold">{lt(L(`Son ${left} maç`, `${left} ${left === 1 ? 'match' : 'matches'} left`))}</span>}
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

      {tab === 'cash' && !isAdultPlayer() && (
        <div class="st-grid" data-testid="st-tab-cash-age" role="tabpanel" id="st-cash-panel" aria-labelledby="st-cash">
          <p class="t-sm t-mid st-span">{errText('adult_only')}</p>
          <AgeQuestionInline />
        </div>
      )}
      {tab === 'cash' && isAdultPlayer() && (
        <div class="st-grid" data-testid="st-tab-cash" role="tabpanel" id="st-cash-panel" aria-labelledby="st-cash">
          {s && <p class="t-sm st-span" data-testid="cash-season-left">{lt(L(`Bu sezon kalan nakit satın alma hakkı: `, `Cash you can still buy this season: `))}<b>{lt(fmtMoney(cashLeft))}</b></p>}
          <p class="t-sm t-mid st-span">{lt(L('Nakit kariyer cüzdanına eklenir. Miktar güncel maaşınla büyür (paket başına bir üst sınırla), fiyatı sabittir. Oyun içi para gerçek paraya çevrilemez. Not: Yaşam › Kumarhane (18+) de bu parayı kullanır.', 'Cash goes into your career wallet. The amount grows with your wage (up to a ceiling per pack); the price stays the same. In-game money can never be turned into real money. Note: Life › Casino (18+) uses this money too.'))}</p>
          {productsOfKind('cash').map((p) => (
            <Card key={p.id} class="st-card" data-testid={`pack-${p.id}`}>
              <div class="st-big" aria-hidden="true">💶</div>
              <h2 class="h4">{lt(p.name)}</h2>
              {s && <p class="t-sm">{lt(L('Şu an: ', 'Right now: '))}<b>{lt(fmtMoney(Math.min(cashLeft, cashGrantAmount(s, p.cashWeeks ?? 0, p.cashFloor ?? 0, p.cashCap ?? Infinity))))}</b></p>}
              <p class="t-xs t-lo">{lt(p.desc)}</p>
              {cashLeft <= 0 ? <span class="t-sm">{errText('cash_season_cap')}</span> : buyBtn(p)}
            </Card>
          ))}
          <Card class="st-card">
            <div class="st-big" aria-hidden="true">💎→💶</div>
            <h2 class="h4">{lt(L('Elmas → Nakit', 'Diamonds → Cash'))}</h2>
            <p class="t-sm t-mid">{lt(L('100💎 = 2 haftalık maaş (en az €2.500, en çok €25.000). Günde 3 kez.', '100💎 = 2 weeks’ wages (€2,500 to €25,000). 3 times a day.'))}</p>
            <Button variant="primary" block disabled={busy !== null || !s || gems < 100 || w?.limits?.gemsToCashLeft === 0 || cashLeft <= 0} onClick={() => run('g2c', () => gemsToCash())} data-testid="gems-to-cash">100💎 <span class="t-xs">({eur(100)})</span></Button>
            {missing(100)}
          </Card>
        </div>
      )}

      {tab === 'cosmetic' && (
        <div class="st-grid" data-testid="st-tab-cosmetic" role="tabpanel" id="st-cosmetic-panel" aria-labelledby="st-cosmetic">
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
                    {lt(L(`veya ${COSMETIC_GEMS}💎`, `or ${COSMETIC_GEMS}💎`))} <span class="t-xs">({eur(COSMETIC_GEMS)})</span>
                  </Button>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {tab === 'pro' && (
        <div class="st-grid" data-testid="st-tab-pro" role="tabpanel" id="st-pro-panel" aria-labelledby="st-pro">
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
                      `Aylık abonelik: ${priceText(p)} / ay. Dönem bitmeden en az 24 saat önce iptal edilmezse otomatik yenilenir; ödeme ${android ? 'Google Play' : 'App Store'} hesabından alınır. ${android ? 'Google Play › Ödemeler ve abonelikler' : 'Ayarlar › Apple Kimliği › Abonelikler'} bölümünden yönetebilir ve iptal edebilirsin.`,
                      `Monthly subscription: ${priceText(p)} / month. It renews automatically unless cancelled at least 24 hours before the period ends; payment is charged to your ${android ? 'Google Play' : 'App Store'} account. Manage or cancel it in ${android ? 'Google Play › Payments & subscriptions' : 'Settings › Apple ID › Subscriptions'}.`,
                    ))}
                  </p>
                  {buyBtn(p)}
                </>
              )}
              <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => run('restore', async () => ({ ok: (await restorePurchases()).length > 0, reason: 'nothing' }), () => L('Satın alımların geri yüklendi.', 'Your purchases were restored.'))} data-testid="pro-restore">{lt(L('Satın alımları geri yükle', 'Restore purchases'))}</Button>
              <LegalLinksInline testId="pro-legal" />
            </Card>
          ))}
        </div>
      )}
    </Page>
  )
}

/** Extra diamonds per euro compared with the smallest pack (fallback prices), rounded. */
function packBonus(p: ProductDef): number {
  const base = productsOfKind('gems')[0]
  const eurOf = (x: ProductDef) => Number(x.fallbackPrice.replace(/[^0-9.]/g, ''))
  if (!base || p.id === base.id || !p.gems || !base.gems) return 0
  return Math.round(((p.gems / eurOf(p)) / (base.gems / eurOf(base)) - 1) * 100)
}

/** Total gear bonus (%) the hero would have with this item worn in its slot, after the +25% cap. */
function effectiveGain(life: Parameters<typeof readGear>[0], id: string): number | null {
  const def = GEAR.find((g) => g.id === id)
  if (!def) return null
  const groups = ['physical', 'technical', 'mental', 'goalkeeping'] as const
  const now = Math.max(...groups.map((g) => gearXpBonus(life, g)))
  const cur = readGear(life)
  const trial = { flags: { ...life.flags, 'g:gear': JSON.stringify({ inv: { ...cur.inv, [id]: def.matches }, eq: { ...cur.eq, [def.slot]: id } }) } }
  const after = Math.max(...groups.map((g) => gearXpBonus(trial, g)))
  return after > now ? Math.round(after * 100) : 0
}

const SLOT: Record<GearSlot, LText> = {
  boots: L('krampon', 'boots'),
  accessory: L('aksesuar', 'accessory'),
  recovery: L('toparlanma', 'recovery'),
}
