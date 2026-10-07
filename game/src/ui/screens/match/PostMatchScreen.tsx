import '../../../styles/screens/match.css'
import { useState } from 'preact/hooks'
import { t, lt, currentLang } from '../../../i18n'
import { Avatar, Button, Crest, DeltaList, EmptyState, MeterRing } from '../../components'
import { Icon, type IconName } from '../../icons'
import { formatRating, ratingColor } from '../../format'
import { actions, data, navigate, type Delta, type InterviewOption } from '../../store'
import { CompareBar } from './shared'

const TONE_ICON: Record<InterviewOption['tone'], IconName> = {
  humble: 'hand-heart',
  bold: 'fire',
  critical: 'megaphone',
  deflect: 'shuffle',
}

function done() {
  actions.finishMatch()
  navigate('home', undefined, { tab: true })
}

export function PostMatchScreen() {
  const pm = data.postMatch()
  void currentLang.value
  const [answer, setAnswer] = useState<{ id: string; deltas: Delta[] } | null>(null)

  if (!pm) {
    return (
      <div class="post-root post-empty">
        <EmptyState icon="whistle" title={t('match.post.noData')} action={<Button variant="primary" icon="home" onClick={done}>{t('match.post.continue')}</Button>} />
      </div>
    )
  }

  const { fixture: fx, score, heroSide, stats: s, team, motm } = pm
  const mine = heroSide === 'home' ? score[0] : score[1]
  const theirs = heroSide === 'home' ? score[1] : score[0]
  const res = mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw'
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
    <div class={`post-root post-${res}`} style={{ ['--home' as string]: fx.home.kit.primary, ['--away' as string]: fx.away.kit.primary }}>
      <div class="post-bg" aria-hidden="true" />
      <header class="post-head">
        <div class="post-result-strip"><span>{t(`match.post.${res}`)}</span></div>
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

        {pm.deltas.length > 0 && (
          <section class="post-card post-impact">
            <h2 class="post-h micro t-mid">{t('match.post.impact')}</h2>
            <DeltaList deltas={pm.deltas} />
          </section>
        )}

        {pm.interview && (
          <section class="post-card post-interview" aria-labelledby="post-iv-q">
            <h2 class="post-h micro t-mid"><Icon name="megaphone" size={14} /> {t('match.post.interview')}</h2>
            <p class="post-iv-q" id="post-iv-q">“{lt(pm.interview.question)}”</p>
            {answer ? (
              <div class="post-iv-done">
                <div class="row"><Icon name="check" size={18} class="t-pos" /> <span>{t('match.post.interviewDone')}</span></div>
                <p class="post-iv-chosen">{lt(pm.interview.options.find((o) => o.id === answer.id)?.label)}</p>
                <DeltaList deltas={answer.deltas} />
              </div>
            ) : (
              <div class="post-iv-options">
                {pm.interview.options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    class={`post-iv-opt tone-${o.tone}`}
                    onClick={() => setAnswer({ id: o.id, deltas: actions.answerInterview(o.id) })}
                  >
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

      <footer class="post-footer">
        <Button variant="primary" size="lg" block iconRight="arrow-right" onClick={done}>
          {t('match.post.continue')}
        </Button>
      </footer>
    </div>
  )
}
