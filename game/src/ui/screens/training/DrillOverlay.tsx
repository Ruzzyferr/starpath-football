/**
 * Full-screen training mini-game: how-to card → Phaser drill → result card.
 *
 * The Phaser renderer is imported lazily so it stays out of the main bundle.
 * The session is only applied (energy, XP, fatigue…) once the drill finishes;
 * quitting mid-drill cancels it. The result card shows the score, grade,
 * performance and the XP / stat chips the real backend returned.
 */
import { createPortal } from 'preact/compat'
import { useEffect, useRef, useState } from 'preact/hooks'
import { hashString } from '../../../core/rng'
import type { DrillResult } from '../../../game/training/types'
import { lt, t, tx } from '../../../i18n'
import { Button, Chip, DeltaList, Spinner, toast } from '../../components'
import { haptic } from '../../haptics'
import { Icon } from '../../icons'
import { DrillDiagram } from './DrillDiagram'
import { DrillMatchupCard } from './DrillMatchupCard'
import { drillMatchup } from '../../../game/training/matchup'
import { DRILL_DIFFICULTY, drillOpponentFor } from './drillOpponent'
import { formatNumber } from '../../format'
import { actions, gameState, heroClub, phaserRenderOpts, settings, type TrainingOutcomeView, type TrainingSessionView } from '../../store'
import { drillFinished } from '../../backend/meta'
import { impressResult } from '../../backend/benchPath'
import '../../../styles/screens/bench.css'
import { DrillHints } from '../../tutorial/ControlHint'
import { emitHintEvent } from '../../tutorial/hints'

const DEFAULT_KIT = { primary: '#1f6feb', secondary: '#f2f5fa', pattern: 'plain' as const }

type Phase = 'intro' | 'loading' | 'playing' | 'result' | 'error'

const isTouch = (): boolean =>
  typeof window !== 'undefined' && (('ontouchstart' in window) || window.matchMedia?.('(pointer: coarse)').matches === true)

/** Key into the drill i18n tables (set pieces have their own title/goal). */
const VARIANT_KEYS = new Set(['setPiece', 'rondo', 'switch', 'diving', 'contact', 'press'])
const drillKey = (s: TrainingSessionView): string =>
  s.drill?.variant && VARIANT_KEYS.has(s.drill.variant) ? s.drill.variant : s.drill?.kind ?? 'finishing'

/**
 * `apply` replaces the normal training session (a drill reused for another
 * activity, e.g. the 1-on-1 with a teammate): called with the performance, or
 * undefined for the auto fallback.
 */
