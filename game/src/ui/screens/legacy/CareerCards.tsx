/**
 * Small career-depth panels used inside Profile, Club and Contract (WP-7/8):
 * potential stars with the scout band, inactivity decay warning, form clause
 * and expected minutes, personal / club records, retirement entry, market
 * reference and the form-guarantee switch.
 */
import '../../../styles/screens/legacy.css'
import { lt, t } from '../../../i18n'
import type { SquadRole } from '../../../core/types'
import { Button, Card, CardHeader, Switch, toast } from '../../components'
import { formatMoney, formatRating, seasonLabel } from '../../format'
import { gameState, navigate } from '../../store'
import {
  benchComplaintAvailable, complainBench, clubRecordRows, decayWarning, expectedMinutes, formClause, market, personalRecordRows, potential, retirementView, type RecordRow,
} from '../../backend/meta'

const starsText = (n: number): string => '★'.repeat(Math.floor(n)) + (n % 1 >= 0.5 ? '½' : '')

function recordValue(r: RecordRow): string {
  if (r.key === 'highestWage') return formatMoney(r.value.value)
  if (r.key === 'bestRating') return formatRating(r.value.value)
  if (r.key === 'mostFollowers') return r.value.value.toLocaleString()
  return String(r.value.value)
}

function Records({ rows, title, club }: { rows: RecordRow[]; title: string; club?: boolean }) {
  return (
    <Card pad="md">
      <CardHeader title={title} icon="chart-line" />
      {rows.length === 0 ? (
        <p class="t-sm t-lo">{t('meta.records.none')}</p>
      ) : (
        <ul class="rec-list" data-testid={club ? 'club-records' : 'personal-records'}>
          {rows.map((r) => (
            <li key={r.key}>
              <span class="t-sm">
                {lt(r.name)}
                <span class="t-xs t-lo"> · {club ? t('meta.records.holder', { n: r.value.isHero ? t('meta.records.you') : r.value.name || '—', s: seasonLabel(r.value.season) }) : seasonLabel(r.value.season)}</span>
              </span>
              <b class={`num ${r.value.isHero ? 't-pos' : ''}`}>{recordValue(r)}</b>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** Bench-complaint decision (polite / demand / public) after a bench streak. */
export function BenchComplaintCard() {
  const s = gameState.value
  if (!s || !benchComplaintAvailable()) return null
  const go = (a: 'polite' | 'demand' | 'public') => {
    const r = complainBench(a)
    if (r.ok) toast(r.text, r.outcome === 'promised' ? 'success' : 'info')
  }
  return (
    <Card pad="md" data-testid="bench-complaint">
      <CardHeader title={t('meta.complaint.title')} icon="bell" sub={t('meta.complaint.hint')} />
      <div class="stack" style={{ gap: '8px' }}>
        {(['polite', 'demand', 'public'] as const).map((a) => (
          <div class="stack" style={{ gap: '2px' }} key={a}>
            <Button variant={a === 'public' ? 'danger' : a === 'demand' ? 'secondary' : 'primary'} block onClick={() => go(a)} data-testid={`complain-${a}`}>
              {t(`meta.complaint.${a}`)}
            </Button>
            <span class="t-xs t-lo">{t(`meta.complaint.${a}Hint`)}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Profile block: decay warning, potential, form clause, personal records, retirement. */
export function ProfileCareerExtras() {
  const s = gameState.value
  if (!s) return null
  const h = s.hero
  const pot = potential()
  const decay = decayWarning()
  const fc = formClause()
  const role = h.contract?.role as SquadRole | undefined
  const mins = role ? expectedMinutes(role) : null
  const ret = retirementView()
  return (
    <div class="stack" data-testid="profile-extras">
      {decay !== null && !h.retired && (
        <p class="lg-warn t-sm" role="status">{decay > 0 ? t('meta.decay.warn', { n: decay }) : t('meta.decay.now')}</p>
      )}
      <BenchComplaintCard />
      {s.life.flags.promised_start === true && <p class="t-xs t-pos" role="status">{t('meta.complaint.promised')}</p>}
      <Card pad="md">
        <CardHeader title={t('meta.potential.title')} icon="star" />
        {pot && (
          <div class="stack" style={{ gap: '4px' }}>
            <div class="lg-stars h2" aria-label={`${pot.stars} / 5`} data-testid="potential-stars">{starsText(pot.stars)}</div>
            <div class="t-sm t-mid">{t('meta.potential.band', { a: pot.low, b: pot.high })}</div>
            <div class="t-xs t-lo">{t('meta.potential.confidence', { p: Math.round(pot.confidence * 100) })}</div>
          </div>
        )}
        {mins && <p class="t-xs t-lo">{t('meta.clause.minutes', { a: mins[0], b: mins[1] })}</p>}
        {fc.has && <p class={`t-xs ${fc.active ? 't-pos' : 't-mid'}`}>{fc.active ? t('meta.clause.active') : t('meta.clause.inactive', { r: fc.last.map((x) => formatRating(x)).join(' · ') || '—' })}</p>}
      </Card>
      <Records rows={personalRecordRows()} title={t('meta.records.personal')} />
      {h.retired ? (
        <Button variant="gold" icon="play" onClick={() => navigate('documentary')}>{t('meta.retire.viewDoc')}</Button>
      ) : (
        ret && (ret.canRetire || ret.forced) && (
          <Button variant="ghost" icon="sign-out" onClick={() => navigate('retire')} data-testid="profile-retire">{t('meta.retire.anytime')}</Button>
        )
      )}
    </div>
  )
}

/** Club block: the club's records (seeded history + the hero). */
export function ClubRecordsCard({ clubId }: { clubId: string }) {
  return <Records rows={clubRecordRows(clubId)} title={t('meta.records.club')} club />
}

/** Contract: market reference (5 similar players) for an offered wage. */
export function MarketPanel({ wage }: { wage: number }) {
  const m = market(wage)
  if (!m || m.samples.length === 0) return null
  return (
    <Card pad="md" data-testid="market-ref">
      <CardHeader title={t('meta.market.title')} icon="scales" sub={t('meta.market.sub')} />
      <ul class="mk-rows">
        {m.samples.map((x) => (
          <li key={x.id} class="t-sm">
            <span class="truncate">{t('meta.market.row', { n: x.name, o: x.ovr, a: x.age })}</span>
            <b class="num">{formatMoney(x.wage)}</b>
          </li>
        ))}
      </ul>
      <p class="t-xs t-lo">{t('meta.market.range', { a: formatMoney(m.min), b: formatMoney(m.max) })}</p>
      {m.pctOfMarket !== null && <p class={`t-sm ${m.pctOfMarket >= 100 ? 't-pos' : 't-mid'}`}><b>{t('meta.market.pct', { p: m.pctOfMarket })}</b></p>}
    </Card>
  )
}

/** Contract: the form-based playing-time guarantee clause + expected minutes of the asked role. */
export function FormClauseSwitch({ value, onChange, role }: { value: boolean; onChange: (v: boolean) => void; role: SquadRole }) {
  const mins = expectedMinutes(role)
  return (
    <div class="stack" style={{ gap: '4px' }}>
      <Switch checked={value} onChange={onChange} label={t('meta.clause.guarantee')} desc={t('meta.clause.guaranteeHint')} />
      <span class="t-xs t-lo">{t('meta.clause.minutes', { a: mins[0], b: mins[1] })}</span>
    </div>
  )
}
