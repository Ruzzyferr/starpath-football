/**
 * Decision-card odds (sim/life/events/odds): every choice is a real gamble
 * with state-driven odds, except explicit / small-upside no-risk options.
 *
 * ODDS_REPORT=1 prints the per-category success / mixed / fail table for weak,
 * average and strong heroes plus the measured season rates.
 */
import { describe, expect, it } from 'vitest'
import { Rng, hashString } from '../../../core/rng'
import type { GameState } from '../../../core/types'
import { makeGame } from '../../game/testHelpers'
import { resolveEventChoice } from '../../game/actions'
import { autoPlayHeroMatch } from '../../game/match'
import { advanceToNextMatch, isHeroMatchday } from '../../game/calendar'
import { ALL_EVENTS } from './content'
import { buildVars, describeEvent } from './engine'
import { FLAG_TRACK, NO_RISK_CAP, choiceOdds, recordOutcome, resultValue, rollChoice, situationFactors, type ChoiceOdds } from './odds'
import type { EventCtx, EventDef, EventVars } from './types'
import { absoluteWeek } from './engine'

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const REPORT = !!env['ODDS_REPORT']

type ProfileName = 'weak' | 'average' | 'strong'

/** A real new career, then the hero's situation set to a profile. */
function profiled(p: ProfileName, seed = 77): GameState {
  const s = makeGame(seed)
  const h = s.hero
  const L = s.life
  const wage = Math.max(400, h.contract?.wage ?? 400)
  const shift = p === 'weak' ? -15 : p === 'strong' ? 15 : 0
  for (const k of Object.keys(h.attrs) as (keyof typeof h.attrs)[]) h.attrs[k] = Math.max(1, Math.min(99, 52 + shift))
  const pick = <T,>(w: T, a: T, st: T): T => (p === 'weak' ? w : p === 'strong' ? st : a)
  h.morale = pick(30, 60, 85)
  h.form = pick(35, 50, 70)
  h.fatigue = pick(70, 30, 10)
  h.managerTrust = pick(25, 50, 80)
  h.reputation = pick(10, 35, 70)
  L.stress = pick(70, 30, 15)
  L.energy = pick(40, 70, 90)
  L.health = pick(65, 85, 95)
  L.discipline = pick(40, 70, 90)
  L.money = wage * pick(1, 10, 60)
  L.bank.savings = 0
  L.casino.addiction = pick(40, 5, 0)
  const relVal = pick(-40, 10, 60)
  for (const r of Object.values(L.relationships)) r.value = relVal
  return s
}

interface Row { def: EventDef; idx: number; odds: ChoiceOdds }

function allChoiceOdds(s: GameState): Row[] {
  const rows: Row[] = []
  for (const def of ALL_EVENTS) {
    let vars: EventVars
    try {
      vars = buildVars(s, new Rng(hashString(def.id)), def, def.triggers ?? ['weekly'])
    } catch {
      continue
    }
    def.choices.forEach((_c, idx) => rows.push({ def, idx, odds: choiceOdds(s, def, idx, vars) }))
  }
  return rows
}

const pct = (x: number): string => `${Math.round(x * 100)}%`

