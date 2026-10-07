import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import { makeGame } from './testHelpers'
import { answerInterview, interviewFor, INTERVIEW_TONES, type InterviewContext } from './interview'

const CTX: InterviewContext = { won: true, drew: false, goals: 1, assists: 0, rating: 7.1, motm: false, started: true, minutes: 90, opponent: 'Rival FK' }

describe('post-match interview', () => {
  it('offers four bilingual tones with the opponent in the question', () => {
    const s = makeGame(7)
    const def = interviewFor(s, new Rng(1), { ...CTX, won: false, drew: false })
    expect(def.options.map((o) => o.tone)).toEqual([...INTERVIEW_TONES])
    expect(def.question.tr.length).toBeGreaterThan(5)
    expect(def.question.en).not.toMatch(/\{/)
    for (const o of def.options) {
      expect(o.label.tr).not.toBe(o.label.en)
      expect(o.effects.length).toBeGreaterThan(0)
    }
  })

  it('benched heroes get the bench question', () => {
    const s = makeGame(7)
    const def = interviewFor(s, new Rng(2), { ...CTX, started: false, minutes: 10 })
    expect(def.question.en).toMatch(/minutes/)
  })

  it('humble answers warm the dressing room, critical ones cost manager trust', () => {
    const s = makeGame(9)
    const mates = Object.values(s.life.relationships).filter((r) => r.kind === 'teammate')
    const before = mates.reduce((a, r) => a + r.value, 0)
    const def = interviewFor(s, new Rng(3), CTX)
    const r = answerInterview(s, def, 'humble')
    expect(r.applied.some((x) => x.key === 'teammates')).toBe(true)
    expect(Object.values(s.life.relationships).filter((x) => x.kind === 'teammate').reduce((a, x) => a + x.value, 0)).toBeGreaterThan(before)

    const trust = s.hero.managerTrust
    answerInterview(s, def, 'critical')
    expect(s.hero.managerTrust).toBeLessThan(trust)
  })

  it('bold answers grow followers', () => {
    const s = makeGame(11)
    const f = s.life.followers
    const def = interviewFor(s, new Rng(4), { ...CTX, motm: true })
    answerInterview(s, def, 'bold')
    expect(s.life.followers).toBeGreaterThan(f)
  })
})
