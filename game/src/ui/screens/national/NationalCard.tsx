import '../../../styles/screens/intl.css'
import { lt, t } from '../../../i18n'
import { formatNumber } from '../../format'
import { Button, Card, Chip, Flag, StatBar, type ChipTone } from '../../components'
import { Icon } from '../../icons'
import { gameState, navigate, screen } from '../../store'
import { InfoTip } from '../../tutorial/InfoTip'
import { seasonFormView } from '../../../sim/game/uiViews'
import { callupCard, type CallupCardView } from '../../backend/worldViews'

const TONE: Record<string, ChipTone> = { certain: 'pos', likely: 'info', borderline: 'warning', out: 'neg' }

/** 0–100 call-up meter with the threshold mark and the status label. */
export function CallupMeter({ v }: { v: CallupCardView }) {
  const c = v.callup
  return (
    <div class="stack" style={{ gap: 'var(--sp-1)' }}>
      <div class="nt-meter-row">
        <span class="t-sm t-mid">{t('intl.national.meterShort')} · {t(`intl.national.level.${c.level}`)}</span>
        <span class="nt-meter-value num" data-testid="nt-meter">{c.meter}</span>
      </div>
      <div class={`nt-meter is-${c.status}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.meter} aria-label={t('intl.national.meter')}>
        <div class="nt-meter-fill" style={{ width: `${c.meter}%` }} />
        <div class="nt-meter-mark" style={{ left: `${v.threshold}%` }} aria-hidden="true" />
      </div>
    </div>
  )
}

/** Separate "season form" bar: the coach's grade of this season's numbers (heroPerformanceBonus). */
export function SeasonFormBar() {
  const s = gameState.value
  if (!s) return null
  const f = seasonFormView(s)
  const label = t('intl.national.seasonForm')
  const pts = f.bonus // form points (not money)
  const txt = `${pts > 0 ? '+' : ''}${formatNumber(pts, undefined, 1)}`
  return (
    <div class="stack" style={{ gap: 'var(--sp-1)' }} data-testid="nt-seasonform">
      <div class="nt-meter-row">
        <span class="t-sm t-mid label-with-tip">{label}<InfoTip term="seasonForm" /></span>
        <span class="num t-sm">{t('intl.national.seasonFormValue', { v: txt })}</span>
      </div>
      <StatBar label={label} hideLabel showValue={false} value={f.ratio * 100} size="sm" color="var(--accent-blue)" />
    </div>
  )
}

function announceText(v: CallupCardView): string {
  if (v.announceIn === 0) return t('intl.national.announceNow')
  return v.finals ? t('intl.national.announceFinals', { n: v.announceIn }) : t('intl.national.announce', { n: v.announceIn })
}

/** Compact national-team card for Home and Profile. */
export function NationalCard({ detailed }: { detailed?: boolean }) {
  const s = gameState.value
  const v = callupCard()
  if (!s || !v) return null
  const c = v.callup
  const country = s.world.countries[s.hero.nationality]
  return (
    <Card pad="md" class="nt-card" data-testid="national-card">
      <div class="nt-card-head">
        {country && <Flag id={country.id} colors={country.flag} size={30} />}
        <div class="grow">
          <h3 class="h3">{t('intl.national.title')}</h3>
          <div class="t-xs t-lo">{v.calledToName ? t('intl.national.called', { t: lt(v.calledToName) }) : t('intl.national.notCalled')}</div>
        </div>
        <Chip tone={TONE[c.status]} icon="flag">{t(`intl.national.status.${c.status}`)}</Chip>
      </div>
      <CallupMeter v={v} />
      <SeasonFormBar />
      <div class="nt-announce"><Icon name="calendar" size={16} /> {announceText(v)}</div>
      {detailed && (
        <>
          <div class="nt-parts">
            {(['ovr', 'form', 'reputation', 'minutes', 'coach'] as const).map((k) => (
              <StatBar key={k} label={t(`intl.national.parts.${k}`)} value={c.parts[k]} size="sm" scale />
            ))}
          </div>
          {c.conduct !== undefined && <p class="t-xs t-neg" data-testid="nt-conduct">{t('intl.national.conduct', { n: c.conduct })}</p>}
          <p class="nt-criteria">{t('intl.national.criteria')}</p>
        </>
      )}
      <div class="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-2)' }}>
        <span class="t-xs t-mid">{t('intl.national.caps', { c: v.caps, g: v.goals })}</span>
        {screen.value.id !== 'national' && <Button variant="ghost" size="sm" iconRight="chevron-right" onClick={() => navigate('national')}>{t('intl.national.open')}</Button>}
      </div>
    </Card>
  )
}
