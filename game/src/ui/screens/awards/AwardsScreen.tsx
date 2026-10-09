import '../../../styles/screens/intl.css'
import { useState } from 'preact/hooks'
import { lt, t } from '../../../i18n'
import { Button, Card, Chip, EmptyState, Page, SectionTitle, WhyList } from '../../components'
import { whyAward } from '../../../sim/game/whyMore'
import { formatNumber, formatRating, seasonLabel } from '../../format'
import { gameState, navigate } from '../../store'
import { Icon } from '../../icons'
import { awardsView, markCeremonySeen } from '../../backend/worldViews'
import type { SeasonAwardRecord, StarCandidate } from '../../../sim/world/worldTypes'

const TOTS_XY: [number, number][] = [[50, 90], [85, 69], [62, 74], [38, 74], [15, 69], [50, 56], [72, 46], [28, 46], [82, 22], [50, 14], [18, 22]]

function Pitch({ xi }: { xi: SeasonAwardRecord['teamOfSeason'] }) {
  return (
    <div class="tots-pitch" role="img" aria-label={t('intl.awards.tots')} data-testid="tots">
      {xi.map((p, i) => {
        const [x, y] = TOTS_XY[i] ?? [50, 50]
        return (
          <div key={p.playerId} class={`tots-p${p.isHero ? ' is-hero' : ''}`} style={{ left: `${x}%`, top: `${y}%` }}>
            <span class="tots-dot">{formatRating(p.rating)}</span>
            <span class="tots-n">{p.isHero ? t('intl.awards.you') : p.name.split(' ').slice(-1)[0]}</span>
          </div>
        )
      })}
    </div>
  )
}

function Step({ c, place, shown }: { c: StarCandidate | undefined; place: 1 | 2 | 3; shown: boolean }) {
  const key = place === 1 ? 'first' : place === 2 ? 'second' : 'third'
  return (
    <div class={`aw-step p${place}${c?.isHero ? ' is-hero' : ''}`} data-testid={`podium-${place}`}>
      <div class={shown ? 'aw-reveal stack' : 'aw-hidden stack'} style={{ alignItems: 'center', gap: 2 }}>
        <span class="aw-name">{shown ? (c?.name ?? '—') : '???'}</span>
        <span class="t-xs t-lo">{shown && c ? t('intl.awards.points', { n: c.points }) : t(`intl.awards.place.${key}`)}</span>
      </div>
      <div class="aw-block">{place}</div>
    </div>
  )
}

