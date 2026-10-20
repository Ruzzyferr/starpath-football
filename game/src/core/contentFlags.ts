/**
 * Content filters that sim code may read (set by the UI store, never persisted in saves).
 * Keep this tiny and dependency free.
 *
 * `CASINO_BUILD` is the compile-time store/regional switch (2.12#42): build with
 * `VITE_FEATURE_CASINO=0` for storefronts or regions where simulated gambling is not allowed (the iOS
 * App Store build). The casino is then permanently hidden and the player toggle disappears. Default
 * builds keep it, behind the player's own "Hide casino" setting.
 *
 * {@link casinoHidden} is the single source of truth: every casino / gambling / betting surface (UI,
 * routes, events, feeds, help, achievements, stats) asks it, never `CASINO_BUILD` or the setting alone.
 */
export const CASINO_BUILD: boolean = import.meta.env?.VITE_FEATURE_CASINO !== '0'

export const contentFlags = { hideCasino: !CASINO_BUILD }

/**
 * True when the casino and everything gambling-flavoured must not surface: always in a build without
 * the casino, else when the player's "Hide casino" setting is on. `hideSetting` is the setting value
 * (pass it from reactive UI code so the view updates); without it the store-synced flag is used.
 */
export function casinoHidden(hideSetting?: boolean): boolean {
  if (!CASINO_BUILD) return true
  return hideSetting ?? contentFlags.hideCasino
}

/** Screens that belong to the casino (routes redirect away from them while {@link casinoHidden}). */
export const CASINO_SCREENS: ReadonlySet<string> = new Set(['casino', 'blackjack', 'roulette', 'slots', 'horses'])
