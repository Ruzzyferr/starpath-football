import '../../styles/screens/objectives.css'
import { AdOffer } from './store/AdOffer'
import { serverWallet } from '../../store-iap'
import { CeremonyBanner } from './awards/CeremonyBanner'
import '../../styles/screens/season.css'
import { useEffect, useState } from 'preact/hooks'
import { t, lt, currentLang } from '../../i18n'
import { Button, Crest, EmptyState, Money, NumberTicker, toasts } from '../components'
import { Icon } from '../icons'
import { haptic } from '../haptics'
import { formatCompact, formatRating, seasonLabel } from '../format'
import { prefersReducedMotion } from '../hooks/motion'
import { actions, data, navigate } from '../store'
import { Confetti } from './season/Confetti'
import { Medal, Trophy, awardTier } from './season/TrophyArt'

function finish() {
  actions.continueSeason()
  navigate('home', undefined, { tab: true })
}

export function SeasonEndScreen() {
  const s = data.seasonSummary()
  const obj = data.objectives()
  void currentLang.value
  const total = s ? 5 + s.awards.length : 0
  const [stage, setStage] = useState(() => (prefersReducedMotion() ? 99 : 0))
  // The ceremony is the one hero moment: drop stale day-to-day toasts on entry.
  useEffect(() => {
    toasts.value = toasts.value.filter((x) => x.kind === 'reward')
  }, [])

  useEffect(() => {
    if (!s || stage >= total) return
    const id = setTimeout(() => setStage((x) => x + 1), stage === 0 ? 500 : 750)
    return () => clearTimeout(id)
  }, [stage, total])

  const trophiesShown = !!s && stage >= 4 && s.trophies.length > 0
  const wonAwards = s ? s.awards.filter((a) => a.won).length : 0
  const awardsDone = !!s && stage >= 4 + s.awards.length
  useEffect(() => {
    if (trophiesShown) haptic('success')
  }, [trophiesShown])

  if (!s) {
    return (
      <div class="se-root se-empty">
        <EmptyState icon="trophy" title={t('season.noData')} action={<Button variant="primary" icon="home" onClick={() => navigate('home', undefined, { tab: true })}>{t('match.pre.backHome')}</Button>} />
      </div>
    )
  }

  const celebrate = trophiesShown || (awardsDone && wonAwards > 0)
  const ovrDelta = s.ovrEnd - s.ovrStart

  return (
    <div class="se-root">
      <div class="se-stage-bg" aria-hidden="true">
        <span class="se-spot se-spot-l" />
        <span class="se-spot se-spot-r" />
        <span class="se-spot se-spot-c" />
        <span class="se-floor" />
      </div>
      {celebrate && <Confetti seed={s.season} count={trophiesShown ? 80 : 50} />}

      <header class="se-head">
        <div class="se-eyebrow micro">{t('season.ceremony')}</div>
        <h1 class="display se-title">{seasonLabel(s.season)}</h1>
        {stage < total && (
          <button type="button" class="se-skip" onClick={() => setStage(99)}>
            {t('season.skip')} <Icon name="fast-forward" size={16} />
          </button>
        )}
      </header>

      <div class="se-content">
        {stage >= 0 && (
          <section class="se-card se-record se-reveal" aria-label={t('season.record')}>
            <Crest crest={s.club.crest} size={72} label={s.club.name} />
            <div class="grow">
              <div class="micro t-mid">{t('season.record')}</div>
              <div class="se-club">{s.club.name}</div>
              {stage >= 1 && (
                <div class="se-pos se-reveal">
                  <span class="se-pos-num score-font">{s.leaguePosition}</span>
                  <span class="t-sm t-mid">{t('season.positionOf', { league: s.leagueName, n: s.leaguePosition })}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {stage >= 2 && (
          <section class="se-card se-stats se-reveal" aria-label={t('season.record')}>
            <div class="se-stat"><NumberTicker value={s.stats.apps} class="score-font" /><span>{t('season.apps')}</span></div>
            <div class="se-stat"><NumberTicker value={s.stats.goals} class="score-font" /><span>{t('season.goals')}</span></div>
            <div class="se-stat"><NumberTicker value={s.stats.assists} class="score-font" /><span>{t('season.assists')}</span></div>
            <div class="se-stat"><NumberTicker value={s.stats.avgRating} format={(n) => formatRating(n)} class="score-font" /><span>{t('season.avgRating')}</span></div>
            <div class="se-stat"><NumberTicker value={s.stats.motm} class="score-font" /><span>{t('season.motm')}</span></div>
          </section>
        )}

        {stage >= 3 && (
          <section class="se-card se-progress se-reveal">
            <div class="se-prog">
              <span class="micro t-mid">{t('season.ovr')}</span>
              <span class="se-ovr">
                <span class="score-font t-mid">{s.ovrStart}</span>
                <Icon name="arrow-right" size={18} class="t-lo" />
                <span class="score-font se-ovr-end">{s.ovrEnd}</span>
                {ovrDelta !== 0 && <span class={`se-ovr-delta ${ovrDelta > 0 ? 't-pos' : 't-neg'}`}>{ovrDelta > 0 ? '+' : '−'}{Math.abs(ovrDelta)}</span>}
              </span>
            </div>
            <div class="se-prog">
              <span class="micro t-mid">{t('season.money')}</span>
              <Money value={s.moneyEarned} compact class="se-big t-gold" />
            </div>
            <div class="se-prog">
              <span class="micro t-mid">{t('season.followers')}</span>
              <NumberTicker value={s.followersGained} format={(n) => '+' + formatCompact(Math.round(n))} class="se-big" />
            </div>
          </section>
        )}

        {stage >= 4 && (
          <section class="se-card se-trophies se-reveal" aria-label={t('season.trophies')}>
            <h2 class="se-h">{t('season.trophies')}</h2>
            {s.trophies.length ? (
              <div class="se-trophy-row">
                {s.trophies.map((tr, i) => (
                  <figure class="se-trophy se-pop" key={i} style={{ animationDelay: `${i * 160}ms` }}>
                    <Trophy name={lt(tr)} season={s.season} size={64} metal="gold" />
                    <figcaption>{lt(tr)}</figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <EmptyState compact icon="trophy" text={t('season.noTrophies')} />
            )}
          </section>
        )}

        {stage >= 4 && s.awards.length > 0 && (
          <section class="se-card se-awards se-reveal" aria-label={t('season.awards')}>
            <h2 class="se-h">{t('season.awards')}</h2>
            <ul class="se-award-list">
              {s.awards.map((a, i) =>
                stage >= 5 + i ? (
                  <li key={a.key} class={`se-award se-pop${a.won ? ' is-won' : ' is-missed'}`}>
                    <span class="se-award-medal">{a.won ? <Medal tier={awardTier(a.key)} size={40} /> : <Icon name="medal" size={28} />}</span>
                    <span class="grow se-award-name">{lt(a.name)}</span>
                    <span class={`chip ${a.won ? 'chip-gold chip-solid' : 'chip-neutral'}`}>
                      <Icon name={a.won ? 'check' : 'close'} size={13} /> {a.won ? t('season.won') : t('season.missed')}
                    </span>
                  </li>
                ) : (
                  <li key={a.key} class="se-award is-pending" aria-hidden="true"><span class="se-award-medal"><Icon name="question" size={24} /></span><span class="grow se-award-name t-lo">{lt(a.name)}</span></li>
                ),
              )}
            </ul>
          </section>
        )}

        {stage >= total && (
          <section class="se-card se-objectives se-reveal" aria-label={t('objectives.review')}>
            <h2 class="se-h">{t('objectives.review')}</h2>
            <p class="se-obj-sum">
              <span class="t-pos">{t('objectives.statusDone')}: {obj.seasonDone}</span>
              <span class="t-mid">{t('objectives.statusMissed')}: {obj.seasonFailed}</span>
            </p>
            {obj.seasonDone + obj.seasonFailed === 0 ? (
              <p class="t-sm t-lo">{t('objectives.reviewNone')}</p>
            ) : (
              <ul class="obj-history">
                {obj.recent.slice(0, obj.seasonDone + obj.seasonFailed).map((r, i) => (
                  <li key={i} class={`obj-hist obj-hist-${r.status}`} data-testid="objective-result">
                    <span class="obj-avatar obj-avatar-sm" aria-hidden="true">{r.icon}</span>
                    <span class="grow">{lt(r.title)}</span>
                    <span class="obj-hist-status">
                      <Icon name={r.status === 'done' ? 'check' : 'hourglass'} size={14} />
                      {r.status === 'done' ? t('objectives.statusDone') : t('objectives.statusMissed')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {stage >= total && s.highlights.length > 0 && (
          <section class="se-card se-highlights se-reveal">
            <h2 class="se-h">{t('season.highlights')}</h2>
            <ul class="se-hl-list">
              {s.highlights.map((h, i) => (
                <li key={i}><Icon name="sparkle" size={16} class="t-gold" /> <span>{lt(h)}</span></li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {stage >= total && <div class="se-ceremony"><CeremonyBanner /></div>}
      <footer class="se-footer">
        {stage >= total && serverWallet.value?.seasonX2Ready && (
          <AdOffer offer="season_x2" label={{ tr: 'İzle: sezon ödülü ×2 (+80💎)', en: 'Watch: season reward ×2 (+80💎)' }} done={{ tr: '+80💎 sezon ödülü', en: '+80💎 season reward' }} />
        )}
        <Button variant="gold" size="lg" block iconRight="arrow-right" onClick={finish} disabled={stage < total}>
          {t('season.continue')}
        </Button>
      </footer>
    </div>
  )
}
