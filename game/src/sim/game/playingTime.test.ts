/**
 * Playing-time report for young heroes (owner feedback: "always on the bench").
 * `PLAYTIME=1 npx vitest run src/sim/game/playingTime.test.ts` runs PLAYTIME_N
 * (default 24) careers per start age 16/17/18 for two seasons and prints the
 * share of available matchdays the hero appeared in (season 1) and started
 * (second half of season 2). Without the env var a small smoke run asserts the
 * floor targets loosely.
 */
import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { runCareer, standardMix, type CareerTrace } from './balanceSim'

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

export interface PlayingTimeStats { s1DryMedian: number; s1DryMax: number; n: number; s1PlayedP25: number; s1PlayedMin: number; s1Played: number; s1Started: number; s2Played: number; s2LateStarted: number; s1Matchdays: number }

/** Aggregate playing-time shares over careers (pooled matchdays). */
export function playingTime(traces: CareerTrace[]): PlayingTimeStats {
  const s1 = traces.flatMap((t) => t.matchdays.filter((m) => m.s === 0))
  const s2 = traces.flatMap((t) => t.matchdays.filter((m) => m.s === 1))
  const weeks = s2.map((m) => m.wk).sort((a, b) => a - b)
  const mid = weeks[Math.floor(weeks.length / 2)] ?? 0
  const late = s2.filter((m) => m.wk >= mid)
  const share = (xs: typeof s1, k: 'played' | 'started') => (xs.length ? xs.filter((m) => m[k]).length / xs.length : 0)
  const per = traces.map((t) => t.matchdays.filter((m) => m.s === 0)).filter((x) => x.length > 0).map((x) => share(x, 'played')).sort((a, b) => a - b)
  const dry = traces.map((t) => {
    let run = 0
    let best = 0
    for (const m of t.matchdays.filter((x) => x.s === 0)) { run = m.played ? 0 : run + 1; best = Math.max(best, run) }
    return best
  }).sort((a, b) => a - b)
  return {
    s1DryMedian: dry[Math.floor(dry.length / 2)] ?? 0, s1DryMax: dry[dry.length - 1] ?? 0,
    s1PlayedP25: per[Math.floor((per.length - 1) * 0.25)] ?? 0, s1PlayedMin: per[0] ?? 0,
    n: traces.length, s1Played: share(s1, 'played'), s1Started: share(s1, 'started'), s2Played: share(s2, 'played'),
    s2LateStarted: share(late, 'started'), s1Matchdays: s1.length / Math.max(1, traces.length),
  }
}

const pct = (v: number) => `${(v * 100).toFixed(0)}%`

describe('playing time (young heroes)', () => {
  it.runIf(env.PLAYTIME === '1')('report', () => {
    const n = Number(env.PLAYTIME_N ?? 24)
    const base = Number(env.PLAYTIME_SEED ?? 1000)
    const rows: string[] = ['| Start age | Careers | Matchdays S1 (avg) | Played S1 (pooled · p25 · min career) | Started S1 | Played S2 | Started S2 (2nd half) | Longest S1 run without minutes (median · max) | Keepers: played S1 · started S2 (2nd half) |', '|---|---|---|---|---|---|---|---|---|']
    for (const age of [16, 17, 18]) {
      const traces = standardMix(n, 2, base + age).map((c) => runCareer({ ...c, startAge: age }))
      const p = playingTime(traces)
      const k = playingTime(traces.filter((t) => t.cfg.role === 'shotStopper'))
      rows.push(`| ${age} | ${p.n} | ${p.s1Matchdays.toFixed(1)} | ${pct(p.s1Played)} · ${pct(p.s1PlayedP25)} · ${pct(p.s1PlayedMin)} | ${pct(p.s1Started)} | ${pct(p.s2Played)} | ${pct(p.s2LateStarted)} | ${p.s1DryMedian} · ${p.s1DryMax} | ${pct(k.s1Played)} · ${pct(k.s2LateStarted)} |`)
    }
    const all = standardMix(Math.max(6, Math.round(n / 2)), 2, base + 99).map((c) => runCareer(c))
    const wk = all.reduce((a, t) => a + t.agenda.weeks, 0)
    const mand = all.reduce((a, t) => a + t.agenda.mandatory, 0)
    const kinds: Record<string, number> = {}
    for (const t of all) for (const [k, v] of Object.entries(t.agenda.kinds)) kinds[k] = (kinds[k] ?? 0) + v
    const kindList = Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')
    rows.push('', `Agenda: ${(mand / Math.max(1, wk)).toFixed(2)} mandatory tasks per in-season week (${all.length} careers × 2 seasons); kinds: ${kindList}`)
    if (env.PLAYTIME_OUT) writeFileSync(env.PLAYTIME_OUT, rows.join('\n') + '\n')
    else console.log(rows.join('\n'))
  }, 1_800_000)

  it('a fresh 17-year-old plays most matchdays of season 1 in some capacity', () => {
    const traces = standardMix(4, 1, 4242).map((c) => runCareer({ ...c, startAge: 17 }))
    const p = playingTime(traces)
    expect(p.s1Matchdays).toBeGreaterThan(10)
    expect(p.s1Played).toBeGreaterThan(0.5)
  }, 600_000)
})
