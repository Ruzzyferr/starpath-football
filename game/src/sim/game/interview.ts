/**
 * Post-match flash interview: one question picked from the match context and
 * four answer tones. Each tone has small, readable consequences on the
 * dressing room, the manager, the press, the fans and social reach. Uncertain
 * effects only land with a probability (shown as "?" in the UI preview).
 */
import type { GameState, LText } from '../../core/types'
import { clamp } from '../../core/rng'
import type { Rng } from '../../core/rng'
import { absWeek, fill, lt, meter } from '../career/common'
import { changeRelation } from '../life/relationships'
import { log, withRng } from './internal'

export type InterviewTone = 'humble' | 'bold' | 'critical' | 'deflect'
export const INTERVIEW_TONES: readonly InterviewTone[] = ['humble', 'bold', 'critical', 'deflect']

/** Context of the finished match from the hero's point of view. */
export interface InterviewContext {
  won: boolean
  drew: boolean
  goals: number
  assists: number
  rating: number
  motm: boolean
  started: boolean
  minutes: number
  opponent: string
}

/** What an answer changes. `teammates` hits every teammate; others are single meters/relations. */
export type InterviewEffectKey = 'teammates' | 'manager' | 'press' | 'fans' | 'followers' | 'reputation' | 'managerTrust' | 'discipline' | 'stress' | 'morale'

export interface InterviewEffect {
  key: InterviewEffectKey
  value: number
  /** Probability the effect lands (1 = always). */
  chance: number
}

export interface InterviewOptionDef {
  id: InterviewTone
  tone: InterviewTone
  label: LText
  effects: InterviewEffect[]
}

export interface InterviewDef {
  question: LText
  options: InterviewOptionDef[]
}

const e = (key: InterviewEffectKey, value: number, chance = 1): InterviewEffect => ({ key, value, chance })

type Mood = 'win' | 'draw' | 'loss'
const moodOf = (c: InterviewContext): Mood => (c.won ? 'win' : c.drew ? 'draw' : 'loss')

const QUESTIONS: Record<Mood | 'hero' | 'bench', LText[]> = {
  win: [
    lt('{o} karşısında harika bir galibiyet! Bu akşamın sırrı neydi?', 'A great win over {o}! What was the secret tonight?'),
    lt('Üç puan cebinizde. Takım şu an nasıl bir ruh halinde?', 'Three points in the bag. What is the mood in the camp?'),
  ],
  draw: [
    lt('{o} ile beraberlik. Bir puan mı kazandınız, iki puan mı kaybettiniz?', 'A draw with {o}. One point won or two dropped?'),
    lt('Sahada bir şeyler eksik miydi bu akşam?', 'Was something missing out there tonight?'),
  ],
  loss: [
    lt('{o} karşısında zor bir akşam. Neler ters gitti?', 'A tough night against {o}. What went wrong?'),
    lt('Taraftarlar hayal kırıklığında. Onlara ne söylemek istersin?', 'The fans are disappointed. What do you want to tell them?'),
  ],
  hero: [
    lt('Maçın yıldızı sendin! Bu performansı neye borçlusun?', 'You were the star of the show! What do you owe this performance to?'),
    lt('Herkes senin performansını konuşuyor. Bu formun sırrı ne?', "Everybody is talking about your display. What's behind this form?"),
  ],
  bench: [
    lt('Bu akşam pek süre alamadın. Durumundan memnun musun?', "You didn't get many minutes tonight. Are you happy with your situation?"),
  ],
}

const LABELS: Record<InterviewTone, Record<Mood | 'bench', LText>> = {
  humble: {
    win: lt('"Takım arkadaşlarım olmadan imkânsızdı. Bu galibiyet hepimizin."', '"Impossible without my teammates. This win belongs to all of us."'),
    draw: lt('"Hepimiz elimizden geleni yaptık, bir puana saygı duyuyoruz."', '"We all gave everything; we respect the point."'),
    loss: lt('"Sorumluluk hepimizin. Birlikte daha iyi döneceğiz."', '"We share the responsibility. We will come back stronger together."'),
    bench: lt('"Takım kazandıkça benim için sorun yok, sıramı bekliyorum."', '"As long as the team wins I\'m fine. I\'ll wait for my chance."'),
  },
  bold: {
    win: lt('"Bu ligin en iyisi olacağım. Daha yeni başlıyorum."', '"I\'ll be the best in this league. I\'m only getting started."'),
    draw: lt('"Bana daha çok top gelseydi bu maçı kazanırdık."', '"Give me more of the ball and we win this game."'),
    loss: lt('"Böyle bir maçı kaybetmeyi hak etmedik, ben buraya kazanmaya geldim."', '"We didn\'t deserve to lose. I came here to win things."'),
    bench: lt('"Oynasaydım skor farklı olurdu."', '"Had I played, the score would have been different."'),
  },
  critical: {
    win: lt('"Kazandık ama oyun planı bize hiç uymadı."', '"We won, but the game plan didn\'t suit us at all."'),
    draw: lt('"Hocanın taktiği bize uymadı, bu açık."', '"The manager\'s tactics didn\'t work for us, that\'s clear."'),
    loss: lt('"Hocanın planı bize uymadı. Bir şeylerin değişmesi gerek."', '"The manager\'s plan didn\'t suit us. Something has to change."'),
    bench: lt('"Neden oynamadığımı ben de bilmiyorum, hocaya sorun."', '"I don\'t know why I didn\'t play either. Ask the manager."'),
  },
  deflect: {
    win: lt('"Sıradaki maça odaklanıyoruz, o kadar."', '"We\'re focused on the next game, that\'s all."'),
    draw: lt('"Sıradaki maça odaklanıyoruz."', '"We\'re focused on the next game."'),
    loss: lt('"Bunu konuşmanın yeri burası değil. Sıradaki maça bakıyoruz."', '"This is not the place to discuss it. We look ahead."'),
    bench: lt('"Yorum yok. Antrenmanda çalışmaya devam."', '"No comment. Back to work in training."'),
  },
}

