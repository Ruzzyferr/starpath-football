import { useState } from 'preact/hooks'
import '../../styles/screens/title.css'
import { t } from '../../i18n'
import { Logo } from '../layout/Logo'
import { Icon, type IconName } from '../icons'
import { haptic } from '../haptics'
import { toast } from '../components'
import { actions, data, gameState, navigate, settings, updateSettings, type SaveSlotInfo, type ScreenId } from '../store'

const VERSION = '0.1.0'

function mostRecentSlot(): SaveSlotInfo | null {
  let slots: SaveSlotInfo[] = []
  try {
    slots = data.saveSlots()
  } catch {
    return null
  }
  let best: SaveSlotInfo | null = null
  for (const s of slots) {
    if (s.empty) continue
    if (!best || (s.updatedAt ?? 0) > (best.updatedAt ?? 0)) best = s
  }
  return best
}

/** Mote positions are fixed so the scene is identical every visit. */
const MOTES = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: 8 + ((i * 53) % 55),
  delay: (i * 0.73) % 9,
  dur: 9 + (i % 5) * 2.2,
  size: 2 + (i % 3),
}))

function StadiumBackdrop() {
  return (
    <div class="title-bg" aria-hidden="true">
      <div class="title-sky" />
      <div class="title-glow" />
      <div class="title-stands" />
      {[1, 2, 3, 4].map((n) => (
        <div key={n} class={`title-tower title-tower-${n}`}>
          <div class="title-cone" />
          <div class="title-lamp">
            {Array.from({ length: 6 }, (_, k) => <span key={k} />)}
          </div>
          <div class="title-mast" />
        </div>
      ))}
      <div class="title-pitch-wrap">
        <div class="title-pitch">
          <svg viewBox="0 0 680 1050" preserveAspectRatio="none" class="title-lines">
            <g fill="none" stroke="currentColor" stroke-width="5">
              <rect x="20" y="20" width="640" height="1010" />
              <path d="M20 525H660" />
              <circle cx="340" cy="525" r="92" />
              <rect x="138" y="20" width="404" height="165" />
              <rect x="248" y="20" width="184" height="55" />
              <rect x="138" y="865" width="404" height="165" />
              <rect x="248" y="975" width="184" height="55" />
              <path d="M266 185a92 92 0 0 0 148 0M266 865a92 92 0 0 1 148 0" />
            </g>
            <circle cx="340" cy="525" r="6" fill="currentColor" />
          </svg>
        </div>
      </div>
      {MOTES.map((m, i) => (
        <span
          key={i}
          class="title-mote"
          style={{ left: `${m.left}%`, top: `${m.top}%`, width: `${m.size}px`, height: `${m.size}px`, animationDelay: `${m.delay}s`, animationDuration: `${m.dur}s` }}
        />
      ))}
      <div class="title-vignette" />
    </div>
  )
}

export function TitleScreen() {
  const [busy, setBusy] = useState(false)
  const s = gameState.value
  const recent = s ? null : mostRecentSlot()
  const canContinue = !!s || !!recent
  const lang = settings.value.lang

  const onContinue = async () => {
    if (s) {
      navigate('home', undefined, { tab: true })
      return
    }
    if (!recent) return
    setBusy(true)
    try {
      const ok = await actions.load(recent.slot)
      if (ok) navigate('home', undefined, { tab: true })
      else toast(t('title.loadFailed'), 'error')
    } catch {
      toast(t('title.loadFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const sub = s
    ? t('title.continueSub', { name: `${s.hero.firstName} ${s.hero.lastName}`, club: s.hero.contract ? (s.world.clubs[s.hero.contract.clubId]?.name ?? '') : '' })
    : recent
      ? t('title.continueSub', { name: recent.heroName ?? '', club: recent.clubName ?? '' })
      : null

  const items: { id: string; icon: IconName; label: string; to: ScreenId }[] = [
    { id: 'new', icon: 'plus', label: t('title.newCareer'), to: 'newCareer' },
    { id: 'load', icon: 'floppy', label: t('title.load'), to: 'saves' },
    { id: 'hallOfFame', icon: 'crown', label: t('meta.menu.hallOfFame'), to: 'hallOfFame' },
    { id: 'achievements', icon: 'medal', label: t('meta.menu.achievements'), to: 'achievements' },
    { id: 'settings', icon: 'gear', label: t('title.settings'), to: 'settings' },
    { id: 'credits', icon: 'star', label: t('title.creditsBtn'), to: 'credits' },
  ]

  return (
    <div class="title-screen">
      <StadiumBackdrop />
      <div class="title-content">
        <div class="title-hero title-enter" style={{ animationDelay: '80ms' }}>
          <Logo size="xl" />
          <p class="title-tagline">{t('title.tagline')}</p>
        </div>
        <nav class="title-menu" aria-label={t('title.title')}>
          <button
            type="button"
            class="title-continue btn btn-primary btn-lg btn-block title-enter"
            style={{ animationDelay: '220ms' }}
            disabled={!canContinue || busy}
            aria-busy={busy || undefined}
            onClick={() => {
              haptic('select')
              void onContinue()
            }}
          >
            {busy ? <span class="btn-spinner" aria-hidden="true" /> : <Icon name="play" size={20} />}
            <span class="title-continue-text">
              <span class="btn-label">{t('title.continue')}</span>
              {sub && <span class="title-continue-sub">{sub}</span>}
            </span>
          </button>
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              class="title-item title-enter"
              style={{ animationDelay: `${300 + i * 60}ms` }}
              onClick={() => {
                haptic('tap')
                navigate(it.to)
              }}
            >
              <Icon name={it.icon} size={20} />
              <span class="grow">{it.label}</span>
              <Icon name="chevron-right" size={18} class="title-item-chev" />
            </button>
          ))}
        </nav>
        <footer class="title-foot title-enter" style={{ animationDelay: '600ms' }}>
          <div class="title-lang" role="radiogroup" aria-label={t('title.language')}>
            <Icon name="language" size={18} />
            {(['tr', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={lang === l}
                class={`title-lang-opt${lang === l ? ' is-active' : ''}`}
                onClick={() => {
                  haptic('select')
                  updateSettings({ lang: l })
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <span class="title-version">{t('title.version', { v: VERSION })}</span>
        </footer>
      </div>
    </div>
  )
}
