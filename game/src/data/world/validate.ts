/**
 * World data pack schema + validator (2.6#120/#121). The pack is the static
 * data in countries.ts / names.ts / nations.ts; `validateWorldData` returns a
 * list of human-readable problems (empty = valid), run in CI via validate.test.ts.
 */
import { COUNTRY_DEFS, type CountryDef } from './countries'
import { NAME_POOLS, NAME_STYLES, CITIES, CLUB_PATTERNS, STADIUM_PATTERNS, isRealClubName } from './names'

export const WORLD_DATA_SCHEMA = {
  country: ['id', 'name{tr,en}', 'adjective{tr,en}', 'flag[3 hex]', 'reputation 1..100', 'nameStyle', 'leagueNames>=3', 'cupName{tr,en}'],
  namePool: ['first>=8', 'firstFemale>=8', 'last>=8', 'no duplicates', 'no blank entries'],
  cities: 'CITIES[countryId] >= 12 unique', patterns: 'CLUB_PATTERNS / STADIUM_PATTERNS per name style',
} as const

const HEX = /^#[0-9a-fA-F]{6}$/

/** Problems of one country definition (shared by the built-in pack and imported mods). */
export function validateCountryDef(c: CountryDef, cities: readonly string[] | undefined): string[] {
  const errs: string[] = []
  if (!c.name?.tr || !c.name?.en || !c.adjective?.tr || !c.adjective?.en || !c.cupName?.tr || !c.cupName?.en) errs.push(`${c.id}: missing text`)
  if (!Array.isArray(c.flag) || c.flag.length !== 3 || !c.flag.every((h) => typeof h === 'string' && HEX.test(h))) errs.push(`${c.id}: flag must be 3 hex colours`)
  if (!(c.reputation >= 1 && c.reputation <= 100)) errs.push(`${c.id}: reputation out of range`)
  if (!(NAME_STYLES as readonly string[]).includes(c.nameStyle)) errs.push(`${c.id}: unknown name style ${c.nameStyle}`)
  if (!Array.isArray(c.leagueNames) || c.leagueNames.length < 3 || new Set(c.leagueNames).size !== c.leagueNames.length) errs.push(`${c.id}: needs >=3 unique league names`)
  else for (const n of c.leagueNames) if (typeof n !== 'string' || !n.trim() || isRealClubName(n)) errs.push(`${c.id}: league name looks real or blank: ${String(n)}`)
  if (!cities || new Set(cities).size < 12) errs.push(`${c.id}: needs >=12 unique cities`)
  return errs
}

/** Problems of one name list (>=8, unique, no blanks). */
export function validateNameList(label: string, list: readonly string[]): string[] {
  const errs: string[] = []
  if (list.length < 8) errs.push(`${label}: fewer than 8 names`)
  if (new Set(list).size !== list.length) errs.push(`${label}: duplicates`)
  if (list.some((n) => typeof n !== 'string' || !n.trim())) errs.push(`${label}: blank entry`)
  return errs
}

export function validateWorldData(): string[] {
  const errs: string[] = []
  const ids = new Set<string>()
  for (const c of COUNTRY_DEFS) {
    if (ids.has(c.id)) errs.push(`duplicate country ${c.id}`)
    ids.add(c.id)
    errs.push(...validateCountryDef(c, CITIES[c.id]))
  }
  for (const style of NAME_STYLES) {
    const p = NAME_POOLS[style]
    for (const [k, list] of [['first', p.first], ['firstFemale', p.firstFemale], ['last', p.last]] as const) errs.push(...validateNameList(`${style}.${k}`, list))
    if (!CLUB_PATTERNS[style]?.length) errs.push(`${style}: no club patterns`)
    if (!STADIUM_PATTERNS[style]?.length) errs.push(`${style}: no stadium patterns`)
  }
  return errs
}
