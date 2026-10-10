/**
 * How-to card before every mini-game (match moment, training drill, opponent video, doping test,
 * dialogue scene). TestFlight build 6: the old control hints were "seen once" per control group,
 * so after the first few moments no card ever showed again. Now the card shows EVERY time unless
 * the player turned "Mini oyun ipuçları" off or ticked "Bir daha gösterme" for that kind
 * (tutorial/prefs). Card copy lives in tutorial/howTo.ts (one per-kind data source).
 *
 * A modal dialog (focus trap, Enter / Space starts, Esc too). Over a Phaser scene it holds the
 * shared pause gate (game/pauseGate): the moment / drill / clip stays frozen until Start, then the
 * gate's 3-2-1 beat runs before play resumes. Without a scene (doping test) it runs its own 3-2-1.
 */
import '../../styles/screens/help.css'
import { createPortal } from 'preact/compat'
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { lt, t, tx } from '../../i18n'
import type { LText } from '../../core/types'
import { Icon, type IconName } from '../icons'
import { helpPrefs, hideTutorial } from './prefs'
import { pauseGate } from '../../game/pauseGate'
import { gestureFor, inputPlatform, onHintEvent, watchInputPlatform, type HintGroup } from './hints'
import { drillTutorialKey, howToFor, matchTutorialKey, shouldShowTutorial, type HowTo } from './howTo'

function Gesture({ kind, group }: { kind: 'swipe' | 'tap' | 'click' | 'keys'; group: HintGroup }) {
  const label = t(`help.hints.gesture.${kind}`)
  if (kind === 'keys') {
    const pad = inputPlatform.value === 'pad'
    const keys = pad
      ? (group === 'pass' || group === 'defend' || group === 'fitness' || group === 'cross' || group === 'tackleDuel' || group === 'distribute' || group === 'cornerPick' || group === 'wallSet' || group === 'claim' ? ['A'] : group === 'move' ? ['L', 'RT'] : ['B'])
      : group === 'move' || group === 'tackleDuel' || group === 'wallSet' ? ['W', 'A', 'S', 'D'] : group === 'cornerPick' ? ['1', '2', '3', '4'] : group === 'fitness' ? ['␣'] : ['␣']
    return (
      <div class={`hint-gesture hint-keys${pad ? ' is-pad' : ''}`} role="img" aria-label={label}>
        {keys.map((k, i) => <span key={k + i} class="hint-key" style={{ ['--i' as string]: i }}>{k}</span>)}
      </div>
    )
  }
  if (kind === 'click') {
    return (
      <svg class="hint-gesture hint-click" viewBox="0 0 120 70" role="img" aria-label={label}>
        <circle class="hint-target" cx="84" cy="22" r="10" />
        <circle class="hint-ripple" cx="84" cy="22" r="10" />
        <g class="hint-mouse">
          <rect x="22" y="22" width="26" height="40" rx="13" />
          <path d="M35 22v13M22 35h26" />
          <rect class="hint-mouse-btn" x="22" y="22" width="13" height="13" rx="6" />
        </g>
      </svg>
    )
  }
  if (kind === 'tap') {
    return (
      <svg class="hint-gesture hint-tap" viewBox="0 0 120 70" role="img" aria-label={label}>
        <circle class="hint-ripple" cx="60" cy="24" r="12" />
        <circle class="hint-ripple hint-ripple-2" cx="60" cy="24" r="12" />
        <g class="hint-hand hint-hand-tap"><Hand /></g>
      </svg>
    )
  }
  // swipe: a curved arrow toward the goal (bending for shots) with a hand following it.
  const curved = group === 'shoot' || group === 'setPiece'
  return (
    <svg class="hint-gesture hint-swipe" viewBox="0 0 120 70" role="img" aria-label={label}>
      {(group === 'shoot' || group === 'setPiece') && <path class="hint-goal" d="M86 6h28v14" />}
      <path class={`hint-arrow${curved ? ' is-curved' : ''}`} d={curved ? 'M18 62C40 58 52 30 98 14' : 'M18 54L96 22'} pathLength={100} />
      <g class={`hint-hand hint-hand-swipe${curved ? ' is-curved' : ''}`}><Hand /></g>
    </svg>
  )
}