function effectsFor(tone: InterviewTone, c: InterviewContext): InterviewEffect[] {
  const mood = moodOf(c)
  const star = c.motm || c.rating >= 7.5 || c.goals >= 2
  switch (tone) {
    case 'humble':
      return [e('teammates', 3), e('press', 2), ...(star ? [e('reputation', 1)] : [e('morale', 2)])]
    case 'bold':
      return mood === 'win' || star
        ? [e('followers', 0), e('fans', 3), e('managerTrust', -2, 0.5), e('teammates', -1, 0.5)]
        : [e('followers', 0), e('fans', -3), e('managerTrust', -3), e('teammates', -2, 0.6)]
    case 'critical':
      return [e('managerTrust', -7), e('press', 4), e('manager', -6), e('reputation', 1, 0.5), ...(mood === 'loss' ? [e('fans', 2, 0.6)] : [e('teammates', -2)])]
    case 'deflect':
      return [e('discipline', 1), e('press', -1), e('stress', -2)]
  }
}

/** Follower gain of a bold answer: ~1% of followers + a fame-based floor. */
export const boldFollowers = (state: GameState): number => Math.round(state.life.followers * 0.012 + 150 + state.hero.reputation * 15)

/** Build the interview for a finished match (deterministic per match via `rng`). */
export function interviewFor(state: GameState, rng: Rng, c: InterviewContext): InterviewDef {
  const mood = moodOf(c)
  const bench = !c.started && c.minutes < 30
  const pool = bench ? QUESTIONS.bench : (c.motm || c.goals >= 2) ? QUESTIONS.hero : QUESTIONS[mood]
  const question = fill(rng.pick(pool), { o: c.opponent })
  const labelKey = bench ? 'bench' : mood
  return {
    question,
    options: INTERVIEW_TONES.map((tone) => ({
      id: tone,
      tone,
      label: LABELS[tone][labelKey],
      effects: effectsFor(tone, c).map((x) => (x.key === 'followers' ? { ...x, value: boldFollowers(state) } : x)),
    })),
  }
}

export interface InterviewAnswer {
  /** Effects that actually landed (amounts as applied before relation damping). */
  applied: InterviewEffect[]
  lines: LText[]
}

/** Apply a chosen answer. Uses and advances `state.rng`. */
export function answerInterview(state: GameState, def: InterviewDef, tone: InterviewTone): InterviewAnswer {
  const opt = def.options.find((o) => o.tone === tone)
  if (!opt) return { applied: [], lines: [] }
  return withRng(state, (rng) => {
    const { hero: h, life: l } = state
    const week = absWeek(state.calendar)
    const memory = lt('Maç sonu röportajı', 'Post-match interview')
    const applied: InterviewEffect[] = []
    for (const x of opt.effects) {
      if (x.chance < 1 && !rng.chance(x.chance)) continue
      switch (x.key) {
        case 'teammates':
          for (const r of Object.values(l.relationships)) if (r.kind === 'teammate') changeRelation(l, r.id, x.value, { hero: h })
          break
        case 'manager':
        case 'press':
        case 'fans':
          changeRelation(l, x.key, x.value, { hero: h, memory: x.key === 'manager' ? memory : undefined, week })
          break
        case 'followers': l.followers = Math.max(0, Math.round(l.followers + x.value)); break
        case 'reputation': h.reputation = meter(h.reputation + x.value); break
        case 'managerTrust': h.managerTrust = meter(h.managerTrust + x.value); break
        case 'discipline': l.discipline = meter(l.discipline + x.value); break
        case 'stress': l.stress = meter(l.stress + x.value); break
        case 'morale': h.morale = clamp(h.morale + x.value, 0, 100); break
      }
      applied.push(x)
    }
    const lines: LText[] = []
    log(state, lines, fill(lt('Röportaj: {a}', 'Interview: {a}'), { a: opt.label }), 'event', '🎤')
    return { applied, lines }
  })
}
