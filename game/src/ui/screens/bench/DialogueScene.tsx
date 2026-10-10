/**
 * Reusable dialogue scene (national camp check-in, the manager's office, the
 * team dinner): portraits with the speaker's readable style, a short
 * conversation of 2–3 lines with real choices (touch, mouse, keys 1–3), a
 * quick resolve that keeps the old one-tap outcome, and an outcome card that
 * shows exactly what moved (relations, trust, morale, XP, the meter).
 */
import '../../../styles/screens/scene.css'
import { createPortal } from 'preact/compat'
import { useEffect, useRef, useState } from 'preact/hooks'
import type { LText } from '../../../core/types'
import { lt, t } from '../../../i18n'
import { Avatar, Button } from '../../components'
import { haptic } from '../../haptics'
import { Icon, type IconName } from '../../icons'
import { formatMoney } from '../../format'
import type { Scene, SceneEffect, SceneOutcome } from '../../backend/scenes'
import { TutorialCard, tutorialVisible } from '../../tutorial/ControlHint'

type Line = { who: 'npc' | 'hero'; cast: number; text: LText; tone?: LText }

const THEME: Record<Scene['id'], string> = { nationalCamp: 'is-camp', managerTalk: 'is-office', teamDinner: 'is-dinner' }
const ICON: Record<Scene['id'], IconName> = { nationalCamp: 'flag', managerTalk: 'chat', teamDinner: 'fork-knife' }
const RING: Record<string, string> = { ntCoach: 'var(--state-danger)', manager: 'var(--accent-gold)', teammate: 'var(--brand-pitch)' }

