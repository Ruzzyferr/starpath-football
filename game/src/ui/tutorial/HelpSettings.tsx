/** Settings › Help & tips: tips switch, mini-game tips switch + "show all again", replay/skip tutorial, glossary. */
import { t } from '../../i18n'
import { Button, Switch, toast } from '../components'
import { gameState, navigate } from '../store'
import { helpPrefs, resetTutorials, updateHelp } from './prefs'
import { replayTour, skipTour, tour } from './tour'

export function HelpSettings() {
  const p = helpPrefs.value
  const hasCareer = !!gameState.value
  const active = tour.value.status === 'active'
  return (
    <>
      <Switch label={t('help.settings.tips')} desc={t('help.settings.tipsDesc')} checked={p.tips} onChange={(tips) => updateHelp({ tips })} />
      <Switch label={t('help.settings.gameTips')} desc={t('help.settings.gameTipsDesc')} checked={p.gameTips} onChange={(gameTips) => updateHelp({ gameTips })} />
      {p.hiddenTutorials.length > 0 && <p class="t-xs t-mid help-hidden-count" data-testid="tutorials-hidden">{t('help.settings.hidden', { n: p.hiddenTutorials.length })}</p>}
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
            resetTutorials()
            toast(t('help.settings.resetHintsDone'), 'success')
          }}
          data-testid="tutorials-reset"
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
