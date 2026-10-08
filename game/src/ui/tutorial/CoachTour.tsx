/**
 * Coach-mark overlay for the first-career tour.
 *
 * Spotlights real UI elements by their `data-tour` id, explains them through
 * the coach character and advances on "Next" or when the player performs the
 * step's action (open the planner, plan a slot, advance time). Focus is
 * trapped between the coach card and (for action steps) the highlighted
 * element; ←/→ step back/forward, Esc skips. The overlay steps aside while
 * any modal (decision card, activity picker…) is open.
 */
import '../../styles/screens/help.css'
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { Avatar } from '../components'
import { Icon } from '../icons'
import { activeEvent, data, gameState, navigate, screen, type ScreenId } from '../store'
import { TOUR_STEPS, currentStep } from './machine'
import { dispatchTour, tour } from './tour'

const COACH = { skin: 3, hairStyle: 1, hairColor: 4, beard: 2, eyeColor: 0, face: 2, accessory: 0 } as const
const IMMERSIVE: ReadonlySet<ScreenId> = new Set(['title', 'newCareer', 'preMatch', 'liveMatch', 'postMatch', 'seasonEnd', 'trials', 'retire', 'documentary'])
const PAD = 8
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

interface Rect { x: number; y: number; w: number; h: number }

function findTarget(id: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)
  for (const el of all) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el
  }
  return null
}

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b || (!!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5)

function plannedKey(): string {
  try {
    return data.dayPlan().slots.map((s) => `${s.slot}:${s.activityId ?? ''}`).join('|')
  } catch {
    return ''
  }
}

