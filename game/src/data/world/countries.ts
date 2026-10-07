/**
 * Football nations of the fictional world. Country ids/names are real (they are
 * places, not brands); every league and cup name is fictional.
 */
import type { Country, LText } from '../../core/types'
import type { NameStyle } from './names'

/** Static definition of a country: the shared `Country` plus world-gen extras. */
export interface CountryDef extends Country {
  nameStyle: NameStyle
  /** League names from tier 1 downwards (at least 3 entries). */
  leagueNames: readonly string[]
  /** National knockout cup. */
  cupName: LText
}

export const COUNTRY_DEFS: readonly CountryDef[] = [
  {
    id: 'TR', name: { tr: 'Türkiye', en: 'Türkiye' }, adjective: { tr: 'Türk', en: 'Turkish' },
    flag: ['#E30A17', '#FFFFFF', '#E30A17'], reputation: 74, nameStyle: 'turkish',
    leagueNames: ['Anadolu Süper Ligi', 'Anadolu Birinci Ligi', 'Anadolu İkinci Ligi'],
    cupName: { tr: 'Hilal Kupası', en: 'Crescent Cup' },
  },
  {
    id: 'EN', name: { tr: 'İngiltere', en: 'England' }, adjective: { tr: 'İngiliz', en: 'English' },
    flag: ['#FFFFFF', '#CE1124', '#FFFFFF'], reputation: 92, nameStyle: 'english',
    leagueNames: ['National Premier Division', 'National First Division', 'National Second Division'],
    cupName: { tr: 'Taç Kupası', en: 'Crown Cup' },
  },
  {
    id: 'ES', name: { tr: 'İspanya', en: 'Spain' }, adjective: { tr: 'İspanyol', en: 'Spanish' },
    flag: ['#AA151B', '#F1BF00', '#AA151B'], reputation: 90, nameStyle: 'spanish',
    leagueNames: ['Liga Primera Ibérica', 'Liga Segunda Ibérica', 'Liga Tercera Ibérica'],
    cupName: { tr: 'İberya Kupası', en: 'Iberian Cup' },
  },
  {
    id: 'DE', name: { tr: 'Almanya', en: 'Germany' }, adjective: { tr: 'Alman', en: 'German' },
    flag: ['#000000', '#DD0000', '#FFCE00'], reputation: 87, nameStyle: 'german',
    leagueNames: ['Erste Bundesklasse', 'Zweite Bundesklasse', 'Dritte Bundesklasse'],
    cupName: { tr: 'Kartal Kupası', en: 'Eagle Cup' },
  },
  {
    id: 'IT', name: { tr: 'İtalya', en: 'Italy' }, adjective: { tr: 'İtalyan', en: 'Italian' },
    flag: ['#009246', '#FFFFFF', '#CE2B37'], reputation: 86, nameStyle: 'italian',
    leagueNames: ['Lega Maggiore', 'Lega Cadetti', 'Lega Terza'],
    cupName: { tr: 'Üç Renk Kupası', en: 'Tricolour Cup' },
  },
  {
    id: 'FR', name: { tr: 'Fransa', en: 'France' }, adjective: { tr: 'Fransız', en: 'French' },
    flag: ['#0055A4', '#FFFFFF', '#EF4135'], reputation: 83, nameStyle: 'french',
    leagueNames: ['Division Élite', 'Division Deux', 'Division Trois'],
    cupName: { tr: 'Altıgen Kupası', en: 'Hexagon Cup' },
  },
  {
    id: 'PT', name: { tr: 'Portekiz', en: 'Portugal' }, adjective: { tr: 'Portekizli', en: 'Portuguese' },
    flag: ['#006600', '#FF0000', '#FF0000'], reputation: 76, nameStyle: 'portuguese',
    leagueNames: ['Liga Lusa', 'Liga Lusa Dois', 'Liga Lusa Três'],
    cupName: { tr: 'Atlantik Kupası', en: 'Atlantic Cup' },
  },
  {
    id: 'NL', name: { tr: 'Hollanda', en: 'Netherlands' }, adjective: { tr: 'Hollandalı', en: 'Dutch' },
    flag: ['#AE1C28', '#FFFFFF', '#21468B'], reputation: 75, nameStyle: 'dutch',
    leagueNames: ['Hoofdklasse', 'Eerste Klasse', 'Tweede Klasse'],
    cupName: { tr: 'Lale Kupası', en: 'Tulip Cup' },
  },
  {
    id: 'BR', name: { tr: 'Brezilya', en: 'Brazil' }, adjective: { tr: 'Brezilyalı', en: 'Brazilian' },
    flag: ['#009C3B', '#FFDF00', '#002776'], reputation: 80, nameStyle: 'brazilian',
    leagueNames: ['Série Ouro', 'Série Prata', 'Série Bronze'],
    cupName: { tr: 'Tropik Kupası', en: 'Tropical Cup' },
  },
  {
    id: 'AR', name: { tr: 'Arjantin', en: 'Argentina' }, adjective: { tr: 'Arjantinli', en: 'Argentine' },
    flag: ['#74ACDF', '#FFFFFF', '#74ACDF'], reputation: 79, nameStyle: 'argentine',
    leagueNames: ['Liga Austral', 'Ascenso Austral', 'Federal Austral'],
    cupName: { tr: 'Pampa Kupası', en: 'Pampas Cup' },
  },
  {
    id: 'US', name: { tr: 'Amerika Birleşik Devletleri', en: 'United States' },
    adjective: { tr: 'Amerikan', en: 'American' },
    flag: ['#B22234', '#FFFFFF', '#3C3B6E'], reputation: 62, nameStyle: 'american',
    leagueNames: ['National Soccer Conference', 'United Soccer Division', 'Continental Soccer Division'],
    cupName: { tr: 'Özgürlük Kupası', en: 'Liberty Cup' },
  },
  {
    id: 'JP', name: { tr: 'Japonya', en: 'Japan' }, adjective: { tr: 'Japon', en: 'Japanese' },
    flag: ['#FFFFFF', '#BC002D', '#FFFFFF'], reputation: 64, nameStyle: 'japanese',
    leagueNames: ['Sakura League One', 'Sakura League Two', 'Sakura League Three'],
    cupName: { tr: 'Fuji Kupası', en: 'Fuji Cup' },
  },
]

/** Lookup by country id. */
export const COUNTRY_BY_ID: Readonly<Record<string, CountryDef>> = Object.fromEntries(
  COUNTRY_DEFS.map((c) => [c.id, c]),
)

/** The cross-country club competition. */
export const CONTINENTAL_CUP_NAME: LText = { tr: 'Yıldızlar Şampiyonlar Kupası', en: 'Star Champions Cup' }

/** Strip world-gen extras, producing the serializable `Country` stored in the World. */
export function toCountry(def: CountryDef): Country {
  return {
    id: def.id,
    name: { ...def.name },
    adjective: { ...def.adjective },
    flag: [def.flag[0], def.flag[1], def.flag[2]],
    reputation: def.reputation,
    nameStyle: def.nameStyle,
  }
}
