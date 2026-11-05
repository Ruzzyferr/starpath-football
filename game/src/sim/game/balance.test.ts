/**
 * Career balance report. `BALANCE=1 npx vitest run src/sim/game/balance.test.ts`
 * runs N auto careers (BALANCE_N, default 30) for BALANCE_SEASONS (default 10)
 * and prints the markdown tables used in docs/BALANCE.md. Without the env var
 * only a quick smoke run executes.
 */
import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { runCareer, standardMix, type CareerTrace } from './balanceSim'

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

const q = (xs: number[], p: number): number => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const i = (s.length - 1) * p
  const lo = Math.floor(i)
  return s[lo]! + (s[Math.min(s.length - 1, lo + 1)]! - s[lo]!) * (i - lo)
}
const med = (xs: number[]) => q(xs, 0.5)
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const money = (v: number) => (!Number.isFinite(v) ? '–' : Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v.toFixed(0))
const pct = (v: number) => `${(v * 100).toFixed(0)}%`
const f1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '–')

/** Markdown report for a batch of careers. */
export function report(traces: CareerTrace[]): string {
  const out: string[] = []
  const seasons = Math.max(...traces.map((t) => t.samples.length))
  const highPot = (t: CareerTrace) => (t.samples[0]?.potential ?? 0) >= 85

  out.push('### Sezon sonu dağılımı (medyan [p25–p75])', '')
  out.push('| Sezon | Yaş | OVR | OVR (pot≥85) | İtibar | Lig 1. kademe | Haftalık maaş (medyan / p90) | Net servet (medyan / p90 / max) | Net servet (pot≥85 medyan) | Kupa (ort.) |')
  out.push('|---|---|---|---|---|---|---|---|---|---|')
  for (let i = 0; i < seasons; i++) {
    const rows = traces.map((t) => t.samples[i]).filter(Boolean)
    const hp = traces.filter(highPot).map((t) => t.samples[i]).filter(Boolean)
    const ovr = rows.map((r) => r!.ovr)
    out.push(`| ${i + 1} | ${med(rows.map((r) => r!.age))} | ${med(ovr).toFixed(0)} [${q(ovr, 0.25).toFixed(0)}–${q(ovr, 0.75).toFixed(0)}] | ${med(hp.map((r) => r!.ovr)).toFixed(0)} | ${med(rows.map((r) => r!.reputation)).toFixed(0)} | ${pct(rows.filter((r) => r!.tier === 1).length / rows.length)} | ${money(med(rows.map((r) => r!.wage)))} / ${money(q(rows.map((r) => r!.wage), 0.9))} | ${money(med(rows.map((r) => r!.netWorth)))} / ${money(q(rows.map((r) => r!.netWorth), 0.9))} / ${money(Math.max(...rows.map((r) => r!.netWorth)))} | ${money(med(hp.map((r) => r!.netWorth)))} | ${f1(mean(rows.map((r) => r!.trophies)))} |`)
  }

  out.push('', '### İtibar kaynakları (sezon başına ortalama)', '')
  out.push('| Sezon | Maç | Haftalık (milli takım, ödül, kupa) | Olay kartları | Transfer | Diğer (aktivite) | Alışveriş |')
  out.push('|---|---|---|---|---|---|---|')
  for (let i = 0; i < seasons; i++) {
    const rows = traces.map((t) => t.samples[i]).filter(Boolean)
    out.push(`| ${i + 1} | ${f1(mean(rows.map((r) => r!.repFrom.match)))} | ${f1(mean(rows.map((r) => r!.repFrom.weekly)))} | ${f1(mean(rows.map((r) => r!.repFrom.cards)))} | ${f1(mean(rows.map((r) => r!.repFrom.transfer)))} | ${f1(mean(rows.map((r) => r!.repFrom.other)))} | ${f1(mean(rows.map((r) => r!.repFrom.shopping)))} |`)
  }

  out.push('', '### Para: gelir ve harcama kalemleri (tüm kariyerlerin toplamı, sezon başına)', '')
  out.push('| Sezon | Gelir (vergi sonrası) | Varlık alımı | Bakım | Antrenör | Kumarhane (net kayıp) | Diğer (aktivite/olay/bonus, net) | Harcama / gelir |')
  out.push('|---|---|---|---|---|---|---|---|')
  for (let i = 0; i < seasons; i++) {
    const rows = traces.map((t) => t.samples[i]).filter(Boolean)
    const inc = rows.reduce((a, r) => a + r!.income, 0)
    const sp = (k: keyof NonNullable<(typeof rows)[number]>['spend']) => rows.reduce((a, r) => a + r!.spend[k]!, 0)
    const tot = sp('assets') + sp('upkeep') + sp('trainer') + Math.max(0, sp('casino')) + Math.max(0, sp('other'))
    out.push(`| ${i + 1} | ${money(inc)} | ${money(sp('assets'))} | ${money(sp('upkeep'))} | ${money(sp('trainer'))} | ${money(sp('casino'))} | ${money(sp('other'))} | ${pct(tot / Math.max(1, inc))} |`)
  }

  const all = traces.flatMap((t) => t.samples)
  const weeks = all.reduce((a, r) => a + r.weeks, 0)
  const gamblers = traces.filter((t) => t.cfg.persona === 'gambler')
  const gamblerSpend = gamblers.flatMap((t) => t.samples).reduce((a, r) => a + r.spend.assets + r.spend.upkeep + r.spend.trainer + Math.max(0, r.spend.casino) + Math.max(0, r.spend.other), 0)
  const allSpend = all.reduce((a, r) => a + r.spend.assets + r.spend.upkeep + r.spend.trainer + Math.max(0, r.spend.casino) + Math.max(0, r.spend.other), 0)
  const firstTop = traces.map((t) => t.firstTopTierAge).filter((v): v is number => v !== null)
  const firstElite = traces.map((t) => t.firstEliteAge).filter((v): v is number => v !== null)
  const hp = traces.filter(highPot)
  const hp80by25 = hp.filter((t) => t.ovr80Age !== null && t.ovr80Age <= 25).length
  const s3 = traces.map((t) => t.samples[2]).filter(Boolean)
  out.push('', '### Özet metrikler', '')
  out.push('| Metrik | Değer |', '|---|---|')
  out.push(`| Kariyer sayısı × sezon | ${traces.length} × ${seasons} |`)
  out.push(`| İlk 1. kademe lig yaşı (medyan, ulaşan %) | ${f1(med(firstTop))} (${pct(firstTop.length / traces.length)}) |`)
  out.push(`| İlk elit kulüp (itibar ≥ 80) yaşı (medyan, ulaşan %) | ${f1(med(firstElite))} (${pct(firstElite.length / traces.length)}) |`)
  out.push(`| Yüksek potansiyel (≥85): 25 yaşına kadar OVR 80+ | ${hp80by25}/${hp.length} |`)
  out.push(`| 3. sezon sonu net servet (medyan / max) | ${money(med(s3.map((r) => r!.netWorth)))} / ${money(Math.max(...s3.map((r) => r!.netWorth)))} |`)
  const broke = traces.filter((t) => t.bankrupt)
  out.push(`| İflas eden kariyer | ${pct(broke.length / traces.length)}${broke.length ? ` (${broke.map((t) => t.cfg.persona).join(', ')})` : ''} |`)
  for (const t of broke) {
    const b = t.bankruptAt
    if (b) out.push(`<!-- iflas: ${t.cfg.persona} yaş ${b.age} hafta ${b.week} nakit ${b.money} mevduat ${b.savings} varlık ${b.assets} işletme ${b.businesses} kredi ${b.loan} sponsor ${b.sponsors} maaş ${b.wage} -->`)
  }
  out.push(`| Sezon başına kulüp değişikliği (ort.) | ${f1(mean(all.map((r) => r.moves)))} |`)
  out.push(`| Nakdin eksiye düştüğü hafta (kariyer başına) | ${f1(all.reduce((a, r) => a + r.negativeWeeks, 0) / traces.length)} |`)
  out.push(`| Haftalık olay kartı (ort.) | ${f1(all.reduce((a, r) => a + r.events, 0) / Math.max(1, weeks))} |`)
  out.push(`| Sezon başına sakatlık (ort.) / sakat hafta | ${f1(mean(all.map((r) => r.injuries)))} / ${f1(mean(all.map((r) => r.weeksInjured)))} |`)
  out.push(`| Enerji yetmediği için normal antrenman yapılamayan sabahlar | ${pct(all.reduce((a, r) => a + r.lowEnergyMornings, 0) / Math.max(1, all.reduce((a, r) => a + r.days, 0)))} |`)
  out.push(`| Sezon başına maç (medyan) / gol (medyan) | ${med(all.map((r) => r.apps))} / ${med(all.map((r) => r.goals))} |`)
  out.push(`| Kumarhane payı: kumarbaz personada harcamanın % kaçı | ${pct(gamblers.reduce((a, t) => a + Math.max(0, t.casinoNet), 0) / Math.max(1, gamblerSpend))} |`)
  out.push(`| Kumarhane payı: tüm kariyerlerde | ${pct(traces.reduce((a, t) => a + Math.max(0, t.casinoNet), 0) / Math.max(1, allSpend))} |`)
  const islands = traces.filter((t) => t.boughtIsland)
  out.push(`| Ada alan kariyer (yaş / itibar) | ${islands.length ? islands.map((t) => `${t.boughtIsland!.age} / ${t.boughtIsland!.reputation.toFixed(0)}`).join(', ') : 'yok'} |`)

  // Goals per season by position group and OVR band, and NPC top scorers by tier.
  const grp = (p: string) => (p === 'ST' ? 'ST' : p === 'LW' || p === 'RW' || p === 'AM' ? 'LW/RW/AM' : p === 'CM' || p === 'DM' ? 'CM/DM' : p === 'GK' ? 'GK' : 'DEF')
  const bands: [string, number, number][] = [['<60', 0, 59], ['60-65', 60, 65], ['66-70', 66, 70], ['71-76', 71, 76], ['77-82', 77, 82], ['83-87', 83, 87], ['88+', 88, 200]]
  out.push('', '### Sezon başına gol: pozisyon × OVR bandı (medyan / p90 / max, n)', '')
  out.push(`| Grup | ${bands.map((b) => b[0]).join(' | ')} |`, `|---|${bands.map(() => '---').join('|')}|`)
  for (const g of ['ST', 'LW/RW/AM', 'CM/DM', 'DEF']) {
    const cells = bands.map(([, lo, hi]) => {
      const rows = all.filter((r) => grp(r.position) === g && r.apps >= 15 && r.ovr >= lo && r.ovr <= hi)
      return rows.length ? `${med(rows.map((r) => r.goals)).toFixed(0)} / ${q(rows.map((r) => r.goals), 0.9).toFixed(0)} / ${Math.max(...rows.map((r) => r.goals))} (${rows.length})` : '–'
    })
    out.push(`| ${g} | ${cells.join(' | ')} |`)
  }
  // Career goal volume (playtest Tur 2: 407 goals in 459 games): goals per game over each career and in its best season.
  out.push('', '### Kariyer gol hacmi: maç başına gol (kariyer / en iyi sezon, ≥15 maç)', '')
  out.push('| Grup | Kariyer medyan | Kariyer max | En iyi sezon medyan | En iyi sezon max | n |', '|---|---|---|---|---|---|')
  for (const g of ['ST', 'LW/RW/AM', 'CM/DM']) {
    const ts = traces.filter((t) => t.samples.length && grp(t.samples[t.samples.length - 1]!.position) === g)
    const career = ts.map((t) => t.samples.reduce((a, r) => a + r.goals, 0) / Math.max(1, t.samples.reduce((a, r) => a + r.apps, 0)))
    const best = ts.map((t) => Math.max(0, ...t.samples.filter((r) => r.apps >= 15).map((r) => r.goals / r.apps)))
    if (ts.length) out.push(`| ${g} | ${med(career).toFixed(2)} | ${Math.max(...career).toFixed(2)} | ${med(best).toFixed(2)} | ${Math.max(...best).toFixed(2)} | ${ts.length} |`)
  }
  out.push('', '### Lig gol kralı (NPC) kademeye göre (medyan / p90 / max, n)', '')
  out.push('| Kademe | Gol kralı |', '|---|---|')
  for (const tier of [1, 2, 3, 4]) {
    const rows = all.filter((r) => r.tier === tier && r.leagueTopScorer > 0)
    if (rows.length) out.push(`| ${tier} | ${med(rows.map((r) => r.leagueTopScorer)).toFixed(0)} / ${q(rows.map((r) => r.leagueTopScorer), 0.9).toFixed(0)} / ${Math.max(...rows.map((r) => r.leagueTopScorer))} (${rows.length}) |`)
  }

  out.push('', '### Kariyerler', '')
  out.push('| # | Persona | Arketip | Köken | Ülke | Cinsiyet | Pot. | Son OVR | İtibar | Kademe yolu | Son maaş | Net servet | Kupa | Kulüpler |')
  out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
  traces.forEach((t, i) => {
    const last = t.samples[t.samples.length - 1]
    if (!last) return
    out.push(`| ${i + 1} | ${t.cfg.persona} | ${t.cfg.role} | ${t.cfg.background} | ${t.cfg.nationality} | ${t.cfg.gender === 'female' ? 'K' : 'E'} | ${t.samples[0]!.potential} | ${last.ovr} | ${last.reputation} | ${t.samples.map((r) => r.tier ?? '-').join('')} | ${money(last.wage)} | ${money(last.netWorth)} | ${last.trophies} | ${t.clubs.length} |`)
  })
  return out.join('\n')
}