export function CoachTour() {
  const st = tour.value
  const step = currentStep(st)
  const s = gameState.value
  const route = screen.value.id
  const [rect, setRect] = useState<Rect | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [cardSize, setCardSize] = useState({ w: 0, h: 0 })
  const [vp, setVp] = useState({ w: typeof window !== 'undefined' ? window.innerWidth : 0, h: typeof window !== 'undefined' ? window.innerHeight : 0 })
  const card = useRef<HTMLDivElement>(null)
  const primary = useRef<HTMLButtonElement>(null)
  const navigatedFor = useRef(-1)
  const snap = useRef<{ step: number; cal: string; plan: string }>({ step: -1, cal: '', plan: '' })

  const visible = !!s && !!step && !IMMERSIVE.has(route)
  const calKey = s ? `${s.calendar.season}-${s.calendar.week}-${s.calendar.day}-${s.calendar.slot}` : ''

  // Step start: go to the step's screen once and take snapshots for action detection.
  useEffect(() => {
    if (!visible || !step) return
    if (navigatedFor.current !== st.step) {
      navigatedFor.current = st.step
      if (step.screen && screen.value.id !== step.screen && !(step.id === 'advance' && screen.value.id === 'home')) {
        navigate(step.screen, undefined, { tab: true })
      }
      snap.current = { step: st.step, cal: calKey, plan: plannedKey() }
      requestAnimationFrame(() => {
        if (step.target) findTarget(step.target)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
        primary.current?.focus({ preventScroll: true })
      })
    }
  }, [visible, st.step])

  // Action steps complete themselves.
  useEffect(() => {
    if (!visible || !step?.waitFor || snap.current.step !== st.step) return
    if (step.waitFor === 'openPlanner' && route === 'planner') dispatchTour({ type: 'action', action: 'openPlanner' })
    else if (step.waitFor === 'planSlot' && plannedKey() !== snap.current.plan) dispatchTour({ type: 'action', action: 'planSlot' })
    else if (step.waitFor === 'advance' && calKey !== snap.current.cal) dispatchTour({ type: 'action', action: 'advance' })
  })

  // Follow the target and get out of the way of modals.
  useEffect(() => {
    if (!visible) return
    let raf = 0
    let last: Rect | null = null
    let lastBlocked = false
    const tick = () => {
      const isBlocked = !!document.querySelector('.modal-root') || activeEvent.value !== null
      if (isBlocked !== lastBlocked) {
        lastBlocked = isBlocked
        setBlocked(isBlocked)
      }
      const el = step?.target ? findTarget(step.target) : null
      const r = el?.getBoundingClientRect()
      const next: Rect | null = r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null
      if (!sameRect(next, last)) {
        last = next
        setRect(next)
      }
      if (card.current) {
        const c = card.current.getBoundingClientRect()
        setCardSize((o) => (Math.abs(o.w - c.width) > 1 || Math.abs(o.h - c.height) > 1 ? { w: c.width, h: c.height } : o))
      }
      setVp((o) => (o.w !== window.innerWidth || o.h !== window.innerHeight ? { w: window.innerWidth, h: window.innerHeight } : o))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible, step?.target])

  // Keyboard: focus trap, arrows, Esc.
  useEffect(() => {
    if (!visible || blocked) return
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('.modal-root')) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        dispatchTour({ type: 'skip' })
        return
      }
      const typing = (document.activeElement as HTMLElement | null)?.matches?.('input, textarea, select')
      if (!typing && e.key === 'ArrowRight') {
        e.preventDefault()
        dispatchTour({ type: 'next' })
        return
      }
      if (!typing && e.key === 'ArrowLeft') {
        e.preventDefault()
        dispatchTour({ type: 'back' })
        return
      }
      if (e.key === 'Tab' && card.current) {
        const list: HTMLElement[] = Array.from(card.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (step?.waitFor && step.target) {
          const tgt = findTarget(step.target)
          if (tgt) {
            if (tgt.matches(FOCUSABLE)) list.push(tgt)
            list.push(...Array.from(tgt.querySelectorAll<HTMLElement>(FOCUSABLE)))
          }
        }
        if (!list.length) return
        const i = list.indexOf(document.activeElement as HTMLElement)
        e.preventDefault()
        const n = i < 0 ? 0 : (i + (e.shiftKey ? -1 : 1) + list.length) % list.length
        list[n]!.focus()
      }
      // The App's Space shortcut must not advance time behind the tour (unless that is the step).
      if (e.key === ' ' && step?.waitFor !== 'advance' && document.activeElement === document.body) e.preventDefault()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [visible, blocked, st.step])

  useLayoutEffect(() => {
    if (visible && !blocked) primary.current?.focus({ preventScroll: true })
  }, [blocked])

  if (!visible || !step || blocked) return null

  const n = st.step + 1
  const total = TOUR_STEPS.length
  const isLast = st.step === total - 1
  const name = s!.hero.nickname || s!.hero.firstName
  const hole = rect ? { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 } : null
  const interactive = !!step.waitFor && !!hole

  // Card placement: next to the target when it fits, else docked away from it.
  const margin = 12
  const cw = Math.min(380, vp.w - margin * 2)
  const ch = cardSize.h || 220
  let left = (vp.w - cw) / 2
  let top = (vp.h - ch) / 2
  if (hole) {
    left = Math.max(margin, Math.min(vp.w - cw - margin, hole.x + hole.w / 2 - cw / 2))
    const below = hole.y + hole.h + 12
    const above = hole.y - 12 - ch
    if (below + ch <= vp.h - margin) top = below
    else if (above >= margin) top = above
    else top = hole.y + hole.h / 2 > vp.h / 2 ? margin : vp.h - ch - margin
  }

  const blockers = hole
    ? [
        { left: 0, top: 0, width: vp.w, height: Math.max(0, hole.y) },
        { left: 0, top: hole.y + hole.h, width: vp.w, height: Math.max(0, vp.h - hole.y - hole.h) },
        { left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h },
        { left: hole.x + hole.w, top: hole.y, width: Math.max(0, vp.w - hole.x - hole.w), height: hole.h },
      ]
    : [{ left: 0, top: 0, width: vp.w, height: vp.h }]

  return (
    <div class="coach-root" data-step={step.id}>
      <svg class="coach-scrim" width={vp.w} height={vp.h} aria-hidden="true">
        <path
          fill-rule="evenodd"
          d={`M0 0H${vp.w}V${vp.h}H0Z${hole ? `M${hole.x + 10} ${hole.y}H${hole.x + hole.w - 10}Q${hole.x + hole.w} ${hole.y} ${hole.x + hole.w} ${hole.y + 10}V${hole.y + hole.h - 10}Q${hole.x + hole.w} ${hole.y + hole.h} ${hole.x + hole.w - 10} ${hole.y + hole.h}H${hole.x + 10}Q${hole.x} ${hole.y + hole.h} ${hole.x} ${hole.y + hole.h - 10}V${hole.y + 10}Q${hole.x} ${hole.y} ${hole.x + 10} ${hole.y}Z` : ''}`}
        />
      </svg>
      {hole && <div class={`coach-ring${interactive ? ' is-action' : ''}`} style={{ left: `${hole.x}px`, top: `${hole.y}px`, width: `${hole.w}px`, height: `${hole.h}px` }} aria-hidden="true" />}
      {blockers.map((b, i) => (
        <div key={i} class="coach-block" style={{ left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` }} aria-hidden="true" />
      ))}
      {hole && !interactive && <div class="coach-block" style={{ left: `${hole.x}px`, top: `${hole.y}px`, width: `${hole.w}px`, height: `${hole.h}px` }} aria-hidden="true" />}

      <div
        ref={card}
        class="coach-card"
        role="dialog"
        aria-modal={interactive ? 'false' : 'true'}
        aria-labelledby="coach-title"
        aria-describedby="coach-body"
        style={{ left: `${left}px`, top: `${top}px`, width: `${cw}px` }}
      >
        <div class="coach-head">
          <span class="coach-avatar">
            <Avatar appearance={COACH} size={52} background="#173a2a" shirt="#1fd47a" shirtTrim="#0b1220" age={52} />
          </span>
          <span class="coach-who">
            <span class="coach-name">{t('help.coach.name')}</span>
            <span class="t-xs t-lo">{t('help.coach.role')}</span>
          </span>
          <span class="coach-count micro" aria-label={t('help.coach.stepOf', { n, total })}>{n}/{total}</span>
        </div>
        <h2 class="h3 coach-title" id="coach-title">{t(`help.coach.steps.${step.id}.title`, { name })}</h2>
        <p class="coach-body" id="coach-body">{t(`help.coach.steps.${step.id}.body`)}</p>
        {interactive && <p class="coach-try t-xs"><Icon name="target" size={14} /> {t('help.coach.tryIt')}</p>}
        <div class="coach-dots" aria-hidden="true">
          {TOUR_STEPS.map((x, i) => <span key={x.id} class={i === st.step ? 'is-on' : i < st.step ? 'is-done' : ''} />)}
        </div>
        <div class="coach-actions">
          <button type="button" class="coach-skip" onClick={() => dispatchTour({ type: 'skip' })}>{t('help.coach.skip')}</button>
          <span class="grow" />
          {st.step > 0 && (
            <button type="button" class="btn btn-ghost btn-sm" onClick={() => dispatchTour({ type: 'back' })}>
              <span class="btn-label">{t('help.coach.back')}</span>
            </button>
          )}
          <button ref={primary} type="button" class="btn btn-primary btn-sm coach-next" onClick={() => dispatchTour({ type: 'next' })}>
            <span class="btn-label">{isLast ? t('help.coach.finish') : t('help.coach.next')}</span>
            <Icon name={isLast ? 'check' : 'arrow-right'} size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
