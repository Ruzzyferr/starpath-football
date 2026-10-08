import '../../../styles/screens/home.css'
import { t } from '../../../i18n'
import { comebackView } from '../../../sim/game/uiViews'
import { continueCareer } from '../../backend/meta'
import { Button, Card, CardHeader } from '../../components'
import { gameState, navigate } from '../../store'

/**
 * "Come back or retire?" for 31–33-year-olds after a severe injury.
 * Uses the sim's existing path: continueCareer() = come back, retire screen = hang up the boots.
 */
export function ComebackCard() {
  const s = gameState.value
  const v = s ? comebackView(s) : null
  if (!v) return null
  return (
    <Card class="comeback-card" variant="accent" data-testid="comeback-card" role="region" aria-label={t('meta.comeback.title')}>
      <CardHeader title={t('meta.comeback.title')} icon="bandage" />
      <p class="t-sm">{t('meta.comeback.body', { a: v.age, n: v.weeksLeft })}</p>
      <p class="t-xs t-mid">{t('meta.comeback.hint')}</p>
      <div class="row wrap" style={{ gap: 'var(--sp-2)' }}>
        <Button variant="primary" icon="fire" onClick={() => continueCareer()} data-testid="comeback-stay">{t('meta.comeback.stay')}</Button>
        <Button variant="ghost" icon="crown" onClick={() => navigate('retire')} data-testid="comeback-retire">{t('meta.comeback.retire')}</Button>
      </div>
    </Card>
  )
}
