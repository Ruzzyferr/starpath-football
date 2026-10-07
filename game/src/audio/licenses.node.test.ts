import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const found = Object.keys({
  ...import.meta.glob('/public/**/*.{mp3,ogg,wav,flac,m4a,aac,opus,webm}', { query: '?url' }),
  ...import.meta.glob('/src/**/*.{mp3,ogg,wav,flac,m4a,aac,opus,webm}', { query: '?url' }),
  ...import.meta.glob('/assets/**/*.{mp3,ogg,wav,flac,m4a,aac,opus,webm}', { query: '?url' }),
}).map((p) => p.slice(1))
const ALLOWED = /^(CC0|CC-BY-4\.0|CC-BY-3\.0|MIT|Public Domain|Original work.*)$/

function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((l) => (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? []).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '')).slice(0, 6))
}

describe('audio asset licenses (2.8#56/#57)', () => {
  const rows = parseCsv(readFileSync(new URL('../../assets/LICENSES.csv', import.meta.url), 'utf8'))
  it('has a well-formed row for every entry with an allowed license', () => {
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r.length).toBe(6)
      expect(r[0] && r[3] && r[4]).toBeTruthy()
      expect(r[3]).toMatch(ALLOWED)
    }
  })
  it('every audio file under public/, src/ or assets/ is listed', () => {
    const listed = new Set(rows.map((r) => r[0]))
    expect(found.filter((f) => !listed.has(f))).toEqual([])
  })
})
