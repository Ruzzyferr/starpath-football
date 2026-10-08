import type { Background, Position, Role } from '../../core/types'
import { ATTRIBUTE_KEYS } from '../../core/types'
import { Rng } from '../../core/rng'
import { POSITION_ROLES, ROLES } from '../../core/roles'
import { BACKGROUNDS, ROLE_SPEC, createHero, createLife, previewAttrs, roleTemplate } from './createHero'
import { earnedPerkPoints, heroOvr, ovrFor } from './progression'
import { TEST_APPEARANCE } from './testFixtures'

const ARCH_POS: [Role, Position][] = (Object.entries(POSITION_ROLES) as [Position, readonly Role[]][]).flatMap(([pos, roles]) => roles.map((r) => [r, pos] as [Role, Position]))
const BGS: Background[] = ['street', 'academy', 'footballFamily', 'lateBloomer']

const input = (role: Role, position: Position, background: Background, foot: 'L' | 'R' | 'B' = 'R') => ({
  firstName: 'Ece', lastName: 'Demir', nickname: 'Ece', nationality: 'TR', position, foot,
  appearance: TEST_APPEARANCE, role, background, birthYear: 2009,
})

describe('createHero', () => {
  it('is deterministic for a seed', () => {
    const a = createHero(new Rng(5), input('runner', 'ST', 'street'))
    const b = createHero(new Rng(5), input('runner', 'ST', 'street'))
    expect(a).toEqual(b)
  })

  it('every role × background starts in a sensible OVR band with growth headroom', () => {
    for (const [arch, pos] of ARCH_POS) {
      for (const bg of BGS) {
        for (let seed = 1; seed <= 5; seed++) {
          const h = createHero(new Rng(seed * 31), input(arch, pos, bg))
          const ovr = heroOvr(h)
          expect(ovr).toBeGreaterThanOrEqual(38)
          expect(ovr).toBeLessThanOrEqual(60)
          expect(h.potential).toBeGreaterThanOrEqual(Math.min(99, ovr + 12))
          expect(h.potential).toBeLessThanOrEqual(99)
          for (const k of ATTRIBUTE_KEYS) {
            expect(h.attrs[k]).toBeGreaterThanOrEqual(5)
            expect(h.attrs[k]).toBeLessThanOrEqual(75)
          }
        }
      }
    }
  })

  it('late bloomers start lower but have a higher ceiling on average', () => {
    let lateOvr = 0, lateP = 0, acaOvr = 0, acaP = 0
    for (let s = 1; s <= 40; s++) {
      const l = createHero(new Rng(s), input('runner', 'ST', 'lateBloomer'))
      const a = createHero(new Rng(s), input('runner', 'ST', 'academy'))
      lateOvr += heroOvr(l); lateP += l.potential; acaOvr += heroOvr(a); acaP += a.potential
    }
    expect(lateOvr).toBeLessThan(acaOvr)
    expect(lateP).toBeGreaterThan(acaP)
  })

  it('outfielders have poor goalkeeping, keepers poor finishing', () => {
    const st = createHero(new Rng(1), input('runner', 'ST', 'academy'))
    const gk = createHero(new Rng(1), input('shotStopper', 'GK', 'academy'))
    expect(st.attrs.reflexes).toBeLessThan(25)
    expect(gk.attrs.handling).toBeGreaterThan(50) // the shot-stopper holds what he stops
    expect(gk.attrs.finishing).toBeLessThan(st.attrs.finishing)
  })

  it('grants innate perks and starting perk points', () => {
    const h = createHero(new Rng(2), input('touchlineWinger', 'RW', 'street', 'B'))
    expect(h.perks).toContain('two_footed')
    expect(h.perks).toContain('street_smart')
    expect(h.perkPoints).toBe(earnedPerkPoints(heroOvr(h)))
  })
})

