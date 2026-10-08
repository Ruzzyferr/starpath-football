/**
 * Injury risk factors (plan 2.3#55), pure so the match engine can use them
 * without pulling in the career layer.
 */
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)

/**
 * Injury risk multiplier (2.3#55) from the plan's factors: fatigue over 80
 * doubles it; the player's proneness (1 = average); the surface (wet/frozen
 * pitch ×1.2); the opponent's tackling aggression (0..100, 50 = neutral,
 * ±30%).
 */
export function injuryRiskMultiplier(f: { fatigue: number; proneness?: number; surface?: 'dry' | 'wet' | 'frozen'; oppTackling?: number }): number {
  const fat = f.fatigue > 80 ? 2 : 1
  const prone = clamp(f.proneness ?? 1, 0.5, 2.5)
  const surface = f.surface === 'wet' || f.surface === 'frozen' ? 1.2 : 1
  const opp = 1 + clamp(((f.oppTackling ?? 50) - 50) / 50, -1, 1) * 0.3
  return fat * prone * surface * opp
}
