import type { ComponentChildren } from 'preact'
import type { LText } from '../../core/types'
import { lt, t, tx } from '../../i18n'
import { deltaTone, formatDelta } from '../format'
import { Icon, type IconName } from '../icons'
import type { Delta, Risk, StatKey } from '../store'

export type ChipTone = 'neutral' | 'pos' | 'neg' | 'gold' | 'info' | 'violet' | 'warning'

export function Chip({ tone = 'neutral', icon, children, solid, title }: { tone?: ChipTone; icon?: IconName; children: ComponentChildren; solid?: boolean; title?: string }) {
  return (
    <span class={`chip chip-${tone}${solid ? ' chip-solid' : ''}`} title={title}>
      {icon && <Icon name={icon} size={13} weight={2.4} />}
      {children}
    </span>
  )
}

/** Small count badge (notifications). */
export function Badge({ count, tone = 'neg' }: { count: number; tone?: ChipTone }) {
  if (count <= 0) return null
  return <span class={`count-badge count-badge-${tone}`}>{count > 99 ? '99+' : count}</span>
}

export const STAT_ICONS: Partial<Record<StatKey, IconName>> = {
  money: 'coins', energy: 'energy', happiness: 'smile', health: 'heartbeat', stress: 'brain', discipline: 'shield',
  reputation: 'star', followers: 'instagram', form: 'trend-up', morale: 'fire', fatigue: 'hourglass', sharpness: 'target',
  managerTrust: 'whistle', xp: 'sparkle', relation: 'heart', addiction: 'dice', perkPoints: 'rocket',
}

export function statLabel(key: StatKey, override?: LText | string): string {
  if (override) return lt(override)
  return tx(`data.stat.${key}`, undefined, tx(`data.attr.${key}`, undefined, key))
}

/** "+5 Mutluluk" / "−€2.000" chip, coloured by whether the change is good. */
export function DeltaChip({ delta, compact }: { delta: Delta; compact?: boolean }) {
  const tone = deltaTone(delta.key, delta.value)
  const icon = STAT_ICONS[delta.key] ?? (delta.key in STAT_ICONS ? undefined : 'sparkle')
  const label = statLabel(delta.key, delta.label)
  const value = formatDelta(delta.key, delta.value)
  const glyph = tone === 'pos' ? '▲' : tone === 'neg' ? '▼' : ''
  return (
    <span
      class={`chip delta-chip chip-${tone}${delta.uncertain ? ' is-uncertain' : ''}`}
      title={delta.uncertain ? `${label} (${t('ui.uncertain')})` : label}
    >
      {icon && <Icon name={icon} size={13} weight={2.4} />}
      <span class="num delta-value">{value}{delta.uncertain ? '?' : ''}</span>
      {!compact && <span class="delta-label">{label}</span>}
      <span class="sr-only">{glyph}</span>
    </span>
  )
}

export function DeltaList({ deltas, compact, max }: { deltas: Delta[]; compact?: boolean; max?: number }) {
  const list = max ? deltas.slice(0, max) : deltas
  return (
    <div class="delta-list">
      {list.map((d, i) => (
        <DeltaChip key={`${d.key}-${i}`} delta={d} compact={compact} />
      ))}
      {max && deltas.length > max ? <span class="chip chip-neutral">+{deltas.length - max}</span> : null}
    </div>
  )
}

const RISK_TONE: Record<Risk, ChipTone> = { safe: 'pos', low: 'info', medium: 'warning', high: 'neg' }
const RISK_ICON: Record<Risk, IconName> = { safe: 'shield-check', low: 'info', medium: 'dice', high: 'warning' }

export function RiskBadge({ risk }: { risk: Risk }) {
  return (
    <Chip tone={RISK_TONE[risk]} icon={RISK_ICON[risk]}>
      {t(`data.risk.${risk}`)}
    </Chip>
  )
}
