/**
 * Pass-network memory (Tur 3b). The match engine already counts who feeds the
 * hero and whom the hero feeds in every match, auto-played ones included
 * (`snapshot().passNet`, pure counting that never touches the match RNG). This
 * keeps a per-season tally so the event deck can notice the hero's favourite
 * link ("you and Kerem have exchanged 90 passes") and build a story on it.
 *
 * Flag `g:links` (JSON): `{ season, n, tally: { [npcId]: passes } }`.
 */
import type { GameState } from '../../core/types'
import { teammateId } from '../life/relationships'
import { readJson, writeJson } from './internal'

const relOf = (state: GameState, npcId: string) =>
  state.life.relationships[teammateId(npcId)] ?? Object.values(state.life.relationships).find((r) => r.npcId === npcId)

export const LINKS_FLAG = 'g:links'
/** Passes in a season before a pair counts as "a link" for the event deck. */
export const LINK_MIN_PASSES = 40
/** Pairs kept in the tally (the rest are noise). */
const KEEP = 6

interface Links {
  season: number
  /** Matches counted. */
  n: number
  tally: Record<string, number>
}

const empty = (season: number): Links => ({ season, n: 0, tally: {} })

/** Adds one finished match's pass telemetry to the season tally. */
export function recordPassLinks(state: GameState, passNet: Record<string, { from: number; to: number }> | undefined): void {
  if (!passNet) return
  const season = state.calendar.season
  const cur = readJson<Links>(state.life, LINKS_FLAG, empty(season))
  const links = cur.season === season ? cur : empty(season)
  for (const [id, p] of Object.entries(passNet)) {
    if (!relOf(state, id)) continue
    links.tally[id] = (links.tally[id] ?? 0) + p.from + p.to
  }
  links.n++
  const top = Object.entries(links.tally).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, KEEP)
  links.tally = Object.fromEntries(top)
  writeJson(state.life, LINKS_FLAG, links)
}

export interface PassLink {
  /** Relationship id (tm_…). */
  relId: string
  npcId: string
  name: string
  passes: number
  /** Current bond with this team-mate (-100..100). */
  bond: number
}

/** The hero's busiest passing partner this season (null below {@link LINK_MIN_PASSES}). */
export function topPassLink(state: GameState): PassLink | null {
  const links = readJson<Links | null>(state.life, LINKS_FLAG, null)
  if (!links || links.season !== state.calendar.season) return null
  let best: PassLink | null = null
  for (const [npcId, passes] of Object.entries(links.tally)) {
    const r = relOf(state, npcId)
    if (!r || passes < LINK_MIN_PASSES) continue
    if (!best || passes > best.passes) best = { relId: r.id, npcId, name: r.name, passes, bond: r.value }
  }
  return best
}
