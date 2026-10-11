/**
 * All-kinds matrix report (owner, build 8). Gated: KIND_MATRIX=1 npx vitest run src/game/kindMatrix.test.ts --silent=false
 * (KIND_MATRIX_N=40 per cell, KIND_MATRIX_KINDS=one_on_one,defend to narrow). Pinned bands live in balance8.test.ts.
 */
import { describe, it } from 'vitest'
import { MATRIX_KINDS, MATRIX_LEVELS, matrixRates, type MatrixInput, type OppStrength } from './kindMatrix'
import { GOAL_KINDS } from '../sim/match/tier'
import type { FeelKind } from './feelHarness'

const ENV = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

describe.runIf(ENV.KIND_MATRIX === '1')('all-kinds matrix report', () => {
  it('prints one matrix per kind', () => {
    const n = Number(ENV.KIND_MATRIX_N ?? 40)
    const kinds = (ENV.KIND_MATRIX_KINDS ? ENV.KIND_MATRIX_KINDS.split(',') : MATRIX_KINDS) as FeelKind[]
    const pct = (x: number) => `${Math.round(x * 100)}`
    for (const k of kinds) {
      const lines = [`#### ${k}`, '', `| girdi / rakip | başlangıç | ${MATRIX_LEVELS.join(' | ')} |`, `|---|---|${MATRIX_LEVELS.map(() => '---').join('|')}|`]
      for (const input of ['good', 'sloppy'] as MatrixInput[]) {
        for (const opp of ['weak', 'average', 'strong'] as OppStrength[]) {
          const cells = [matrixRates(k, null, input, opp, n), ...MATRIX_LEVELS.map((lv) => matrixRates(k, lv, input, opp, n))]
          // Goal-oriented kinds: success (full + partial) and, in brackets, goals.
          const cell = (c: { success: number; full: number }) => (GOAL_KINDS.has(k) ? `${pct(c.success)} (${pct(c.full)})` : pct(c.success))
          lines.push(`| ${input === 'good' ? 'iyi' : 'özensiz'} / ${opp === 'weak' ? 'zayıf' : opp === 'average' ? 'orta' : 'güçlü'} | ${cells.map(cell).join(' | ')} |`)
        }
      }
      console.log(`\nMATRIX\n${lines.join('\n')}\n`)
    }
  }, 7_200_000)
})
