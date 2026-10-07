/**
 * Season calendar layout and fixture scheduling.
 *
 * Calendar (weeks are 0-based, days 0 = Monday … 6 = Sunday):
 *   week 0            pre-season (friendlies/training, no competitive games)
 *   weeks 1–41        competitive season
 *                       • league rounds on Saturday (day 5), 38 league weeks
 *                       • national cup rounds midweek on Wednesday (day 2)
 *                       • continental cup on Thursday (day 3), on weeks without cup rounds:
 *                         qualifying round (two legs) weeks 1–2, groups, then two-legged
 *                         knockout ties and a single final (week 36)
 *                       • weeks 11, 24, 35 are international breaks (no club games):
 *                         national teams play on Thursday and Sunday
 *                       • lower tiers (2/3) finish their league by week 39; the
 *                         promotion play-off (3rd–6th) is played in weeks 40–41
 *   week 42           end of season (call endOfSeason) — off-season begins
 *   weeks 42–43       off-season / summer transfer window; national-team finals
 *                       tournament (every summer: continental and world alternate)
 * A club therefore plays at most 2 competitive matches in any week, and never
 * on a day its players can be on international duty.
 */
import type { Fixture } from '../../core/types'
import type { Rng } from '../../core/rng'

/** Total weeks in a season (0 … SEASON_WEEKS-1). */
export const SEASON_WEEKS = 44
export const PRESEASON_WEEK = 0
export const LEAGUE_DAY = 5
export const CUP_DAY = 2
export const CONTINENTAL_DAY = 3
export const INTERNATIONAL_BREAK_WEEKS: readonly number[] = [11, 24, 35]
export const FIRST_MATCH_WEEK = 1
export const LAST_MATCH_WEEK = 41
/** Week at which the season is closed with `endOfSeason`. */
export const END_OF_SEASON_WEEK = 42
export const OFFSEASON_WEEKS: readonly number[] = [42, 43]
/** Suggested mid-season (winter) AI transfer window week. */
export const WINTER_WINDOW_WEEK = 23

/** The 38 Saturdays used for league rounds (weeks 1–41 minus international breaks). */
export const LEAGUE_WEEKS: readonly number[] = (() => {
  const out: number[] = []
  for (let w = FIRST_MATCH_WEEK; w <= LAST_MATCH_WEEK; w++) if (!INTERNATIONAL_BREAK_WEEKS.includes(w)) out.push(w)
  return out
})()

/** National cup round weeks; a cup with k rounds uses the LAST k entries (final always week 38). */
export const CUP_WEEKS: readonly number[] = [4, 9, 15, 20, 27, 32, 38]
/** Continental group matchdays (6). */
export const CONTINENTAL_GROUP_WEEKS: readonly number[] = [3, 6, 8, 13, 17, 19]
/**
 * Continental knockout legs per round; k rounds use the LAST k entries. Every
 * round but the final is two-legged (final always week 36, single leg).
 */
export const CONTINENTAL_KO_LEGS: readonly (readonly number[])[] = [[21, 23], [26, 28], [30, 33], [36]]
/** First-leg week of each continental knockout round (k rounds use the LAST k). */
export const CONTINENTAL_KO_WEEKS: readonly number[] = CONTINENTAL_KO_LEGS.map((l) => l[0])
/** Continental qualifying round (two legs, before the group stage). */
export const CONTINENTAL_QUALIFYING_WEEKS: readonly number[] = [1, 2]

/** Last league week of tier ≥ 2 leagues (their play-off follows). */
export const LOWER_TIER_LAST_WEEK = 39
/** Promotion play-off: semi-finals (single leg, better seed hosts) and final (neutral). */
export const PLAYOFF_WEEKS: readonly number[] = [40, 41]
export const PLAYOFF_DAY = LEAGUE_DAY

/** Days national teams play during an international break (Thursday, Sunday). */
export const NATIONAL_DAYS: readonly number[] = [3, 6]
/** Every international date of a season (qualifiers / youth leagues), in order. */
export const INTERNATIONAL_DATES: readonly { week: number; day: number }[] =
  INTERNATIONAL_BREAK_WEEKS.flatMap((week) => NATIONAL_DAYS.map((day) => ({ week, day })))
