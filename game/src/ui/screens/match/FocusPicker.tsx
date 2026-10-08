/** Pre-match focus mode (GAP 2.1#9): attack / balance / defend shifts the hero's expected moments. */
import { t } from '../../../i18n'
import { Segmented } from '../../components'
import { actions, gameState } from '../../store'

type Focus = 'attack' | 'balance' | 'defend'

export function FocusPicker() {
  const s = gameState.value
  if (!s) return null
  const value: Focus = s.hero.matchFocus ?? 'balance'
  return (
    <div class="pm-card" data-testid="pm-focus">
      <h3 class="micro t-mid">{t('postmatch.pre.focus')}</h3>
      <Segmented<Focus>
        label={t('postmatch.pre.focus')}
        value={value}
        onChange={(f) => actions.setMatchFocus(f)}
        options={[
          { id: 'attack', label: t('postmatch.pre.focusAttack') },
          { id: 'balance', label: t('postmatch.pre.focusBalance') },
          { id: 'defend', label: t('postmatch.pre.focusDefend') },
        ]}
      />
      <p class="t-xs t-lo">{t('postmatch.pre.focusHint')}</p>
    </div>
  )
}
