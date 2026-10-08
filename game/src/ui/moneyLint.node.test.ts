/**
 * 2.5#2 "no price without a currency symbol": money-looking values in UI
 * components must go through formatMoney / <Money>, never raw number
 * formatters. Fails the build when a price-like identifier is passed to
 * formatNumber, formatCompact or toLocaleString.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname)
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx$/.test(n)) out.push(p)
  }
  return out
}

const PRICE_WORDS = /\b(price|cost|fee|salary|wage|rent|upkeep|balance|payout|stake|bet|bonus|bankroll|savings)\b/i
const RAW = /(formatNumber|formatCompact|toLocaleString)\(([^)]*)\)/g

describe('currency symbol lint (2.5#2)', () => {
  it('no price-like value is printed with a raw number formatter', () => {
    const bad: string[] = []
    for (const f of walk(root)) {
      const lines = readFileSync(f, 'utf8').split(/\r?\n/)
      lines.forEach((line, i) => {
        for (const m of line.matchAll(RAW)) if (PRICE_WORDS.test(m[2]) || PRICE_WORDS.test(line.slice(0, m.index).split('>').pop() ?? '')) bad.push(`${f.slice(root.length + 1)}:${i + 1}: ${line.trim().slice(0, 100)}`)
      })
    }
    expect(bad).toEqual([])
  })
})
