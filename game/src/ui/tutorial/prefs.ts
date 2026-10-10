/**
 * Global (not per-save) help preferences: the "tips" switch, the mini-game how-to cards
 * ("Mini oyun ipuçları" master switch + per-kind "Bir daha gösterme"), and whether a coach
 * tour has ever been offered. Kept in their own storage key so they survive career deletion
 * and never collide with the main settings object. Every field is optional on load
 * (older saves migrate to the defaults).
 */
import { signal } from '@preact/signals'

export interface HelpPrefs {
  /** Coach tour on new careers + info tips. */
  tips: boolean
  /** Legacy: control-hint ids learned by the old seen-once hints (kept for old saves, no longer gates cards). */
  seenHints: string[]
  /** A coach tour has been started once (only the first career gets it automatically). */
  tourOffered: boolean
  /** Master switch: show the how-to card before every mini-game ("Mini oyun ipuçları"). */
  gameTips: boolean
  /** Tutorial keys the player ticked "Bir daha gösterme" on (e.g. "match:penalty", "drill:finishing", "scout"). */
  hiddenTutorials: string[]
}

export const DEFAULT_HELP: HelpPrefs = { tips: true, seenHints: [], tourOffered: false, gameTips: true, hiddenTutorials: [] }
export const HELP_KEY = 'starpath.help.v1'

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** Parse stored prefs (any older / partial / broken shape → safe defaults). */
export function parseHelp(raw: string | null | undefined): HelpPrefs {
  if (raw) {
    try {
      const p = JSON.parse(raw) as Partial<HelpPrefs> | null
      if (p && typeof p === 'object') {
        return {
          tips: typeof p.tips === 'boolean' ? p.tips : DEFAULT_HELP.tips,
          seenHints: strings(p.seenHints),
          tourOffered: p.tourOffered === true,
          gameTips: typeof p.gameTips === 'boolean' ? p.gameTips : DEFAULT_HELP.gameTips,
          hiddenTutorials: [...new Set(strings(p.hiddenTutorials))],
        }
      }
    } catch {
      /* broken JSON */
    }
  }
  return { ...DEFAULT_HELP, seenHints: [], hiddenTutorials: [] }
}

function load(): HelpPrefs {
  try {
    return parseHelp(globalThis.localStorage?.getItem(HELP_KEY))
  } catch {
    return parseHelp(null)
  }
}

export const helpPrefs = signal<HelpPrefs>(load())

export function updateHelp(patch: Partial<HelpPrefs>): void {
  helpPrefs.value = { ...helpPrefs.value, ...patch }
  try {
    globalThis.localStorage?.setItem(HELP_KEY, JSON.stringify(helpPrefs.value))
  } catch {
    /* ignore */
  }
}

export const hintSeen = (id: string): boolean => helpPrefs.value.seenHints.includes(id)

export function markHintSeen(id: string): void {
  if (hintSeen(id)) return
  updateHelp({ seenHints: [...helpPrefs.value.seenHints, id] })
}

/** "Bir daha gösterme" for one mini-game kind. */
export function hideTutorial(key: string): void {
  if (helpPrefs.value.hiddenTutorials.includes(key)) return
  updateHelp({ hiddenTutorials: [...helpPrefs.value.hiddenTutorials, key] })
}

/** "Tümünü yeniden göster": every hidden mini-game card shows again. */
export function resetTutorials(): void {
  updateHelp({ hiddenTutorials: [], seenHints: [] })
}

