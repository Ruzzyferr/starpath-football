/**
 * WP-14 pass-to-me call: the hero raises his hand; the team-mate on the ball
 * passes if relationship / vision / the lane allow, else "won't pass".
 */
import { describe, expect, it } from 'vitest'
import { callAcceptChance } from './ai'
import { generatedHighlight } from './demoHighlights'
import { HighlightRuntime, type RuntimeEvent } from './runtime'
import type { Agent } from './model'
import { DEFAULT_BINDINGS } from '../input/bindings'

const mate = (relationToHero: number, vision: number): Agent => ({ relationToHero, attrs: { vision } } as unknown as Agent)

describe('call acceptance', () => {
  it('relationship and vision decide; a blocked lane makes a clever passer keep it', () => {
    expect(callAcceptChance(mate(80, 60), 1)).toBeGreaterThan(callAcceptChance(mate(-80, 60), 1) + 0.4)
    expect(callAcceptChance(mate(0, 90), 1)).toBeGreaterThan(callAcceptChance(mate(0, 30), 1))
    expect(callAcceptChance(mate(0, 90), 0)).toBeLessThan(callAcceptChance(mate(0, 90), 1) - 0.4)
  })

  it('has its own key binding', () => {
    expect(DEFAULT_BINDINGS.call).toBe('KeyG')
  })
})

/** A build-up moment with a team-mate on the ball 8 m from the hero; the hero calls. */
function callOnce(seed: number, relation: number): { passed: boolean; refused: RuntimeEvent | undefined; raised: boolean } {
  const h = generatedHighlight('build_up', seed, { heroPos: 'AM' })
  const rt = new HighlightRuntime(h, { aimAssist: 'full', slowMoAim: false, seed })
  for (let i = 0; i < 60 && rt.phase !== 'live'; i++) rt.update(1 / 60)
  rt.drainEvents()
  const m = rt.agents.find((a) => a.team === 'hero' && !a.isHero && !a.isKeeper) as Agent
  m.relationToHero = relation
  m.pos = { x: rt.hero.pos.x - 8, y: rt.hero.pos.y }
  // Clear the lane: opponents far away.
  for (const o of rt.agents) if (o.team === 'opp' && !o.isKeeper) o.pos = { x: 100, y: 5 + (o.pos.y % 50) }
  rt.owner = m
  rt.ball.x = m.pos.x
  rt.ball.y = m.pos.y
  rt.stepOnce()
  rt.drainEvents()
  rt.queueAction({ kind: 'call' })
  const events: RuntimeEvent[] = []
  for (let i = 0; i < 120 * 1.5 && !rt.finished; i++) {
    rt.stepOnce()
    events.push(...rt.drainEvents())
    if (events.some((e) => (e.type === 'kick' && e.by === m.id) || e.type === 'callRefused')) break
  }
  return {
    // Refused calls are followed by the carrier's own choice (often a pass elsewhere).
    passed: !events.some((e) => e.type === 'callRefused') && events.some((e) => e.type === 'kick' && e.by === m.id),
    refused: events.find((e) => e.type === 'callRefused'),
    raised: events.some((e) => e.type === 'callForBall') && rt.heroCallAt >= 0,
  }
}

describe('pass-to-me in a moment', () => {
  it('a friend passes when called; a team-mate who dislikes the hero mostly refuses ("won\'t pass")', () => {
    let friendPass = 0
    let foePass = 0
    let foeRefused = 0
    for (let s = 1; s <= 30; s++) {
      const f = callOnce(s, 100)
      expect(f.raised).toBe(true)
      if (f.passed) friendPass++
      const e = callOnce(s, -100)
      if (e.passed) foePass++
      if (e.refused && e.refused.type === 'callRefused' && e.refused.reason === 'relation') foeRefused++
    }
    expect(friendPass).toBeGreaterThan(20)
    expect(foePass).toBeLessThan(friendPass - 10)
    expect(foeRefused).toBeGreaterThan(10)
  })
})
