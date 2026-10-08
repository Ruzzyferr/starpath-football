import { describe, expect, it } from 'vitest'
import { PARTNER_NAMES } from '../life/events/dsl'
import { PARTNER_NAMES_MEN, PARTNER_NAMES_WOMEN, getPartnerPref, partnerNamePool, setPartnerPref } from './partnerPref'

const st = () => ({ life: { flags: {} as Record<string, number | string | boolean> } })

describe('partner preference', () => {
  it('defaults to any and pools cover the legacy list', () => {
    const s = st()
    expect(getPartnerPref(s as never)).toBe('any')
    expect(partnerNamePool(s as never)).toBe(PARTNER_NAMES)
  })
  it('restricts the pool and round-trips', () => {
    const s = st()
    expect(setPartnerPref(s as never, 'men')).toBe(true)
    expect(partnerNamePool(s as never)).toBe(PARTNER_NAMES_MEN)
    expect(setPartnerPref(s as never, 'men')).toBe(false)
    setPartnerPref(s as never, 'women')
    expect(partnerNamePool(s as never)).toBe(PARTNER_NAMES_WOMEN)
    setPartnerPref(s as never, 'any')
    expect(s.life.flags).toEqual({})
  })
})
