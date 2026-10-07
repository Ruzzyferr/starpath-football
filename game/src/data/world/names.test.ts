import { COUNTRY_DEFS } from './countries'
import { CITIES, CLUB_PATTERNS, NAME_POOLS, NAME_STYLES, STADIUM_PATTERNS, formatPattern, isRealClubName } from './names'

describe('name data', () => {
  it.each(NAME_STYLES)('%s pool has ≥60 unique first and ≥80 unique last names', (style) => {
    const pool = NAME_POOLS[style]
    expect(new Set(pool.first).size).toBeGreaterThanOrEqual(60)
    expect(new Set(pool.last).size).toBeGreaterThanOrEqual(80)
    expect(new Set(pool.firstFemale).size).toBeGreaterThanOrEqual(60)
    expect(CLUB_PATTERNS[style].length).toBeGreaterThanOrEqual(8)
    expect(STADIUM_PATTERNS[style].length).toBeGreaterThanOrEqual(3)
  })

  it('female and male first-name pools are distinct sets', () => {
    for (const style of NAME_STYLES) {
      const male = new Set(NAME_POOLS[style].first)
      const overlap = NAME_POOLS[style].firstFemale.filter((n) => male.has(n))
      // A few unisex names (Deniz, Alex, Jordan…) are fine; the pools must still read as different.
      expect(overlap.length, `${style}: ${overlap.join(', ')}`).toBeLessThanOrEqual(4)
    }
  })

  it('every country has ≥20 cities, a known name style and 3 league names', () => {
    expect(COUNTRY_DEFS.length).toBeGreaterThanOrEqual(10)
    for (const c of COUNTRY_DEFS) {
      expect(CITIES[c.id]?.length ?? 0).toBeGreaterThanOrEqual(20)
      expect(NAME_STYLES).toContain(c.nameStyle)
      expect(c.leagueNames.length).toBeGreaterThanOrEqual(3)
      expect(c.reputation).toBeGreaterThan(0)
      expect(c.reputation).toBeLessThanOrEqual(100)
      for (const col of c.flag) expect(col).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })

  it('detects real club names regardless of case and diacritics', () => {
    expect(isRealClubName('Real Madrid')).toBe(true)
    expect(isRealClubName('real  madrid')).toBe(true)
    expect(isRealClubName('Atletico Madrid')).toBe(true)
    expect(isRealClubName('Trabzonspor')).toBe(true)
    expect(isRealClubName('Ankara Yıldızspor')).toBe(false)
  })

  it('formats patterns', () => {
    expect(formatPattern('{city} FC', { city: 'York' })).toBe('York FC')
    expect(formatPattern('Stade {surname}', { city: 'Lyon' })).toBe('Stade {surname}')
  })
})
