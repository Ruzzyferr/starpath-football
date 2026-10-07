import '../../styles/screens/home.css'
import { NationalCard } from './national/NationalCard'
import { CeremonyBanner } from './awards/CeremonyBanner'
import type { Attributes, Hero, Position } from '../../core/types'
import { lt, t, tx } from '../../i18n'
import {
  Badge, Button, Card, Chip, Crest, EmptyState, MeterRing, Page, PlayerCard, SectionTitle, Sparkline, StatBar,
} from '../components'
import { ageOf, ratingColor, seasonLabel } from '../format'
import { Icon, type IconName } from '../icons'
import { haptic } from '../haptics'
import { actions, activeEvent, data, gameState, heroClub, navigate, type ScreenId } from '../store'
import { InfoTip } from '../tutorial/InfoTip'
import { requestAdvance } from '../tutorial/MatchdayConfirm'
import { LockChip, NewTag } from '../tutorial/UnlockGate'
import { features } from '../tutorial/unlocks'

type AttrKey = keyof Attributes

/** FUT-style six headline stats by position. */
export function cardStatKeys(pos: Position): AttrKey[] {
  if (pos === 'GK') return ['reflexes', 'handling', 'positioning', 'jumping', 'composure', 'passing']
  if (pos === 'CB' || pos === 'DM') return ['pace', 'tackling', 'heading', 'strength', 'passing', 'positioning']
  if (pos === 'LB' || pos === 'RB') return ['pace', 'tackling', 'crossing', 'stamina', 'passing', 'dribbling']
  return ['pace', 'shooting', 'passing', 'dribbling', 'tackling', 'strength']
}

export function heroCardStats(h: Hero) {
  return cardStatKeys(h.position).map((k) => ({ label: t(`data.attrShort.${k}`), value: h.attrs[k] }))
}

const TILES: { id: 'planner' | 'training' | 'life' | 'contract' | 'club' | 'inbox' | 'casino' | 'world'; icon: IconName; screen: ScreenId }[] = [
  { id: 'planner', icon: 'calendar', screen: 'planner' },
  { id: 'training', icon: 'barbell', screen: 'training' },
  { id: 'life', icon: 'life', screen: 'life' },
  { id: 'contract', icon: 'handshake', screen: 'contract' },
  { id: 'club', icon: 'shield', screen: 'club' },
  { id: 'inbox', icon: 'newspaper', screen: 'inbox' },
  { id: 'casino', icon: 'cards', screen: 'casino' },
  { id: 'world', icon: 'world', screen: 'world' },
]

const GREETING = ['morning', 'afternoon', 'evening'] as const

