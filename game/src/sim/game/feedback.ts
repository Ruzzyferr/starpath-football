/**
 * Local community plumbing (GAP 2.10#3/#82/#88): the online-features switch,
 * the opt-in notification prompt and the in-game feedback form. Nothing here
 * sends data anywhere; reports are saved on the device and exported as a file
 * the player can attach to a message themselves.
 */
import type { LocalMeta } from './localMeta'
import { totalCompleted } from './localMeta'

// ───────────────────────── Online switch (#3) ─────────────────────────

/**
 * Single gate every future network call must pass. Default off; the build has
 * no network code at all today (a source scan test pins that), so the switch is
 * the contract for later online features.
 */
export const onlineAllowed = (m: Pick<LocalMeta, 'online'>): boolean => m.online === true

// ───────────────────────── Notifications (#82) ─────────────────────────

export type NotifyState = 'unasked' | 'granted' | 'declined'

/** Ask only after the first weekly challenge is cleared, never at first launch, and only once. */
export const shouldAskNotifications = (m: Pick<LocalMeta, 'notify' | 'challenges'>): boolean =>
  m.notify === 'unasked' && Object.keys(m.challenges).length >= 1

export const notificationsSupported = (): boolean => typeof Notification !== 'undefined'

/** Ask the browser for permission (user pressed "Allow" in our own prompt first). */
export async function requestNotifyPermission(): Promise<NotifyState> {
  if (!notificationsSupported()) return 'declined'
  try {
    return (await Notification.requestPermission()) === 'granted' ? 'granted' : 'declined'
  } catch {
    return 'declined'
  }
}

/** Local reminder when the week turns and the new challenge is still open (shown only when granted). */
export function notifyLocal(state: NotifyState, title: string, body: string): boolean {
  if (state !== 'granted' || !notificationsSupported() || Notification.permission !== 'granted') return false
  try {
    new Notification(title, { body, silent: true })
    return true
  } catch {
    return false
  }
}

// ───────────────────────── Feedback form (#88) ─────────────────────────

export type FeedbackKind = 'bug' | 'idea' | 'other'
export const FEEDBACK_MAX_TEXT = 1500
export const FEEDBACK_MAX_SAVED = 30

export interface FeedbackAttachments {
  device: boolean
  recentMatches: boolean
}

export interface FeedbackEntry {
  id: string
  at: number
  kind: FeedbackKind
  text: string
  version: string
  device?: { ua: string; lang: string; screen: string }
  /** Fixture ids of up to the last three hero matches. */
  recentMatches?: string[]
}

export interface FeedbackEnv {
  version: string
  now: number
  ua: string
  lang: string
  screen: string
}

/** Build a report entry; empty or oversized text is rejected (null). */
export function buildFeedback(kind: FeedbackKind, text: string, attach: FeedbackAttachments, m: Pick<LocalMeta, 'seen'>, env: FeedbackEnv): FeedbackEntry | null {
  const body = text.trim().slice(0, FEEDBACK_MAX_TEXT)
  if (body.length < 5) return null
  const e: FeedbackEntry = { id: `fb-${env.now.toString(36)}`, at: env.now, kind, text: body, version: env.version }
  if (attach.device) e.device = { ua: env.ua.slice(0, 200), lang: env.lang, screen: env.screen }
  if (attach.recentMatches) e.recentMatches = m.seen.slice(-3)
  return e
}

export const addFeedback = (list: readonly FeedbackEntry[], e: FeedbackEntry): FeedbackEntry[] => [...list, e].slice(-FEEDBACK_MAX_SAVED)

/** Export file: the report(s) as pretty JSON; save files are never included. */
export const feedbackExport = (list: readonly FeedbackEntry[]): string => `${JSON.stringify({ format: 'starpath-feedback', entries: list }, null, 2)}\n`

/** A short summary line for the board header. */
export const communityStats = (m: LocalMeta): { challenges: number; mods: number; reports: number } => ({
  challenges: totalCompleted(m), mods: m.mods.length, reports: m.feedback.length,
})
