/**
 * Responsive app shell.
 *  - Phone portrait: top status bar + content + bottom tab bar (thumb zone).
 *  - ≥ 900px: left sidebar (icon rail until 1200px) + content + right context panel.
 * Safe-area insets are applied on the outer edges.
 */
import { serverWallet, storeAvailable } from '../../store-iap'
import type { ComponentChildren } from 'preact'
import { lt, t, tx } from '../../i18n'
import { Avatar, Crest, MeterRing, Money, Button, Badge, FormDots } from '../components'
import { Icon, type IconName } from '../icons'
import { haptic } from '../haptics'
import { activeEvent, actions, data, gameState, heroClub, navigate, screen, settings, type ScreenId } from '../store'
import { Logo } from './Logo'
import { seasonLabel } from '../format'
import { requestAdvance } from '../tutorial/MatchdayConfirm'
import { NewTag } from '../tutorial/UnlockGate'
import { SaveIndicator } from '../components/SaveIndicator'
import { AVATAR_BG, fameLevel } from '../screens/me/hubData'
import { unreadNews } from '../newsUnread'

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
  profile: 'career', me: 'career', training: 'career', club: 'career', contract: 'career', trophies: 'career',
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
  const club = heroClub.value
  const fame = fameLevel(s.hero.reputation)
  const pending = s.pendingEvents.length
  const unread = pending ? 0 : unreadNews(s.life, c)
  const dateText = `${t('common.weekShort', { n: c.week + 1 })} · ${tx(`data.dayShort.${c.day}`)} · ${tx(`data.slot.${c.slot}`)}`
  return (
    <header class="topbar" aria-label={t('nav.statusBar')}>
      <button
        type="button"
        class={`topbar-me${screen.value.id === 'me' ? ' is-active' : ''}`}
        data-testid="topbar-me"
        aria-label={`${t('hub.open')}: ${t('hub.fame.title')} ${t('hub.fame.level', { n: fame.level })}`}
        onClick={() => go('me')}
      >
        <Avatar appearance={s.hero.appearance} size={34} background={club?.colors.primary ?? AVATAR_BG} shirt={club?.colors.primary} shirtTrim={club?.colors.secondary} />
        <span class={`topbar-me-lvl me-lvl-${fame.level}`} aria-hidden="true"><Icon name="star-fill" size={9} />{fame.level}</span>
      </button>
      <div class="topbar-brand"><Logo size="sm" sub={false} /></div>
      <div class="topbar-stats" data-tour="status">
        <div class="tstat tstat-money" title={t('ui.topbar.money')}>
          <Icon name="coins" size={16} />
          <span class="sr-only">{t('ui.topbar.money')}</span>
          <Money value={life.money} compact />
        </div>
        {/* Each gauge says what it is: icon and value, its name underneath (a bare "94" read as nothing). */}
        <div class="tstat tstat-gauge" title={t('ui.topbar.energy')}>
          <span class="tstat-row">
            <Icon name="energy" size={15} class="t-gold" />
            <span class="num">{Math.round(life.energy)}</span>
          </span>
          <span class="tstat-cap">{lt({ tr: 'Enerji', en: 'Energy' })}</span>
        </div>
        <div class="tstat tstat-gauge tstat-happy" title={t('ui.topbar.happiness')}>
          <span class="tstat-row">
            <Icon name={life.happiness >= 45 ? 'smile' : 'frown'} size={15} />
            <span class="num">{Math.round(life.happiness)}</span>
          </span>
          <span class="tstat-cap">{lt({ tr: 'Mutluluk', en: 'Mood' })}</span>
        </div>
      </div>
      {storeAvailable() && (
        <button type="button" class="tstat tstat-gems" data-testid="topbar-gems" aria-label={lt({ tr: `Mağaza: ${serverWallet.value?.gems ?? 0} elmas`, en: `Store: ${serverWallet.value?.gems ?? 0} diamonds` })} onClick={() => navigate('store')}>
          <span aria-hidden="true">💎</span>
          {/* No shop account yet: name the destination instead of a bare dash. */}
          {serverWallet.value ? <span class="num">{compactGems(serverWallet.value.gems)}</span> : <span class="tstat-gems-label">{lt({ tr: 'Mağaza', en: 'Store' })}</span>}
        </button>
      )}
      <div class="topbar-date" title={t('ui.topbar.date')}>
        <span class="topbar-season micro">{seasonLabel(c.season)}</span>
        <span class="topbar-day">{dateText}</span>
      </div>
      <button
        type="button"
        class="icon-btn icon-btn-ghost topbar-bell"
        data-tour="bell"
        aria-label={unread ? t('ui.topbar.news', { n: unread }) : `${t('ui.topbar.events')}: ${pending}`}
        onClick={() => (pending ? (activeEvent.value = 0) : navigate('inbox'))}
        data-unread={unread || undefined}
      >
        <Icon name="bell" size={22} class={pending ? 'bell-ring' : ''} />
        <Badge count={pending} />
        {unread > 0 && <span class="bell-dot" aria-hidden="true" data-testid="bell-unread" />}
      </button>
    </header>
  )
}

/** 9,999 → "9999", 12,500 → "12.5K": the pill never grows past five characters. */
function compactGems(n: number): string {
  if (n < 10_000) return String(n)
  const k = n / 1000
  return `${k >= 100 ? Math.round(k) : Math.round(k * 10) / 10}K`
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
        <button type="button" class="sidebar-hero" data-testid="sidebar-me" aria-label={t('hub.open')} onClick={() => go('me')}>
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
