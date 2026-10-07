import { describe, expect, it } from 'vitest'
import { validateWorldData } from './validate'

describe('world data pack', () => {
  it('passes the schema validator', () => {
    expect(validateWorldData()).toEqual([])
  })
})
