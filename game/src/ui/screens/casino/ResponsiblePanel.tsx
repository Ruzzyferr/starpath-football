/** Responsible gaming controls: helpline message, daily loss limit, self-exclusion. */
import { useState } from 'preact/hooks'
import { t } from '../../../i18n'
import { CASINO_FLAGS, SELF_EXCLUSION_OPTIONS, casinoExclusion } from '../../../sim/life/casino'
import { Button, Card, Slider } from '../../components'
import { formatMoney } from '../../format'
import { Icon } from '../../icons'
import { gameState, navigate } from '../../store'
import { lifePlus } from '../../backend/lifePlus'

export function HelplineNote() {
  return (
    <p class="cas-helpline t-sm" role="note"><Icon name="phone" size={14} /> {t('casino.responsible.helpline')}</p>
  )
}

export function ResponsiblePanel() {
  const s = gameState.value
  const limit = s ? Number(s.life.flags[CASINO_FLAGS.lossLimit] ?? 0) || 0 : 0
  const [amt, setAmt] = useState(limit || 1000)
  if (!s) return null
  return (
    <Card class="cas-rg-controls stack" data-testid="casino-rg">
      <h3 class="h3">{t('casino.responsible.limitTitle')}</h3>
      <p class="t-sm t-mid" data-testid="casino-limit">{limit > 0 ? t('casino.responsible.limitCurrent', { amount: formatMoney(limit) }) : t('casino.responsible.limitNone')}</p>
      <Slider label={t('casino.responsible.limitTitle')} value={amt} min={100} max={50_000} step={100} onChange={setAmt} format={(v) => formatMoney(v)} />
      <div class="row wrap">
        <Button size="sm" variant="secondary" icon="lock" onClick={() => lifePlus.setLossLimit(amt)}>{t('casino.responsible.limitSet')}</Button>
        {limit > 0 && <Button size="sm" variant="ghost" onClick={() => lifePlus.setLossLimit(0)}>{t('casino.responsible.limitOff')}</Button>}
      </div>
      <h3 class="h3">{t('casino.responsible.excludeTitle')}</h3>
      <p class="t-sm t-mid">{t('casino.responsible.excludeBody')}</p>
      <div class="row wrap" role="group" aria-label={t('casino.responsible.excludeTitle')}>
        {SELF_EXCLUSION_OPTIONS.map((w) => (
          <Button key={w} size="sm" variant="ghost" icon="hourglass" onClick={() => { if (lifePlus.selfExclude(w)) navigate('casino') }}>
            {t('casino.responsible.excludeWeeks', { n: w })}
          </Button>
        ))}
      </div>
    </Card>
  )
}

/** Full-screen lock while a self-exclusion is active. Null when the casino is open. */
export function ExclusionLock() {
  const s = gameState.value
  const weeks = s ? casinoExclusion(s.life) : 0
  if (weeks <= 0) return null
  return (
    <Card variant="raised" class="cas-excluded stack" data-testid="casino-excluded">
      <div class="row"><Icon name="lock" size={22} /><h2 class="h3">{t('casino.responsible.excludedTitle')}</h2></div>
      <p>{t('casino.responsible.excludedBody', { n: weeks })}</p>
      <HelplineNote />
      <Button variant="secondary" icon="sign-out" onClick={() => navigate('life', undefined, { tab: true })}>{t('casino.responsible.leave')}</Button>
    </Card>
  )
}
