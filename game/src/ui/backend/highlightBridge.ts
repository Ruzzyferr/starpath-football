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
import { emitHintEvent } from '../tutorial/hints'
import type { CelebrationChoice, CelebrationId, ReplayAngleChoice } from '../../game/presentation'
import type { MomentRecording } from '../../game/moments'

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
  /** Players' gender for the head sprites (missing = male). */
  gender?: 'male' | 'female'
  /** Home ground capacity (stadium tier) and floodlit evening fixture. */
  stadium?: { capacity: number; night?: boolean }
  /** Goal celebration choice + unlocked set. */
  celebration?: { choice: CelebrationChoice; unlocked: CelebrationId[] }
  /** Recorded moments are grouped by this key (fixture id). */
  matchKey?: string
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
  const heroId = req.highlight.scenario.players.find((p) => p.isHero)?.id ?? null
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
            reducedMotion: req.settings.reducedMotion,
            lowFx: req.settings.lowFx,
          },
          stadium: req.stadium,
          celebration: req.celebration,
          matchKey: req.matchKey,
          lang: req.lang,
          difficulty: req.difficulty,
          weather: req.weather,
          heroName: req.heroName,
          names: req.names,
          teamNames: { hero: req.heroTeamShort, opp: req.oppTeamShort },
          importance: req.importance,
          replay: !req.settings.reducedMotion,
          gender: req.gender,
          onEvent: (e) => emitHintEvent(e, heroId),
        },
        (r) => {
          clearWatchdog()
          // Dev/e2e: expose the last interactive result for inspection.
          if (import.meta.env.DEV) (globalThis as { __spLastHighlight?: unknown }).__spLastHighlight = r
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
      if (import.meta.env.DEV) (globalThis as { __spHighlightFallback?: unknown }).__spHighlightFallback = String(e)
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

/**
 * Rewatch a recorded moment (Moments list) inside `container`. Phaser is
 * loaded lazily; the game is created for the replay and destroyed after.
 */
export function rewatchMoment(
  container: HTMLElement,
  moment: MomentRecording,
  angle: ReplayAngleChoice,
  settings: UiSettings,
  onDone: () => void,
): HighlightSession {
  let stopped = false
  let handle: { stop(): void } | null = null
  import('../../game/MatchScene')
    .then((mod) => {
      if (stopped) return
      handle = mod.replayMoment(
        container,
        moment,
        { angle, settings: { aimAssist: settings.aimAssist, slowMoAim: settings.slowMoAim, vibration: false, sound: settings.sound, reducedMotion: settings.reducedMotion, lowFx: settings.lowFx } },
        () => {
          if (!stopped) onDone()
        },
      )
    })
    .catch(() => {
      if (!stopped) onDone()
    })
  return {
    stop() {
      stopped = true
      handle?.stop()
    },
  }
}
