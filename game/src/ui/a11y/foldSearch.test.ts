import { foldSearch } from './collate'

describe('foldSearch', () => {
  it('matches Turkish letters typed without diacritics', () => {
    expect(foldSearch('Türkiye').includes(foldSearch('tur'))).toBe(true)
    expect(foldSearch('İstanbul')).toBe('istanbul')
    expect(foldSearch('Çağla Işık Şahin Öz')).toBe('cagla isik sahin oz')
    expect(foldSearch('  ESPAÑA ')).toBe('espana')
  })
})
