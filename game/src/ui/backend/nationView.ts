/** TeamView of a national team id ('TR', 'TR:U21'…) built from the nation's flag. */
import { NATION_BY_ID } from '../../data/world/nations'
import { parseTeamId, teamName } from '../../sim/world/national'
import { currentLang } from '../../i18n'
import type { TeamView } from '../store'

export function nationTeamView(id: string): TeamView | null {
  const p = parseTeamId(id)
  const n = p ? NATION_BY_ID[p.nationId] : undefined
  if (!p || !n) return null
  const primary = n.flag[0].toUpperCase() === '#FFFFFF' ? n.flag[1] : n.flag[0]
  const secondary = primary === n.flag[1] ? n.flag[0] : n.flag[1]
  const name = teamName(id)[currentLang.value]
  return {
    id, name, shortName: p.nationId + (p.level === 'A' ? '' : p.level.slice(1)),
    crest: { shape: 'circle', symbol: 0, colors: [n.flag[0], n.flag[1], n.flag[2]], initials: p.nationId },
    kit: { primary, secondary, pattern: 'plain' }, reputation: n.reputation,
  }
}
