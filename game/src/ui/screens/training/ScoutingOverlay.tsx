/**
 * "Watch the opponent's video" mini-game: intro card → Phaser clips with a DOM
 * question panel (three real buttons: touch, mouse, keys 1/2/3) → result card.
 * The 'video' activity (time, energy, preparation goal) is applied once at the
 * end, together with the scouting buff for the next match against that club.
 */
import '../../../styles/screens/training.css'
import '../../../styles/screens/scout.css'
import { createPortal } from 'preact/compat'
import { useEffect, useRef, useState } from 'preact/hooks'
import { hashString } from '../../../core/rng'
import type { ScoutFrame, ScoutingGame, ScoutingResult } from '../../../game/training/scouting'
import { lt, t } from '../../../i18n'
import { Button, Chip, Spinner, toast } from '../../components'
import { haptic } from '../../haptics'
import { Icon } from '../../icons'
import { gameState, phaserRenderOpts, settings } from '../../store'
import { finishScouting, scoutPacing, scoutReport, scoutingOpen, type ScoutOutcome } from '../../backend/scouting'
import { GameTutorial, GateBeat } from '../../tutorial/ControlHint'

type Phase = 'intro' | 'loading' | 'playing' | 'result' | 'error'

const isTouch = (): boolean =>
  typeof window !== 'undefined' && (('ontouchstart' in window) || window.matchMedia?.('(pointer: coarse)').matches === true)

const LETTERS = ['A', 'B', 'C']

/** Mounted once (App): opens when {@link scoutingOpen} is set. */
export function ScoutingHost() {
  if (!scoutingOpen.value) return null
  return <ScoutingOverlay onClose={() => { scoutingOpen.value = false }} />
}

