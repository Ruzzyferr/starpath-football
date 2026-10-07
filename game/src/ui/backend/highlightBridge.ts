/**
 * THE single integration point between the live-match controller and the
 * interactive Phaser highlight player (src/game/MatchScene.ts).
 *
 * `playHighlight` mounts the player into `#match-canvas`, and calls `onDone`
 * with the HighlightResult once the moment is over. Phaser is loaded lazily
 * (dynamic import) so it stays out of the main bundle. If the scene cannot be
 * loaded or no canvas container exists (tests, SSR), the moment is resolved
 * by the sim's attribute-based auto-resolver via `onFallback`.
 */
import type { Difficulty, KitColors, Lang } from '../../core/types'
import type { Highlight, HighlightResult, Weather } from '../../sim/match'
import type { UiSettings } from '../store'

export interface HighlightRequest {
  highlight: Highlight
  heroColors: KitColors
  oppColors: KitColors
  heroTeamShort: string
  oppTeamShort: string
  heroName: string
  names: Record<string, string>
  weather: Weather
  importance: number
  difficulty: Difficulty | number
  lang: Lang
  settings: UiSettings
}

export interface HighlightSession {
  /** Abort without a result (e.g. the player left the screen). */
  stop(): void
}

/**
 * Start an interactive highlight. Exactly one of `onDone` / `onFallback` is
 * called (unless the session is stopped first).
 */
export function playHighlight(
  req: HighlightRequest,
  onDone: (r: HighlightResult) => void,
  onFallback: (reason: string) => void,
): HighlightSession {
  let stopped = false
  let handle: { stop(): void } | null = null
  let watchdog: ReturnType<typeof setTimeout> | null = null
  const clearWatchdog = () => {
    if (watchdog) clearTimeout(watchdog)
    watchdog = null
  }
  const container = typeof document !== 'undefined' ? document.getElementById('match-canvas') : null
  if (!container) {
    queueMicrotask(() => { if (!stopped) onFallback('no-canvas') })
    return { stop: () => { stopped = true } }
  }
  import('../../game/MatchScene')
    .then((mod) => {
      if (stopped) return
      handle = mod.startHighlight(
        container,
        req.highlight,
        {
          heroTeamColors: req.heroColors,
          oppColors: req.oppColors,
          settings: {
            aimAssist: req.settings.aimAssist,
            slowMoAim: req.settings.slowMoAim,
            vibration: req.settings.vibration,
            sound: req.settings.sound,
          },
          lang: req.lang,
          difficulty: req.difficulty,
          weather: req.weather,
          heroName: req.heroName,
          names: req.names,
          teamNames: { hero: req.heroTeamShort, opp: req.oppTeamShort },
          importance: req.importance,
          replay: !req.settings.reducedMotion,
        },
        (r) => {
          clearWatchdog()
          if (!stopped) onDone(r)
        },
      )
      // Safety net: a moment never lasts this long (time limit + intro/replay); fall back to the sim.
      watchdog = setTimeout(() => {
        if (stopped) return
        stopped = true
        handle?.stop()
        onFallback('watchdog')
      }, (Math.max(5, req.highlight.scenario.timeLimit) + 120) * 1000)
    })
    .catch((e: unknown) => {
      console.warn('[StarPath] highlight player unavailable, auto-resolving', e)
      if (!stopped) onFallback('load-failed')
    })
  return {
    stop() {
      stopped = true
      clearWatchdog()
      handle?.stop()
    },
  }
}
