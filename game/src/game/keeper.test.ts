/**
 * WP-14 keeper rules: punch vs catch on high balls, and the keepers' book
 * (direction memory) on the hero's penalties.
 */
import { describe, expect, it } from 'vitest'
import { punchChance } from './ai'
import { generatedHighlight } from './demoHighlights'
import { HighlightRuntime, type RuntimeEvent } from './runtime'
import type { Agent } from './model'
import type { HighlightOutcome } from '../sim/match/types'
import type { ShotBook } from '../core/types'

const keeper = (handling: number): Agent => ({ attrs: { handling } } as unknown as Agent)

describe('punch vs catch', () => {
  it('traffic, height, pace and poor handling make a keeper punch', () => {
    const k = keeper(60)
    expect(punchChance(k, 2.6, 1, 15)).toBeGreaterThan(punchChance(k, 2.6, 0, 15))
    expect(punchChance(k, 2.8, 0, 15)).toBeGreaterThan(punchChance(k, 1.8, 0, 15))
    expect(punchChance(keeper(30), 2, 0, 15)).toBeGreaterThan(punchChance(keeper(90), 2, 0, 15))
    expect(punchChance(keeper(90), 1.6, 0, 10)).toBeLessThan(0.1)
  })

  /** A high ball dropping onto the opposition keeper, with `crowd` attackers on him. */
  function highBall(seed: number, crowd: number): 'punch' | 'catch' | 'none' {
    const rt = new HighlightRuntime(generatedHighlight('cross', seed), { aimAssist: 'full', slowMoAim: false, seed })
    for (let i = 0; i < 60 && rt.phase !== 'live'; i++) rt.update(1 / 60)
    rt.drainEvents()
    const k = rt.agents.find((a) => a.team === 'opp' && a.isKeeper) as Agent
    k.pos = { x: 103, y: 34 }
    const mates = rt.agents.filter((a) => a.team === 'hero' && !a.isKeeper && !a.isHero)
    mates.forEach((m, i) => {
      m.pos = i < crowd ? { x: 102.6 + i * 0.4, y: 34.9 - i * 1.6 } : { x: 60, y: 10 + i }
      m.vel = { x: 0, y: 0 }
    })
    rt.owner = null
    rt.setPiece = null
    Object.assign(rt.ball, { x: 101.6, y: 34, z: 2.5, vx: 6, vy: 0, vz: -0.5 })
    for (let i = 0; i < 40 && !rt.finished; i++) {
      rt.stepOnce()
      for (const e of rt.drainEvents()) if (e.type === 'save' && e.by === k.id) return e.punch ? 'punch' : e.held ? 'catch' : 'none'
    }
    return 'none'
  }

  it('alone he catches high balls; with bodies around him he punches', () => {
    let alonePunch = 0
    let crowdPunch = 0
    let aloneCatch = 0
    for (let s = 1; s <= 40; s++) {
      const a = highBall(s, 0)
      if (a === 'punch') alonePunch++
      if (a === 'catch') aloneCatch++
      if (highBall(s, 2) === 'punch') crowdPunch++
    }
    expect(aloneCatch).toBeGreaterThan(alonePunch)
    expect(crowdPunch).toBeGreaterThan(alonePunch + 5)
  })
})

function penalty(seed: number, aimY: number, book?: ShotBook): { outcome: HighlightOutcome; events: RuntimeEvent[]; rt: HighlightRuntime } {
  const h = generatedHighlight('penalty', seed)
  if (book) h.keeperBook = book
  const rt = new HighlightRuntime(h, { aimAssist: 'full', slowMoAim: false, seed })
  const events: RuntimeEvent[] = []
  let shot = false
  for (let i = 0; i < 60 * 20 && !rt.finished; i++) {
    if (!shot && rt.phase === 'live' && rt.time > 1.2) {
      rt.queueAction({ kind: 'shoot', target: { x: 105, y: aimY }, power: 0.85, curl: 0, chip: false })
      shot = true
    }
    rt.update(1 / 60)
    events.push(...rt.drainEvents())
  }
  return { outcome: rt.result?.outcome ?? 'timeout', events, rt }
}

