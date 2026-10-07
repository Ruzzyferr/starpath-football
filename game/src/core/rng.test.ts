import { Rng } from './rng'

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(42), b = new Rng(42)
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next())
  })
  it('restores from state', () => {
    const a = new Rng('x'); a.next()
    const b = new Rng(a.state)
    expect(b.nextUint()).toBe(a.nextUint())
  })
  it('int stays within bounds', () => {
    const r = new Rng(1)
    for (let i = 0; i < 1000; i++) { const v = r.int(3, 7); expect(v).toBeGreaterThanOrEqual(3); expect(v).toBeLessThanOrEqual(7) }
  })
  it('poisson mean is close to lambda', () => {
    const r = new Rng(7); let s = 0
    for (let i = 0; i < 5000; i++) s += r.poisson(1.4)
    expect(s / 5000).toBeGreaterThan(1.3); expect(s / 5000).toBeLessThan(1.5)
  })
})
