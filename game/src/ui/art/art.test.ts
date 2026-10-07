import { describe, expect, it } from 'vitest'
import type { Appearance, CrestSpec, KitColors } from '../../core/types'
import { ACCESSORY_COUNT, avatarSvg, BEARD_COUNT, EYE_COLORS, FACE_COUNT, FEMALE_HAIR_STYLE_COUNT, HAIR_COLORS, HAIR_STYLE_COUNT, SKIN_TONES, hairStyleCount } from './avatar'
import { CREST_SYMBOL_COUNT, crestSvg } from './crest'
import { kitSvg } from './kit'
import { flagSvg } from './flag'
import { contrastRatio, onColor } from './svg'

const base: Appearance = { skin: 3, hairStyle: 2, hairColor: 1, beard: 0, eyeColor: 2, face: 1, accessory: 0 }
const crest: CrestSpec = { shape: 'shield', symbol: 7, colors: ['#c8102e', '#ffffff', '#0b1220'], initials: 'BSK' }

/** Cheap well-formedness check: balanced open/close tags, no NaN/undefined leaks. */
function wellFormed(svg: string): boolean {
  if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) return false
  const open = (svg.match(/<(?!\/)[a-zA-Z][^>]*[^/]>/g) ?? []).length
  const close = (svg.match(/<\/[a-zA-Z]+>/g) ?? []).length
  return open === close && !svg.includes('NaN') && !svg.includes('undefined')
}

describe('avatar', () => {
  it('has enough variety', () => {
    expect(SKIN_TONES.length).toBeGreaterThanOrEqual(8)
    expect(HAIR_STYLE_COUNT).toBeGreaterThanOrEqual(10)
    expect(BEARD_COUNT).toBeGreaterThanOrEqual(5)
    expect(FACE_COUNT).toBeGreaterThanOrEqual(4)
    expect(HAIR_COLORS.length).toBeGreaterThanOrEqual(8)
    expect(EYE_COLORS.length).toBeGreaterThanOrEqual(5)
  })
  it('is deterministic', () => {
    expect(avatarSvg(base)).toBe(avatarSvg({ ...base }))
    expect(avatarSvg(base, { shirt: '#ff0000', mood: 1 })).toBe(avatarSvg(base, { shirt: '#ff0000', mood: 1 }))
  })
  it('renders every hair style, beard, face and accessory as distinct well-formed SVG', () => {
    const seen = new Set<string>()
    for (let h = 0; h < HAIR_STYLE_COUNT; h++) seen.add(avatarSvg({ ...base, hairStyle: h }))
    expect(seen.size).toBe(HAIR_STYLE_COUNT)
    const beards = new Set<string>()
    for (let b = 0; b < BEARD_COUNT; b++) beards.add(avatarSvg({ ...base, beard: b }))
    expect(beards.size).toBe(BEARD_COUNT)
    for (let f = 0; f < FACE_COUNT; f++) expect(wellFormed(avatarSvg({ ...base, face: f, beard: f }))).toBe(true)
    for (let a = 0; a < ACCESSORY_COUNT; a++) {
      expect(wellFormed(avatarSvg({ ...base, accessory: a, hairStyle: a + 4 }, { background: '#1b2740', age: 36 }))).toBe(true)
    }
  })
  it('tolerates out-of-range indices', () => {
    expect(wellFormed(avatarSvg({ skin: 99, hairStyle: -3, hairColor: 50, beard: 77, eyeColor: -1, face: 12, accessory: 9 }))).toBe(true)
  })
})

