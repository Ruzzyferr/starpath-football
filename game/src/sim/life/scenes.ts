/** Start a relationship scene (2.4#11) from a person's card: pushes the scene card as a pending event. */
import type { GameState } from '../../core/types'

export type SceneKind = 'talk' | 'together'
/** Scenes cost a little energy up front and one use per person per day (like other interactions). */
export const SCENE_ENERGY = 3

export function startScene(state: GameState, relationshipId: string, kind: SceneKind): { ok: boolean; error?: string } {
  const r = state.life.relationships[relationshipId]
  if (!r) return { ok: false, error: 'unknown person' }
  if (state.life.energy < SCENE_ENERGY) return { ok: false, error: 'not enough energy' }
  if (state.pendingEvents.some((p) => p.defId.startsWith('friends.scene_'))) return { ok: false, error: 'a scene is already open' }
  state.life.energy -= SCENE_ENERGY
  state.pendingEvents.push({
    defId: kind === 'talk' ? 'friends.scene_talk' : 'friends.scene_together',
    vars: { person: r.name, personId: r.id, personValue: Math.round(r.value) },
    firedAt: { ...state.calendar },
  })
  return { ok: true }
}
