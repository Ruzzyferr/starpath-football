import { useEffect, useState } from 'preact/hooks'
import '../../../styles/screens/store.css'
import { t, lt, currentLang, locale } from '../../../i18n'
import { Avatar, Button, Card, Page, Tabs, toast } from '../../components'
import { Icon } from '../../icons'
import { gameState } from '../../store'
import type { Appearance, LText } from '../../../core/types'
import { GEAR, GEAR_STAT_CAP, GEAR_TIERS, GEAR_TIER_ORDER, GEAR_BY_ID, PHYSIO_PRICE, equippedGear, gearStatBonus, isKeeperGear, readGear, statBonusOf, type GearDef, type GearSlot } from '../../../sim/career/gear'
import type { AttributeKey, Attributes } from '../../../core/types'
import {
  AD_GEMS, COSMETIC_GEM_PRICE, COSMETIC_PRODUCTS, EARN_GEMS, EARN_PER_DAY, GEMS_TO_CASH, PHYSIO_DISCOUNT_PRICE, PRO_DAILY_GEMS, adsAvailable, hasEntitlement, loadProducts, productsOfKind, purchase, refreshWallet, restorePurchases, retryUnredeemed, serverWallet, shopOffline, storeAvailable, storeReady, watchAd,
  type AdOffer, type ProductDef,
} from '../../../store-iap'
import { CASH_PER_SEASON, boughtCashThisSeason, buyCosmeticWithGems, buyGear, buyGearWithCashAction, buyPhysio, cashGrantAmount, claimPassDaily, equipGearAction, gemsToCash, physioUsedOnThisInjury, unequipGearAction } from '../../backend/shopBridge'
import { LegalLinksInline } from './LegalModal'
import { AgeQuestionInline, birthYear, isAdultPlayer } from '../../ageGate'
import { adErrText as errText, shopErrText as errNeutral } from './errors'
import { detectPlatform } from '../../../platform/detect'
import { fmtMoney } from '../../../sim/career/common'

const FALLBACK_LOOK: Appearance = { skin: 2, hairStyle: 3, hairColor: 1, beard: 0, eyeColor: 1, face: 1, accessory: 0 }
const L = (tr: string, en: string): LText => ({ tr, en })
const num = (n: number): string => n.toLocaleString(locale())

/** Diamonds in euros at the most popular pack's rate (EU consumer rule: show the real-money value). */
const EUR_PER_GEM = 4.99 / 600
const eur = (gems: number): string => `≈ ${new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR' }).format(gems * EUR_PER_GEM)}`
const COSMETIC_GEMS = COSMETIC_GEM_PRICE

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

