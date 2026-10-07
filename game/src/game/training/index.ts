/**
 * Training mini-games. The headless drills and scoring are Phaser-free (import
 * freely); the renderer lives in ./TrainingScene and should be loaded lazily:
 *
 * ```ts
 * const drill = createDrill('finishing', { attrs: hero.attrs, seed })
 * const { startDrill } = await import('./game/training/TrainingScene')
 * startDrill(container, drill, { lang, heroKit, settings }, (r) => runTraining(..., r.performance))
 * ```
 */
export { createDrill } from './drills'
export * from './scoring'
export * from './types'
