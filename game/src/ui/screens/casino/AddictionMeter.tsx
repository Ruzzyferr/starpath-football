import '../../../styles/screens/home.css'
import { t } from '../../../i18n'
import { addictionView } from '../../../sim/game/uiViews'
import { StatBar } from '../../components'
import { gameState, navigate, settings } from '../../store'
import { InfoTip } from '../../tutorial/InfoTip'

/** Gambling addiction meter shown next to happiness; hidden with the casino or while at zero. */
export function AddictionMeter() {
  const s = gameState.value
  if (!s) return null
  const v = addictionView(s, settings.value.hideCasino)
  if (v.hidden || v.value <= 0) return null
  const color = v.level === 'high' ? 'var(--state-danger)' : v.level === 'mid' ? 'var(--accent-gold)' : 'var(--brand-pitch)'
  return (
    <div class="addiction-meter stack" data-testid="addiction-meter" data-level={v.level}>
      <StatBar label={t('casino.responsible.meter')} value={v.value} size="sm" color={color} info={<InfoTip term="addiction" />} />
      <a
        class="addiction-link t-xs"
        href="#casino"
        onClick={(e) => { e.preventDefault(); navigate('casino') }}
      >
        {t('casino.responsible.link')}
      </a>
    </div>
  )
}
