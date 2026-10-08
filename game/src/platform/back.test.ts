import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installBackend, match, screen, type GameActions, type GameData } from '../ui/store'
import { pauseLiveMatchOnBack } from './back'

describe('Android back during a live match (2.9#76)', () => {
  const matchPause = vi.fn()
  beforeEach(() => {
    matchPause.mockReset()
    vi.stubGlobal('document', { documentElement: { lang: 'en' }, querySelector: () => null })
    installBackend({ actions: { matchPause } as unknown as GameActions, data: {} as GameData })
    match.value = null
    screen.value = { id: 'home' }
  })

  it('ignores other screens and finished matches', () => {
    expect(pauseLiveMatchOnBack()).toBe(false)
    screen.value = { id: 'liveMatch' }
    expect(pauseLiveMatchOnBack()).toBe(false)
    match.value = { finished: true, paused: false } as never
    expect(pauseLiveMatchOnBack()).toBe(false)
    expect(matchPause).not.toHaveBeenCalled()
  })

  it('pauses a running match once and keeps consuming further presses', () => {
    screen.value = { id: 'liveMatch' }
    match.value = { finished: false, paused: false } as never
    expect(pauseLiveMatchOnBack()).toBe(true)
    expect(matchPause).toHaveBeenCalledWith(true)
    match.value = { finished: false, paused: true } as never
    expect(pauseLiveMatchOnBack()).toBe(true)
    expect(matchPause).toHaveBeenCalledTimes(1)
    expect(screen.value.id).toBe('liveMatch')
  })
})
