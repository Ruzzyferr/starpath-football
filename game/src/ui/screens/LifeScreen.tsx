import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import type { RelationKind, Relationship } from '../../core/types'
import { START_YEAR } from '../../core/config'
import { t } from '../../i18n'
import { financeSummary } from '../../sim/game/financeHistory'
import '../../styles/screens/life.css'
import '../../styles/screens/phone.css'
import { EmptyState, MeterRing, Page } from '../components'
import { formatCompact, formatMoney } from '../format'
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

/** Relationships ranked by how long they have waited, ignoring crowd kinds (fans, press, teammates). */
function needAttention(rels: Record<string, Relationship>, week: number, n: number): { rel: Relationship; ago: number }[] {
  const KINDS: RelationKind[] = ['mother', 'father', 'sibling', 'partner', 'bestFriend', 'manager', 'agent', 'chairman']
  const score = (x: { rel: Relationship; ago: number }) => x.ago + (x.rel.value < 0 ? 6 : 0)
  return Object.values(rels)
    .filter((r) => KINDS.includes(r.kind) || r.closeFriend === true)
    .map((rel) => ({ rel, ago: Math.max(0, week - rel.lastContactWeek) }))
    .filter((x) => x.ago >= 3 || x.rel.value < 0)
    .sort((a, b) => score(b) - score(a) || a.rel.value - b.rel.value)
    .slice(0, n)
}

/** Desktop side panel: who needs you, where the money stands, what is waiting in which app. */
function PhoneContext({ badge, apps }: { badge: (id: AppId) => number | 'new' | 0; apps: { id: AppId }[] }) {
  const s = gameState.value
  if (!s) return null
  const week = (s.calendar.season - START_YEAR) * 52 + s.calendar.week
  const people = needAttention(s.life.relationships, week, 3)
  const net = financeSummary(s)?.net.at(-1)
  const pending = apps.map((a) => ({ id: a.id, b: badge(a.id) })).filter((x) => x.b !== 0)
  return (
    <div class="ph-ctx" data-testid="phone-context">
      <section aria-labelledby="ph-ctx-rel">
        <h3 id="ph-ctx-rel" class="ph-ctx-h micro">{t('life.phone.asideAttention')}</h3>
        {people.length === 0 ? (
          <p class="t-sm t-lo">{t('life.phone.asideAttentionNone')}</p>
        ) : (
          <ul class="ph-ctx-list">
            {people.map(({ rel, ago }) => (
              <li key={rel.id}>
                <span class="ph-ctx-name">{rel.name}</span>
                <span class="t-sm t-lo">{t('life.rel.lastContact', { n: ago })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="ph-ctx-money">
        <h3 id="ph-ctx-money" class="ph-ctx-h micro">{t('life.phone.asideMoney')}</h3>
        <dl class="ph-ctx-money">
          <div><dt class="t-sm t-lo">{t('life.phone.asideCash')}</dt><dd class="score-font">{formatMoney(s.life.money)}</dd></div>
          {net !== undefined && (
            <div><dt class="t-sm t-lo">{t('life.phone.asideNet')}</dt><dd class={`score-font ${net < 0 ? 'is-neg' : 'is-pos'}`}>{formatMoney(net, { sign: true })}</dd></div>
          )}
        </dl>
      </section>
      <section aria-labelledby="ph-ctx-badges">
        <h3 id="ph-ctx-badges" class="ph-ctx-h micro">{t('life.phone.asideBadges')}</h3>
        {pending.length === 0 ? (
          <p class="t-sm t-lo">{t('life.phone.asideBadgesNone')}</p>
        ) : (
          <ul class="ph-ctx-list">
            {pending.map(({ id, b }) => (
              <li key={id}>
                <span class="ph-ctx-name">{id === 'inbox' ? t('inbox.title') : id === 'casino' ? t('life.casinoCta') : t(`life.tabs.${id}`)}</span>
                <span class="ph-ctx-badge">{b === 'new' ? t('life.phone.new') : t('life.phone.unread', { n: b })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

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
          <PhoneContext badge={badge} apps={apps} />
          <p class="ph-keys-line t-lo">
            <span><kbd>Arrows</kbd> {t('life.phone.keyMove')}</span>
            <span><kbd>Enter</kbd> {t('life.phone.keyOpen')}</span>
            <span><kbd>Esc</kbd> {t('life.phone.keyBack')}</span>
          </p>
        </aside>
      </div>
    </Page>
  )
}
