import '../../styles/screens/settings.css'
import { t, type TKey } from '../../i18n'
import { Page } from '../components'
import { Icon, type IconName } from '../icons'
import { Logo } from '../layout/Logo'
import { gameState } from '../store'

const BLOCKS: { icon: IconName; title: TKey; text: TKey }[] = [
  { icon: 'ball', title: 'title.credits.game', text: 'title.credits.gameText' },
  { icon: 'palette', title: 'title.credits.design', text: 'title.credits.designText' },
  { icon: 'text-aa', title: 'title.credits.fonts', text: 'title.credits.fontsText' },
  { icon: 'star', title: 'title.credits.icons', text: 'title.credits.iconsText' },
  { icon: 'shirt', title: 'title.credits.art', text: 'title.credits.artText' },
  { icon: 'world', title: 'title.credits.world', text: 'title.credits.worldText' },
  { icon: 'scales', title: 'title.credits.licenses', text: 'title.credits.licensesText' },
]

export function CreditsScreen() {
  return (
    <Page title={t('title.credits.title')} sub={t('title.credits.sub')} backTo={gameState.value ? 'menu' : 'title'} showBack>
      <div class="credits">
        <div class="credits-hero">
          <Logo size="md" />
        </div>
        <ol class="credits-roll">
          {BLOCKS.map((b) => (
            <li key={b.title} class="credits-block">
              <span class="credits-icon"><Icon name={b.icon} size={22} /></span>
              <div>
                <h2 class="h3">{t(b.title)}</h2>
                <p class="t-mid">{t(b.text)}</p>
              </div>
            </li>
          ))}
        </ol>
        <p class="credits-thanks">{t('title.credits.thanks')}</p>
      </div>
    </Page>
  )
}
