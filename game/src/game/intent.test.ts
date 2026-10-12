/**
 * Intent & attribute bands (playtester build 7: "not a single mini-game won").
 * A sensible human — real swipe / button input paths, see intentHarness.ts —
 * must succeed most of the time with a starting hero; success must rise
 * smoothly with the moment's OWN attributes (game/momentSkill), and input skill
 * must matter at every level. Normal difficulty, half assist (the defaults).
 * Deterministic seeds.
 *
 * Full report: INTENT_REPORT=1 npx vitest run src/game/intent.test.ts --silent=false
 *   INTENT_CURVES=1 for the attribute curve tables, INTENT_N=200, INTENT_KINDS=shot,pass,
 *   INTENT_LOG=shot INTENT_PROF=start for per-trial intended vs actual goal-line points.
 */
import { describe, expect, it } from 'vitest'
import { CURVE_KINDS, INTENT_KINDS, LEVELS, PROFILE_KEYS, intentFinishRate, intentRate, playIntent, type InputSkill, type IntentKind, type Profile } from './intentHarness'

/** Env access without Node typings (the app tsconfig has no @types/node). */
const ENV = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

/**
 * Starting hero (OVR 57), good input. Build 9 physics pass (owner: physics + one chance rule, a starting hero's single
 * chance event ~45–55 %): a shot is the keeper's reach against the strike (was 0.65 → measured 0.43; the SHOOT button's
 * auto-aimed corner 0.26), a tackle is Tackling vs Dribbling after the carrier's own take-on (was 0.55 → 0.29).
 */
const START_MIN: Partial<Record<IntentKind, number>> = { shot: 0.38, shotBtn: 0.2, pass: 0.85, shortPass: 0.9, passRun: 0.7, through: 0.65, cross: 0.6, tackle: 0.25 }

/**
 * Goals per placed 1v1 finish by Finishing-group level against the generated (~62) keeper. Owner (build 9 finishing
 * decision): the finish follows the stat about 1:1 — 50 → 45–55 %, 70 → 62–70 %, 90 → 78–85 % — reached physically
 * (keeper reaction / dive / reach from his stats, the strike's direction error from the shooter's), no save roll.
 * Bands = the targets ± sampling noise at n = 200 (~110 shots).
 */
const SHOT_BANDS: Record<number, [number, number]> = { 50: [0.42, 0.57], 70: [0.6, 0.73], 90: [0.76, 0.88] }
/** Kinds whose good input meets a clean ball physics delivers (passes, crosses): near-certain, no spread to show. */
const CEILING: ReadonlySet<IntentKind> = new Set<IntentKind>(['pass', 'through', 'cross'])

const N = 150
/** Through balls: a ~10 % harness ceiling (the bot's runner vs the button's) needs the bigger sample for a stable curve. */
const curveN = (k: IntentKind) => (k === 'through' ? 300 : N)
const curve = (k: IntentKind, input: InputSkill) => LEVELS.map((lv) => intentRate(k, lv, curveN(k), input).rate)

describe('intent: a starting hero with sensible input succeeds', () => {
  for (const k of INTENT_KINDS) {
    it(`${k} ≥ ${Math.round((START_MIN[k] ?? 0) * 100)}%`, () => {
      const r = intentRate(k, 'start', N)
      expect(r.rate).toBeGreaterThanOrEqual(START_MIN[k] ?? 0)
      // A sensible corner swipe almost never goes out (playtester: "a sure goal went out").
      if (k === 'shot' || k === 'shotBtn') expect(r.offTarget).toBeLessThanOrEqual(0.1)
    }, 120_000)
  }

  it('a shot struck at the keeper still mostly fails', () => {
    expect(intentRate('shot', 'start', N, 'atKeeper').rate).toBeLessThan(0.4)
  }, 120_000)
})