/** Awards ceremony (Golden Star 3rd → 2nd → 1st, then the season's other awards) and the awards archive. */
export function AwardsScreen() {
  const s = gameState.value
  const v = awardsView()
  const [stage, setStage] = useState(0)
  if (!s || !v) return <Page title={t('intl.awards.title')} backTo="home"><EmptyState /></Page>
  if (!v.star) return <Page title={t('intl.awards.title')} sub={t('intl.awards.sub')} backTo="home"><EmptyState icon="medal" title={t('intl.awards.none')} /></Page>
  const r = v.star.ranking
  const rec = v.record
  const all = stage >= 3
  const club = (id: string | null | undefined) => (id ? s.world.clubs[id]?.name ?? '' : '')
  return (
    <Page title={v.pending ? t('intl.awards.ceremony') : t('intl.awards.title')} sub={t('intl.awards.ceremonySub', { s: seasonLabel(v.star.season) })} backTo="home" wide>
      <div class="aw-stage" data-testid="awards-ceremony">
        <h2 class="h2">⭐ {t('intl.awards.goldenStar')}</h2>
        <p class="t-xs t-lo">{t('intl.awards.votes', { n: v.star.journalists })}</p>
        <div class="aw-podium">
          <Step c={r[1]} place={2} shown={stage >= 2} />
          <Step c={r[0]} place={1} shown={stage >= 3} />
          <Step c={r[2]} place={3} shown={stage >= 1} />
        </div>
        {!all ? (
          <div class="row" style={{ gap: 'var(--sp-2)' }}>
            <Button variant="primary" icon="sparkle" onClick={() => setStage((x) => x + 1)} data-testid="reveal-next">{t('intl.awards.reveal')}</Button>
            <Button variant="ghost" onClick={() => setStage(3)}>{t('intl.awards.revealAll')}</Button>
          </div>
        ) : (
          <>
            <p class="t-sm t-mid">{v.heroRank ? t('intl.awards.yourRank', { n: v.heroRank }) : t('intl.awards.notListed')}</p>
            <WhyList why={whyAward(v.star)} id="why-award" testId="why-award" />
            {r[0] && <p class="t-xs t-lo">{t('intl.awards.parts', { l: formatNumber(r[0].parts.league, undefined, 1), c: formatNumber(r[0].parts.continental, undefined, 1), i: formatNumber(r[0].parts.international, undefined, 1), t: formatNumber(r[0].parts.trophies, undefined, 1) })}</p>}
            {v.pending && <Button variant="primary" icon="check" onClick={() => { markCeremonySeen(); navigate('home', undefined, { tab: true }) }}>{t('intl.awards.done')}</Button>}
          </>
        )}
      </div>

      {all && (
        <div class="aw-grid">
          <Card pad="md" class="stack">
            <SectionTitle>{t('intl.awards.shortlist')}</SectionTitle>
            <ol class="nt-list">
              {r.slice(0, 30).map((c, i) => (
                <li key={c.playerId} class={`nt-row${c.isHero ? ' is-hero' : ''}`}>
                  <span class="nt-pos num">{i + 1}</span>
                  <span class="grow truncate">{c.name}<span class="t-xs t-lo"> · {club(c.clubId)}</span></span>
                  <span class="t-xs t-lo num">{formatNumber(c.score, undefined, 1)}</span>
                  <span class="nt-ovr num">{c.points}</span>
                </li>
              ))}
            </ol>
          </Card>
          <div class="stack">
            {rec && (
              <Card pad="md" class="stack">
                {rec.goldenGlove && <div class="nt-row"><span class="grow row"><Icon name="shield" size={16} class="t-gold" /><span>{t('intl.awards.goldenGlove')}: <b>{rec.goldenGlove.name}</b></span></span><Chip tone="info">{t('intl.awards.cleanSheets', { n: rec.goldenGlove.value })}</Chip></div>}
                {rec.youngPlayer && <div class="nt-row"><span class="grow row"><Icon name="sparkle" size={16} class="t-gold" /><span>{t('intl.awards.youngPlayer')}: <b>{rec.youngPlayer.name}</b></span></span></div>}
                {rec.goalOfSeason && <div class="nt-row"><span class="grow row"><Icon name="target" size={16} class="t-gold" /><span>{t('intl.awards.goalOfSeason')}: <b>{rec.goalOfSeason.name}</b></span></span></div>}
              </Card>
            )}
            {rec && rec.goalNominees.length > 0 && (
              <Card pad="md" class="stack">
                <SectionTitle>{t('intl.awards.goalOfSeason')} · {t('intl.awards.nominees')}</SectionTitle>
                <ul class="nt-list">
                  {rec.goalNominees.map((g, i) => (
                    <li key={i} class={`nt-row${g.isHero ? ' is-hero' : ''}`}>
                      <span class="grow truncate">{g.name}<span class="t-xs t-lo"> · {t('intl.awards.goalDesc', { k: t(`intl.awards.kinds.${g.kind}`), d: g.distance, m: g.minute })} · {lt(g.compName)}</span></span>
                      {rec.goalOfSeason && g.playerId === rec.goalOfSeason.playerId && g.minute === rec.goalOfSeason.minute && g.week === rec.goalOfSeason.week && <Chip tone="gold" icon="trophy">★</Chip>}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {rec && rec.teamOfSeason.length > 0 && (
              <Card pad="md" class="stack">
                <SectionTitle>{t('intl.awards.tots')}{rec.teamOfSeasonLeague ? ` · ${s.world.leagues[rec.teamOfSeasonLeague]?.name ?? ''}` : ''}</SectionTitle>
                <Pitch xi={rec.teamOfSeason} />
              </Card>
            )}
            {v.months.length > 0 && (
              <Card pad="md" class="stack">
                <SectionTitle>{t('intl.awards.potm')}</SectionTitle>
                <ul class="nt-list">
                  {v.months.map((m, i) => (
                    <li key={i} class={`nt-row${m.isHero ? ' is-hero' : ''}`}>
                      <span class="grow truncate">{m.name}<span class="t-xs t-lo"> · {t('intl.awards.potmRow', { m: lt(m.monthName), l: m.leagueName })}</span></span>
                      <span class="t-xs t-lo">{m.goals}G {m.assists}A</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Card pad="md" class="stack">
              <SectionTitle>{t('intl.awards.history')}</SectionTitle>
              <ul class="nt-list">
                {v.history.map((h) => (
                  <li key={h.season} class={`nt-row${h.isHero ? ' is-hero' : ''}`}>
                    <span class="t-xs t-lo num">{seasonLabel(h.season)}</span>
                    <span class="grow truncate">⭐ {h.winner}</span>
                    <span class="t-xs t-lo truncate">{h.club?.name ?? ''}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </Page>
  )
}
