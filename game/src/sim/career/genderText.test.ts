/**
 * 2.3#10: every match commentary line is rendered with both genders; a
 * female world never reads "he/him/his" about a player and a male world never
 * reads "she/her" (NSS's commentator saying "he" about a female player).
 */
import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import { COMMENTARY_KEYS, commentary, variantCount } from '../match/commentary'

const VARS = { player: 'Ada', assist: 'Ece', team: 'Kırmızılar', opp: 'Maviler', gk: 'Lale', hero: 'Ada', passer: 'Ece', score: '1-0', minute: 63, out: 'Zeynep' }
const HE = /\b(he|him|his|himself)\b/i
const SHE = /\b(she|her|hers|herself)\b/i
/** Officials keep fixed wording: drop the clause about the referee/manager before checking. */
const players = (s: string): string => s.replace(/\b(referee|ref|manager|coach|boss|linesman|official)\b[^.:!?]*/gi, '')

describe('commentary pronouns render for both genders (2.3#10)', () => {
  it('covers every key and every variant without wrong-gender pronouns (EN) and without leftover {g:} markers', () => {
    let lines = 0
    for (const key of COMMENTARY_KEYS) {
      for (const lang of ['en', 'tr'] as const) {
        const seen = new Set<string>()
        const n = variantCount(key, lang)
        for (let seed = 0; seed < n * 25 && seen.size < n; seed++) {
          const f = commentary(key, lang, VARS, new Rng(seed), 'female')
          const m = commentary(key, lang, VARS, new Rng(seed), 'male')
          seen.add(m)
          lines++
          expect(f).not.toMatch(/\{g:/)
          expect(m).not.toMatch(/\{g:/)
          if (lang === 'en') {
            expect(players(f), `${key}: ${f}`).not.toMatch(HE)
            expect(players(m), `${key}: ${m}`).not.toMatch(SHE)
          }
        }
      }
    }
    expect(lines).toBeGreaterThan(COMMENTARY_KEYS.length * 2)
  })
})
