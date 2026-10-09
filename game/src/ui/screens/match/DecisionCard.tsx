import { useEffect, useRef, useState } from 'preact/hooks'
import { t, lt } from '../../../i18n'
import { Button, Modal } from '../../components'
import { Icon } from '../../icons'
import { actions, type DecisionView } from '../../store'

const KIND_ICON: Record<string, 'whistle' | 'star' | 'chat'> = {
  penaltyTaker: 'whistle', freeKickTaker: 'whistle', provocation: 'chat', celebrate: 'star', refCall: 'whistle', shout: 'chat', rally: 'chat',
}

/**
 * In-match decision window (GAP 2.4#36/#52/#99). The match is already paused
 * by the sim; this card offers 2-3 options with a countdown. Esc is ignored
 * (persistent modal), keys 1-3 pick an option, the timer can be stopped
 * (WCAG 2.2.1) and it never animates under reduced motion.
 */
export function DecisionCard({ d }: { d: DecisionView }) {
  const [left, setLeft] = useState(d.seconds)
  const [hold, setHold] = useState(false)
  const done = useRef(false)

  const pick = (id: string) => {
    if (done.current) return
    done.current = true
    actions.matchDecide(id)
  }

  useEffect(() => {
    if (hold) return
    const id = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000)
    return () => clearInterval(id)
  }, [hold])

  useEffect(() => {
    if (left <= 0) pick(d.fallback)
  }, [left])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1
      if (Number.isInteger(i) && i >= 0 && i < d.options.length) {
        e.preventDefault()
        pick(d.options[i]!.id)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [d])

  const pct = Math.round((left / d.seconds) * 100)
  return (
    <Modal open persistent hideClose size="sm" class="lm-decision" labelledBy="lm-dec-title" title={<span id="lm-dec-title">{lt(d.title)}</span>}>
      <div data-testid="lm-decision">
        <div class="lm-dec-top">
          <span class="lm-dec-icon" aria-hidden="true"><Icon name={KIND_ICON[d.kind] ?? 'star'} size={22} /></span>
          <span class="micro lm-dec-tag">{t('match.live.decision.tag')}</span>
        </div>
        <p class="lm-dec-prompt">{lt(d.prompt)}</p>
        <div class="lm-dec-opts" role="group" aria-label={lt(d.title)}>
          {d.options.map((o, i) => (
            <Button
              key={o.id}
              variant={o.id === d.fallback ? 'primary' : 'secondary'}
              size="lg"
              block
              autoFocus={i === 0}
              data-testid={`lm-dec-${o.id}`}
              onClick={() => pick(o.id)}
            >
              <span class="lm-dec-opt">
                <b><span class="lm-dec-key" aria-hidden="true">{i + 1}</span>{lt(o.label)}</b>
                <small>{lt(o.hint)}{o.risky ? ` · ${t('match.live.decision.risky')}` : ''}</small>
              </span>
            </Button>
          ))}
        </div>
        <div class="lm-dec-timer">
          <div class="lm-dec-bar" role="progressbar" aria-valuemin={0} aria-valuemax={d.seconds} aria-valuenow={left} aria-label={t('match.live.decision.timer', { s: left })}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <span class="num lm-dec-secs" aria-live="off">{hold ? t('match.live.decision.timerHold') : t('match.live.decision.timer', { s: left })}</span>
          <Button variant="ghost" size="sm" onClick={() => setHold((h) => !h)} aria-pressed={hold}>
            {hold ? t('match.live.decision.resume') : t('match.live.decision.hold')}
          </Button>
        </div>
        <p class="t-xs t-lo lm-dec-note">{t('match.live.decision.auto')} · {t('match.live.decision.note')}</p>
      </div>
    </Modal>
  )
}