export function HomeScreen() {
  const s = gameState.value
  if (!s) return <Page title={t('home.title')}><EmptyState /></Page>
  const { hero: h, life, calendar: cal } = s
  const club = heroClub.value
  const fx = data.nextFixture()
  const form = data.formHistory()
  const ovr = data.heroOvr()
  const ovrHist = data.ovrHistory()
  const pending = s.pendingEvents.length
  const age = ageOf(h.birthYear, cal)
  const c1 = club?.colors.primary ?? '#1fd47a'
  const c2 = club?.colors.secondary ?? '#3da5ff'
  const greet = GREETING[Math.max(0, Math.min(2, cal.slot))]
  // Newest first (the sim appends; reverse before the stable sort by date).
  const news = [...life.news].reverse().sort((a, b) => b.season - a.season || b.week - a.week).slice(0, 3)
  const matchToday = fx?.daysUntil === 0
  const yearsLeft = h.contract ? Math.max(0, h.contract.untilSeason - cal.season) : 0

  const tileSub = (id: (typeof TILES)[number]['id']): string => {
    switch (id) {
      case 'contract':
        return h.contract ? t('home.tileSub.contract', { n: yearsLeft }) : t('home.tileSub.contractNone')
      case 'inbox':
        return t('home.tileSub.inbox', { n: life.news.length })
      default:
        return t(`home.tileSub.${id}`)
    }
  }

  return (
    <Page
      title={t(`home.greeting.${greet}`, { name: h.nickname || h.firstName })}
      sub={`${seasonLabel(cal.season)} · ${t('common.week', { n: cal.week + 1 })} · ${tx(`data.day.${cal.day}`)}`}
      showBack={false}
      footer={
        <div class="home-cta">
          <Button variant="ghost" icon="skip" onClick={() => actions.advanceToMatch()} class="home-cta-auto">
            {t('home.autoToMatch')}
          </Button>
          <Button variant="primary" size="lg" icon="fast-forward" class="home-cta-main" haptic="select" onClick={() => requestAdvance()} title={t('home.advanceHint')} data-tour="advance">
            {t('home.advance')}
          </Button>
        </div>
      }
    >
      <div class="home-grid">
        <div class="home-col">
          {/* Today / next match */}
          <article class="home-today" style={{ ['--c1' as string]: c1, ['--c2' as string]: c2 }}>
            <div class="home-today-lines" aria-hidden="true" />
            <div class="home-today-top">
              <div>
                <div class="micro home-today-eyebrow">{t('home.today')}</div>
                <div class="home-today-day">{tx(`data.day.${cal.day}`)}</div>
                <div class="home-today-slot">
                  <Icon name={cal.slot === 0 ? 'sunrise' : cal.slot === 1 ? 'sun' : 'moon'} size={16} />
                  {t('home.slotNow', { slot: tx(`data.slot.${cal.slot}`) })}
                </div>
              </div>
              {club && <Crest crest={club.crest} size={52} label={club.name} />}
            </div>

            {(h.injury || h.suspendedMatches > 0) && (
              <div class="home-alert" role="status">
                <Icon name={h.injury ? 'bandage' : 'yellow-card'} size={18} />
                {h.injury
                  ? t('home.injured', { name: lt(h.injury.name), n: h.injury.weeksLeft })
                  : t('home.suspended', { n: h.suspendedMatches })}
              </div>
            )}

            {fx ? (
              <div class={`home-fixture${matchToday ? ' is-today' : ''}`} data-tour="fixture">
                <div class="home-fixture-head">
                  <span class="micro">{matchToday ? t('home.matchToday') : t('home.nextMatch')}</span>
                  <span class="t-xs home-fixture-comp truncate">{lt(fx.compName)}</span>
                </div>
                <div class="home-fixture-body">
                  <div class="home-team">
                    <Crest crest={fx.home.crest} size={56} />
                    <span class="home-team-name truncate">{fx.home.shortName}</span>
                  </div>
                  <div class="home-countdown">
                    {matchToday ? (
                      <span class="home-countdown-live"><span class="home-live-dot" aria-hidden="true" />{t('common.today')}</span>
                    ) : (
                      <>
                        <span class="score-font home-countdown-n">{fx.daysUntil}</span>
                        <span class="micro t-mid">{fx.daysUntil === 1 ? t('home.kickoffTomorrow') : t('home.kickoffIn', { n: fx.daysUntil })}</span>
                      </>
                    )}
                  </div>
                  <div class="home-team">
                    <Crest crest={fx.away.crest} size={56} />
                    <span class="home-team-name truncate">{fx.away.shortName}</span>
                  </div>
                </div>
                <div class="home-fixture-foot">
                  <Chip tone={fx.isHome ? 'pos' : 'info'} icon={fx.isHome ? 'house' : 'airplane'}>
                    {fx.isHome ? t('home.home') : t('home.away')}
                  </Chip>
                  <span class="t-xs t-mid truncate"><Icon name="map-pin" size={13} /> {fx.venue}</span>
                </div>
                {matchToday && (
                  <Button
                    variant="gold"
                    size="lg"
                    block
                    icon="ball"
                    haptic="heavy"
                    onClick={() => {
                      actions.playMatch()
                      navigate('preMatch')
                    }}
                  >
                    {t('home.playMatch')}
                  </Button>
                )}
              </div>
            ) : (
              <div class="home-fixture home-fixture-empty" data-tour="fixture">
                <Icon name="calendar" size={22} />
                <div>
                  <div class="h3">{t('home.noMatch')}</div>
                  <div class="t-sm t-mid">{t('home.noMatchHint')}</div>
                </div>
              </div>
            )}
          </article>

          {pending > 0 && (
            <button type="button" class="home-decisions" onClick={() => { haptic('select'); activeEvent.value = 0 }}>
              <span class="home-decisions-icon"><Icon name="bell" size={22} class="bell-ring" /><Badge count={pending} /></span>
              <span class="grow">
                <span class="home-decisions-title">{t('home.decisions')}</span>
                <span class="t-sm t-mid">{t('home.decisionsText', { n: pending })}</span>
              </span>
              <span class="home-decisions-go">{t('home.decide')}<Icon name="chevron-right" size={18} /></span>
            </button>
          )}

          <section aria-labelledby="home-quick">
            <SectionTitle id="home-quick">{t('home.quick')}</SectionTitle>
            <div class="home-tiles">
              {TILES.map((tile) => {
                const locked = tile.id === 'casino' && !features.value.casino.unlocked
                return (
                  <button key={tile.id} type="button" class={`home-tile home-tile-${tile.id}${locked ? ' is-feature-locked' : ''}`} onClick={() => navigate(tile.screen)} data-tour={`tile-${tile.id}`}>
                    <span class="home-tile-icon"><Icon name={locked ? 'lock' : tile.icon} size={22} /></span>
                    <span class="home-tile-label">{t(`home.tiles.${tile.id}`)}{tile.id === 'casino' && <> <NewTag feature="casino" /></>}</span>
                    {locked ? <LockChip feature="casino" /> : <span class="home-tile-sub truncate">{tileSub(tile.id)}</span>}
                  </button>
                )
              })}
            </div>
          </section>

          <section aria-labelledby="home-news">
            <SectionTitle id="home-news" action={<Button variant="ghost" size="sm" iconRight="chevron-right" onClick={() => navigate('inbox')}>{t('common.seeAll')}</Button>}>
              {t('home.headlines')}
            </SectionTitle>
            {news.length === 0 ? (
              <p class="t-sm t-lo">{t('home.noNews')}</p>
            ) : (
              <ol class="home-news">
                {news.map((n, i) => (
                  <li key={n.id}>
                    <button type="button" class={`home-news-item sent-${n.sentiment > 0 ? 'pos' : n.sentiment < 0 ? 'neg' : 'neu'}`} onClick={() => navigate('inbox')}>
                      <span class="home-news-num score-font" aria-hidden="true">{i + 1}</span>
                      <span class="grow">
                        <span class="home-news-head">{lt(n.headline)}</span>
                        <span class="t-xs t-lo">{n.source} · {t('common.weekShort', { n: n.week + 1 })}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div class="home-col home-col-side">
          <Card class="home-condition" data-tour="condition">
            <div class="home-rings">
              <MeterRing value={life.energy} size={84} label={t('common.energy')} color="var(--accent-gold)" icon="energy" info={<InfoTip term="energy" />} />
              <MeterRing value={life.happiness} size={84} label={t('common.happiness')} color="var(--brand-pitch)" icon={life.happiness >= 45 ? 'smile' : 'frown'} info={<InfoTip term="happiness" />} />
              <MeterRing value={h.morale} size={84} label={t('home.morale')} color="var(--accent-violet)" icon="fire" info={<InfoTip term="morale" />} />
            </div>
            <div class="home-bars">
              <StatBar label={t('home.form')} value={h.form} size="sm" color="var(--accent-blue)" info={<InfoTip term="form" />} />
              <StatBar label={t('home.sharpness')} value={h.sharpness} size="sm" color="var(--brand-pitch)" info={<InfoTip term="sharpness" />} />
              <StatBar label={t('home.fatigue')} value={h.fatigue} size="sm" color={h.fatigue > 70 ? 'var(--state-danger)' : 'var(--state-warning)'} info={<InfoTip term="fatigue" />} />
            </div>
            <div class="home-form">
              <div class="row-between">
                <span class="micro t-mid">{t('home.formTrend')}</span>
                {form.length > 0 && (
                  <span class="score-font home-form-last" style={{ color: ratingColor(form[form.length - 1]) }}>
                    {form[form.length - 1].toFixed(1)}
                  </span>
                )}
              </div>
              <Sparkline values={form} width={280} height={44} min={4} max={10} color="var(--brand-pitch)" />
            </div>
          </Card>

          <CeremonyBanner />
          <NationalCard />

          <Card class="home-cardteaser" variant="raised">
            <div class="home-cardteaser-body">
              <PlayerCard
                name={`${h.firstName} ${h.lastName}`}
                ovr={ovr}
                position={h.position}
                appearance={h.appearance}
                stats={heroCardStats(h)}
                crest={club?.crest}
                flag={s.world.countries[h.nationality] ? { id: h.nationality, colors: s.world.countries[h.nationality].flag } : undefined}
                shirt={club?.colors.primary}
                age={age}
                size="sm"
              />
              <div class="home-cardteaser-info">
                <span class="micro t-mid">{t('home.yourCard')}</span>
                <span class="h2">{h.firstName} {h.lastName}</span>
                <span class="t-sm t-mid">{t(`data.posLong.${h.position}`)} · {t('common.ageN', { n: age })}</span>
                {ovrHist.length > 1 && (
                  <div class="home-ovr-trend">
                    <span class="micro t-lo">{t('home.ovrTrend')}</span>
                    <Sparkline values={ovrHist} width={140} height={32} color="var(--accent-gold)" />
                  </div>
                )}
                <Button variant="secondary" size="sm" iconRight="chevron-right" onClick={() => navigate('profile', undefined, { tab: true })}>
                  {t('home.viewProfile')}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Page>
  )
}
