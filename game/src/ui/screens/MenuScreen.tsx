import { useState } from 'preact/hooks'
import '../../styles/screens/settings.css'
import { t, type TKey } from '../../i18n'
import { Avatar, Page, Segmented, toast } from '../components'
import { Icon, type IconName } from '../icons'
import { haptic } from '../haptics'
import { formatDuration, seasonLabel } from '../format'
import { actions, gameState, heroClub, navigate, settings, updateSettings, type ScreenId } from '../store'

interface Tile {
  id: string
  icon: IconName
  title: TKey
  desc: TKey
  to?: ScreenId
  tone?: 'pitch' | 'gold' | 'blue' | 'violet' | 'danger'
}

const TILES: Tile[] = [
  { id: 'saves', icon: 'floppy', title: 'settings.menu.saves', desc: 'settings.menu.savesDesc', to: 'saves', tone: 'blue' },
  { id: 'settings', icon: 'gear', title: 'settings.menu.settings', desc: 'settings.menu.settingsDesc', to: 'settings' },
  { id: 'trophies', icon: 'trophy', title: 'settings.menu.trophies', desc: 'settings.menu.trophiesDesc', to: 'trophies', tone: 'gold' },
  { id: 'careerLog', icon: 'history', title: 'settings.menu.careerLog', desc: 'settings.menu.careerLogDesc', to: 'careerLog', tone: 'violet' },
  { id: 'inbox', icon: 'newspaper', title: 'settings.menu.inbox', desc: 'settings.menu.inboxDesc', to: 'inbox' },
  { id: 'glossary', icon: 'question', title: 'help.glossary.title', desc: 'help.glossary.sub', to: 'glossary', tone: 'blue' },
  { id: 'credits', icon: 'star', title: 'settings.menu.credits', desc: 'settings.menu.creditsDesc', to: 'credits' },
]

export function MenuScreen() {
  const s = gameState.value
  const club = heroClub.value
  const [saving, setSaving] = useState(false)

  const quickSave = async () => {
    setSaving(true)
    try {
      await actions.save()
      toast(t('settings.menu.saved'), 'success', 'floppy')
    } catch {
      toast(t('settings.menu.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page title={t('settings.menu.title')} sub={t('settings.menu.sub')} showBack={false}>
      {s && (
        <div class="menu-hero">
          <Avatar appearance={s.hero.appearance} size={56} background={club?.colors.primary ?? '#24345a'} shirt={club?.colors.primary} shirtTrim={club?.colors.secondary} />
          <div class="grow">
            <div class="h3 truncate">{s.hero.firstName} {s.hero.lastName}</div>
            <div class="t-sm t-mid truncate">{club?.name ?? '—'} · {seasonLabel(s.calendar.season)} · {t('common.week', { n: s.calendar.week + 1 })}</div>
            <div class="t-xs t-lo">{t('settings.menu.playTime')}: <span class="num">{formatDuration(s.meta.playTimeSec)}</span></div>
          </div>
          <div class="menu-lang">
            <Segmented
              label={t('settings.language')}
              value={settings.value.lang}
              onChange={(lang) => updateSettings({ lang })}
              options={[{ id: 'tr', label: 'TR' }, { id: 'en', label: 'EN' }]}
            />
          </div>
        </div>
      )}

      <div class="menu-grid">
        <button type="button" class="menu-tile menu-tile-pitch menu-tile-wide" onClick={() => void quickSave()} disabled={saving || !s} aria-busy={saving || undefined}>
          <span class="menu-tile-icon">{saving ? <span class="btn-spinner" aria-hidden="true" /> : <Icon name="floppy" size={26} />}</span>
          <span class="menu-tile-text">
            <span class="menu-tile-title">{t('settings.menu.quickSave')}</span>
            <span class="menu-tile-desc">{t('settings.menu.quickSaveDesc')}</span>
          </span>
        </button>
        {TILES.map((tile) => (
          <button
            key={tile.id}
            type="button"
            class={`menu-tile menu-tile-${tile.tone ?? 'plain'}`}
            onClick={() => {
              haptic('tap')
              if (tile.to) navigate(tile.to)
            }}
          >
            <span class="menu-tile-icon"><Icon name={tile.icon} size={26} /></span>
            <span class="menu-tile-text">
              <span class="menu-tile-title">{t(tile.title)}</span>
              <span class="menu-tile-desc">{t(tile.desc)}</span>
            </span>
            <Icon name="chevron-right" size={18} class="menu-tile-chev" />
          </button>
        ))}
        <button
          type="button"
          class="menu-tile menu-tile-danger menu-tile-wide"
          onClick={() => {
            haptic('tap')
            navigate('title', undefined, { tab: true })
          }}
        >
          <span class="menu-tile-icon"><Icon name="sign-out" size={26} /></span>
          <span class="menu-tile-text">
            <span class="menu-tile-title">{t('settings.menu.mainMenu')}</span>
            <span class="menu-tile-desc">{t('settings.menu.mainMenuDesc')}</span>
          </span>
        </button>
      </div>
    </Page>
  )
}
