/**
 * Referees and NPC suspensions (WP-14).
 *
 * Each country has a fixed pool of referees derived from the career seed (no
 * save data): the same names keep turning up, each with a stable personality
 * (strictness 1..5, advantage tendency). A fixture's referee is picked by a
 * hash of its id, so it never consumes career RNG.
 *
 * NPC bans: a red card bans 1..3 matches, every fifth yellow of a season one
 * match; banned players are left out of lineup selection (see
 * selectLineupFromPlayers) and serve the ban when their club plays.
 */
import { hashString, Rng } from '../../core/rng'
import type { NpcPlayer, World } from '../../core/types'
import { backgroundRedReason, banMatches, clampStrictness, yellowAccumulationBan, type Referee } from '../match/referee'
import { nameStyleOf, randomName } from './players'

export const REFEREES_PER_COUNTRY = 10

/** Strictness weights 1..5 (most referees are middle of the road). */
const STRICTNESS_W = [1, 2.2, 3, 2.2, 1.1]
/** Base advantage tendency by strictness. */
const ADVANTAGE_BASE = [0.85, 0.75, 0.6, 0.45, 0.3]

/** The country's referee pool (deterministic from the career seed). */
export function refereePool(seed: number, countryId: string): Referee[] {
  const rng = new Rng(seed).fork(`referees:${countryId}`)
  const style = nameStyleOf(countryId)
  const out: Referee[] = []
  for (let i = 0; i < REFEREES_PER_COUNTRY; i++) {
    const n = randomName(rng, style)
    const strictness = clampStrictness(rng.weighted([1, 2, 3, 4, 5], (s) => STRICTNESS_W[s - 1]))
    const advantage = Math.round(Math.max(0.15, Math.min(0.95, ADVANTAGE_BASE[strictness - 1] + rng.range(-0.1, 0.1))) * 100) / 100
    out.push({ name: `${n.firstName} ${n.lastName}`, strictness, advantage })
  }
  return out
}

/** Referee for a fixture: from the home country's pool, picked by the fixture id. */
export function refereeFor(seed: number, countryId: string, fixtureId: string): Referee {
  const pool = refereePool(seed, countryId)
  return { ...pool[hashString(`ref:${fixtureId}`) % pool.length] }
}

// ───────────────────────── NPC suspensions ─────────────────────────

export const isSuspended = (p: Pick<NpcPlayer, 'suspendedMatches'>): boolean => (p.suspendedMatches ?? 0) > 0

/**
 * A club played a match: its banned players (who were left out) serve one
 * match. Call BEFORE adding this match's new bans.
 */
export function serveClubBans(world: World, clubId: string): void {
  const club = world.clubs[clubId]
  if (!club) return
  for (const id of club.squad) {
    const p = world.players[id]
    if (!p || p.suspendedMatches === undefined) continue
    // Served in full: drop the field (saves stay lean and round-trip exactly).
    if (p.suspendedMatches <= 1) delete p.suspendedMatches
    else p.suspendedMatches--
  }
}

/**
 * New bans from a match: `ban` (1..3) for a red card, or one match when the
 * season's yellow count just hit a multiple of five.
 */
export function addNpcBan(p: NpcPlayer, card: { red?: boolean; ban?: number; yellowAdded?: boolean }, key: string): void {
  let ban = 0
  if (card.red) ban = card.ban ?? banMatches(backgroundRedReason(key))
  else if (card.yellowAdded && yellowAccumulationBan(p.stats.yellow)) ban = 1
  if (ban > 0) p.suspendedMatches = (p.suspendedMatches ?? 0) + ban
}