export function DrillOverlay({ session, onClose, challenge, onDrillResult, apply }: { session: TrainingSessionView; onClose: (outcome: TrainingOutcomeView | null) => void; challenge?: { reward: number }; onDrillResult?: (performance: number, grade: string) => void; apply?: (performance: number | undefined) => TrainingOutcomeView }) {
  const [chal, setChal] = useState<{ passed: boolean } | null>(null)
  const [phase, setPhase] = useState<Phase>('intro')
  const [result, setResult] = useState<DrillResult | null>(null)
  const [outcome, setOutcome] = useState<TrainingOutcomeView | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const handle = useRef<{ stop(): void } | null>(null)
  const drill = session.drill
  const key = drillKey(session)
  const title = tx(`training.drill.${key}`, undefined, lt(session.name))
  const controlsKey = drill?.kind ?? 'finishing'

  useEffect(() => {
    document.documentElement.classList.add('trn-drill-open')
    return () => {
      document.documentElement.classList.remove('trn-drill-open')
      handle.current?.stop()
      handle.current = null
    }
  }, [])

  const start = async () => {
    const s = gameState.value
    if (!s || !drill) return
    setPhase('loading')
    try {
      const [mod, { createDrill }] = await Promise.all([import('../../../game/training/TrainingScene'), import('../../../game/training/drills')])
      const el = host.current
      if (!el) return
      const cal = s.calendar
      const seed = hashString(`${s.meta.seed}|${cal.season}|${cal.week}|${cal.day}|${cal.slot}|${session.id}`)
      const make = () => {
        const d = createDrill(drill.kind, {
          attrs: s.hero.attrs,
          seed,
          aimAssist: settings.value.aimAssist,
          difficulty: DRILL_DIFFICULTY[s.meta.difficulty] ?? 1,
          opponent: drillOpponentFor(s, s.hero.contract?.clubId),
          variant: drill.variant,
        })
        // Observe drill events for the first-run control hint (read-only tap).
        const drain = d.drainEvents.bind(d)
        d.drainEvents = () => {
          const evs = drain()
          for (const e of evs) emitHintEvent(e)
          return evs
        }
        return d
      }
      setPhase('playing')
      handle.current = mod.startDrill(
        el,
        make(),
        {
          ...phaserRenderOpts(),
          onExit: () => quit(),
          lang: settings.value.lang,
          heroKit: heroClub.value?.colors ?? DEFAULT_KIT,
          settings: {
            sound: settings.value.sound,
            vibration: settings.value.vibration,
            aimAssist: settings.value.aimAssist,
            reducedMotion: settings.value.reducedMotion,
          },
          title,
          gender: s.hero.gender === 'female' ? 'female' : 'male',
        },
        (r) => {
          handle.current = null
          setResult(r)
          drillFinished(r.kind, r.grade, r.performance)
          // The coach's challenge is judged before the session moves the clock (backend/benchPath).
          if (challenge) {
            const c = impressResult(r.performance, r.grade)
            if (c) setChal({ passed: c.passed })
          }
          const o = apply ? apply(r.performance) : actions.trainSession(session.id, r.performance)
          if (o.ok) onDrillResult?.(r.performance, r.grade)
          setOutcome(o)
          setPhase('result')
          if (o.ok) haptic(r.grade === 'S' || r.grade === 'A' ? 'success' : 'select')
          else haptic('error')
        },
        make,
      )
    } catch (e) {
      console.warn('[StarPath] training mini-game unavailable', e)
      setPhase('error')
    }
  }

  const quit = () => {
    handle.current?.stop()
    handle.current = null
    onClose(null)
  }

  const auto = () => {
    const o = apply ? apply(undefined) : actions.trainSession(session.id)
    if (!o.ok) toast(lt(o.error) || t('training.result.notApplied'), 'warning')
    onClose(o.ok ? o : null)
  }

  const touch = isTouch()
  const gs = gameState.value
  const mu = gs && drill ? drillMatchup(drill.kind, drill.variant, gs.hero.attrs, drillOpponentFor(gs, gs.hero.contract?.clubId)) : null
  const delta = outcome && outcome.ok ? Math.round(outcome.xp - session.xp) : 0

  return createPortal(
    <div class={`trn-drill is-${phase}`} role="dialog" aria-modal="true" aria-label={title}>
      <div class="trn-drill-stage" ref={host} id="training-canvas" />
      {(phase === 'playing' || phase === 'loading') && (
        <button type="button" class="trn-drill-quit" onClick={quit} aria-label={t('training.drill.quit')} title={t('training.drill.quitHint')} data-back-exit data-testid="drill-quit">
          <Icon name="close" size={20} />
          <span>{t('training.drill.quit')}</span>
        </button>
      )}
      <DrillHints active={phase === 'playing'} drill={drill?.kind} variant={drill?.variant} onQuit={quit} />
      {phase === 'loading' && (
        <div class="trn-drill-center">
          <Spinner />
          <p class="t-sm t-mid">{t('training.drill.loading')}</p>
        </div>
      )}
      {phase === 'intro' && (
        <div class="trn-drill-card stack">
          <DrillDiagram kind={drill?.variant && drill.variant !== 'standard' && drill.variant !== 'setPiece' ? drill.variant : drill?.kind ?? 'finishing'} setPiece={drill?.variant === 'setPiece'} />
          <div class="micro t-lo">{lt(session.name)}</div>
          <h2 class="h2">{title}</h2>
          <p class="t-mid">{tx(`training.drill.goal.${key}`)}</p>
          {mu && <DrillMatchupCard mu={mu} />}
          {challenge && (
            <div class="chal-banner" data-testid="drill-challenge">
              <Icon name="target" size={18} class="t-gold" />
              <div>
                <b class="t-sm">{t('bench.challenge.banner')} · {t('bench.challenge.target', { g: 'A' })}</b>
                {challenge.reward > 0 && <div class="t-xs t-mid">{t('bench.challenge.reward', { n: challenge.reward })}</div>}
              </div>
            </div>
          )}
          <div class="trn-drill-controls">
            <div class={touch ? 'is-primary' : ''}>
              <div class="micro t-lo"><Icon name="phone" size={14} /> {t('training.drill.touch')}</div>
              <p class="t-sm">{tx(`training.drill.touchControls.${controlsKey}`)}</p>
            </div>
            <div class={touch ? '' : 'is-primary'}>
              <div class="micro t-lo"><Icon name="keyboard" size={14} /> {t('training.drill.pc')}</div>
              <p class="t-sm">{tx(`training.drill.pcControls.${controlsKey}`)}</p>
            </div>
          </div>
          <div class="row wrap trn-drill-meta">
            <Chip tone="gold" icon="energy">{t('training.session.energy', { n: session.energy })}</Chip>
            <Chip tone="violet" icon="sparkle">{t('training.session.xpRange', { a: session.xpMin ?? Math.round(session.xpMax * 0.25), b: session.xpMax })}</Chip>
          </div>
          <div class="row trn-drill-actions">
            <Button variant="ghost" onClick={() => onClose(null)} data-back-exit>{t('common.cancel')}</Button>
            {apply && <Button variant="secondary" icon="fast-forward" onClick={auto} data-testid="drill-quick">{t('bench.scene.quick')}</Button>}
            <Button variant="primary" icon="play" onClick={() => void start()} autoFocus>{t('training.drill.start')}</Button>
          </div>
        </div>
      )}
      {phase === 'error' && (
        <div class="trn-drill-card stack">
          <p class="t-mid">{t('training.drill.loadFailed')}</p>
          <div class="row trn-drill-actions">
            <Button variant="ghost" onClick={() => onClose(null)} data-back-exit>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={auto}>{t('training.session.auto')}</Button>
          </div>
        </div>
      )}
      {phase === 'result' && result && (
        <div class="trn-drill-card trn-drill-result stack" aria-live="polite">
          <div class="micro t-lo">{t('training.result.title')} · {title}</div>
          {chal && (
            <div class={`chal-banner ${chal.passed ? 'is-pass' : 'is-fail'}`} data-testid="drill-challenge-result">
              <Icon name={chal.passed ? 'check' : 'warning'} size={18} />
              <b class="t-sm">{chal.passed ? t('bench.challenge.pass') : t('bench.challenge.fail')}</b>
            </div>
          )}
          <div class="trn-result-top">
            <div class={`trn-grade trn-grade-${result.grade}`} aria-label={`${t('training.result.grade')} ${result.grade}`}>{result.grade}</div>
            <div class="stack trn-result-nums">
              <div><span class="micro t-lo">{t('training.result.score')}</span> <span class="score-font trn-result-score">{result.points}</span></div>
              <div class="trn-perf">
                <span class="micro t-lo">{t('training.result.performance')}</span>
                <div class="trn-perf-bar" role="meter" aria-label={t('training.result.performance')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(result.performance * 100)}>
                  <span style={{ width: `${Math.round(result.performance * 100)}%` }} />
                  <i style={{ left: '60%' }} title={t('training.session.auto')} />
                </div>
                <span class="num t-sm">{Math.round(result.performance * 100)}%</span>
              </div>
            </div>
          </div>
          {outcome && outcome.ok ? (
            <>
              <div class="row wrap">
                <Chip tone="violet" icon="sparkle" solid>{t('training.result.xp', { n: outcome.xp })}</Chip>
                {delta !== 0 && <Chip tone={delta > 0 ? 'pos' : 'neg'}>{t('training.result.vsAuto', { d: `${delta > 0 ? '+' : ''}${delta} XP` })}</Chip>}
              </div>
              <div class="trn-attr-xp">
                {outcome.attrXp.map((a) => (
                  <span key={a.key} class="trn-attr-xp-item">
                    <span class="t-sm">{t(`data.attr.${a.key}` as never)}</span>
                    <span class="num t-pos">+{formatNumber(a.xp, undefined, 1)}</span>
                  </span>
                ))}
              </div>
              {outcome.deltas.length > 1 && (
                <div class="stack">
                  <div class="micro t-lo">{t('training.result.gained')}</div>
                  <DeltaList deltas={outcome.deltas.filter((d) => d.key !== 'xp')} />
                </div>
              )}
              {outcome.injured && <p class="t-sm t-neg">{t('training.result.injured')}</p>}
            </>
          ) : (
            <p class="t-sm t-neg">{lt(outcome?.error) || t('training.result.notApplied')}</p>
          )}
          <Button variant="primary" block onClick={() => onClose(outcome && outcome.ok ? outcome : null)} autoFocus>{t('training.result.done')}</Button>
        </div>
      )}
    </div>,
    document.body,
  )
}
