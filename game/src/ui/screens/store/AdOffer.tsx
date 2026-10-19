import { useState } from 'preact/hooks'
import { lt } from '../../../i18n'
import type { LText } from '../../../core/types'
import { Button, toast } from '../../components'
import { adsAvailable, serverWallet, watchAd, type AdOffer as Offer } from '../../../store-iap'

const MSG: Record<string, LText> = {
  dismissed: { tr: 'Reklam yarıda kapandı. Hakkın yanmadı.', en: 'The ad was closed early. Nothing was used up.' },
  ad_cap: { tr: 'Bugünlük bu reklam hakkın doldu.', en: 'You have used today’s ads for this.' },
  offline: { tr: 'Çevrimdışısın: reklam teklifi bağlantı gelince açılır.', en: 'You are offline: the offer comes back when you reconnect.' },
  failed: { tr: 'Reklam şu an yüklenemedi. Hakkın yanmadı.', en: 'The ad could not load. Nothing was used up.' },
}

/**
 * Optional "watch an ad, get X" button for menu moments (never inside a match or minigame).
 * Hidden when ads are unavailable or today's cap is used; Pro Contract holders get it without the ad.
 */
export function AdOffer({ offer, label, done, onDone, testId }: { offer: Offer; label: LText; done?: LText; onDone?: () => void; testId?: string }) {
  const [busy, setBusy] = useState(false)
  const [used, setUsed] = useState(false)
  const cap = serverWallet.value?.ads[offer]
  if (!adsAvailable() || used || (cap && cap.used >= cap.max)) return null
  const pro = !!serverWallet.value?.pass.active
  const go = async () => {
    setBusy(true)
    const r = await watchAd(offer)
    setBusy(false)
    if (r.ok) {
      setUsed(true)
      if (done) toast(lt(done), 'success')
      onDone?.()
    } else toast(lt(MSG[r.reason ?? 'failed'] ?? MSG.failed!), 'info')
  }
  return (
    <Button variant="secondary" icon="play" disabled={busy} onClick={go} data-testid={testId ?? `ad-${offer}`}>
      {lt(label)}{pro ? ' · Pro' : ''}
    </Button>
  )
}
