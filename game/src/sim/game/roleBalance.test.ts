/**
 * Role balance report ("Rol denge yaması", docs/BALANCE.md). `ROLE_BALANCE=1 npx vitest run src/sim/game/roleBalance.test.ts`
 * measures every role of every position (background sim + bot-played moments; ROLE_BALANCE_CAREERS=<n> adds
 * n auto careers per role) and prints / writes (ROLE_BALANCE_OUT=<file>) the markdown table. Without the env
 * var a quick smoke run and the fairness guard on the auto-resolved sim run.
 */
import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { POSITION_ROLES } from '../../core/roles'
import type { Position, Role } from '../../core/types'
import { runCareer } from './balanceSim'
import { BALANCE_POSITIONS, playRole, relToMean, simRole, type PlayRoleStats, type SimRoleStats } from './roleBalance'

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%`
const f2 = (v: number) => v.toFixed(2)
/** A played match's rating estimate: base 6.0 plus ~6 moments at the role's mean rating change per moment. */
const playedMatch = (p: PlayRoleStats) => 6 + 6 * p.rating

interface CareerRole { ovr: number; rep: number; rating: number }
function careers(pos: Position, role: Role, n: number, seasons: number): CareerRole {
  let ovr = 0, rep = 0, rating = 0, rn = 0
  for (let i = 0; i < n; i++) {
    const t = runCareer({ seed: 5000 + i * 7919, nationality: ['TR', 'EN', 'ES', 'BR'][i % 4]!, role, position: pos, background: (['academy', 'street', 'footballFamily', 'lateBloomer'] as const)[i % 4]!, gender: i % 4 === 3 ? 'female' : 'male', persona: 'pro', seasons })
    const last = t.samples[t.samples.length - 1]!
    ovr += last.ovr
    rep += last.reputation
    for (const s of t.samples) if (s.apps > 0) { rating += s.rating; rn++ }
  }
  return { ovr: ovr / n, rep: rep / n, rating: rn ? rating / rn : 0 }
}

describe('role balance', () => {
  it('smoke: a role runs through the sim and the played harness', () => {
    const s = simRole('ST', 'runner', 2)
    expect(s.matches).toBe(2)
    expect(s.rating).toBeGreaterThan(3)
    const p = playRole('ST', 'pivot', 2)
    expect(p.moments).toBe(2)
  }, 300_000)

  it('auto-resolved match rating of every role is within ±5 % of its position mean', () => {
    for (const pos of BALANCE_POSITIONS) {
      const rows = POSITION_ROLES[pos].map((r) => [r, simRole(pos, r, 40).rating] as const)
      // ±5 % is the report's target at 300 matches (docs/BALANCE.md); 40 matches carry ±3 % of noise, so the guard is ±8 %.
      for (const [r, v] of rows) expect(Math.abs(relToMean(v, rows.map((x) => x[1]))), `${pos}/${r} ${v.toFixed(2)}`).toBeLessThanOrEqual(0.08)
    }
  }, 300_000)

  it.skipIf(!env.ROLE_BALANCE)('full report', () => {
    const nSim = Number(env.ROLE_BALANCE_SIM) || 150
    const nPlay = Number(env.ROLE_BALANCE_PLAY) || 150
    const nCar = Number(env.ROLE_BALANCE_CAREERS) || 0
    const seasons = Number(env.ROLE_BALANCE_SEASONS) || 8
    const out: string[] = []
    out.push(`<!-- role balance: sim ${nSim} matches, played ${nPlay} moments (average bot, normal), careers ${nCar} × ${seasons} seasons per role; OVR 68 -->`)
    out.push('| Mevki | Rol | Maç reytingi (sim) | Δ | G+A / maç | Savunma / maç | Oynanan an: başarı | Oynanan: reyting Δ / an | Oynanan maç reytingi (tahmini) | Δ | En sık anlar |' + (nCar ? ' Kariyer son OVR | Δ | Son itibar | Δ | Kariyer reytingi | Δ |' : ''))
    out.push('|---|---|---|---|---|---|---|---|---|---|---|' + (nCar ? '---|---|---|---|---|---|' : ''))
    // ROLE_BALANCE_POS=CB,LW: only these positions (re-measuring after a tweak).
    const only = env.ROLE_BALANCE_POS ? env.ROLE_BALANCE_POS.split(',') : null
    for (const pos of BALANCE_POSITIONS.filter((p) => !only || only.includes(p))) {
      const roles = POSITION_ROLES[pos]
      const sims: SimRoleStats[] = roles.map((r) => simRole(pos, r, nSim))
      const plays: PlayRoleStats[] = roles.map((r) => playRole(pos, r, nPlay))
      const cars: CareerRole[] = nCar ? roles.map((r) => careers(pos, r, nCar, seasons)) : []
      roles.forEach((r, i) => {
        const s = sims[i]!, p = plays[i]!
        const top = (Object.entries(s.kinds) as [string, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k).join(', ')
        let row = `| ${pos} | ${r} | ${f2(s.rating)} | ${pct(relToMean(s.rating, sims.map((x) => x.rating)))} | ${f2(s.ga)} | ${f2(s.def)} | ${(p.success * 100).toFixed(0)}% | ${p.rating >= 0 ? '+' : ''}${f2(p.rating)} | ${f2(playedMatch(p))} | ${pct(relToMean(playedMatch(p), plays.map(playedMatch)))} | ${top} |`
        if (nCar) {
          const c = cars[i]!
          row += ` ${c.ovr.toFixed(1)} | ${pct(relToMean(c.ovr, cars.map((x) => x.ovr)))} | ${c.rep.toFixed(0)} | ${pct(relToMean(c.rep, cars.map((x) => x.rep)))} | ${f2(c.rating)} | ${pct(relToMean(c.rating, cars.map((x) => x.rating)))} |`
        }
        out.push(row)
      })
    }
    const text = out.join('\n')
    console.log(text)
    if (env.ROLE_BALANCE_OUT) writeFileSync(env.ROLE_BALANCE_OUT, text)
    expect(out.length).toBeGreaterThan(5)
  }, 7_200_000)
})
