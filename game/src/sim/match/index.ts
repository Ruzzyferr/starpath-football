/**
 * Match engine public API. Import from 'sim/match' rather than individual files.
 */
export * from './types'
export { MatchSim } from './engine'
export type { EngineState, MatchSimOptions } from './engineState'
export { autoResolve, outcomeProbabilities, skillFor, skillTerm } from './autoResolve'
export {
  commentary,
  fillTemplate,
  formatScore,
  HIGHLIGHT_PROMPTS,
  trSuffix,
  trSuffixOnly,
  type CommentaryKey,
  type CommentaryVars,
  type TrCase,
} from './commentary'
export {
  assignSlots,
  buildScenario,
  expectedMoments,
  guaranteedKind,
  formationSlots,
  isDefensiveKind,
  kindWeights,
  pickHighlightKind,
  planHighlightMinutes,
  plannedHighlightCount,
  HIGHLIGHTS_MAX_90,
  HIGHLIGHTS_MIN_90,
  TIME_LIMITS,
  type FormationSlot,
  type GeneratedScenario,
  type HighlightPlanInput,
  type ScenarioInput,
  type SlotPlayer,
} from './highlightGen'
export { HEAT_COLS, HEAT_ROWS, shotXg } from './heroMap'
export {
  clampRating,
  contributionFloor,
  finalRatingAdjustment,
  finalRatingParts,
  highlightRatingDelta,
  npcRating,
  pickMotm,
  RATING_BASE,
  roundRating,
  teamGoalRatingDelta,
} from './rating'
