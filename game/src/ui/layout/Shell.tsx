/**
 * Responsive app shell.
 *  - Phone portrait: top status bar + content + bottom tab bar (thumb zone).
 *  - ≥ 900px: left sidebar (icon rail until 1200px) + content + right context panel.
 * Safe-area insets are applied on the outer edges.
 */
import type { ComponentChildren } from 'preact'
import { t, tx } from '../../i18n'
import { Avatar, Crest, MeterRing, Money, Button, Badge, FormDots } from '../components'
import { Icon, type IconName } from '../icons'
import { haptic } from '../haptics'
import { activeEvent, actions, data, gameState, heroClub, navigate, screen, settings, type ScreenId } from '../store'
import { Logo } from './Logo'
import { seasonLabel } from '../format'
import { requestAdvance } from '../tutorial/MatchdayConfirm'
import { NewTag } from '../tutorial/UnlockGate'
import { SaveIndicator } from '../components/SaveIndicator'

export type TabId = 'home' | 'career' | 'life' | 'world' | 'menu'

export const TABS: { id: TabId; icon: IconName; screen: ScreenId; key: string }[] = [
  { id: 'home', icon: 'home', screen: 'home', key: '1' },
  { id: 'career', icon: 'career', screen: 'profile', key: '2' },
  { id: 'life', icon: 'life', screen: 'life', key: '3' },
  { id: 'world', icon: 'world', screen: 'world', key: '4' },
  { id: 'menu', icon: 'menu', screen: 'menu', key: '5' },
]

const TAB_OF: Partial<Record<ScreenId, TabId>> = {
  home: 'home', activities: 'home', inbox: 'home', careerLog: 'home', objectives: 'home',
  profile: 'career', training: 'career', club: 'career', contract: 'career', trophies: 'career',
  life: 'life', casino: 'life', blackjack: 'life', roulette: 'life', slots: 'life', horses: 'life',
  world: 'world',
  menu: 'menu', settings: 'menu', saves: 'menu', credits: 'menu', glossary: 'menu',
}
export function tabOf(id: ScreenId): TabId | null {
  return TAB_OF[id] ?? null
}

/** Secondary destinations shown under each tab in the desktop sidebar. */
const SUB: Record<TabId, { screen: ScreenId; icon: IconName }[]> = {
  home: [
    { screen: 'activities', icon: 'calendar' },
    { screen: 'inbox', icon: 'newspaper' },
    { screen: 'careerLog', icon: 'history' },
  ],
  career: [
    { screen: 'training', icon: 'barbell' },
    { screen: 'club', icon: 'shield' },
    { screen: 'contract', icon: 'handshake' },
    { screen: 'trophies', icon: 'trophy' },
  ],
  life: [{ screen: 'casino', icon: 'cards' }],
  world: [],
  menu: [
    { screen: 'saves', icon: 'floppy' },
    { screen: 'settings', icon: 'gear' },
    { screen: 'glossary', icon: 'question' },
  ],
}

function go(id: ScreenId) {
  haptic('select')
  navigate(id, undefined, { tab: true })
}