function Hand() {
  return (
    <path
      class="hint-hand-shape"
      d="M0 0c2-1 4 0 4 2v10l1-1c2-1 4 0 4 2v1c2-1 4 0 4 2v1c2-1 4 0 4 2v7c0 6-4 10-10 10h-2c-4 0-7-2-9-5l-6-8c-1-2 0-4 2-4 1 0 2 0 3 1l1 2V2c0-1 1-2 4-2z"
      transform="translate(-4 -2) scale(.9)"
    />
  )
}

const copy = (c: LText | string): string => (typeof c === 'string' ? tx(c) : lt(c))
const ICON: Record<string, IconName> = { scout: 'eye', doping: 'wind', dialogue: 'chat' }
const FOCUSABLE = 'button:not([disabled]), input:not([disabled])'

/** Controls text for the current input platform. */
function controlsText(h: HowTo): string[] {
  const p = inputPlatform.value
  if (h.controls) return [copy(p === 'touch' ? h.controls.touch : h.controls.pc)]
  return h.groups.slice(0, 2).map((g) => tx(`help.hints.${p}.${g}`))
}

/** Show the card for this key now? (master switch + per-kind "don't show again"). */
export const tutorialVisible = (key: string): boolean => shouldShowTutorial(key, helpPrefs.value)

/**
 * The how-to card. `gate`: hold the pause gate (a Phaser scene plays behind it) and wait for the
 * scene to attach before painting. `countdown`: no scene behind: run a DOM 3-2-1 before `onDone`.
 */
