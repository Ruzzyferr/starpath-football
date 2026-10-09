/**
 * Background-sim attribute sensitivity: every attribute must move the hero's involvement / outcomes in the
 * match sim (rating, chances, duels) with the right sign. Report: ATTR_REPORT=1 npx vitest run src/sim/match/attrSensitivity.test.ts
 */
import { describe, expect, it } from 'vitest'
import { SIM_PROBES, runSimProbe, type SimSensStats } from './attrSensitivity'

const ENV = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const N = Number(ENV.ATTR_SIM_N ?? 800)

const fmt = (s: SimSensStats) =>
  `r${s.rating.toFixed(2)} ga${s.ga.toFixed(2)} sh${s.shots.toFixed(2)} tk${s.tackles.toFixed(2)} sv${s.saves.toFixed(2)} p%${(s.passPct * 100).toFixed(1)} ok${(s.success * 100).toFixed(0)} gf${s.gf.toFixed(2)} gaT${s.gaTeam.toFixed(2)} m${s.moments.toFixed(1)} c${s.cards.toFixed(2)} own${s.own.toFixed(2)} gd${s.gd.toFixed(2)} x${s.xOwn.toFixed(3)}`

describe('background sim: every attribute moves the hero', () => {
  for (const p of SIM_PROBES) {
    it(`${p.attr} (${p.pos}) → ${p.metric}`, () => {
      const row = runSimProbe(p, N)
      if (ENV.ATTR_REPORT === '1') {
        const d = (k: keyof SimSensStats) => (row.high[k] - row.low[k]).toFixed(3)
        console.log(`SIM ${p.attr.padEnd(14)} ${p.pos} ${p.metric} eff=${row.effect.toFixed(3)} | dR ${d('rating')} dOwn ${d('own')} dX ${d('xOwn')} dGD ${d('gd')} dTk ${d('tackles')} dP% ${d('passPct')}\n  lo ${fmt(row.low)}\n  hi ${fmt(row.high)}`)
      }
      expect(row.effect).toBeGreaterThanOrEqual(p.min)
    }, 120_000)
  }
})