export function ScoutingOverlay({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [frame, setFrame] = useState<ScoutFrame | null>(null)
  const [left, setLeft] = useState(0)
  const [result, setResult] = useState<ScoutingResult | null>(null)
  const [outcome, setOutcome] = useState<ScoutOutcome | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const sg = useRef<ScoutingGame | null>(null)
  const handle = useRef<{ stop(): void } | null>(null)
  const report = useRef(scoutReport())
  const rep = report.current
  // The hero's reading of the game: clip slow-mo and the takeaway (sim/game/oppScouting).
  const pace = useRef(scoutPacing()).current
  const club = rep?.short ?? ''

  useEffect(() => {
    document.documentElement.classList.add('trn-drill-open')
    return () => {
      document.documentElement.classList.remove('trn-drill-open')
      handle.current?.stop()
      handle.current = null
    }
  }, [])

  // Countdown readout (the canvas owns the clock; the panel samples it).
  useEffect(() => {
    if (phase !== 'playing') return
    let raf = 0
    const tick = () => {
      const g = sg.current
      if (g) {
        const f = g.frame()
        setLeft((o) => (Math.abs(o - f.timeLeft) > 0.05 ? f.timeLeft : o))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  const pick = (i: number) => {
    const g = sg.current
    if (!g) return
    const a = g.answer(i)
    if (!a) return
    haptic(a.correct ? 'success' : 'error')
    setFrame(g.frame())
  }

  // Keys: 1/2/3 answer, Esc quits.
  useEffect(() => {
    if (phase !== 'playing') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        quit()
        return
      }
      const n = Number(e.key)
      if (n >= 1 && n <= 3) {
        e.preventDefault()
        pick(n - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  if (!rep && phase === 'intro') {
    // Nothing to scout any more (the match was played meanwhile).
    queueMicrotask(onClose)
    return null
  }

  const start = async () => {
    const s = gameState.value
    if (!s || !rep) return
    setPhase('loading')
    try {
      const [scene, rules] = await Promise.all([import('../../../game/training/ScoutingScene'), import('../../../game/training/scouting')])
      const el = host.current
      if (!el) return
      const cal = s.calendar
      // A sharp reader sees the clips in slow motion: the game clock runs at 1/slowMo of real time.
      const slowMo = pace.slowMo
      class PacedScouting extends rules.ScoutingGame {
        override update(dt: number): void {
          super.update(dt / slowMo)
        }
      }
      const game = new PacedScouting({ report: rep, seed: hashString(`${s.meta.seed}|${cal.season}|${cal.week}|${cal.day}|scout|${rep.fixtureId}`) })
      sg.current = game
      setFrame(game.frame())
      setPhase('playing')
      handle.current = scene.startScouting(el, game, {
        labels: { rec: t('training.scout.rec'), clip: t('training.scout.clipShort'), vs: t('training.scout.vs', { c: rep.name }) },
        reducedMotion: settings.value.reducedMotion,
        insets: () => ({ top: 52, bottom: panel.current?.getBoundingClientRect().height ?? 260 }),
        onFrame: (f) => setFrame(f),
        ...phaserRenderOpts(),
        onExit: () => quit(),
      }, (r) => {
        handle.current = null
        setResult(r)
        const o = finishScouting(r.performance, r.spotted)
        setOutcome(o)
        setPhase('result')
        haptic(o.ok && (r.grade === 'S' || r.grade === 'A') ? 'success' : o.ok ? 'select' : 'error')
      })
    } catch (e) {
      console.warn('[StarPath] scouting mini-game unavailable', e)
      setPhase('error')
    }
  }

  const quick = () => {
    const o = finishScouting(null)
    if (!o.ok) toast(t('training.scout.notApplied'), 'warning')
    onClose()
  }

  function quit() {
    handle.current?.stop()
    handle.current = null
    onClose()
  }

  const touch = isTouch()
  const clip = frame?.clip
  const ans = frame?.answer ?? null
  const answered = frame?.phase === 'feedback' || frame?.phase === 'done'
  const total = sg.current?.clips.length ?? 4
  const fbText = !ans ? '' : ans.correct ? t('training.scout.correct') : ans.choice === null ? t('training.scout.timeout') : t('training.scout.wrong')

  return createPortal(
    <div class={`trn-drill scout is-${phase}`} role="dialog" aria-modal="true" aria-label={t('training.scout.title', { c: club })} data-testid="scout">
      <div class="trn-drill-stage" ref={host} id="scout-canvas" />
      {(phase === 'playing' || phase === 'loading') && (
        <button type="button" class="trn-drill-quit" onClick={quit} aria-label={t('training.scout.quit')} data-back-exit>
          <Icon name="close" size={20} />
          <span>{t('training.scout.quit')}</span>
        </button>
      )}
      <GameTutorial active={phase === 'playing'} tkey="scout" onQuit={quit} />
      {phase === 'playing' && <GateBeat />}
      {phase === 'loading' && (
        <div class="trn-drill-center">
          <Spinner />
          <p class="t-sm t-mid">{t('training.scout.loading')}</p>
        </div>
      )}
      {phase === 'playing' && clip && (
        <div class={`scout-panel${answered ? ' is-answered' : ''}`} ref={panel} data-testid="scout-panel">
          <div class="scout-panel-head">
            <span class="micro scout-q">{frame?.phase === 'title' ? t('training.scout.clip', { i: (frame?.index ?? 0) + 1, n: total }) : answered ? fbText : t('training.scout.question')}</span>
            {!answered && frame?.phase === 'clip' && <span class="t-xs num scout-left" aria-hidden="true">{t('training.scout.timeLeft', { n: Math.ceil(left * pace.slowMo) })}</span>}
          </div>
          {!answered && frame?.phase === 'clip' && (
            <div class="scout-timer" aria-hidden="true"><span style={{ transform: `scaleX(${Math.max(0, left / 8)})` }} /></div>
          )}
          <ol class="scout-options" aria-live="polite">
            {clip.options.map((o, i) => {
              const state = !answered ? '' : i === clip.correct ? ' is-correct' : ans?.choice === i ? ' is-wrong' : ' is-dim'
              return (
                <li key={`${frame?.index}-${o.id}`}>
                  <button
                    type="button"
                    class={`scout-opt${state}`}
                    disabled={frame?.phase !== 'clip'}
                    onClick={() => pick(i)}
                    aria-label={t('training.scout.choiceAria', { i: i + 1, t: lt(o.text) })}
                    data-testid={`scout-opt-${i}`}
                    data-correct={answered && i === clip.correct ? 'true' : undefined}
                  >
                    <span class="scout-key" aria-hidden="true">{touch ? LETTERS[i] : i + 1}</span>
                    <span class="scout-text">{lt(o.text)}</span>
                    {answered && i === clip.correct && <Icon name="check" size={18} class="scout-mark" />}
                    {answered && ans?.choice === i && i !== clip.correct && <Icon name="close" size={18} class="scout-mark" />}
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      )}
      {phase === 'intro' && rep && (
        <div class="trn-drill-card stack scout-intro">
          <div class="scout-hero" aria-hidden="true">
            <span class="scout-hero-rec">● {t('training.scout.rec')}</span>
            <Icon name="eye" size={34} />
          </div>
          <div class="micro t-lo">{t('training.scout.kicker')}</div>
          <h2 class="h2">{t('training.scout.title', { c: rep.name })}</h2>
          <p class="t-mid">{t('training.scout.goal', { c: rep.name })}</p>
          <div class="scout-tip" data-testid="scout-hint">
            <Icon name="info" size={18} class="t-gold" />
            <div>
              <b class="t-sm">{t('training.scout.hintTitle')}</b>
              <p class="t-sm t-mid">{t('training.scout.hint')}</p>
            </div>
          </div>
          <div class="trn-drill-controls">
            <div class={touch ? 'is-primary' : ''}>
              <div class="micro t-lo"><Icon name="phone" size={14} /> {t('training.drill.touch')}</div>
              <p class="t-sm">{t('training.scout.touch')}</p>
            </div>
            <div class={touch ? '' : 'is-primary'}>
              <div class="micro t-lo"><Icon name="keyboard" size={14} /> {t('training.drill.pc')}</div>
              <p class="t-sm">{t('training.scout.pc')}</p>
            </div>
          </div>
          <p class="t-xs t-mid" data-testid="scout-reading">{t('bench.scout.reading', { r: pace.reading, s: pace.slowMo.toFixed(2), k: pace.takeaway.toFixed(2) })}</p>
          <p class="t-xs t-mid">{t('training.scout.reward', { c: rep.short })}</p>
          <div class="row trn-drill-actions scout-actions">
            <Button variant="ghost" onClick={quick} title={t('training.scout.quickHint')} data-testid="scout-quick">{t('training.scout.quick')}</Button>
            <Button variant="primary" icon="play" onClick={() => void start()} autoFocus data-testid="scout-start">{t('training.scout.start')}</Button>
          </div>
        </div>
      )}
      {phase === 'error' && (
        <div class="trn-drill-card stack">
          <p class="t-mid">{t('training.drill.loadFailed')}</p>
          <div class="row trn-drill-actions">
            <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={quick}>{t('training.scout.quick')}</Button>
          </div>
        </div>
      )}
      {phase === 'result' && result && (() => {
        const grade = outcome?.grade ?? result.grade
        const perf = outcome?.effective ?? result.performance
        return (
        <div class="trn-drill-card trn-drill-result stack" aria-live="polite" data-testid="scout-result">
          <div class="micro t-lo">{t('training.scout.resultTitle')} · {club}</div>
          <div class="trn-result-top">
            <div class={`trn-grade trn-grade-${grade}`} aria-label={`${t('training.result.grade')} ${grade}`} data-testid="scout-grade">{grade}</div>
            <div class="stack trn-result-nums">
              <div class="trn-perf">
                <span class="micro t-lo">{t('training.result.performance')}</span>
                <div class="trn-perf-bar" role="meter" aria-label={t('training.result.performance')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(perf * 100)}>
                  <span style={{ width: `${Math.round(perf * 100)}%` }} />
                </div>
                <span class="num t-sm">{Math.round(perf * 100)}%</span>
              </div>
              {outcome?.effective !== undefined && <span class="t-xs t-mid">{t('bench.scout.takeaway', { p: Math.round(result.performance * 100), k: pace.takeaway.toFixed(2) })}</span>}
            </div>
          </div>
          {outcome && outcome.ok ? (
            <>
              <p class="t-sm scout-bonus">{outcome.bonus > 0 ? <><Icon name="trend-up" size={16} class="t-pos" /> {t('training.scout.bonus', { c: club, b: outcome.bonus })}</> : t('training.scout.noBonus')}</p>
              <div class="row wrap">
                {outcome.xp.map((x) => <Chip key={x.key} tone="violet" icon="sparkle">{t(`data.attr.${x.key}` as never)} +{x.xp} XP</Chip>)}
              </div>
              <div class="stack">
                <div class="micro t-lo">{t('training.scout.spotted')}</div>
                {result.spotted.length ? (
                  <ul class="scout-spotted">
                    {(sg.current?.clips ?? []).filter((c) => result.spotted.includes(c.pattern)).map((c) => <li key={c.pattern} class="t-sm"><Icon name="check" size={14} class="t-pos" /> {lt(c.options[c.correct]!.text)}</li>)}
                  </ul>
                ) : <p class="t-sm t-mid">{t('training.scout.nothing')}</p>}
              </div>
            </>
          ) : (
            <p class="t-sm t-neg">{t('training.scout.notApplied')}</p>
          )}
          <Button variant="primary" block onClick={onClose} autoFocus data-testid="scout-done">{t('training.scout.done')}</Button>
        </div>
        )
      })()}
    </div>,
    document.body,
  )
}