describe("keepers' book on penalties", () => {
  it('logs the side of every hero penalty for the book', () => {
    const { rt } = penalty(1, 31.2)
    expect(rt.result?.shotLog?.[0]).toMatchObject({ zone: 0, pen: true })
  })

  it('a keeper who studied the hero shows the tell-tale and saves more on his favourite side', () => {
    const book: ShotBook = { pen: [5, 0, 0], shot: [0, 0, 0] }
    const first = penalty(1, 31.2, book)
    expect(first.rt.keeperRead).toEqual({ zone: 0, share: 1 })
    expect(first.events.some((e) => e.type === 'keeperRead' && e.zone === 0)).toBe(true)
    const N = 60
    let habitSaved = 0
    let switchSaved = 0
    let freshSaved = 0
    for (let s = 1; s <= N; s++) {
      if (penalty(s, 31.2, book).outcome !== 'goal') habitSaved++
      if (penalty(s, 36.8, book).outcome !== 'goal') switchSaved++
      if (penalty(s, 31.2).outcome !== 'goal') freshSaved++
    }
    // Same corner again: the keeper is waiting. Switching it up beats him.
    expect(habitSaved).toBeGreaterThan(freshSaved + N * 0.15)
    expect(switchSaved).toBeLessThan(habitSaved)
  })

  it('no habit, no read: a hero who mixes it up gives nothing away', () => {
    const { rt, events } = penalty(2, 31.2, { pen: [2, 1, 2], shot: [0, 0, 0] })
    expect(rt.keeperRead).toBeNull()
    expect(events.some((e) => e.type === 'keeperRead')).toBe(false)
  })
})

describe('hero keeper hold and distribution (2.1#85)', () => {
  function holdingKeeper(seed: number): HighlightRuntime {
    const rt = new HighlightRuntime(generatedHighlight('gk_save', seed), { aimAssist: 'full', slowMoAim: false, seed })
    for (let i = 0; i < 90 && rt.phase !== 'live'; i++) rt.update(1 / 60)
    rt.drainEvents()
    rt.owner = null
    rt.setPiece = null
    const h = rt.hero
    h.pos = { x: 2, y: 34 }
    h.vel = { x: 0, y: 0 }
    Object.assign(rt.ball, { x: 3.2, y: 34, z: 0.4, vx: -4, vy: 0, vz: 0 })
    for (let i = 0; i < 40 && rt.keeperHoldLeft === 0 && !rt.finished; i++) rt.stepOnce()
    return rt
  }

  it('a held ball stays in his hands (no instant whistle) and the six-second rule ends it', () => {
    const rt = holdingKeeper(3)
    expect(rt.keeperHoldLeft).toBeGreaterThan(5)
    expect(rt.finished).toBe(false)
    for (let i = 0; i < 60 * 7 && !rt.result; i++) rt.stepOnce()
    expect(rt.result).not.toBeNull()
    expect(rt.endReason).toBe('six seconds')
    expect(rt.result?.outcome).toBe('defended')
  })

  it('a throw to a team-mate completes the distribution; the outcome never counts as conceded', () => {
    let completed = 0
    for (let seed = 1; seed <= 8; seed++) {
      const rt = holdingKeeper(seed)
      if (rt.keeperHoldLeft === 0) continue
      rt.queueAction({ kind: 'pass', dir: { x: 1, y: 0 } })
      for (let i = 0; i < 60 * 8 && !rt.finished; i++) rt.stepOnce()
      expect(rt.finished).toBe(true)
      expect(rt.result?.outcome).not.toBe('conceded')
      if (rt.result?.outcome === 'pass_complete') completed++
    }
    expect(completed).toBeGreaterThan(0)
  })
})
