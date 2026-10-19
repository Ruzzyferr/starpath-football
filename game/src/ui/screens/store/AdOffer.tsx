import { useState } from 'preact/hooks'
import { lt } from '../../../i18n'
import type { LText } from '../../../core/types'
import { Button, toast } from '../../components'
import { gameState } from '../../store'
import { adsAvailable, hasPendingAd, serverWallet, watchAd, type AdOffer as Offer } from '../../../store-iap'
import { adErrText } from './errors'

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
  // Closed while a watched ad of this offer still waits for its reward (it arrives on its own).
  if (!adsAvailable() || used || (cap && cap.used >= cap.max) || hasPendingAd(offer)) return null
  const pro = !!serverWallet.value?.pass.active
  const left = cap ? cap.max - cap.used : undefined
  const go = async () => {
    setBusy(true)
    const r = await watchAd(offer, { ref: ctxRef, career: gameState.peek()?.meta.id })
    setBusy(false)
    if (r.ok) {
      setUsed(true)
      // Career rewards (bonus ×2, training boost) announce themselves when applied (shopBridge).
      if (done) toast(lt(done), 'success')
      onDone?.()
    } else {
      // Watched, reward on its way (or refused for good): the offer is spent either way.
      if (['pending_reward', 'ad_cap', 'ad_cap_reached', 'already_rewarded', 'refund_hold'].includes(r.reason ?? '')) setUsed(true)
      toast(adErrText(r.reason), 'info')
    }
  }
  return (
    <Button variant="secondary" icon="play" disabled={busy} aria-busy={busy} onClick={go} data-testid={testId ?? `ad-${offer}`}>
      {lt(label)}{pro ? lt({ tr: ' · Pro: reklamsız', en: ' · Pro: no ad' }) : left !== undefined ? lt({ tr: ` · bugün ${left} hak`, en: ` · ${left} left today` }) : ''}
    </Button>
  )
}
