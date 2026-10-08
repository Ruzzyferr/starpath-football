/**
 * Contract market reference (GDD 2.3#62, WP-8): the five world players most
 * similar to the hero (position family, OVR, age) and their weekly wages, so
 * the negotiation screen can say "this offer is X% of the market".
 */
import type { Hero, NpcPlayer, Position, World } from '../../core/types'
import { heroAge } from './common'
import { marketValueBreakdown, type MarketValueBreakdown } from './contract'
import { heroOvr } from './progression'

export interface MarketSample {
  id: string
  name: string
  clubId: string | null
  position: Position
  age: number
  ovr: number
  wage: number
}

export interface MarketReference {
  samples: MarketSample[]
  min: number
  max: number
  median: number
  /** Offer wage as a percentage of the median (null without samples or offer). */
  pctOfMarket: number | null
  /** The hero's own transfer value with its formula (2.3#73). */
  value: MarketValueBreakdown
}

const FAMILY: Readonly<Record<Position, string>> = {
  GK: 'gk', CB: 'def', LB: 'def', RB: 'def', DM: 'mid', CM: 'mid', AM: 'mid', LW: 'att', RW: 'att', ST: 'att',
}

/** Similarity distance (lower = closer). */
function distance(p: NpcPlayer, family: string, ovr: number, age: number, season: number): number {
  const fam = FAMILY[p.position] === family ? 0 : 6
  return Math.abs(p.ovr - ovr) * 1.2 + Math.abs(season - p.birthYear - age) * 0.6 + fam
}

export function marketReference(world: World, hero: Hero, season: number, offerWage?: number, count = 5): MarketReference {
  const ovr = heroOvr(hero)
  const age = heroAge(hero, season)
  const family = FAMILY[hero.position]
  const pool = Object.values(world.players).filter((p) => p.clubId && p.wage > 0)
  const samples = pool
    .map((p) => ({ p, d: distance(p, family, ovr, age, season) }))
    .sort((a, b) => a.d - b.d || (a.p.id < b.p.id ? -1 : 1))
    .slice(0, count)
    .map(({ p }): MarketSample => ({
      id: p.id, name: `${p.firstName} ${p.lastName}`, clubId: p.clubId, position: p.position, age: season - p.birthYear, ovr: p.ovr, wage: p.wage,
    }))
    .sort((a, b) => a.wage - b.wage)
  const value = marketValueBreakdown(hero, season)
  if (samples.length === 0) return { samples, min: 0, max: 0, median: 0, pctOfMarket: null, value }
  const wages = samples.map((s) => s.wage)
  const median = wages[Math.floor(wages.length / 2)]!
  return {
    samples,
    min: wages[0]!,
    max: wages[wages.length - 1]!,
    median,
    pctOfMarket: offerWage !== undefined && median > 0 ? Math.round((offerWage / median) * 100) : null,
    value,
  }
}
