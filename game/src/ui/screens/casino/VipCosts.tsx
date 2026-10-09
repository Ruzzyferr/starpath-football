/** VIP tier (table limit, comps) and the weekly career cost of heavy gambling, straight from the sim formulas. */
import { useMemo } from 'preact/hooks'
import type { GameState, LText } from '../../../core/types'
import { lt, t } from '../../../i18n'
import {
  BASE_STAKE_SHARE, CASINO_FLAGS, VIP_TURNOVER, casinoCareerCost, casinoVipTier, maxStakeFor, stakeShareFor,
} from '../../../sim/life/casino'
import { Card, Chip } from '../../components'
import { formatMoney, formatNumber } from '../../format'
import { Icon } from '../../icons'
import { gameState, navigate } from '../../store'
import { HelplineNote } from './ResponsiblePanel'

/** Dry-run of this week's gambling cost on a copy of the state (never touches the live career). */
function weeklyCostLines(s: GameState): LText[] {
  try {
    const life = structuredClone(s.life)
    return casinoCareerCost(life, { form: s.hero.form }, true)
  } catch {
    return []
  }
}

const pct = (share: number) => Math.round(share * 1000) / 10

export function VipCard() {
  const s = gameState.value
  const lines = useMemo(() => (s ? weeklyCostLines(s) : []), [s])
  if (!s) return null
  const life = s.life
  const tier = casinoVipTier(life)
  const a = life.casino.addiction
  const turnover = Number(life.flags[CASINO_FLAGS.turnover] ?? 0) || 0
  const nextAt = tier < VIP_TURNOVER.length - 1 ? VIP_TURNOVER[tier + 1]! : null
  const rows: [number, string][] = [[30, t('casino.vip.cost30')], [40, t('casino.vip.cost40')], [55, t('casino.vip.cost55')]]
  return (
    <Card class="cas-vip stack" variant="raised" data-testid="casino-vip" data-tier={tier}>
      <div class="row">
        <Icon name="star" size={20} />
        <h2 class="h3 grow">{t('casino.vip.title')}</h2>
        <Chip tone={tier > 0 ? 'gold' : 'neutral'}>{tier > 0 ? t('casino.vip.tier', { n: tier }) : t('casino.vip.none')}</Chip>
      </div>
      <p class="t-sm" data-testid="casino-vip-limit">{t('casino.vip.limit', { p: formatNumber(pct(stakeShareFor(life)), undefined, 1), m: formatMoney(maxStakeFor(life), { compact: true }), min: formatMoney(maxStakeFor({ ...life, money: 0 }), { compact: true }) })}</p>
      <p class="t-xs t-mid">
        {nextAt === null ? t('casino.vip.max') : t('casino.vip.next', { n: formatMoney(Math.max(0, nextAt - turnover), { compact: true }) })}
        {tier > 0 && ` · ${t('casino.vip.comps')}`}
      </p>
      <h3 class="h3 cas-vip-cost-title">{t('casino.vip.costTitle')}</h3>
      <ul class="cas-vip-costs t-sm" data-testid="casino-cost">
        {rows.map(([from, text]) => (
          <li key={from} class={a >= from ? 'is-active' : ''}>
            <Icon name={a >= from ? 'warning' : 'shield-check'} size={14} /> {text}
          </li>
        ))}
      </ul>
      {tier >= 2 && <p class="t-xs t-mid">{t('casino.vip.vipMult')}</p>}
      <p class="t-sm" data-testid="casino-cost-now">
        {lines.length > 0 ? <><b>{t('casino.vip.now')}:</b> {lt(lines[0]!)}</> : t('casino.vip.costNone')}
      </p>
      <HelplineNote />
      <a class="addiction-link t-xs" href="#casino" onClick={(e) => { e.preventDefault(); navigate('casino') }}>{t('casino.vip.help')}</a>
    </Card>
  )
}

/** One-line variant for the gambling meter on Life/Home. */
export function VipNote() {
  const s = gameState.value
  const lines = useMemo(() => (s ? weeklyCostLines(s) : []), [s])
  if (!s) return null
  const tier = casinoVipTier(s.life)
  if (tier === 0 && lines.length === 0) return null
  return (
    <div class="t-xs t-mid stack" data-testid="addiction-vip">
      {tier > 0 && <span><Icon name="star" size={12} /> {t('casino.vip.short', { n: tier, p: pct(stakeShareFor(s.life) || BASE_STAKE_SHARE) })}</span>}
      {lines.length > 0 && <span>{lt(lines[0]!)}</span>}
    </div>
  )
}
