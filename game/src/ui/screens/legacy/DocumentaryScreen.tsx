import '../../../styles/screens/legacy.css'
import { currentLang, lt, t } from '../../../i18n'
import { Button, Card, CardHeader, EmptyState, Page } from '../../components'
import { formatCompact, formatMoney, formatNumber, formatRating, seasonLabel } from '../../format'
import { gameState, navigate, screen } from '../../store'
import { legacyFor, summaryView } from '../../backend/meta'
import { ExportCsvButton, ShareCareerButton } from '../../share/ShareButtons'
import { legacyTier, POST_CAREER } from '../../../sim/game/hallOfFame'

/** Career summary "documentary": timeline, stats, trophies, best moments, net worth, legacy score. */
export function DocumentaryScreen() {
  void currentLang.value
  const id = screen.value.params?.id
  const sum = summaryView(typeof id === 'string' ? id : undefined)
  if (!sum) {
    return (
      <Page title={t('meta.doc.title')}>
        <EmptyState icon="history" text={t('meta.hof.empty')} />
      </Page>
    )
  }
  const leg = legacyFor(sum.careerId)
  const kpi = (label: string, value: string) => (
    <div class="doc-kpi">
      <span class="micro t-lo">{label}</span>
      <b class="num">{value}</b>
    </div>
  )
  return (
    <Page title={t('meta.doc.title')} sub={`${sum.name} · ${t('meta.hof.seasons', { a: sum.startSeason, b: sum.endSeason })}`} class="doc-page" wide>
      <div class="lg-summary doc-hero" data-testid="documentary">
        <div class="grow stack" style={{ gap: '4px', minWidth: 0 }}>
          <div class="h2">{sum.name}{sum.nickname && sum.nickname !== sum.lastName ? ` “${sum.nickname}”` : ''}</div>
          <div class="t-sm t-mid">{sum.position} · {sum.nationality} · {sum.clubs.join(' → ') || '—'}</div>
          {sum.postCareer && <div class="t-sm" data-testid="doc-post-career">{lt(POST_CAREER[sum.postCareer].text)}</div>}
          {sum.forced && <div class="t-xs t-lo">{t(`meta.doc.forced.${sum.forced}`)}</div>}
          {sum.testimonial && <div class="t-sm">🎉 {t('meta.doc.testimonial', { h: sum.testimonial.score[0], a: sum.testimonial.score[1], o: sum.testimonial.opponent, g: sum.testimonial.goals })}</div>}
        </div>
        <div class="stack" style={{ alignItems: 'flex-end', gap: '2px' }}>
          <span class="micro t-lo">{t('meta.doc.legacy')}</span>
          <span class="lg-big num" data-testid="legacy-score">{formatNumber(sum.legacyScore)}</span>
          <span class="t-sm">{lt(legacyTier(sum.legacyScore))}</span>
        </div>
      </div>

      <div class="doc-kpis">
        {kpi(t('profile.stats.apps'), formatNumber(sum.totals.apps))}
        {kpi(t('profile.stats.goals'), formatNumber(sum.totals.goals))}
        {kpi(t('profile.stats.assists'), formatNumber(sum.totals.assists))}
        {kpi(t('meta.doc.peak'), String(sum.peakOvr))}
        {kpi(t('meta.doc.caps'), `${sum.caps} / ${sum.intGoals}`)}
        {kpi(t('meta.doc.netWorth'), formatMoney(sum.netWorth, { compact: true }))}
        {kpi(t('meta.doc.followers'), formatCompact(sum.followers))}
      </div>

      <Card>
        <CardHeader title={t('meta.doc.timeline')} icon="history" />
        <ol class="doc-timeline">
          {sum.timeline.map((r) => (
            <li key={`${r.season}-${r.clubName}`}>
              <div class="t-sm"><b>{seasonLabel(r.season)}</b> · {t('meta.doc.seasonRow', { c: r.clubName, a: r.apps, g: r.goals, as: r.assists })}</div>
              <div class="t-xs t-lo">
                {r.apps > 0 ? t('meta.doc.avg', { r: formatRating(r.avgRating) }) : ''}
                {r.leaguePosition ? ` · ${t('meta.doc.position', { n: r.leaguePosition })}` : ''}
                {r.trophies.length ? ` · 🏆 ${r.trophies.join(', ')}` : ''}
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardHeader title={t('meta.doc.trophies')} icon="trophy" />
        {sum.trophies.length + sum.awards.length === 0 ? (
          <p class="t-sm t-lo">{t('meta.doc.noTrophies')}</p>
        ) : (
          <ul class="rec-list">
            {sum.trophies.map((x, i) => <li key={`t${i}`}><span>🏆 {lt(x.name)}</span><span class="num t-lo">{seasonLabel(x.season)}</span></li>)}
            {sum.awards.map((x, i) => <li key={`a${i}`}><span>🏅 {lt(x.name)}</span><span class="num t-lo">{seasonLabel(x.season)}</span></li>)}
          </ul>
        )}
      </Card>

      {sum.bestMoments.length > 0 && (
        <Card>
          <CardHeader title={t('meta.doc.moments')} icon="sparkle" />
          <ul class="rec-list">{sum.bestMoments.map((m, i) => <li key={i}><span>{lt(m)}</span></li>)}</ul>
        </Card>
      )}

      <Card>
        <CardHeader title={t('meta.doc.breakdown')} icon="chart-bar" />
        <ul class="rec-list">
          {sum.breakdown.map((b) => <li key={b.key}><span>{lt(b.label)}</span><span class="num">{formatNumber(b.value, undefined, b.value % 1 ? 1 : 0)}</span></li>)}
        </ul>
      </Card>

      <div class="row wrap" style={{ gap: '8px' }}>
        <Button variant="secondary" icon="crown" onClick={() => navigate('hallOfFame')}>{t('meta.doc.hof')}</Button>
        <ShareCareerButton sum={sum} size="md" />
        <ExportCsvButton sum={sum} size="md" />
        {leg && <Button variant="gold" icon="users" onClick={() => navigate('newCareer', { legacy: sum.careerId })} data-testid="doc-legacy">{t('meta.doc.newLegacy')}</Button>}
        <Button variant="ghost" icon="sign-out" onClick={() => navigate(gameState.value ? 'home' : 'title', undefined, { tab: true })}>{t('meta.doc.mainMenu')}</Button>
      </div>
    </Page>
  )
}
