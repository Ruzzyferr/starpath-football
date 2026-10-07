import '../../../styles/screens/legacy.css'
import '../../../styles/screens/training.css'
import { createPortal } from 'preact/compat'
import { useEffect, useRef, useState } from 'preact/hooks'
import { hashString } from '../../../core/rng'
import { currentLang, lt, t, tx } from '../../../i18n'
import { Button, Chip, Crest, Spinner } from '../../components'
import { Icon } from '../../icons'
import { haptic } from '../../haptics'
import { gameState, navigate, settings } from '../../store'
import { drillFinished, finishTrial, trialInvites, type TrialResultView } from '../../backend/meta'
import type { TrialInvite } from '../../../sim/game/trials'

const DEFAULT_KIT = { primary: '#1f6feb', secondary: '#f2f5fa', pattern: 'plain' as const }

/** Plays one training drill for a trial and reports the performance (null = cancelled / failed to load). */
function TrialDrill({ invite, onDone }: { invite: TrialInvite; onDone: (performance: number | null) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const handle = useRef<{ stop(): void } | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    document.documentElement.classList.add('trn-drill-open')
    let cancelled = false
    void (async () => {
      const s = gameState.value
      try {
        const [mod, { createDrill }] = await Promise.all([import('../../../game/training/TrainingScene'), import('../../../game/training/drills')])
        if (cancelled || !s || !host.current) return
        const d = createDrill(invite.drill, { attrs: s.hero.attrs, seed: hashString(`${s.meta.seed}|trial|${invite.id}`), aimAssist: settings.value.aimAssist, difficulty: 1 })
        setLoading(false)
        handle.current = mod.startDrill(host.current, d, {
          lang: settings.value.lang,
          heroKit: s.world.clubs[invite.clubId]?.colors ?? DEFAULT_KIT,
          settings: { sound: settings.value.sound, vibration: settings.value.vibration, aimAssist: settings.value.aimAssist, reducedMotion: settings.value.reducedMotion },
          title: invite.clubName,
          gender: s.hero.gender === 'female' ? 'female' : 'male',
        }, (r) => {
          handle.current = null
          drillFinished(r.kind, r.grade, r.performance)
          onDone(r.performance)
        })
      } catch (e) {
        console.warn('[StarPath] trial drill unavailable', e)
        onDone(null)
      }
    })()
    return () => {
      cancelled = true
      document.documentElement.classList.remove('trn-drill-open')
      handle.current?.stop()
      handle.current = null
    }
  }, [invite.id])
  return createPortal(
    <div class="trn-drill is-playing" role="dialog" aria-modal="true" aria-label={invite.clubName}>
      <div class="trn-drill-stage" ref={host} id="training-canvas" />
      <button type="button" class="trn-drill-quit" onClick={() => onDone(null)} aria-label={t('training.drill.quit')}>
        <Icon name="close" size={20} />
        <span>{t('training.drill.quit')}</span>
      </button>
      {loading && <div class="trn-drill-center"><Spinner /></div>}
    </div>,
    document.body,
  )
}

/** Career start: choose among the trial invitations; a drill (or the sim) decides the contract. */
export function TrialsScreen() {
  void currentLang.value
  const s = gameState.value
  const [playing, setPlaying] = useState<TrialInvite | null>(null)
  const [result, setResult] = useState<(TrialResultView & { club: string }) | null>(null)
  const invites = trialInvites()
  if (!s) return null

  const resolve = (inv: TrialInvite, perf?: number) => {
    const r = finishTrial(inv.id, perf)
    haptic(r.signed ? 'success' : 'error')
    setResult({ ...r, club: inv.clubName })
  }

  if (result) {
    return (
      <div class="trial-wrap" data-testid="trial-result">
        <h1 class="h1">{result.signed ? t('meta.trials.signed') : t('meta.trials.failed')}</h1>
        <p class="t-mid">{result.club} · {t('meta.trials.result', { p: Math.round(result.performance * 100) })}</p>
        {result.text && <p>{lt(result.text)}</p>}
        {result.signed || invites.length === 0 ? (
          <Button variant="primary" block icon="play" onClick={() => navigate('home', undefined, { tab: true })} data-testid="trial-continue">{t('meta.trials.continue')}</Button>
        ) : (
          <Button variant="secondary" block onClick={() => setResult(null)}>{t('meta.trials.tryAnother')}</Button>
        )}
      </div>
    )
  }

  return (
    <div class="trial-wrap" data-testid="trials">
      <div>
        <h1 class="h1">{t('meta.trials.title')}</h1>
        <p class="t-mid">{t('meta.trials.sub')}</p>
      </div>
      <ul class="trial-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {invites.map((inv) => {
          const club = s.world.clubs[inv.clubId]
          return (
            <li key={inv.id} class={`trial-card kind-${inv.kind}`} data-trial={inv.kind}>
              <div class="row" style={{ gap: '12px', alignItems: 'center' }}>
                {club && <Crest crest={club.crest} size={44} />}
                <div class="grow" style={{ minWidth: 0 }}>
                  <div class="h3 truncate">{inv.clubName}</div>
                  <div class="row wrap" style={{ gap: '6px' }}>
                    <Chip tone={inv.kind === 'open' ? 'violet' : inv.kind === 'academy' ? 'info' : 'gold'}>{t(`meta.trials.kind.${inv.kind}`)}</Chip>
                    <Chip>{t('meta.trials.tier', { n: inv.tier })}</Chip>
                    {inv.target > 0 && <Chip tone="neutral">{t('meta.trials.target', { p: Math.round(inv.target * 100) })}</Chip>}
                  </div>
                </div>
              </div>
              <p class="t-sm t-mid">{t(`meta.trials.kindDesc.${inv.kind}`, { p: Math.round(inv.target * 100) })}</p>
              <p class="t-xs t-lo">{t('meta.trials.drill', { d: tx(`training.drill.${inv.drill}`, undefined, inv.drill) })}</p>
              <div class="row wrap" style={{ gap: '8px' }}>
                <Button variant="primary" icon="play" onClick={() => setPlaying(inv)}>{t('meta.trials.play')}</Button>
                <Button variant="ghost" icon="fast-forward" onClick={() => resolve(inv)} data-testid={`trial-sim-${inv.kind}`}>{t('meta.trials.sim')}</Button>
              </div>
            </li>
          )
        })}
      </ul>
      {playing && (
        <TrialDrill
          invite={playing}
          onDone={(perf) => {
            const inv = playing
            setPlaying(null)
            if (perf !== null) resolve(inv, perf)
          }}
        />
      )}
    </div>
  )
}
