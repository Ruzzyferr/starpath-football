/**
 * Match presentation rules shared by the Phaser scene and the UI: stadium
 * tiers, evening fixtures, wind read-out, goal celebrations (catalogue,
 * unlocks, who joins in) and the replay camera director.
 *
 * Pure TS (no Phaser, no DOM) so every rule is unit tested.
 */

import { QUALITY, type QualityProfile } from './quality'
import { DEFAULT_ENV } from './physics'

/** Locale-correct upper case for HUD labels (Turkish dotted/dotless i: "izmir" → "İZMİR", "ılgaz" → "ILGAZ"). */
export function upper(s: string, lang: string): string {
  return s.toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US')
}

// ───────────────────────── Stadium tiers ─────────────────────────

export type StadiumTier = 'local' | 'mid' | 'large' | 'mega'

export interface StadiumLook {
  tier: StadiumTier
  /** Stand depth behind the far goal / along the touchlines (m). 0 = no stand. */
  endDepth: number
  sideDepth: number
  /** Share of seats filled with fans (0..1). */
  density: number
  /** Second (upper) tier of seats. */
  upperTier: boolean
  /** Roof edge strip over the stands. */
  roof: boolean
  /** Floodlight masts (corner pylons) or roof-mounted light banks. */
  lights: 'poles' | 'pylons' | 'roofline' | 'ring'
  /** Ad boards: plain painted boards vs. bright LED strips. */
  ads: 'painted' | 'boards' | 'led' | 'led-glow'
  /** Ad boards behind the near goal and along the touchline as well. */
  adRows: number
  /** Fan flags / tifo blocks in the stands. */
  tifo: boolean
}

const LOOKS: Record<StadiumTier, StadiumLook> = {
  local: { tier: 'local', endDepth: 6, sideDepth: 5, density: 0.34, upperTier: false, roof: false, lights: 'poles', ads: 'painted', adRows: 1, tifo: false },
  mid: { tier: 'mid', endDepth: 12, sideDepth: 11, density: 0.62, upperTier: false, roof: false, lights: 'pylons', ads: 'boards', adRows: 2, tifo: false },
  large: { tier: 'large', endDepth: 18, sideDepth: 16, density: 0.84, upperTier: true, roof: true, lights: 'roofline', ads: 'led', adRows: 2, tifo: false },
  mega: { tier: 'mega', endDepth: 24, sideDepth: 21, density: 0.96, upperTier: true, roof: true, lights: 'ring', ads: 'led-glow', adRows: 2, tifo: true },
}

/** Capacity thresholds (seats) for the four tiers. */
export const TIER_CAPACITY = { mid: 8_000, large: 25_000, mega: 50_000 } as const

export function stadiumTier(capacity: number): StadiumTier {
  if (!Number.isFinite(capacity) || capacity < TIER_CAPACITY.mid) return 'local'
  if (capacity < TIER_CAPACITY.large) return 'mid'
  if (capacity < TIER_CAPACITY.mega) return 'large'
  return 'mega'
}

/**
 * Visual parameters for a stadium. The quality profile thins the crowd (fewer
 * sprites) and drops tifo on Low; `true` is the legacy "low effects" flag.
 */
export function stadiumLook(capacity: number, quality: boolean | QualityProfile = false): StadiumLook {
  const base = LOOKS[stadiumTier(capacity)]
  const spec = QUALITY[quality === true ? 'low' : quality === false ? 'high' : quality]
  if (spec.crowdScale === 1 && spec.tifo) return base
  return { ...base, density: Math.round(base.density * spec.crowdScale * 100) / 100, tifo: base.tifo && spec.tifo }
}

// ───────────────────────── Evening fixtures ─────────────────────────

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0
  return h
}

/**
 * Whether a fixture kicks off under the floodlights. Midweek fixtures (Tue–Thu,
 * `day` 1..3 with 0 = Monday) are evening games; at the weekend about a third
 * of fixtures are (deterministic per fixture id), as are big games.
 */
export function isEveningFixture(fixtureId: string, day: number, importance = 0): boolean {
  if (day >= 1 && day <= 3) return true
  if (importance >= 0.85) return true
  return hash(fixtureId) % 3 === 0
}

// ───────────────────────── Wind ─────────────────────────

/** HUD read-out for a wind vector (m/s, pitch frame). Null when calm. */
export function windReadout(wind: { x: number; y: number }): { kmh: number; strength: 0 | 1 | 2 | 3; dir: { x: number; y: number } } | null {
  const sp = Math.hypot(wind.x, wind.y)
  if (sp < 0.5) return null
  const kmh = Math.round(sp * 3.6)
  const strength = kmh < 12 ? 1 : kmh < 28 ? 2 : 3
  return { kmh, strength, dir: { x: wind.x / sp, y: wind.y / sp } }
}