export function TutorialCard({ tkey, gate, countdown, onDone }: { tkey: string; gate?: boolean; countdown?: boolean; onDone: () => void }) {
  const how = howToFor(tkey)
  const [ready, setReady] = useState(!gate || pauseGate.isAttached())
  const [dontShow, setDontShow] = useState(false)
  const [beat, setBeat] = useState<number | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const startBtn = useRef<HTMLButtonElement>(null)
  const done = useRef(false)
  const dontRef = useRef(false)
  dontRef.current = dontShow

  // Layout effect: the hold is on before the card is painted, never a frame later.
  useLayoutEffect(() => {
    watchInputPlatform()
    if (!gate) return
    const reason = `hint:${tkey}`
    pauseGate.hold(reason)
    const sync = () => {
      if (pauseGate.isAttached()) setReady(true)
    }
    sync()
    const fallback = setTimeout(() => setReady(true), 4000)
    const offGate = pauseGate.subscribe(sync)
    const off = onHintEvent(() => setReady(true))
    return () => {
      clearTimeout(fallback)
      offGate()
      off()
      pauseGate.release(reason)
    }
  }, [tkey, gate])

  const start = () => {
    if (done.current) return
    done.current = true
    if (dontRef.current) hideTutorial(tkey)
    if (countdown) setBeat(3)
    else onDone()
  }

  // Own 3-2-1 (no scene behind the card).
  useEffect(() => {
    if (beat === null) return
    const id = setTimeout(() => (beat <= 1 ? onDone() : setBeat(beat - 1)), 500)
    return () => clearTimeout(id)
  }, [beat])

  // Focus the start button once painted; trap focus and keys inside the card.
  useEffect(() => {
    if (!ready || beat !== null) return
    startBtn.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      const root = card.current
      if (!root) return
      const target = e.target instanceof Node && root.contains(e.target) ? e.target : null
      if (e.key === 'Tab') {
        const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)]
        const i = items.indexOf(document.activeElement as HTMLElement)
        const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i < 0 || i === items.length - 1 ? 0 : i + 1)
        e.preventDefault()
        items[next]?.focus()
      } else if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ' || e.code === 'Space') {
        // Space on the checkbox toggles it; anything else starts (handled here, not by the button's
        // native keyup click, which a scene's key capture behind the card may cancel).
        if (!(target instanceof HTMLInputElement && e.key !== 'Enter' && e.key !== 'Escape')) {
          e.preventDefault()
          start()
        }
      }
      // Nothing reaches the scene / overlay behind the card while it is up.
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [ready, beat])

  if (!how || (!ready && beat === null)) return null
  const title = copy(how.title)
  const group: HintGroup | undefined = how.groups[0]
  const id = `tut-${tkey.replace(/[^a-z0-9]/gi, '-')}`
  return createPortal(
    <div class={`control-hint tut${beat !== null ? ' is-counting' : ''}`} data-tutorial={tkey} data-testid="tutorial">
      <div class="control-hint-card tut-card" ref={card} role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={`${id}-g`}>
        {beat !== null ? (
          <div class="tut-beat" role="status" aria-live="assertive" aria-label={t('help.howTo.countdown', { n: beat })}>
            <span key={beat}>{beat}</span>
          </div>
        ) : (
          <>
            <div class="tut-head">
              <div class="control-hint-art tut-art" aria-hidden="true">
                {group ? <Gesture kind={gestureFor(group, inputPlatform.value)} group={group} /> : <Icon name={ICON[tkey] ?? 'info'} size={34} />}
              </div>
              <div class="tut-titles">
                <span class="micro control-hint-eyebrow">{t('help.howTo.eyebrow')}</span>
                <h2 class="h3 tut-title" id={`${id}-t`} aria-label={t('help.howTo.dialog', { t: title })}>{title}</h2>
              </div>
            </div>
            <div class="tut-body">
              <section class="tut-sec" id={`${id}-g`}>
                <h3 class="micro tut-label"><Icon name="target" size={14} /> {t('help.howTo.goal')}</h3>
                <p>{copy(how.goal)}</p>
              </section>
              <section class="tut-sec">
                <h3 class="micro tut-label"><Icon name={inputPlatform.value === 'touch' ? 'phone' : 'keyboard'} size={14} /> {t('help.howTo.controls')}</h3>
                {controlsText(how).map((c, i) => <p key={i} class="tut-controls">{c}</p>)}
              </section>
              <section class="tut-sec tut-tip">
                <h3 class="micro tut-label"><Icon name="sparkle" size={14} /> {t('help.howTo.tip')} <span class="tut-attr" data-testid="tutorial-attr">{t(`data.attr.${how.attr}` as never)}</span></h3>
                <p>{lt(how.tip)}</p>
              </section>
            </div>
            <label class="tut-dont">
              <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow((e.target as HTMLInputElement).checked)} aria-describedby={`${id}-d`} data-testid="tutorial-dont-show" />
              <span>{t('help.howTo.dontShow')}</span>
            </label>
            <p class="sr-only" id={`${id}-d`}>{t('help.howTo.dontShowDesc')}</p>
            <button type="button" class="btn btn-primary btn-md btn-block control-hint-close" ref={startBtn} onClick={start} data-testid="tutorial-start">
              <Icon name="play" size={18} /> {t('help.howTo.start')}
            </button>
            {inputPlatform.value !== 'touch' && <p class="t-xs t-lo tut-keys" aria-hidden="true">{t('help.howTo.startHint')}</p>}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** A card keyed to one play: shows when `active` turns on for a new `instance`, if visible for `tkey`. */
export function GameTutorial({ active, tkey, instance, gate = true }: { active: boolean; tkey: string | null; instance?: string; gate?: boolean }) {
  const [open, setOpen] = useState<string | null>(null)
  useLayoutEffect(() => {
    setOpen(active && tkey && tutorialVisible(tkey) ? tkey : null)
  }, [active, tkey, instance])
  if (!open || !active) return null
  return <TutorialCard key={`${open}|${instance ?? ''}`} tkey={open} gate={gate} onDone={() => setOpen(null)} />
}

/** How-to card before every match moment (per moment kind). */
export function MatchHints({ active, kind, momentId }: { active: boolean; kind: string | undefined; momentId: string | undefined }) {
  return <GameTutorial active={active} tkey={kind ? matchTutorialKey(kind) : null} instance={momentId} />
}

/** How-to card before every training drill (per drill / variant). */
export function DrillHints({ active, drill, variant }: { active: boolean; drill: string | undefined; variant: string | undefined }) {
  return <GameTutorial active={active} tkey={drill ? drillTutorialKey(drill, variant) : null} instance={`${drill}|${variant}`} />
}

/** DOM "3 / 2 / 1" over a scene that does not draw the gate's resume beat itself (scouting video). */
export function GateBeat() {
  const [beat, setBeat] = useState<string | null>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const b = pauseGate.beat()
      setBeat((o) => (o === b ? o : b))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  if (!beat) return null
  return <div class="tut-gate-beat" role="status" aria-live="assertive"><span key={beat}>{beat}</span></div>
}
