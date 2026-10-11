import type { Difficulty, GameState } from '../../../core/types'
import { trainingOpponentLevel } from '../../../game/training/matchup'
import { heroOvr } from '../../../sim/career/progression'
import { clubStrength } from '../../../sim/world/queries'

/** Drill opposition sharpness per game difficulty (also the drill's `difficulty`). */
export const DRILL_DIFFICULTY: Record<Difficulty, number> = { easy: 0.85, normal: 1, hard: 1.15, legend: 1.3 }

/** The drill's opposition level: training partners at the squad's level (`clubId`), moved by the difficulty. */
export function drillOpponentFor(s: GameState, clubId: string | null | undefined): number {
  const squad = clubId && s.world.clubs[clubId] ? clubStrength(s.world, clubId).overall : null
  return trainingOpponentLevel(heroOvr(s.hero), squad, DRILL_DIFFICULTY[s.meta.difficulty] ?? 1)
}
