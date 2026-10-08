import { describe, expect, it } from 'vitest'
import { ObjectPool } from './pool'

describe('ObjectPool', () => {
  const mk = (maxFree = 2) => {
    const log: string[] = []
    let n = 0
    const pool = new ObjectPool<{ id: number; dirty: boolean }>(
      () => ({ id: ++n, dirty: false }),
      (o) => {
        o.dirty = false
        log.push(`reset${o.id}`)
      },
      (o) => {
        o.dirty = true
        log.push(`park${o.id}`)
      },
      maxFree,
      (o) => log.push(`dispose${o.id}`),
    )
    return { pool, log }
  }

  it('reuses released objects instead of creating new ones', () => {
    const { pool } = mk()
    const a = pool.acquire()
    pool.release(a)
    const b = pool.acquire()
    expect(b).toBe(a)
    expect(pool.stats()).toEqual({ created: 1, reused: 1, free: 0, live: 1 })
  })

  it('a long churn of 1000 events creates only as many objects as are live at once', () => {
    const { pool } = mk(8)
    for (let i = 0; i < 1000; i++) {
      const a = pool.acquire()
      const b = pool.acquire()
      pool.release(a)
      pool.release(b)
    }
    expect(pool.stats().created).toBe(2)
    expect(pool.stats().live).toBe(0)
  })

  it('disposes objects beyond the free-list cap and on clear', () => {
    const { pool, log } = mk(1)
    const [a, b] = [pool.acquire(), pool.acquire()]
    pool.release(a)
    pool.release(b)
    expect(log).toContain('dispose2')
    expect(pool.stats().free).toBe(1)
    pool.clear()
    expect(log).toContain('dispose1')
    expect(pool.stats().free).toBe(0)
  })
})
