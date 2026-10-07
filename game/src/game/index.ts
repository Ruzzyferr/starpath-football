/**
 * Public entry for the interactive highlight player.
 *
 * ```ts
 * import { createMatchGame, startHighlight } from './game'
 * const game = createMatchGame(container)
 * startHighlight(game, highlight, { heroTeamColors, oppColors, settings, lang, difficulty, weather }, (result) => {
 *   matchSim.resolveHighlight(result)
 * })
 * ```
 */
export { createMatchGame, startHighlight, MatchScene } from './MatchScene'
export type { HighlightHandle, HighlightSettings, StartHighlightOptions } from './MatchScene'
export { HighlightRuntime } from './runtime'
export type { HeroAction, HeroControl, RuntimeEvent, RuntimeOptions } from './runtime'
export { makeDemoHighlight, ALL_KINDS } from './demoHighlights'
