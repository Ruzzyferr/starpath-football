/**
 * Derived NPC profiles (2.6#36, #39, #19). Everything here is a pure function of data
 * the world already stores (ids, seeds, reputation, wages), so it needs no RNG, no extra
 * save fields, and older saves get the same values.
 *
 *  - npcTraits:       2-4 personality traits per NPC with small, deterministic match effects
 *  - managerProfile:  age, youth trust, patience, tactical preference of a club's manager
 *  - clubFinanceSheet: yearly income and spending lines; wages are 55-70 % of income
 */
import type { Club, NpcPlayer, World } from '../../core/types'
import { clamp, hashString } from '../../core/rng'

// ───────────────────────── Traits ─────────────────────────

export type NpcTrait = 'loyal' | 'ambitious' | 'lazy' | 'leader' | 'brawler' | 'fragile' | 'ironman' | 'setPiece' | 'selfish' | 'teamPlayer'
export const NPC_TRAITS: readonly NpcTrait[] = ['loyal', 'ambitious', 'lazy', 'leader', 'brawler', 'fragile', 'ironman', 'setPiece', 'selfish', 'teamPlayer']
const EXCLUSIVE: readonly (readonly [NpcTrait, NpcTrait])[] = [['loyal', 'ambitious'], ['lazy', 'ironman'], ['selfish', 'teamPlayer'], ['fragile', 'ironman'], ['lazy', 'ambitious']]
/** Trait implied by the single `personality` field, so the two never contradict. */
const FROM_PERSONALITY: Partial<Record<NpcPlayer['personality'], NpcTrait>> = { loyal: 'loyal', ambitious: 'ambitious', hothead: 'brawler', leader: 'leader', professional: 'ironman', party: 'lazy', joker: 'teamPlayer' }

/** 2-4 traits, stable for a player's whole life (derived from his style seed and personality). */
export function npcTraits(p: Pick<NpcPlayer, 'styleSeed' | 'personality'>): NpcTrait[] {
  const out: NpcTrait[] = []
  const first = FROM_PERSONALITY[p.personality]
  if (first) out.push(first)
  const want = 2 + (Math.abs(p.styleSeed) % 3) // 2..4
  let h = hashString(`traits:${p.styleSeed}:${p.personality}`)
  for (let guard = 0; out.length < want && guard < 40; guard++) {
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0
    const t = NPC_TRAITS[h % NPC_TRAITS.length]
    if (out.includes(t!) || EXCLUSIVE.some(([a, b]) => (a === t && out.includes(b)) || (b === t && out.includes(a)))) continue
    out.push(t!)
  }
  return out
}

export interface TraitEffects {
  /** Multiplier on the per-match yellow/red card chance. */
  cards: number
  /** Multiplier on the per-match injury chance. */
  injury: number
  /** Extra morale after a win / a loss (locker-room mood). */
  winMorale: number
  lossMorale: number
}

export function traitEffects(traits: readonly NpcTrait[]): TraitEffects {
  const has = (t: NpcTrait) => traits.includes(t)
  return {
    cards: (has('brawler') ? 1.8 : 1) * (has('teamPlayer') ? 0.85 : 1),
    injury: (has('ironman') ? 0.6 : 1) * (has('fragile') ? 1.5 : 1),
    winMorale: (has('leader') ? 1 : 0) + (has('teamPlayer') ? 1 : 0),
    lossMorale: (has('lazy') ? -1 : 0) + (has('selfish') ? -1 : 0) + (has('leader') ? 1 : 0),
  }
}

// ───────────────────────── Managers ─────────────────────────

export interface ManagerProfile {
  name: string
  age: number
  /** 0-100: how readily he starts players of 21 or younger. */
  youthTrust: number
  /** 0-100: how long he tolerates a poor run before the board acts. */
  patience: number
  formation: Club['formation']
  style: Club['style']
}

function seeded(key: string, salt: string): number {
  return (hashString(`${salt}:${key}`) >>> 0) / 4294967296
}

/** Stable profile of the club's current manager (changes when the manager does). */
export function managerProfile(club: Pick<Club, 'id' | 'managerName' | 'formation' | 'style' | 'reputation'>): ManagerProfile {
  const key = `${club.id}:${club.managerName}`
  const bigClub = (club.reputation - 50) / 100
  return {
    name: club.managerName,
    age: 38 + Math.floor(seeded(key, 'age') * 30),
    youthTrust: Math.round(clamp(15 + seeded(key, 'youth') * 75 - bigClub * 15, 5, 95)),
    patience: Math.round(clamp(15 + seeded(key, 'patience') * 70 + bigClub * -10 + (club.style === 'possession' ? 8 : 0), 5, 95)),
    formation: club.formation,
    style: club.style,
  }
}

