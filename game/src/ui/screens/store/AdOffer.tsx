import { useState } from 'preact/hooks'
import { lt } from '../../../i18n'
import type { LText } from '../../../core/types'
import { Button, toast } from '../../components'
import { gameState } from '../../store'
import { adsAvailable, serverWallet, watchAd, type AdOffer as Offer } from '../../../store-iap'

const MSG: Record<string, LText> = {
  dismissed: { tr: 'Reklam yarıda kapandı. Hakkın yanmadı.', en: 'The ad was closed early. Nothing was used up.' },
  ad_cap: { tr: 'Bugünlük bu reklam hakkın doldu, yarın yenilenir.', en: 'You have used today’s ads for this; they reset tomorrow.' },
  offline: { tr: 'Çevrimdışısın: teklif bağlantı gelince açılır.', en: 'You are offline: the offer comes back when you reconnect.' },
  no_season_reward: { tr: 'Sezon ödülün henüz işlenmedi, biraz sonra yine dene.', en: 'Your season reward is not in yet; try again in a moment.' },
  failed: { tr: 'Reklam şu an yüklenemedi. Hakkın yanmadı.', en: 'The ad could not load. Nothing was used up.' },
}

/**
 * Optional "watch an ad, get X" button for menu moments (never inside a match or minigame).
 * Hidden when ads are unavailable or today's cap is used; Pro Contract holders get it without the ad.
 * `context` binds the reward to its context (the fixture for a doubled match bonus); the current career
 * is bound too, so the reward can only land in this career.
 */
export function AdOffer({ offer, label, done, onDone, testId, context: ctxRef }: { offer: Offer; label: LText; done?: LText; onDone?: () => void; testId?: string; context?: string }) {
  const [busy, setBusy] = useState(false)
  const [used, setUsed] = useState(false)
  const cap = serverWallet.value?.ads[offer]
  if (!adsAvailable() || used || (cap && cap.used >= cap.max)) return null
  const pro = !!serverWallet.value?.pass.active
  const go = async () => {
    setBusy(true)
    const r = await watchAd(offer, { ref: ctxRef, career: gameState.peek()?.meta.id })
    setBusy(false)
    if (r.ok) {
      setUsed(true)
      // Career rewards (bonus ×2, training boost) announce themselves when applied (shopBridge).
      if (done) toast(lt(done), 'success')
      onDone?.()
    } else toast(lt(MSG[r.reason ?? 'failed'] ?? MSG.failed!), 'info')
  }
  return (
    <Button variant="secondary" icon="play" disabled={busy} aria-busy={busy} onClick={go} data-testid={testId ?? `ad-${offer}`}>
      {lt(label)}{pro ? lt({ tr: ' · Pro: reklamsız', en: ' · Pro: no ad' }) : ''}
    </Button>
  )
}
