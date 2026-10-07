/** Global decision-card modal host. Rendered once by App. */
import '../../styles/screens/event.css'
import { useEffect, useState } from 'preact/hooks'
import { lt, t } from '../../i18n'
import { Avatar, Button, DeltaChip, DeltaList, Modal, RiskBadge } from '../components'
import { Icon, type IconName } from '../icons'
import { haptic } from '../haptics'
import { actions, activeEvent, data, gameState, type EventCategory, type EventOutcomeView, type EventView } from '../store'

export const EVENT_ICON: Record<EventCategory, IconName> = {
  team: 'users', family: 'house', love: 'heart', press: 'megaphone', social: 'instagram', fans: 'flag',
  nightlife: 'party', charity: 'hand-heart', business: 'storefront', scam: 'mask', health: 'first-aid',
  legal: 'gavel', national: 'star', rival: 'fire', transfer: 'handshake', awards: 'trophy',
}

/** Two-stop gradient per category (token colours only). */
const EVENT_TONE: Record<EventCategory, [string, string]> = {
  team: ['var(--brand-pitch-deep)', 'var(--brand-pitch)'],
  family: ['var(--accent-blue-deep)', 'var(--accent-blue)'],
  love: ['var(--state-danger-deep)', 'var(--state-danger)'],
  press: ['var(--surface-3)', 'var(--accent-blue)'],
  social: ['var(--accent-violet-deep)', 'var(--accent-violet)'],
  fans: ['var(--brand-pitch-deep)', 'var(--accent-gold)'],
  nightlife: ['var(--accent-violet-deep)', 'var(--state-danger)'],
  charity: ['var(--brand-pitch-deep)', 'var(--accent-blue)'],
  business: ['var(--accent-gold-deep)', 'var(--accent-gold)'],
  scam: ['var(--surface-2)', 'var(--accent-violet)'],
  health: ['var(--state-danger-deep)', 'var(--accent-blue)'],
  legal: ['var(--surface-3)', 'var(--accent-gold-deep)'],
  national: ['var(--state-danger-deep)', 'var(--accent-gold)'],
  rival: ['var(--state-danger-deep)', 'var(--accent-gold-deep)'],
  transfer: ['var(--accent-blue-deep)', 'var(--brand-pitch)'],
  awards: ['var(--accent-gold-deep)', 'var(--accent-gold-hi)'],
}

