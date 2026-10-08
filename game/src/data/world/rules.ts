/**
 * League-system rules as data (2.6#62). Promotion/relegation places between a tier and the one below it,
 * per country; the generator copies them onto each `League` (`promote` / `relegate`) and the season
 * engine only ever reads those fields, so a mod or a later data pack can change a country's rules
 * without touching code. The numbers of clubs in a tier never change (every club relegated is
 * replaced by a promoted one, which the long-run test checks).
 */
export const DEFAULT_SPOTS = 3

/** `PROMOTION_SPOTS[country][t - 1]` = places that swap between tier t and tier t + 1. */
export const PROMOTION_SPOTS: Readonly<Record<string, readonly number[]>> = {
  DE: [2, 3], FR: [2, 3], NL: [2, 3], PT: [2, 2], US: [2, 2], JP: [2, 2], BR: [4, 3],
}

export const boundarySpots = (countryId: string, tier: number): number => PROMOTION_SPOTS[countryId]?.[tier - 1] ?? DEFAULT_SPOTS
