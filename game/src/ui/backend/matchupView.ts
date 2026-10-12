/** Moment matchup card data for the UI: the engine's Matchup (game/matchup.ts) as a plain view. */
import { momentMatchup } from '../../game/matchup'
import type { Highlight } from '../../sim/match/types'
import type { MatchupView } from '../store'

export function matchupViewOf(hl: Highlight, names: Record<string, string>, heroName?: string): MatchupView | undefined {
  const heroId = hl.scenario.players.find((p) => p.isHero)?.id
  const all = heroId && heroName ? { ...names, [heroId]: heroName } : names
  const m = momentMatchup(hl, all)
  if (!m) return undefined
  return {
    role: m.role,
    hero: { name: m.hero.name, ovr: m.hero.ovr, number: m.hero.number },
    opp: { name: m.opp.name, ovr: m.opp.ovr, number: m.opp.number },
    rows: m.rows.map((r) => ({ heroKey: r.hero, oppKey: r.opp, heroV: r.heroV, oppV: r.oppV, edge: r.edge })),
    edge: m.edge,
    ...(m.chance ? { chance: { ...m.chance } } : {}),
  }
}