/** Finals tournament dates in the off-season: 3 group matchdays, semi-finals, final. */
export const NATIONAL_FINALS_DATES: readonly { week: number; day: number }[] = [
  { week: 42, day: 1 }, { week: 42, day: 3 }, { week: 42, day: 5 }, { week: 43, day: 1 }, { week: 43, day: 4 },
]
/** Squads are announced on the Monday of these weeks (one week before each break / the finals). */
export const SQUAD_ANNOUNCE_WEEKS: readonly number[] = [...INTERNATIONAL_BREAK_WEEKS.map((w) => w - 1), 41]
/** Group-stage matchdays in the continental cup; knockout rounds are numbered from here. */
export const CONTINENTAL_GROUP_ROUNDS = 6

/** Machine- and human-readable calendar description (for UI/help screens and the career layer). */
export const CALENDAR_LAYOUT = {
  seasonWeeks: SEASON_WEEKS,
  preseasonWeeks: [PRESEASON_WEEK],
  leagueDay: LEAGUE_DAY,
  cupDay: CUP_DAY,
  continentalDay: CONTINENTAL_DAY,
  leagueWeeks: LEAGUE_WEEKS,
  cupWeeks: CUP_WEEKS,
  continentalGroupWeeks: CONTINENTAL_GROUP_WEEKS,
  continentalKnockoutWeeks: CONTINENTAL_KO_WEEKS,
  continentalKnockoutLegs: CONTINENTAL_KO_LEGS,
  continentalQualifyingWeeks: CONTINENTAL_QUALIFYING_WEEKS,
  internationalBreakWeeks: INTERNATIONAL_BREAK_WEEKS,
  internationalDates: INTERNATIONAL_DATES,
  nationalFinalsDates: NATIONAL_FINALS_DATES,
  playoffWeeks: PLAYOFF_WEEKS,
  endOfSeasonWeek: END_OF_SEASON_WEEK,
  offseasonWeeks: OFFSEASON_WEEKS,
  transferWindows: { summer: [...OFFSEASON_WEEKS, PRESEASON_WEEK], winter: [WINTER_WINDOW_WEEK] },
  description: {
    tr: 'Hafta 0 hazırlık dönemi. Lig maçları 1–41. haftalarda Cumartesi (alt ligler 39. haftada biter, 40–41. haftalarda play-off); kupa maçları Çarşamba, kıtasal kupa Perşembe (eleme turları çift maç). 11, 24 ve 35. haftalar milli ara: milli maçlar Perşembe ve Pazar. 42. haftada sezon kapanır; 42–43 sezon arası, yaz transfer dönemi ve milli turnuva finalleri.',
    en: 'Week 0 is pre-season. League games are on Saturdays in weeks 1–41 (lower tiers end in week 39, play-offs in weeks 40–41); cup ties on Wednesdays, continental games on Thursdays (two-legged knockout ties). Weeks 11, 24 and 35 are international breaks with national games on Thursday and Sunday. The season closes in week 42; weeks 42–43 are the off-season, the summer transfer window and the national finals tournament.',
  },
} as const

/**
 * Week of league round `round` (0-based) for a league with `totalRounds`
 * rounds. Shorter seasons are spread over the 38 league weeks and always end
 * on the final league week.
 */
export function leagueRoundWeek(round: number, totalRounds: number, lastWeek: number = LAST_MATCH_WEEK): number {
  const weeks = lastWeek >= LAST_MATCH_WEEK ? LEAGUE_WEEKS : LEAGUE_WEEKS.filter((w) => w <= lastWeek)
  if (totalRounds > weeks.length) throw new Error(`League has ${totalRounds} rounds, max ${weeks.length}`)
  const idx = Math.round(((round + 1) * weeks.length) / totalRounds) - 1
  return weeks[idx]
}

