/**
 * "Moments" list: this match's recorded highlights (session memory only)
 * with a rewatch player (multi-angle slow-motion replay). Used on the live
 * match screen and, as "best moments", on the post-match screen.
 */
import '../../../styles/screens/moments.css'
import { useEffect, useRef, useState } from 'preact/hooks'
import { lt, tx } from '../../../i18n'
import { Button, Modal, Segmented } from '../../components'
import { Icon } from '../../icons'
import { settings } from '../../store'
import { rewatchMoment, type HighlightSession } from '../../backend/highlightBridge'
import { listMoments, momentsVersion, topMoments, type MomentRecording } from '../../../game/moments'
import type { ReplayAngleChoice } from '../../../game/presentation'
import { ClipButton } from './ClipButton'
import { MOMENT_ICON } from './shared'

const L = {
  title: { tr: 'Anlar', en: 'Moments' },
  best: { tr: 'Maçın en iyi anları', en: 'Best moments' },
  empty: { tr: 'Oynadığın anlar burada tekrar izlenebilir.', en: 'Moments you play can be rewatched here.' },
  watch: { tr: 'İzle', en: 'Watch' },
  replay: { tr: 'Tekrar', en: 'Replay' },
  again: { tr: 'Yeniden', en: 'Again' },
  angle: { tr: 'Kamera', en: 'Camera' },
  auto: { tr: 'Oto', en: 'Auto' },
  broadcast: { tr: 'Yayın', en: 'Broadcast' },
  goalcam: { tr: 'Kale arkası', en: 'Goal cam' },
  tactical: { tr: 'Taktik', en: 'Tactical' },
}

/** Graded success (build 9): shown after the outcome of a goal-oriented moment. */
const TIER: Record<string, { tr: string; en: string }> = {
  partial: { tr: 'kısmi başarı', en: 'partial success' },
}

const OUTCOME: Record<string, { tr: string; en: string }> = {
  goal: { tr: 'Gol', en: 'Goal' }, assist: { tr: 'Asist', en: 'Assist' }, saved: { tr: 'Kurtarış', en: 'Saved' }, missed: { tr: 'Aut', en: 'Missed' },
  blocked: { tr: 'Blok', en: 'Blocked' }, woodwork: { tr: 'Direk', en: 'Woodwork' }, pass_complete: { tr: 'İyi oyun', en: 'Good play' },
  lost_ball: { tr: 'Top kaybı', en: 'Lost it' }, defended: { tr: 'Savunma', en: 'Defended' }, conceded: { tr: 'Gol yedik', en: 'Conceded' },
  shot_conceded: { tr: 'Şut verdik', en: 'Chance conceded' }, foul_won: { tr: 'Faul alındı', en: 'Foul won' }, foul_committed: { tr: 'Faul', en: 'Foul' },
  timeout: { tr: 'Süre bitti', en: "Time's up" }, cleared: { tr: 'Uzaklaştırıldı', en: 'Cleared' },
}

function MomentRow({ m, onWatch }: { m: MomentRecording; onWatch: (m: MomentRecording) => void }) {
  const good = m.outcome === 'goal' || m.outcome === 'assist' || m.outcome === 'defended' || m.outcome === 'woodwork' || m.tier === 'partial'
  return (
    <li class={`mo-row${good ? ' is-good' : ''}`}>
      <span class="mo-min num">{m.minute}'</span>
      <span class="mo-icon"><Icon name={MOMENT_ICON[m.kind] ?? 'star'} size={16} /></span>
      <span class="mo-text grow">
        <b>{lt(OUTCOME[m.outcome] ?? { tr: m.outcome, en: m.outcome })}</b>
        {m.tier && TIER[m.tier] && <span class="mo-tier" data-testid="moment-tier"> ({lt(TIER[m.tier]!)})</span>}
        <span class="t-lo"> · {tx(`match.kind.${m.kind}`, undefined, m.kind)}</span>
      </span>
      <Button size="sm" variant="ghost" icon="play" onClick={() => onWatch(m)} data-testid="moment-watch">{lt(L.watch)}</Button>
    </li>
  )
}

/** Fullscreen-ish modal that plays one recorded moment. */
function MomentPlayer({ m, onClose }: { m: MomentRecording; onClose: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const [angle, setAngle] = useState<ReplayAngleChoice>('auto')
  const [run, setRun] = useState(0)
  const [ended, setEnded] = useState(false)
  useEffect(() => {
    const el = host.current
    if (!el) return
    setEnded(false)
    el.innerHTML = ''
    const mount = document.createElement('div')
    mount.className = 'mo-canvas'
    el.appendChild(mount)
    const s: HighlightSession = rewatchMoment(mount, m, angle, settings.value, () => setEnded(true))
    return () => {
      s.stop()
      el.innerHTML = ''
    }
  }, [m.id, angle, run])
  const opts: { id: ReplayAngleChoice; label: string }[] = [
    { id: 'auto', label: lt(L.auto) },
    { id: 'broadcast', label: lt(L.broadcast) },
    { id: 'goalcam', label: lt(L.goalcam) },
    { id: 'tactical', label: lt(L.tactical) },
  ]
  return (
    <Modal open onClose={onClose} title={`${lt(L.replay)} · ${m.minute}' ${lt(OUTCOME[m.outcome] ?? { tr: m.outcome, en: m.outcome })}`} size="lg" class="mo-modal">
      <div class="mo-stage" ref={host} data-testid="moment-stage" />
      <div class="mo-controls">
        <Segmented<ReplayAngleChoice> label={lt(L.angle)} value={angle} onChange={setAngle} options={opts} />
        <ClipButton live={!ended} getCanvas={() => host.current?.querySelector('canvas') ?? null} name={`kickborn-moment-${m.minute}`} />
        {ended && <Button size="sm" icon="play" onClick={() => setRun((r) => r + 1)}>{lt(L.again)}</Button>}
      </div>
    </Modal>
  )
}

/**
 * Moments panel. `top` shows only the best three (post-match); otherwise all
 * of this match's moments in match order. `onOpen`/`onClose` let the live
 * screen pause the match while watching.
 */
export function MomentsPanel({ matchKey, top, onOpen, onClose }: { matchKey: string; top?: boolean; onOpen?: () => void; onClose?: () => void }) {
  const [playing, setPlaying] = useState<MomentRecording | null>(null)
  void momentsVersion()
  const list = top ? topMoments(matchKey, 3) : listMoments(matchKey)
  if (!list.length && top) return null
  return (
    <section class="mo-panel" aria-label={lt(top ? L.best : L.title)} data-testid="moments">
      <h2 class="micro t-mid mo-title"><Icon name="play" size={12} /> {lt(top ? L.best : L.title)}</h2>
      {list.length === 0 ? (
        <p class="t-sm t-lo mo-empty">{lt(L.empty)}</p>
      ) : (
        <ol class="mo-list">
          {list.map((m) => <MomentRow key={m.id} m={m} onWatch={(x) => { onOpen?.(); setPlaying(x) }} />)}
        </ol>
      )}
      {playing && <MomentPlayer m={playing} onClose={() => { setPlaying(null); onClose?.() }} />}
    </section>
  )
}
