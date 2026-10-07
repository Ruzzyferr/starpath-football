import type { Club, League } from '../../../core/types'
import type { Zones } from '../../components'

/** Table colour zones from league promotion/relegation rules. */
export function zonesForLeague(lg: League | undefined): Zones {
  if (!lg) return {}
  return { promo: lg.promote > 0 ? lg.promote : 1, euro: lg.tier === 1 ? 3 : 0, releg: lg.relegate }
}

export function zonesFor(club: Club, leagues: Record<string, League>): Zones {
  return zonesForLeague(leagues[club.leagueId])
}
