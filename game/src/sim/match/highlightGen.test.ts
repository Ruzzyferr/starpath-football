import { Rng } from '../../core/rng'
import type { Formation } from '../../core/types'
import { assignSlots, buildScenario, formationSlots, planHighlightMinutes, plannedHighlightCount, type SlotPlayer } from './highlightGen'
import { makeTeam } from './testFixtures'
import type { HighlightKind } from './types'

const FORMATIONS: Formation[] = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2', '4-1-4-1', '3-4-3']
const KINDS: HighlightKind[] = ['build_up', 'counter', 'one_on_one', 'cross', 'edge_of_box', 'freekick', 'penalty', 'corner', 'defend', 'gk_save', 'gk_penalty']

describe('formationSlots', () => {
  it.each(FORMATIONS)('%s has 11 plausible slots', (f) => {
    const slots = formationSlots(f)
    expect(slots).toHaveLength(11)
    expect(slots[0].role).toBe('GK')
    const defenders = slots.filter((s) => s.role === 'CB' || s.role === 'LB' || s.role === 'RB').length
    expect(defenders).toBe(Number(f[0]))
    for (const s of slots) {
      expect(s.x).toBeGreaterThan(0)
      expect(s.x).toBeLessThan(60)
      expect(s.y).toBeGreaterThan(0)
      expect(s.y).toBeLessThan(68)
    }
    // Defenders sit behind forwards.
    const maxDef = Math.max(...slots.filter((s) => s.role === 'CB').map((s) => s.x))
    const minFwd = Math.min(...slots.filter((s) => s.role === 'ST' || s.role === 'LW' || s.role === 'RW').map((s) => s.x))
    expect(maxDef).toBeLessThan(minFwd)
  })
})

describe('assignSlots', () => {
  it('maps a formation-built lineup onto its own slots one to one', () => {
    for (const f of FORMATIONS) {
      const team = makeTeam(new Rng(f), 'h', { formation: f })
      const shuffled = new Rng(3).shuffle(team.lineup.slice())
      const slots = assignSlots(shuffled, f)
      const roles = formationSlots(f)
      expect(new Set(slots).size).toBe(11)
      shuffled.forEach((p, i) => expect(roles[slots[i]].role).toBe(p.position))
    }
  })
})

describe('buildScenario', () => {
  const setup = (heroPos: 'ST' | 'GK' | 'CB' | 'LW') => {
    const rng = new Rng(heroPos)
    const home = makeTeam(rng, 'h', { heroPosition: heroPos, formation: '4-3-3' })
    const away = makeTeam(rng, 'a', { formation: '4-4-2' })
    const toSlots = (players: typeof home.lineup, f: Formation): SlotPlayer[] => {
      const s = assignSlots(players, f)
      return players.map((player, i) => ({ player, slot: s[i] }))
    }
    return { mates: toSlots(home.lineup, '4-3-3'), opps: toSlots(away.lineup, '4-4-2') }
  }

  it.each(KINDS)('%s produces a valid 22-player layout', (kind) => {
    const pos = kind === 'gk_save' || kind === 'gk_penalty' ? 'GK' : kind === 'defend' ? 'CB' : kind === 'cross' ? 'LW' : 'ST'
    const { mates, opps } = setup(pos)
    const g = buildScenario({ kind, heroSide: 'away', heroId: 'hero', mates, opps, mateFormation: '4-3-3', oppFormation: '4-4-2', lang: 'tr', rng: new Rng(kind) })
    const sc = g.scenario
    expect(sc.players).toHaveLength(22)
    expect(sc.players.filter((p) => p.side === 'away')).toHaveLength(11)
    const hero = sc.players.find((p) => p.isHero)
    expect(hero).toBeDefined()
    expect(sc.timeLimit).toBeGreaterThanOrEqual(8)
    expect(sc.timeLimit).toBeLessThanOrEqual(20)
    if (sc.ball.ownerId) expect(sc.players.some((p) => p.id === sc.ball.ownerId)).toBe(true)
    const heroX = hero?.pos.x ?? 0
    if (kind === 'one_on_one' || kind === 'edge_of_box' || kind === 'penalty') expect(heroX).toBeGreaterThan(70)
    if (kind === 'gk_save' || kind === 'gk_penalty') expect(heroX).toBeLessThan(5)
    if (kind === 'defend') expect(heroX).toBeLessThan(40)
    if (kind === 'penalty') expect(sc.ball.pos).toEqual({ x: 94, y: 34 })
    if (kind === 'gk_penalty') expect(sc.ball.pos).toEqual({ x: 11, y: 34 })
  })

  it('wall stands about 9.15 m from a free kick', () => {
    const { mates, opps } = setup('ST')
    const g = buildScenario({ kind: 'freekick', heroSide: 'home', heroId: 'hero', mates, opps, mateFormation: '4-3-3', oppFormation: '4-4-2', lang: 'en', rng: new Rng(9) })
    const b = g.scenario.ball.pos
    const close = g.scenario.players.filter((p) => p.side === 'away' && Math.abs(Math.hypot(p.pos.x - b.x, p.pos.y - b.y) - 9.15) < 1.5)
    expect(close.length).toBeGreaterThanOrEqual(3)
  })
})

describe('highlight planning', () => {
  it('full matches plan 4–9 highlights whatever the inputs', () => {
    const rng = new Rng(4)
    for (let i = 0; i < 500; i++) {
      const n = plannedHighlightCount(
        { position: rng.pick(['ST', 'CB', 'GK', 'CM'] as const), relationAvg: rng.range(-100, 100), morale: rng.range(0.8, 1.2), form: rng.range(0, 100), minutes: 90 },
        rng,
      )
      expect(n).toBeGreaterThanOrEqual(4)
      expect(n).toBeLessThanOrEqual(9)
    }
  })

  it('short cameos plan proportionally fewer', () => {
    const rng = new Rng(5)
    expect(plannedHighlightCount({ position: 'ST', relationAvg: 0, morale: 1, form: 50, minutes: 5 }, rng)).toBe(0)
    const n = plannedHighlightCount({ position: 'ST', relationAvg: 0, morale: 1, form: 50, minutes: 25 }, rng)
    expect(n).toBeGreaterThanOrEqual(1)
    expect(n).toBeLessThanOrEqual(3)
  })

  it('spreads distinct minutes across the window', () => {
    const mins = planHighlightMinutes(2, 88, 7, new Rng(1))
    expect(new Set(mins).size).toBe(7)
    for (const m of mins) {
      expect(m).toBeGreaterThanOrEqual(2)
      expect(m).toBeLessThanOrEqual(88)
    }
  })
})