describe('balance simulator', () => {
  it('smoke: one career season runs and records a sample', () => {
    const [cfg] = standardMix(1, 1)
    const t = runCareer(cfg!)
    expect(t.samples).toHaveLength(1)
    const s = t.samples[0]!
    expect(s.weeks).toBeGreaterThan(30)
    expect(s.ovr).toBeGreaterThan(30)
    expect(Number.isFinite(s.netWorth)).toBe(true)
  }, 300_000)

  it.skipIf(!env.BALANCE)('full report', () => {
    const n = Number(env.BALANCE_N) || 30
    const seasons = Number(env.BALANCE_SEASONS) || 10
    const t0 = performance.now()
    const traces = standardMix(n, seasons, Number(env.BALANCE_SEED) || 1000).map((c) => runCareer(c))
    const text = `\n<!-- balance: ${n} careers × ${seasons} seasons in ${((performance.now() - t0) / 1000).toFixed(0)} s -->\n${report(traces)}\n`
    console.log(text)
    // BALANCE_OUT=<file>: also write the report to a file (the runner may drop console output).
    if (env.BALANCE_OUT) writeFileSync(env.BALANCE_OUT, text)
    expect(traces.length).toBe(n)
    // Economy guard-rail: ≤ 5% bankruptcies, and only reckless profiles may go under.
    const broke = traces.filter((c) => c.bankrupt)
    expect(broke.length / n).toBeLessThanOrEqual(0.05)
    for (const c of broke) expect(['gambler', 'spender', 'party']).toContain(c.cfg.persona)
  }, 3_600_000)

  // Starting-age dimension (owner feedback: 16–21). Every start age plays to age 30 with the same mix, so a late
  // start shows its shorter run-up: BALANCE_AGES=1 [BALANCE_N=12] [BALANCE_OUT=<file>.ages.md].
  it.skipIf(!env.BALANCE_AGES)('start-age report', () => {
    const n = Number(env.BALANCE_N) || 12
    const at = (t: CareerTrace, age: number) => t.samples.find((s) => s.age === age)
    const out = ['| Başlangıç yaşı | Başlangıç OVR | Pot. | OVR 21 | OVR 25 | Zirve OVR | İtibar 21 | İtibar 25 | İtibar 30 | 1. kademe yaşı | Gol+asist (30 yaşa kadar) | Kupa (30) |', '|---|---|---|---|---|---|---|---|---|---|---|---|']
    for (const age of [16, 17, 18, 19, 20, 21]) {
      const traces = standardMix(n, 31 - age, Number(env.BALANCE_SEED) || 1000).map((c) => runCareer({ ...c, startAge: age }))
      const v = (f: (t: CareerTrace) => number | undefined) => med(traces.map(f).filter((x): x is number => x !== undefined && Number.isFinite(x)))
      const firstTop = traces.map((t) => t.firstTopTierAge).filter((x): x is number => x !== null)
      out.push(`| ${age} | ${v((t) => t.startOvr)} | ${v((t) => t.samples[0]?.potential)} | ${v((t) => at(t, 21)?.ovr)} | ${v((t) => at(t, 25)?.ovr)} | ${v((t) => Math.max(...t.samples.map((s) => s.ovr)))} | ${v((t) => at(t, 21)?.reputation)} | ${v((t) => at(t, 25)?.reputation)} | ${v((t) => at(t, 30)?.reputation)} | ${f1(med(firstTop))} (${pct(firstTop.length / n)}) | ${v((t) => t.samples.reduce((a, s) => a + s.goals + s.assists, 0))} | ${f1(mean(traces.map((t) => t.samples[t.samples.length - 1]?.trophies ?? 0)))} |`)
    }
    const text = out.join('\n')
    console.log(text)
    if (env.BALANCE_OUT) writeFileSync(env.BALANCE_OUT, text)
    expect(out.length).toBe(8)
  }, 7_200_000)

  // Striker goal volume on a bigger sample than the standard mix (5 runners): all three striker roles,
  // BALANCE_ST=1 [BALANCE_N=12] [BALANCE_SEED] [BALANCE_OUT=<file>]. One line: career / best-season goals
  // per match and season goals in the 71-76 and 77-82 OVR bands (≥ 15 matches).
  it.skipIf(!env.BALANCE_ST)('striker report', () => {
    const n = Number(env.BALANCE_N) || 12
    const seed = Number(env.BALANCE_SEED) || 1000
    const roles = ['runner', 'targetForward', 'pivot'] as const
    const mix = standardMix(n * 6, 10, seed)
    const traces = Array.from({ length: n }, (_, i) => runCareer({ ...mix[i * 5 + 1]!, role: roles[i % 3]!, position: 'ST' }))
    const career = traces.map((t) => {
      const apps = t.samples.reduce((a, r) => a + r.apps, 0)
      return apps ? t.samples.reduce((a, r) => a + r.goals, 0) / apps : 0
    })
    const best = traces.map((t) => Math.max(0, ...t.samples.filter((r) => r.apps >= 15).map((r) => r.goals / r.apps)))
    const band = (lo: number, hi: number) => traces.flatMap((t) => t.samples.filter((r) => r.apps >= 15 && r.ovr >= lo && r.ovr <= hi).map((r) => r.goals))
    const b1 = band(71, 76)
    const b2 = band(77, 82)
    const text = `seed ${seed}, ${n} strikers × 10 seasons: goals/match career ${med(career).toFixed(2)}, best season ${med(best).toFixed(2)}; season goals 71-76 ${med(b1)} (n ${b1.length}), 77-82 ${med(b2)} (n ${b2.length})`
    console.log(text)
    if (env.BALANCE_OUT) writeFileSync(env.BALANCE_OUT, text)
    expect(traces.length).toBe(n)
  }, 3_600_000)
})