// ───────────────────────── Celebrations ─────────────────────────

export type CelebrationId =
  | 'knee_slide' | 'airplane' | 'point_sky' | 'badge_kiss' | 'shush' | 'team_huddle' | 'backflip' | 'corner_flag'
  | 'robot' | 'heart_hands' | 'ice_cold' | 'cartwheel'

/** Where the scorer heads first. */
export type CelebrationToward = 'fans' | 'teammates' | 'camera'

export interface CelebrationUnlockInput {
  reputation: number
  perks: readonly string[]
  /** Unlocked achievement ids. */
  achievements: readonly string[]
}

export interface CelebrationDef {
  id: CelebrationId
  icon: string
  name: { tr: string; en: string }
  toward: CelebrationToward
  /** How it is unlocked (shown while locked). */
  unlock: { tr: string; en: string }
  isUnlocked(x: CelebrationUnlockInput): boolean
}

const has = (list: readonly string[], ...ids: string[]) => ids.some((i) => list.includes(i))

export const CELEBRATIONS: readonly CelebrationDef[] = [
  { id: 'knee_slide', icon: '🛷', name: { tr: 'Diz Kayması', en: 'Knee Slide' }, toward: 'fans', unlock: { tr: 'Başlangıçta açık', en: 'Available from the start' }, isUnlocked: () => true },
  { id: 'airplane', icon: '✈️', name: { tr: 'Uçak', en: 'Airplane' }, toward: 'fans', unlock: { tr: 'Başlangıçta açık', en: 'Available from the start' }, isUnlocked: () => true },
  { id: 'point_sky', icon: '☝️', name: { tr: 'Gökyüzüne İşaret', en: 'Point to the Sky' }, toward: 'camera', unlock: { tr: 'Başlangıçta açık', en: 'Available from the start' }, isUnlocked: () => true },
  {
    id: 'badge_kiss', icon: '💋', name: { tr: 'Arma Öpücüğü', en: 'Badge Kiss' }, toward: 'fans',
    unlock: { tr: 'Şöhret 25 ya da "Taraftar Sevgilisi"', en: 'Reputation 25 or "Fan Favourite"' },
    isUnlocked: (x) => x.reputation >= 25 || has(x.perks, 'fan_favourite'),
  },
  {
    id: 'team_huddle', icon: '🫂', name: { tr: 'Takım Sarılması', en: 'Team Huddle' }, toward: 'teammates',
    unlock: { tr: '"Kaptan Ruhu" ya da 100 maç', en: '"Captain Spirit" or 100 appearances' },
    isUnlocked: (x) => has(x.perks, 'captain_spirit') || has(x.achievements, 'apps_100'),
  },
  {
    id: 'shush', icon: '🤫', name: { tr: 'Sus İşareti', en: 'Shush' }, toward: 'camera',
    unlock: { tr: 'Şöhret 45 ya da 50 gol', en: 'Reputation 45 or 50 goals' },
    isUnlocked: (x) => x.reputation >= 45 || has(x.achievements, 'goals_50'),
  },
  {
    id: 'corner_flag', icon: '🚩', name: { tr: 'Köşe Bayrağı', en: 'Corner Flag Kick' }, toward: 'fans',
    unlock: { tr: '"Medya Yıldızı" ya da ilk kupa', en: '"Media Darling" or first trophy' },
    isUnlocked: (x) => has(x.perks, 'media_darling') || has(x.achievements, 'first_trophy'),
  },
  {
    id: 'backflip', icon: '🤸', name: { tr: 'Ters Takla', en: 'Backflip' }, toward: 'camera',
    unlock: { tr: 'Şöhret 70 ya da 100 gol', en: 'Reputation 70 or 100 goals' },
    isUnlocked: (x) => x.reputation >= 70 || has(x.achievements, 'goals_100'),
  },
  // WP-16: four more (12 in total).
  {
    id: 'robot', icon: '🤖', name: { tr: 'Robot Dansı', en: 'The Robot' }, toward: 'camera',
    unlock: { tr: 'Şöhret 15 ya da ilk gol', en: 'Reputation 15 or first goal' },
    isUnlocked: (x) => x.reputation >= 15 || has(x.achievements, 'first_goal'),
  },
  {
    id: 'heart_hands', icon: '🫶', name: { tr: 'Kalp İşareti', en: 'Heart Hands' }, toward: 'fans',
    unlock: { tr: 'Şöhret 35 ya da "Önce Aile"', en: 'Reputation 35 or "Family First"' },
    isUnlocked: (x) => x.reputation >= 35 || has(x.perks, 'family_first'),
  },
  {
    id: 'ice_cold', icon: '🥶', name: { tr: 'Buz Gibi', en: 'Ice Cold' }, toward: 'camera',
    unlock: { tr: 'Şöhret 55 ya da "Serin Kafa" / "Penaltı Buz Adam"', en: 'Reputation 55 or "Cool Head" / "Ice-Cold Penalties"' },
    isUnlocked: (x) => x.reputation >= 55 || has(x.perks, 'cool_head', 'penalty_ice'),
  },
  {
    id: 'cartwheel', icon: '🌀', name: { tr: 'Yan Perende', en: 'Cartwheel' }, toward: 'fans',
    unlock: { tr: 'Şöhret 60 ya da hat-trick', en: 'Reputation 60 or a hat-trick' },
    isUnlocked: (x) => x.reputation >= 60 || has(x.achievements, 'hat_trick'),
  },
]

