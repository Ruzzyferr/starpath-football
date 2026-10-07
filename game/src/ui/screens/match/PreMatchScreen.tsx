import '../../../styles/screens/match.css'
import { t, lt, tx, currentLang } from '../../../i18n'
import { Button, Crest, EmptyState, FormDots, IconButton } from '../../components'
import { Icon } from '../../icons'
import { formatNumber } from '../../format'
import { onColor } from '../../art/svg'
import { back, data, navigate, type LineupPlayer, type TeamView } from '../../store'
import { PitchLinesVertical, WEATHER_ICON } from './shared'

function Disc({ p, team, side }: { p: LineupPlayer; team: TeamView; side: 'home' | 'away' }) {
  // Home occupies the bottom half (own goal at the bottom), away the top half.
  const top = side === 'home' ? 95 - p.x * 43 : 5 + p.x * 43
  const left = side === 'home' ? 8 + p.y * 84 : 92 - p.y * 84
  const bg = team.kit.primary
  return (
    <div
      class={`pm-disc pm-disc-${side}${p.isHero ? ' is-hero' : ''}`}
      style={{ top: `${top}%`, left: `${left}%`, ['--kit' as string]: bg, ['--kit-ink' as string]: onColor(bg), ['--kit-2' as string]: team.kit.secondary }}
      title={`${p.number} ${p.name} · ${tx(`data.pos.${p.position}`)} · ${p.ovr}`}
    >
      <span class="pm-disc-num num">{p.number}</span>
      <span class="pm-disc-name truncate">{p.isHero ? t('match.pre.you') : p.name.split(' ').slice(-1)[0]}</span>
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
            {pm.awayLineup.map((p) => <Disc key={p.id} p={p} team={fx.away} side="away" />)}
            {pm.homeLineup.map((p) => <Disc key={p.id} p={p} team={fx.home} side="home" />)}
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
                </div>
                <Icon name="eye" size={20} class="t-gold" />
              </div>
            </div>
          )}

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
