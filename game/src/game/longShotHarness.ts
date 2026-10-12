/**
 * Long-range shooting through the phone input path (playtester build 9: "I meant SPRINT, tapped SHOOT by mistake in
 * midfield, and it went in from the halfway line").
 *
 * {@link longShotTrial}: a long_shot moment with the hero on the ball `d` metres from goal (team-mates and outfield
 * opponents out of the line — the shooter against the keeper alone), the keeper left to set himself as he does, and
 * one input: `tap` = the SHOOT button with no aim (what the touch screen sends for a tap), `aimed` = a struck shot
 * (power 0.95) at the far corner from the keeper, 0.6 m inside the post (the touch meter scheme's shot). The hero's long-range
 * attributes (Shooting, Curve, Composure, Finishing) and the keeper's (Reflexes, Diving, GK Positioning, Handling)
 * are set to the given levels. {@link naturalTapTrial}: every moment where the hero starts with the ball, SHOOT tapped
 * the instant he has it, wherever he is.
 */
import { Rng } from '../core/rng'
import type { AttributeKey } from '../core/types'
import { PITCH_LENGTH, type HighlightKind } from '../sim/match/types'
import { generatedHighlight } from './demoHighlights'
import { HUMAN, humanSwipePoints } from './intentHarness'
import { analyzeSwipe } from './kick'
import { dist, norm, sub } from './model'
import { GOAL_CENTER_Y, POST_Y_HIGH, POST_Y_LOW } from './physics'
import { HighlightRuntime } from './runtime'

export type LongInput = 'tap' | 'aimed'
export const LONG_BANDS = [13, 20, 30, 40, 50] as const
export const HERO_LONG_ATTRS: readonly AttributeKey[] = ['shooting', 'curve', 'composure', 'finishing']
export const GK_ATTRS: readonly AttributeKey[] = ['reflexes', 'diving', 'gkPositioning', 'handling']

export interface LongLog {
  goal: boolean
  /** How the moment ended (goal, saved, missed, blocked, …). */
  outcome: string
  /** Distance to the goal centre when the ball was struck (−1 = no shot). */
  d: number
}

/** One long shot from `d` m (lateral offset from the seed, ±8 m), hero long-range attrs = `hero`, keeper = `gk`. */
export function longShotTrial(seed: number, d: number, input: LongInput, hero: number, gk: number): LongLog {
  const hl = generatedHighlight('long_shot', seed, { ovr: 62, heroOvr: 57 })
  const rng = new Rng(`long:${seed}:${d}`)
  const y = GOAL_CENTER_Y + rng.range(-8, 8)
  const x = PITCH_LENGTH - Math.sqrt(Math.max(1, d * d - (y - GOAL_CENTER_Y) ** 2))
  for (const p of hl.scenario.players) {
    if (p.isHero) {
      p.pos = { x, y }
      for (const k of HERO_LONG_ATTRS) p.attrs[k] = hero
    } else if (p.role === 'GK' && p.side !== hl.side) {
      for (const k of GK_ATTRS) p.attrs[k] = gk
    } else if (p.role !== 'GK') {
      // Out of the line: 25 m behind the shooter.
      p.pos = { x: Math.max(2, x - 25 - rng.range(0, 10)), y: p.pos.y }
    }
  }
  const heroId = hl.scenario.players.find((p) => p.isHero)!.id
  hl.scenario.ball.pos = { x, y }
  hl.scenario.ball.ownerId = heroId
  const rt = new HighlightRuntime(hl, { aimAssist: 'half', slowMoAim: true, difficulty: 'normal', seed: seed * 7919 + 13 })
  let shotD = -1
  for (let f = 0; f < 60 * 12 && !rt.finished; f++) {
    rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
    if (shotD < 0 && rt.phase === 'live' && rt.owner === rt.hero) {
      const ball = { x: rt.ball.x, y: rt.ball.y }
      if (input === 'tap') rt.queueAction({ kind: 'btn', id: 'shoot' })
      else {
        // Far corner from the keeper, 0.6 m inside the post.
        const k = rt.agents.find((a) => a.team === 'opp' && a.isKeeper)
        const side = k && k.pos.y > GOAL_CENTER_Y ? -1 : 1
        const aimY = side > 0 ? POST_Y_HIGH - 0.6 : POST_Y_LOW + 0.6
        const dir = norm(sub({ x: PITCH_LENGTH, y: aimY }, ball))
        // The touch meter scheme's struck shot (power 0.95) at the corner: what a phone sends for an aimed strike
        // (a long swipe from 20 m+ can read as a pass on the swipe scheme, which is not what is measured here).
        void dir
        void analyzeSwipe
        void humanSwipePoints
        void HUMAN
        rt.queueAction({ kind: 'shoot', target: { x: PITCH_LENGTH, y: aimY }, power: 0.95, curl: 0, chip: false })
      }
      shotD = dist(ball, { x: PITCH_LENGTH, y: GOAL_CENTER_Y })
    }
    rt.update(1 / 60)
    rt.drainEvents()
  }
  return { goal: rt.result?.outcome === 'goal', d: shotD, outcome: `${rt.result?.outcome ?? 'none'}:${(rt as unknown as { endReason: string }).endReason}` }
}

export function longShotRate(d: number, input: LongInput, hero: number, gk: number, n: number): number {
  let g = 0
  for (let s = 1; s <= n; s++) if (longShotTrial(s, d, input, hero, gk).goal) g++
  return g / n
}

/** SHOOT tapped the instant the hero has the ball in a moment he starts on it (where he is, no aim). */
export function naturalTapTrial(kind: HighlightKind, seed: number): LongLog {
  const rt = new HighlightRuntime(generatedHighlight(kind, seed, { ovr: 62, heroOvr: 57 }), { aimAssist: 'half', slowMoAim: true, difficulty: 'normal', seed: seed * 7919 + 13 })
  let shotD = -1
  for (let f = 0; f < 60 * 15 && !rt.finished; f++) {
    rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
    if (shotD < 0 && rt.phase === 'live' && rt.owner === rt.hero && !rt.setPiece) {
      rt.queueAction({ kind: 'btn', id: 'shoot' })
      shotD = dist({ x: rt.ball.x, y: rt.ball.y }, { x: PITCH_LENGTH, y: GOAL_CENTER_Y })
    }
    rt.update(1 / 60)
    rt.drainEvents()
  }
  return { goal: rt.result?.outcome === 'goal', d: shotD, outcome: `${rt.result?.outcome ?? 'none'}:${(rt as unknown as { endReason: string }).endReason}` }
}
