import '../../../styles/screens/match.css'
import { useEffect, useRef, useState } from 'preact/hooks'
import { t, tx, lt, currentLang } from '../../../i18n'
import { Button, Crest, EmptyState, IconButton, MeterRing, Segmented } from '../../components'
import { Icon } from '../../icons'
import { haptic } from '../../haptics'
import { formatRating, ratingColor } from '../../format'
import { actions, match, navigate, type LiveMatchView, type MatchEventView, type TeamView } from '../../store'
import { CompareBar, EVENT_ICON, MOMENT_ICON, PitchLinesHorizontal } from './shared'

const SPEEDS: { id: 1 | 2 | 4; label: string }[] = [
  { id: 1, label: '1×' },
  { id: 2, label: '2×' },
  { id: 4, label: '4×' },
]

function ScoreBug({ m }: { m: LiveMatchView }) {
  const { home, away } = m.fixture
  const live = !m.finished && !m.paused
  return (
    <div class="lm-bug" role="group" aria-label={`${home.shortName} ${m.score[0]} – ${m.score[1]} ${away.shortName}, ${m.minute}'`}>
      <div class="lm-bug-comp micro">{lt(m.fixture.compName)}</div>
      <div class="lm-bug-slab">
        <span class="lm-bug-team lm-bug-home" style={{ ['--kit' as string]: home.kit.primary }}>
          <Crest crest={home.crest} size={30} compact />
          <span class="lm-bug-name">{home.shortName}</span>
        </span>
        <span class="lm-bug-score score-font">
          <span>{m.score[0]}</span>
          <span class="lm-bug-dash">–</span>
          <span>{m.score[1]}</span>
        </span>
        <span class="lm-bug-team lm-bug-away" style={{ ['--kit' as string]: away.kit.primary }}>
          <span class="lm-bug-name">{away.shortName}</span>
          <Crest crest={away.crest} size={30} compact />
        </span>
        <span class="lm-bug-clock">
          {live && <span class="lm-live-dot" aria-hidden="true" />}
          <span class="score-font num">{m.minute}'</span>
        </span>
      </div>
      <div class="lm-bug-phase micro">{t(`match.live.phase.${m.phase}`)}</div>
    </div>
  )
}

function Radar({ m }: { m: LiveMatchView }) {
  const bx = 1 + m.ballX * 103
  const by = 1 + m.ballY * 66
  const homePoss = m.possession[0] >= m.possession[1]
  return (
    <figure class="lm-radar" aria-label={t('match.live.radar')}>
      <svg viewBox="0 0 105 68" class="lm-radar-svg" role="img" aria-label={t('match.live.radar')}>
        <defs>
          <pattern id="lm-mow" width="21" height="68" patternUnits="userSpaceOnUse">
            <rect width="10.5" height="68" fill="var(--pitch-a)" />
            <rect x="10.5" width="10.5" height="68" fill="var(--pitch-b)" />
          </pattern>
          <radialGradient id="lm-ballglow">
            <stop offset="0" stop-color="#fff" stop-opacity=".55" />
            <stop offset="1" stop-color="#fff" stop-opacity="0" />
          </radialGradient>
        </defs>
        <rect width="105" height="68" rx="2" fill="url(#lm-mow)" />
        <PitchLinesHorizontal />
        <path
          d={homePoss ? 'M44 64h17l-3-2.5M61 64l-3 2.5' : 'M61 64H44l3-2.5M44 64l3 2.5'}
          stroke={homePoss ? m.fixture.home.kit.primary : m.fixture.away.kit.primary}
          stroke-width="1.4"
          fill="none"
          stroke-linecap="round"
        />
        <g class="lm-ball" style={{ transform: `translate(${bx}px, ${by}px)` }}>
          <circle r="7" fill="url(#lm-ballglow)" />
          <circle r="1.8" fill="#fff" stroke="#0b1220" stroke-width=".5" />
        </g>
      </svg>
    </figure>
  )
}

