import { describe, expect, it } from 'vitest'
import { makeGame } from './testHelpers'
import {
  answerInterview, interviewQuestions, interviewSession, IV_BUZZ_FLAG, IV_CAP, preMatchQuestions, pressConferenceQuestions,
  type InterviewReport, type Question,
} from './interview'

const LOSS_HAT: InterviewReport = { won: false, drew: false, goals: 3, assists: 0, rating: 8.7, motm: true, started: true, minutes: 90, opponent: 'Liman FK', key: 'fx1' }
const POOR: InterviewReport = { won: false, drew: false, goals: 0, assists: 0, rating: 5.1, motm: false, started: true, minutes: 90, opponent: 'Liman FK', key: 'fx2' }
const UNRESOLVED = /\{\w+\}/

function checkQuestions(qs: Question[]): void {
  expect(qs).toHaveLength(3)
  expect(new Set(qs.map((q) => q.topic)).size).toBe(3)
  for (const q of qs) {
    expect(q.text.tr).not.toMatch(UNRESOLVED)
    expect(q.text.en).not.toMatch(UNRESOLVED)
    expect(q.journalist.outlet.length).toBeGreaterThan(0)
    expect(q.options.length).toBeGreaterThanOrEqual(3)
    for (const o of q.options) {
      expect(o.label.tr).not.toBe(o.label.en)
      expect(o.quote.tr.length).toBeGreaterThan(0)
      expect(o.quote.en.length).toBeGreaterThan(0)
    }
  }
}

describe('3-question interviews', () => {
  it('post-match: three distinct, bilingual, context-aware questions; deterministic per match', () => {
    const s = makeGame(21)
    const qs = interviewQuestions(s, LOSS_HAT)
    checkQuestions(qs)
    // The hero carried a losing team: the loaded "did your teammates let you down?" question comes first.
    expect(qs[0]!.topic).toBe('teammates_blame')
    expect(qs[0]!.trap).toBe(true)
    const again = interviewQuestions(s, LOSS_HAT)
    expect(again.map((q) => q.id)).toEqual(qs.map((q) => q.id))
  })

  it('reacts to transfer rumours and a manager dispute', () => {
    const s = makeGame(22)
    s.life.flags[IV_BUZZ_FLAG] = 5
    s.hero.managerTrust = 20
    const topics = new Set<string>()
    for (let i = 0; i < 12; i++) for (const q of interviewQuestions(s, { ...POOR, key: `k${i}` })) topics.add(q.topic)
    expect(topics.has('transfer')).toBe(true)
    expect(topics.has('manager_dispute')).toBe(true)
  })

  it('answers apply consequences, record the cause, and the last answer prints a headline', () => {
    const s = makeGame(23)
    const qs = interviewQuestions(s, LOSS_HAT)
    const mates = Object.values(s.life.relationships).filter((r) => r.kind === 'teammate')
    const before = mates.reduce((a, r) => a + r.value, 0)
    const shield = qs[0]!.options.find((o) => o.tone === 'humble')!
    const r1 = answerInterview(s, qs[0]!.id, shield.id)
    expect(r1.done).toBe(false)
    expect(mates.reduce((a, r) => a + r.value, 0)).toBeGreaterThan(before)
    expect(mates[0]!.log?.[0]!.cause).toBe('interview')
    // Answering twice is a no-op.
    expect(answerInterview(s, qs[0]!.id, shield.id).applied).toEqual([])
    const news0 = s.life.news.length
    answerInterview(s, qs[1]!.id, qs[1]!.options[0]!.id)
    const last = answerInterview(s, qs[2]!.id, qs[2]!.options.find((o) => o.tone !== 'deflect')!.id)
    expect(last.done).toBe(true)
    expect(last.headline?.en.length).toBeGreaterThan(5)
    expect(s.life.news.length).toBe(news0 + 1)
    expect(s.life.news[s.life.news.length - 1]!.headline).toEqual(last.headline)
    expect(interviewSession(s)?.headline).toEqual(last.headline)
  })

  it('the trap answer backfires on the dressing room', () => {
    const s = makeGame(24)
    const qs = interviewQuestions(s, LOSS_HAT)
    const mates = Object.values(s.life.relationships).filter((r) => r.kind === 'teammate')
    const before = mates.reduce((a, r) => a + r.value, 0)
    const blame = qs[0]!.options.find((o) => o.tone === 'critical')!
    answerInterview(s, qs[0]!.id, blame.id)
    expect(mates.reduce((a, r) => a + r.value, 0)).toBeLessThan(before)
  })

  it('positive fan effects are capped by the rating', () => {
    const good = makeGame(25)
    const bad = makeGame(25)
    const gain = (s: ReturnType<typeof makeGame>, r: InterviewReport): number => {
      const f0 = s.life.relationships.fans!.value
      for (const q of interviewQuestions(s, r)) {
        const best = [...q.options].sort((a, b) => (b.effects.find((e) => e.key === 'fans')?.value ?? -99) - (a.effects.find((e) => e.key === 'fans')?.value ?? -99))[0]!
        answerInterview(s, q.id, best.id)
      }
      return s.life.relationships.fans!.value - f0
    }
    const g = gain(good, { ...LOSS_HAT, won: true, key: 'cap1' })
    const b = gain(bad, { ...POOR, won: true, key: 'cap1' })
    expect(g).toBeLessThanOrEqual(IV_CAP.fans)
    expect(b).toBeLessThan(g)
  })

  it('pre-match and weekly press conference sessions', () => {
    const s = makeGame(26)
    checkQuestions(preMatchQuestions(s, { opponent: 'Atlas United', key: 'pre1' }))
    expect(interviewSession(s)?.kind).toBe('pre')
    const pc = pressConferenceQuestions(s)
    expect(pc).not.toBeNull()
    checkQuestions(pc!)
    for (const q of pc!) answerInterview(s, q.id, q.options[0]!.id)
    expect(pressConferenceQuestions(s)).toBeNull()
  })

  it('transfer answers fuel or cool the rumour mill', () => {
    const s = makeGame(27)
    s.life.flags[IV_BUZZ_FLAG] = 4
    let qs: Question[] = []
    for (let i = 0; i < 20 && !qs.some((q) => q.topic === 'transfer'); i++) qs = interviewQuestions(s, { ...POOR, key: `t${i}` })
    const q = qs.find((x) => x.topic === 'transfer')!
    answerInterview(s, q.id, q.options.find((o) => o.tone === 'bold')!.id)
    expect(s.life.flags[IV_BUZZ_FLAG]).toBe(7)
  })
})