export function TopBar() {
  const s = gameState.value
  if (!s) return null
  const { calendar: c, life } = s
  const pending = s.pendingEvents.length
  const dateText = `${t('common.weekShort', { n: c.week + 1 })} · ${tx(`data.dayShort.${c.day}`)} · ${tx(`data.slot.${c.slot}`)}`
  return (
    <header class="topbar" aria-label={t('nav.statusBar')}>
      <div class="topbar-brand"><Logo size="sm" sub={false} /></div>
      <div class="topbar-stats" data-tour="status">
        <div class="tstat tstat-money" title={t('ui.topbar.money')}>
          <Icon name="coins" size={16} />
          <span class="sr-only">{t('ui.topbar.money')}</span>
          <Money value={life.money} compact />
        </div>
        <div class="tstat" title={t('ui.topbar.energy')}>
          <Icon name="energy" size={16} class="t-gold" />
          <span class="sr-only">{t('ui.topbar.energy')}</span>
          <span class="tstat-bar" aria-hidden="true"><span style={{ transform: `scaleX(${life.energy / 100})` }} /></span>
          <span class="num">{Math.round(life.energy)}</span>
        </div>
        <div class="tstat tstat-happy" title={t('ui.topbar.happiness')}>
          <Icon name={life.happiness >= 45 ? 'smile' : 'frown'} size={16} />
          <span class="sr-only">{t('ui.topbar.happiness')}</span>
          <span class="num">{Math.round(life.happiness)}</span>
        </div>
      </div>
      <div class="topbar-date" title={t('ui.topbar.date')}>
        <span class="topbar-season micro">{seasonLabel(c.season)}</span>
        <span class="topbar-day">{dateText}</span>
      </div>
      <button
        type="button"
        class="icon-btn icon-btn-ghost topbar-bell"
        data-tour="bell"
        aria-label={`${t('ui.topbar.events')}: ${pending}`}
        onClick={() => (pending ? (activeEvent.value = 0) : navigate('inbox'))}
      >
        <Icon name="bell" size={22} class={pending ? 'bell-ring' : ''} />
        <Badge count={pending} />
      </button>
    </header>
  )
}

