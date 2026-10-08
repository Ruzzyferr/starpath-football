import { currentLang, t } from '../../../i18n'
import { attrSeries } from '../../../sim/game/saveHistory'
import { Card, CardHeader, LineChart } from '../../components'
import { seasonLabel } from '../../format'
import { gameState } from '../../store'
import { RADAR_AXES, radarValues } from '../career/attrs'
import { Radar } from '../career/Radar'
import { growthCompare } from './growthCompare'

/** 2.7#55: attribute history on the profile, now versus a season ago (radar + biggest mover). */
export function AttrGrowth() {
  void currentLang.value
  const s = gameState.value
  if (!s) return null
  const cmp = growthCompare(s.attrHistory, s.hero.attrs, s.calendar.season)
  if (!cmp) {
    return (
      <Card pad="md" data-testid="attr-growth">
        <CardHeader title={t('profile.growth.title')} icon="trend-up" />
        <p class="t-sm t-lo">{t('profile.growth.empty')}</p>
      </Card>
    )
  }
  const now = radarValues(s.hero.attrs)
  const then = radarValues(cmp.then)
  const top = cmp.deltas[0]
  const series = attrSeries(s.attrHistory, top.key).map((p) => p.value)
  const when = seasonLabel(cmp.season)
  return (
    <Card pad="md" data-testid="attr-growth">
      <CardHeader title={t('profile.growth.title')} icon="trend-up" sub={t('profile.growth.sub', { s: when })} />
      <div class="prof-radar-card">
        <Radar axes={RADAR_AXES.map((a) => ({ label: t(`profile.radar.${a}`), value: now[a] }))} compare={RADAR_AXES.map((a) => then[a])} compareLabel={when} />
      </div>
      <div class="prof-growth-legend t-xs t-mid" aria-hidden="true">
        <span><i class="prof-growth-key is-now" />{t('profile.growth.now')}</span>
        <span><i class="prof-growth-key is-then" />{t('profile.growth.then', { s: when })}</span>
      </div>
      <ul class="prof-growth-list" data-testid="attr-growth-list">
        {cmp.deltas.slice(0, 3).filter((d) => d.delta !== 0).map((d) => (
          <li key={d.key}><span>{t(`data.attr.${d.key}`)}</span><strong class={`num ${d.delta > 0 ? 't-pos' : 't-neg'}`}>{d.delta > 0 ? '+' : ''}{d.delta}</strong></li>
        ))}
      </ul>
      {series.length > 1 && (
        <>
          <div class="micro t-mid">{t('profile.growth.trend', { a: t(`data.attr.${top.key}`) })}</div>
          <LineChart values={series} height={80} color="var(--brand-pitch)" label={t('profile.growth.trend', { a: t(`data.attr.${top.key}`) })} />
        </>
      )}
    </Card>
  )
}
