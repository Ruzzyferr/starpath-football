/**
 * The store's own "rate this app" sheet, asked at a happy moment only: a win with a good
 * rating after a few matches, at most once every 120 days, never on the web build.
 * The OS decides whether the sheet really shows (iOS caps it at 3 a year), so this never
 * tells the player anything. The native shell installs the driver (platform/capacitor.ts).
 */
const KEY = 'sp.reviewPrompt.v1'
const MIN_MATCHES = 5
const MIN_RATING = 7.5
const GAP_DAYS = 120

interface State {
  matches: number
  lastAsked: number | null
}

type Driver = () => Promise<void>
let driver: Driver | null = null

export function setReviewDriver(d: Driver | null): void {
  driver = d
}

function load(): State {
  try {
    const s = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null') as Partial<State> | null
    return { matches: Number(s?.matches) || 0, lastAsked: typeof s?.lastAsked === 'number' ? s.lastAsked : null }
  } catch {
    return { matches: 0, lastAsked: null }
  }
}

function save(s: State): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage blocked: the counters only live for this session */
  }
}

/** Decides whether this finished match is a good moment to ask (pure, for tests). */
export function shouldAsk(s: State, won: boolean, rating: number, now: number): boolean {
  if (!won || rating < MIN_RATING || s.matches < MIN_MATCHES) return false
  return s.lastAsked === null || now - s.lastAsked >= GAP_DAYS * 86_400_000
}

/** Call once per finished match the player saw (post-match screen). */
export function noteMatchForReview(won: boolean, rating: number, now = Date.now()): void {
  const s = load()
  s.matches += 1
  const ask = driver !== null && shouldAsk(s, won, rating, now)
  if (ask) s.lastAsked = now
  save(s)
  // A short pause so the sheet never covers the score the player just earned.
  if (ask) setTimeout(() => void driver?.().catch(() => undefined), 1800)
}
