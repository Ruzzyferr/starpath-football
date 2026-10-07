import { describe, expect, it } from 'vitest'
import { reinflect, replaceWithSuffix } from './trSuffix'
import { fill } from './common'
import { formatText } from '../life/events/engine'

describe('Turkish suffixes after placeholders', () => {
  it('re-inflects case suffixes for the substituted name', () => {
    expect(reinflect('İstanbul', 'de')).toBe('da')
    expect(reinflect('Efe', 'in')).toBe('nin')
    expect(reinflect('Rui Costa Neto', 'ı')).toBe('yu')
    expect(reinflect('Ayşe', 'e')).toBe('ye')
    expect(reinflect('Elif', 'dan')).toBe('ten')
    expect(reinflect('Can', 'in')).toBe('ın')
    expect(reinflect('München', 'daki')).toBe('deki')
    expect(reinflect('Kerem', 'ların')).toBeNull()
  })
  it('fill() and event formatText fix suffixes in Turkish only', () => {
    const t = { tr: "{n}'ın golü, {c}'de", en: "{n}'s goal in {c}" }
    expect(fill(t, { n: 'Efe', c: 'İstanbul' }).tr).toBe("Efe'nin golü, İstanbul'da")
    expect(fill(t, { n: 'Efe', c: 'İstanbul' }).en).toBe("Efe's goal in İstanbul")
    expect(formatText({ tr: "{agentName}'ı ara, {amount:money} öde", en: '' }, { agentName: 'Sarah Whitfield', amount: 1000 }, 'tr')).toBe("Sarah Whitfield'i ara, 1.000 € öde")
    expect(replaceWithSuffix("{x}'ye", () => ({ text: 'Marco', isName: true }))).toBe("Marco'ya")
  })
})
