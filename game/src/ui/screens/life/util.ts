import type { Appearance, AssetCategory, RelationKind, Relationship, World } from '../../../core/types'
import { hashString } from '../../../core/rng'
import { statLabel } from '../../components'
import { formatDelta } from '../../format'
import { isIconName, type IconName } from '../../icons'
import type { Delta } from '../../store'

export function deltasText(deltas: Delta[]): string {
  return deltas.map((d) => `${formatDelta(d.key, d.value)} ${statLabel(d.key, d.label)}`).join(', ')
}

const FEMININE: ReadonlySet<RelationKind> = new Set<RelationKind>(['mother', 'partner'])
const LONG_STYLES = [6, 7, 14, 10]

/** Deterministic face for people who are not NPC players. */
export function relAppearance(rel: Relationship, world: World | undefined): Appearance {
  if (rel.npcId && world?.players[rel.npcId]) return world.players[rel.npcId].appearance
  const h = hashString(rel.id + rel.name)
  const fem = FEMININE.has(rel.kind) || (rel.kind === 'sibling' && h % 2 === 0)
  return {
    skin: h % 10,
    hairStyle: fem ? LONG_STYLES[(h >>> 4) % LONG_STYLES.length] : (h >>> 4) % 15,
    hairColor: (h >>> 8) % 10,
    beard: fem ? 0 : (h >>> 12) % 8,
    eyeColor: (h >>> 16) % 6,
    face: (h >>> 19) % 6,
    accessory: fem ? 2 : (h >>> 22) % 6 === 5 ? 5 : 0,
  }
}

export function relAge(kind: RelationKind): number {
  if (kind === 'mother' || kind === 'father') return 50
  if (kind === 'manager' || kind === 'chairman') return 52
  if (kind === 'agent' || kind === 'press') return 40
  return 22
}

const CAT_ICON: Record<AssetCategory, IconName> = {
  house: 'house', car: 'car', watch: 'watch', fashion: 'hanger', tech: 'laptop', pet: 'paw',
  boat: 'boat', jet: 'airplane', art: 'palette', island: 'palm', business: 'storefront', facility: 'barbell',
}
export function assetIcon(icon: string, cat: AssetCategory): IconName {
  return isIconName(icon) ? icon : CAT_ICON[cat]
}
export const categoryIcon = (c: AssetCategory): IconName => CAT_ICON[c]