describe('createLife', () => {
  it('builds family relations and background money', () => {
    for (const bg of BGS) {
      const rng = new Rng(3)
      const h = createHero(rng, input('runner', 'ST', bg))
      const life = createLife(rng, h, bg, { mother: 'Leyla' })
      expect(life.money).toBe(BACKGROUNDS[bg].money)
      for (const id of ['bestFriend', 'fans', 'press']) expect(life.relationships[id]).toBeDefined()
      // Family structure is background-dependent (2.4#14); a present mother carries the given name.
      if (life.relationships.mother) {
        expect(life.relationships.mother.name).toBe('Leyla')
        expect(life.relationships.mother.value).toBeGreaterThan(40)
      }
      expect(life.energy).toBe(100)
    }
  })
  it('football families are richest, street kids poorest', () => {
    expect(BACKGROUNDS.footballFamily.money).toBeGreaterThan(BACKGROUNDS.academy.money)
    expect(BACKGROUNDS.street.money).toBeLessThan(BACKGROUNDS.lateBloomer.money)
  })
})

describe('position roles (owner feedback)', () => {
  it('every role is offered somewhere and is exactly four strengths and four weaknesses with a fair budget', () => {
    const offered = new Set(Object.values(POSITION_ROLES).flat())
    for (const r of ROLES) {
      expect(offered.has(r)).toBe(true)
      expect(ROLE_SPEC[r].plus).toHaveLength(4)
      expect(ROLE_SPEC[r].minus).toHaveLength(4)
      expect(new Set([...ROLE_SPEC[r].plus, ...ROLE_SPEC[r].minus]).size).toBe(8)
    }
    for (const [pos, roles] of Object.entries(POSITION_ROLES) as [Position, readonly Role[]][]) {
      for (const r of roles) {
        const t = roleTemplate(r, pos)
        for (const k of ROLE_SPEC[r].plus) expect(t[k], `${pos}/${r} +${k}`).toBeGreaterThan(0)
        for (const k of ROLE_SPEC[r].minus) {
          expect(t[k], `${pos}/${r} -${k}`).toBeLessThan(0)
          expect(t[k]!, `${pos}/${r} -${k}`).toBeGreaterThanOrEqual(-8)
        }
        for (const k of ROLE_SPEC[r].plus) expect(t[k]!, `${pos}/${r} +${k}`).toBeLessThanOrEqual(40)
      }
    }
  })
  it('roles of the same position start at the same OVR (±1) and differ where the points go', () => {
    for (const [pos, roles] of Object.entries(POSITION_ROLES) as [Position, readonly Role[]][]) {
      const ovrs = roles.map((r) => ovrFor(previewAttrs(pos, r, 'academy'), pos))
      expect(Math.max(...ovrs) - Math.min(...ovrs), `${pos}: ${ovrs.join(',')}`).toBeLessThanOrEqual(1)
      // Any two roles of a position differ clearly somewhere (≥ 5 points on some attribute).
      for (const r of roles) for (const o of roles) {
        if (r === o) continue
        const a = previewAttrs(pos, r, 'academy')
        const b = previewAttrs(pos, o, 'academy')
        const gap = Math.max(...(Object.keys(a) as (keyof typeof a)[]).map((k) => Math.abs(a[k] - b[k])))
        expect(gap, `${pos}: ${r} vs ${o}`).toBeGreaterThanOrEqual(5)
      }
    }
  })
  it('noisy heroes average the same OVR across roles of a position', () => {
    for (const [pos, roles] of Object.entries(POSITION_ROLES) as [Position, readonly Role[]][]) {
      const avg = roles.map((r) => {
        let sum = 0
        for (let s = 1; s <= 40; s++) sum += heroOvr(createHero(new Rng(s * 17), input(r, pos, 'academy')))
        return sum / 40
      })
      expect(Math.max(...avg) - Math.min(...avg), `${pos}: ${avg.map((a) => a.toFixed(1)).join(',')}`).toBeLessThanOrEqual(1.2)
    }
  })
  it('tall roles get taller defaults, clamped to the role range', () => {
    const pivot = createHero(new Rng(3), input('pivot', 'ST', 'academy'))
    const runner = createHero(new Rng(3), input('runner', 'ST', 'academy'))
    expect(pivot.heightCm! - runner.heightCm!).toBeGreaterThanOrEqual(10)
    const giant = createHero(new Rng(3), { ...input('runner', 'ST', 'academy'), heightCm: 230 })
    expect(giant.heightCm).toBe(runner.heightCm! + 5)
  })
})
