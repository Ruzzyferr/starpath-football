/**
 * Global (not per-save) help preferences: the "tips" switch, which control
 * hints were already learned, and whether a coach tour has ever been offered.
 * Kept in their own storage key so they survive career deletion and never
 * collide with the main settings object.
 */
import { signal } from '@preact/signals'

export interface HelpPrefs {
  /** Master switch: coach tour on new careers + match/training control hints. */
  tips: boolean
  /** Control-hint ids already learned (e.g. "match:shoot", "drill:passing"). */
  seenHints: string[]
  /** A coach tour has been started once (only the first career gets it automatically). */
  tourOffered: boolean
}

export const DEFAULT_HELP: HelpPrefs = { tips: true, seenHints: [], tourOffered: false }
export const HELP_KEY = 'starpath.help.v1'

function load(): HelpPrefs {
  try {
    const raw = globalThis.localStorage?.getItem(HELP_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<HelpPrefs>
      return {
        tips: typeof p.tips === 'boolean' ? p.tips : DEFAULT_HELP.tips,
        seenHints: Array.isArray(p.seenHints) ? p.seenHints.filter((x): x is string => typeof x === 'string') : [],
        tourOffered: p.tourOffered === true,
      }
    }
  } catch {
    /* storage unavailable */
  }
  return { ...DEFAULT_HELP, seenHints: [] }
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

export function resetHints(): void {
  updateHelp({ seenHints: [] })
}
