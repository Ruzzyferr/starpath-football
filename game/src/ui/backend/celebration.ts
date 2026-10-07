/**
 * Goal celebration choice (per career, stored in life.flags) and unlock state
 * for the Profile picker and the match scene.
 *
 * A celebration is unlocked by reputation / perks / achievements (see
 * game/presentation.ts) or, for the ones in the cosmetic celebration pack,
 * right away by owning that pack.
 */
import type { GameState } from '../../core/types'
import { CELEBRATIONS, isCelebrationId, type CelebrationChoice, type CelebrationDef, type CelebrationId } from '../../game/presentation'
import { cosmeticUnlocked, packFor } from '../../store-iap'
import { metaData } from './meta'
import { commit, current, get } from './session'

const FLAG = 'g:celebration'

export interface CelebrationRow {
  def: CelebrationDef
  unlocked: boolean
  /** Locked, but the store pack would unlock it. */
  inStorePack: boolean
}

function unlockInput(s: GameState) {
  let achievements: string[] = []
  try {
    achievements = Object.keys(metaData.value.achievements.unlocked)
  } catch {
    /* meta not installed (tests) */
  }
  return { reputation: s.hero.reputation, perks: s.hero.perks, achievements }
}

export function celebrationRows(s: GameState | null = current()): CelebrationRow[] {
  if (!s) return []
  const x = unlockInput(s)
  return CELEBRATIONS.map((def) => {
    const pack = !!packFor('celebration', def.id)
    const earned = def.isUnlocked(x)
    const bought = pack && cosmeticUnlocked('celebration', def.id)
    return { def, unlocked: earned || bought, inStorePack: pack && !earned && !bought }
  })
}

export function unlockedCelebrations(s: GameState | null = current()): CelebrationId[] {
  return celebrationRows(s).filter((r) => r.unlocked).map((r) => r.def.id)
}

export function celebrationChoice(s: GameState | null = current()): CelebrationChoice {
  const v = s?.life.flags[FLAG]
  return isCelebrationId(v) ? v : 'auto'
}

export function chooseCelebration(choice: CelebrationChoice): void {
  const s = get()
  if (choice === 'auto') delete s.life.flags[FLAG]
  else if (unlockedCelebrations(s).includes(choice)) s.life.flags[FLAG] = choice
  else return
  commit(s)
}

/** What the match scene needs. */
export function celebrationForMatch(s: GameState | null = current()): { choice: CelebrationChoice; unlocked: CelebrationId[] } {
  return { choice: celebrationChoice(s), unlocked: unlockedCelebrations(s) }
}