describe('decision-card odds', () => {
  const avg = profiled('average')
  const rows = allChoiceOdds(avg)

  it('audits every choice: rolled with 10–90% success for an average hero, or an explicit/small no-risk option', () => {
    expect(rows.length).toBeGreaterThan(1000)
    const bad = rows.filter((r) => !r.odds.noRisk && (r.odds.success < 0.1 || r.odds.success > 0.9))
    expect(bad.map((r) => `${r.def.id}#${r.idx} ${pct(r.odds.success)}`)).toEqual([])
    // No-risk options are the exception, not the rule.
    const noRisk = rows.filter((r) => r.odds.noRisk).length / rows.length
    expect(noRisk).toBeLessThan(0.3)
  })

  it('a no-risk option is never "always success" with a big reward', () => {
    for (const r of rows.filter((x) => x.odds.noRisk && x.def.choices[x.idx]!.noRisk === undefined)) {
      const ctx: EventCtx = { state: avg, vars: buildVars(avg, new Rng(hashString(r.def.id)), r.def, r.def.triggers ?? ['weekly']), absWeek: absoluteWeek(avg.calendar), tags: [] }
      const v = resultValue(avg, r.def.choices[r.idx]!.effects(ctx, new Rng(1)))
      expect(v, `${r.def.id}#${r.idx}`).toBeLessThanOrEqual(NO_RISK_CAP)
    }
  })

  it('risky choices fail far more often than safe ones', () => {
    const rolled = rows.filter((r) => !r.odds.noRisk)
    const mean = (xs: Row[]): number => xs.reduce((a, r) => a + (1 - r.odds.success), 0) / Math.max(1, xs.length)
    const risky = mean(rolled.filter((r) => r.odds.risk === 'medium' || r.odds.risk === 'high'))
    const safe = mean(rolled.filter((r) => r.odds.risk === 'safe' || r.odds.risk === 'low'))
    expect(risky).toBeGreaterThanOrEqual(0.35)
    expect(risky).toBeLessThanOrEqual(0.55)
    expect(safe).toBeGreaterThanOrEqual(0.1)
    expect(safe).toBeLessThanOrEqual(0.25)
  })

  it('a well-built, well-related hero does clearly better; a struggling one clearly worse', () => {
    const mean = (s: GameState): number => {
      const r = allChoiceOdds(s).filter((x) => !x.odds.noRisk)
      return r.reduce((a, x) => a + x.odds.success, 0) / r.length
    }
    const w = mean(profiled('weak'))
    const a = mean(avg)
    const st = mean(profiled('strong'))
    expect(a - w).toBeGreaterThan(0.12)
    expect(st - a).toBeGreaterThan(0.08)
  })

  it('factor monotonicity: each lever moves the odds the right way', () => {
    const def = ALL_EVENTS.find((e) => e.id === 'manager.tactics_dispute')!
    const odds = (mut: (s: GameState) => void): number => {
      const s = profiled('average')
      mut(s)
      const vars = buildVars(s, new Rng(5), def, ['weekly'])
      return choiceOdds(s, def, 0, vars).success
    }
    const base = odds(() => {})
    const levers: [string, (s: GameState) => void, (s: GameState) => void][] = [
      ['composure/leadership', (s) => { s.hero.attrs.composure = 80; s.hero.attrs.leadership = 80 }, (s) => { s.hero.attrs.composure = 25; s.hero.attrs.leadership = 25 }],
      ['morale', (s) => { s.hero.morale = 95 }, (s) => { s.hero.morale = 10 }],
      ['form', (s) => { s.hero.form = 90 }, (s) => { s.hero.form = 10 }],
      ['manager bond', (s) => { s.hero.managerTrust = 95 }, (s) => { s.hero.managerTrust = 5 }],
      ['discipline', (s) => { s.life.discipline = 100 }, (s) => { s.life.discipline = 20 }],
    ]
    for (const [name, up, down] of levers) {
      expect(odds(up), `${name} up`).toBeGreaterThan(base)
      expect(odds(down), `${name} down`).toBeLessThan(base)
    }
    // State that only ever hurts.
    expect(odds((s) => { s.hero.fatigue = 95 })).toBeLessThan(base)
    expect(odds((s) => { s.life.stress = 95 })).toBeLessThan(base)
    expect(odds((s) => { s.hero.injury = { name: { tr: 'x', en: 'x' }, weeksLeft: 3, severity: 1 } as never })).toBeLessThan(base)
    // Money matters for money cards, fame for press cards.
    const factor = (s: GameState, cat: Parameters<typeof situationFactors>[1], key: string): number =>
      situationFactors(s, cat, {}).find((f) => f.key === key)?.pts ?? 0
    const rich = profiled('average'); rich.life.money *= 20
    const broke = profiled('average'); broke.life.money = 0
    expect(factor(rich, 'money', 'money')).toBeGreaterThan(factor(broke, 'money', 'money'))
    const famous = profiled('average'); famous.hero.reputation = 90
    expect(factor(famous, 'press', 'fame')).toBeGreaterThan(factor(avg, 'press', 'fame'))
  })

  it('history counts: past failures with the manager lower the odds, successes raise them', () => {
    const def = ALL_EVENTS.find((e) => e.id === 'manager.tactics_dispute')!
    const at = (tiers: ('success' | 'fail')[]): number => {
      const s = profiled('average')
      const vars = buildVars(s, new Rng(5), def, ['weekly'])
      for (const t of tiers) recordOutcome(s, def, vars, t)
      return choiceOdds(s, def, 0, vars).success
    }
    expect(at(['fail', 'fail'])).toBeLessThan(at([]))
    expect(at(['success', 'success'])).toBeGreaterThan(at([]))
    const s = profiled('average')
    recordOutcome(s, def, {}, 'fail')
    expect(typeof s.life.flags[FLAG_TRACK]).toBe('string')
  })

  it('rolls are deterministic, follow the shown odds and failures really hurt', () => {
    const def = ALL_EVENTS.find((e) => e.id === 'manager.out_of_position')!
    const s = profiled('average')
    const vars = buildVars(s, new Rng(9), def, ['weekly'])
    const ctx: EventCtx = { state: s, vars, absWeek: absoluteWeek(s.calendar), tags: [] }
    for (const idx of [0, 1, 2]) {
      const a = rollChoice(ctx, def, idx, new Rng(42))
      const b = rollChoice(ctx, def, idx, new Rng(42))
      expect(a).toEqual(b)
    }
    // Over many seeds the tiers match the odds of a rolled choice.
    const idx = def.choices.findIndex((_c, i) => !choiceOdds(s, def, i, vars).noRisk)
    const o = choiceOdds(s, def, idx, vars)
    const n = 4000
    const seen = { success: 0, mixed: 0, fail: 0 }
    let vS = 0
    let vF = 0
    for (let i = 0; i < n; i++) {
      const r = rollChoice(ctx, def, idx, new Rng(i))
      seen[r.tier]++
      if (r.tier === 'success') vS = resultValue(s, r.result)
      if (r.tier === 'fail') vF = resultValue(s, r.result)
    }
    expect(seen.success / n).toBeCloseTo(o.success, 1)
    expect(seen.fail / n).toBeCloseTo(o.fail, 1)
    expect(vF).toBeLessThan(vS)
    expect(vF).toBeLessThan(0)
  })

  it('no choice dominates: the best expected-value choice is not also the safest bet on most cards', () => {
    const byCard = new Map<string, Row[]>()
    for (const r of rows) byCard.set(r.def.id, [...(byCard.get(r.def.id) ?? []), r])
    let dominated = 0
    let cards = 0
    for (const [id, rs] of byCard) {
      if (rs.length < 2) continue
      const def = rs[0]!.def
      const vars = buildVars(avg, new Rng(hashString(id)), def, def.triggers ?? ['weekly'])
      const ctx: EventCtx = { state: avg, vars, absWeek: absoluteWeek(avg.calendar), tags: [] }
      const ev = rs.map((r) => {
        let total = 0
        for (let i = 0; i < 24; i++) total += resultValue(avg, rollChoice(ctx, def, r.idx, new Rng(i)).result)
        return { ev: total / 24, p: r.odds.success, best: resultValue(avg, rollChoice(ctx, def, r.idx, new Rng(0)).result) }
      })
      cards++
      const top = ev.reduce((a, b) => (b.ev > a.ev ? b : a))
      // Dominance = best EV AND (strictly) the highest success chance AND the biggest upside, with a clear EV margin.
      const others = ev.filter((x) => x !== top)
      if (others.every((x) => top.p > x.p && top.ev > x.ev + 6)) dominated++
    }
    if (REPORT) console.log(`dominated cards: ${dominated}/${cards} (${pct(dominated / cards)})`)
    expect(dominated / cards).toBeLessThan(0.25)
  })

  it('a season of play: about a quarter to a third of chosen outcomes are mixed or bad for an average hero', () => {
    const results: { nonSuccess: number; n: number; risky: [number, number]; safe: [number, number]; fails: number }[] = []
    for (const seed of [1000, 2000, 3000]) {
      const s = makeGame(seed)
      const rng = new Rng(seed)
      const startSeason = s.calendar.season
      const acc = { nonSuccess: 0, n: 0, risky: [0, 0] as [number, number], safe: [0, 0] as [number, number], fails: 0 }
      for (let step = 0; step < 4000 && s.calendar.season === startSeason; step++) {
        while (s.pendingEvents.length > 0) {
          const v = describeEvent(s, s.pendingEvents[0]!, 'en')
          const enabled = v ? v.choices.map((c, i) => (c.enabled ? i : -1)).filter((i) => i >= 0) : []
          const pick = enabled.length ? rng.pick(enabled) : 0
          const odds = v?.choices[pick]?.odds
          const r = resolveEventChoice(s, 0, pick)
          if (!r.ok) { if (s.pendingEvents.length) s.pendingEvents.splice(0, 1); continue }
          if (!r.value?.outcome || !odds) continue
          acc.n++
          const bad = r.value.outcome !== 'success'
          if (bad) acc.nonSuccess++
          if (r.value.outcome === 'fail') acc.fails++
          if (!odds.noRisk) {
            const bucket = odds.risk === 'medium' || odds.risk === 'high' ? acc.risky : acc.safe
            bucket[0]++
            if (bad) bucket[1]++
          }
        }
        if (isHeroMatchday(s)) { autoPlayHeroMatch(s); continue }
        advanceToNextMatch(s, { maxDays: 14, stopAtSeasonEnd: false })
      }
      results.push(acc)
    }
    const tot = { n: 0, bad: 0, fails: 0, rk: [0, 0], sf: [0, 0] }
    for (const r of results) {
      tot.n += r.n; tot.bad += r.nonSuccess; tot.fails += r.fails
      tot.rk = [tot.rk[0]! + r.risky[0], tot.rk[1]! + r.risky[1]]
      tot.sf = [tot.sf[0]! + r.safe[0], tot.sf[1]! + r.safe[1]]
    }
    if (REPORT) {
      console.log(`season (3 seeds): ${tot.n} cards, mixed+bad ${pct(tot.bad / tot.n)}, bad ${pct(tot.fails / tot.n)}, risky non-success ${pct(tot.rk[1]! / tot.rk[0]!)} (${tot.rk[0]}), safe non-success ${pct(tot.sf[1]! / tot.sf[0]!)} (${tot.sf[0]})`)
    }
    expect(tot.n).toBeGreaterThan(30)
    expect(tot.bad / tot.n).toBeGreaterThanOrEqual(0.22)
    expect(tot.bad / tot.n).toBeLessThanOrEqual(0.38)
    expect(tot.fails).toBeGreaterThan(0)
  }, 120_000)

  it.skipIf(!REPORT)('report: per-category success / mixed / fail for weak, average and strong heroes', () => {
    const profiles: ProfileName[] = ['weak', 'average', 'strong']
    const table = new Map<string, Record<ProfileName, { s: number; m: number; f: number; n: number }>>()
    for (const p of profiles) {
      for (const r of allChoiceOdds(p === 'average' ? avg : profiled(p))) {
        if (r.odds.noRisk) continue
        const row = table.get(r.def.category) ?? { weak: { s: 0, m: 0, f: 0, n: 0 }, average: { s: 0, m: 0, f: 0, n: 0 }, strong: { s: 0, m: 0, f: 0, n: 0 } }
        const c = row[p]
        c.s += r.odds.success; c.m += r.odds.mixed; c.f += r.odds.fail; c.n++
        table.set(r.def.category, row)
      }
    }
    const lines = ['category        | weak s/m/f      | average s/m/f   | strong s/m/f']
    for (const [cat, row] of [...table].sort()) {
      const cell = (c: { s: number; m: number; f: number; n: number }): string => `${pct(c.s / c.n)}/${pct(c.m / c.n)}/${pct(c.f / c.n)}`.padEnd(15)
      lines.push(`${cat.padEnd(15)} | ${cell(row.weak)} | ${cell(row.average)} | ${cell(row.strong)}`)
    }
    const nr = rows.filter((r) => r.odds.noRisk).length
    const cls = (k: string): number => rows.filter((r) => !r.odds.noRisk && r.odds.risk === k).length
    lines.push(`choices ${rows.length}: no-risk ${nr}, safe ${cls('safe')}, low ${cls('low')}, medium ${cls('medium')}, high ${cls('high')}`)
    console.log(lines.join('\n'))
  })
})