describe('intent: success follows the moment attributes, input skill always matters', () => {
  for (const k of CURVE_KINDS) {
    it(`${k}: monotonic in its attributes, sloppy clearly below good`, () => {
      const good = curve(k, 'good')
      const sloppy = curve(k, 'sloppy')
      const line = `good ${good.map((x) => Math.round(x * 100))} sloppy ${sloppy.map((x) => Math.round(x * 100))}`
      for (let i = 1; i < good.length; i++) expect(good[i]!, line).toBeGreaterThanOrEqual(good[i - 1]! - 0.02)
      // A real spread from attribute 40 to 90 (no plateau) — where physics does not hand a clean ball over anyway.
      if (!CEILING.has(k)) {
        expect(good[good.length - 1]! - good[0]!, line).toBeGreaterThanOrEqual(0.12)
        expect(good[good.length - 1]!, line).toBeLessThan(0.99)
      }
      // Careless input never does better, and is ≥ 20 points worse on average (tackle 14: at 40 both meet the floor
      // of a 40-vs-62 duel — build 9 physics pass; the moment-level check, kindChecks, keeps 20 at every kind).
      // (Within sampling noise: at 40 a tackle is a 40-vs-62 duel either way — both under 10 %.)
      for (let i = 0; i < good.length; i++) expect(sloppy[i]!, line).toBeLessThanOrEqual(good[i]! + 0.03)
      const meanGap = good.reduce((sum, g, i) => sum + g - sloppy[i]!, 0) / good.length
      expect(meanGap, line).toBeGreaterThanOrEqual(k === 'tackle' ? 0.14 : 0.2)
    }, 300_000)
  }

  it('1v1 placed finish follows the stat ~1:1 (Finishing / Composure / Shooting / Curve 50 · 70 · 90)', () => {
    for (const lv of [50, 70, 90]) {
      const r = intentFinishRate(lv, 200)
      const line = `${lv}: ${Math.round(r.rate * 100)} % of ${r.shots} shots`
      expect(r.rate, line).toBeGreaterThanOrEqual(SHOT_BANDS[lv]![0])
      expect(r.rate, line).toBeLessThanOrEqual(SHOT_BANDS[lv]![1])
    }
  }, 600_000)

  it('is deterministic', () => {
    expect(playIntent('shot', 4, 'start')).toEqual(playIntent('shot', 4, 'start'))
  })
})

describe.runIf(ENV.INTENT_REPORT === '1')('intent report', () => {
  it('prints kind × profile (and curves)', () => {
    const n = Number(ENV.INTENT_N ?? 120)
    const kinds = (ENV.INTENT_KINDS ? ENV.INTENT_KINDS.split(',') : INTENT_KINDS) as IntentKind[]
    const lines: string[] = [`| kind | ${PROFILE_KEYS.join(' | ')} |`, `|---|${PROFILE_KEYS.map(() => '---').join('|')}|`]
    for (const k of ENV.INTENT_CURVES === '1' ? [] : kinds) {
      const cells = PROFILE_KEYS.map((p) => {
        const r = intentRate(k, p, n, (ENV.INTENT_INPUT as InputSkill) ?? 'good', (ENV.INTENT_DIFF as never) ?? 'normal', (ENV.INTENT_ASSIST as never) ?? 'half')
        return `${Math.round(r.rate * 100)}%${k.startsWith('shot') ? ` (off ${Math.round(r.offTarget * 100)}%)` : ''}`
      })
      lines.push(`| ${k} | ${cells.join(' | ')} |`)
    }
    if (ENV.INTENT_CURVES === '1') {
      lines.push('', `| kind | input | ${LEVELS.join(' | ')} |`, `|---|---|${LEVELS.map(() => '---').join('|')}|`)
      for (const k of ENV.INTENT_KINDS ? kinds : CURVE_KINDS) {
        for (const input of ['good', 'sloppy'] as InputSkill[]) {
          const cells = LEVELS.map((lv) => `${Math.round(intentRate(k, lv, n, input).rate * 100)}%`)
          lines.push(`| ${k} | ${input} | ${cells.join(' | ')} |`)
        }
      }
    }
    if (ENV.INTENT_LOG) {
      for (let s = 1; s <= 30; s++) {
        const r = playIntent(ENV.INTENT_LOG as IntentKind, s, (ENV.INTENT_PROF as Profile) ?? 'start')
        lines.push(`${s} ${r.outcome} aimY=${r.aimY?.toFixed(2)} hitY=${r.hitY?.toFixed(2)} hitZ=${r.hitZ?.toFixed(2)}`)
      }
    }
    // eslint-disable-next-line no-console
    console.log(`\nN=${n}\n${lines.join('\n')}`)
  }, 3_600_000)
})