/** OVR-equivalent bonus a young hero gets from a manager who trusts youth (0 for players over 21). */
export function youthTrustBonus(youthTrust: number | undefined, age: number): number {
  return age <= 21 && youthTrust !== undefined ? (youthTrust - 50) * 0.05 : 0
}

// ───────────────────────── Club finances ─────────────────────────

export interface FinanceSheet {
  income: { tickets: number; broadcast: number; sponsors: number; prize: number; transfers: number }
  spending: { wages: number; facilities: number; transfers: number }
  totalIncome: number
  totalSpending: number
  /** wages / income, always inside 0.55-0.70. */
  wageRatio: number
}

const r1000 = (n: number) => Math.round(n / 1000) * 1000

/** Yearly picture of a club's money. Wages are the club's real weekly wage bill; income is sized so wages take 55-70 %. */
export function clubFinanceSheet(world: World, club: Club): FinanceSheet {
  const wages = Math.max(1, club.squad.reduce((s, id) => s + (world.players[id]?.wage ?? 0), 0) * 52)
  const league = world.leagues[club.leagueId]
  const tier = league?.tier ?? 1
  const fill = clamp(0.45 + club.reputation / 160, 0.4, 0.95)
  const tickets = club.stadium.capacity * fill * 19 * (14 + club.reputation / 6) * (tier === 1 ? 1 : 0.7)
  const broadcast = (6e5 + club.reputation * club.reputation * 900) * (tier === 1 ? 1.6 : tier === 2 ? 0.7 : 0.3)
  const ratio = clamp(0.7 - club.reputation / 600, 0.55, 0.7)
  const target = wages / ratio
  // Sponsors balance the books (never negative); if gate + TV already exceed the target the ratio simply falls to the 55 % floor.
  const base = tickets + broadcast
  const prize = target * 0.04
  const sponsors = Math.max(target * 0.1, target - base - prize)
  const raw = { tickets, broadcast, sponsors, prize, transfers: target * 0.03 }
  // Keep the wage share inside 55-70 % whatever the gate and TV money say.
  const sum = raw.tickets + raw.broadcast + raw.sponsors + raw.prize + raw.transfers
  const k = clamp(sum, wages / 0.69, wages / 0.56) / sum
  const income = { tickets: r1000(raw.tickets * k), broadcast: r1000(raw.broadcast * k), sponsors: r1000(raw.sponsors * k), prize: r1000(raw.prize * k), transfers: r1000(raw.transfers * k) }
  const totalIncome = income.tickets + income.broadcast + income.sponsors + income.prize + income.transfers
  const spending = { wages: r1000(wages), facilities: r1000(totalIncome * 0.08), transfers: r1000(totalIncome * 0.06) }
  const totalSpending = spending.wages + spending.facilities + spending.transfers
  return { income, spending, totalIncome, totalSpending, wageRatio: spending.wages / totalIncome }
}

const effectCache = new WeakMap<object, TraitEffects>()
/** Cached {@link traitEffects} of a player (the traits never change). */
export function effectsOf(p: NpcPlayer): TraitEffects {
  let e = effectCache.get(p)
  if (!e) { e = traitEffects(npcTraits(p)); effectCache.set(p, e) }
  return e
}

// ───────────────────────── Short club label ─────────────────────────

const GENERIC = new Set(['fc', 'sc', 'cf', 'ac', 'as', 'us', 'sk', 'fk', 'sv', 'club', 'de', 'der', 'the', 'spor', 'kulübü'])

/** Display name of at most `max` characters (2.6#9): the full name when it fits, else its distinctive words, else a cut with an ellipsis. */
export function shortClubName(name: string, max = 12): string {
  if (name.length <= max) return name
  const words = name.split(/\s+/)
  const core = words.filter((w) => !GENERIC.has(w.toLowerCase().replace(/[.]/g, '')))
  const joined = (core.length ? core : words).join(' ')
  if (joined.length <= max) return joined
  const lastWord = (core.length ? core : words).slice(-1)[0]!
  if (lastWord.length <= max && lastWord.length >= 4) return lastWord
  return `${joined.slice(0, max - 1).trimEnd()}…`
}
