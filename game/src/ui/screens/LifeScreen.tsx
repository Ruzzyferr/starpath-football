import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { t } from '../../i18n'
import '../../styles/screens/life.css'
import '../../styles/screens/phone.css'
import { EmptyState, MeterRing, Page } from '../components'
import { formatCompact } from '../format'
import { Icon, type IconName } from '../icons'
import { gameState, navigate, screen, settings } from '../store'
import { Assets } from './life/Assets'
import { Bank } from './life/Bank'
import { Business } from './life/Business'
import { AppTile, PhoneShell } from './life/Phone'
import { Relations } from './life/Relations'
import { Social } from './life/Social'
import { Projects } from './life/Projects'
import { Sponsors } from './life/Sponsors'
import { AddictionMeter } from './casino/AddictionMeter'
import { InfoTip } from '../tutorial/InfoTip'
import { UnlockGate } from '../tutorial/UnlockGate'
import { features } from '../tutorial/unlocks'

type LifeTab = 'relations' | 'assets' | 'bank' | 'business' | 'social' | 'sponsors' | 'projects'
type AppId = LifeTab | 'casino' | 'inbox'
const TABS: LifeTab[] = ['relations', 'assets', 'bank', 'business', 'projects', 'social', 'sponsors']
const APPS: { id: AppId; icon: IconName }[] = [
  { id: 'relations', icon: 'users' },
  { id: 'bank', icon: 'bank' },
  { id: 'assets', icon: 'house' },
  { id: 'business', icon: 'storefront' },
  { id: 'projects', icon: 'trophy' },
  { id: 'social', icon: 'instagram' },
  { id: 'sponsors', icon: 'handshake' },
  { id: 'casino', icon: 'cards' },
  { id: 'inbox', icon: 'newspaper' },
]
const COLS = 4

