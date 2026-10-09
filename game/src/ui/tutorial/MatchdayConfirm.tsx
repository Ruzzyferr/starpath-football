/**
 * Matchday guard: pressing "Advance" while today's match is due would let the
 * sim play it silently (realActions.advance). Every Advance entry point calls
 * {@link requestAdvance}, which asks "Play / Sim / Cancel" first.
 */
import { signal } from '@preact/signals'
import { t } from '../../i18n'
import { Button, Modal, toastAction } from '../components'
import { Icon } from '../icons'
import { actions, activeEvent, data, gameState, navigate, type FixtureView } from '../store'

/** Selector: today's hero match is due now and would be simulated by Advance. */
export function matchDueNow(): FixtureView | null {
  const s = gameState.value
  if (!s) return null
  const h = s.hero
  if (h.retired || !h.contract || h.injury || h.suspendedMatches > 0) return null
  if (s.calendar.slot < 1) return null
  let fx: FixtureView | null = null
  try {
    fx = data.nextFixture()
  } catch {
    return null
  }
  return fx && fx.daysUntil === 0 && !fx.result ? fx : null
}

export const matchdayPrompt = signal<FixtureView | null>(null)

/** Use instead of `actions.advance()` from any UI entry point. */
export function requestAdvance(): void {
  const fx = matchDueNow()
  if (fx) {
    matchdayPrompt.value = fx
    return
  }
  actions.advance()
}

/**
 * "Skip to match day" from any UI entry point. Never a silent no-op (iOS
 * playtest): a pending decision card blocks the calendar, so the tap says so
 * and offers to open it; at kick-off time it asks Play / Sim / Cancel.
 */
export function requestSkipToMatch(): void {
  const s = gameState.value
  if (!s) return
  if (s.pendingEvents.length > 0) {
    toastAction(t('home.skipBlockedDecision'), t('home.skipOpenDecision'), () => {
      activeEvent.value = 0
    })
    return
  }
  const fx = matchDueNow()
  if (fx) {
    matchdayPrompt.value = fx
    return
  }
  actions.advanceToMatch()
}

export function MatchdayConfirmHost() {
  const fx = matchdayPrompt.value
  if (!fx) return null
  const close = () => (matchdayPrompt.value = null)
  return (
    <Modal
      open
      onClose={close}
      title={t('help.matchday.title')}
      size="sm"
      class="mdc"
      labelledBy="mdc-title"
    >
      <p class="t-mid mdc-body">{t('help.matchday.body', { home: fx.home.shortName, away: fx.away.shortName })}</p>
      <div class="mdc-actions">
        <button
          type="button"
          class="mdc-option mdc-play"
          autoFocus
          onClick={() => {
            close()
            actions.playMatch()
            navigate('preMatch')
          }}
        >
          <span class="mdc-option-icon"><Icon name="ball" size={24} /></span>
          <span class="mdc-option-text">
            <span class="mdc-option-title">{t('help.matchday.play')}</span>
            <span class="t-xs mdc-option-desc">{t('help.matchday.playDesc')}</span>
          </span>
        </button>
        <button
          type="button"
          class="mdc-option mdc-sim"
          onClick={() => {
            close()
            actions.advance()
          }}
        >
          <span class="mdc-option-icon"><Icon name="fast-forward" size={24} /></span>
          <span class="mdc-option-text">
            <span class="mdc-option-title">{t('help.matchday.sim')}</span>
            <span class="t-xs mdc-option-desc">{t('help.matchday.simDesc')}</span>
          </span>
        </button>
        <Button variant="ghost" block onClick={close}>{t('help.matchday.cancel')}</Button>
      </div>
    </Modal>
  )
}
