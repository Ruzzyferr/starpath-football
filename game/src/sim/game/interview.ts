/**
 * Post-match flash interview: one question picked from the match context and
 * four answer tones. Each tone has small, readable consequences on the
 * dressing room, the manager, the press, the fans and social reach. Uncertain
 * effects only land with a probability (shown as "?" in the UI preview).
 */
import type { GameState, LText } from '../../core/types'
import { Rng, clamp, hashString } from '../../core/rng'
import { absWeek, fill, lt, meter, pushNews } from '../career/common'
import { changeRelation } from '../life/relationships'
import { log, readJson, withRng, writeJson } from './internal'
import { getOffers } from './season'

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

/** Apply a chosen v1 answer. Uses and advances `state.rng`. */
function answerInterviewV1(state: GameState, def: InterviewDef, tone: InterviewTone): InterviewAnswer {
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
          for (const r of Object.values(l.relationships)) if (r.kind === 'teammate') changeRelation(l, r.id, x.value, { hero: h, week, cause: 'interview', why: memory })
          break
        case 'manager':
        case 'press':
        case 'fans':
          changeRelation(l, x.key, x.value, { hero: h, memory: x.key === 'manager' ? memory : undefined, week, cause: 'interview' })
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

// ═════════════════════════ 3-question interviews (v2) ═════════════════════════
//
// Post-match flash interviews, pre-match interviews and press conferences are
// a session of three context-aware questions, each asked by a (fictional)
// journalist with a personality. Answers have consequences (relations, trust,
// followers, rumour heat) whose positive side is capped by how well the hero
// actually played, and the most quotable answer becomes a headline.
//
// Stable API for the post-match UI (owned by the match screen):
//   interviewQuestions(state, matchReport) → Question[]
//   answerInterview(state, questionId, optionId) → InterviewAnswerV2
// The session lives in `life.flags['iv:session']` (plain JSON), so a reload
// mid-interview resumes where it was.

export type InterviewKind = 'post' | 'pre' | 'press'
export type JournalistStyle = 'tabloid' | 'analyst' | 'friendly' | 'provocateur' | 'veteran'
export type AnswerTone = InterviewTone | 'joke'
export type QuestionTopic =
  | 'result' | 'hero' | 'teammates_blame' | 'form_hot' | 'form_cold' | 'rival' | 'transfer' | 'manager_dispute'
  | 'bench' | 'casino' | 'national' | 'contract' | 'pre_opponent' | 'pre_pressure' | 'season_goals' | 'private_life'

export interface Journalist {
  id: string
  name: string
  outlet: string
  style: JournalistStyle
}

/** Fictional press pack. Names and outlets are invented. */
export const JOURNALISTS: readonly Journalist[] = [
  { id: 'j_tabloid', name: 'Cem Fırtına', outlet: 'Gece Bekçisi', style: 'tabloid' },
  { id: 'j_analyst', name: 'Ilka Brandt', outlet: 'The Touchline', style: 'analyst' },
  { id: 'j_friendly', name: 'Nesrin Ak', outlet: 'Tribün Gazetesi', style: 'friendly' },
  { id: 'j_provo', name: 'Rico Valente', outlet: 'Sport Daily Star', style: 'provocateur' },
  { id: 'j_veteran', name: 'Hüsnü Usta', outlet: 'Gol Postası', style: 'veteran' },
]

export const JOURNALIST_STYLE_NAME: Readonly<Record<JournalistStyle, LText>> = {
  tabloid: lt('Magazinci', 'Tabloid hack'),
  analyst: lt('Analizci', 'Analyst'),
  friendly: lt('Dost canlısı', 'Friendly'),
  provocateur: lt('Kışkırtıcı', 'Provocateur'),
  veteran: lt('Duayen', 'Veteran'),
}

/** Extra effect keys of v2 answers. `followers` values are multiples of {@link boldFollowers}. */
export type InterviewEffectKeyV2 = InterviewEffectKey | 'agent' | 'chairman' | 'buzz'

export interface InterviewEffectV2 {
  key: InterviewEffectKeyV2
  value: number
  chance: number
}

export interface QuestionOption {
  id: string
  tone: AnswerTone
  label: LText
  /** Short quotable line for the headline. */
  quote: LText
  effects: InterviewEffectV2[]
}

export interface Question {
  id: string
  topic: QuestionTopic
  journalist: Journalist
  text: LText
  /** A loaded question: the "obvious" angry answer backfires. */
  trap: boolean
  options: QuestionOption[]
}

/** The match (or week) the interview is about. */
export interface InterviewReport {
  won: boolean
  drew: boolean
  goals: number
  assists: number
  rating: number
  motm: boolean
  started: boolean
  minutes: number
  opponent: string
  /** Opponent club id (rival/derby detection). */
  opponentId?: string
  /** Unique key (fixture id); defaults to week + opponent. */
  key?: string
}

export interface InterviewSession {
  kind: InterviewKind
  key: string
  week: number
  /** 0.3..1.2 ceiling on positive fans/reputation/followers effects. */
  perf: number
  questions: Question[]
  /** questionId → optionId */
  answers: Record<string, string>
  /** Positive totals applied so far (session caps). */
  gained: { fans: number; reputation: number; followers: number }
  headline?: LText
}

export const IV_SESSION_FLAG = 'iv:session'
export const IV_PRESS_WEEK_FLAG = 'iv:pressWeek'
/** Transfer-rumour heat 0..10 (interviews and rumour events fuel or cool it). */
export const IV_BUZZ_FLAG = 'transfer_buzz'
/** Session caps on the good stuff (one interview can't make you a legend). */
export const IV_CAP = { fans: 8, reputation: 2 } as const

const fx2 = (key: InterviewEffectKeyV2, value: number, chance = 1): InterviewEffectV2 => ({ key, value, chance })

interface Ctx {
  state: GameState
  r: InterviewReport | null
  kind: InterviewKind
  mood: Mood
  shone: boolean
}

interface OptionTpl {
  tone: AnswerTone
  label: LText
  quote: LText
  fx: (c: Ctx) => InterviewEffectV2[]
}

interface TopicDef {
  questions: LText[]
  options: OptionTpl[]
  trap?: boolean
  /** Journalists who like this topic. */
  styles: JournalistStyle[]
}

const DEFLECT: OptionTpl = {
  tone: 'deflect',
  label: lt('"Sıradaki maça odaklanıyoruz."', '"We\'re focused on the next game."'),
  quote: lt('Sıradaki maça bakıyoruz', 'We look to the next game'),
  fx: () => [fx2('press', -1), fx2('stress', -2), fx2('discipline', 1)],
}

export const INTERVIEW_TOPICS: Readonly<Record<QuestionTopic, TopicDef>> = {
  result: {
    styles: ['friendly', 'veteran', 'analyst'],
    questions: [
      lt('{o} maçını nasıl değerlendiriyorsun?', 'How do you assess the game against {o}?'),
      lt('Bugünkü sonuç takım için ne anlama geliyor?', 'What does today\'s result mean for the team?'),
    ],
    options: [
      { tone: 'humble', label: lt('"Sonuç da emek de takımın."', '"The result and the work belong to the team."'), quote: lt('Bu sonuç takımın', 'This result belongs to the team'), fx: (c) => [fx2('teammates', 2), fx2('press', 1), fx2('fans', c.mood === 'loss' ? 1 : 2)] },
      { tone: 'bold', label: lt('"Daha iyisini yapacağız, bu daha başlangıç."', '"We\'ll do better. This is only the start."'), quote: lt('Bu daha başlangıç', 'This is only the start'), fx: (c) => c.mood === 'win' ? [fx2('fans', 3), fx2('followers', 1)] : [fx2('fans', 1), fx2('managerTrust', -1, 0.5)] },
      { tone: 'critical', label: lt('"Planımız sahaya yansımadı, konuşmamız lazım."', '"Our plan didn\'t show on the pitch. We need to talk."'), quote: lt('Planımız sahaya yansımadı', 'Our plan didn\'t show on the pitch'), fx: () => [fx2('manager', -5), fx2('managerTrust', -4), fx2('press', 3)] },
      DEFLECT,
    ],
  },
  hero: {
    styles: ['friendly', 'tabloid', 'veteran'],
    questions: [
      lt('Maçın yıldızı sendin! Bu performansın sırrı ne?', 'You were the star of the show! What\'s the secret?'),
      lt('Herkes senin adını konuşuyor. Kendini nasıl hissediyorsun?', 'Everyone is talking about you. How does it feel?'),
    ],
    options: [
      { tone: 'humble', label: lt('"Pasları atanlar olmasa gol de olmaz."', '"No goals without the people passing the ball."'), quote: lt('Pasları atanlar olmasa gol olmaz', 'No goals without the passers'), fx: () => [fx2('teammates', 3), fx2('press', 2), fx2('reputation', 1)] },
      { tone: 'bold', label: lt('"Bu ligin en iyisi olacağım."', '"I\'ll be the best in this league."'), quote: lt('Bu ligin en iyisi olacağım', 'I\'ll be the best in this league'), fx: () => [fx2('followers', 1), fx2('fans', 3), fx2('teammates', -1, 0.5), fx2('managerTrust', -1, 0.5)] },
      { tone: 'joke', label: lt('"Annem kahvaltıda iki yumurta verdi, ondan."', '"Mum gave me two eggs for breakfast. That\'s it."'), quote: lt('Sır annemin kahvaltısında', 'The secret is mum\'s breakfast'), fx: () => [fx2('followers', 0.6), fx2('fans', 2), fx2('press', 2, 0.7)] },
      DEFLECT,
    ],
  },
  teammates_blame: {
    trap: true,
    styles: ['provocateur', 'tabloid'],
    questions: [
      lt('{g} gol attın ama kazanamadınız. Takım arkadaşların seni yarı yolda mı bıraktı?', 'You scored {g} and still lost. Did your teammates let you down?'),
      lt('Tek başına savaşıyor gibiydin. Arkadaşlarına bir mesajın var mı?', 'You looked like a one-man army. Any message for your teammates?'),
    ],
    options: [
      { tone: 'humble', label: lt('"Biz takımız. Kazanırken de kaybederken de birlikteyiz."', '"We\'re a team. We win together and lose together."'), quote: lt('Kazanırken de kaybederken de birlikteyiz', 'We win and lose together'), fx: () => [fx2('teammates', 4), fx2('fans', 2), fx2('manager', 2), fx2('press', 1)] },
      { tone: 'critical', label: lt('"Herkes benim kadar koşsaydı skor farklı olurdu."', '"If everyone ran like I did, the score would be different."'), quote: lt('Herkes benim kadar koşsaydı', 'If everyone ran like I did'), fx: () => [fx2('teammates', -6), fx2('manager', -4), fx2('press', 4), fx2('followers', 0.5)] },
      { tone: 'joke', label: lt('"Golleri saymadım, kaybettik ya, unutalım."', '"I didn\'t count the goals. We lost, let\'s forget it."'), quote: lt('Golleri saymadım', 'I didn\'t count the goals'), fx: () => [fx2('teammates', 1), fx2('fans', 1), fx2('press', 1)] },
      DEFLECT,
    ],
  },
  form_hot: {
    styles: ['tabloid', 'friendly', 'analyst'],
    questions: [
      lt('Son haftalarda durdurulamıyorsun. Bu form nereden geliyor?', 'You\'ve been unstoppable lately. Where is this form coming from?'),
      lt('Bu formla milli takım kapısı da aralanır mı?', 'Does this form open the national team door?'),
    ],
    options: [
      { tone: 'humble', label: lt('"Antrenmanda ne ekersen onu biçiyorsun."', '"You reap what you sow in training."'), quote: lt('Antrenmanda ne ekersen onu biçersin', 'You reap what you sow in training'), fx: () => [fx2('managerTrust', 2), fx2('press', 1), fx2('teammates', 1)] },
      { tone: 'bold', label: lt('"Daha zirveyi görmediniz."', '"You haven\'t seen my peak yet."'), quote: lt('Daha zirvemi görmediniz', 'You haven\'t seen my peak yet'), fx: () => [fx2('followers', 1), fx2('fans', 2), fx2('stress', 2)] },
      { tone: 'joke', label: lt('"Yeni kramponlar. Sponsorum çok sevinecek."', '"New boots. My sponsor will be thrilled."'), quote: lt('Hepsi yeni kramponlar sayesinde', 'It\'s all the new boots'), fx: () => [fx2('followers', 0.6), fx2('press', 2)] },
      DEFLECT,
    ],
  },
  form_cold: {
    styles: ['provocateur', 'analyst', 'tabloid'],
    questions: [
      lt('Bir süredir eski sen değilsin. Ne oluyor?', 'You haven\'t been yourself for a while. What\'s going on?'),
      lt('Eleştirilere ne cevap vereceksin?', 'What\'s your answer to the critics?'),
    ],
    options: [
      { tone: 'humble', label: lt('"Haklısınız, daha iyisini yapmalıyım. Çalışıyorum."', '"Fair point, I must do better. I\'m working on it."'), quote: lt('Daha iyisini yapmalıyım', 'I must do better'), fx: () => [fx2('fans', 2), fx2('managerTrust', 2), fx2('stress', 1)] },
      { tone: 'bold', label: lt('"Formum geçici, kalitem kalıcı."', '"Form is temporary, class is permanent."'), quote: lt('Form geçici, kalite kalıcı', 'Form is temporary, class is permanent'), fx: () => [fx2('fans', -2), fx2('followers', 0.5), fx2('press', -2)] },
      { tone: 'critical', label: lt('"Bu sistemde topa dokunamıyorum ki."', '"I can\'t touch the ball in this system."'), quote: lt('Bu sistemde topa dokunamıyorum', 'I can\'t touch the ball in this system'), fx: () => [fx2('manager', -6), fx2('managerTrust', -5), fx2('press', 3)] },
      DEFLECT,
    ],
  },
  rival: {
    styles: ['tabloid', 'provocateur', 'veteran'],
    questions: [
      lt('{o} ile aranızda ayrı bir rekabet var. Onlara ne söylemek istersin?', 'There\'s a special rivalry with {o}. Anything to say to them?'),
      lt('{o} taraftarları seni hedef aldı. Cevabın?', '{o} fans have made you a target. Your answer?'),
    ],
    options: [
      { tone: 'humble', label: lt('"Saygı duyduğumuz bir rakip, sahada konuşuruz."', '"A rival we respect. We\'ll talk on the pitch."'), quote: lt('Sahada konuşuruz', 'We\'ll talk on the pitch'), fx: () => [fx2('press', 2), fx2('discipline', 1)] },
      { tone: 'bold', label: lt('"Onlar bizden korkuyor, korkmakta da haklılar."', '"They fear us, and they\'re right to."'), quote: lt('Bizden korkuyorlar', 'They fear us'), fx: () => [fx2('fans', 4), fx2('followers', 1), fx2('discipline', -2), fx2('press', -1)] },
      { tone: 'joke', label: lt('"Onların stadını hep beğenmişimdir. Özellikle skorbordu."', '"I\'ve always liked their stadium. Especially the scoreboard."'), quote: lt('En çok skorbordlarını beğeniyorum', 'I like their scoreboard best'), fx: () => [fx2('fans', 3), fx2('followers', 0.8), fx2('press', 1)] },
      DEFLECT,
    ],
  },
  transfer: {
    styles: ['tabloid', 'provocateur', 'analyst'],
    questions: [
      lt('Seni büyük bir kulüple anan haberler var. Gidiyor musun?', 'Reports link you with a bigger club. Are you leaving?'),
      lt('Menajerinin başka kulüplerle görüştüğü söyleniyor. Doğru mu?', 'Word is your agent has been talking to other clubs. True?'),
    ],
    options: [
      { tone: 'humble', label: lt('"Kalbim burada. Sözleşmeme saygılıyım."', '"My heart is here. I respect my contract."'), quote: lt('Kalbim burada', 'My heart is here'), fx: () => [fx2('fans', 4), fx2('chairman', 2), fx2('agent', -2), fx2('buzz', -2)] },
      { tone: 'bold', label: lt('"Hedefim büyük. Kapıyı kapatmıyorum."', '"My ambitions are big. I\'m not closing the door."'), quote: lt('Kapıyı kapatmıyorum', 'I\'m not closing the door'), fx: () => [fx2('buzz', 3), fx2('agent', 3), fx2('fans', -4), fx2('chairman', -3), fx2('followers', 0.8)] },
      { tone: 'joke', label: lt('"Tek transferim gece yarısı yataktan mutfağa."', '"My only transfer is bed to fridge at midnight."'), quote: lt('Tek transferim yataktan mutfağa', 'My only transfer is bed to fridge'), fx: () => [fx2('followers', 0.6), fx2('press', 2), fx2('buzz', 1)] },
      DEFLECT,
    ],
  },
  manager_dispute: {
    styles: ['provocateur', 'tabloid', 'analyst'],
    questions: [
      lt('{m} ile aranızın bozuk olduğu konuşuluyor. Ne diyeceksin?', 'People say things are tense with {m}. What do you say?'),
      lt('Hocanın seni yeterince kullanmadığını düşünüyor musun?', 'Do you feel the manager is not using you enough?'),
    ],
    options: [
      { tone: 'humble', label: lt('"Hocamın arkasındayım. Kararlar onun."', '"I back the gaffer. The decisions are the gaffer\'s."'), quote: lt('Hocamın arkasındayım', 'I back the gaffer'), fx: () => [fx2('manager', 6), fx2('managerTrust', 4), fx2('press', -1)] },
      { tone: 'critical', label: lt('"Bazı kararları anlamıyorum, açık konuşayım."', '"Honestly, I don\'t understand some decisions."'), quote: lt('Bazı kararları anlamıyorum', 'I don\'t understand some decisions'), fx: () => [fx2('manager', -12), fx2('managerTrust', -8), fx2('press', 5), fx2('fans', 2, 0.5)] },
      { tone: 'joke', label: lt('"Biz eski bir evli çift gibiyiz. Kavga da ederiz, barışırız da."', '"We\'re like an old married couple. We fight, we make up."'), quote: lt('Eski bir evli çift gibiyiz', 'We\'re like an old married couple'), fx: () => [fx2('manager', 1), fx2('press', 2), fx2('followers', 0.5)] },
      DEFLECT,
    ],
  },
  bench: {
    styles: ['provocateur', 'tabloid', 'friendly'],
    questions: [
      lt('Bu akşam pek süre alamadın. Durumundan memnun musun?', 'You didn\'t get many minutes tonight. Are you happy with your situation?'),
      lt('Kulübede geçen bir akşam daha. Sabrın tükeniyor mu?', 'Another night on the bench. Is your patience running out?'),
    ],
    options: [
      { tone: 'humble', label: lt('"Takım kazandıkça sıramı beklerim."', '"As long as the team wins, I\'ll wait my turn."'), quote: lt('Sıramı beklerim', 'I\'ll wait my turn'), fx: () => [fx2('managerTrust', 3), fx2('manager', 2), fx2('morale', -1)] },
      { tone: 'bold', label: lt('"Oynasaydım skor farklı olurdu."', '"Had I played, the score would be different."'), quote: lt('Oynasaydım skor farklı olurdu', 'Had I played, it\'d be different'), fx: () => [fx2('managerTrust', -4), fx2('manager', -4), fx2('fans', 2), fx2('followers', 0.5)] },
      { tone: 'critical', label: lt('"Neden oynamadığımı hocaya sorun."', '"Ask the manager why I didn\'t play."'), quote: lt('Neden oynamadığımı hocaya sorun', 'Ask the manager why I didn\'t play'), fx: () => [fx2('manager', -8), fx2('managerTrust', -6), fx2('press', 4)] },
      DEFLECT,
    ],
  },
  casino: {
    trap: true,
    styles: ['tabloid', 'provocateur'],
    questions: [
      lt('Geçen hafta kumarhanede görüldüğün iddia ediliyor. Bir sorunun mu var?', 'You were reportedly seen at a casino last week. Do you have a problem?'),
    ],
    options: [
      { tone: 'humble', label: lt('"Bir hataydı. Kendime sınır koydum."', '"It was a mistake. I\'ve set myself limits."'), quote: lt('Kendime sınır koydum', 'I\'ve set myself limits'), fx: () => [fx2('press', 3), fx2('discipline', 2), fx2('managerTrust', 1)] },
      { tone: 'bold', label: lt('"Özel hayatım beni ilgilendirir."', '"My private life is my business."'), quote: lt('Özel hayatım beni ilgilendirir', 'My private life is my business'), fx: () => [fx2('press', -5), fx2('fans', -2), fx2('stress', 2)] },
      { tone: 'joke', label: lt('"Tek kumarım penaltıda köşe seçmek."', '"The only gamble I take is picking a corner from the spot."'), quote: lt('Tek kumarım penaltı köşesi', 'My only gamble is the penalty corner'), fx: () => [fx2('press', 1, 0.5), fx2('followers', 0.4)] },
      DEFLECT,
    ],
  },
  national: {
    styles: ['veteran', 'friendly'],
    questions: [lt('Milli takım formasını giymek sana ne ifade ediyor?', 'What does wearing the national shirt mean to you?')],
    options: [
      { tone: 'humble', label: lt('"Ailem için, ülkem için. Daha büyük bir onur yok."', '"For my family, for my country. No greater honour."'), quote: lt('Daha büyük bir onur yok', 'No greater honour'), fx: () => [fx2('fans', 3), fx2('press', 2), fx2('reputation', 1)] },
      { tone: 'bold', label: lt('"Turnuvaya kupa için gideriz."', '"We go to the tournament to win it."'), quote: lt('Kupa için gideriz', 'We go there to win it'), fx: () => [fx2('fans', 3), fx2('followers', 0.8), fx2('stress', 2)] },
      DEFLECT,
    ],
  },
  contract: {
    styles: ['analyst', 'tabloid'],
    questions: [lt('Sözleşmen bitmek üzere. Yeni imza ne zaman?', 'Your contract is running down. When do you sign a new one?')],
    options: [
      { tone: 'humble', label: lt('"Kulüple konuşuyoruz, acelemiz yok."', '"We\'re talking with the club, no rush."'), quote: lt('Acelemiz yok', 'No rush'), fx: () => [fx2('chairman', 2), fx2('press', 1)] },
      { tone: 'bold', label: lt('"Değerimi bilen yerde kalırım."', '"I\'ll stay where my value is recognised."'), quote: lt('Değerimi bilen yerde kalırım', 'I stay where I\'m valued'), fx: () => [fx2('agent', 3), fx2('chairman', -3), fx2('buzz', 2), fx2('fans', -2)] },
      DEFLECT,
    ],
  },
  pre_opponent: {
    styles: ['friendly', 'analyst', 'veteran'],
    questions: [
      lt('Yarın {o} karşısındasınız. Neler bekliyorsun?', 'Tomorrow it\'s {o}. What do you expect?'),
      lt('{o} maçı için bir tahminin var mı?', 'Got a prediction for the {o} game?'),
    ],
    options: [
      { tone: 'humble', label: lt('"Zor bir maç. Her topa saygı göstereceğiz."', '"A tough game. We\'ll respect every ball."'), quote: lt('Her topa saygı', 'Respect every ball'), fx: () => [fx2('managerTrust', 1), fx2('press', 1)] },
      { tone: 'bold', label: lt('"Üç puan bizim. Gol atacağım."', '"Three points are ours. I\'ll score."'), quote: lt('Gol atacağım', 'I\'ll score'), fx: () => [fx2('fans', 3), fx2('followers', 0.8), fx2('stress', 3)] },
      { tone: 'joke', label: lt('"2-1. Bir de kafa golü, ama saçım bozulmayacak şekilde."', '"2–1. I\'ll head one in, gently, to save the hair."'), quote: lt('Saçım bozulmadan bir kafa golü', 'A header that spares the hair'), fx: () => [fx2('followers', 0.6), fx2('fans', 2)] },
      DEFLECT,
    ],
  },
  pre_pressure: {
    styles: ['analyst', 'provocateur'],
    questions: [lt('Bu maçın baskısı omuzlarında mı?', 'Is the pressure of this game on your shoulders?')],
    options: [
      { tone: 'humble', label: lt('"Baskı ayrıcalıktır. Takımca taşırız."', '"Pressure is a privilege. We carry it together."'), quote: lt('Baskı ayrıcalıktır', 'Pressure is a privilege'), fx: () => [fx2('stress', -2), fx2('teammates', 2)] },
      { tone: 'bold', label: lt('"Büyük maçlar büyük oyuncular içindir."', '"Big games are for big players."'), quote: lt('Büyük maçlar büyük oyuncular içindir', 'Big games are for big players'), fx: () => [fx2('fans', 3), fx2('stress', 3), fx2('followers', 0.6)] },
      DEFLECT,
    ],
  },
  season_goals: {
    styles: ['veteran', 'analyst', 'friendly'],
    questions: [lt('Bu sezon için kişisel hedefin ne?', 'What\'s your personal target this season?')],
    options: [
      { tone: 'humble', label: lt('"Takıma faydalı olmak, gerisi gelir."', '"Be useful to the team. The rest follows."'), quote: lt('Takıma faydalı olmak', 'Be useful to the team'), fx: () => [fx2('teammates', 2), fx2('managerTrust', 2)] },
      { tone: 'bold', label: lt('"Gol krallığı. Yazın bir kenara."', '"Top scorer. Write it down."'), quote: lt('Gol krallığı, yazın bir kenara', 'Top scorer, write it down'), fx: () => [fx2('fans', 3), fx2('followers', 1), fx2('stress', 3)] },
      { tone: 'joke', label: lt('"Saç modelimi bütün sezon korumak. Gerisi kolay."', '"Keep the same haircut all season. The rest is easy."'), quote: lt('Saç modelimi korumak', 'Keep the haircut'), fx: () => [fx2('followers', 0.6), fx2('press', 1)] },
      DEFLECT,
    ],
  },
  private_life: {
    trap: true,
    styles: ['tabloid'],
    questions: [lt('Gece hayatında çok görülüyorsun. Futbol ikinci plana mı düştü?', 'You\'re seen out a lot at night. Is football second now?')],
    options: [
      { tone: 'humble', label: lt('"Haklı bir uyarı. Önceliğim futbol."', '"Fair warning. Football comes first."'), quote: lt('Önceliğim futbol', 'Football comes first'), fx: () => [fx2('discipline', 2), fx2('managerTrust', 2), fx2('press', 1)] },
      { tone: 'bold', label: lt('"Gencim ve ünlüyüm, tabii ki eğleneceğim."', '"I\'m young and famous, of course I\'ll have fun."'), quote: lt('Gencim ve ünlüyüm, eğleneceğim', 'I\'m young and famous, I\'ll have fun'), fx: () => [fx2('followers', 1), fx2('discipline', -4), fx2('managerTrust', -3), fx2('press', -2)] },
      DEFLECT,
    ],
  },
}

const TONE_SENTIMENT: Record<AnswerTone, -1 | 0 | 1> = { humble: 1, bold: 0, critical: -1, deflect: 0, joke: 1 }
/** How quotable an answer is (the spiciest answer of a session makes the headline). */
const TONE_SPICE: Record<AnswerTone, number> = { critical: 4, bold: 3, joke: 2, humble: 1, deflect: 0 }

/** Personality tweaks: tabloids amplify reach and damage, friendly reporters soften blows… */
function styleAdjust(style: JournalistStyle, e: InterviewEffectV2): InterviewEffectV2 {
  const neg = e.value < 0 && e.key !== 'stress'
  switch (style) {
    case 'tabloid':
      if (e.key === 'followers') return { ...e, value: e.value * 1.5 }
      return neg && (e.key === 'press' || e.key === 'fans') ? { ...e, value: e.value * 1.3 } : e
    case 'friendly':
      return neg ? { ...e, value: e.value * 0.6 } : e
    case 'analyst':
      return e.key === 'press' && e.value > 0 ? { ...e, value: e.value + 1 } : e
    case 'provocateur':
      return neg ? { ...e, value: e.value * 1.25 } : e
    case 'veteran':
      return e.key === 'teammates' && e.value > 0 ? { ...e, value: e.value + 1 } : e
  }
}

/** Effect ceiling from the performance: rating 5 → 0.3, 8+ → 1.2 (pre/press: form). */
export function interviewPerf(state: GameState, r: InterviewReport | null): number {
  if (r && r.minutes > 0) return clamp((r.rating - 5) / 2.5, 0.3, 1.2)
  return clamp((state.hero.form - 20) / 50, 0.3, 1.2)
}

function isRival(state: GameState, r: InterviewReport | null): boolean {
  if (!r?.opponentId) return false
  const mine = state.hero.contract ? state.world.clubs[state.hero.contract.clubId] : undefined
  const opp = state.world.clubs[r.opponentId]
  if (!mine || !opp) return false
  return mine.city === opp.city || opp.reputation >= mine.reputation + 15
}

/** Weighted candidate topics for the context. */
function candidateTopics(c: Ctx): { topic: QuestionTopic; w: number }[] {
  const { state, r, kind } = c
  const h = state.hero
  const out: { topic: QuestionTopic; w: number }[] = []
  const add = (topic: QuestionTopic, w: number): void => {
    if (w > 0 && !out.some((o) => o.topic === topic)) out.push({ topic, w })
  }
  const mgrRel = state.life.relationships.manager?.value ?? 0
  const dispute = h.managerTrust < 35 || mgrRel < -20
  const buzz = state.life.flags[IV_BUZZ_FLAG]
  const rumours = (typeof buzz === 'number' && buzz > 0) || state.life.flags['rumour_active'] === true || getOffers(state).length > 0
  const seen = state.life.flags['casino_seen_week']
  const casinoRecent = typeof seen === 'number' && absWeek(state.calendar) - seen <= 3
  const contractEnding = !!h.contract && h.contract.untilSeason <= state.calendar.season
  if (kind === 'post' && r) {
    if (!r.started && r.minutes < 30) add('bench', 10)
    else {
      if (c.shone && c.mood === 'loss') add('teammates_blame', 9)
      else if (c.shone) add('hero', 8)
      add('result', 6)
    }
    if (isRival(state, r)) add('rival', 5)
  }
  if (kind === 'pre' && r) {
    add('pre_opponent', 10)
    add(isRival(state, r) ? 'rival' : 'pre_pressure', 5)
  }
  if (kind === 'press') {
    add('season_goals', 4)
    if (state.life.discipline < 55) add('private_life', 4)
  }
  if (h.form >= 70) add('form_hot', 4)
  if (h.form <= 35) add('form_cold', 4)
  if (rumours) add('transfer', 6)
  if (dispute) add('manager_dispute', 6)
  if (casinoRecent) add('casino', 5)
  if (h.nationalTeam.called) add('national', 2)
  if (contractEnding) add('contract', 3)
  for (const t of ['season_goals', 'pre_pressure', 'form_hot', 'form_cold'] as QuestionTopic[]) if (out.length < 3) add(t, 1)
  return out
}

function buildQuestion(c: Ctx, rng: Rng, topic: QuestionTopic, idx: number, vars: Record<string, string | number>): Question {
  const def = INTERVIEW_TOPICS[topic]
  const pool = JOURNALISTS.filter((j) => def.styles.includes(j.style))
  const journalist = rng.pick(pool.length ? pool : JOURNALISTS)
  const options = def.options.map((o, i): QuestionOption => ({
    id: `${topic}_${i}_${o.tone}`,
    tone: o.tone,
    label: fill(o.label, vars),
    quote: fill(o.quote, vars),
    effects: o.fx(c).map((x) => styleAdjust(journalist.style, x)),
  }))
  return { id: `q${idx}_${topic}`, topic, journalist, text: fill(rng.pick(def.questions), vars), trap: !!def.trap, options }
}

const reportKey = (state: GameState, kind: InterviewKind, r: InterviewReport | null): string =>
  `${kind}:${r?.key ?? `${absWeek(state.calendar)}:${r?.opponent ?? ''}`}`

/** Current interview session (null if none). */
export function interviewSession(state: GameState): InterviewSession | null {
  return readJson<InterviewSession | null>(state.life, IV_SESSION_FLAG, null)
}

const NO_MATCH: InterviewReport = { won: false, drew: true, goals: 0, assists: 0, rating: 0, motm: false, started: true, minutes: 0, opponent: '' }

/**
 * Start (or resume) a 3-question session. Deterministic per report key: the
 * same match always gets the same questions. An unfinished session for the
 * same key is resumed; a different key replaces it.
 */
export function startInterview(state: GameState, kind: InterviewKind, report: InterviewReport | null): InterviewSession {
  const key = reportKey(state, kind, report)
  const cur = interviewSession(state)
  if (cur && cur.key === key) return cur
  const r = report
  const mood: Mood = r ? moodOf(r) : 'draw'
  const shone = !!r && r.minutes > 0 && (r.goals >= 2 || r.rating >= 7.5 || r.motm)
  const c: Ctx = { state, r, kind, mood, shone }
  const rng = new Rng(hashString(`${state.meta.id}:${key}`))
  const club = state.hero.contract ? state.world.clubs[state.hero.contract.clubId] : undefined
  const managerName = club?.managerName || state.life.relationships.manager?.name || 'Hoca'
  const vars = { o: r?.opponent ?? '', g: r?.goals ?? 0, m: managerName }
  const cands = candidateTopics(c)
  const picked: QuestionTopic[] = []
  // The strongest context topic always comes first; the rest are weighted picks.
  const sorted = [...cands].sort((a, b) => b.w - a.w)
  if (sorted.length) picked.push(sorted[0].topic)
  while (picked.length < 3) {
    const rest = cands.filter((x) => !picked.includes(x.topic))
    if (!rest.length) break
    picked.push(rng.weighted(rest, (x) => x.w).topic)
  }
  const questions = picked.map((t, i) => buildQuestion(c, rng, t, i, vars))
  const s: InterviewSession = {
    kind, key, week: absWeek(state.calendar), perf: interviewPerf(state, r && r.minutes > 0 ? r : null),
    questions, answers: {}, gained: { fans: 0, reputation: 0, followers: 0 },
  }
  writeJson(state.life, IV_SESSION_FLAG, s)
  return s
}

/** Post-match: the three questions for this match report (stable API for the match screen). */
export function interviewQuestions(state: GameState, report: InterviewReport): Question[] {
  return startInterview(state, 'post', report).questions
}

/** Pre-match interview for the next opponent. */
export function preMatchQuestions(state: GameState, report: Pick<InterviewReport, 'opponent'> & Partial<Pick<InterviewReport, 'opponentId' | 'key'>>): Question[] {
  return startInterview(state, 'pre', { ...NO_MATCH, ...report }).questions
}

/** Can the hero hold a press conference this week? (once a week) */
export const canHoldPressConference = (state: GameState): boolean => state.life.flags[IV_PRESS_WEEK_FLAG] !== absWeek(state.calendar)

/** Weekly press conference (Life → Social). Resumes an open one; null when already held this week. */
export function pressConferenceQuestions(state: GameState): Question[] | null {
  const cur = interviewSession(state)
  if (cur && cur.kind === 'press' && cur.week === absWeek(state.calendar) && !cur.headline) return cur.questions
  if (!canHoldPressConference(state)) return null
  state.life.flags[IV_PRESS_WEEK_FLAG] = absWeek(state.calendar)
  return startInterview(state, 'press', { ...NO_MATCH, key: `press${absWeek(state.calendar)}` }).questions
}

export interface InterviewAnswerV2 extends InterviewAnswer {
  /** True once all questions of the session are answered. */
  done: boolean
  /** Headline printed when the session completed. */
  headline?: LText
}

const heroDisplay = (state: GameState): string => state.hero.nickname || `${state.hero.firstName} ${state.hero.lastName}`

/** Headline from the spiciest answer of a finished session, in the journalist's voice. */
export function sessionHeadline(state: GameState, s: InterviewSession): { headline: LText; sentiment: -1 | 0 | 1; source: string } | null {
  let best: { q: Question; o: QuestionOption; score: number } | null = null
  for (const q of s.questions) {
    const o = q.options.find((x) => x.id === s.answers[q.id])
    if (!o) continue
    const score = TONE_SPICE[o.tone] + (q.trap && o.tone !== 'humble' ? 1 : 0) + (q.journalist.style === 'tabloid' ? 0.5 : 0)
    if (!best || score > best.score) best = { q, o, score }
  }
  if (!best) return null
  const h = heroDisplay(state)
  const { q, o } = best
  const spicy = o.tone === 'critical' || o.tone === 'bold'
  const prefix: Record<JournalistStyle, LText> = {
    tabloid: spicy ? lt('BOMBA! ', 'BOMBSHELL! ') : lt('', ''),
    analyst: lt('Analiz · ', 'Analysis · '),
    friendly: lt('', ''),
    provocateur: o.tone === 'critical' ? lt('Olay sözler! ', 'Explosive! ') : lt('', ''),
    veteran: lt('', ''),
  }
  const p = prefix[q.journalist.style]
  const headline: LText = o.tone === 'deflect'
    ? fill(lt('{h} soruları geçiştirdi: "{q}"', '{h} dodges the questions: "{q}"'), { h, q: o.quote })
    : { tr: `${p.tr}${h}: “${o.quote.tr}”`, en: `${p.en}${h}: “${o.quote.en}”` }
  return { headline, sentiment: TONE_SENTIMENT[o.tone], source: q.journalist.outlet }
}

function applyV2(state: GameState, rng: Rng, s: InterviewSession, q: Question, opt: QuestionOption): InterviewEffect[] {
  const { hero: h, life: l } = state
  const week = absWeek(state.calendar)
  const why = fill(lt('{o} röportajı: "{q}"', '{o} interview: "{q}"'), { o: q.journalist.outlet, q: opt.quote })
  const applied: InterviewEffect[] = []
  for (const x of opt.effects) {
    if (x.chance < 1 && !rng.chance(x.chance)) continue
    let v = x.value
    // Rating-bound ceiling on the good stuff (GAP 2.4#60): a 5.5 game can't buy a hero's welcome.
    if (v > 0 && (x.key === 'fans' || x.key === 'reputation' || x.key === 'followers')) v *= s.perf
    switch (x.key) {
      case 'teammates':
        for (const r of Object.values(l.relationships)) if (r.kind === 'teammate') changeRelation(l, r.id, v, { hero: h, week, cause: 'interview', why })
        break
      case 'fans':
        if (v > 0) v = Math.max(0, Math.min(v, IV_CAP.fans - s.gained.fans))
        if (v !== 0) {
          const a = changeRelation(l, 'fans', v, { hero: h, week, cause: 'interview', why })
          if (a > 0) s.gained.fans += a
          v = a
        }
        break
      case 'manager':
      case 'press':
      case 'agent':
      case 'chairman':
        changeRelation(l, x.key, v, { hero: h, week, cause: 'interview', why, memory: x.key === 'manager' && Math.abs(v) >= 5 ? why : undefined })
        break
      case 'followers': {
        const n = Math.round(boldFollowers(state) * v)
        l.followers = Math.max(0, l.followers + n)
        s.gained.followers += n
        v = n
        break
      }
      case 'reputation':
        if (v > 0) {
          v = Math.max(0, Math.min(v, IV_CAP.reputation - s.gained.reputation))
          s.gained.reputation += v
        }
        h.reputation = meter(h.reputation + v)
        break
      case 'managerTrust': h.managerTrust = meter(h.managerTrust + v); break
      case 'discipline': l.discipline = meter(l.discipline + v); break
      case 'stress': l.stress = meter(l.stress + v); break
      case 'morale': h.morale = clamp(h.morale + v, 0, 100); break
      case 'buzz': {
        const cur = l.flags[IV_BUZZ_FLAG]
        l.flags[IV_BUZZ_FLAG] = clamp((typeof cur === 'number' ? cur : 0) + v, 0, 10)
        break
      }
    }
    if (x.key !== 'agent' && x.key !== 'chairman' && x.key !== 'buzz' && v !== 0) applied.push({ key: x.key, value: Math.round(v * 10) / 10, chance: x.chance })
  }
  return applied
}

/**
 * Answer one question of the current session (stable API). Unknown ids or an
 * already-answered question are no-ops. When the last question is answered
 * the session's headline is printed (life.news) and returned.
 */
export function answerInterview(state: GameState, questionId: string, optionId: string): InterviewAnswerV2
/** Single-question flash interview (v1), kept while the post-match screen moves to v2. */
export function answerInterview(state: GameState, def: InterviewDef, tone: InterviewTone): InterviewAnswer
export function answerInterview(state: GameState, a: InterviewDef | string, b: string): InterviewAnswer | InterviewAnswerV2 {
  if (typeof a !== 'string') return answerInterviewV1(state, a, b as InterviewTone)
  const s = interviewSession(state)
  const q = s?.questions.find((x) => x.id === a)
  const opt = q?.options.find((o) => o.id === b)
  if (!s || !q || !opt || s.answers[q.id]) return { applied: [], lines: [], done: !!s && s.questions.every((x) => !!s.answers[x.id]) }
  return withRng(state, (rng) => {
    const applied = applyV2(state, rng, s, q, opt)
    s.answers[q.id] = opt.id
    const lines: LText[] = []
    const done = s.questions.every((x) => !!s.answers[x.id])
    let headline: LText | undefined
    if (done) {
      const hl = sessionHeadline(state, s)
      if (hl) {
        headline = hl.headline
        s.headline = hl.headline
        pushNews(state.life, rng, state.calendar, hl.headline, hl.sentiment, hl.source)
        log(state, lines, fill(lt('Manşet: {h}', 'Headline: {h}'), { h: hl.headline }), 'event', '📰')
      }
    }
    writeJson(state.life, IV_SESSION_FLAG, s)
    return headline ? { applied, lines, done, headline } : { applied, lines, done }
  })
}
