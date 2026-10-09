import '../../../styles/screens/match.css'
import { t, lt, tx, currentLang } from '../../../i18n'
import { Button, Chip, Crest, EmptyState, FormDots, IconButton } from '../../components'
import { Icon } from '../../icons'
import { formatNumber } from '../../format'
import { onColor } from '../../art/svg'
import { ROLE_EXPECTED_MINUTES, ROLE_NAMES } from '../../../sim/career/squadRole'
import { startChance } from '../../../sim/game/whyPlaying'
import { back, data, gameState, navigate, type LineupPlayer, type PreMatchView, type TeamView } from '../../store'
import { MOMENT_ICON, PitchLinesVertical, WEATHER_ICON } from './shared'
import { FocusPicker } from './FocusPicker'
import { layoutTeam, type LayoutOut } from './pitchLayout'

function Disc({ p, team, side, box, you }: { p: LineupPlayer; team: TeamView; side: 'home' | 'away'; box: LayoutOut; you: string }) {
  // Home occupies the bottom half (own goal at the bottom), away the top half;
  // positions come from the collision-aware layout (pitchLayout.ts).
  const bg = team.kit.primary
  const surname = p.name.split(' ').slice(-1)[0] ?? p.name
  const full = `${p.number} ${p.name} · ${tx(`data.pos.${p.position}`)} · ${p.ovr}`
  return (
    <div
      class={`pm-disc pm-disc-${side}${p.isHero ? ' is-hero' : ''}`}
      style={{ top: `${box.topPct}%`, left: `${box.leftPct}%`, ['--lbl' as string]: `${box.labelPx}px`, ['--kit' as string]: bg, ['--kit-ink' as string]: onColor(bg), ['--kit-2' as string]: team.kit.secondary }}
      title={full}
      role="img"
      aria-label={p.isHero ? `${you}: ${full}` : full}
    >
      <span class="pm-disc-num num" aria-hidden="true">{p.number}</span>
      <span class="pm-disc-name" aria-hidden="true">{p.isHero ? you : surname}</span>
    </div>
  )
}

function Side({ lineup, team, side }: { lineup: LineupPlayer[]; team: TeamView; side: 'home' | 'away' }) {
  const you = t('match.pre.you')
  const boxes = layoutTeam(lineup.map((p) => ({ id: p.id, label: p.isHero ? you : (p.name.split(' ').slice(-1)[0] ?? p.name), x: p.x, y: p.y, isHero: p.isHero })), side)
  const byId = new Map(boxes.map((b) => [b.id, b]))
  return <>{lineup.map((p) => <Disc key={p.id} p={p} team={team} side={side} box={byId.get(p.id)!} you={you} />)}</>
}

