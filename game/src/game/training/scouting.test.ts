import { describe, expect, it } from 'vitest'
import type { ScoutReport } from '../../sim/game/oppScouting'
import { CLIPS, CLIP_TIMEOUT, FEEDBACK_TIME, ScoutingGame, TITLE_TIME, actorAt, ballAt, buildClips } from './scouting'

const REPORT: Pick<ScoutReport, 'tendencies' | 'colors' | 'short' | 'name'> = {
  name: 'Rival FC', short: 'RIV', colors: { primary: '#c0392b', secondary: '#ffffff', pattern: 'plain' },
  tendencies: [
    { id: 'fbLeft', strength: 0.9, player: 'Demir', number: 3 },
    { id: 'longBall', strength: 0.8, player: 'Kaya', number: 9 },
    { id: 'gkPenRight', strength: 0.6, player: 'Usta', number: 1 },
    { id: 'highPress', strength: 0.5 },
    { id: 'shortBuild', strength: 0.3 },
  ],
}

/** Play a whole session with a bot that answers after `delay` seconds (right or wrong). */
function play(seed: number, delay: number, right: boolean): ScoutingGame {
  const g = new ScoutingGame({ report: REPORT, seed })
  let guard = 0
  while (!g.finished && guard++ < 10_000) {
    if (g.phase === 'clip' && g.t >= delay) g.answer(right ? g.clip.correct : (g.clip.correct + 1) % 3)
    g.update(1 / 30)
  }
  return g
}

describe('opponent video scouting mini-game', () => {
  it('builds four clips from the strongest tendencies, each with three distinct options and one right answer', () => {
    const clips = buildClips(REPORT, 7)
    expect(clips).toHaveLength(CLIPS)
    expect(new Set(clips.map((c) => c.pattern))).toEqual(new Set(['fbLeft', 'longBall', 'gkPenRight', 'highPress']))
    for (const c of clips) {
      expect(c.options).toHaveLength(3)
      expect(new Set(c.options.map((o) => o.id)).size).toBe(3)
      expect(c.options[c.correct]!.id).toBe(c.pattern)
      expect(c.actors.some((a) => a.key)).toBe(true)
      expect(c.reveal).toBeLessThan(c.length)
    }
    // Names from the real squad reach the question text.
    const fb = clips.find((c) => c.pattern === 'fbLeft')!
    expect(fb.options[fb.correct]!.text.en).toContain('Demir')
  })

  it('is deterministic for a seed', () => {
    expect(JSON.stringify(buildClips(REPORT, 11))).toBe(JSON.stringify(buildClips(REPORT, 11)))
  })

  it('a sharp eye scores high, a slow one less, wrong answers zero; a session lasts 30–45 s', () => {
    const fast = play(3, 1.5, true).result()
    const slow = play(3, 7.5, true).result()
    const wrong = play(3, 1.5, false).result()
    expect(fast.performance).toBeGreaterThanOrEqual(0.95)
    expect(fast.grade).toBe('S')
    expect(fast.spotted).toHaveLength(CLIPS)
    expect(slow.performance).toBeLessThan(fast.performance)
    expect(slow.performance).toBeGreaterThan(0.55)
    expect(wrong.performance).toBe(0)
    expect(wrong.grade).toBe('D')
    expect(fast.played).toBeGreaterThanOrEqual(CLIPS * (TITLE_TIME + FEEDBACK_TIME))
    // A typical session (answers around the reveal) sits in the 30–45 s window; the hard cap is 45 s.
    const typical = play(5, 3.5, true).result()
    expect(typical.played).toBeGreaterThanOrEqual(25)
    expect(typical.played).toBeLessThanOrEqual(45)
    const idle = play(5, 99, true).result()
    expect(idle.performance).toBe(0)
    expect(idle.played).toBeLessThanOrEqual(CLIPS * (TITLE_TIME + CLIP_TIMEOUT + FEEDBACK_TIME) + 0.5)
  })

  it('ignores answers outside the clip phase and a second answer', () => {
    const g = new ScoutingGame({ report: REPORT, seed: 1 })
    expect(g.answer(0)).toBeNull() // title card
    while (g.phase !== 'clip') g.update(0.05)
    expect(g.answer(g.clip.correct)?.correct).toBe(true)
    expect(g.answer(0)).toBeNull()
  })

  it('animates actors and the ball along their tracks', () => {
    const c = buildClips(REPORT, 2).find((x) => x.pattern === 'longBall')!
    const st = c.actors.find((a) => a.key)!
    expect(actorAt(st, 0)).not.toEqual(actorAt(st, c.length))
    const mid = ballAt(c.ball, 1.6)
    expect(mid.z).toBeGreaterThan(3) // a lofted long ball
    expect(ballAt(c.ball, 0).z).toBe(0)
  })
})
