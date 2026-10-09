import type { ComponentChildren } from 'preact'
import type { LText } from '../../core/types'
import { lt, t, tx } from '../../i18n'
import { deltaTone, formatDelta } from '../format'
import { Icon, type IconName } from '../icons'
import type { Delta, Risk, StatKey } from '../store'

export type ChipTone = 'neutral' | 'pos' | 'neg' | 'gold' | 'info' | 'violet' | 'warning'

/**
 * 2.7#42: a coloured chip never carries meaning by colour alone, so a tone with
 * meaning gets a default icon when the call site passes none. Neutral chips are
 * plain text by design.
 */
export const TONE_ICONS: Record<ChipTone, IconName | undefined> = {
  neutral: undefined, pos: 'check', neg: 'warning', gold: 'star', info: 'info', violet: 'sparkle', warning: 'warning',
}
export function chipIcon(tone: ChipTone, icon?: IconName): IconName | undefined {
  return icon ?? TONE_ICONS[tone]
}

export function Chip({ tone = 'neutral', icon, children, solid, title }: { tone?: ChipTone; icon?: IconName; children: ComponentChildren; solid?: boolean; title?: string }) {
  const shown = chipIcon(tone, icon)
  return (
    <span class={`chip chip-${tone}${solid ? ' chip-solid' : ''}`} title={title}>
      {shown && <Icon name={shown} size={13} weight={2.4} />}
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

/** Chip icon per relationship kind (relation deltas). */
export const REL_ICONS: Record<string, IconName> = {
  manager: 'whistle', fans: 'megaphone', chairman: 'building', teammate: 'users', press: 'newspaper', agent: 'phone',
  mother: 'hand-heart', father: 'hand-heart', sibling: 'hand-heart', family: 'hand-heart', partner: 'heart', bestFriend: 'handshake',
}

export function statLabel(key: StatKey, override?: LText | string): string {
  if (override) return lt(override)
  return tx(`data.stat.${key}`, undefined, tx(`data.attr.${key}`, undefined, key))
}

/** "+5 Mutluluk" / "−€2.000" chip, coloured by whether the change is good. */
export function DeltaChip({ delta, compact, direction }: { delta: Delta; compact?: boolean; direction?: boolean }) {
  const tone = deltaTone(delta.key, delta.value)
  const icon = (delta.key === 'relation' && delta.rel ? REL_ICONS[delta.rel] : undefined) ?? STAT_ICONS[delta.key] ?? (delta.key in STAT_ICONS ? undefined : 'sparkle')
  const label = statLabel(delta.key, delta.label)
  const value = formatDelta(delta.key, delta.value)
  if (direction) {
    // 2.4#113: exact numbers hidden; arrow + word so the direction never relies on colour alone.
    const up = delta.value > 0
    return (
      <span class={`chip delta-chip chip-${tone}${delta.uncertain ? ' is-uncertain' : ''}`} title={label} data-dir={up ? 'up' : 'down'}>
        <Icon name={up ? 'trend-up' : 'trend-down'} size={13} weight={2.4} />
        <span class="delta-label">{label}</span>
        <span class="sr-only">{up ? t('settings.dirUp') : t('settings.dirDown')}</span>
      </span>
    )
  }
  const glyph = tone === 'pos' ? '▲' : tone === 'neg' ? '▼' : ''
  return (
    <span
      class={`chip delta-chip chip-${tone}${delta.uncertain ? ' is-uncertain' : ''}`}
      title={delta.uncertain ? `${label} (${t('ui.uncertain')})` : label}
    >
      {icon && <Icon name={icon} size={13} weight={2.4} />}
      <span class="num delta-value">{value}{delta.uncertain ? '?' : ''}</span>
      {/* Compact chips drop the label only when a dedicated icon names the stat; attribute
          gains (shared sparkle icon) keep their name, or "+1? +1?" says nothing on touch. */}
      {(!compact || !(delta.key in STAT_ICONS)) && <span class="delta-label">{label}</span>}
      <span class="sr-only">{glyph}</span>
    </span>
  )
}

export function DeltaList({ deltas, compact, max, direction }: { deltas: Delta[]; compact?: boolean; max?: number; direction?: boolean }) {
  const list = max ? deltas.slice(0, max) : deltas
  return (
    <div class="delta-list">
      {list.map((d, i) => (
        <DeltaChip key={`${d.key}-${i}`} delta={d} compact={compact} direction={direction} />
      ))}
      {max && deltas.length > max ? <span class="chip chip-neutral delta-more">{t('ui.moreN', { n: deltas.length - max })}</span> : null}
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
