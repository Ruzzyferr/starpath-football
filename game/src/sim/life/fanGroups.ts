/**
 * Supporter groups (Analiz-ve-Plan 2.4#79): every club has three groups with
 * different expectations, tracked as numeric life flags (-100..100) so event
 * cards can move them with plain `addFlags`:
 *  - ultras (`fg_ultras`): loyalty and fight: love effort and big ratings, hate red cards;
 *  - family stand (`fg_family`): smiles and signatures: love clean conduct, wins and charity, hate scandals;
 *  - local association (`fg_local`): love hometown loyalty and long stays, cool when the hero wants out.
 * Values drift toward neutral 2 % per week like the general fan base.
 */
import type { Life, LText } from '../../core/types'
import { clamp, lt } from '../career/common'
import type { MatchRelationInput } from './relationships'

export type FanGroupId = 'ultras' | 'family' | 'local'
export const FAN_GROUP_IDS: readonly FanGroupId[] = ['ultras', 'family', 'local']
export const FAN_GROUP_FLAG: Readonly<Record<FanGroupId, string>> = { ultras: 'fg_ultras', family: 'fg_family', local: 'fg_local' }
const START = 10

export interface FanGroupInfo { id: FanGroupId; name: LText; wants: LText }
export const FAN_GROUPS: readonly FanGroupInfo[] = [
  { id: 'ultras', name: lt('Ultralar', 'The ultras'), wants: lt('Sadakat ve mücadele ister: çok koş, kırmızı kart görme.', 'They want loyalty and fight: work hard, avoid red cards.') },
  { id: 'family', name: lt('Aile tribünü', 'Family stand'), wants: lt('Güler yüz ve imza ister: temiz davran, çocuklarla ilgilen.', 'They want smiles and signatures: stay clean, spend time with the kids.') },
  { id: 'local', name: lt('Yerel dernek', 'Local association'), wants: lt('Kente bağlılık ister: kulüpte kal, bölgeye katkı yap.', 'They want roots: stay at the club, give back to the area.') },
]

export const fanGroupValue = (life: Pick<Life, 'flags'>, id: FanGroupId): number => {
  const v = life.flags[FAN_GROUP_FLAG[id]]
  return typeof v === 'number' && Number.isFinite(v) ? clamp(v, -100, 100) : START
}

export function changeFanGroup(life: Pick<Life, 'flags'>, id: FanGroupId, d: number): void {
  life.flags[FAN_GROUP_FLAG[id]] = Math.round(clamp(fanGroupValue(life, id) + d, -100, 100) * 10) / 10
}

/** After a match: effort and ratings move the ultras, results and conduct the family stand. */
export function applyFanGroupsMatch(life: Pick<Life, 'flags' | 'discipline'>, m: Pick<MatchRelationInput, 'rating' | 'goals' | 'won' | 'red'>, tenureWeeks = 0): void {
  changeFanGroup(life, 'ultras', (m.rating - 6.5) * 0.8 + m.goals * 0.5 - (m.red ? 6 : 0))
  changeFanGroup(life, 'family', (m.won ? 0.6 : 0) + (life.discipline - 55) / 60 - (m.red ? 3 : 0))
  changeFanGroup(life, 'local', tenureWeeks >= 52 ? 0.3 : 0.1)
}

/** Weekly drift toward neutral (2 %). */
export function weeklyFanGroups(life: Pick<Life, 'flags'>): void {
  for (const id of FAN_GROUP_IDS) {
    const v = fanGroupValue(life, id)
    if (Math.abs(v) < 0.2) continue
    life.flags[FAN_GROUP_FLAG[id]] = Math.round(v * 0.98 * 10) / 10
  }
}

/** Mood of the three groups averaged, for chips. */
export const fanGroupsAverage = (life: Pick<Life, 'flags'>): number => FAN_GROUP_IDS.reduce((s, id) => s + fanGroupValue(life, id), 0) / FAN_GROUP_IDS.length