describe('avatar gender', () => {
  const fem: Appearance = { ...base, gender: 'female' }
  it('male output is unchanged with or without an explicit male gender', () => {
    expect(avatarSvg({ ...base, gender: 'male' })).toBe(avatarSvg(base))
    expect(avatarSvg(base, { gender: 'male' })).toBe(avatarSvg(base))
  })
  it('has a distinct, well-formed female hair set', () => {
    expect(FEMALE_HAIR_STYLE_COUNT).toBeGreaterThanOrEqual(10)
    expect(hairStyleCount('female')).toBe(FEMALE_HAIR_STYLE_COUNT)
    expect(hairStyleCount(undefined)).toBe(HAIR_STYLE_COUNT)
    const seen = new Set<string>()
    for (let h = 0; h < FEMALE_HAIR_STYLE_COUNT; h++) {
      const svg = avatarSvg({ ...fem, hairStyle: h }, { background: '#1b2740' })
      expect(wellFormed(svg)).toBe(true)
      seen.add(svg)
    }
    expect(seen.size).toBe(FEMALE_HAIR_STYLE_COUNT)
  })
  it('never draws a beard on a female face and differs from the male face', () => {
    expect(avatarSvg({ ...fem, beard: 5 })).toBe(avatarSvg({ ...fem, beard: 0 }))
    expect(avatarSvg(fem)).not.toBe(avatarSvg(base))
    expect(avatarSvg(base, { gender: 'female' })).toBe(avatarSvg(fem))
  })
  it('female accessories and odd indices stay well-formed', () => {
    for (let a = 0; a < ACCESSORY_COUNT; a++) expect(wellFormed(avatarSvg({ ...fem, accessory: a, hairStyle: a * 2 }, { age: 36 }))).toBe(true)
    expect(wellFormed(avatarSvg({ ...fem, hairStyle: -7, face: 40 }))).toBe(true)
  })
})

describe('crest', () => {
  it('has at least 12 symbols, each distinct', () => {
    expect(CREST_SYMBOL_COUNT).toBeGreaterThanOrEqual(12)
    const set = new Set<string>()
    for (let s = 0; s < CREST_SYMBOL_COUNT; s++) set.add(crestSvg({ ...crest, symbol: s }))
    expect(set.size).toBe(CREST_SYMBOL_COUNT)
  })
  it('is deterministic and well-formed for every shape', () => {
    for (const shape of ['shield', 'circle', 'diamond', 'hexagon', 'banner'] as const) {
      const a = crestSvg({ ...crest, shape }, { stars: 2 })
      expect(a).toBe(crestSvg({ ...crest, shape }, { stars: 2 }))
      expect(wellFormed(a)).toBe(true)
    }
  })
  it('escapes initials', () => {
    expect(crestSvg({ ...crest, initials: '<&>' })).not.toContain('<&>')
  })
})

describe('kit & flag', () => {
  it('renders all kit patterns', () => {
    const pats: KitColors['pattern'][] = ['plain', 'stripes', 'hoops', 'halves', 'sash', 'chevron']
    const set = new Set(pats.map((p) => kitSvg({ primary: '#0033aa', secondary: '#ffd200', pattern: p }, { number: 10 })))
    expect(set.size).toBe(pats.length)
    for (const s of set) expect(wellFormed(s)).toBe(true)
  })
  it('flags are deterministic', () => {
    expect(flagSvg('TR', ['#e30a17', '#ffffff', '#e30a17'])).toBe(flagSvg('TR', ['#e30a17', '#ffffff', '#e30a17']))
  })
})

describe('colour helpers', () => {
  it('picks readable text colour', () => {
    expect(onColor('#ffffff')).toBe('#0b1220')
    expect(onColor('#0b1220')).toBe('#ffffff')
    expect(contrastRatio('#f2f5fa', '#131c2e')).toBeGreaterThan(4.5)
  })
})

describe('scopeSvgIds', () => {
  it('suffixes every def id and its references, leaving hex colours alone', async () => {
    const { scopeSvgIds } = await import('./svg')
    const html = avatarSvg({ skin: 2, hairStyle: 3, hairColor: 1, beard: 0, eyeColor: 1, face: 1, accessory: 0 }, { background: '#24345a' })
    const out = scopeSvgIds(html, 'z9')
    const ids = [...out.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) expect(id.endsWith('-z9')).toBe(true)
    for (const m of out.matchAll(/url\(#([^)]+)\)/g)) expect(ids).toContain(m[1])
    expect(out.includes('#fff')).toBe(html.includes('#fff'))
  })
})
