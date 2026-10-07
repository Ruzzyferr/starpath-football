import { describe, expect, it } from 'vitest'
import { Rng } from '../../../core/rng'
import { commentary, fillTemplate, resolveGenderAlt } from '../../match/commentary'
import { formatText, resolveGender, standardVars } from './engine'
import { makeTestState } from './testFixture'

describe('gender alternatives in event text', () => {
  const tx = { tr: '{g:Oğlum|Kızım}, {heroName}!', en: '"{rivalPlayer}? {g:He|She} won\'t pass {g:him|her}."' }

  it('resolves {g:male|female} per hero gender, defaulting to male', () => {
    expect(resolveGender('{g:his|her} boots', 'female')).toBe('her boots')
    expect(resolveGender('{g:his|her} boots', 'male')).toBe('his boots')
    expect(resolveGender('{g:his|her} boots', undefined)).toBe('his boots')
    expect(formatText(tx, { heroName: 'Ece', heroGender: 'female' }, 'tr')).toBe('Kızım, Ece!')
    expect(formatText(tx, { heroName: 'Ali' }, 'tr')).toBe('Oğlum, Ali!')
    expect(formatText(tx, { rivalPlayer: 'Lena Novak', heroGender: 'female' }, 'en')).toBe('"Lena Novak? She won\'t pass her."')
  })

  it('exposes heroGender as a standard var', () => {
    expect(standardVars(makeTestState(), new Rng(1)).heroGender).toBe('male')
    expect(standardVars(makeTestState({ gender: 'female' }), new Rng(1)).heroGender).toBe('female')
  })

  it('leaves alternatives that are not two-way untouched (caught by content tests)', () => {
    expect(resolveGender('{g:only}', 'female')).toBe('{g:only}')
  })
})

describe('gender alternatives in match commentary', () => {
  it('fills commentary pronouns for the world gender', () => {
    expect(fillTemplate('{player} sinks to {g:his|her} knees.', { player: 'Mira' }, 'en', 'female')).toBe('Mira sinks to her knees.')
    expect(fillTemplate('{player} sinks to {g:his|her} knees.', { player: 'Ali' }, 'en')).toBe('Ali sinks to his knees.')
    expect(resolveGenderAlt('{g:a|b}', 'female')).toBe('b')
    for (let i = 0; i < 20; i++) {
      const s = commentary('ownGoal', 'en', { player: 'X', score: '1-0', team: 'T', opp: 'O' }, new Rng(i), 'female')
      expect(s).not.toMatch(/\{g:|\bhis\b/)
    }
  })
})