function EventCard({ ev, total, onResolved }: { ev: EventView; total: number; onResolved: (o: EventOutcomeView) => void }) {
  const [a, b] = EVENT_TONE[ev.category]
  return (
    <div class="evt-card">
      <div class="evt-hero" style={{ ['--evt-a' as string]: a, ['--evt-b' as string]: b }}>
        <div class="evt-hero-pattern" aria-hidden="true" />
        <span class="evt-badge"><Icon name={EVENT_ICON[ev.category]} size={34} weight={2.2} /></span>
        <div class="evt-hero-text">
          <span class="micro evt-cat">{t(`data.eventCat.${ev.category}`)}</span>
          {total > 1 && <span class="micro evt-count">{t('event.counter', { i: ev.index + 1, n: total })}</span>}
        </div>
        {ev.person?.appearance && (
          <span class="evt-person">
            <Avatar appearance={ev.person.appearance} size={64} background="#1b2740" label={ev.person.name} />
          </span>
        )}
      </div>
      <div class="evt-content">
        <h2 class="evt-title" id="evt-title">{lt(ev.title)}</h2>
        {ev.person && (
          <div class="evt-person-line t-sm t-mid">
            <Icon name="user" size={14} /> {ev.person.name}{ev.person.role ? ` · ${lt(ev.person.role)}` : ''}
          </div>
        )}
        <p class="evt-body">{lt(ev.body)}</p>
        <div class="micro t-mid evt-ask">{t('event.choose')}</div>
        <div class="evt-choices">
          {ev.choices.map((c, i) => {
            const blocked = c.requirement ? !c.requirement.met : false
            return (
              <button
                key={i}
                type="button"
                class={`evt-choice risk-${c.risk}`}
                disabled={blocked}
                onClick={() => {
                  haptic('select')
                  onResolved(actions.resolveEvent(ev.index, i))
                }}
              >
                <span class="row-between evt-choice-top">
                  <span class="evt-choice-label">{lt(c.label)}</span>
                  <RiskBadge risk={c.risk} />
                </span>
                {c.requirement && (
                  <span class={`evt-req ${c.requirement.met ? 'is-met' : 'is-unmet'}`}>
                    <Icon name={c.requirement.met ? 'check' : 'lock'} size={13} />
                    {t('event.requires', { text: lt(c.requirement.text) })}
                    {!c.requirement.met && <span class="sr-only"> — {t('event.unmet')}</span>}
                  </span>
                )}
                {c.preview.length > 0 && <DeltaList deltas={c.preview} compact />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Outcome({ out, onContinue, more }: { out: EventOutcomeView; onContinue: () => void; more: boolean }) {
  useEffect(() => {
    haptic(out.success ? 'success' : 'warning')
  }, [out])
  return (
    <div class={`evt-outcome ${out.success ? 'is-success' : 'is-fail'}`}>
      <div class="evt-outcome-burst" aria-hidden="true" />
      <span class="evt-outcome-icon"><Icon name={out.success ? 'check' : 'warning'} size={34} weight={2.6} /></span>
      <div class="micro t-mid">{t('event.outcome')}</div>
      <h2 class="evt-outcome-title" id="evt-title">{out.success ? t('event.success') : t('event.failure')}</h2>
      <p class="evt-body" aria-live="polite">{lt(out.text)}</p>
      {out.deltas.length > 0 ? (
        <div class="evt-outcome-deltas">
          {out.deltas.map((d, i) => (
            <span key={`${d.key}${i}`} class="evt-pop" style={{ animationDelay: `${220 + i * 90}ms` }}>
              <DeltaChip delta={d} />
            </span>
          ))}
        </div>
      ) : (
        <p class="t-sm t-lo">{t('event.noChange')}</p>
      )}
      <Button variant="primary" size="lg" block iconRight={more ? 'arrow-right' : undefined} onClick={onContinue} autoFocus>
        {more ? t('event.nextEvent') : t('event.continue')}
      </Button>
    </div>
  )
}

export function EventModalHost() {
  const idx = activeEvent.value
  const [outcome, setOutcome] = useState<EventOutcomeView | null>(null)
  const total = gameState.value?.pendingEvents.length ?? 0
  if (idx === null) return null
  const ev = outcome ? null : data.eventView(idx)

  const close = () => {
    setOutcome(null)
    activeEvent.value = null
  }
  const next = () => {
    const left = gameState.value?.pendingEvents.length ?? 0
    setOutcome(null)
    activeEvent.value = left > 0 ? 0 : null
  }

  if (!outcome && !ev) {
    return (
      <Modal open onClose={close} title={t('event.title')} size="sm">
        <p class="t-mid">{t('event.missing')}</p>
        <Button variant="secondary" block onClick={close}>{t('common.close')}</Button>
      </Modal>
    )
  }

  return (
    <Modal open onClose={outcome ? undefined : close} persistent={!!outcome} labelledBy="evt-title" size="md" class="evt-modal" hideClose={!!outcome}>
      <div class="evt-stage" key={outcome ? 'out' : `ev${idx}`}>
        {outcome ? (
          <Outcome out={outcome} onContinue={next} more={total > 0} />
        ) : ev ? (
          <EventCard ev={ev} total={total} onResolved={setOutcome} />
        ) : null}
      </div>
      {!outcome && (
        <button type="button" class="evt-later t-sm" onClick={close}>{t('event.later')}</button>
      )}
    </Modal>
  )
}