/** Week of national cup round `round` in a cup with `totalRounds` rounds. */
export function cupRoundWeek(round: number, totalRounds: number): number {
  const offset = CUP_WEEKS.length - totalRounds
  if (offset < 0) throw new Error(`Cup has ${totalRounds} rounds, max ${CUP_WEEKS.length}`)
  return CUP_WEEKS[offset + round]
}

/** Week of continental knockout round `koRound` (0-based) with `totalKoRounds` rounds (first leg). */
export function continentalKoWeek(koRound: number, totalKoRounds: number): number {
  return continentalKoLegs(koRound, totalKoRounds)[0]
}

/** Leg weeks of continental knockout round `koRound` (one entry for the final). */
export function continentalKoLegs(koRound: number, totalKoRounds: number): readonly number[] {
  const idx = CONTINENTAL_KO_LEGS.length - totalKoRounds + koRound
  if (idx < 0 || idx >= CONTINENTAL_KO_LEGS.length) throw new Error(`Continental KO round ${koRound}/${totalKoRounds} out of range`)
  return CONTINENTAL_KO_LEGS[idx]
}

/** A pairing: [home, away]. */
export type Pairing<T> = [T, T]

/**
 * Single round robin by the circle method. Returns `n-1` rounds (n rounded up
 * to even; the "bye" partner is dropped). Venues are oriented greedily so
 * teams alternate home and away as much as possible.
 */
export function roundRobin<T>(teams: readonly T[]): Pairing<T>[][] {
  const arr: (T | null)[] = [...teams]
  if (arr.length % 2 === 1) arr.push(null)
  const n = arr.length
  const lastHome = new Map<T, boolean>()
  const homes = new Map<T, number>()
  const rounds: Pairing<T>[][] = []
  for (let r = 0; r < n - 1; r++) {
    const pairs: Pairing<T>[] = []
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i]
      const b = arr[n - 1 - i]
      if (a === null || b === null) continue
      const pair = orientPair(a, b, lastHome, homes)
      lastHome.set(pair[0], true)
      lastHome.set(pair[1], false)
      homes.set(pair[0], (homes.get(pair[0]) ?? 0) + 1)
      pairs.push(pair)
    }
    rounds.push(pairs)
    // rotate all but the first element clockwise
    arr.splice(1, 0, arr.pop() as T | null)
  }
  return rounds
}

/** Home side = the team that was away last time; ties go to the team with fewer home games. */
function orientPair<T>(a: T, b: T, lastHome: ReadonlyMap<T, boolean>, homes: ReadonlyMap<T, number>): Pairing<T> {
  const aWasHome = lastHome.get(a) ?? false
  const bWasHome = lastHome.get(b) ?? false
  if (aWasHome !== bWasHome) return aWasHome ? [b, a] : [a, b]
  return (homes.get(b) ?? 0) < (homes.get(a) ?? 0) ? [b, a] : [a, b]
}

/** Double round robin: first half as {@link roundRobin}, second half mirrored (home/away swapped). */
export function doubleRoundRobin<T>(teams: readonly T[]): Pairing<T>[][] {
  const first = roundRobin(teams)
  const second = first.map((round) => round.map(([h, a]) => [a, h] as Pairing<T>))
  return [...first, ...second]
}

/** Deterministic fixture id. */
export function fixtureId(compId: string, round: number, index: number): string {
  return `${compId}-r${round}-m${index}`
}

/** Build a full double-round-robin league schedule on Saturdays. */
export function buildLeagueFixtures(rng: Rng, compId: string, clubIds: readonly string[], lastWeek: number = LAST_MATCH_WEEK): Fixture[] {
  const order = rng.shuffle([...clubIds])
  const rounds = doubleRoundRobin(order)
  const fixtures: Fixture[] = []
  rounds.forEach((pairs, round) => {
    const week = leagueRoundWeek(round, rounds.length, lastWeek)
    pairs.forEach(([homeId, awayId], i) => {
      fixtures.push({ id: fixtureId(compId, round, i), compId, round, week, day: LEAGUE_DAY, homeId, awayId, result: null })
    })
  })
  return fixtures
}
