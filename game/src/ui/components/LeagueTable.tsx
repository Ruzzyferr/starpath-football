import type { TableRow } from '../../core/types'
import { t } from '../../i18n'
import { FormDots } from './Charts'
import { Crest } from './Art'
import type { TeamView } from '../store'

export interface Zones {
  promo?: number // top N (title / promotion)
  euro?: number // next N after promo
  playoff?: number
  releg?: number // bottom N
}

function zoneOf(pos: number, total: number, z: Zones): 'promo' | 'euro' | 'playoff' | 'releg' | null {
  const p = z.promo ?? 0
  const e = z.euro ?? 0
  const po = z.playoff ?? 0
  if (pos <= p) return 'promo'
  if (pos <= p + e) return 'euro'
  if (pos <= p + e + po) return 'playoff'
  if (z.releg && pos > total - z.releg) return 'releg'
  return null
}

/** League table with zebra rows, zone colour bands and hero-club highlight. */
export function LeagueTable({
  rows, team, highlightId, zones = {}, compact, caption, limit, onSelect,
}: {
  rows: TableRow[]
  team: (id: string) => TeamView | null
  highlightId?: string | null
  zones?: Zones
  compact?: boolean
  caption?: string
  limit?: number
  onSelect?: (clubId: string) => void
}) {
  const list = limit ? rows.slice(0, limit) : rows
  const usedZones = (['promo', 'euro', 'playoff', 'releg'] as const).filter((k) => (zones[k] ?? 0) > 0)
  return (
    <div class={`league-table-wrap${compact ? ' is-compact' : ''}`}>
      <table class="league-table">
        {caption && <caption class="sr-only">{caption}</caption>}
        <thead>
          <tr>
            <th scope="col" class="c-pos">{t('ui.table.pos')}</th>
            <th scope="col" class="c-club">{t('ui.table.club')}</th>
            <th scope="col" class="c-num">{t('ui.table.p')}</th>
            <th scope="col" class="c-num c-wide">{t('ui.table.w')}</th>
            <th scope="col" class="c-num c-wide">{t('ui.table.d')}</th>
            <th scope="col" class="c-num c-wide">{t('ui.table.l')}</th>
            <th scope="col" class="c-num c-xwide">{t('ui.table.gf')}</th>
            <th scope="col" class="c-num c-xwide">{t('ui.table.ga')}</th>
            <th scope="col" class="c-num">{t('ui.table.gd')}</th>
            <th scope="col" class="c-num c-pts">{t('ui.table.pts')}</th>
            <th scope="col" class="c-form c-xwide">{t('ui.table.form')}</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r, i) => {
            const pos = i + 1
            const tm = team(r.clubId)
            const z = zoneOf(pos, rows.length, zones)
            const gd = r.gf - r.ga
            const me = r.clubId === highlightId
            return (
              <tr
                key={r.clubId}
                class={`${z ? `zone-${z}` : ''}${me ? ' is-me' : ''}${onSelect ? ' is-clickable' : ''}`}
                onClick={onSelect ? () => onSelect(r.clubId) : undefined}
                aria-current={me ? 'true' : undefined}
              >
                <td class="c-pos num">{pos}</td>
                <td class="c-club">
                  <span class="row">
                    {tm && <Crest crest={tm.crest} size={22} compact />}
                    <span class="truncate">{compact ? (tm?.shortName ?? r.clubId) : (tm?.name ?? r.clubId)}</span>
                  </span>
                </td>
                <td class="c-num num">{r.p}</td>
                <td class="c-num c-wide num">{r.w}</td>
                <td class="c-num c-wide num">{r.d}</td>
                <td class="c-num c-wide num">{r.l}</td>
                <td class="c-num c-xwide num">{r.gf}</td>
                <td class="c-num c-xwide num">{r.ga}</td>
                <td class={`c-num num ${gd > 0 ? 't-pos' : gd < 0 ? 't-neg' : ''}`}>{gd > 0 ? `+${gd}` : gd < 0 ? `−${-gd}` : 0}</td>
                <td class="c-num c-pts num">{r.pts}</td>
                <td class="c-form c-xwide"><FormDots form={r.form.slice(-5)} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {usedZones.length > 0 && (
        <div class="zone-legend">
          {usedZones.map((k) => (
            <span key={k} class={`zone-key zone-key-${k}`}>{t(`ui.zone.${k}`)}</span>
          ))}
        </div>
      )}
    </div>
  )
}
