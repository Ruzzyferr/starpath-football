/** Settings › Help & tips: tips switch, replay/skip tutorial, reset hints, glossary. */
import { t } from '../../i18n'
import { Button, Switch, toast } from '../components'
import { gameState, navigate } from '../store'
import { helpPrefs, resetHints, updateHelp } from './prefs'
import { replayTour, skipTour, tour } from './tour'

export function HelpSettings() {
  const p = helpPrefs.value
  const hasCareer = !!gameState.value
  const active = tour.value.status === 'active'
  return (
    <>
      <Switch label={t('help.settings.tips')} desc={t('help.settings.tipsDesc')} checked={p.tips} onChange={(tips) => updateHelp({ tips })} />
      <div class="help-actions">
        {active ? (
          <Button variant="secondary" icon="skip" onClick={() => skipTour()} data-testid="tour-skip">
            {t('help.settings.skip')}
          </Button>
        ) : (
          <Button
            variant="secondary"
            icon="play"
            disabled={!hasCareer}
            onClick={() => {
              replayTour()
              navigate('home', undefined, { tab: true })
            }}
            data-testid="tour-replay"
          >
            {t('help.settings.replay')}
          </Button>
        )}
        <Button
          variant="ghost"
          icon="history"
          onClick={() => {
            resetHints()
            toast(t('help.settings.resetHintsDone'), 'success')
          }}
        >
          {t('help.settings.resetHints')}
        </Button>
        <Button variant="ghost" icon="question" onClick={() => navigate('glossary')}>
          {t('help.settings.glossary')}
        </Button>
      </div>
      <p class="t-xs t-lo">{hasCareer ? t('help.settings.replayDesc') : t('help.settings.noCareer')}</p>
    </>
  )
}
