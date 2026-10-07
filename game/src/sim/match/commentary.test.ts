import { Rng } from '../../core/rng'
import { COMMENTARY_KEYS, commentary, fillTemplate, HIGHLIGHT_PROMPTS, trSuffix, variantCount } from './commentary'

describe('trSuffix (Turkish vowel harmony)', () => {
  it.each([
    ['Arda', 'gen', "Arda'nın"],
    ['Mehmet', 'gen', "Mehmet'in"],
    ['Burak', 'gen', "Burak'ın"],
    ['Onur', 'gen', "Onur'un"],
    ['Ömer', 'gen', "Ömer'in"],
    ['Göktürk', 'gen', "Göktürk'ün"],
    ['Ali', 'gen', "Ali'nin"],
    ['Volkan', 'gen', "Volkan'ın"],
    ['Koray', 'gen', "Koray'ın"],
    ['İlkay', 'gen', "İlkay'ın"],
    ['Işık', 'gen', "Işık'ın"],
    ['Rooney', 'gen', "Rooney'nin"],
    ['Messi', 'gen', "Messi'nin"],
    ['Kenan Yıldız', 'gen', "Kenan Yıldız'ın"],
    ['PSV', 'gen', "PSV'nin"],
    ['Arda', 'dat', "Arda'ya"],
    ['Mehmet', 'dat', "Mehmet'e"],
    ['Onur', 'dat', "Onur'a"],
    ['Ali', 'dat', "Ali'ye"],
    ['Ümit', 'dat', "Ümit'e"],
    ['Altay', 'dat', "Altay'a"],
    ['Arda', 'acc', "Arda'yı"],
    ['Ali', 'acc', "Ali'yi"],
    ['Selçuk', 'acc', "Selçuk'u"],
    ['Ömer', 'acc', "Ömer'i"],
    ['Burak', 'acc', "Burak'ı"],
    ['Göktürk', 'acc', "Göktürk'ü"],
    ['Hulusi', 'acc', "Hulusi'yi"],
    ['Burak', 'loc', "Burak'ta"],
    ['Mehmet', 'loc', "Mehmet'te"],
    ['Arda', 'loc', "Arda'da"],
    ['Fenerbahçe', 'loc', "Fenerbahçe'de"],
    ['Mehmet', 'abl', "Mehmet'ten"],
    ['Arda', 'abl', "Arda'dan"],
    ['Hakan', 'abl', "Hakan'dan"],
    ['Arda', 'ins', "Arda'yla"],
    ['Mehmet', 'ins', "Mehmet'le"],
  ] as const)('%s + %s → %s', (name, kind, expected) => {
    expect(trSuffix(name, kind)).toBe(expected)
  })

  it('returns empty input untouched', () => {
    expect(trSuffix('', 'gen')).toBe('')
  })
})

describe('fillTemplate', () => {
  it('applies Turkish case markers', () => {
    expect(fillTemplate('{player:gen} şutu, {gk:dat} çarptı', { player: 'Arda', gk: 'Uğurcan' }, 'tr')).toBe("Arda'nın şutu, Uğurcan'a çarptı")
  })
  it('renders English possessives', () => {
    expect(fillTemplate("{player:gen} shot", { player: 'Jones' }, 'en')).toBe("Jones' shot")
    expect(fillTemplate("{player:gen} shot", { player: 'Kane' }, 'en')).toBe("Kane's shot")
    expect(fillTemplate("to {player:dat}", { player: 'Kane' }, 'en')).toBe('to Kane')
  })
})

describe('commentary banks', () => {
  const minimums: Record<string, number> = {
    goal: 15, save: 8, miss: 8, chance: 8, yellow: 8, red: 8, secondYellow: 8, injury: 8, sub: 8,
    blocked: 8, woodwork: 8, corner: 8, freekick: 8, offside: 8, penaltyGoal: 8, penaltyMiss: 8,
    heroIgnored: 8, goalAssist: 8,
  }
  it.each(Object.entries(minimums))('%s has at least %i variants in both languages', (key, min) => {
    expect(variantCount(key as never, 'tr')).toBeGreaterThanOrEqual(min)
    expect(variantCount(key as never, 'en')).toBeGreaterThanOrEqual(min)
  })

  it('every template fills completely with no leftover placeholders', () => {
    const rng = new Rng(1)
    const vars = { player: 'Arda', assist: 'Kerem', team: 'Yıldızspor', opp: 'Kartal FK', gk: 'Uğurcan', hero: 'Can', passer: 'Emre', score: '1-0', out: 'Ozan' }
    for (const key of COMMENTARY_KEYS) {
      for (const lang of ['tr', 'en'] as const) {
        for (let i = 0; i < variantCount(key, lang) * 4; i++) {
          const line = commentary(key, lang, vars, rng)
          expect(line).not.toMatch(/[{}]/)
          expect(line.length).toBeGreaterThan(5)
        }
      }
    }
  })

  it('has a prompt for every highlight kind in both languages', () => {
    for (const p of Object.values(HIGHLIGHT_PROMPTS)) {
      expect(p.tr.length).toBeGreaterThan(5)
      expect(p.en.length).toBeGreaterThan(5)
    }
  })
})

describe('trSuffix with digits', () => {
  it.each([
    ['Forvet 2', 'dat', "Forvet 2'ye"],
    ['A3', 'gen', "A3'ün"],
    ['B9', 'acc', "B9'u"],
    ['C6', 'loc', "C6'da"],
    ['D4', 'abl', "D4'ten"],
  ] as const)('%s + %s → %s', (name, kind, expected) => {
    expect(trSuffix(name, kind)).toBe(expected)
  })
})
