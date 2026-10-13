/**
 * Build 12 playtester: "the long-ball moment was lost before I could do anything — the task never started".
 * Phone input path (humanBot, phone = true, a sensible player): the deep team-mate's long ball is the hero's to bring
 * down. His own team-mates leave it to him (they used to attack it and head it away — about one moment in four), and
 * his marker comes round him rather than through his back. Then the first contest for the ball is the hero's: he
 * touches it, or he is in the aerial duel (First Touch / Heading vs the marker's Heading — still lost on the stats).
 */
import { describe, expect, it } from 'vitest'
import { generatedHighlight } from './demoHighlights'
import { createHumanBot, humanBotStep } from './humanBot'
import { dist } from './model'
import { HighlightRuntime } from './runtime'

type First = 'hero' | 'duel' | 'mate' | 'opp' | 'none'

/** Who makes the first contact on the long ball (`duel`: an aerial duel the hero was in and lost), and the outcome. */
function feed(seed: number, heroAttr?: number): { first: First; outcome: string } {
  const hl = generatedHighlight('long_ball_control', seed, { ovr: 62, heroOvr: 57 })
  if (heroAttr !== undefined) {
    for (const p of hl.scenario.players) if (p.isHero) p.attrs = { ...p.attrs, firstTouch: heroAttr, heading: heroAttr, strength: heroAttr, balance: heroAttr }
  }
  const rt = new HighlightRuntime(hl, { aimAssist: 'half', slowMoAim: true, difficulty: 'normal', seed: seed * 7919 + 101 })
  const bot = createHumanBot('good', seed, true)
  const passer = rt.owner
  expect(passer && passer.team === 'hero' && !passer.isHero).toBe(true)
  let kicked = false
  let first: First = 'none'
  for (let f = 0; f < 60 * 30 && !rt.finished; f++) {
    humanBotStep(rt, bot, 1 / 60)
    rt.update(1 / 60)
    for (const e of rt.drainEvents()) {
      if (e.type === 'kick' && e.by === passer!.id) kicked = true
      if (!kicked || first !== 'none' || !('by' in e) || e.by === passer!.id) continue
      if (e.type !== 'touch' && e.type !== 'aerial' && e.type !== 'kick' && e.type !== 'tackle' && e.type !== 'shoulder') continue
      const a = rt.agents.find((x) => x.id === e.by)!
      // (The hero standing within 0.8 m of a ball at head height is in the aerial pool — runtime.headerContest.)
      first = a.isHero ? 'hero' : a.team === 'hero' ? 'mate' : e.type === 'aerial' && dist(rt.hero.pos, rt.ball) < 0.85 ? 'duel' : 'opp'
    }
  }
  expect(kicked, `seed ${seed}: the long ball was never played`).toBe(true)
  return { first, outcome: rt.result?.outcome ?? 'none' }
}

const N = 100

describe('build 12: long_ball_control — the long ball is the hero’s to contest (phone input path)', () => {
  it('his team-mates leave it to him and he is in the first contest for it; the outcome still follows the stats', () => {
    const c: Record<First, number> = { hero: 0, duel: 0, mate: 0, opp: 0, none: 0 }
    let held = 0
    for (let s = 1; s <= N; s++) {
      const r = feed(s)
      c[r.first]++
      if (r.outcome === 'pass_complete') held++
    }
    const line = `first contact over ${N}: ${JSON.stringify(c)} held up=${held}`
    console.log(line)
    // Before the fix: a team-mate got to it first in ~23 % (and headed it away), the hero was in the first contest ~63 %.
    expect(c.mate / N, line).toBeLessThanOrEqual(0.05)
    expect((c.hero + c.duel) / N, line).toBeGreaterThanOrEqual(0.75)
    // Not a free win: the marker still wins duels and some balls on his stats.
    expect(c.duel + c.opp, line).toBeGreaterThan(N * 0.15)
    expect(held / N, line).toBeLessThan(0.85)
  }, 300_000)

  it('the hero’s own stats decide it: 90 in the duel attributes holds it up more often than 40', () => {
    let lo = 0
    let hi = 0
    for (let s = 1; s <= 60; s++) {
      if (feed(s, 40).outcome === 'pass_complete') lo++
      if (feed(s, 90).outcome === 'pass_complete') hi++
    }
    const line = `held up: 40 → ${lo}/60, 90 → ${hi}/60`
    console.log(line)
    expect(hi, line).toBeGreaterThan(lo + 5)
  }, 300_000)
})