export function TabBar() {
  const cur = tabOf(screen.value.id)
  return (
    <nav class="tabbar" aria-label={t('nav.mainNav')}>
      {TABS.map((tb) => {
        const active = cur === tb.id
        return (
          <button
            key={tb.id}
            type="button"
            class={`tabbar-item${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => go(tb.screen)}
          >
            <span class="tabbar-icon"><Icon name={tb.icon} size={24} weight={active ? 2.4 : 2} /></span>
            <span class="tabbar-label">{t(`nav.${tb.id}`)}</span>
          </button>
        )
      })}
    </nav>
  )
}

export function Sidebar() {
  const cur = screen.value.id
  const curTab = tabOf(cur)
  const h = gameState.value?.hero
  const club = heroClub.value
  return (
    <nav class="sidebar" aria-label={t('nav.mainNav')}>
      <div class="sidebar-logo"><Logo size="sm" /></div>
      {h && (
        <button type="button" class="sidebar-hero" onClick={() => go('profile')}>
          <Avatar appearance={h.appearance} size={40} background={club?.colors.primary ?? '#24345a'} shirt={club?.colors.primary} shirtTrim={club?.colors.secondary} />
          <span class="sidebar-hero-text">
            <span class="sidebar-hero-name truncate">{h.firstName} {h.lastName}</span>
            <span class="sidebar-hero-club truncate">{club?.name ?? '—'}</span>
          </span>
        </button>
      )}
      <ul class="sidebar-list">
        {TABS.map((tb) => {
          const active = curTab === tb.id
          return (
            <li key={tb.id}>
              <button
                type="button"
                class={`sidebar-item${active && cur === tb.screen ? ' is-current' : ''}${active ? ' is-active' : ''}`}
                aria-current={cur === tb.screen ? 'page' : undefined}
                onClick={() => go(tb.screen)}
                title={t(`nav.${tb.id}`)}
              >
                <Icon name={tb.icon} size={22} weight={active ? 2.4 : 2} />
                <span class="sidebar-label">{t(`nav.${tb.id}`)}</span>
                <kbd class="sidebar-kbd" aria-hidden="true">{tb.key}</kbd>
              </button>
              {active && SUB[tb.id].length > 0 && (
                <ul class="sidebar-sub">
                  {SUB[tb.id].filter((s) => !(s.screen === 'casino' && settings.value.hideCasino)).map((s) => (
                    <li key={s.screen}>
                      <button
                        type="button"
                        class={`sidebar-subitem${cur === s.screen ? ' is-current' : ''}`}
                        aria-current={cur === s.screen ? 'page' : undefined}
                        onClick={() => navigate(s.screen)}
                        title={tx(`nav.${s.screen}`)}
                      >
                        <Icon name={s.icon} size={18} />
                        <span class="sidebar-label">{tx(`nav.${s.screen}`)}</span>
                        {s.screen === 'casino' && <NewTag feature="casino" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
      <p class="sidebar-hint t-xs t-lo">{t('nav.shortcuts')}</p>
    </nav>
  )
}

export function ContextPanel() {
  const s = gameState.value
  if (!s) return null
  const fx = data.nextFixture()
  const form = data.formHistory()
  const club = heroClub.value
  const pending = s.pendingEvents.length
  const results = (club ? data.leagueTable(club.leagueId)?.find((r) => r.clubId === club.id)?.form : undefined) ?? []
  return (
    <aside class="context-panel" aria-label={t('nav.context')}>
      <div class="ctx-block">
        <h2 class="micro t-mid">{t('ui.ctx.nextMatch')}</h2>
        {fx ? (
          <button type="button" class="ctx-fixture" onClick={() => {
            if (fx.daysUntil === 0) {
              actions.playMatch()
              navigate('preMatch')
            } else navigate('club', { tab: 'fixtures' })
          }}>
            <span class="ctx-team"><Crest crest={fx.home.crest} size={40} /><span class="truncate">{fx.home.shortName}</span></span>
            <span class="ctx-vs">
              <span class="score-font ctx-when">{fx.daysUntil === 0 ? t('common.today') : t('common.inDays', { n: fx.daysUntil })}</span>
              <span class="t-xs t-lo truncate">{fx.compName ? tx('data.comp.' + fx.compType) : ''}</span>
            </span>
            <span class="ctx-team"><Crest crest={fx.away.crest} size={40} /><span class="truncate">{fx.away.shortName}</span></span>
          </button>
        ) : (
          <p class="t-sm t-lo">{t('ui.ctx.noMatch')}</p>
        )}
      </div>
      <div class="ctx-block">
        <h2 class="micro t-mid">{t('ui.ctx.quickStats')}</h2>
        <div class="ctx-rings">
          <MeterRing value={s.life.energy} size={64} label={t('common.energy')} color="var(--accent-gold)" />
          <MeterRing value={s.life.happiness} size={64} label={t('common.happiness')} color="var(--brand-pitch)" />
          <MeterRing value={s.hero.managerTrust} size={64} label={t('ui.ctx.trust')} color="var(--accent-blue)" />
        </div>
        <div class="row-between ctx-form">
          <span class="t-sm t-mid">{t('ui.ctx.form')}</span>
          {/* Club results reset in the off-season while the hero's ratings remain: never say "no matches" next to ratings. */}
          {results.length > 0 || form.length === 0
            ? <FormDots form={results.slice(-5)} />
            : <span class="t-xs t-lo num">{form.slice(-5).map((r) => r.toFixed(1)).join('  ')}</span>}
        </div>
        {results.length > 0 && form.length > 0 && <div class="t-xs t-lo num">{form.slice(-5).map((r) => r.toFixed(1)).join('  ')}</div>}
      </div>
      {pending > 0 && (
        <button type="button" class="ctx-decisions" onClick={() => (activeEvent.value = 0)}>
          <Icon name="bell" size={20} />
          <span class="grow">{t('ui.ctx.decisions')}</span>
          <Badge count={pending} />
        </button>
      )}
      {/* Home has its own Advance bar; a second primary button beside it is noise. */}
      {screen.value.id !== 'home' && (
        <div class="ctx-advance">
          <Button variant="primary" size="lg" block icon="fast-forward" onClick={() => requestAdvance()} haptic="select">
            {tx('home.advance', undefined, t('common.continue'))}
          </Button>
        </div>
      )}
    </aside>
  )
}

export function Shell({ children }: { children: ComponentChildren }) {
  return (
    <div class="shell">
      <a href="#main" class="skip-link">{t('nav.skipToContent')}</a>
      <Sidebar />
      <div class="shell-main">
        <TopBar />
        <main id="main" class="shell-content" tabIndex={-1}>
          {children}
        </main>
      </div>
      <ContextPanel />
      <TabBar />
      <SaveIndicator />
    </div>
  )
}
