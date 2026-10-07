/**
 * WP-14 highlight rules: referee strictness in fouls/cards, the advantage
 * rule (play on, then call back if nothing comes of it).
 */
import { describe, expect, it } from 'vitest'
import { Rng } from '../core/rng'
import { cardForFoul } from './ai'
import { generatedHighlight } from './demoHighlights'
import { HighlightRuntime, ADVANTAGE_WINDOW, type RuntimeEvent } from './runtime'
import type { Agent } from './model'
import type { Highlight } from '../sim/match/types'

interface AdvantageAccess {
  tryAdvantage(fouler: Agent, on: Agent, card: 'yellow' | 'red' | undefined): boolean
}

function liveRuntime(advantage: number, seed = 3): { rt: HighlightRuntime; events: RuntimeEvent[] } {
  const h: Highlight = generatedHighlight('build_up', seed, { heroPos: 'AM' })
  h.referee = { strictness: 3, advantage }
  const rt = new HighlightRuntime(h, { aimAssist: 'full', slowMoAim: false, seed })
  const events: RuntimeEvent[] = []
  for (let i = 0; i < 60 && rt.phase !== 'live'; i++) {
    rt.update(1 / 60)
    events.push(...rt.drainEvents())
  }
  return { rt, events }
}

function run(rt: HighlightRuntime, events: RuntimeEvent[], seconds: number): void {
  for (let i = 0; i < seconds * 120 && !rt.finished; i++) {
    rt.stepOnce()
    events.push(...rt.drainEvents())
  }
}

function startAdvantage(rt: HighlightRuntime): boolean {
  const fouler = rt.agents.find((a) => a.team === 'opp' && !a.isKeeper) as Agent
  // Move play into the opposition half so advantage is allowed.
  rt.ball.x = 70
  rt.hero.pos.x = 70
  return (rt as unknown as AdvantageAccess).tryAdvantage(fouler, rt.hero, 'yellow')
}

describe('cards scale with referee strictness', () => {
  it('a strictness-5 referee books far more than a strictness-1 referee', () => {
    const count = (s: number) => {
      const rng = new Rng(`cards:${s}`)
      let n = 0
      for (let i = 0; i < 4000; i++) if (cardForFoul(rng, false, false, false, s)) n++
      return n / 4000
    }
    expect(count(5)).toBeGreaterThan(count(1) * 2)
    expect(Math.abs(count(3) - 0.18)).toBeLessThan(0.03)
  })
})

describe('advantage rule', () => {
  it('a referee who never plays advantage blows straight away', () => {
    const { rt } = liveRuntime(0)
    expect(startAdvantage(rt)).toBe(false)
  })

  it('is called back when the fouled team gains nothing within the window', () => {
    const { rt, events } = liveRuntime(1)
    expect(startAdvantage(rt)).toBe(true)
    expect(events.concat(rt.drainEvents()).some((e) => e.type === 'advantage' && e.state === 'on')).toBe(true)
    // Hero stands still with the ball: no progress, no shot.
    rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
    for (const a of rt.agents) if (a.team === 'opp') a.noTouch = 99
    run(rt, events, ADVANTAGE_WINDOW + 1)
    expect(rt.result?.outcome).toBe('foul_won')
    expect(rt.result?.advantage).toBe('called_back')
    expect(events.some((e) => e.type === 'advantage' && e.state === 'called_back')).toBe(true)
  })

  it('pays off when the hero gets a shot away, and play goes on', () => {
    const { rt, events } = liveRuntime(1, 5)
    expect(startAdvantage(rt)).toBe(true)
    rt.owner = rt.hero
    rt.queueAction({ kind: 'shoot', target: { x: 105, y: 32 }, power: 0.9, curl: 0, chip: false })
    run(rt, events, 0.3)
    expect(events.some((e) => e.type === 'advantage' && e.state === 'played')).toBe(true)
    run(rt, events, 12)
    expect(rt.result?.outcome).not.toBe('foul_won')
    expect(rt.result?.advantage).toBe('played')
  })
})
