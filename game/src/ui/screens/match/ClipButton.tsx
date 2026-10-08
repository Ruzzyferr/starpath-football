import { useEffect, useRef, useState } from 'preact/hooks'
import { CLIP_MAX_MS, canRecordClip, startClip, type ClipRecorder } from '../../../game/clipExport'
import { t } from '../../../i18n'
import { Button, toast } from '../../components'
import { shareClip } from '../../share/clips'

type Phase = 'idle' | 'rec' | 'busy'

/**
 * Records the replay canvas to a WebM clip (max 15 s) and shares / downloads it.
 * Renders nothing where `MediaRecorder` / `captureStream` are unavailable.
 */
export function ClipButton({ getCanvas, name, live = true }: { getCanvas: () => HTMLCanvasElement | null; name: string; /** False once the player has finished (its canvas is gone): ends a running clip and disables recording. */ live?: boolean }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [secs, setSecs] = useState(0)
  const rec = useRef<ClipRecorder | null>(null)
  const supported = canRecordClip()
  useEffect(() => () => rec.current?.stop(), [])
  useEffect(() => {
    if (phase !== 'rec') return
    const t0 = performance.now()
    const id = setInterval(() => setSecs(Math.min(CLIP_MAX_MS / 1000, Math.floor((performance.now() - t0) / 1000))), 250)
    return () => clearInterval(id)
  }, [phase])
  useEffect(() => {
    if (!live) rec.current?.stop()
  }, [live])
  if (!supported) return null

  const begin = () => {
    const canvas = getCanvas()
    const r = canvas ? startClip(canvas) : null
    if (!r) {
      toast(t('profile.clip.failed'), 'error')
      return
    }
    rec.current = r
    setSecs(0)
    setPhase('rec')
    void r.done.then(async (blob) => {
      rec.current = null
      setPhase('busy')
      const out = await shareClip(blob, `${name}.webm`, t('profile.clip.title')).catch(() => 'failed' as const)
      toast(out === 'failed' ? t('profile.clip.failed') : t(out === 'shared' ? 'profile.clip.shared' : 'profile.clip.saved'), out === 'failed' ? 'error' : 'success')
      setPhase('idle')
    }, () => {
      rec.current = null
      toast(t('profile.clip.failed'), 'error')
      setPhase('idle')
    })
  }

  return phase === 'rec' ? (
    <Button size="sm" variant="danger" icon="close" onClick={() => rec.current?.stop()} data-testid="clip-stop">
      {t('profile.clip.stop', { s: secs, max: CLIP_MAX_MS / 1000 })}
    </Button>
  ) : (
    <Button size="sm" variant="secondary" icon="camera" loading={phase === 'busy'} onClick={begin} disabled={!live} data-testid="clip-record">
      {t('profile.clip.record')}
    </Button>
  )
}
