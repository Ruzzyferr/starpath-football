import { afterEach, describe, expect, it } from 'vitest'
import { baseLang, currentLang, detectLocale, isLocale, loc, locale, lt, setLocale } from './index'

afterEach(() => setLocale('tr'))

describe('detectLocale', () => {
  it('picks the first device language the game has', () => {
    expect(detectLocale(['de-AT', 'en-US'])).toBe('de')
    expect(detectLocale(['pt-BR'])).toBe('pt')
    expect(detectLocale(['tr-TR'])).toBe('tr')
    expect(detectLocale(['in-ID'])).toBe('id')
  })
  it('falls back to English, never to Turkish', () => {
    expect(detectLocale(['ja-JP', 'ko-KR'])).toBe('en')
    expect(detectLocale([])).toBe('en')
  })
})

describe('setLocale', () => {
  it('runs every non-Turkish language on the English code text', () => {
    expect(baseLang('es')).toBe('en')
    expect(baseLang('tr')).toBe('tr')
    setLocale('es')
    expect(currentLang.value).toBe('en')
    expect(locale()).toBe('es-ES')
  })
  it('shows English while an overlay has no entry', () => {
    setLocale('en')
    expect(loc('Play')).toBe('Play')
    expect(lt({ tr: 'Oyna', en: 'Play' })).toBe('Play')
    setLocale('tr')
    expect(lt({ tr: 'Oyna', en: 'Play' })).toBe('Oyna')
  })
  it('knows its locales', () => {
    expect(isLocale('fr')).toBe(true)
    expect(isLocale('xx')).toBe(false)
  })
})
