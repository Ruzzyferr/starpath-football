import { describe, expect, it } from 'vitest'
import { qualityFactor, TRAINING_TYPES } from '../../sim/career/training'
import {
  DRILL_DURATION, DRILL_FOR_TRAINING, DRILL_PAR, beepInterval, comboMultiplier, controllable, gradeFor, inTarget, lapPoints, levelSpeed,
  passPoints, performanceFromPoints, savePoints, shotPoints, shuttlePoints, skillTiming, sprintDrain, staminaRecovery, startTiming, xpQuality,
  BEATEN_PENALTY, CROSS_ZONE_R, FOUL_PENALTY, crossPoints, crossTiming, headerPoints, jumpTiming, tacklePoints,
} from './scoring'
import { DRILL_KINDS } from './types'

describe('drill scoring', () => {
  it('maps points to a 0..1 performance with par = 1', () => {
    for (const k of DRILL_KINDS) {
      expect(performanceFromPoints(k, 0)).toBe(0)
      expect(performanceFromPoints(k, -50)).toBe(0)
      expect(performanceFromPoints(k, DRILL_PAR[k])).toBe(1)
      expect(performanceFromPoints(k, DRILL_PAR[k] * 3)).toBe(1)
      const half = performanceFromPoints(k, DRILL_PAR[k] / 2)
      expect(half).toBeGreaterThan(0.5) // concave: half par is better than half marks
      expect(half).toBeLessThan(0.6)
      expect(performanceFromPoints(k, DRILL_PAR[k] * 0.55)).toBeCloseTo(0.6, 1)
    }
  })

  it('grades performances', () => {
    expect(gradeFor(1)).toBe('S')
    expect(gradeFor(0.92)).toBe('S')
    expect(gradeFor(0.8)).toBe('A')
    expect(gradeFor(0.6)).toBe('B')
    expect(gradeFor(0.45)).toBe('C')
    expect(gradeFor(0.1)).toBe('D')
    expect(gradeFor(-1)).toBe('D')
  })

  it('drills last 20–40 s and every trainable session maps to a drill except recovery', () => {
    for (const k of DRILL_KINDS) {
      expect(DRILL_DURATION[k]).toBeGreaterThanOrEqual(20)
      expect(DRILL_DURATION[k]).toBeLessThanOrEqual(40)
    }
    for (const t of Object.keys(TRAINING_TYPES) as (keyof typeof TRAINING_TYPES)[]) {
      if (t === 'recovery') expect(DRILL_FOR_TRAINING[t]).toBeNull()
      else expect(DRILL_FOR_TRAINING[t]).not.toBeNull()
    }
    expect(DRILL_FOR_TRAINING.goalkeeping?.kind).toBe('goalkeeping')
    expect(DRILL_FOR_TRAINING.setPiece?.variant).toBe('setPiece')
    expect(DRILL_FOR_TRAINING.crossing?.kind).toBe('crossing')
    expect(DRILL_FOR_TRAINING.heading?.kind).toBe('heading')
    expect(DRILL_FOR_TRAINING.tackling?.kind).toBe('tackling')
  })

  it('combo multiplier is capped at +50%', () => {
    expect(comboMultiplier(0)).toBe(1)
    expect(comboMultiplier(2)).toBeCloseTo(1.2)
    expect(comboMultiplier(99)).toBeCloseTo(1.5)
  })

  it('scores shots: goals, distance, targets and streaks', () => {
    expect(shotPoints({ goal: false, targetHit: true, distance: 20, combo: 3 })).toBe(0)
    expect(shotPoints({ goal: true, targetHit: false, distance: 12, combo: 0 })).toBe(100)
    expect(shotPoints({ goal: true, targetHit: false, distance: 20, combo: 0 })).toBe(130)
    expect(shotPoints({ goal: true, targetHit: true, distance: 14, combo: 0 })).toBe(250)
    expect(shotPoints({ goal: true, targetHit: true, distance: 14, combo: 5 })).toBe(375)
    expect(inTarget(31, 0.5, { y: 31.2, z: 0.6, r: 0.5 })).toBe(true)
    expect(inTarget(31, 1.5, { y: 31.2, z: 0.6, r: 0.5 })).toBe(false)
  })

  it('scores passes by completion, technique and release', () => {
    const base = { received: true, wanted: 'ground' as const, lofted: false, gateCleared: true, release: 2, combo: 0 }
    expect(passPoints({ ...base, received: false })).toBe(0)
    expect(passPoints(base)).toBe(130)
    expect(passPoints({ ...base, release: 0.8 })).toBe(150)
    expect(passPoints({ ...base, gateCleared: false })).toBe(60)
    expect(passPoints({ ...base, wanted: 'loft', lofted: true, gateCleared: false })).toBe(130)
    expect(passPoints({ ...base, wanted: 'loft', lofted: false })).toBe(60)
    expect(controllable(10, 0.7)).toBe(true)
    expect(controllable(20, 0.7)).toBe(false)
  })

  it('grades skill-move timing by distance to the defender', () => {
    expect(skillTiming(4)).toBe('early')
    expect(skillTiming(3)).toBe('good')
    expect(skillTiming(2)).toBe('perfect')
    expect(skillTiming(1.1)).toBe('good')
    expect(skillTiming(0.5)).toBe('late')
    expect(lapPoints(7, 9)).toBe(240)
    expect(lapPoints(12, 9)).toBe(200)
  })

  it('beep test speeds up and rewards leaving on the beep', () => {
    expect(levelSpeed(2)).toBeGreaterThan(levelSpeed(1))
    expect(beepInterval(1)).toBeCloseTo(5)
    expect(beepInterval(4)).toBeLessThan(beepInterval(3))
    expect(startTiming(0.1)).toBe('perfect')
    expect(startTiming(0.3)).toBe('good')
    expect(startTiming(0.6)).toBe('slow')
    expect(shuttlePoints(1, 'perfect')).toBe(150)
    expect(shuttlePoints(3, 'slow')).toBe(130)
    // Fitter players drain slower and recover faster.
    expect(sprintDrain(0.9)).toBeLessThan(sprintDrain(0.3))
    expect(staminaRecovery(0.9, true)).toBeGreaterThan(staminaRecovery(0.3, true))
    expect(staminaRecovery(0.5, true)).toBeGreaterThan(staminaRecovery(0.5, false))
  })

  it('scores saves: held, stretch and pace add up', () => {
    expect(savePoints({ saved: false, held: true, stretch: 1, speed: 30, combo: 0 })).toBe(0)
    expect(savePoints({ saved: true, held: false, stretch: 0, speed: 10, combo: 0 })).toBe(100)
    expect(savePoints({ saved: true, held: true, stretch: 1, speed: 40, combo: 0 })).toBe(180)
  })

  it('XP preview mirrors the sim quality factor', () => {
    for (const p of [0, 0.3, 0.6, 1]) expect(xpQuality(p)).toBeCloseTo(qualityFactor(p))
  })
})