const signed = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}`

export function EffectChips({ effects }: { effects: SceneEffect[] }) {
  return (
    <ul class="scn-effects" data-testid="scene-effects">
      {effects.map((e, i) => {
        const tone = e.value > 0 ? (e.key === 'fatigue' ? 'is-pos' : 'is-pos') : e.value < 0 ? (e.key === 'fatigue' ? 'is-pos' : 'is-neg') : 'is-flat'
        const val = e.key === 'money' ? `−${formatMoney(Math.abs(e.value))}` : e.key === 'xp' ? `+${e.value} XP` : signed(e.value)
        const label = e.attr ? t(`data.attr.${e.attr}` as never) : lt(e.label)
        return (
          <li key={`${e.key}-${i}`} class={`scn-effect ${e.key === 'money' ? 'is-neg' : tone}`}>
            <span class="scn-effect-label">{label}</span>
            <b class="num">{val}</b>
          </li>
        )
      })}
    </ul>
  )
}

export function MeterShift({ meter }: { meter: NonNullable<SceneOutcome['meter']> }) {
  const d = meter.after - meter.before
  return (
    <div class="scn-meter" role="img" aria-label={t('bench.scene.meterAria', { l: lt(meter.label), a: meter.before, b: meter.after })} data-testid="scene-meter">
      <div class="scn-meter-head">
        <span class="micro">{lt(meter.label)}</span>
        <span class="num scn-meter-val">{meter.before}<Icon name="arrow-right" size={14} />{meter.after}{d !== 0 && <i class={d > 0 ? 't-pos' : 't-neg'}> ({signed(d)})</i>}</span>
      </div>
      <div class="scn-meter-bar" aria-hidden="true">
        <span class="scn-meter-before" style={{ width: `${Math.min(meter.before, meter.after)}%` }} />
        <span class={`scn-meter-delta ${d >= 0 ? 'is-up' : 'is-down'}`} style={{ left: `${Math.min(meter.before, meter.after)}%`, width: `${Math.abs(d)}%` }} />
      </div>
    </div>
  )
}

export function DialogueScene({ scene, onFinish, onQuick, onClose }: {
  scene: Scene
  onFinish: (picks: string[]) => SceneOutcome
  onQuick: () => void
  onClose: () => void
}) {
  const [step, setStep] = useState(0)
  const [picks, setPicks] = useState<string[]>([])
  const [log, setLog] = useState<Line[]>(() => [{ who: 'npc', cast: scene.steps[0]!.who, text: scene.steps[0]!.line }])
  const [outcome, setOutcome] = useState<SceneOutcome | null>(null)
  const [busy, setBusy] = useState(false)
  // How-to card over the scene (every time unless hidden); nothing runs behind it.
  const [howTo, setHowTo] = useState(() => tutorialVisible('dialogue'))
  const logRef = useRef<HTMLOListElement>(null)
  const firstOpt = useRef<HTMLButtonElement>(null)
  const cur = scene.steps[step]
  const total = scene.steps.length

  useEffect(() => {
    document.documentElement.classList.add('trn-drill-open')
    return () => document.documentElement.classList.remove('trn-drill-open')
  }, [])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
    if (!busy && !outcome && !howTo) firstOpt.current?.focus({ preventScroll: true })
  }, [log.length, busy, outcome, howTo])

  const choose = (i: number) => {
    if (busy || outcome || !cur) return
    const o = cur.options[i]
    if (!o) return
    haptic('select')
    const next = [...picks, o.id]
    setPicks(next)
    setBusy(true)
    setLog((l) => [...l, { who: 'hero', cast: -1, text: o.label, tone: o.tone }])
    // The reply lands a beat later, then the next line (a readable rhythm, not a wall of text).
    window.setTimeout(() => {
      setLog((l) => [...l, { who: 'npc', cast: cur.who, text: o.reply }])
      window.setTimeout(() => {
        const ns = scene.steps[step + 1]
        if (ns) {
          setLog((l) => [...l, { who: 'npc', cast: ns.who, text: ns.line }])
          setStep(step + 1)
          setBusy(false)
        } else {
          const r = onFinish(next)
          setOutcome(r)
          setBusy(false)
          haptic(r.ok ? 'success' : 'error')
        }
      }, 520)
    }, 420)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      const n = Number(e.key)
      if (!outcome && n >= 1 && n <= 3) {
        e.preventDefault()
        choose(n - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const speaking = log[log.length - 1]?.who === 'npc' ? log[log.length - 1]!.cast : -1

  return createPortal(
    <div class={`scn ${THEME[scene.id]}`} role="dialog" aria-modal="true" aria-labelledby="scn-title" data-testid={`scene-${scene.id}`}>
      <div class="scn-bg" aria-hidden="true"><i class="scn-glow" /><i class="scn-glow b" /></div>
      <header class="scn-top">
        <span class="scn-top-icon" aria-hidden="true"><Icon name={ICON[scene.id]} size={18} /></span>
        <div class="grow">
          <div class="micro scn-kicker">{lt(scene.kicker)}</div>
          <h2 class="h3 scn-title" id="scn-title">{lt(scene.title)}</h2>
        </div>
        <button type="button" class="scn-close" onClick={onClose} aria-label={t('bench.scene.close')} data-testid="scene-close"><Icon name="close" size={20} /></button>
      </header>

      <div class="scn-cast" data-count={scene.cast.length}>
        {scene.cast.map((c, i) => (
          <figure key={c.name} class={`scn-person${speaking === i ? ' is-speaking' : ''}`}>
            <Avatar appearance={c.appearance} size={scene.cast.length > 1 ? 72 : 92} ring={RING[c.role]} background={null} mood={outcome ? 0.6 : 0.2} age={c.role === 'teammate' ? 26 : 52} label={c.name} />
            <figcaption>
              <b class="scn-name">{c.name}</b>
              <span class="t-xs scn-role">{t(`bench.scene.role.${c.role}` as never)}</span>
              {c.style && (
                <span class="scn-style" title={t(`bench.scene.styleHint.${c.style}` as never)}>
                  <Icon name="sparkle" size={12} /> {t(`bench.scene.style.${c.style}` as never)}
                </span>
              )}
              {c.personality && <span class="scn-style"><Icon name="sparkle" size={12} /> {t(`data.personality.${c.personality}` as never)}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
      {scene.cast[0]?.style && !outcome && <p class="t-xs scn-style-hint">{t(`bench.scene.styleHint.${scene.cast[0].style}` as never)}</p>}

      <ol class="scn-log" ref={logRef} aria-live="polite" aria-relevant="additions">
        {log.map((l, i) => (
          <li key={i} class={`scn-line is-${l.who}`}>
            {l.who === 'npc' && scene.cast.length > 1 && <span class="micro scn-line-who">{scene.cast[l.cast]?.name}</span>}
            {l.who === 'hero' && <span class="micro scn-line-who">{t('bench.scene.you')}{l.tone ? ` · ${lt(l.tone)}` : ''}</span>}
            <p>{lt(l.text)}</p>
          </li>
        ))}
        {busy && <li class="scn-line is-npc is-typing" aria-hidden="true"><p><i /><i /><i /></p></li>}
      </ol>

      {!outcome && cur && (
        <div class="scn-panel">
          <div class="scn-panel-head">
            <span class="micro">{t('bench.scene.choose')}</span>
            <span class="scn-dots" aria-label={t('bench.scene.step', { i: step + 1, n: total })}>
              {scene.steps.map((_, i) => <i key={i} class={i < step ? 'is-done' : i === step ? 'is-cur' : ''} />)}
            </span>
          </div>
          <ol class="scn-options">
            {cur.options.map((o, i) => (
              <li key={`${step}-${o.id}`}>
                <button
                  type="button"
                  class="scn-opt"
                  ref={i === 0 ? firstOpt : undefined}
                  disabled={busy}
                  onClick={() => choose(i)}
                  aria-label={t('bench.scene.choiceAria', { i: i + 1, t: lt(o.label), tone: lt(o.tone) })}
                  data-testid={`scene-opt-${o.id}`}
                >
                  <span class="scn-key" aria-hidden="true">{i + 1}</span>
                  <span class="scn-opt-body">
                    <span class="scn-opt-label">{lt(o.label)}</span>
                    <span class="scn-opt-tone">{lt(o.tone)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div class="scn-foot">
            <Button size="sm" variant="ghost" icon="fast-forward" onClick={onQuick} data-testid="scene-quick">{t('bench.scene.quick')}</Button>
            <span class="t-xs scn-quick-hint">{t('bench.scene.quickHint', { q: lt(scene.quick) })}</span>
          </div>
          <p class="t-xs scn-keys" aria-hidden="true">{t('bench.scene.keys')}</p>
        </div>
      )}

      {outcome && (
        <div class="scn-panel scn-result" aria-live="polite" data-testid="scene-result">
          <div class="micro scn-kicker">{t('bench.scene.resultTitle')}</div>
          {outcome.ok ? (
            <>
              <p class="scn-result-line">{outcome.lines.map((l) => lt(l)).join(' ')}</p>
              {outcome.meter && outcome.meter.before !== outcome.meter.after && <MeterShift meter={outcome.meter} />}
              <EffectChips effects={outcome.effects} />
            </>
          ) : (
            <p class="t-sm t-neg">{outcome.lines[0] ? lt(outcome.lines[0]) : t('bench.scene.notApplied')}</p>
          )}
          <Button variant="primary" block onClick={onClose} autoFocus data-testid="scene-done">{t('bench.scene.done')}</Button>
        </div>
      )}
      {howTo && <TutorialCard tkey="dialogue" onDone={() => setHowTo(false)} />}
    </div>,
    document.body,
  )
}
