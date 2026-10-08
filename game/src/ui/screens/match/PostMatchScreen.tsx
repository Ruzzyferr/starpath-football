import '../../../styles/screens/match.css'
import { useEffect, useRef, useState } from 'preact/hooks'
import { t, lt, tx, currentLang } from '../../../i18n'
import { ShareMatchButton } from '../../share/ShareButtons'
import { Avatar, Button, Crest, DeltaList, EmptyState, HeatMap, Hearts, MeterRing, Money, ShotMap, ShotMarker } from '../../components'
import { Icon, type IconName } from '../../icons'
import { formatRating, ratingColor } from '../../format'
import { useCountUp } from '../../hooks/motion'
import { actions, data, navigate, type Delta, type InterviewOption, type PassRowView, type PostMatchView, type RatingLineView } from '../../store'
import { CompareBar, MOMENT_ICON } from './shared'
import { MomentsPanel } from './Moments'
import { chanceReport } from '../../backend/postMatch'
import { postSteps, ratingExtremes, ratingGroups, signedDelta, type PostStep } from './postFlow'

const TONE_ICON: Record<InterviewOption['tone'], IconName> = {
  humble: 'hand-heart',
  bold: 'fire',
  critical: 'megaphone',
  deflect: 'shuffle',
}

const STEP_ICON: Record<PostStep, IconName> = {
  result: 'whistle',
  rating: 'chart-bar',
  map: 'map-pin',
  trust: 'handshake',
  relations: 'users',
  passes: 'arrow-right',
  earnings: 'coins',
  interview: 'megaphone',
}

function done() {
  actions.finishMatch()
  navigate('home', undefined, { tab: true })
}

const deltaClass = (v: number) => (v > 0 ? 'is-pos' : v < 0 ? 'is-neg' : 'is-zero')

/** Label of one rating log line. */
function lineLabel(l: RatingLineView): string {
  switch (l.source) {
    case 'moment': {
      const kind = l.kind ? tx(`match.kind.${l.kind}`, undefined, l.kind) : t('postmatch.rating.group.moment')
      const out = l.outcome ? tx(`postmatch.outcome.${l.outcome}`, undefined, '') : ''
      return out ? `${kind} · ${out}` : kind
    }
    case 'team':
      return tx(`postmatch.rating.team.${l.key}`, undefined, t('postmatch.rating.other'))
    case 'background':
      return tx(`postmatch.rating.background.${l.key}`, undefined, t('postmatch.rating.other'))
    default:
      return tx(`postmatch.rating.finalKey.${l.key}`, undefined, t('postmatch.rating.other'))
  }
}

function lineIcon(l: RatingLineView): IconName {
  if (l.source === 'moment') return (l.kind && MOMENT_ICON[l.kind]) || 'star'
  if (l.source === 'team') return 'ball'
  if (l.source === 'background') return 'run'
  return 'whistle'
}

// ───────────────────────── Steps ─────────────────────────

/** The hero's moment chances next to the result (GAP 2.1#2). */
function ChanceLine({ pm }: { pm: PostMatchView }) {
  const mine = pm.heroSide === 'home' ? pm.score[0] : pm.score[1]
  const theirs = pm.heroSide === 'home' ? pm.score[1] : pm.score[0]
  const r = chanceReport(pm.ratingLog, mine, theirs)
  if (!r) return null
  const tail = r.couldHave === 'win' ? t('postmatch.chances.win', { k: r.toWin })
    : r.couldHave === 'draw' ? t('postmatch.chances.draw', { k: r.toDraw })
    : r.scored > 0 && mine > theirs ? t('postmatch.chances.clinical') : ''
  return (
    <p class="t-sm t-mid post-chances" data-testid="post-chances">
      {t('postmatch.chances.line', { n: r.chances, g: r.scored, m: r.missed })}{tail ? ` ${tail}` : ''}
    </p>
  )
}

