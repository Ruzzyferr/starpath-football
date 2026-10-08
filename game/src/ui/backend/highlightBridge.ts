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
import { resolveQuality } from '../../game/quality'
import { emitHintEvent } from '../tutorial/hints'
import type { CelebrationChoice, CelebrationId, ReplayAngleChoice } from '../../game/presentation'
import type { MomentRecording } from '../../game/moments'
import type { InputRecording } from '../../game/inputReplay'

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
            quality: resolveQuality(req.settings.quality, req.settings.qualityAuto),
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
        { angle, settings: { aimAssist: settings.aimAssist, slowMoAim: settings.slowMoAim, vibration: false, sound: settings.sound, reducedMotion: settings.reducedMotion, lowFx: settings.lowFx, quality: resolveQuality(settings.quality, settings.qualityAuto) } },
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

export interface GoalReelRequest {
  highlight: Highlight
  rec: InputRecording
  heroColors: KitColors
  oppColors: KitColors
  heroName: string
  lang: Lang
  settings: UiSettings
  gender?: 'male' | 'female'
}

/**
 * Goal reel: replays a stored goal by feeding its input recording into the interactive scene
 * (same seed + options, so the moment unfolds exactly as played). `onDone` gets the outcome.
 */
export function rewatchGoal(container: HTMLElement, req: GoalReelRequest, onDone: (r: HighlightResult) => void): HighlightSession {
  let stopped = false
  let handle: { stop(): void } | null = null
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
            aimAssist: req.rec.opts.aimAssist ?? 'half',
            slowMoAim: !!req.rec.opts.slowMoAim,
            vibration: false,
            sound: req.settings.sound,
            reducedMotion: req.settings.reducedMotion,
            lowFx: req.settings.lowFx,
            quality: resolveQuality(req.settings.quality, req.settings.qualityAuto),
          },
          matchKey: 'goal-reel',
          lang: req.lang,
          difficulty: req.rec.opts.difficulty ?? 'normal',
          weather: req.rec.opts.weather ?? 'clear',
          heroName: req.heroName,
          gender: req.gender,
          replay: !req.settings.reducedMotion,
          inputReplay: req.rec,
        },
        (r) => {
          if (import.meta.env.DEV) (globalThis as { __spLastReel?: unknown }).__spLastReel = r
          if (!stopped) onDone(r)
        },
      )
    })
    .catch(() => {
      if (!stopped) onDone({ outcome: 'timeout', passes: 0, passesCompleted: 0, shots: 0, shotsOnTarget: 0, dribbles: 0, tackles: 0 })
    })
  return {
    stop() {
      stopped = true
      handle?.stop()
    },
  }
}
