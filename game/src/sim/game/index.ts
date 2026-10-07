/**
 * Game façade: the single entry point the UI uses to run a career.
 * Pure functions over GameState (no DOM). Import from 'sim/game'.
 */
export { newGame, defaultCountryIds, DEFAULT_EXTRA_COUNTRIES, type NewGameInput } from './newGame'
export {
  advanceSlot, advanceDay, advanceToNextMatch, autoPlayDay, isHeroMatchday, HERO_ID,
  type AdvanceReport, type AutoAdvanceOptions, type StopReason,
} from './calendar'
export {
  prepareHeroMatch, startHeroMatch, saveMatchProgress, resumeHeroMatch, finishHeroMatch, autoPlayHeroMatch, clearActiveMatch,
  rollWeather, DIFFICULTY_FACTOR, type HeroMatchPrep, type HeroMatchReport,
} from './match'
export * from './actions'
export { saveSummary, dashboard, nextHeroFixture, type Dashboard, type NextFixtureInfo } from './summary'
export {
  getOffers, getSponsorOffers, nationalThreshold, syncEventFlags, type SeasonDigest,
} from './season'
export { activityContext, heroClub, transferWindow, GFLAG, type WindowKind } from './internal'
export { describeEvent, type EventView, type ResolvedEffect } from './eventsAdapter'
export { saveGame, loadGame, packState, unpackState, packedSize, isPacked } from './persist'
export {
  interviewFor, answerInterview, boldFollowers, INTERVIEW_TONES,
  type InterviewContext, type InterviewDef, type InterviewOptionDef, type InterviewEffect, type InterviewEffectKey, type InterviewTone, type InterviewAnswer,
} from './interview'