function FeedItem({ e, home, away }: { e: MatchEventView; home: TeamView; away: TeamView }) {
  const team = e.side === 'home' ? home : e.side === 'away' ? away : null
  const isGoal = e.type === 'goal'
  return (
    <li class={`lm-ev lm-ev-${e.type}${e.isHero ? ' is-hero' : ''}${isGoal ? ' is-goal' : ''}`}>
      <span class="lm-ev-min num">{e.minute}'</span>
      <span class={`lm-ev-icon lm-ev-icon-${e.type}`}><Icon name={EVENT_ICON[e.type] ?? 'chat'} size={isGoal ? 20 : 16} /></span>
      <div class="lm-ev-body">
        {isGoal && (
          <div class="lm-ev-goalrow">
            <span class="lm-ev-goal">{t('match.live.goal')}</span>
            {team && <Crest crest={team.crest} size={18} compact />}
            <span class="score-font lm-ev-score">{e.score[0]}–{e.score[1]}</span>
          </div>
        )}
        <p class="lm-ev-text">{e.text}</p>
      </div>
    </li>
  )
}

export function LiveMatchScreen() {
  const m = match.value
  void currentLang.value
  const [goalKey, setGoalKey] = useState<number | null>(null)
  const seen = useRef<number>(-1)

  // Kick off on arrival.
  useEffect(() => {
    const cur = match.value
    if (cur && cur.minute === 0 && cur.paused && !cur.finished) actions.matchPause(false)
  }, [])

  // Goal banner when a new goal event arrives.
  const evCount = m?.events.length ?? 0
  useEffect(() => {
    if (!m) return
    if (seen.current < 0) {
      seen.current = evCount
      return
    }
    const fresh = m.events.slice(seen.current)
    seen.current = evCount
    if (fresh.some((e) => e.type === 'goal')) {
      haptic('goal')
      setGoalKey(Date.now())
      const id = setTimeout(() => setGoalKey(null), 1700)
      return () => clearTimeout(id)
    }
  }, [evCount])

  if (!m) {
    return (
      <div class="lm-root lm-empty">
        <EmptyState
          icon="whistle"
          title={t('match.live.noMatch')}
          action={<Button variant="primary" icon="home" onClick={() => navigate('home', undefined, { tab: true })}>{t('match.pre.backHome')}</Button>}
        />
      </div>
    )
  }

  const { home, away } = m.fixture
  const hs = m.heroStats
  const passPct = hs.passes ? Math.round((hs.passesCompleted / hs.passes) * 100) : 0
  const feed = [...m.events].reverse()
  const moment = m.pendingMoment
  const kindLabel = moment ? tx(`match.kind.${moment.kind}`, undefined, moment.kind) : ''

  return (
    <div class={`lm-root${m.momentActive ? ' is-moment' : ''}`} style={{ ['--home' as string]: home.kit.primary, ['--away' as string]: away.kit.primary }}>
      <div class="lm-bg" aria-hidden="true" />
      <ScoreBug m={m} />

      {/* Phaser mount point — always in the DOM; expands while a moment is played. */}
      <div class="lm-canvas-wrap" aria-hidden={!m.momentActive}>
        <div id="match-canvas" class={`match-canvas${m.momentActive ? ' is-active' : ''}`} />
        {m.momentActive && <div class="lm-canvas-label micro"><span class="lm-live-dot" /> {t('match.live.momentLive')}</div>}
      </div>

      <div class="lm-grid">
        <section class="lm-left">
          <Radar m={m} />
          <div class="lm-bars">
            <CompareBar label={t('match.live.possession')} home={m.possession[0]} away={m.possession[1]} suffix="%" />
            <CompareBar label={t('match.live.shots')} home={m.shots[0]} away={m.shots[1]} />
            <CompareBar label={t('match.live.onTarget')} home={m.shotsOnTarget[0]} away={m.shotsOnTarget[1]} />
          </div>
          <div class="lm-hero" aria-label={t('match.live.heroStats')}>
            <MeterRing value={hs.rating} max={10} size={64} stroke={6} color={ratingColor(hs.rating)} label={t('match.live.rating')}>
              <span class="score-font lm-hero-rating" style={{ color: ratingColor(hs.rating) }}>{formatRating(hs.rating)}</span>
            </MeterRing>
            <div class="lm-hero-stats">
              {!m.heroOnPitch && <span class="lm-bench-chip micro">{t('match.live.onBench')}</span>}
              <div class="lm-hs"><b class="num">{hs.goals}</b><span>{t('match.live.goals')}</span></div>
              <div class="lm-hs"><b class="num">{hs.assists}</b><span>{t('match.live.assists')}</span></div>
              <div class="lm-hs"><b class="num">{hs.shotsOnTarget}/{hs.shots}</b><span>{t('match.live.shotsShort')}</span></div>
              <div class="lm-hs"><b class="num">{passPct}%</b><span>{t('match.live.passes')}</span></div>
            </div>
          </div>
        </section>

        <section class="lm-feed-wrap" aria-label={t('match.live.feed')}>
          <h2 class="micro t-mid lm-feed-title">{t('match.live.feed')}</h2>
          <ol class="lm-feed" aria-live="polite" aria-relevant="additions">
            {feed.length === 0 && <li class="lm-ev lm-ev-empty t-lo">{t('match.live.noEvents')}</li>}
            {feed.map((e, i) => <FeedItem key={`${e.minute}-${e.type}-${feed.length - i}`} e={e} home={home} away={away} />)}
          </ol>
        </section>
      </div>

      <footer class="lm-controls">
        {m.finished ? (
          <div class="lm-fulltime">
            <div class="lm-ft-banner"><Icon name="whistle" size={22} /> <span>{t('match.live.fullTime')}</span></div>
            <Button variant="primary" size="lg" block iconRight="arrow-right" onClick={() => navigate('postMatch', undefined, { replace: true })}>
              {t('match.live.continue')}
            </Button>
          </div>
        ) : (
          <div class="lm-ctrl-row">
            <IconButton
              variant="solid"
              icon={m.paused ? 'play' : 'pause'}
              label={m.paused ? t('match.live.play') : t('match.live.pause')}
              onClick={() => actions.matchPause(!m.paused)}
              disabled={!!moment || m.momentActive}
            />
            <Segmented<1 | 2 | 4>
              label={t('match.live.speed')}
              value={m.speed}
              onChange={(v) => actions.matchSetSpeed(v)}
              options={SPEEDS}
            />
            <Button variant="ghost" size="sm" icon="skip" onClick={() => actions.matchSimToEnd()} disabled={!!moment || m.momentActive}>
              <span class="lm-hide-xs">{t('match.live.simToEnd')}</span>
            </Button>
          </div>
        )}
      </footer>

      {moment && !m.momentActive && (
        <div class="lm-moment" role="alertdialog" aria-labelledby="lm-moment-title" aria-describedby="lm-moment-prompt">
          <div class="lm-moment-card">
            <div class="lm-moment-head">
              <span class="lm-moment-icon"><Icon name={MOMENT_ICON[moment.kind] ?? 'star'} size={26} /></span>
              <div class="grow">
                <div class="micro lm-moment-min">{t('match.live.momentMinute', { m: moment.minute })} · {kindLabel}</div>
                <h2 class="lm-moment-title" id="lm-moment-title">{t('match.live.moment')}</h2>
              </div>
            </div>
            <p class="lm-moment-prompt" id="lm-moment-prompt">{moment.prompt}</p>
            <div class="lm-moment-actions">
              <Button variant="primary" size="lg" icon="play" haptic="heavy" onClick={() => actions.playMoment()} autoFocus>
                {t('match.live.playMoment')}
              </Button>
              <Button variant="secondary" size="lg" icon="fast-forward" onClick={() => actions.simMoment()}>
                {t('match.live.simMoment')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {goalKey !== null && (
        <div class="lm-goal-banner" key={goalKey} aria-hidden="true">
          <span class="lm-goal-text">{t('match.live.goal')}</span>
        </div>
      )}
    </div>
  )
}
