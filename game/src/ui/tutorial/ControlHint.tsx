/**
 * Contextual control hint drawn over a Phaser scene (match moment / drill).
 * Platform-aware text + an animated gesture illustration. It never blocks the
 * play area (pointer-events: none) except for its small "Got it" button, and
 * it disappears once the player performs the hinted action successfully.
 */
import '../../styles/screens/help.css'
import { useEffect, useState } from 'preact/hooks'
import { t, tx } from '../../i18n'
import { Icon } from '../icons'
import { helpPrefs, hintSeen, markHintSeen } from './prefs'
import {
  gestureFor, hintId, inputPlatform, isHintSuccess, onHintEvent, pickDrillHint, pickMatchHint, watchInputPlatform,
  type HintContext, type HintGroup, type InputPlatform,
} from './hints'

const PLATFORM_KEY: Record<InputPlatform, 'touch' | 'mouse' | 'pad'> = { touch: 'touch', mouse: 'mouse', pad: 'pad' }

function Gesture({ kind, group }: { kind: 'swipe' | 'tap' | 'click' | 'keys'; group: HintGroup }) {
  const label = t(`help.hints.gesture.${kind}`)
  if (kind === 'keys') {
    const pad = inputPlatform.value === 'pad'
    const keys = pad
      ? (group === 'pass' || group === 'defend' || group === 'fitness' || group === 'cross' || group === 'tackleDuel' ? ['A'] : group === 'move' ? ['L', 'RT'] : ['B'])
      : group === 'move' || group === 'tackleDuel' ? ['W', 'A', 'S', 'D'] : group === 'fitness' ? ['␣'] : ['␣']
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

/** One hint card. `onDone` fires after success or dismissal. */
export function ControlHint({ ctx, group, onDone }: { ctx: HintContext; group: HintGroup; onDone: () => void }) {
  const [success, setSuccess] = useState(false)
  // Appear once the scene is actually running (first gameplay event), not over the loading screen.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    watchInputPlatform()
    const fallback = setTimeout(() => setReady(true), 4000)
    const off = onHintEvent(() => setReady(true))
    return () => {
      clearTimeout(fallback)
      off()
    }
  }, [])
  useEffect(() => {
    if (success) return
    return onHintEvent((e, heroId) => {
      if (!isHintSuccess(group, e, heroId)) return
      markHintSeen(hintId(ctx, group))
      setSuccess(true)
    })
  }, [ctx, group, success])
  useEffect(() => {
    if (!success) return
    const id = setTimeout(onDone, 1100)
    return () => clearTimeout(id)
  }, [success])

  if (!ready && !success) return null
  const platform = PLATFORM_KEY[inputPlatform.value]
  const text = tx(`help.hints.${platform}.${group}`)
  const gesture = gestureFor(group, inputPlatform.value)
  return (
    <div class={`control-hint${success ? ' is-success' : ''}`} role="status" aria-live="polite" data-hint={hintId(ctx, group)}>
      <div class="control-hint-card">
        <div class="control-hint-art" aria-hidden={success}>
          {success ? <span class="control-hint-check"><Icon name="check" size={30} /></span> : <Gesture kind={gesture} group={group} />}
        </div>
        <div class="control-hint-text">
          <span class="micro control-hint-eyebrow">{t('help.hints.title')}</span>
          <p>{text}</p>
        </div>
        {!success && (
          <button
            type="button"
            class="control-hint-close"
            onClick={() => {
              markHintSeen(hintId(ctx, group))
              onDone()
            }}
          >
            {t('help.hints.gotIt')}
          </button>
        )}
      </div>
    </div>
  )
}

/** Shows the first unlearned hint for the live highlight (while it is on screen). */
export function MatchHints({ active, kind, momentId }: { active: boolean; kind: string | undefined; momentId: string | undefined }) {
  const [group, setGroup] = useState<HintGroup | null>(null)
  useEffect(() => {
    setGroup(active && kind && helpPrefs.value.tips ? pickMatchHint(kind, hintSeen) : null)
  }, [active, momentId])
  if (!group || !active) return null
  return <ControlHint ctx="match" group={group} onDone={() => setGroup(null)} />
}

/** First-run hint for a training drill. */
export function DrillHints({ active, drill, variant }: { active: boolean; drill: string | undefined; variant: string | undefined }) {
  const [group, setGroup] = useState<HintGroup | null>(null)
  useEffect(() => {
    setGroup(active && drill && helpPrefs.value.tips ? pickDrillHint(drill, variant, hintSeen) : null)
  }, [active, drill, variant])
  if (!group || !active) return null
  return <ControlHint ctx="drill" group={group} onDone={() => setGroup(null)} />
}
