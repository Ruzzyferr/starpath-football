import '../../../styles/screens/intl.css'
import { lt, t } from '../../../i18n'
import { Button, Card, Chip, Crest, EmptyState, Flag, SectionTitle } from '../../components'
import { gameState, navigate } from '../../store'
import { cupsView, type CupView } from '../../backend/worldViews'
import { MiniTable, TieList } from './CupParts'

function CupCard({ cup, title }: { cup: CupView; title: string }) {
  const mine = new Set([gameState.value?.hero.contract?.clubId ?? ''])
  return (
    <Card pad="md" class="stack" data-testid={`cup-${cup.id}`}>
      <SectionTitle action={cup.hasDraw ? <Button variant="ghost" size="sm" icon="shuffle" onClick={() => navigate('cupDraw', { comp: cup.id })}>{t('intl.cups.viewDraw')}</Button> : undefined}>
        {title} · {lt(cup.name)}
      </SectionTitle>
      {cup.winner && <Chip tone="gold" icon="trophy">{t('intl.cups.winner', { n: cup.winner.name })}</Chip>}
      {cup.groups.length > 0 && (
        <details>
          <summary class="t-sm t-mid">{t('intl.cups.groups')}</summary>
          <div class="stack">{cup.groups.map((g, i) => <MiniTable key={i} g={g} highlight={mine} qualify={2} />)}</div>
        </details>
      )}
      {cup.rounds.length === 0 ? <p class="t-sm t-lo">{t('intl.cups.tbd')}</p> : cup.rounds.slice().reverse().map((r) => (
        <div key={r.round} class="cup-round stack" style={{ gap: 'var(--sp-1)' }}>
          <h3 class="micro t-mid">{lt(r.label)}</h3>
          <TieList ties={r.ties} />
        </div>
      ))}
    </Card>
  )
}

/** World › Cups tab: domestic cup, continental cup (+ qualifying), play-off, scorers and coefficients. */
export function CupsPanel() {
  const v = cupsView()
  if (!v) return <EmptyState />
  const maxCoef = Math.max(1, ...v.coefficients.map((c) => c.total))
  return (
    <div class="stack">
      {v.playoff && <CupCard cup={v.playoff} title={t('intl.cups.playoffs')} />}
      {v.domestic && <CupCard cup={v.domestic} title={t('intl.cups.domestic')} />}
      {v.continental && <CupCard cup={v.continental} title={t('intl.cups.continental')} />}
      {v.qualifying && <CupCard cup={v.qualifying} title={t('intl.cups.qualifying')} />}
      <Card pad="md" class="stack">
        <SectionTitle>{t('intl.cups.scorers')}</SectionTitle>
        {v.scorers.length === 0 ? <p class="t-sm t-lo">{t('intl.cups.noScorers')}</p> : (
          <ol class="nt-list">
            {v.scorers.map((p, i) => (
              <li key={p.id} class={`nt-row${p.isHero ? ' is-hero' : ''}`}>
                <span class="nt-pos num">{i + 1}</span>
                {p.club && <Crest crest={p.club.crest} size={22} compact />}
                <span class="grow truncate">{p.name}</span>
                <span class="nt-ovr num">{p.goals}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <Card pad="md" class="stack" data-testid="coefficients">
        <SectionTitle>{t('intl.cups.coefficients')}</SectionTitle>
        <p class="t-xs t-lo">{t('intl.cups.coefficientInfo')}</p>
        <ol class="nt-list">
          {v.coefficients.map((c, i) => (
            <li key={c.country} class="nt-row">
              <span class="nt-pos num">{i + 1}</span>
              <Flag id={c.country} colors={c.flag} size={22} />
              <span class="grow stack" style={{ gap: 4 }}>
                <span class="truncate">{lt(c.name)}</span>
                <span class="coef-bar" style={{ width: `${(c.total / maxCoef) * 100}%` }} />
              </span>
              <span class="t-xs t-lo num">{c.seasons.map((x) => x.toFixed(1)).join(' · ')}</span>
              <span class="nt-ovr num">{c.total.toFixed(1)}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}