export const CELEBRATION_BY_ID: Readonly<Record<string, CelebrationDef>> = Object.fromEntries(CELEBRATIONS.map((c) => [c.id, c]))

export const isCelebrationId = (s: unknown): s is CelebrationId => typeof s === 'string' && s in CELEBRATION_BY_ID

/** 'auto' picks a random unlocked celebration per goal. */
export type CelebrationChoice = CelebrationId | 'auto'

/** Resolve the celebration for one goal (falls back to auto when the choice is locked). */
export function resolveCelebration(choice: CelebrationChoice | undefined, unlocked: readonly CelebrationId[], roll: number): CelebrationId {
  if (choice && choice !== 'auto' && unlocked.includes(choice)) return choice
  const pool = unlocked.length ? unlocked : (['knee_slide'] as CelebrationId[])
  return pool[Math.min(pool.length - 1, Math.floor(Math.abs(roll) * pool.length))]!
}

/** Relation (-100..100) below which a team-mate does not run over to celebrate. */
export const CELEBRATE_JOIN_MIN_RELATION = -20

/** Team-mates who join the celebration: good relations, nearest first, keepers stay home. */
export function celebrationJoiners<T extends { id: string; relationToHero: number; isKeeper: boolean; distToHero: number }>(mates: readonly T[], max = 6): T[] {
  return mates
    .filter((m) => !m.isKeeper && m.relationToHero >= CELEBRATE_JOIN_MIN_RELATION && m.distToHero < 45)
    .sort((a, b) => a.distToHero - b.distToHero)
    .slice(0, max)
}

/** Celebration length in seconds (reduced motion halves it). */
export const celebrationSeconds = (reducedMotion: boolean): number => (reducedMotion ? 1.6 : 3.4)

/** Pose of the scorer during a celebration at normalised time u ∈ [0,1]. */
export interface CelebrationPose {
  /** Body roll (radians). */
  rot: number
  /** Lift of the whole body (m). */
  lift: number
  /** Torso height override (m above ground) or null for standing. */
  torsoZ: number | null
  legs: boolean
  arms: 'none' | 'out' | 'up' | 'point' | 'mouth' | 'chest' | 'kick' | 'robotL' | 'robotR' | 'heart' | 'hug'
  /** Run speed multiplier toward the celebration spot (0 = stand). */
  run: number
}

