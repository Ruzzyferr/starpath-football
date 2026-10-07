/**
 * National teams of the fictional football world. The 12 club-football
 * countries (COUNTRY_DEFS) plus four nations that only exist as national
 * teams (no simulated leagues; their squads are generated on demand).
 *
 * Tournament names are fictional on purpose (no real tournament brands).
 */
import type { Formation, LText, TacticStyle } from '../../core/types'
import { COUNTRY_DEFS } from './countries'
import type { NameStyle } from './names'

/** Confederations: the "old continent" and the "oceans" (Americas + Asia). */
export type Confed = 'EU' | 'OC'

export interface NationDef {
  id: string
  name: LText
  flag: [string, string, string]
  /** Football strength 1..100 (same scale as Country.reputation). */
  reputation: number
  nameStyle: NameStyle
  confed: Confed
  formation: Formation
  style: TacticStyle
}

const CONFED: Readonly<Record<string, Confed>> = {
  TR: 'EU', EN: 'EU', ES: 'EU', DE: 'EU', IT: 'EU', FR: 'EU', PT: 'EU', NL: 'EU',
  BR: 'OC', AR: 'OC', US: 'OC', JP: 'OC',
}
const SHAPE: Readonly<Record<string, [Formation, TacticStyle]>> = {
  TR: ['4-2-3-1', 'pressing'], EN: ['4-3-3', 'direct'], ES: ['4-3-3', 'possession'], DE: ['4-2-3-1', 'pressing'],
  IT: ['3-5-2', 'defensive'], FR: ['4-3-3', 'counter'], PT: ['4-3-3', 'possession'], NL: ['4-3-3', 'possession'],
  BR: ['4-2-3-1', 'possession'], AR: ['4-4-2', 'counter'], US: ['4-4-2', 'direct'], JP: ['4-2-3-1', 'pressing'],
}

/** Nations without simulated leagues (national team only). */
export const EXTRA_NATIONS: readonly NationDef[] = [
  { id: 'BE', name: { tr: 'Belçika', en: 'Belgium' }, flag: ['#000000', '#FDDA24', '#EF3340'], reputation: 80, nameStyle: 'dutch', confed: 'EU', formation: '3-4-3', style: 'counter' },
  { id: 'CH', name: { tr: 'İsviçre', en: 'Switzerland' }, flag: ['#D52B1E', '#FFFFFF', '#D52B1E'], reputation: 70, nameStyle: 'german', confed: 'EU', formation: '4-2-3-1', style: 'balanced' },
  { id: 'MX', name: { tr: 'Meksika', en: 'Mexico' }, flag: ['#006847', '#FFFFFF', '#CE1126'], reputation: 68, nameStyle: 'spanish', confed: 'OC', formation: '4-3-3', style: 'pressing' },
  { id: 'UY', name: { tr: 'Uruguay', en: 'Uruguay' }, flag: ['#FFFFFF', '#0038A8', '#FFFFFF'], reputation: 72, nameStyle: 'argentine', confed: 'OC', formation: '4-4-2', style: 'defensive' },
]

/** Every national team (club countries first, then the extras). */
export const NATION_DEFS: readonly NationDef[] = [
  ...COUNTRY_DEFS.map((c): NationDef => ({
    id: c.id, name: { ...c.name }, flag: [c.flag[0], c.flag[1], c.flag[2]], reputation: c.reputation, nameStyle: c.nameStyle,
    confed: CONFED[c.id] ?? 'EU', formation: SHAPE[c.id]?.[0] ?? '4-3-3', style: SHAPE[c.id]?.[1] ?? 'balanced',
  })),
  ...EXTRA_NATIONS,
]

export const NATION_BY_ID: Readonly<Record<string, NationDef>> = Object.fromEntries(NATION_DEFS.map((n) => [n.id, n]))

/** Fictional tournament names. */
export const NATIONAL_TOURNAMENT_NAMES = {
  WORLD: { tr: 'Dünya Turnuvası', en: 'World Tournament' },
  EU: { tr: 'Yaşlı Kıta Şampiyonası', en: 'Old Continent Championship' },
  OC: { tr: 'Okyanuslar Şampiyonası', en: 'Oceans Championship' },
} as const satisfies Record<string, LText>

export const QUALIFIER_SUFFIX: LText = { tr: 'Elemeleri', en: 'Qualifiers' }

/** Youth development leagues (U19 / U21) played in every international break. */
export const YOUTH_LEAGUE_NAMES = {
  U21: { tr: 'U21 Gelişim Ligi', en: 'U21 Development League' },
  U19: { tr: 'U19 Gelişim Ligi', en: 'U19 Development League' },
} as const satisfies Record<string, LText>

/** Domestic promotion play-off and continental qualifying round names. */
export const PLAYOFF_NAME: LText = { tr: 'Yükselme Play-Off', en: 'Promotion Play-Off' }
export const CONTINENTAL_QUALIFYING_NAME: LText = { tr: 'Yıldızlar Kupası Ön Eleme', en: 'Star Champions Cup Qualifying' }
