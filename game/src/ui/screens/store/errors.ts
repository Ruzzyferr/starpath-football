/**
 * Player-facing text for every shop / ad answer (server codes and client outcomes), shared by the
 * Store screen and the ad offers on post-match, training and season end, so both say the same thing.
 */
import { lt } from '../../../i18n'
import type { LText } from '../../../core/types'
import { PURCHASED_CASH_PER_SEASON } from '../../../sim/career/gear'
import { fmtMoney } from '../../../sim/career/common'

const L = (tr: string, en: string): LText => ({ tr, en })

const AD_CAP = L('Bugünlük bu reklam hakkın doldu, yarın yenilenir.', 'You have used today’s ads for this; they reset tomorrow.')
const AD_GONE = L('Bu reklamın ödülü artık verilemiyor. Hakkın yanmadı; yeniden izleyebilirsin.', 'This ad’s reward can no longer be given. Nothing was used up; you can watch again.')

export const SHOP_ERR: Record<string, LText> = {
  offline: L('Mağaza sunucusuna ulaşılamadı. Ödeme alındıysa bağlantı gelince otomatik eklenir.', 'Could not reach the shop server. If you were charged, it is added automatically once you are back online.'),
  insufficient_gems: L('Yeterli elmasın yok.', 'Not enough diamonds.'),
  ad_cap: AD_CAP,
  ad_cap_reached: AD_CAP,
  dismissed: L('Reklam yarıda kapandı. Hakkın yanmadı.', 'The ad was closed early. Nothing was used up.'),
  failed: L('Şu an olmadı. Hakkın yanmadı, biraz sonra yine dene.', 'That did not work right now. Nothing was used up; try again in a moment.'),
  no_career: L('Önce bir kariyer başlat veya yükle.', 'Start or load a career first.'),
  not_injured: L('Fizyoterapi yalnızca en az 2 haftalık sakatlıkta kullanılabilir.', 'Physio is only for an injury of 2 weeks or more.'),
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
  already_owned: L('Bu satın alım zaten yapılmış; hesabına geri yükleniyor.', 'You already bought this; it is being restored to your account.'),
  no_season_reward: L('Sezon ödülün henüz işlenmedi, biraz sonra yine dene.', 'Your season reward is not in yet; try again in a moment.'),
  spend_cap: L('Bugünlük bu işlemin hakkı doldu, yarın yenilenir.', 'That is used up for today; it resets tomorrow.'),
  rate_limited: L('Çok hızlı denendi. Birkaç saniye sonra yine dene.', 'Too many tries. Try again in a few seconds.'),
  no_discount: L('Önce indirim reklamını izlemelisin.', 'Watch the discount ad first.'),
  sandbox_cap: L('Test satın alma sınırına ulaşıldı.', 'The test-purchase limit was reached.'),
  play_not_configured: L('Bu cihazda satın alma henüz açılmadı.', 'Purchases are not open on this device yet.'),
  ad_too_short: L('Reklam tamamlanmadı. Hakkın yanmadı.', 'The ad did not finish. Nothing was used up.'),
  ad_not_verified: L('Reklam doğrulanamadı. Hakkın yanmadı.', 'The ad could not be verified. Nothing was used up.'),
  ad_expired: AD_GONE,
  ad_aborted: AD_GONE,
  no_ad_session: AD_GONE,
  already_rewarded: L('Bu reklamın ödülü zaten verildi.', 'This ad’s reward was already given.'),
  too_many_open_ads: L('Birkaç reklam yarım kaldı. Birkaç dakika sonra yine dene.', 'A few ads were left unfinished. Try again in a few minutes.'),
  pending_reward: L('Reklamı izledin; ödülün bağlantı gelince otomatik eklenecek.', 'You watched the ad; your reward is added automatically once the connection is back.'),
  refund_hold: L('İade edilen bir satın alma yüzünden harcama ve reklam ödülleri şimdilik durdu.', 'Spending and ad rewards are paused because of a refunded purchase.'),
  cash_season_cap: L(`Bu sezonun nakit satın alma sınırına ulaştın (${fmtMoney(PURCHASED_CASH_PER_SEASON).tr}). Yeni sezonda açılır.`, `You reached this season’s cash purchase limit (${fmtMoney(PURCHASED_CASH_PER_SEASON).en}). It opens again next season.`),
  adult_only: L('Nakit satın almak 18 yaş ve üstü içindir.', 'Buying cash is for players 18 and over.'),
  family_shared: L('Aile Paylaşımı ile gelen satın alımlar elmas/nakit olarak eklenmez.', 'Purchases shared through Family Sharing are not added as diamonds or cash.'),
  purchase_pending: L('Ödeme henüz tamamlanmadı; tamamlanınca otomatik eklenir.', 'The payment is not complete yet; it is added automatically once it is.'),
  play_unavailable: L('Google Play şu an doğrulanamadı; ödeme otomatik yeniden denenir.', 'Google Play could not be reached; the payment is retried automatically.'),
  keeper_only: L('Bu eldiven yalnızca kaleciler için.', 'These gloves are for goalkeepers only.'),
  banned: L('Bu mağaza hesabı kullanılamıyor. Destek için info@swiip.app.', 'This shop account cannot be used. For support: info@swiip.app.'),
  unauthorized: L('Mağaza hesabın bu cihazda doğrulanamadı. Ayarlar’dan hesabını geri yükleyebilirsin.', 'Your shop account could not be verified on this device. You can recover it in Settings.'),
}

/** Ad flows: offline means the offer, not a payment, so it must not mention charges. */
const AD_OFFLINE = L('Çevrimdışısın: teklif bağlantı gelince açılır. Hakkın yanmadı.', 'You are offline: the offer comes back when you reconnect. Nothing was used up.')

/** Outside ad flows the fallback must not promise "nothing was used up". */
export function shopErrText(code: string | undefined): string {
  return lt(code && SHOP_ERR[code] ? SHOP_ERR[code]! : L('İşlem tamamlanamadı. Biraz sonra yine dene.', 'That did not go through. Try again in a moment.'))
}

/** Ad flows (and static notices): an unknown answer falls back to "nothing was used up". */
export function adErrText(code: string | undefined): string {
  if (code === 'offline') return lt(AD_OFFLINE)
  return lt(SHOP_ERR[code ?? 'failed'] ?? SHOP_ERR.failed!)
}
