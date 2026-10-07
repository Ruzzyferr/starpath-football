import '../../../styles/screens/intl.css'
import { t } from '../../../i18n'
import { Button, Card } from '../../components'
import { navigate } from '../../store'
import { awardsView } from '../../backend/worldViews'

/** "The awards ceremony is ready" call to action (Home, season review). */
export function CeremonyBanner() {
  const v = awardsView()
  if (!v?.pending) return null
  return (
    <Card pad="md" variant="raised" class="stack" data-testid="ceremony-banner">
      <h3 class="h3">⭐ {t('intl.awards.ceremony')}</h3>
      <p class="t-sm t-mid">{t('intl.awards.ceremonySub', { s: String(v.pending) })}</p>
      <Button variant="gold" icon="medal" onClick={() => navigate('awards')}>{t('intl.awards.watch')}</Button>
    </Card>
  )
}
