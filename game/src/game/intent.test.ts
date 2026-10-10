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
import { CURVE_KINDS, INTENT_KINDS, LEVELS, PROFILE_KEYS, intentRate, playIntent, type InputSkill, type IntentKind, type Profile } from './intentHarness'

/** Env access without Node typings (the app tsconfig has no @types/node). */
const ENV = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

/** Starting hero (OVR 57), good input: the playtester targets. */
const START_MIN: Partial<Record<IntentKind, number>> = { shot: 0.65, shotBtn: 0.65, pass: 0.85, passRun: 0.7, through: 0.65, cross: 0.6, tackle: 0.55 }

/** 1v1 to a corner by Finishing-group level (owner: ~55–65 % at 50, ~75 % at 70, ~88 % at 90). */
const SHOT_BANDS: Record<number, [number, number]> = { 50: [0.55, 0.7], 70: [0.7, 0.84], 90: [0.82, 0.95] }

const N = 150
const curve = (k: IntentKind, input: InputSkill) => LEVELS.map((lv) => intentRate(k, lv, N, input).rate)

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
    it(`${k}: monotonic in its attributes, sloppy ≥ 20 pts below good at every level`, () => {
      const good = curve(k, 'good')
      const sloppy = curve(k, 'sloppy')
      for (let i = 1; i < good.length; i++) expect(good[i]!).toBeGreaterThanOrEqual(good[i - 1]! - 0.005)
      // A real spread from attribute 40 to 90 (no plateau), and never pinned at 100 %.
      expect(good[good.length - 1]! - good[0]!).toBeGreaterThanOrEqual(0.12)
      expect(good[good.length - 1]!).toBeLessThan(0.99)
      for (let i = 0; i < good.length; i++) expect(good[i]! - sloppy[i]!).toBeGreaterThanOrEqual(0.2)
    }, 300_000)
  }

  it('1v1 corner finish lands in the owner bands (Finishing / Composure / Shooting / Curve 50 · 70 · 90)', () => {
    for (const lv of [50, 70, 90]) {
      const r = intentRate('shot', lv, 200).rate
      expect(r).toBeGreaterThanOrEqual(SHOT_BANDS[lv]![0])
      expect(r).toBeLessThanOrEqual(SHOT_BANDS[lv]![1])
    }
  }, 300_000)

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
