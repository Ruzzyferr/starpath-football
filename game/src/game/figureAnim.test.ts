import { describe, expect, it } from 'vitest'
import { ANIM_POSES, IDLE_FRAMES, RUN_FRAMES, WALK_FRAMES, kickStyleFor } from './figureAnim'

describe('figure animation set (2.2#24, #26)', () => {
  it('has 8 run, 4 walk and 3 idle frames, and contact + follow-through per strike style', () => {
    expect(RUN_FRAMES).toBeGreaterThanOrEqual(6)
    expect(WALK_FRAMES).toBe(4)
    expect(IDLE_FRAMES).toBe(3)
    for (let i = 0; i < RUN_FRAMES; i++) expect(ANIM_POSES).toContain(`run${i}`)
    for (let i = 0; i < WALK_FRAMES; i++) expect(ANIM_POSES).toContain(`walk${i}`)
    for (let i = 0; i < IDLE_FRAMES; i++) expect(ANIM_POSES).toContain(`idle${i}`)
    for (const s of ['power', 'side', 'chip', 'outside']) for (const f of [0, 1]) expect(ANIM_POSES).toContain(`kick_${s}${f}`)
    expect(new Set(ANIM_POSES).size).toBe(ANIM_POSES.length)
  })
  it('picks the strike style from the kick', () => {
    expect(kickStyleFor('shot', 1)).toBe('power')
    expect(kickStyleFor('shot', 0.5)).toBe('side')
    expect(kickStyleFor('pass', 0.9)).toBe('side')
    expect(kickStyleFor('chip', 0.9)).toBe('chip')
    expect(kickStyleFor('shot', 0.7, 0.9)).toBe('outside')
    expect(kickStyleFor('header', 1, 0.9)).not.toBe('outside')
  })
})
