/**
 * Doping test as a short calm/timing moment (~20 s): steady your breathing
 * (hold to breathe in, release to breathe out, keep the needle in the moving
 * green band), then sign the three forms in the right order. The rules live in
 * dopingRules (Composure sets the band and the hand tremor, Composure +
 * discipline the forms clock). The score (0..1) is the played resolve of the
 * agenda task: composure XP, morale and discipline scaled by it
 * (sim/game/agenda). "Quick resolve" keeps the old one-tap outcome.
 * Keys: Space hold, 1/2/3 forms, Esc closes without resolving.
 */
import '../../../styles/screens/training.css'
import '../../../styles/screens/scene.css'
import { createPortal } from 'preact/compat'
import { useEffect, useRef, useState } from 'preact/hooks'
import { hashString } from '../../../core/rng'
import { lt, t } from '../../../i18n'
import { Button } from '../../components'
import { haptic } from '../../haptics'
import { Icon } from '../../icons'
import { gameState, settings } from '../../store'
import type { DopingOutcome } from '../../backend/scenes'
import { EffectChips } from './DialogueScene'
import { TutorialCard, tutorialVisible } from '../../tutorial/ControlHint'
import {
  BREATH_SECONDS, DOPING_PASS, FORMS_SECONDS, bandCenter, breathStep, calmScore, dopingGrade, dopingParams, dopingPerformance, formsScore, inBand, needleAt,
} from './dopingRules'

type Phase = 'intro' | 'breath' | 'forms' | 'result'
const FORMS = ['consent', 'seal', 'declare'] as const
type Form = (typeof FORMS)[number]

const isTouch = (): boolean =>
  typeof window !== 'undefined' && (('ontouchstart' in window) || window.matchMedia?.('(pointer: coarse)').matches === true)

const gradeOf = dopingGrade

/** Seeded order of the three forms on the table (the UI only; the sim gets the score). */
function tableOrder(seed: string): Form[] {
  const h = hashString(seed)
  const perms: Form[][] = [[...FORMS], ['seal', 'declare', 'consent'], ['declare', 'consent', 'seal'], ['seal', 'consent', 'declare'], ['declare', 'seal', 'consent'], ['consent', 'declare', 'seal']]
  return perms[1 + (h % (perms.length - 1))]!
}

