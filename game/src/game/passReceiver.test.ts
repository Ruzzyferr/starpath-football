/**
 * Build 12 playtester: "on a 2-v-1 counter the team-mate I passed to turned back to our defence instead of shooting".
 * Phone input path: the hero carries it, then PASS (button + stick toward the man) to the obvious forward team-mate;
 * the receiver's next kick is read off the runtime. He goes on (carries it and shoots, or gives it back to the hero)
 * — he never hits it far back toward his own goal. A short lay-off when a man in front closes him down is fine.
 */
import { describe, expect, it } from 'vitest'
import { PITCH_LENGTH, type HighlightKind } from '../sim/match/types'
import { LAY_OFF_MAX } from './ai'
import { generatedHighlight } from './demoHighlights'
import { laneOpenness } from './kick'
import { dist, norm, sub } from './model'
import { GOAL_CENTER_Y } from './physics'
import { HighlightRuntime } from './runtime'

interface Reception {
  /** The receiver's next kick: its kind and how far ahead (+) / back (−) of him it was aimed (m, along the pitch). */
  kick: string | null
  aimFwd: number
  toHero: boolean
}

function receive(kind: HighlightKind, seed: number, ahead = false): Reception | null {
  const rt = new HighlightRuntime(generatedHighlight(kind, seed, { ovr: 62, heroOvr: 57 }), { aimAssist: 'half', slowMoAim: true, difficulty: 'normal', seed: seed * 7919 + 101 })
  const goal = { x: PITCH_LENGTH, y: GOAL_CENTER_Y }
  let heldAt = -1
  let passed = false
  let recv: string | null = null
  let recvT = 0
  for (let f = 0; f < 60 * 25 && !rt.finished; f++) {
    const h = rt.hero
    if (rt.phase === 'live' && rt.owner === h && !passed) {
      if (heldAt < 0) heldAt = rt.time
      rt.setControl({ move: norm(sub(goal, h.pos)), sprint: true })
      if (rt.time - heldAt > 0.6) {
        const opp = rt.agents.filter((a) => a.team === 'opp' && !a.isKeeper).map((a) => a.pos)
        const m = rt.agents
          .filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper && dist(a.pos, h.pos) > 6 && dist(a.pos, h.pos) < 30)
          .sort((p, q) => q.pos.x + laneOpenness(h.pos, q.pos, opp) * 10 - (p.pos.x + laneOpenness(h.pos, p.pos, opp) * 10))[0]
        if (m) {
          const dir = norm(sub(m.pos, h.pos))
          rt.setControl({ move: dir, sprint: false })
          rt.queueAction({ kind: 'btn', id: 'pass', dir })
          passed = true
        }
      }
    } else {
      // After the pass: the hero makes the 2-v-1 run — level with the ball (onside), toward the far post side.
      const run = ahead ? goal : { x: Math.min(rt.ball.x - 0.5, PITCH_LENGTH - 6), y: GOAL_CENTER_Y + (h.pos.y < rt.ball.y ? -5 : 5) }
      const d = sub(run, h.pos)
      rt.setControl(passed ? { move: Math.hypot(d.x, d.y) > 0.5 ? norm(d) : { x: 0, y: 0 }, sprint: true } : { move: { x: 0, y: 0 }, sprint: false })
    }
    rt.update(1 / 60)
    const o = rt.owner
    for (const e of rt.drainEvents()) {
      if (recv && e.type === 'kick' && e.by === recv) {
        // Aim from the ball's launch velocity (the plan is the receiver's own): where it is heading along the pitch.
        const v = norm({ x: rt.ball.vx, y: rt.ball.vy })
        const travel = Math.hypot(rt.ball.vx, rt.ball.vy) * 1.2
        const hero = rt.hero
        const toHero = e.kick !== 'shot' && Math.abs((hero.pos.x - e.x) * v.y - (hero.pos.y - e.y) * v.x) < 6 && (hero.pos.x - e.x) * v.x + (hero.pos.y - e.y) * v.y > 0
        return { kick: e.kick, aimFwd: v.x * travel, toHero }
      }
    }
    if (passed && !recv && o && o.team === 'hero' && !o.isHero) {
      recv = o.id
      recvT = rt.time
    }
    if (recv && o && o.id !== recv) return { kick: o.team === 'opp' ? `lost(${o.isKeeper ? 'gk' : 'def'} t=${(rt.time - recvT).toFixed(1)} x=${o.pos.x.toFixed(0)} heroDx=${(rt.hero.pos.x - o.pos.x).toFixed(0)} off=${rt.offsideMates().size})` : null, aimFwd: 0, toHero: false }
    if (recv && rt.time - recvT > 6) break
  }
  return recv ? { kick: rt.finished ? `end:${rt.result?.outcome}` : 'held', aimFwd: 0, toHero: false } : null
}

const SEEDS = 30

describe('build 12: the team-mate the hero passes to goes on with it (phone PASS button)', () => {
  for (const ahead of [false, true]) {
    const run = ahead ? 'hero sprints on past the last man (offside)' : 'hero runs level with the ball'
    it(`counter_2v1 (${run}): the receiver shoots or gives it back — never hits it back to his own defence`, () => {
      let n = 0
      let back = 0
      let onGoal = 0
      const rows: string[] = []
      for (let s = 1; s <= SEEDS; s++) {
        const r = receive('counter_2v1', s, ahead)
        if (!r) continue
        n++
        if (r.aimFwd < -LAY_OFF_MAX) back++
        if (r.kick === 'shot' || r.toHero) onGoal++
        rows.push(`s${s}:${r.kick ?? '-'}${r.toHero ? '>hero' : ''}@${r.aimFwd.toFixed(0)}`)
      }
      const line = `counter_2v1 (${run}) n=${n} long back=${back} shot/back-to-hero=${onGoal} | ${rows.join(' ')}`
      console.log(line)
      expect(n, line).toBeGreaterThanOrEqual(20)
      // Before the fix: 9–12 of 29 receivers hit a lofted ball 20–40 m back to their own defence.
      expect(back, line).toBe(0)
      // A 2-v-1 is about the finish: most receptions end in his shot or the return to the hero (the rest are lost on
      // the stats — the last man's tackle, the keeper's smother as he carries it in).
      expect(onGoal / n, line).toBeGreaterThanOrEqual(ahead ? 0.45 : 0.75)
    }, 120_000)
  }

  it('the other attacking kinds: no long ball back toward his own goal after the hero’s pass', () => {
    const kinds: HighlightKind[] = ['counter', 'build_up', 'switch_play', 'edge_of_box', 'dribble', 'hold_up', 'long_shot']
    const bad: string[] = []
    let n = 0
    for (const k of kinds) {
      for (let s = 1; s <= SEEDS; s++) {
        const r = receive(k, s)
        if (!r) continue
        n++
        if (r.aimFwd < -LAY_OFF_MAX - 8) bad.push(`${k}/s${s}:${r.kick}@${r.aimFwd.toFixed(0)}`)
      }
    }
    expect(n).toBeGreaterThan(100)
    expect(bad, bad.join(' ')).toEqual([])
  }, 300_000)
})
