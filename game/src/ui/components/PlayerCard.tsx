import type { Appearance, CrestSpec, Position } from '../../core/types'
import { t } from '../../i18n'
import { tierOf, type Tier } from '../format'
import { Avatar, Crest, Flag } from './Art'

export interface PlayerCardStat {
  label: string
  value: number
}

export interface PlayerCardProps {
  name: string
  ovr: number
  position: Position
  appearance: Appearance
  stats: PlayerCardStat[] // up to 6, shown in one row (FC24 style)
  tier?: Tier
  crest?: CrestSpec
  flag?: { id: string; colors: [string, string, string] }
  shirt?: string
  age?: number
  size?: 'sm' | 'md' | 'lg'
  /** Disable the animated sheen (lists of many cards). */
  still?: boolean
}

/**
 * FUT-style tiered card (5:7). Bronze/silver/gold/elite/legend frames from
 * tokens; elite & legend get a slow sheen sweep (off under reduced motion).
 */
export function PlayerCard({ name, ovr, position, appearance, stats, tier, crest, flag, shirt, age, size = 'md', still }: PlayerCardProps) {
  const tr = tier ?? tierOf(ovr)
  const parts = name.trim().split(/\s+/)
  const display = parts.length > 1 ? parts[parts.length - 1] : name
  return (
    <figure class={`pcard pcard-${tr} pcard-${size}${still ? ' is-still' : ''}`} aria-label={`${name}, ${t(`data.posLong.${position}`)}, ${t('ui.ovrLabel', { n: ovr })}, ${t('ui.tierCard', { tier: t(`data.tier.${tr}`) })}`}>
      <div class="pcard-frame">
        <div class="pcard-inner">
          <div class="pcard-pitchlines" aria-hidden="true" />
          <div class="pcard-top">
            <div class="pcard-ovr score-font">{ovr}</div>
            <div class="pcard-pos">{t(`data.pos.${position}`)}</div>
            {flag && <Flag id={flag.id} colors={flag.colors} size={size === 'sm' ? 18 : 24} />}
            {crest && <Crest crest={crest} size={size === 'sm' ? 18 : 26} compact />}
          </div>
          <div class="pcard-portrait">
            <Avatar appearance={appearance} size="100%" shirt={shirt} age={age} />
          </div>
          <figcaption class="pcard-name">{display}</figcaption>
          <div class="pcard-stats">
            {stats.slice(0, 6).map((s) => (
              <div key={s.label} class="pcard-stat">
                <span class="pcard-stat-v num">{Math.round(s.value)}</span>
                <span class="pcard-stat-l">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
        {(tr === 'elite' || tr === 'legend' || tr === 'gold') && <div class="pcard-sheen" aria-hidden="true" />}
      </div>
    </figure>
  )
}