/** F2P shop: diamonds, gear, cash, cosmetics, Pro Contract. Gear gives small, capped stat boosts (career/gear). */
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
  /** Cash (packs and diamonds → cash) is 18+: checked on the action too, not only by the tab. */
  const adultOnly = <T,>(fn: () => Promise<T>) => (): Promise<T | { ok: false; reason: string }> => (isAdultPlayer() ? fn() : Promise.resolve({ ok: false as const, reason: 'adult_only' }))
  const buy = (p: ProductDef) =>
    run(p.id, p.kind === 'cash' ? adultOnly(() => purchase(p.id)) : () => purchase(p.id), p.kind === 'gems' || p.kind === 'starter' ? balanceLine(`+${num(p.gems ?? 0)}💎`) : p.kind === 'cosmetic' || p.kind === 'pass' ? () => L(`${p.icon} ${p.name.tr}: aktif.`, `${p.icon} ${p.name.en}: active.`) : undefined)
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
  const gk = s?.hero.position === 'GK'
  const money = s?.life.money ?? 0
  const buyCash = (g: GearDef) => {
    const r = buyGearWithCashAction(g.id)
    toast(lt(r.line), r.ok ? 'success' : 'info')
  }

  return (
    <Page title={t('iap.store.title')} sub={lt(L(`Ekipman küçük ve sınırlı stat artışı verir (stat başına en fazla +${GEAR_STAT_CAP}); kariyer parasıyla ya da ödüllerle oyunda da kazanılır.`, `Equipment gives small, capped stat boosts (+${GEAR_STAT_CAP} max per stat) and can be earned in-game with career money or rewards.`))} backTo="settings" showBack>
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
            <p class="t-sm t-mid">{lt(L(`Oynayarak kazan: Maçın Oyuncusu ${EARN_GEMS.motm}💎, haftalık hedef ${EARN_GEMS.objective}💎, başarım ${EARN_GEMS.first}💎, sezon sonu ${EARN_GEMS.season}💎, ödül ve kupa ${EARN_GEMS.award}💎 (günde en çok ${EARN_PER_DAY}💎; fazlası ertesi gün gelir). İstersen reklam izle.`, `Earn by playing: Man of the Match ${EARN_GEMS.motm}💎, weekly goal ${EARN_GEMS.objective}💎, achievement ${EARN_GEMS.first}💎, end of season ${EARN_GEMS.season}💎, award or trophy ${EARN_GEMS.award}💎 (${EARN_PER_DAY}💎 a day at most; the rest arrives the next day). Or watch an optional ad.`))}</p>
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
          {!isAdultPlayer() && <p class="t-sm t-mid st-span" data-testid="st-parent-note">{lt(L('18 yaşından küçüksen satın almadan önce anne, baba veya vasinden izin al.', 'If you are under 18, ask a parent or guardian before you buy anything.'))}</p>}
        </div>
      )}

      {tab === 'gear' && (
        <div class="st-gear" data-testid="st-tab-gear" role="tabpanel" id="st-gear-panel" aria-labelledby="st-gear">
          <p class="t-sm t-mid" data-testid="gear-intro">{lt(L(`Kramponlar ve eldivenler takılıyken belirli statlarına puan ekler; bu artış maçlarda da geçerlidir. Tüm ekipmandan bir stata en fazla +${GEAR_STAT_CAP} gelir. Oynadığın her maçta 1 kullanım azalır; süresi bitince ya da çıkarınca artış kalkar, temel statların değişmez. Kariyer parasıyla, elmasla ya da ödül olarak (krampon sponsoru, sezon ödülleri, kupalar) alınır.`, `Boots and gloves add points to specific stats while you wear them, and the boost counts in matches. All your gear together adds at most +${GEAR_STAT_CAP} to any stat. Each match you play uses one; when they wear out or you take them off the boost goes, and your base stats never change. Buy with career money or diamonds, or earn them (boots sponsor, season awards, trophies).`))}</p>
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
          {s && <EquippedSummary attrs={s.hero.attrs} life={s.life} />}
          {GEAR_TIER_ORDER.map((tier) => (
            <section key={tier} class="st-tier" data-testid={`gear-tier-${tier}`}>
              <h2 class="h4 st-tier-head">{lt(GEAR_TIERS[tier].name)} <span class="t-xs t-lo">· {lt(L(`${GEAR_TIERS[tier].matches} maç`, `${GEAR_TIERS[tier].matches} matches`))}</span></h2>
              <div class="st-grid">
                {GEAR.filter((g) => g.tier === tier && (gk || !isKeeperGear(g))).map((g) => {
                  const left = gear.inv[g.id] ?? 0
                  const on = gear.eq[g.slot] === g.id
                  return (
                    <Card key={g.id} class={`st-card${on ? ' st-on' : ''}`} data-testid={`gear-${g.id}`}>
                      <div class="st-big" aria-hidden="true">{g.icon}</div>
                      <h3 class="h4">{lt(g.name)}</h3>
                      {on && <span class="st-badge" data-testid={`gear-on-${g.id}`}>{lt(L('Takılı', 'Wearing'))}</span>}
                      <GearEffect g={g} attrs={s?.hero.attrs ?? null} life={s?.life ?? null} />
                      <span class="t-xs t-lo">{lt(L(`${g.matches} maç sürer · `, `lasts ${g.matches} matches · `))}{lt(SLOT[g.slot])}</span>
                      {left > 0 && left <= 5 && <span class="t-xs t-gold">{lt(L(`Son ${left} maç`, `${left} ${left === 1 ? 'match' : 'matches'} left`))}</span>}
                      {left > 0 && (
                        <div class="st-row">
                          <span class="t-sm" data-testid={`gear-left-${g.id}`}>{lt(L(`Kalan: ${left} maç`, `Left: ${left} ${left === 1 ? 'match' : 'matches'}`))}</span>
                          {on
                            ? <Button size="sm" variant="ghost" onClick={() => unequipGearAction(g.slot)} data-testid={`unequip-${g.id}`}>{lt(L('Çıkar', 'Take off'))}</Button>
                            : <Button size="sm" variant="secondary" onClick={() => equipGearAction(g.id)} data-testid={`equip-${g.id}`}>{lt(L('Tak', 'Wear'))}</Button>}
                        </div>
                      )}
                      <Button variant="secondary" block disabled={busy !== null || !s || money < g.cash} onClick={() => buyCash(g)} data-testid={`buy-cash-${g.id}`}>
                        💶 {lt(fmtMoney(g.cash))}
                      </Button>
                      <Button variant="primary" block disabled={busy !== null || !s || gems < g.price} aria-busy={busy === g.id} onClick={() => run(g.id, () => buyGear(g.id))} data-testid={`buy-gear-${g.id}`}>
                        {num(g.price)}💎 <span class="t-xs">({eur(g.price)})</span>
                      </Button>
                      {missing(g.price)}
                    </Card>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === 'cash' && !isAdultPlayer() && (
        <div class="st-grid" data-testid="st-tab-cash-age" role="tabpanel" id="st-cash-panel" aria-labelledby="st-cash">
          {/* Neutral question first (no hint which answer passes); the 18+ rule only after an answer. */}
          {birthYear.value === null ? <AgeQuestionInline /> : <p class="t-sm t-mid st-span">{errText('adult_only')}</p>}
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
              {s && cashLeft > 0 && cashLeft < cashGrantAmount(s, p.cashWeeks ?? 0, p.cashFloor ?? 0, p.cashCap ?? Infinity) && <p class="t-xs t-gold" data-testid={`cash-clipped-${p.id}`}>{lt(L('Bu sezonun sınırı yüzünden paketin tamamı eklenmez; yalnızca yukarıdaki tutar gelir.', 'This season’s limit means only the amount above is added, not the full pack.'))}</p>}
              <p class="t-xs t-lo">{lt(p.desc)}</p>
              {cashLeft <= 0 ? <span class="t-sm">{errText('cash_season_cap')}</span> : buyBtn(p)}
            </Card>
          ))}
          <Card class="st-card">
            <div class="st-big" aria-hidden="true">💎→💶</div>
            <h2 class="h4">{lt(L('Elmas → Nakit', 'Diamonds → Cash'))}</h2>
            <p class="t-sm t-mid">{lt(L(`${GEMS_TO_CASH.price}💎 = ${GEMS_TO_CASH.weeks} haftalık maaş (en az ${fmtMoney(GEMS_TO_CASH.floor).tr}, en çok ${fmtMoney(GEMS_TO_CASH.cap).tr}). Günde ${GEMS_TO_CASH.perDay} kez.`, `${GEMS_TO_CASH.price}💎 = ${GEMS_TO_CASH.weeks} weeks’ wages (${fmtMoney(GEMS_TO_CASH.floor).en} to ${fmtMoney(GEMS_TO_CASH.cap).en}). ${GEMS_TO_CASH.perDay} times a day.`))}</p>
            <Button variant="primary" block disabled={busy !== null || !s || gems < 100 || w?.limits?.gemsToCashLeft === 0 || cashLeft <= 0} onClick={() => run('g2c', adultOnly(() => gemsToCash()))} data-testid="gems-to-cash">100💎 <span class="t-xs">({eur(100)})</span></Button>
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
                  <Button variant="primary" block disabled={busy !== null || !w.pass.claimable} onClick={() => run('pass', () => claimPassDaily(), balanceLine(`+${PRO_DAILY_GEMS}💎`))} data-testid="pass-claim">
                    {w.pass.claimable ? lt(L(`Bugünkü ${PRO_DAILY_GEMS} elmasını al`, `Claim today’s ${PRO_DAILY_GEMS} diamonds`)) : lt(L('Bugünkü alındı, yarın yine', 'Claimed today, back tomorrow'))}
                  </Button>
                </>
              ) : (
                <>
                  <p class="t-sm" data-testid="pro-terms">
                    {lt(android ? L(
                      `Aylık abonelik: ${priceText(p)} / ay. İptal edene kadar her ay Google Play hesabından yenilenir. Google Play › Ödemeler ve abonelikler bölümünden istediğin zaman iptal edebilirsin; ödenen dönemin sonuna kadar Pro sürer.`,
                      `Monthly subscription: ${priceText(p)} / month. It renews monthly through your Google Play account until you cancel. Cancel any time in Google Play › Payments & subscriptions; Pro lasts to the end of the paid period.`,
                    ) : L(
                      `Aylık abonelik: ${priceText(p)} / ay. Dönem bitmeden en az 24 saat önce iptal edilmezse otomatik yenilenir; ödeme App Store hesabından alınır. Ayarlar › [adın] › Abonelikler bölümünden yönetebilir ve iptal edebilirsin.`,
                      `Monthly subscription: ${priceText(p)} / month. It renews automatically unless cancelled at least 24 hours before the period ends; payment is charged to your App Store account. Manage or cancel it in Settings › [your name] › Subscriptions.`,
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

const attrName = (k: AttributeKey): string => t(`data.attr.${k}`)

/** Bonus per stat if `g` were worn in its slot (with whatever else is equipped), after the cap. */
function bonusIfWorn(life: Parameters<typeof readGear>[0], g: GearDef): Partial<Record<AttributeKey, number>> {
  const others = equippedGear(life).filter((d) => d.slot !== g.slot)
  return statBonusOf([...others, g])
}

/** What an item adds: "+3 Shooting", and with a career open, "68 → 71" against the current stat. */
function GearEffect({ g, attrs, life }: { g: GearDef; attrs: Attributes | null; life: Parameters<typeof readGear>[0] | null }) {
  if (g.recovery) return <p class="t-sm t-mid">{lt(L(`Yorgunluk toparlanması +%${Math.round(g.recovery * 100)} (stat vermez).`, `Fatigue recovery +${Math.round(g.recovery * 100)}% (no stat boost).`))}</p>
  const worn = life ? bonusIfWorn(life, g) : {}
  const others = life ? statBonusOf(equippedGear(life).filter((d) => d.slot !== g.slot)) : {}
  return (
    <ul class="st-gear-stats t-sm" data-testid={`gear-stats-${g.id}`}>
      {(Object.entries(g.stats ?? {}) as [AttributeKey, number][]).map(([k, v]) => {
        const base = attrs?.[k]
        const after = base === undefined ? undefined : Math.min(99, base + (worn[k] ?? 0))
        const capped = (others[k] ?? 0) + v > GEAR_STAT_CAP
        return (
          <li key={k}>
            <b class="t-pos">+{v}</b> {attrName(k)}
            {base !== undefined && <span class="t-xs t-mid num"> · {base} → {after}{capped ? lt(L(` (sınır +${GEAR_STAT_CAP})`, ` (cap +${GEAR_STAT_CAP})`)) : ''}</span>}
          </li>
        )
      })}
    </ul>
  )
}

/** Equipped items, matches left and the total boost they give now ("Shooting 68 +3"). */
function EquippedSummary({ attrs, life }: { attrs: Attributes; life: Parameters<typeof readGear>[0] }) {
  const g = readGear(life)
  const bonus = gearStatBonus(life)
  const items = Object.values(g.eq).map((id) => GEAR_BY_ID[id!]).filter((d): d is GearDef => !!d)
  return (
    <Card class="st-card st-span" data-testid="gear-equipped">
      <h2 class="h4">{lt(L('Üzerindekiler', 'You are wearing'))}</h2>
      {items.length === 0 ? (
        <p class="t-sm t-mid">{lt(L('Hiçbir ekipman takılı değil.', 'Nothing equipped.'))}</p>
      ) : (
        <>
          <p class="t-sm">{items.map((d) => `${d.icon} ${lt(d.name)} · ${lt(L(`${g.inv[d.id] ?? 0} maç`, `${g.inv[d.id] ?? 0} matches`))}`).join('  |  ')}</p>
          <p class="t-sm t-mid" data-testid="gear-bonus-now">
            {(Object.entries(bonus) as [AttributeKey, number][]).map(([k, v]) => `${attrName(k)} ${attrs[k]} +${v}`).join(' · ')}
          </p>
        </>
      )}
    </Card>
  )
}

const SLOT: Record<GearSlot, LText> = {
  boots: L('krampon', 'boots'),
  accessory: L('aksesuar', 'accessory'),
  recovery: L('toparlanma', 'recovery'),
}