function ResultStep({ pm }: { pm: PostMatchView }) {
  const { fixture: fx, score, stats: s, team, motm } = pm
  const passPct = s.passes ? Math.round((s.passesCompleted / s.passes) * 100) : 0
  const rc = ratingColor(pm.rating)
  const homeGoals = pm.scorers.filter((g) => g.side === 'home')
  const awayGoals = pm.scorers.filter((g) => g.side === 'away')
  const statCells: { label: string; value: string; icon: IconName }[] = [
    { label: t('match.post.minutes'), value: String(s.minutes), icon: 'stopwatch' },
    { label: t('match.live.goals'), value: String(s.goals), icon: 'ball' },
    { label: t('match.live.assists'), value: String(s.assists), icon: 'boot' },
    { label: t('match.post.shots'), value: `${s.shotsOnTarget}/${s.shots}`, icon: 'target' },
    { label: t('match.post.passAcc'), value: `${passPct}%`, icon: 'link' },
    { label: t('match.post.tackles'), value: String(s.tackles), icon: 'shield' },
    { label: t('match.post.dribbles'), value: String(s.dribbles), icon: 'run' },
    ...(s.saves ? [{ label: t('match.post.saves'), value: String(s.saves), icon: 'shield-check' as IconName }] : []),
  ]
  return (
    <>
      <header class="post-head">
        <div class="post-score">
          <div class="post-team"><Crest crest={fx.home.crest} size={64} label={fx.home.name} /><span class="post-team-name truncate">{fx.home.shortName}</span></div>
          <div class="post-score-num score-font" aria-label={`${score[0]} – ${score[1]}`}>
            <span>{score[0]}</span><span class="post-dash">–</span><span>{score[1]}</span>
          </div>
          <div class="post-team"><Crest crest={fx.away.crest} size={64} label={fx.away.name} /><span class="post-team-name truncate">{fx.away.shortName}</span></div>
        </div>
        <div class="post-comp t-xs t-mid">{lt(fx.compName)} · {fx.venue}</div>
        <div class="post-scorers" aria-label={t('match.post.scorers')}>
          <ul class="post-scorer-col">
            {homeGoals.map((g, i) => <li key={i}><Icon name="ball" size={12} /> {g.name} <span class="num t-lo">{g.minute}'</span></li>)}
          </ul>
          <ul class="post-scorer-col post-scorer-away">
            {awayGoals.map((g, i) => <li key={i}><span class="num t-lo">{g.minute}'</span> {g.name} <Icon name="ball" size={12} /></li>)}
          </ul>
          {pm.scorers.length === 0 && <p class="t-sm t-lo post-nogoals">{t('match.post.noGoals')}</p>}
        </div>
      </header>

      <div class="post-grid">
        <section class="post-card post-rating" aria-label={t('match.post.rating')}>
          <MeterRing value={pm.rating} max={10} size={132} stroke={11} color={rc} ariaLabel={`${t('match.post.rating')} ${formatRating(pm.rating)}`}>
            <span class="score-font post-rating-num" style={{ color: rc }}>{formatRating(pm.rating)}</span>
          </MeterRing>
          <div class="micro t-mid">{t('match.post.rating')}</div>
        </section>

        <section class={`post-card post-motm${motm.isHero ? ' is-hero' : ''}`} aria-label={t('match.post.motm')}>
          {motm.isHero && <div class="post-motm-sheen" aria-hidden="true" />}
          <div class="post-motm-avatar">
            {motm.appearance ? <Avatar appearance={motm.appearance} size={84} background={motm.isHero ? '#b8860b' : '#24345a'} /> : <Icon name="medal" size={48} />}
          </div>
          <div class="grow">
            <div class="micro post-motm-label"><Icon name="star-fill" size={14} /> {motm.isHero ? t('match.post.motmYou') : t('match.post.motm')}</div>
            <div class="post-motm-name">{motm.name}</div>
            <div class="score-font post-motm-rating" style={{ color: ratingColor(motm.rating) }}>{formatRating(motm.rating)}</div>
          </div>
        </section>

        <section class="post-card post-stats">
          <h2 class="post-h micro t-mid">{t('match.post.heroStats')}</h2>
          <div class="post-stat-grid">
            {statCells.map((c) => (
              <div class="post-stat" key={c.label}>
                <Icon name={c.icon} size={16} class="t-lo" />
                <b class="num">{c.value}</b>
                <span class="t-xs t-mid">{c.label}</span>
              </div>
            ))}
          </div>
          <ChanceLine pm={pm} />
        </section>

        <section class="post-card post-team-stats">
          <h2 class="post-h micro t-mid">{t('match.post.teamStats')}</h2>
          <div class="post-team-legend">
            <span class="row"><Crest crest={fx.home.crest} size={18} compact /> {fx.home.shortName}</span>
            <span class="row">{fx.away.shortName} <Crest crest={fx.away.crest} size={18} compact /></span>
          </div>
          <CompareBar label={t('match.post.possession')} home={team.possession[0]} away={team.possession[1]} suffix="%" />
          <CompareBar label={t('match.post.shots')} home={team.shots[0]} away={team.shots[1]} />
          <CompareBar label={t('match.post.onTarget')} home={team.shotsOnTarget[0]} away={team.shotsOnTarget[1]} />
          <CompareBar label={t('match.post.corners')} home={team.corners[0]} away={team.corners[1]} />
          <CompareBar label={t('match.post.fouls')} home={team.fouls[0]} away={team.fouls[1]} />
        </section>
      </div>
    </>
  )
}

function RatingStep({ pm }: { pm: PostMatchView }) {
  const base = pm.ratingBase ?? 6
  const log = pm.ratingLog ?? []
  const [target, setTarget] = useState(base)
  useEffect(() => {
    const id = setTimeout(() => setTarget(pm.rating), 250)
    return () => clearTimeout(id)
  }, [pm.rating])
  const [shown] = useCountUp(target, 1400)
  const { groups, other } = ratingGroups(base, pm.rating, log)
  const { best, worst } = ratingExtremes(log)
  const maxAbs = Math.max(0.3, ...log.map((l) => Math.abs(l.delta)), Math.abs(other))
  const rc = ratingColor(pm.rating)
  let row = 0
  const Line = ({ label, delta, icon, minute, auto }: { label: string; delta: number; icon: IconName; minute?: number; auto?: boolean }) => (
    <li class={`prb-line ${deltaClass(delta)}`} style={{ ['--i' as string]: String(row++) }}>
      <span class="prb-min num t-lo">{minute !== undefined ? `${minute}'` : ''}</span>
      <Icon name={icon} size={16} class="prb-ico" />
      <span class="prb-label"><span class="prb-text">{label}</span>{auto && <span class="prb-auto micro">{t('postmatch.rating.auto')}</span>}</span>
      <span class="prb-bar" aria-hidden="true"><span style={{ ['--w' as string]: String(Math.min(1, Math.abs(delta) / maxAbs)) }} /></span>
      <b class="prb-delta num">{signedDelta(delta)}</b>
    </li>
  )
  return (
    <section class="post-card post-step-card prb" aria-labelledby="post-step-h">
      <h2 class="post-h micro t-mid" id="post-step-h" tabIndex={-1}>{t('postmatch.rating.title')}</h2>
      <div class="prb-top">
        <div class="prb-from"><span class="micro t-lo">{t('postmatch.rating.base')}</span><b class="score-font num">{base.toFixed(1)}</b></div>
        <Icon name="arrow-right" size={22} class="t-lo" />
        <div class="prb-to" data-testid="post-rating-final">
          <span class="micro t-lo">{t('postmatch.rating.final')}</span>
          <b class="score-font num" style={{ color: rc }} aria-live="polite">{formatRating(Math.round(shown * 10) / 10)}</b>
        </div>
      </div>
      {(best || worst) && (
        <div class="prb-why">
          {best && <span class="prb-chip is-pos"><Icon name="trend-up" size={14} /> {lineLabel(best)} <b class="num">{signedDelta(best.delta)}</b></span>}
          {worst && <span class="prb-chip is-neg"><Icon name="trend-down" size={14} /> {lineLabel(worst)} <b class="num">{signedDelta(worst.delta)}</b></span>}
        </div>
      )}
      {log.length === 0 && <p class="t-sm t-mid">{t('postmatch.rating.noLog')}</p>}
      {groups.map((g) => (
        <div class="prb-group" key={g.source}>
          <div class="prb-group-h micro t-mid">
            <span>{t(`postmatch.rating.group.${g.source}`)}</span>
            <b class={`num ${deltaClass(g.total)}`}>{signedDelta(g.total, 2)}</b>
          </div>
          <ul class="prb-list" data-testid={`post-rating-group-${g.source}`}>
            {g.lines.map((l, i) => <Line key={i} label={lineLabel(l)} delta={l.delta} icon={lineIcon(l)} minute={l.source === 'final' ? undefined : l.minute} auto={l.auto} />)}
          </ul>
        </div>
      ))}
      {other !== 0 && (
        <ul class="prb-list">
          <Line label={t('postmatch.rating.other')} delta={other} icon="sparkle" />
        </ul>
      )}
      <p class="t-xs t-lo">{t('postmatch.rating.clamped')}</p>
    </section>
  )
}

function MapStep({ pm }: { pm: PostMatchView }) {
  const map = pm.heroMap
  if (!map) return null
  const goals = map.shots.filter((s) => s.outcome === 'goal').length
  const estimated = map.shots.some((s) => s.source === 'auto')
  const outcomes = ['goal', 'saved', 'missed', 'blocked', 'woodwork'] as const
  return (
    <section class="post-card post-step-card pmaps" aria-labelledby="post-step-h">
      <h2 class="post-h micro t-mid" id="post-step-h" tabIndex={-1}>{t('postmatch.map.title')}</h2>
      <div class="pmaps-attack micro t-lo"><span>{t('postmatch.map.attack')}</span><Icon name="arrow-right" size={14} /></div>
      <div class="pmaps-grid">
        <figure class="pmaps-fig" data-testid="post-heatmap">
          <HeatMap heat={map.heat} cols={map.cols} rows={map.rows} label={t('postmatch.map.heat')} />
          <figcaption class="micro t-mid">{t('postmatch.map.heat')}</figcaption>
        </figure>
        <figure class="pmaps-fig" data-testid="post-shotmap">
          <ShotMap shots={map.shots} label={t('postmatch.map.shots')} />
          <figcaption class="micro t-mid">
            {t('postmatch.map.shots')} · {map.shots.length ? t('postmatch.map.count', { n: map.shots.length, g: goals }) : t('postmatch.map.noShots')}
          </figcaption>
        </figure>
      </div>
      <ul class="pmaps-legend t-xs">
        {outcomes.map((o) => (
          <li key={o} class={`shot shot-${o}`}>
            <svg viewBox="-3 -3 6 6" width="14" height="14" aria-hidden="true"><ShotMarker outcome={o} x={0} y={0} r={2.2} /></svg>
            {t(`postmatch.outcome.${o}`)}
          </li>
        ))}
        <li class="shot"><svg viewBox="-4 -4 8 8" width="14" height="14" aria-hidden="true"><circle class="shot-header" cx="0" cy="0" r="3" /></svg>{t('postmatch.map.header')}</li>
      </ul>
      {estimated && <p class="t-xs t-lo">{t('postmatch.map.estimated')}</p>}
    </section>
  )
}

function TrustStep({ pm }: { pm: PostMatchView }) {
  const tr = pm.trust
  if (!tr) return null
  const d = Math.round((tr.after - tr.before) * 10) / 10
  // A −0.4 change between "50" and "50" reads as a bug: show tenths whenever rounding would hide the move.
  const fine = d !== 0 && Math.round(tr.before) === Math.round(tr.after)
  const fmtT = (v: number): string => (fine ? v.toFixed(1) : String(Math.round(v)))
  const lo = Math.min(tr.before, tr.after)
  const hi = Math.max(tr.before, tr.after)
  return (
    <section class="post-card post-step-card ptrust" aria-labelledby="post-step-h">
      <h2 class="post-h micro t-mid" id="post-step-h" tabIndex={-1}><Icon name="handshake" size={14} /> {t('postmatch.trust.title')}</h2>
      <div class="ptrust-nums">
        <div><span class="micro t-lo">{t('postmatch.trust.before')}</span><b class="score-font num">{fmtT(tr.before)}</b></div>
        <b class={`ptrust-delta score-font num ${deltaClass(d)}`} data-testid="post-trust-delta">{signedDelta(d)}</b>
        <div><span class="micro t-lo">{t('postmatch.trust.after')}</span><b class="score-font num">{fmtT(tr.after)}</b></div>
      </div>
      <div class="ptrust-bar" role="img" aria-label={`${t('postmatch.trust.title')}: ${Math.round(tr.before)} → ${Math.round(tr.after)}`}>
        <span class="ptrust-fill" style={{ ['--w' as string]: `${lo}%` }} />
        <span class={`ptrust-change ${deltaClass(d)}`} style={{ left: `${lo}%`, ['--w' as string]: `${hi - lo}%` }} />
      </div>
      <h3 class="micro t-mid">{t('postmatch.trust.why')}</h3>
      {tr.reasons.length === 0 ? (
        <p class="t-sm t-mid">{t('postmatch.trust.none')}</p>
      ) : (
        <ul class="ptrust-list">
          {tr.reasons.map((r, i) => (
            <li key={i} class={deltaClass(r.value)} style={{ ['--i' as string]: String(i) }}>
              <span>{lt(r.label)}</span>
              <b class="num">{signedDelta(r.value)}</b>
            </li>
          ))}
        </ul>
      )}
      {pm.expectations && pm.expectations.length > 0 && (
        <>
          <h3 class="micro t-mid">{t('postmatch.expect.title')}</h3>
          <ul class="ptrust-list pexpect-list" data-testid="post-expectations">
            {pm.expectations.map((x, i) => (
              <li key={i} class={x.status === 'done' ? 't-pos' : x.status === 'failed' ? 't-neg' : ''}>
                <span>{lt(x.title)}</span>
                <b class="num">{x.status === 'done' ? t('postmatch.expect.met') : x.status === 'failed' ? t('postmatch.expect.missed') : `${Math.round(x.progress)}/${x.target}`}</b>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function EarningsStep({ pm }: { pm: PostMatchView }) {
  const e = pm.earnings
  if (!e) return null
  const now = e.lines.filter((l) => l.when === 'now')
  const week = e.lines.filter((l) => l.when === 'week')
  const row = (l: (typeof e.lines)[number], i: number) => (
    <li key={l.key} class={deltaClass(l.amount)} style={{ ['--i' as string]: String(i) }} data-testid={`earn-${l.key}`}>
      <span>{tx(`postmatch.earnings.line.${l.key}`)}</span>
      <b class="num"><Money value={l.amount} sign animate={false} /></b>
    </li>
  )
  return (
    <section class="post-card post-step-card pearn" aria-labelledby="post-step-h" data-testid="post-earnings">
      <h2 class="post-h micro t-mid" id="post-step-h" tabIndex={-1}><Icon name="coins" size={14} /> {t('postmatch.earnings.title')}</h2>
      <div class="pearn-total">
        <span class="micro t-lo">{t('postmatch.earnings.total')}</span>
        <b class="score-font num" data-testid="earn-net"><Money value={e.net} /></b>
      </div>
      {now.length > 0 && (
        <>
          <h3 class="micro t-mid">{t('postmatch.earnings.now')}</h3>
          <ul class="ptrust-list pearn-list">{now.map(row)}</ul>
        </>
      )}
      {week.length > 0 && (
        <>
          <h3 class="micro t-mid">{t('postmatch.earnings.week')}</h3>
          <ul class="ptrust-list pearn-list">{week.map((l, i) => row(l, i + now.length))}</ul>
          <p class="t-xs t-lo">{t('postmatch.earnings.weekNote')}</p>
        </>
      )}
    </section>
  )
}

function RelationsStep({ pm }: { pm: PostMatchView }) {
  const rows = pm.relations ?? []
  const name = (r: (typeof rows)[number]) =>
    r.kind === 'squad' ? t('postmatch.relations.squad', { n: r.name }) : r.kind === 'fans' ? t('postmatch.relations.fans') : r.kind === 'press' ? t('postmatch.relations.press') : r.name
  return (
    <section class="post-card post-step-card prel" aria-labelledby="post-step-h">
      <h2 class="post-h micro t-mid" id="post-step-h" tabIndex={-1}><Icon name="users" size={14} /> {t('postmatch.relations.title')}</h2>
      {rows.length === 0 ? (
        <p class="t-sm t-mid">{t('postmatch.relations.none')}</p>
      ) : (
        <ul class="prel-list" data-testid="post-relations">
          {rows.map((r, i) => {
            const d = r.after - r.before
            return (
              <li key={r.id} class="prel-row" style={{ ['--i' as string]: String(i) }}>
                <div class="prel-main">
                  <span class="prel-name truncate">{name(r)}</span>
                  {r.why && <span class="t-xs t-mid prel-why">{lt(r.why)}</span>}
                </div>
                <Hearts value={r.after} size={12} />
                <b class={`num prel-delta ${deltaClass(d)}`}>{d > 0 ? '+' : d < 0 ? '−' : ''}{Math.abs(d)}</b>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function PassRowItem({ r, i, max }: { r: PassRowView; i: number; max: number }) {
  const share = max > 0 ? Math.round((Math.max(0, r.from) / max) * 100) : 0
  return (
    <li class={`ppas-row band-${r.band}`} style={{ ['--i' as string]: String(i), ['--share' as string]: `${share}%` }} data-testid="post-pass-row">
      <div class="prel-main">
        <span class="prel-name truncate">{r.name}</span>
        <span class="t-xs t-mid prel-why">{t(`postmatch.passes.band.${r.band}`)} · {t('postmatch.passes.relation', { v: r.relation })}</span>
      </div>
      <b class="num ppas-n">{r.from > 0 ? t('postmatch.passes.fromN', { n: r.from }) : '0'}</b>
      <span class="t-xs t-lo ppas-to">{t('postmatch.passes.toN', { n: r.to })}</span>
    </li>
  )
}

function PassStep({ pm }: { pm: PostMatchView }) {
  const net = pm.passNet ?? { fed: [], ignored: [] }
  const max = Math.max(1, ...net.fed.map((r) => r.from), ...net.ignored.map((r) => r.from))
  return (
    <section class="post-card post-step-card ppas" aria-labelledby="post-step-h" data-testid="post-passes">
      <h2 class="post-h micro t-mid" id="post-step-h" tabIndex={-1}><Icon name="users" size={14} /> {t('postmatch.passes.title')}</h2>
      <h3 class="micro t-lo ppas-h">{t('postmatch.passes.fed')}</h3>
      {net.fed.length === 0 ? <p class="t-sm t-mid">{t('postmatch.passes.noneFed')}</p> : (
        <ul class="prel-list" data-testid="post-passes-fed" aria-label={t('postmatch.passes.fed')}>{net.fed.map((r, i) => <PassRowItem key={r.id} r={r} i={i} max={max} />)}</ul>
      )}
      <h3 class="micro t-lo ppas-h">{t('postmatch.passes.ignored')}</h3>
      {net.ignored.length === 0 ? <p class="t-sm t-mid">{t('postmatch.passes.noneIgnored')}</p> : (
        <ul class="prel-list" data-testid="post-passes-ignored" aria-label={t('postmatch.passes.ignored')}>{net.ignored.map((r, i) => <PassRowItem key={r.id} r={r} i={i} max={max} />)}</ul>
      )}
      <p class="t-xs t-lo">{t('postmatch.passes.hint')}</p>
    </section>
  )
}

type Interview = NonNullable<PostMatchView['interview']>
type Answer = { id: string; deltas: Delta[] } | null

function SummaryStep({ pm, iv, answer, setAnswer }: { pm: PostMatchView; iv: Interview | null; answer: Answer; setAnswer: (a: Answer) => void }) {
  return (
    <div class="post-grid post-summary">
      <section class="post-card post-summary-head">
        <h2 class="post-h micro t-mid" id="post-step-h" tabIndex={-1}>{t('postmatch.summary.title')}</h2>
        <div class="post-summary-row">
          <span class="score-font num post-summary-score">{pm.score[0]}–{pm.score[1]}</span>
          <span class="score-font num post-summary-rating" style={{ color: ratingColor(pm.rating) }}>{formatRating(pm.rating)}</span>
        </div>
        <div class="post-share"><ShareMatchButton pm={pm} /></div>
      </section>
      {pm.deltas.length > 0 && (
        <section class="post-card post-impact">
          <h2 class="post-h micro t-mid">{t('match.post.impact')}</h2>
          <DeltaList deltas={pm.deltas} />
        </section>
      )}
      {iv && (
        <section class="post-card post-interview" aria-labelledby="post-iv-q" data-testid="post-interview">
          <h2 class="post-h micro t-mid"><Icon name="megaphone" size={14} /> {t('match.post.interview')}</h2>
          <p class="post-iv-q" id="post-iv-q">“{lt(iv.question)}”</p>
          {answer ? (
            <div class="post-iv-done">
              <div class="row"><Icon name="check" size={18} class="t-pos" /> <span>{t('match.post.interviewDone')}</span></div>
              <p class="post-iv-chosen">{lt(iv.options.find((o) => o.id === answer.id)?.label)}</p>
              <DeltaList deltas={answer.deltas} />
            </div>
          ) : (
            <div class="post-iv-options">
              {iv.options.map((o) => (
                <button key={o.id} type="button" class={`post-iv-opt tone-${o.tone}`} onClick={() => setAnswer({ id: o.id, deltas: actions.answerInterview(o.id) })}>
                  <span class="post-iv-tone micro"><Icon name={TONE_ICON[o.tone]} size={14} /> {t(`match.post.tone.${o.tone}`)}</span>
                  <span class="post-iv-label">{lt(o.label)}</span>
                  {o.preview.length > 0 && <DeltaList deltas={o.preview} compact />}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

// ───────────────────────── Screen ─────────────────────────

export function PostMatchScreen() {
  const pm = data.postMatch()
  void currentLang.value
  const [idx, setIdx] = useState(0)
  // The backend drops the interview once answered: keep the question and the answer for this visit.
  const [iv] = useState<Interview | null>(() => pm?.interview ?? null)
  const [answer, setAnswer] = useState<Answer>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  const steps = pm ? postSteps(pm) : []
  const last = steps.length - 1
  const step = steps[Math.min(idx, last)] ?? 'result'

  const go = (i: number) => setIdx(Math.max(0, Math.min(last, i)))

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    // New step: scroll to the top and move focus to its heading for screen readers.
    bodyRef.current?.closest('.post-root')?.scrollTo?.({ top: 0 })
    const h = bodyRef.current?.querySelector<HTMLElement>('#post-step-h')
    h?.focus({ preventScroll: true })
  }, [idx])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(last, i + 1))
      else if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [last])

  if (!pm) {
    return (
      <div class="post-root post-empty">
        <EmptyState icon="whistle" title={t('match.post.noData')} action={<Button variant="primary" icon="home" onClick={done}>{t('match.post.continue')}</Button>} />
      </div>
    )
  }

  const { fixture: fx, score, heroSide } = pm
  const mine = heroSide === 'home' ? score[0] : score[1]
  const theirs = heroSide === 'home' ? score[1] : score[0]
  const res = mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw'
  const atEnd = idx >= last

  return (
    <div class={`post-root post-${res}`} data-step={step} style={{ ['--home' as string]: fx.home.kit.primary, ['--away' as string]: fx.away.kit.primary }}>
      <div class="post-bg" aria-hidden="true" />
      <div class="post-topbar">
        <div class="post-result-strip"><span>{t(`match.post.${res}`)}</span></div>
        {!atEnd && (
          <button type="button" class="post-skip" data-testid="post-skip" onClick={() => go(last)}>
            {t('postmatch.skipAll')} <Icon name="fast-forward" size={14} />
          </button>
        )}
      </div>
      <nav class="post-stepper" aria-label={t('postmatch.stepOf', { n: idx + 1, total: steps.length })}>
        <ol>
          {steps.map((s, i) => (
            <li key={s} class={`${i === idx ? 'is-current' : ''}${i < idx ? ' is-done' : ''}`}>
              <button type="button" onClick={() => go(i)} aria-current={i === idx ? 'step' : undefined} aria-label={t(`postmatch.step.${s}`)} data-testid={`post-step-${s}`}>
                <Icon name={STEP_ICON[s]} size={14} />
                <span class="post-stepper-label">{t(`postmatch.step.${s}`)}</span>
              </button>
            </li>
          ))}
        </ol>
        <span class="post-stepper-count micro t-lo" aria-live="polite">{t('postmatch.stepOf', { n: idx + 1, total: steps.length })}</span>
      </nav>

      <div class="post-step" key={step} ref={bodyRef}>
        {step === 'result' && <ResultStep pm={pm} />}
        {step === 'result' && <MomentsPanel matchKey={fx.fixtureId} top />}
        {step === 'rating' && <RatingStep pm={pm} />}
        {step === 'map' && <MapStep pm={pm} />}
        {step === 'trust' && <TrustStep pm={pm} />}
        {step === 'relations' && <RelationsStep pm={pm} />}
        {step === 'passes' && <PassStep pm={pm} />}
        {step === 'earnings' && <EarningsStep pm={pm} />}
        {step === 'interview' && <SummaryStep pm={pm} iv={iv} answer={answer} setAnswer={setAnswer} />}
      </div>

      <footer class="post-footer">
        <div class="post-nav">
          {idx > 0 && (
            <Button variant="ghost" size="lg" icon="arrow-left" class="post-back" aria-label={t('postmatch.back')} onClick={() => go(idx - 1)}>
              {t('postmatch.back')}
            </Button>
          )}
          {atEnd ? (
            <Button variant="primary" size="lg" block iconRight="arrow-right" onClick={done}>
              {t('match.post.continue')}
            </Button>
          ) : (
            <Button variant="primary" size="lg" block iconRight="arrow-right" onClick={() => go(idx + 1)} data-testid="post-next">
              {t('postmatch.next')}
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}