export function LifeScreen() {
  const p = screen.value.params?.tab
  const initial = (TABS as string[]).includes(String(p)) ? (p as LifeTab) : null
  const [app, setApp] = useState<LifeTab | null>(initial)
  const [leaving, setLeaving] = useState(false)
  const last = useRef<AppId | null>(null)
  const grid = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const s = gameState.value

  const goHome = useCallback(() => {
    if (settings.value.reducedMotion || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) { setApp(null); return }
    setLeaving(true)
    setTimeout(() => { setApp(null); setLeaving(false) }, 170)
  }, [])

  // Focus follows the phone: heading on open, the launching icon on return.
  useEffect(() => {
    if (app) title.current?.focus({ preventScroll: true })
    else if (last.current) grid.current?.querySelector<HTMLElement>(`[data-app="${last.current}"]`)?.focus({ preventScroll: true })
  }, [app])

  if (!s) return <Page title={t('life.title')}><EmptyState /></Page>
  const l = s.life
  const f = features.value
  const casinoHidden = settings.value.hideCasino || f.casino.reason?.kind === 'age'
  const apps = APPS.filter((a) => !(a.id === 'casino' && casinoHidden))
  const badge = (id: AppId): number | 'new' | 0 => {
    if (id === 'inbox') return s.pendingEvents.length
    if (id === 'sponsors') return f.sponsors.isNew ? 'new' : 0
    if (id === 'bank') return f.investments.isNew ? 'new' : 0
    if (id === 'casino') return f.casino.isNew ? 'new' : 0
    return 0
  }
  const open = (id: AppId) => {
    last.current = id
    if (id === 'casino' || id === 'inbox') { navigate(id); return }
    setLeaving(false)
    setApp(id)
  }
  const onGridKey = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? COLS : e.key === 'ArrowUp' ? -COLS : 0
    if (!d) return
    const items = [...(grid.current?.querySelectorAll<HTMLElement>('.ph-app') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (i < 0) return
    const n = items[i + d]
    if (n) { e.preventDefault(); n.focus() }
  }

  const stats = (cls: string) => (
    <div class={`life-stats ${cls}`} role="group" aria-label={t('life.phone.stats')}>
      <MeterRing value={l.happiness} size={58} stroke={6} label={t('data.stat.happiness')} color="var(--brand-pitch)" />
      <MeterRing value={l.health} size={58} stroke={6} label={t('data.stat.health')} color="var(--accent-blue)" />
      <MeterRing value={l.stress} size={58} stroke={6} label={t('data.stat.stress')} color={l.stress > 65 ? 'var(--state-danger)' : 'var(--accent-gold)'} info={<InfoTip term="stress" />} />
      <MeterRing value={l.discipline} size={58} stroke={6} label={t('data.stat.discipline')} color="var(--accent-violet)" info={<InfoTip term="discipline" />} />
      <div class="life-followers">
        <Icon name="instagram" size={20} />
        <span class="score-font">{formatCompact(l.followers, undefined, 1000)}</span>
        <span class="micro t-mid">{t('data.stat.followers')}</span>
      </div>
    </div>
  )
  const cur = app ? APPS.find((a) => a.id === app) : undefined

  return (
    <Page title={t('life.title')} sub={t('life.sub')} wide showBack={false} class="life-phone-page">
      <div class="ph-layout">
        <PhoneShell open={!!app} leaving={leaving} onHome={goHome}>
          {app && cur ? (
            <div class="ph-app-view" key={app} role="region" aria-labelledby="ph-app-title" data-app={app}>
              <div class="ph-app-bar">
                <button type="button" class="ph-back" onClick={goHome} aria-label={t('life.phone.home')}><Icon name="arrow-left" size={20} /></button>
                <AppTile app={cur.id} icon={cur.icon} size={28} />
                <h2 id="ph-app-title" class="ph-app-title" tabIndex={-1} ref={title}>{t(`life.tabs.${app}`)}</h2>
              </div>
              <AddictionMeter />
              <div class="ph-app-body" id={`life-panel-${app}`}>
                {app === 'relations' && <Relations />}
                {app === 'assets' && <Assets />}
                {app === 'bank' && <Bank />}
                {app === 'business' && <Business />}
                {app === 'projects' && <Projects />}
                {app === 'social' && <Social />}
                {app === 'sponsors' && <UnlockGate feature="sponsors"><Sponsors /></UnlockGate>}
              </div>
            </div>
          ) : (
            <div class="ph-home" role="region" aria-label={t('life.phone.homeLabel')}>
              <div class="ph-widget">{stats('ph-stats-mobile')}</div>
              <AddictionMeter />
              <div class="ph-grid" role="group" aria-label={t('life.tabsLabel')} ref={grid} onKeyDown={onGridKey}>
                {apps.map((a) => {
                  const b = badge(a.id)
                  const label = a.id === 'inbox' ? t('inbox.title') : a.id === 'casino' ? t('life.casinoCta') : t(`life.tabs.${a.id}`)
                  const locked = (a.id === 'casino' && !f.casino.unlocked) || (a.id === 'sponsors' && !f.sponsors.unlocked)
                  return (
                    <button type="button" key={a.id} class="ph-app" data-app={a.id} data-testid={`phone-app-${a.id}`} onClick={() => open(a.id)}>
                      <span class="ph-app-ico">
                        <AppTile app={a.id} icon={a.icon} />
                        {b !== 0 && (
                          <span class="ph-badge" data-kind={b === 'new' ? 'new' : 'count'}>
                            <span aria-hidden="true">{b === 'new' ? '!' : b}</span>
                            <span class="sr-only">{b === 'new' ? t('life.phone.new') : t('life.phone.unread', { n: b })}</span>
                          </span>
                        )}
                        {locked && <span class="ph-lock"><Icon name="lock" size={12} /></span>}
                      </span>
                      <span class="ph-app-label">{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </PhoneShell>
        <aside class="ph-aside" aria-label={t('life.phone.asideTitle')}>
          <h2 class="ph-aside-title">{app ? t(`life.tabs.${app}`) : t('life.phone.asideTitle')}</h2>
          <p class="ph-aside-blurb t-mid">{t(`life.phone.blurb.${app ?? 'home'}`)}</p>
          <ul class="ph-keys t-lo">
            <li><kbd>Arrows</kbd> {t('life.phone.keyMove')}</li>
            <li><kbd>Enter</kbd> {t('life.phone.keyOpen')}</li>
            <li><kbd>Esc</kbd> {t('life.phone.keyBack')}</li>
          </ul>
        </aside>
      </div>
    </Page>
  )
}
