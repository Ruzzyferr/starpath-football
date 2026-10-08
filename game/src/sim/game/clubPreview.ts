/**
 * What a club would offer, at a glance (2.7#89): city, league, the role it
 * would plan for the hero and a weekly wage range. Estimates use the same
 * `fairWage` the real offer starts from, shown as a band (+-15%).
 */
import type { GameState, SquadRole } from '../../core/types'
import { fairWage, roundNice } from '../career/contract'
import { heroOvr } from '../career/progression'
import { clubContextOf } from './internal'

export type InterestTier = 'watching' | 'interested' | 'bid'

/** Same cut-offs as the scouting model (watch 35, interested 55, bid 75). */
export function interestTier(level: number): InterestTier {
  return level >= 75 ? 'bid' : level >= 55 ? 'interested' : 'watching'
}

export interface ClubPreview {
  city: string
  leagueName: string
  role: SquadRole
  wage: [number, number]
}

/** Role the club would plan for the hero by how his OVR compares with its squad average. */
export function expectedRole(heroOvrValue: number, squadAvg: number): SquadRole {
  const d = heroOvrValue - squadAvg
  return d >= 8 ? 'star' : d >= 3 ? 'starter' : d >= -2 ? 'rotation' : d >= -8 ? 'reserve' : 'youth'
}

export function clubPreview(state: GameState, clubId: string): ClubPreview | null {
  const c = state.world.clubs[clubId]
  if (!c) return null
  const ctx = clubContextOf(state, clubId)
  const fair = fairWage(state.hero, ctx, state.calendar.season)
  return {
    city: c.city,
    leagueName: state.world.leagues[c.leagueId]?.name ?? '',
    role: expectedRole(heroOvr(state.hero), ctx.squadAvgOvr),
    wage: [roundNice(fair * 0.85), roundNice(fair * 1.15)],
  }
}
