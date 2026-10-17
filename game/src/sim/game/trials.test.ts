import { describe, expect, it } from 'vitest'
import { POSITION_ROLES } from '../../core/roles'
import type { Position } from '../../core/types'
import { trialDrillsFor } from './trials'

const DEFENDERS: readonly Position[] = ['CB', 'LB', 'RB', 'DM']

describe('trial drills follow the chosen position and starting role (owner, 2026-10-17)', () => {
  it('a defender is never asked to shoot; a keeper only keeps', () => {
    for (const pos of Object.keys(POSITION_ROLES) as Position[]) {
      for (const role of POSITION_ROLES[pos]) {
        const drills = trialDrillsFor(pos, role)
        if (DEFENDERS.includes(pos)) expect(drills, `${pos} ${role}`).not.toContain('finishing')
        if (pos === 'GK') for (const d of drills) expect(['goalkeeping', 'distribution', 'sprint']).toContain(d)
      }
    }
  })

  it('the role changes the trials: a stopper defends, a ball-playing centre-back passes, an aerial one heads', () => {
    expect(trialDrillsFor('CB', 'stopper')[0]).toBe('tackling')
    expect(trialDrillsFor('CB', 'ballPlayingDefender')[0]).toBe('passing')
    expect(trialDrillsFor('CB', 'aerialDefender')[0]).toBe('heading')
    expect(trialDrillsFor('CM', 'anchor')[0]).toBe('interception')
    expect(trialDrillsFor('ST', 'targetForward')[0]).toBe('heading')
    expect(trialDrillsFor('LW', 'touchlineWinger')[0]).toBe('crossing')
  })

  it('outfield players get more than one kind of trial', () => {
    for (const pos of Object.keys(POSITION_ROLES) as Position[]) {
      if (pos === 'GK') continue
      for (const role of POSITION_ROLES[pos]) expect(new Set(trialDrillsFor(pos, role)).size, `${pos} ${role}`).toBe(3)
    }
  })

  it('a role that does not fit the position falls back to the position default', () => {
    expect(trialDrillsFor('CB', 'runner')).toEqual(trialDrillsFor('CB', 'stopper'))
  })
})
