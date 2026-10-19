import '../../../styles/screens/moments.css'
import { useEffect, useRef, useState } from 'preact/hooks'
import { currentLang, t } from '../../../i18n'
import { unpackRecording, type GoalReplay } from '../../../sim/game/saveHistory'
import type { KitColors } from '../../../core/types'
import { rewatchGoal, type HighlightSession } from '../../backend/highlightBridge'
import { Button, Card, CardHeader, Modal } from '../../components'
import { seasonLabel } from '../../format'
import { gameState, heroClub, settings } from '../../store'
import { ClipButton } from '../match/ClipButton'

const OPP_KIT: KitColors = { primary: '#1d4ed8', secondary: '#0b1b44', pattern: 'hoops' }
const FALLBACK_KIT: KitColors = { primary: '#1f6feb', secondary: '#f2f5fa', pattern: 'plain' }

function ReelPlayer({ g, onClose }: { g: GoalReplay; onClose: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const [run, setRun] = useState(0)
  const [ended, setEnded] = useState(false)
  useEffect(() => {
    const el = host.current
    const s = gameState.value
    if (!el || !s || !g.hl) return
    setEnded(false)
    el.innerHTML = ''
    const mount = document.createElement('div')
    mount.className = 'mo-canvas'
    el.appendChild(mount)
    const hero = s.hero
    const session: HighlightSession = rewatchGoal(
      mount,
      {
        highlight: g.hl,
        rec: unpackRecording(g.rec),
        heroColors: heroClub.value?.colors ?? FALLBACK_KIT,
        oppColors: OPP_KIT,
        heroName: hero.firstName ? hero.lastName.toUpperCase() : 'YOU',
        lang: settings.value.lang,
        settings: settings.value,
        gender: hero.gender === 'female' ? 'female' : 'male',
      },
      () => setEnded(true),
    )
    return () => {
      session.stop()
      el.innerHTML = ''
    }
  }, [g, run])
  return (
    <Modal open onClose={onClose} title={t('profile.reel.playerTitle', { min: g.minute })} size="lg" class="mo-modal">
      <div class="mo-stage" ref={host} data-testid="reel-stage" />
      <div class="mo-controls">
        <ClipButton live={!ended} getCanvas={() => host.current?.querySelector('canvas') ?? null} name={`kickborn-goal-${g.season}-${g.minute}`} />
        {ended && <Button size="sm" icon="play" onClick={() => setRun((r) => r + 1)} data-testid="reel-again">{t('profile.reel.again')}</Button>}
        {ended && <span class="t-sm t-mid" data-testid="reel-done">{t('profile.reel.done')}</span>}
      </div>
    </Modal>
  )
}

/** Goal reel: the last stored goals (input recordings) rewatched through the match scene. */
export function GoalReel() {
  void currentLang.value
  const s = gameState.value
  const [playing, setPlaying] = useState<GoalReplay | null>(null)
  if (!s) return null
  const all = s.replays ?? []
  const list = all.filter((g) => g.hl).slice().reverse()
  return (
    <Card pad="md" data-testid="goal-reel">
      <CardHeader title={t('profile.reel.title')} icon="play" sub={list.length ? t('profile.reel.sub', { n: list.length }) : undefined} />
      {list.length === 0 ? (
        <p class="t-sm t-lo">{all.length > 0 ? t('profile.reel.legacy') : t('profile.reel.empty')}</p>
      ) : (
        <ol class="mo-list" data-testid="goal-reel-list">
          {list.map((g, i) => (
            <li key={`${g.season}-${g.week}-${g.minute}-${i}`} class="mo-row is-good">
              <span class="mo-min num">{g.minute}'</span>
              <span class="mo-text grow">
                <b>{t('profile.reel.goal')}</b>
                <span class="t-lo"> · {t('profile.reel.when', { s: seasonLabel(g.season), w: g.week + 1 })}</span>
              </span>
              <Button size="sm" variant="ghost" icon="play" onClick={() => setPlaying(g)} data-testid="reel-watch">{t('profile.reel.watch')}</Button>
            </li>
          ))}
        </ol>
      )}
      {playing && <ReelPlayer g={playing} onClose={() => setPlaying(null)} />}
    </Card>
  )
}