export function celebrationPose(id: CelebrationId, u: number, reducedMotion = false): CelebrationPose {
  const base: CelebrationPose = { rot: 0, lift: 0, torsoZ: null, legs: true, arms: 'none', run: u < 0.45 ? 1 : 0 }
  switch (id) {
    case 'knee_slide':
      if (u < 0.3) return { ...base, run: 1 }
      return { ...base, torsoZ: 0.55, legs: false, arms: 'out', rot: -0.35, run: u < 0.6 ? 0.8 : 0 }
    case 'airplane':
      return { ...base, arms: 'out', rot: reducedMotion ? 0 : Math.sin(u * Math.PI * 4) * 0.35, run: u < 0.75 ? 1 : 0 }
    case 'point_sky':
      return { ...base, arms: u < 0.4 ? 'none' : 'up', run: u < 0.4 ? 1 : 0, lift: u > 0.45 && !reducedMotion ? Math.abs(Math.sin(u * 18)) * 0.12 : 0 }
    case 'badge_kiss':
      return { ...base, arms: u < 0.4 ? 'none' : 'chest', run: u < 0.4 ? 1 : 0 }
    case 'shush':
      return { ...base, arms: u < 0.35 ? 'none' : 'mouth', run: u < 0.35 ? 1 : 0 }
    case 'team_huddle':
      return { ...base, arms: u < 0.3 ? 'out' : 'up', run: u < 0.3 ? 1 : 0, lift: u > 0.35 && !reducedMotion ? Math.abs(Math.sin(u * 22)) * 0.18 : 0 }
    case 'corner_flag':
      return { ...base, arms: u > 0.55 && u < 0.7 ? 'kick' : u >= 0.7 ? 'up' : 'none', run: u < 0.55 ? 1.1 : 0 }
    case 'backflip': {
      if (reducedMotion || u < 0.35) return { ...base, arms: reducedMotion ? 'up' : 'none', run: u < 0.35 ? 1 : 0 }
      const f = Math.min(1, (u - 0.4) / 0.3)
      if (u < 0.4) return { ...base, run: 0, arms: 'up' }
      if (f < 1) return { ...base, run: 0, legs: false, rot: -f * Math.PI * 2, lift: Math.sin(f * Math.PI) * 1.4, arms: 'none' }
      return { ...base, run: 0, arms: 'up' }
    }
    case 'robot': {
      // Stiff, stepped arm swaps on a fixed beat (no smooth tweening: that is the joke).
      if (u < 0.35) return { ...base, run: 1 }
      const beat = Math.floor((u - 0.35) * 14)
      return { ...base, run: 0, arms: beat % 2 ? 'robotR' : 'robotL', rot: reducedMotion ? 0 : (beat % 2 ? 0.08 : -0.08) }
    }
    case 'heart_hands':
      return { ...base, arms: u < 0.4 ? 'none' : 'heart', run: u < 0.4 ? 1 : 0, lift: u > 0.45 && !reducedMotion ? Math.abs(Math.sin(u * 10)) * 0.06 : 0 }
    case 'ice_cold':
      // Arms wrapped round the chest, a little shiver.
      return { ...base, arms: u < 0.38 ? 'none' : 'hug', run: u < 0.38 ? 0.8 : 0, rot: u > 0.4 && !reducedMotion ? Math.sin(u * 90) * 0.05 : 0 }
    case 'cartwheel': {
      if (reducedMotion || u < 0.4) return { ...base, arms: reducedMotion && u >= 0.4 ? 'out' : 'none', run: u < 0.4 ? 1.1 : 0 }
      const f = Math.min(1, (u - 0.4) / 0.35)
      if (f < 1) return { ...base, run: 0.5, legs: false, rot: f * Math.PI * 2, lift: Math.sin(f * Math.PI) * 0.5, arms: 'out' }
      return { ...base, run: 0, arms: 'up' }
    }
  }
}

// ───────────────────────── Replay director ─────────────────────────

export type ReplayAngle = 'broadcast' | 'goalcam' | 'tactical'
export type ReplayAngleChoice = ReplayAngle | 'auto'
export const REPLAY_ANGLES: readonly ReplayAngle[] = ['broadcast', 'goalcam', 'tactical']

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/**
 * Camera blend weights for a replay at normalised time u. `auto` cuts
 * tactical → broadcast → goal-cam with smooth cross-fades; a fixed angle is
 * a single weight.
 */
export function replayAngleWeights(choice: ReplayAngleChoice, u: number): Record<ReplayAngle, number> {
  if (choice !== 'auto') return { broadcast: choice === 'broadcast' ? 1 : 0, goalcam: choice === 'goalcam' ? 1 : 0, tactical: choice === 'tactical' ? 1 : 0 }
  const toBroadcast = smooth(0.26, 0.38, u)
  const toGoal = smooth(0.7, 0.8, u)
  const tactical = 1 - toBroadcast
  const goalcam = toBroadcast * toGoal
  const broadcast = toBroadcast * (1 - toGoal)
  return { broadcast, goalcam, tactical }
}

/** The dominant angle (HUD label). */
export function dominantAngle(w: Record<ReplayAngle, number>): ReplayAngle {
  return REPLAY_ANGLES.reduce((a, b) => (w[b] > w[a] ? b : a), 'broadcast' as ReplayAngle)
}

/** Replay playback rate: slow overall, slower still around the key moment (the goal). */
export function replayRate(t: number, keyT: number, reducedMotion = false): number {
  if (reducedMotion) return 0.6
  const d = Math.abs(t - keyT)
  return d < 0.55 ? 0.28 + d * 0.4 : 0.55
}

/**
 * How the pitch treats a rolling ball compared with a dry pitch (HUD weather
 * tag beside the ☂/❄ icon, 2.2#73): 'slick' = it skids on (rain), 'heavy' =
 * it dies (snow). Read from the same physics env the ball uses.
 */
export function pitchGrip(env: { rollDecel: number }): 'normal' | 'slick' | 'heavy' {
  const r = env.rollDecel / DEFAULT_ENV.rollDecel
  return r < 0.85 ? 'slick' : r > 1.25 ? 'heavy' : 'normal'
}
