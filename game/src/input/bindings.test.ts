import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_BINDINGS, actionForCode, findConflict, getBindings, isDefaultBindings, resetBindings, setBinding } from './bindings'

describe('key bindings', () => {
  beforeEach(() => resetBindings())

  it('starts at defaults with no duplicate keys', () => {
    expect(isDefaultBindings()).toBe(true)
    expect(new Set(Object.values(DEFAULT_BINDINGS)).size).toBe(Object.keys(DEFAULT_BINDINGS).length)
  })

  it('rebinds a free key', () => {
    expect(setBinding('pass', 'KeyZ')).toEqual({ ok: true })
    expect(getBindings().pass).toBe('KeyZ')
    expect(actionForCode('KeyZ')).toBe('pass')
  })

  it('detects conflicts and swaps on request', () => {
    expect(findConflict('pass', 'KeyR')).toBe('through')
    expect(setBinding('pass', 'KeyR')).toEqual({ ok: false, reason: 'conflict', with: 'through' })
    expect(getBindings().pass).toBe(DEFAULT_BINDINGS.pass)
    expect(setBinding('pass', 'KeyR', true)).toEqual({ ok: true })
    expect(getBindings().pass).toBe('KeyR')
    expect(getBindings().through).toBe(DEFAULT_BINDINGS.pass)
  })

  it('rejects reserved keys and resets', () => {
    expect(setBinding('skill', 'Escape')).toEqual({ ok: false, reason: 'reserved' })
    setBinding('skill', 'KeyX')
    resetBindings()
    expect(isDefaultBindings()).toBe(true)
  })

  it('arrow keys alias movement', () => {
    expect(actionForCode('ArrowUp')).toBe('up')
  })
})