export function DopingTest({ taskId, onFinish, onQuick, onClose }: {
  taskId: string
  onFinish: (performance: number) => DopingOutcome
  onQuick: () => void
  onClose: () => void
}) {
  const [phase, setPhase] = useState<Phase>('intro')
  // How-to card between the intro and the breathing (every time unless hidden), then its own 3-2-1.
  const [howTo, setHowTo] = useState(false)
  const [v, setV] = useState(0.35)
  const [center, setCenter] = useState(0.5)
  const [left, setLeft] = useState(BREATH_SECONDS)
  const [calm, setCalm] = useState(0)
  const [signed, setSigned] = useState<Form[]>([])
  const [wrong, setWrong] = useState<Form | null>(null)
  const [mistakes, setMistakes] = useState(0)
  const [outcome, setOutcome] = useState<{ perf: number; calm: number; forms: number; r: DopingOutcome } | null>(null)
  const hold = useRef(false)
  const sim = useRef({ v: 0.35, t: 0, inBand: 0, last: 0 })
  const formsStart = useRef(0)
  const order = useRef(tableOrder(taskId)).current
  const phaseSeed = (hashString(`${taskId}:breath`) % 628) / 100
  const tremorSeed = (hashString(`${taskId}:hand`) % 628) / 100
  const reduced = settings.value.reducedMotion
  // The hero's Composure (and discipline) set the difficulty, once when the test opens.
  const hero = useRef({ composure: gameState.value?.hero.attrs.composure ?? 50, discipline: gameState.value?.life.discipline ?? 70 }).current
  const params = useRef(dopingParams(hero.composure, hero.discipline)).current
  const BAND = params.band

  useEffect(() => {
    document.documentElement.classList.add('trn-drill-open')
    return () => document.documentElement.classList.remove('trn-drill-open')
  }, [])

  // Breathing loop (wall clock is fine here: this is the UI mini-game, the sim gets only the score).
  useEffect(() => {
    if (phase !== 'breath') return
    let raf = 0
    const start = performance.now()
    sim.current = { v: 0.35, t: 0, inBand: 0, last: start }
    const tick = (now: number) => {
      const st = sim.current
      // The clock is the wall clock (slow frames never stretch the test); the breath integrates per frame.
      const dt = Math.min(0.1, (now - st.last) / 1000)
      st.last = now
      st.t = (now - start) / 1000
      st.v = breathStep(st.v, hold.current, dt)
      const c = bandCenter(st.t, phaseSeed)
      const needle = needleAt(st.v, st.t, params, tremorSeed)
      if (inBand(needle, c, params)) st.inBand += dt
      setV(needle)
      setCenter(c)
      setLeft(Math.max(0, BREATH_SECONDS - st.t))
      if (st.t >= BREATH_SECONDS) {
        setCalm(calmScore(st.inBand))
        hold.current = false
        formsStart.current = now
        setPhase('forms')
        haptic('select')
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, phaseSeed, tremorSeed, params])

  // Forms clock (a soft limit: slow signing costs a little, never blocks).
  useEffect(() => {
    if (phase !== 'forms') return
    const id = window.setInterval(() => {
      const el = (performance.now() - formsStart.current) / 1000
      setLeft(Math.max(0, FORMS_SECONDS - el))
      if (el >= FORMS_SECONDS) finish(signed, mistakes)
    }, 200)
    return () => window.clearInterval(id)
  })

  function finish(done: Form[], miss: number) {
    if (outcome) return
    const el = (performance.now() - formsStart.current) / 1000
    const forms = formsScore(el, miss, done.length, params)
    const perf = dopingPerformance(calm, forms)
    const r = onFinish(perf)
    setOutcome({ perf, calm, forms, r })
    setPhase('result')
    haptic(r.ok && perf >= DOPING_PASS ? 'success' : 'select')
  }

  const sign = (f: Form) => {
    if (phase !== 'forms' || signed.includes(f)) return
    const want = FORMS[signed.length]
    if (f !== want) {
      setMistakes((m) => m + 1)
      setWrong(f)
      haptic('error')
      window.setTimeout(() => setWrong(null), 380)
      return
    }
    haptic('select')
    const next = [...signed, f]
    setSigned(next)
    if (next.length === 3) finish(next, mistakes)
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (phase === 'breath' && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault()
        hold.current = true
      }
      if (phase === 'forms') {
        const n = Number(e.key)
        if (n >= 1 && n <= 3) {
          e.preventDefault()
          sign(order[n - 1]!)
        }
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') hold.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  })

  const inZone = inBand(v, center, params)
  const status = inZone ? t('bench.doping.inZone') : v > center ? t('bench.doping.tooHigh') : t('bench.doping.tooLow')
  const touch = isTouch()
  const press = (on: boolean) => (e: Event) => {
    e.preventDefault()
    hold.current = on
  }

  return createPortal(
    <div class={`scn is-clinic dop is-${phase}`} role="dialog" aria-modal="true" aria-labelledby="dop-title" data-testid="doping">
      <div class="scn-bg" aria-hidden="true"><i class="scn-glow" /><i class="scn-glow b" /></div>
      <header class="scn-top">
        <span class="scn-top-icon" aria-hidden="true"><Icon name="first-aid" size={18} /></span>
        <div class="grow">
          <div class="micro scn-kicker">{t('bench.doping.kicker')}</div>
          <h2 class="h3 scn-title" id="dop-title">{t('bench.doping.title')}</h2>
        </div>
        <button type="button" class="scn-close" onClick={onClose} aria-label={t('bench.scene.close')}><Icon name="close" size={20} /></button>
      </header>

      {phase === 'intro' && (
        <div class="scn-panel dop-intro">
          <div class="dop-steps" aria-hidden="true">
            <span><Icon name="wind" size={22} /></span>
            <i />
            <span><Icon name="receipt" size={22} /></span>
            <i />
            <span><Icon name="shield-check" size={22} /></span>
          </div>
          <p class="t-mid">{t('bench.doping.goal')}</p>
          <p class="t-sm dop-ctrl"><Icon name={touch ? 'phone' : 'keyboard'} size={14} /> {touch ? t('bench.doping.touch') : t('bench.doping.pc')}</p>
          <p class="t-xs t-mid dop-stat" data-testid="doping-stat">{t('bench.doping.statLine', { c: hero.composure, s: Math.round(params.formsFull) })}</p>
          <div class="row dop-actions">
            <Button variant="ghost" icon="fast-forward" onClick={onQuick} data-testid="doping-quick">{t('bench.scene.quick')}</Button>
            <Button variant="primary" icon="play" onClick={() => (tutorialVisible('doping') ? setHowTo(true) : setPhase('breath'))} autoFocus data-testid="doping-start">{t('bench.doping.start')}</Button>
          </div>
        </div>
      )}

      {howTo && phase === 'intro' && <TutorialCard tkey="doping" countdown onDone={() => { setHowTo(false); setPhase('breath') }} onQuit={onClose} />}

      {phase === 'breath' && (
        <div class="dop-stage">
          <div class="micro scn-kicker">{t('bench.doping.breathTitle')} · <span class="num">{t('bench.doping.left', { n: Math.ceil(left) })}</span></div>
          <div class="dop-row">
          <div
            class={`dop-gauge${inZone ? ' is-in' : ''}`}
            role="meter"
            aria-label={t('bench.doping.meterAria')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(v * 100)}
            aria-valuetext={status}
            data-testid="doping-gauge"
          >
            <span class="dop-band" style={{ bottom: `${(center - BAND) * 100}%`, height: `${BAND * 200}%` }} />
            <span class="dop-needle" style={{ bottom: `${v * 100}%` }} />
          </div>
          <div class="dop-lung-box" aria-hidden="true"><div class={`dop-lung${inZone ? ' is-in' : ''}`} style={reduced ? undefined : { transform: `scale(${0.62 + v * 0.38})` }} /></div>
          </div>
          <p class={`dop-status${inZone ? ' is-in' : ''}`} aria-live="polite">{status}</p>
          <p class="t-xs t-mid dop-hint">{t('bench.doping.breathHint')}</p>
          <button
            type="button"
            class="dop-hold"
            aria-label={t('bench.doping.holdAria')}
            onPointerDown={press(true)}
            onPointerUp={press(false)}
            onPointerLeave={press(false)}
            onPointerCancel={press(false)}
            onContextMenu={(e) => e.preventDefault()}
            data-testid="doping-hold"
          >
            <Icon name="wind" size={22} /> {t('bench.doping.hold')}
          </button>
        </div>
      )}

      {phase === 'forms' && (
        <div class="dop-stage">
          <div class="micro scn-kicker">{t('bench.doping.formsTitle')} · <span class="num">{t('bench.doping.left', { n: Math.ceil(left) })}</span></div>
          <p class="t-sm dop-hint">{t('bench.doping.formsHint', { a: t('bench.doping.form.consent'), b: t('bench.doping.form.seal'), c: t('bench.doping.form.declare') })}</p>
          <ol class="dop-forms">
            {order.map((f, i) => {
              const done = signed.includes(f)
              return (
                <li key={f}>
                  <button
                    type="button"
                    class={`dop-form${done ? ' is-signed' : ''}${wrong === f ? ' is-wrong' : ''}`}
                    onClick={() => sign(f)}
                    disabled={done}
                    aria-label={t('bench.doping.formAria', { n: FORMS.indexOf(f) + 1, f: t(`bench.doping.form.${f}` as never) })}
                    data-testid={`doping-form-${f}`}
                  >
                    <span class="scn-key" aria-hidden="true">{i + 1}</span>
                    <span class="dop-paper" aria-hidden="true"><i /><i /><i /></span>
                    <b>{t(`bench.doping.form.${f}` as never)}</b>
                    <span class="dop-sig">{done ? <><Icon name="check" size={14} /> {t('bench.doping.signed')}</> : '— — —'}</span>
                  </button>
                </li>
              )
            })}
          </ol>
          {mistakes > 0 && <p class="t-xs t-neg">{t('bench.doping.mistakes', { n: mistakes })}</p>}
        </div>
      )}

      {phase === 'result' && outcome && (
        <div class="scn-panel scn-result" aria-live="polite" data-testid="doping-result">
          <div class="micro scn-kicker">{t('bench.doping.resultTitle')}</div>
          <div class="dop-res-top">
            <div class={`trn-grade trn-grade-${gradeOf(outcome.perf)}`}>{gradeOf(outcome.perf)}</div>
            <div class="dop-bars">
              <div><span class="micro">{t('bench.doping.calm')}</span><span class="dop-bar"><i style={{ width: `${Math.round(outcome.calm * 100)}%` }} /></span><b class="num">{Math.round(outcome.calm * 100)}%</b></div>
              <div><span class="micro">{t('bench.doping.forms')}</span><span class="dop-bar"><i style={{ width: `${Math.round(outcome.forms * 100)}%` }} /></span><b class="num">{Math.round(outcome.forms * 100)}%</b></div>
            </div>
          </div>
          {outcome.r.ok ? (
            <>
              <p class="scn-result-line">{outcome.r.lines.map((l) => lt(l)).join(' ')}</p>
              <EffectChips effects={outcome.r.effects} />
            </>
          ) : <p class="t-sm t-neg">{t('bench.scene.notApplied')}</p>}
          <Button variant="primary" block onClick={onClose} autoFocus data-testid="doping-done">{t('bench.scene.done')}</Button>
        </div>
      )}
    </div>,
    document.body,
  )
}