/** "Expected moments" preview: how many interactive moments and which kinds to expect. */
function ExpectedMomentsCard({ em, starting }: { em: NonNullable<PreMatchView['expectedMoments']>; starting: boolean }) {
  const kinds = em.kinds.filter((k) => k.share >= 0.08).slice(0, 4)
  return (
    <div class="pm-card pm-moments" data-testid="pm-expected-moments">
      <div class="pm-moments-head">
        <h3 class="micro t-mid">{t('postmatch.pre.expected')}{starting ? '' : ` · ${t('postmatch.pre.benchNote')}`}</h3>
        <b class="score-font num pm-moments-range">{em.min === em.max ? t('postmatch.pre.one', { min: em.min }) : t('postmatch.pre.range', { min: em.min, max: em.max })}</b>
      </div>
      {kinds.length > 0 && (
        <ul class="pm-moment-kinds" aria-label={t('postmatch.pre.types')}>
          {kinds.map((k) => (
            <li class="pm-moment-kind" key={k.kind}>
              <Icon name={MOMENT_ICON[k.kind] ?? 'star'} size={16} class="t-lo" />
              <span class="truncate">{tx(`match.kind.${k.kind}`, undefined, k.kind)}</span>
              <span class="pm-mk-bar" aria-hidden="true"><span style={{ ['--w' as string]: `${Math.round(k.share * 100)}%` }} /></span>
              <span class="num pm-mk-pct">{Math.round(k.share * 100)}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const REF_STYLE = ['lenient', 'relaxed', 'balanced', 'strict', 'cardHappy'] as const

/** Referee in charge: strictness 1..5 (card pips) and how readily he plays advantage (WP-14). */
function RefereeCard({ r }: { r: NonNullable<PreMatchView['referee']> }) {
  const s = Math.max(1, Math.min(5, Math.round(r.strictness)))
  const flow = r.advantage >= 0.6 ? 'flow' : r.advantage <= 0.4 ? 'whistle' : 'mixed'
  return (
    <div class="pm-card pm-ref" data-testid="pm-referee" data-strictness={s}>
      <h3 class="micro t-mid">{t('match.pre.referee')}</h3>
      <div class="pm-ref-row">
        <Icon name="whistle" size={20} class="t-gold" />
        <b class="truncate pm-ref-name">{r.name}</b>
        <span class="pm-ref-pips" role="img" aria-label={t('match.pre.refStrictness', { n: s })}>
          {[1, 2, 3, 4, 5].map((i) => <span key={i} class={`pm-ref-pip${i <= s ? ' is-on' : ''}`} />)}
        </span>
      </div>
      <p class="t-sm t-mid">{t(`match.pre.refStyle.${REF_STYLE[s - 1]!}`)} · {t(`match.pre.refFlow.${flow}`)}</p>
    </div>
  )
}

/** Stadium capacity, the hero's role and what the manager expects (GAP 2.7#71). */
function ExpectationCard({ homeId }: { homeId: string }) {
  const s = gameState.value
  if (!s?.hero.contract) return null
  const cap = s.world.clubs[homeId]?.stadium.capacity
  const role = s.hero.contract.role
  const [a, b] = ROLE_EXPECTED_MINUTES[role]
  const chance = Math.round(startChance(s) * 100)
  return (
    <div class="pm-card" data-testid="pm-expectation">
      <h3 class="micro t-mid">{t('board.pre.title')}</h3>
      <ul class="rec-list">
        {cap !== undefined && <li><span>{t('board.pre.capacity')}</span><b class="num">{formatNumber(cap)}</b></li>}
        <li><span>{t('board.pre.role')}</span><b>{ROLE_NAMES[role] ? lt(ROLE_NAMES[role]) : role}</b></li>
        <li><span>{t('board.pre.minutes')}</span><b class="num">{a}–{b}</b></li>
        <li><span>{t('board.pre.start')}</span><b class="num">%{chance}</b></li>
      </ul>
    </div>
  )
}

export function PreMatchScreen() {
  const pm = data.preMatch()
  void currentLang.value
  if (!pm) {
    return (
      <div class="pm-root pm-empty">
        <EmptyState
          icon="whistle"
          title={t('match.pre.noData')}
          text={t('match.pre.noDataText')}
          action={<Button variant="primary" icon="home" onClick={() => navigate('home', undefined, { tab: true })}>{t('match.pre.backHome')}</Button>}
        />
      </div>
    )
  }
  const { fixture: fx } = pm
  const imp = pm.importance >= 0.7 ? 'high' : pm.importance >= 0.4 ? 'mid' : 'low'
  const pips = Math.max(1, Math.round(pm.importance * 5))
  const odds = (n: number) => formatNumber(n, currentLang.value, 2)
  const opp = fx.isHome ? fx.away : fx.home

  return (
    <div class="pm-root" style={{ ['--home' as string]: fx.home.kit.primary, ['--away' as string]: fx.away.kit.primary }}>
      <div class="pm-bg" aria-hidden="true" />
      <header class="pm-topbar">
        <IconButton icon="arrow-left" label={t('common.back')} onClick={() => back('home')} />
        <div class="pm-comp">
          <span class="pm-comp-strip"><span>{lt(fx.compName)}</span></span>
          <span class="t-xs t-mid">{tx(`data.comp.${fx.compType}`)} · {t('common.week', { n: fx.week + 1 })}</span>
        </div>
        <span class="pm-topbar-spacer" />
      </header>

      <section class="pm-matchup" aria-label={`${fx.home.name} ${t('common.vs')} ${fx.away.name}`}>
        <div class="pm-team pm-team-home">
          <Crest crest={fx.home.crest} size={96} label={fx.home.name} />
          <h2 class="pm-team-name">{fx.home.name}</h2>
          <span class="pm-team-tag micro">{t('match.pre.home')}</span>
        </div>
        <div class="pm-vs">
          <span class="pm-vs-text">{t('common.vs')}</span>
          <span class="pm-venue t-xs t-mid"><Icon name="map-pin" size={14} /> {fx.venue}</span>
          <span class="pm-weather t-xs"><Icon name={WEATHER_ICON[pm.weather]} size={16} /> {t(`data.weather.${pm.weather}`)}</span>
        </div>
        <div class="pm-team pm-team-away">
          <Crest crest={fx.away.crest} size={96} label={fx.away.name} />
          <h2 class="pm-team-name">{fx.away.name}</h2>
          <span class="pm-team-tag micro">{t('match.pre.away')}</span>
        </div>
      </section>

      <div class="pm-meta">
        <div class="pm-imp" aria-label={`${t('match.pre.importance')}: ${t(`match.pre.importanceLevels.${imp}`)}`}>
          <span class="micro t-mid">{t('match.pre.importance')}</span>
          <span class="pm-pips" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => <span key={i} class={`pm-pip${i < pips ? ' is-on' : ''}${imp === 'high' ? ' is-hot' : ''}`} />)}
          </span>
          <span class="t-sm">{t(`match.pre.importanceLevels.${imp}`)}</span>
        </div>
        <div class="pm-odds" aria-label={t('match.pre.odds')}>
          <span class="micro t-mid">{t('match.pre.odds')}</span>
          <div class="pm-odds-row">
            <span class="pm-odd"><span class="t-xs t-lo">1</span><b class="num">{odds(pm.odds.home)}</b></span>
            <span class="pm-odd"><span class="t-xs t-lo">X</span><b class="num">{odds(pm.odds.draw)}</b></span>
            <span class="pm-odd"><span class="t-xs t-lo">2</span><b class="num">{odds(pm.odds.away)}</b></span>
          </div>
        </div>
      </div>

      <div class="pm-grid">
        <section class="pm-pitch-card" aria-label={t('match.pre.lineups')}>
          <div class="pm-formation pm-formation-away"><Crest crest={fx.away.crest} size={20} compact /> <span class="num">{pm.awayFormation}</span></div>
          <div class="pm-pitch">
            <div class="pm-stripes" aria-hidden="true" />
            <PitchLinesVertical />
            <Side lineup={pm.awayLineup} team={fx.away} side="away" />
            <Side lineup={pm.homeLineup} team={fx.home} side="home" />
          </div>
          <div class="pm-formation pm-formation-home"><Crest crest={fx.home.crest} size={20} compact /> <span class="num">{pm.homeFormation}</span></div>
        </section>

        <aside class="pm-side">
          <div class={`pm-status ${pm.heroStarting ? 'is-start' : 'is-bench'}`}>
            <Icon name={pm.heroStarting ? 'shirt' : 'clock'} size={26} />
            <div>
              <div class="pm-status-title">{pm.heroStarting ? t('match.pre.starting') : t('match.pre.bench')}</div>
              <div class="t-sm t-mid">{pm.heroStarting ? t('match.pre.startingDesc') : t('match.pre.benchDesc')}</div>
            </div>
          </div>

          {(pm.markedMan ?? 0) > 0 && (
            <div class="pm-marked" data-testid="pm-marked" title={t('match.pre.markedTip')}>
              <Chip tone="neg" icon="shield">{t('match.pre.marked')}</Chip>
              <span class="t-xs t-mid">{t('match.pre.markedTip')}</span>
            </div>
          )}
          {pm.expectedMoments && pm.expectedMoments.max > 0 && <ExpectedMomentsCard em={pm.expectedMoments} starting={pm.heroStarting} />}
          <FocusPicker />

          <div class="pm-card">
            <h3 class="micro t-mid">{t('match.pre.opponentForm')}</h3>
            <div class="row-between">
              <span class="row"><Crest crest={opp.crest} size={24} compact /><span class="truncate">{opp.name}</span></span>
              <FormDots form={pm.opponentForm} />
            </div>
          </div>

          {pm.opponentKeyPlayer && (
            <div class="pm-card">
              <h3 class="micro t-mid">{t('match.pre.keyPlayer')}</h3>
              <div class="pm-key">
                <span class="pm-key-ovr score-font">{pm.opponentKeyPlayer.ovr}</span>
                <div class="grow">
                  <div class="pm-key-name truncate">{pm.opponentKeyPlayer.name}</div>
                  <div class="t-xs t-mid">{t(`data.posLong.${pm.opponentKeyPlayer.position}`)}</div>
                  {pm.opponentKeyPlayer.form !== undefined && pm.opponentKeyPlayer.contractUntil !== undefined && (
                    <div class="t-xs t-lo" data-testid="pm-key-meta">
                      {t('match.pre.keyForm', { n: pm.opponentKeyPlayer.form })} · {t('match.pre.keyContract', { y: pm.opponentKeyPlayer.contractUntil })}
                    </div>
                  )}
                </div>
                <Icon name="eye" size={20} class="t-gold" />
              </div>
            </div>
          )}

          {pm.heroAvailability && (
            <div class="pm-card" data-testid="pm-hero-status">
              <h3 class="micro t-mid">{t('match.pre.yourStatus')}</h3>
              <ul class="t-sm">
                <li>{pm.heroAvailability.suspendedMatches > 0
                  ? t('match.pre.statusBan', { n: pm.heroAvailability.suspendedMatches })
                  : pm.heroAvailability.injured ? t('match.pre.statusInjured') : t('match.pre.statusFit')}</li>
                {pm.heroAvailability.contractUntil !== null && <li>{t('match.pre.statusContract', { y: pm.heroAvailability.contractUntil })}</li>}
              </ul>
            </div>
          )}

          {pm.referee && <RefereeCard r={pm.referee} />}
          <ExpectationCard homeId={fx.home.id} />

          <div class="pm-card pm-hint">
            <span class="pm-hint-icon"><Icon name="whistle" size={22} /></span>
            <div>
              <h3 class="micro t-mid">{t('match.pre.tacticHint')}</h3>
              <p class="pm-hint-text">{lt(pm.tacticHint)}</p>
            </div>
          </div>
        </aside>
      </div>

      <footer class="pm-footer">
        <Button variant="primary" size="lg" block icon="whistle" haptic="heavy" onClick={() => navigate('liveMatch')}>
          {t('match.pre.kickOff')}
        </Button>
      </footer>
    </div>
  )
}
