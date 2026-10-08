import { describe, expect, it } from 'vitest'
import { expectedRole, interestTier } from './clubPreview'

describe('clubPreview', () => {
  it('tiers follow the scouting cut-offs', () => {
    expect([34, 35, 54, 55, 74, 75, 100].map(interestTier)).toEqual(['watching', 'watching', 'watching', 'interested', 'interested', 'bid', 'bid'])
  })
  it('role follows the OVR gap', () => {
    expect([12, 8, 3, 0, -3, -8, -9].map((d) => expectedRole(60 + d, 60))).toEqual(['star', 'star', 'starter', 'rotation', 'reserve', 'reserve', 'youth'])
  })
})