describe('crossing / heading / tackling scoring', () => {
  it('cross timing is relative to the runner', () => {
    expect(crossTiming(0)).toBe('perfect')
    expect(crossTiming(-0.25)).toBe('perfect')
    expect(crossTiming(0.5)).toBe('good')
    expect(crossTiming(-1)).toBe('early')
    expect(crossTiming(1)).toBe('late')
  })

  it('crosses score only in the zone, more when central and on time', () => {
    expect(crossPoints({ inZone: false, miss: 0, timing: 'perfect', combo: 0 })).toBe(0)
    const centre = crossPoints({ inZone: true, miss: 0, timing: 'perfect', combo: 0 })
    const edge = crossPoints({ inZone: true, miss: CROSS_ZONE_R * 0.9, timing: 'perfect', combo: 0 })
    const early = crossPoints({ inZone: true, miss: 0, timing: 'early', combo: 3 })
    expect(centre).toBeGreaterThan(edge)
    expect(centre).toBeGreaterThan(early)
    expect(crossPoints({ inZone: true, miss: 0, timing: 'perfect', combo: 5 })).toBeGreaterThan(centre)
  })

  it('jump timing peaks at the top of the jump', () => {
    expect(jumpTiming(0.3, 0.3)).toBe(1)
    expect(jumpTiming(0, 0.3)).toBe(0)
    expect(jumpTiming(0.45, 0.3)).toBeCloseTo(0.5)
  })

  it('headers score goals, targets and a timed jump', () => {
    expect(headerPoints({ goal: false, targetHit: true, timing: 1, combo: 0 })).toBe(0)
    expect(headerPoints({ goal: true, targetHit: true, timing: 1, combo: 0 })).toBeGreaterThan(headerPoints({ goal: true, targetHit: false, timing: 0.2, combo: 0 }))
  })

  it('won tackles score; fouls and getting beaten cost', () => {
    expect(tacklePoints({ won: false, timing: 1, slide: true, combo: 0 })).toBe(0)
    expect(tacklePoints({ won: true, timing: 0.9, slide: false, combo: 0 })).toBeGreaterThan(tacklePoints({ won: true, timing: 0.3, slide: false, combo: 0 }))
    expect(FOUL_PENALTY).toBeLessThan(0)
    expect(BEATEN_PENALTY).toBeLessThan(0)
  })
})
