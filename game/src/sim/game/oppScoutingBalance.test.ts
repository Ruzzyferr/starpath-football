/**
 * Opponent video balance (docs/BALANCE.md "Agenda minigames"): the real
 * mini-game rules (game/training/scouting) played by simulated players at a
 * reading stat (Anticipation = Vision = Positioning) of 40..90, 300 sessions
 * each, with the hero's slow-mo and takeaway (sim/game/oppScouting).
 *  - GOOD: watches until the habit shows, then answers after ~1.7 s of real
 *    reading time (±0.5), right 85% of the time;
 *  - SLOPPY: taps something 0.8–4 s into the clip, right 40% of the time.
 * Pass = grade B (final score ≥ 0.6: a +2 match bonus or better).
 */
import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import { ScoutingGame } from '../../game/training/scouting'
import { scoutEffective, scoutGrade, scoutSlowMo, scoutTakeaway, type ScoutReport } from './oppScouting'

const LEVELS = [40, 50, 60, 70, 80, 90] as const
const TRIALS = 300
const REPORT: Pick<ScoutReport, 'tendencies' | 'colors' | 'short' | 'name'> = {
  name: 'Rival FC', short: 'RIV', colors: { primary: '#c0392b', secondary: '#ffffff', pattern: 'plain' },
  tendencies: [
    { id: 'fbLeft', strength: 0.9, player: 'Demir', number: 3 },
    { id: 'longBall', strength: 0.8, player: 'Kaya', number: 9 },
    { id: 'gkPenRight', strength: 0.6, player: 'Usta', number: 1 },
    { id: 'highPress', strength: 0.5 },
    { id: 'counter', strength: 0.4 },
  ],
}

type Player = 'good' | 'sloppy'

/** One session; returns the played score (0..1). */
function session(reading: number, player: Player, rng: Rng, seed: number): number {
  const slow = scoutSlowMo(reading)
  const g = new ScoutingGame({ report: REPORT, seed })
  // Per session: a sharper or a slower day.
  const pace = rng.range(0.8, 1.25)
  let target = -1
  let pick = 0
  let idx = -1
  let guard = 0
  const dt = 1 / 60
  while (!g.finished && guard++ < 20_000) {
    if (g.phase === 'clip' && g.index !== idx) {
      idx = g.index
      const right = rng.chance(player === 'good' ? 0.85 : 0.4)
      pick = right ? g.clip.correct : (g.clip.correct + rng.int(1, 2)) % 3
      // Game-time moment of the answer (real seconds / slow-mo).
      target = player === 'good'
        ? g.clip.reveal + Math.max(0.5, rng.normal(1.7, 0.5) * pace) / slow
        : rng.range(0.8, 4) / slow
    }
    if (g.phase === 'clip' && g.t >= target) g.answer(pick)
    g.update(dt / slow)
  }
  return g.result().performance
}

function curve(player: Player): { pass: number[]; avg: number[] } {
  const pass: number[] = []
  const avg: number[] = []
  for (const lv of LEVELS) {
    const rng = new Rng(`scout:${player}`) // the same players at every level
    let ok = 0
    let sum = 0
    for (let i = 0; i < TRIALS; i++) {
      const eff = scoutEffective(session(lv, player, rng, i), lv)
      sum += eff
      if (scoutGrade(eff) !== 'C' && scoutGrade(eff) !== 'D') ok++
    }
    pass.push(Math.round((ok / TRIALS) * 100))
    avg.push(Math.round((sum / TRIALS) * 100) / 100)
  }
  return { pass, avg }
}

describe('opponent video follows the reading stats and the input', () => {
  it('slow-mo and takeaway grow with the reading stat', () => {
    expect(scoutSlowMo(90)).toBeGreaterThan(scoutSlowMo(40))
    expect(scoutTakeaway(90)).toBeGreaterThan(scoutTakeaway(40))
    expect(scoutSlowMo(20)).toBe(1)
  })

  it('achievable for a starting hero, monotonic, good ≫ sloppy', () => {
    const good = curve('good')
    const sloppy = curve('sloppy')
    console.log(`\nvideo\n| player | ${LEVELS.join(' | ')} |\n| good pass | ${good.pass.map((x) => `${x}%`).join(' | ')} |\n| good avg | ${good.avg.join(' | ')} |\n| sloppy pass | ${sloppy.pass.map((x) => `${x}%`).join(' | ')} |\n| sloppy avg | ${sloppy.avg.join(' | ')} |`)
    expect(good.pass[0]).toBeGreaterThanOrEqual(58)
    expect(good.pass[0]).toBeLessThanOrEqual(78)
    for (let i = 1; i < LEVELS.length; i++) {
      expect(good.avg[i]).toBeGreaterThanOrEqual(good.avg[i - 1]!)
      expect(sloppy.avg[i]).toBeGreaterThanOrEqual(sloppy.avg[i - 1]!)
      expect(good.pass[i]).toBeGreaterThanOrEqual(good.pass[i - 1]! - 1)
    }
    LEVELS.forEach((_l, i) => expect(good.pass[i]! - sloppy.pass[i]!).toBeGreaterThanOrEqual(20))
    expect(Math.max(...sloppy.pass)).toBeLessThan(60)
  }, 300_000)
})
