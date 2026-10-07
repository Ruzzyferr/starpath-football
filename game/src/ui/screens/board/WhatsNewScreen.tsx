import '../../../styles/screens/board.css'
import { useEffect } from 'preact/hooks'
import { currentLang, t, type TKey } from '../../../i18n'
import { Button, Page } from '../../components'
import { Icon, type IconName } from '../../icons'
import { back } from '../../store'
import { markWhatsNewSeen } from '../../backend/meta'
import { APP_VERSION } from '../../../telemetry/buildInfo'

const ITEMS: { id: 'f1' | 'f2' | 'f3' | 'f4'; icon: IconName }[] = [
  { id: 'f1', icon: 'flag' },
  { id: 'f2', icon: 'camera' },
  { id: 'f3', icon: 'crown' },
  { id: 'f4', icon: 'download' },
]

export function WhatsNewScreen() {
  void currentLang.value
  useEffect(() => markWhatsNewSeen(APP_VERSION), [])
  return (
    <Page title={t('board.whatsNew.title')} sub={t('board.whatsNew.sub', { v: APP_VERSION })} class="bd-page">
      <ul class="bd-news" data-testid="whats-new">
        {ITEMS.map((it) => (
          <li key={it.id} class="bd-news-item">
            <span class="bd-badge bd-badge-sm" aria-hidden="true"><Icon name={it.icon} size={22} /></span>
            <div class="stack" style={{ gap: '2px' }}>
              <h2 class="h3">{t(`board.whatsNew.${it.id}.title` as TKey)}</h2>
              <p class="t-sm t-mid">{t(`board.whatsNew.${it.id}.text` as TKey)}</p>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="primary" size="lg" block onClick={() => back('menu')}>{t('board.whatsNew.gotIt')}</Button>
    </Page>
  )
}
