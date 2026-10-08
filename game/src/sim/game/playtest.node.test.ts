/**
 * Playtest harness (lead designer). `PLAYTEST=1 npx vitest run src/sim/game/playtest.node.test.ts`
 * plays PLAYTEST_N careers (default 5) × PLAYTEST_SEASONS (default 6) through
 * the real façade like a human would: varied day plans, auto-resolved matches
 * with post-match interviews, event cards answered by persona taste, offers
 * negotiated, shopping, sponsors, the odd casino night. It writes one readable
 * Turkish transcript per career plus `analysis.md` (frequency tables, dead
 * weeks, contradiction checks, choice trade-offs) into PLAYTEST_OUT.
 *
 * Without PLAYTEST=1 only a short smoke run executes (no files written).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import type { Archetype, Background, GameState, Gender, LText, Position } from '../../core/types'
import { ASSETS } from '../../data/assets'
import { PERKS } from '../../data/perks'
import { ACTIVITY_BY_ID } from '../../data/activities'
import { heroAge } from '../career/common'
import { heroOvr } from '../career/progression'
import { activityBlock, autoPlanDay } from '../life/activities'
import { assetUpkeep, netWorth, purchaseBlock } from '../life/economy'
import { getEventDef } from '../life/events/engine'
import type { Delta, EventCtx } from '../life/events/types'
import { advanceDay, isHeroMatchday } from './calendar'
import {
  acceptNegotiation, acceptOffer, acceptSponsor, blackjackAct, blackjackDeal, buyAsset, horseRaceCard, playDice, playHorses, complainAboutBench, counterNegotiation,
  currentNegotiation, declineOffer, doActivity, hireAgent, hireTrainer, playRoulette, playSlots, resolveEventChoice, startNegotiation,
  unlockPerk, AGENT_TIERS,
} from './actions'
import { describeEvent } from './eventsAdapter'
import { GFLAG, activityContext, heroClub, readJson } from './internal'
import { autoPlayHeroMatch } from './match'
import { newGame, type NewGameInput } from './newGame'
import { getOffers, getSponsorOffers, type SeasonDigest } from './season'
import { answerInterview, interviewQuestions } from './interview'
import { dashboard, nextHeroFixture } from './summary'
import { objectivesView } from './objectives'
import { reinflect } from '../career/trSuffix'
import { placeholdersOf } from '../life/events/engine'
import { BUSINESS_DEFS, BUSINESS_KINDS, businesses, openBusiness } from '../life/business'
import { continueCareer, retireHero, retirementStatus } from './retirement'
import { buildCareerSummary, legacyTier, type CareerSummary } from './hallOfFame'
import { legacyStartFrom, type LegacyStart } from './legacy'
import { heroCallup } from './national'
import { canHoldPressConference, preMatchQuestions, pressConferenceQuestions } from './interview'
import { finishHeroMatch, startHeroMatch } from './match'
import { decisionDef, pickDecision, resolveDecision } from '../match/decisions'
import { applyPendingDecisions, pendingDecisions, recordDecision } from './matchDecisions'
import {
  academyLevel, buildAcademyStage, buildStadiumStage, buyClubStake, contributeLegacyFund, legacyFund, nextAcademyPrice, nextStadiumPrice,
  projectUpkeep, stadiumLevel, stakePct, STAKE_MAX_PCT, STAKE_PRICE_PER_PCT,
} from '../life/projects'
import { casinoVipTier } from '../life/casino'

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const FULL = env.PLAYTEST === '1'

type Persona = 'pro' | 'social' | 'gambler' | 'party' | 'spender' | 'investor'

interface PtConfig {
  seed: number
  first: string
  last: string
  gender: Gender
  nationality: string
  archetype: Archetype
  background: Background
  persona: Persona
  startAge: number
  /** Heavy gambler: casino most evenings, bigger stakes, every game. */
  heavy?: boolean
  /** Legacy child of the career at this index in the run list (needs its retirement summary). */
  legacyOf?: number
  /** Override seasons for this career (long run). */
  seasons?: number
}

const POS: Record<Archetype, Position> = { poacher: 'ST', playmaker: 'AM', winger: 'LW', wall: 'CB', boxToBox: 'CM', keeper: 'GK' }

const CONFIGS: PtConfig[] = [
  { seed: 4242, first: 'Arda', last: 'Yıldız', gender: 'male', nationality: 'TR', archetype: 'poacher', background: 'academy', persona: 'pro', startAge: 16 },
  { seed: 777, first: 'Elif', last: 'Kaya', gender: 'female', nationality: 'TR', archetype: 'keeper', background: 'street', persona: 'social', startAge: 17 },
  { seed: 9001, first: 'Can', last: 'Demir', gender: 'male', nationality: 'BR', archetype: 'winger', background: 'footballFamily', persona: 'gambler', startAge: 17 },
  { seed: 31337, first: 'Mert', last: 'Aydın', gender: 'male', nationality: 'DE', archetype: 'wall', background: 'lateBloomer', persona: 'party', startAge: 18 },
  { seed: 2026, first: 'Zeynep', last: 'Şahin', gender: 'female', nationality: 'EN', archetype: 'playmaker', background: 'academy', persona: 'spender', startAge: 16 },
  { seed: 5150, first: 'Kerem', last: 'Öztürk', gender: 'male', nationality: 'ES', archetype: 'boxToBox', background: 'street', persona: 'pro', startAge: 17 },
  { seed: 8080, first: 'Deniz', last: 'Arslan', gender: 'female', nationality: 'NL', archetype: 'winger', background: 'footballFamily', persona: 'social', startAge: 17 },
]

// Round 2 (PLAYTEST_PLAN=r2): a 15-season long run (retires -> Hall of Fame -> its child plays a Legacy career)
// plus GK (female), CB, female AM (spender, business), heavy gambler.
const CONFIGS_R2: PtConfig[] = [
  { seed: 1905, first: 'Burak', last: 'Yılmaz', gender: 'male', nationality: 'TR', archetype: 'poacher', background: 'lateBloomer', persona: 'pro', startAge: 20, seasons: 15 },
  { seed: 777, first: 'Elif', last: 'Kaya', gender: 'female', nationality: 'TR', archetype: 'keeper', background: 'street', persona: 'social', startAge: 17 },
  { seed: 31337, first: 'Mert', last: 'Aydın', gender: 'male', nationality: 'DE', archetype: 'wall', background: 'lateBloomer', persona: 'party', startAge: 18 },
  { seed: 2026, first: 'Zeynep', last: 'Şahin', gender: 'female', nationality: 'EN', archetype: 'playmaker', background: 'academy', persona: 'spender', startAge: 16 },
  { seed: 6161, first: 'Efe', last: 'Yılmaz', gender: 'male', nationality: 'TR', archetype: 'winger', background: 'footballFamily', persona: 'pro', startAge: 16, legacyOf: 0 },
  { seed: 9001, first: 'Can', last: 'Demir', gender: 'male', nationality: 'BR', archetype: 'winger', background: 'footballFamily', persona: 'gambler', startAge: 18, heavy: true },
]

// Round 3 (PLAYTEST_PLAN=r3): 6 careers x 10 seasons (ST, LW heavy gambler, CM investor/project builder,
// CB, GK, female AM) + an 18-season run through retirement and its Legacy child for 4 seasons.
const CONFIGS_R3: PtConfig[] = [
  { seed: 1907, first: 'Okan', last: 'Çelik', gender: 'male', nationality: 'TR', archetype: 'poacher', background: 'academy', persona: 'pro', startAge: 17 },
  { seed: 9002, first: 'Rafael', last: 'Souza', gender: 'male', nationality: 'BR', archetype: 'winger', background: 'street', persona: 'gambler', startAge: 18, heavy: true },
  { seed: 4848, first: 'Emre', last: 'Koç', gender: 'male', nationality: 'TR', archetype: 'boxToBox', background: 'footballFamily', persona: 'investor', startAge: 17 },
  { seed: 3131, first: 'Jonas', last: 'Weber', gender: 'male', nationality: 'DE', archetype: 'wall', background: 'lateBloomer', persona: 'party', startAge: 18 },
  { seed: 2121, first: 'Tolga', last: 'Aksoy', gender: 'male', nationality: 'TR', archetype: 'keeper', background: 'academy', persona: 'social', startAge: 17 },
  { seed: 6060, first: 'Ayşe', last: 'Demirtaş', gender: 'female', nationality: 'TR', archetype: 'playmaker', background: 'street', persona: 'spender', startAge: 16 },
  { seed: 1903, first: 'Hakan', last: 'Güler', gender: 'male', nationality: 'TR', archetype: 'poacher', background: 'street', persona: 'investor', startAge: 17, seasons: 18 },
  { seed: 7171, first: 'Ali', last: 'Güler', gender: 'male', nationality: 'TR', archetype: 'winger', background: 'footballFamily', persona: 'pro', startAge: 16, legacyOf: 6, seasons: 4 },
]

type Phase = 'genç (≤20)' | 'yükseliş (21–24)' | 'zirve (25–30)' | 'düşüş (31+)'
const PHASES: Phase[] = ['genç (≤20)', 'yükseliş (21–24)', 'zirve (25–30)', 'düşüş (31+)']
const phaseOf = (a: number): Phase => (a <= 20 ? PHASES[0] : a <= 24 ? PHASES[1] : a <= 30 ? PHASES[2] : PHASES[3])

const input = (c: PtConfig): NewGameInput => ({
  firstName: c.first, lastName: c.last, nickname: c.first, nationality: c.nationality, birthYear: 2026 - c.startAge,
  position: POS[c.archetype], foot: 'R', archetype: c.archetype, background: c.background,
  appearance: { skin: 1, hairStyle: 2, hairColor: 0, beard: 0, eyeColor: 1, face: 0, accessory: 0 }, gender: c.gender, difficulty: 'normal',
})

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const tr = (t: LText | string | undefined): string => (typeof t === 'string' ? t : t?.tr ?? '')
const norm = (s: string): string => s.replace(/[€$£]?\s?-?\d[\d.,]*\s?[KMB]?/g, '#').replace(/\s+/g, ' ').trim()

// ───────────── Choice trade-off analysis (static, per card shown) ─────────────

const GOOD_STATS = new Set(['happiness', 'health', 'energy', 'morale', 'form', 'sharpness', 'managerTrust'])
function deltaSign(d: Delta): number {
  switch (d.kind) {
    case 'money': case 'reputation': case 'followers': case 'discipline': case 'attr': case 'brand': case 'relation':
      return Math.sign(d.amount)
    case 'stat': return GOOD_STATS.has(d.key) ? Math.sign(d.amount) : -Math.sign(d.amount)
    case 'injury': case 'suspension': case 'endRelation': case 'sponsorLoss': return -1
    case 'objective': return 0
  }
  return 0
}
function fmtDelta(d: Delta): string {
  switch (d.kind) {
    case 'money': return `para ${d.amount > 0 ? '+' : ''}${Math.round(d.amount)}`
    case 'relation': return `${d.name ?? d.npcId ?? d.target} ${d.amount > 0 ? '+' : ''}${d.amount}`
    case 'stat': return `${d.key} ${d.amount > 0 ? '+' : ''}${d.amount}`
    case 'attr': return `${d.key} ${d.amount > 0 ? '+' : ''}${d.amount}`
    case 'reputation': return `itibar ${d.amount > 0 ? '+' : ''}${d.amount}`
    case 'followers': return `takipçi ${d.amount > 0 ? '+' : ''}${d.amount}`
    case 'discipline': return `disiplin ${d.amount > 0 ? '+' : ''}${d.amount}`
    case 'injury': return `sakatlık ${d.weeks}h`
    case 'suspension': return `ceza ${d.matches} maç`
    case 'endRelation': return `ilişki bitti (${d.target})`
    case 'brand': return `marka ${d.amount}`
  }
  return '?'
}

interface ChoiceProfile { pos: number; neg: number; text: string }

function profileChoices(s: GameState, defId: string, vars: Record<string, string | number>): ChoiceProfile[] | null {
  const def = getEventDef(defId)
  if (!def) return null
  const ctx: EventCtx = { state: s, vars, absWeek: 0, tags: [] }
  const out: ChoiceProfile[] = []
  for (const c of def.choices) {
    if (c.requires && !safe(() => c.requires!(ctx), false)) continue
    // Average over a few rolls so random outcomes count.
    let pos = 0
    let neg = 0
    let text = ''
    for (let k = 0; k < 4; k++) {
      const r = safe(() => c.effects(ctx, new Rng(1000 + k)), null)
      if (!r) continue
      for (const d of r.deltas) {
        const sg = deltaSign(d)
        if (sg > 0) pos += 0.25
        if (sg < 0) neg += 0.25
      }
      if (k === 0) text = tr(r.text)
    }
    out.push({ pos, neg, text })
  }
  return out
}

function safe<T>(f: () => T, fb: T): T {
  try {
    return f()
  } catch {
    return fb
  }
}

// ───────────── Text checks ─────────────

/** Turkish case suffix after a proper noun ("Name'suffix") that does not match vowel harmony / buffer rules. */
const SUFFIX_OK = new Set(["Kemal'i", "Instagram'da"])
function suffixIssues(text: string): string[] {
  const out: string[] = []
  const re = /([A-ZÇĞİÖŞÜ][\p{L}]+)'([a-zçğıöşü]+)/gu
  for (const m of text.matchAll(re)) {
    if (SUFFIX_OK.has(m[0])) continue
    const fixed = reinflect(m[1], m[2])
    if (fixed !== null && fixed !== m[2]) out.push(`${m[0]} (→ ${m[1]}'${fixed})`)
  }
  return out
}

interface Flag { kind: string; career: number; when: string; text: string }

// ───────────── Career run ─────────────

interface WeekRec {
  season: number
  week: number
  cards: number
  heroMatches: number
  offers: number
  news: number
  heroNews: number
  inSeason: boolean
  objectiveEvents: number
  age: number
  newCards: number
  national: number
  awards: number
  interviews: number
}

interface CareerOut {
  cfg: PtConfig
  transcript: string[]
  cards: { defId: string; title: string; category: string; season: number; week: number; choice: string; age: number }[]
  news: string[]
  logs: string[]
  weeks: WeekRec[]
  flags: Flag[]
  noTradeoff: Record<string, number>
  matches: number
  seasons: { season: number; age: number; ovr: number; rep: number; money: number; netWorth: number; wage: number; club: string; tier: number | null; apps: number; goals: number; trophies: number; purchases: number; moneyIdleWeeks: number; proj: string; mates: string; vip: number }[]
  commentary: string[]
  repFrom: Record<string, number>
  objectives: string[]
  summary: CareerSummary | null
  retiredAge: number | null
  retireLog: string[]
  feat: Record<string, number>
  heroNewsByPhase: Record<string, string[]>
  decisions: string[]
  passSpread: number[]
}

function runPlaytest(cfg: PtConfig, idx: number, seasons: number, legacy?: LegacyStart): CareerOut {
  const s = newGame({ ...input(cfg), ...(legacy ? { legacy } : {}) }, cfg.seed)
  const rng = new Rng(cfg.seed ^ 0xa11ce)
  const out: CareerOut = { cfg, transcript: [], cards: [], news: [], logs: [], weeks: [], flags: [], noTradeoff: {}, matches: 0, seasons: [], commentary: [], repFrom: {}, objectives: [], summary: null, retiredAge: null, retireLog: [], feat: {}, heroNewsByPhase: {}, decisions: [], passSpread: [] }
  const T = out.transcript
  const feat = (k: string, n = 1) => { out.feat[k] = (out.feat[k] ?? 0) + n }
  const seenCards = new Set<string>()
  let peakOvr = 0
  const when = () => `S${s.calendar.season - startSeason + 1} H${s.calendar.week} ${DAYS[s.calendar.day] ?? '?'}`
  const startSeason = s.calendar.season
  const age = () => heroAge(s.hero, s.calendar.season)
  let lastLog = s.life.log[s.life.log.length - 1]
  let lastNews = s.life.news[s.life.news.length - 1]
  let wk: WeekRec = freshWeek()
  let purchases = 0
  let idleMoneyWeeks = 0
  function freshWeek(): WeekRec {
    return { season: s.calendar.season, week: s.calendar.week, cards: 0, heroMatches: 0, offers: 0, news: 0, heroNews: 0, inSeason: s.calendar.week >= 1 && s.calendar.week <= 41, objectiveEvents: 0, age: heroAge(s.hero, s.calendar.season), newCards: 0, national: 0, awards: 0, interviews: 0 }
  }
  const rep = <T,>(cat: string, f: () => T): T => {
    const r0 = s.hero.reputation
    const v = f()
    out.repFrom[cat] = (out.repFrom[cat] ?? 0) + (s.hero.reputation - r0)
    return v
  }
  const flag = (kind: string, text: string) => out.flags.push({ kind, career: idx, when: when(), text })

  const heroNameRe = new RegExp(`${cfg.first}|${cfg.last}`)
  const drain = () => {
    const L = s.life.log
    const i = lastLog ? L.lastIndexOf(lastLog) : -1
    for (const e of L.slice(i + 1)) {
      const t = tr(e.text)
      out.logs.push(norm(t))
      T.push(`[${when()}] ${e.icon ?? '·'} ${t}`)
      if (/\{[a-zA-Z]+\}/.test(t)) flag('placeholder', t)
      for (const x of suffixIssues(t)) flag('ek', `${x} ← ${t}`)
      if (e.icon === '🎯' || e.icon === '⌛') wk.objectiveEvents++
      if (/[Mm]illi|U21|U19|A [Tt]akım|kadroya çağr/.test(t)) wk.national++
      if (e.icon === '🎯' || e.icon === '⌛') out.objectives.push(t.startsWith('Yeni') ? 'yeni' : t.startsWith('Sezon hedefi') ? 'sezon' : t.startsWith('Hedef tamam') ? 'tamam' : 'kaçtı')
    }
    lastLog = L[L.length - 1]
    const N = s.life.news
    const j = lastNews ? N.lastIndexOf(lastNews) : -1
    for (const n of N.slice(j + 1)) {
      const h = tr(n.headline)
      out.news.push(h)
      wk.news++
      if (heroNameRe.test(h)) {
        wk.heroNews++
        ;(out.heroNewsByPhase[phaseOf(age())] ??= []).push(norm(h))
      }
      T.push(`[${when()}] 📰 ${h} — ${n.source}${n.sentiment > 0 ? ' (+)' : n.sentiment < 0 ? ' (−)' : ''}`)
      if (/\{[a-zA-Z]+\}/.test(h)) flag('placeholder', h)
      for (const x of suffixIssues(h)) flag('ek', `${x} ← ${h}`)
      if (cfg.gender === 'female' && /\b(adam|delikanlı|bey)\b/i.test(h)) flag('cinsiyet', h)
    }
    lastNews = N[N.length - 1]
  }

  const choosePick = (enabled: number[], risks: (string | undefined)[]): number => {
    const p = cfg.persona
    const safeOnes = enabled.filter((i) => risks[i] !== 'high')
    const bold = enabled.filter((i) => risks[i] === 'high' || risks[i] === 'medium')
    if ((p === 'pro' || p === 'investor') && safeOnes.length && rng.chance(0.7)) return rng.pick(safeOnes)
    if ((p === 'party' || p === 'gambler') && bold.length && rng.chance(0.6)) return rng.pick(bold)
    return rng.pick(enabled)
  }

  const answerCards = () => {
    for (let g = 0; g < 10 && s.pendingEvents.length; g++) {
      const pe = s.pendingEvents[0]
      const v = describeEvent(s, pe, 'tr')
      if (!v) {
        s.pendingEvents.splice(0, 1)
        continue
      }
      const hasPartner = Object.values(s.life.relationships).some((r) => r.kind === 'partner')
      const blob = `${v.title} ${v.text} ${v.choices.map((c) => c.label).join(' ')}`
      if (/\{[a-zA-Z]+\}/.test(blob)) flag('placeholder', `${v.defId}: ${blob.slice(0, 160)}`)
      for (const x of suffixIssues(blob)) flag('ek', `${v.defId}: ${x}`)
      const def = getEventDef(pe.defId)
      const usesPartner = !!def && [def.title, def.text, ...def.choices.map((c) => c.label)].some((x) => placeholdersOf(x).includes('partnerName'))
      if (!hasPartner && (usesPartner || /sevgilin|partnerin|ilişkiniz/i.test(blob))) flag('hayalet-partner', `${v.defId}: ${v.title} — ${v.text.slice(0, 120)}`)
      const liveBlob = `${v.title} ${v.text} ${v.choices.filter((c) => c.enabled).map((c) => c.label).join(' ')}`
      if (!s.life.agent && /menajerin|ajanın/i.test(liveBlob) && !/menajer bul|ajan tut/i.test(liveBlob)) flag('hayalet-ajan', `${v.defId}: ${v.title}`)
      if (!s.hero.contract && /kulübün|takım arkadaş|hocan/i.test(blob)) flag('kulüpsüz', `${v.defId}: ${v.title}`)
      if (age() < 18 && /(?<!\p{L})(içki|bira|şarap|şampanya|kokteyl|bahis|kumar\p{L}*|gece kulübü|sarhoş)(?!\p{L})/iu.test(blob)) flag('yaş', `${age()} yaş — ${v.defId}: ${v.title}`)
      if (cfg.gender === 'female' && /\b(kız arkadaşın|delikanlı|beyefendi)\b/i.test(blob)) flag('cinsiyet', `${v.defId}: ${v.title}`)
      const enabled = v.choices.map((c, i) => (c.enabled ? i : -1)).filter((i) => i >= 0)
      const prof = profileChoices(s, pe.defId, pe.vars)
      if (prof && prof.length >= 2) {
        const best = prof.find((p) => p.neg === 0 && p.pos > 0 && prof.every((q) => q === p || (q.neg > 0 && q.pos <= p.pos)))
        if (best) out.noTradeoff[pe.defId] = (out.noTradeoff[pe.defId] ?? 0) + 1
        if (prof.every((p) => p.text === prof[0].text)) flag('aynı-sonuç', `${pe.defId}`)
      }
      const invest = enabled.filter((i) => /yatır|inşa|kur\b|kuralım|ortak|hisse|fon|temel at|büyüt/i.test(v.choices[i]?.label ?? ''))
      const pick = cfg.persona === 'investor' && invest.length && rng.chance(0.75) ? rng.pick(invest) : enabled.length ? choosePick(enabled, v.choices.map((c) => c.risk)) : 0
      const r = rep('kart', () => resolveEventChoice(s, 0, pick))
      if (!r.ok && s.pendingEvents[0] === pe) s.pendingEvents.splice(0, 1)
      wk.cards++
      if (!seenCards.has(v.defId)) wk.newCards++
      seenCards.add(v.defId)
      out.cards.push({ defId: v.defId, title: v.title, category: v.category, season: s.calendar.season, week: s.calendar.week, choice: v.choices[pick]?.label ?? '', age: age() })
      T.push(`[${when()}] 🃏 KART «${v.title}» (${v.defId}) ${v.text}`)
      T.push(`      seçenekler: ${v.choices.map((c, i) => `${i === pick ? '▶' : ''}${c.label}${c.enabled ? '' : ' [kilitli]'}${c.risk ? ` {${c.risk}}` : ''}`).join(' | ')}`)
      if (r.value) T.push(`      sonuç: ${tr(r.value.text)} [${r.value.deltas.map(fmtDelta).join(', ')}]`)
      drain()
    }
  }

  const playMatch = () => {
    const nf = nextHeroFixture(s)
    const club = heroClub(s)
    if (nf && rng.chance(0.2)) {
      const qs = safe(() => preMatchQuestions(s, { opponent: nf.opponentName }), [])
      if (qs.length) { wk.interviews++; feat('röportaj (maç önü)') }
      for (const q of qs) {
        const o = rng.pick(q.options)
        const a = rep('röportaj', () => answerInterview(s, q.id, o.id))
        T.push(`      🎙️ (maç önü) ${tr(q.text)} → ${tr(o.label)}`)
        if (a.done && a.headline) T.push(`      🗞️ ${tr(a.headline)}`)
      }
    }
    const live = rng.chance(0.4)
    const mr = rep('maç', () => (live ? playLive() : autoPlayHeroMatch(s, 'tr')))
    if (!mr) return
    out.matches++
    wk.heroMatches++
    const comp = nf ? tr(nf.compName) : '?'
    const opp = nf?.opponentName ?? '?'
    const home = nf?.isHome ?? true
    const score = home ? `${club?.name ?? '?'} ${mr.goalsFor}-${mr.goalsAgainst} ${opp}` : `${opp} ${mr.goalsAgainst}-${mr.goalsFor} ${club?.name ?? '?'}`
    const mine = mr.result.scorers.filter((x) => x.playerId === 'hero').length
    T.push(`[${when()}] ⚽ MAÇ (${comp}) ${score} — puan ${mr.rating.toFixed(1)}, ${mr.minutes}', ${mine} gol`)
    for (const l of mr.lines.slice(0, 4)) out.commentary.push(norm(tr(l)))
    drain()
    // Post-match interview, sometimes.
    if (mr.minutes > 0 && rng.chance(0.45)) {
      const qs = interviewQuestions(s, { won: mr.won, drew: mr.drew, goals: mine, assists: 0, rating: mr.rating, motm: false, started: mr.minutes > 60, minutes: mr.minutes, opponent: opp })
      if (qs.length) { wk.interviews++; feat('röportaj (maç sonu)') }
      for (const q of qs) {
        const o = rng.pick(q.options)
        const a = rep('röportaj', () => answerInterview(s, q.id, o.id))
        T.push(`      🎤 ${tr(q.text)} → ${tr(o.label)}`)
        if (a.done && a.headline) T.push(`      🗞️ ${tr(a.headline)}`)
      }
      drain()
    }
  }

  /** A "watched" match like the live hub: minute by minute, decision windows opened by the same pure rules, random answers. */
  const playLive = () => {
    const sim = startHeroMatch(s, 'tr')
    if (!sim) return null
    const blob = readJson<{ setup?: { heroSide?: 'home' | 'away' } } | null>(s.life, GFLAG.match, null)
    const side = blob?.setup?.heroSide ?? 'home'
    const seed = `${s.calendar.season}:${s.calendar.week}:${s.calendar.day}`
    let lastMinute = -99
    for (let guard = 0; !sim.finished && guard < 1000; guard++) {
      if (sim.pendingHighlight) { sim.skipHighlight(); continue }
      sim.step()
      const snap = sim.snapshot()
      const ev = snap.events[snap.events.length - 1]
      const diff = side === 'home' ? snap.score[0] - snap.score[1] : snap.score[1] - snap.score[0]
      const kind = pickDecision({
        seed, minute: snap.minute, shown: pendingDecisions(s).length, lastMinute, heroOnPitch: snap.heroOnPitch, diff,
        last: ev ? { type: ev.type, own: ev.side ? ev.side === side : null, minute: ev.minute } : null,
        isCaptain: s.hero.contract?.role === 'captain', heroOvr: heroOvr(s.hero), heroYellow: snap.heroStats.yellow,
        recent: snap.events.filter((e) => snap.minute - e.minute <= 1).map((e) => ({ type: e.type, own: e.side ? e.side === side : null, minute: e.minute })),
        isKeeper: s.hero.position === 'GK',
      })
      if (!kind) continue
      const def = decisionDef(kind, heroOvr(s.hero))
      const opt = rng.pick(def.options)
      const o = resolveDecision(def, opt.id, `${seed}:${snap.minute}`)
      recordDecision(s, o)
      sim.applyHeroDecision(o.effects.rating, o.effects.book)
      lastMinute = snap.minute
      feat(`maç içi karar: ${kind}`)
      out.decisions.push(`${kind}/${opt.id}${o.won === null ? '' : o.won ? ' ✓' : ' ✗'}`)
    }
    const pairs = Object.values(sim.snapshot().passNet ?? {})
    if (pairs.length > 1) out.passSpread.push(Math.max(...pairs.map((p) => p.from)) - Math.min(...pairs.map((p) => p.from)))
    applyPendingDecisions(s)
    feat('canlı izlenen maç')
    return finishHeroMatch(s, sim)
  }

  const eveningChoice = (): string => {
    const hasPartner = Object.values(s.life.relationships).some((r) => r.kind === 'partner')
    const p = cfg.persona
    const a = age()
    const opts: [string, number][] = [
      ['rest', 3], ['family_visit', 1.2], ['friend_hangout', p === 'social' ? 2.5 : 1], ['team_dinner', 1], ['hobby_gaming', 0.8], ['hobby_music', 0.5],
      ['shopping', p === 'spender' ? 2 : 0.4], ['social_post', 0.6],
    ]
    if (hasPartner) opts.push(['date_night', p === 'social' ? 2 : 1])
    if (a >= 18) opts.push(['party', p === 'party' ? 3 : p === 'social' ? 0.8 : 0.25], ['casino', cfg.heavy ? 4 : p === 'gambler' ? 1.6 : 0.08])
    return rng.weighted(opts, (x) => x[1])[0]
  }
  const dayChoice = (slot: number): string | null => {
    const r = rng.next()
    if (r < 0.06) return 'sponsor_shoot'
    if (r < 0.1) return 'interview'
    if (r < 0.13) return 'charity'
    if (r < 0.16 && slot === 1) return 'hobby_golf'
    if (r < 0.2) return 'gym'
    if (r < 0.25) return 'video'
    if (r < 0.27 && slot === 0 && cfg.persona === 'party') return 'sleep_in'
    return null
  }

  const playDay = () => {
    const d0 = s.calendar.day
    const w0 = s.calendar.week
    for (let step = 0; step < 4; step++) {
      if (s.calendar.day !== d0 || s.calendar.week !== w0) break
      answerCards()
      const ctx = activityContext(s)
      if (isHeroMatchday(s) && s.calendar.slot === 2) {
        playMatch()
        answerCards()
      }
      const plan = autoPlanDay(s.hero, s.life, ctx)[0]
      let id = plan?.activityId ?? 'rest'
      let opts = plan?.options ?? {}
      const free = !ctx.matchToday && !ctx.matchTomorrow && !s.hero.injury && s.life.energy > 35
      if (free) {
        const alt = s.calendar.slot === 2 ? eveningChoice() : rng.chance(0.4) ? dayChoice(s.calendar.slot) : null
        if (alt && ACTIVITY_BY_ID[alt] && !activityBlock(s.hero, s.life, ACTIVITY_BY_ID[alt], ctx)) {
          id = alt
          opts = {}
        }
      }
      // Training mini-game score varies like a human.
      if (id.startsWith('train_')) opts = { ...opts, performance: Math.min(1, Math.max(0.2, rng.range(0.35, 0.95))) }
      const r0 = s.hero.reputation
      const r = doActivity(s, id, opts)
      out.repFrom[r.advance ? 'gün-sonu (aktivite+haftalık tik)' : `aktivite:${id.startsWith('train_') ? 'antrenman' : id}`] = (out.repFrom[r.advance ? 'gün-sonu (aktivite+haftalık tik)' : `aktivite:${id.startsWith('train_') ? 'antrenman' : id}`] ?? 0) + s.hero.reputation - r0
      drain()
      if (id === 'casino' && r.ok) {
        answerCards()
        // Table limit is 1.5 % of the bankroll (life/casino maxStakeFor); a heavy gambler sits at the limit and plays more hands.
        const stake = Math.max(50, Math.floor((s.life.money * (cfg.heavy ? rng.range(0.011, 0.0145) : rng.range(0.005, 0.014))) / 50) * 50)
        const before = s.life.money
        feat('kumarhane gecesi')
        for (let i = 0; i < rng.int(1, cfg.heavy ? 6 : 4) && s.life.money > stake; i++) {
          if (cfg.heavy && rng.chance(0.2)) {
            const card = horseRaceCard(s).value
            if (card) playHorses(s, rng.int(0, Math.max(0, card.horses.length - 1)), stake)
          } else if (cfg.heavy && rng.chance(0.15)) playDice(s, 'pass', stake)
          else if (rng.chance(0.4)) playSlots(s, stake)
          else if (rng.chance(0.5)) playRoulette(s, [{ type: rng.chance(0.5) ? 'red' : 'black', stake }])
          else {
            let round = blackjackDeal(s, stake).value
            for (let k = 0; k < 6 && round && !round.finished; k++) round = blackjackAct(s, rng.chance(0.6) ? 'stand' : 'hit').value
          }
        }
        T.push(`[${when()}] 🎰 kumarhane: ${Math.round(s.life.money - before)} (bahis ${stake})`)
        feat('kumar net', Math.round(s.life.money - before))
        if (isHeroMatchday(s)) playMatch()
        advanceDay(s)
        drain()
        break
      }
      if (!r.ok) {
        if (!doActivity(s, 'rest').ok) {
          if (isHeroMatchday(s)) playMatch()
          if (s.calendar.slot < 2) s.calendar.slot++
          else advanceDay(s)
        }
        drain()
      }
    }
    answerCards()
  }

  const handleOffers = () => {
    const offers = getOffers(s)
    if (!offers.length) return
    const cur = heroClub(s)
    const curRep = cur?.reputation ?? 0
    const curWage = s.hero.contract?.wage ?? 0
    const repOf = (id: string) => s.world.clubs[id]?.reputation ?? 0
    for (const o of offers) {
      if (out.transcript.some((l) => l.includes(`#${o.id}`))) continue
      T.push(`[${when()}] ✉️ TEKLİF #${o.id}: ${o.clubName} (itibar ${repOf(o.clubId)}) ${o.contract.kind}${o.isLoan ? ' kiralık' : ''} maaş ${o.contract.terms.wage}/hf, ${o.contract.terms.years} yıl, rol ${o.contract.terms.role}`)
      wk.offers++
    }
    const sorted = [...offers].sort((a, b) => repOf(b.clubId) - repOf(a.clubId))
    for (const o of sorted) {
      const rep = repOf(o.clubId)
      const wage = o.contract.terms.wage
      const benched = s.hero.contract?.role === 'youth' || s.hero.contract?.role === 'reserve'
      let take = false
      if (o.contract.kind === 'freeAgent') take = true
      else if (o.contract.kind === 'renewal') take = wage >= curWage * 0.95 && !sorted.some((x) => x.contract.kind !== 'renewal' && repOf(x.clubId) > curRep + 6)
      else if (o.isLoan) take = benched && rep >= curRep - 10
      else take = rep >= curRep + 6 || (rep >= curRep - 3 && wage >= curWage * 1.5)
      if (!take) continue
      // Humans haggle: open talks, ask for +20–35 % once or twice, then sign.
      if (rng.chance(0.6) && startNegotiation(s, o.id).ok) {
        let st = currentNegotiation(s)?.state
        for (let k = 0; k < 2 && st && st.status === 'open'; k++) {
          const res = counterNegotiation(s, { wage: Math.round(st.offer.terms.wage * rng.range(1.15, 1.35)) })
          st = res.value
          T.push(`      🤝 pazarlık: ${res.lines.map(tr).join(' / ')}`)
        }
        if (st && st.status === 'open') acceptNegotiation(s)
        drain()
        if (s.hero.contract?.clubId === o.clubId) {
          T.push(`[${when()}] ✍️ İMZA: ${o.clubName}`)
          feat(o.contract.kind === 'renewal' ? 'sözleşme yenileme' : o.isLoan ? 'kiralık' : 'transfer')
          return
        }
        continue
      }
      if (acceptOffer(s, o.id).ok) {
        T.push(`[${when()}] ✍️ İMZA: ${o.clubName} (${o.contract.kind})`)
        feat(o.contract.kind === 'renewal' ? 'sözleşme yenileme' : o.isLoan ? 'kiralık' : 'transfer')
        drain()
        return
      }
    }
    for (const o of getOffers(s)) if (o.contract.kind !== 'renewal' && o.contract.kind !== 'freeAgent' && rng.chance(0.5)) declineOffer(s, o.id)
  }

  const weekly = () => {
    const h = s.hero
    const life = s.life
    for (const o of getSponsorOffers(s).sort((a, b) => b.deal.weekly - a.deal.weekly)) {
      if (acceptSponsor(s, o.deal.id).ok) T.push(`[${when()}] 🤝 sponsor: ${o.deal.brand} ${o.deal.weekly}/hf`)
    }
    if (h.perkPoints > 0) for (const p of PERKS) if (h.perkPoints > 0 && unlockPerk(s, p.id).ok) T.push(`[${when()}] ⭐ yetenek: ${tr(p.name as LText)}`)
    const want = [4, 3, 2, 1].find((q) => h.reputation >= AGENT_TIERS[q].minReputation && life.money > AGENT_TIERS[q].fee * 4)
    if (want && (life.agent?.quality ?? 0) < want && hireAgent(s, want).ok) T.push(`[${when()}] 🕴️ ajan tutuldu (kalite ${want})`)
    if (!life.trainer && life.money > 80_000 && cfg.persona !== 'party') {
      const grp = h.position === 'GK' ? 'goalkeeping' : h.position === 'ST' ? 'technical' : 'physical'
      if (hireTrainer(s, grp as never, 1).ok) T.push(`[${when()}] 🧑‍🏫 kişisel antrenör`)
    }
    // Business: spenders and pros invest once rich.
    if ((cfg.persona === 'spender' || cfg.persona === 'pro') && businesses(life).length < 2) {
      const kind = BUSINESS_KINDS.find((k) => !businesses(life).some((b) => b.kind === k) && life.money > BUSINESS_DEFS[k].price * 2.5 && h.reputation >= BUSINESS_DEFS[k].minReputation)
      if (kind) {
        const r = openBusiness(life, h, kind, s.calendar)
        if (r.ok) { feat('iş kuruldu'); T.push(`[${when()}] 🏢 İŞ KURDU: ${kind}`) }
      }
    }
    // Investor: builds projects like a player with a plan (academy, stadium, stake in own club, legacy fund).
    if (cfg.persona === 'investor') {
      const free = life.money - ((h.contract?.wage ?? 0) * 20 + 50_000)
      const ap = nextAcademyPrice(life)
      const sp = nextStadiumPrice(life)
      const club = heroClub(s)
      const proj = (name: string, r: { ok: boolean }) => { if (r.ok) { feat(`proje: ${name}`); T.push(`[${when()}] 🏗️ PROJE: ${name}`) } }
      if (ap !== null && free > ap) proj('akademi', buildAcademyStage(life))
      else if (sp !== null && free > sp) proj('stadyum', buildStadiumStage(life))
      else if (club && stakePct(life) < STAKE_MAX_PCT && free > STAKE_PRICE_PER_PCT * 5 && age() >= 27) proj('kulüp hissesi', buyClubStake(life, club.id, 5))
      else if (free > 400_000 && s.calendar.week % 13 === 0) proj('miras fonu', contributeLegacyFund(life, Math.round(free * 0.3)))
      if (businesses(life).length < 3) {
        const kind = BUSINESS_KINDS.find((k) => !businesses(life).some((b) => b.kind === k) && life.money > BUSINESS_DEFS[k].price * 2.5 && h.reputation >= BUSINESS_DEFS[k].minReputation)
        if (kind && openBusiness(life, h, kind, s.calendar).ok) { feat('iş kuruldu'); T.push(`[${when()}] 🏢 İŞ KURDU: ${kind}`) }
      }
    }
    // Press conference now and then.
    if (rng.chance(0.06) && safe(() => canHoldPressConference(s), false)) {
      const qs = safe(() => pressConferenceQuestions(s), null)
      if (qs?.length) {
        feat('basın toplantısı')
        wk.interviews++
        for (const q of qs) {
          const o = rng.pick(q.options)
          const a = rep('röportaj', () => answerInterview(s, q.id, o.id))
          T.push(`      📣 (basın) ${tr(q.text)} → ${tr(o.label)}`)
          if (a.done && a.headline) T.push(`      🗞️ ${tr(a.headline)}`)
        }
      }
    }
    // Bench complaint when stuck.
    if ((h.contract?.role === 'reserve' || h.contract?.role === 'youth') && s.calendar.week % 8 === 4 && rng.chance(0.5)) {
      const r = complainAboutBench(s, rng.pick(['polite', 'demand'] as const))
      T.push(`[${when()}] 🗣️ hocaya forma şikâyeti: ${r.lines.map(tr).join(' / ')}`)
    }
    // Shopping every ~3 weeks.
    const wage = h.contract?.wage ?? 0
    const reserve = wage * 12 + 3_000
    const share = cfg.persona === 'spender' ? 0.5 : cfg.persona === 'party' ? 0.3 : 0.18
    const budget = (life.money - reserve) * share
    const owned = new Set(life.assets.map((a) => a.defId))
    const cands = ASSETS.filter((a) => !owned.has(a.id) && a.price <= budget && purchaseBlock(life, h, a.id) === null && assetUpkeep(life) + a.upkeep <= wage * 0.4)
      .sort((a, b) => b.price - a.price)
    if (s.calendar.week % 3 === 0 && cands.length) {
      const pick = cands[rng.int(0, Math.min(2, cands.length - 1))]
      if (buyAsset(s, pick.id).ok) {
        purchases++
        feat('lüks alım')
        T.push(`[${when()}] 🛒 SATIN ALDI: ${tr(pick.name as LText)} (${pick.price})`)
      }
    } else if (!cands.length && life.money > 20 * Math.max(1000, wage)) idleMoneyWeeks++
    drain()
  }

  let guard = 0
  let lastSeasonSeen = s.calendar.season
  T.push(`=== KARİYER ${idx + 1}: ${cfg.first} ${cfg.last} (${cfg.gender === 'female' ? 'K' : 'E'}, ${cfg.nationality}, ${POS[cfg.archetype]}, ${cfg.background}, persona ${cfg.persona}, ${cfg.startAge} yaş) ===`)
  drain()
  let awardsSeen = s.hero.awards.length
  while (s.calendar.season < startSeason + seasons && guard++ < 8000 && !s.hero.retired) {
    const week = s.calendar.week
    const season = s.calendar.season
    peakOvr = Math.max(peakOvr, heroOvr(s.hero))
    const rs = retirementStatus(s)
    if (rs.decisionDue) {
      const ovr = heroOvr(s.hero)
      const benched = s.hero.contract?.role === 'reserve' || !s.hero.contract
      const go = !!rs.forced || rs.age >= 37 || (rs.age >= 34 && (ovr <= peakOvr - 6 || benched))
      out.retireLog.push(`${rs.age} yaş, OVR ${ovr} (zirve ${peakOvr}), rol ${s.hero.contract?.role ?? '-'} → ${go ? 'EMEKLİ' : 'devam'}${rs.forced ? ` (zorunlu: ${rs.forced})` : ''}`)
      if (go) {
        const r = retireHero(s, { testimonial: true, postCareer: 'pundit', peakOvr, retiredAt: 0 })
        T.push(`[${when()}] 🏁 EMEKLİLİK: ${r.lines.map(tr).join(' / ')}`)
        if (r.summary) { out.summary = r.summary; out.retiredAge = rs.age }
        drain()
        break
      }
      const lines = continueCareer(s)
      T.push(`[${when()}] 💪 KARAR: ${lines.map(tr).join(' / ')}`)
      drain()
    }
    playDay()
    if (s.hero.awards.length > awardsSeen) {
      wk.awards += s.hero.awards.length - awardsSeen
      feat('ödül', s.hero.awards.length - awardsSeen)
      for (const a of s.hero.awards.slice(awardsSeen)) T.push(`[${when()}] 🏆 ÖDÜL: ${tr(a.name)}`)
      awardsSeen = s.hero.awards.length
    }
    rep('transfer', handleOffers)
    if (s.calendar.week !== week || s.calendar.season !== season) {
      out.weeks.push(wk)
      const d = dashboard(s)
      const rels = Object.values(s.life.relationships).filter((r) => ['partner', 'manager', 'bestFriend', 'agent'].includes(r.kind)).map((r) => `${r.kind}:${r.name}=${Math.round(r.value)}`).join(' ')
      const obj = safe(() => objectivesView(s), null)
      const nt = safe(() => heroCallup(s), null)
      T.push(`--- [${when()}] durum: ${age()} yaş, OVR ${heroOvr(s.hero)}, itibar ${Math.round(s.hero.reputation)}, para ${Math.round(s.life.money)}, enerji ${Math.round(s.life.energy)}, mutluluk ${Math.round(s.life.happiness)}, stres ${Math.round(s.life.stress)}, rol ${s.hero.contract?.role ?? '-'}, kulüp ${d.club?.name ?? 'yok'}${d.league ? ` (${d.league.position}./${d.league.teams})` : ''} | ${rels}${nt ? ` | milli ${nt.level} ${nt.meter} (skor ${nt.heroScore}/eşik ${nt.cutoff}; ${Object.entries(nt.parts).map(([k, v]) => `${k}:${v}`).join(',')})` : ''}${obj ? ` | hedefler: ${obj.active.map((o) => `${tr(o.title)} ${o.progress}/${o.target}`).join('; ')}` : ''}`)
      wk = freshWeek()
      rep('haftalık-yönetim', weekly)
    }
    if (s.calendar.season !== lastSeasonSeen) {
      const dg = readJson<SeasonDigest | null>(s.life, GFLAG.lastSeason, null)
      const last = s.hero.history[s.hero.history.length - 1]
      if (dg) T.push(`==== SEZON SONU ${dg.season}: ${dg.clubName} (${dg.leagueName}) ${dg.leaguePosition ?? '-'}. sıra, ${dg.stats.apps} maç ${dg.stats.goals} gol ${dg.stats.assists} asist, ${dg.stats.cleanSheets} temiz; kupalar: ${dg.trophies.map(tr).join(', ') || 'yok'}; ödüller: ${dg.heroAwards.length}; ${dg.movement ?? ''} ====`)
      const c = heroClub(s)
      out.seasons.push({
        season: lastSeasonSeen - startSeason + 1, age: age(), ovr: heroOvr(s.hero), rep: Math.round(s.hero.reputation), money: Math.round(s.life.money), netWorth: Math.round(netWorth(s.life, s.calendar)),
        wage: s.hero.contract?.wage ?? 0, club: c?.name ?? '-', tier: c ? s.world.leagues[c.leagueId]?.tier ?? null : null, apps: last?.stats.apps ?? 0, goals: last?.stats.goals ?? 0,
        trophies: s.hero.trophies.length, purchases, moneyIdleWeeks: idleMoneyWeeks,
        proj: `A${academyLevel(s.life)} S${stadiumLevel(s.life)} H%${stakePct(s.life)} F${Math.round(legacyFund(s.life) / 1000)}K iş${businesses(s.life).length} upk${projectUpkeep(s.life)}`,
        mates: (() => { const v = Object.values(s.life.relationships).filter((r) => r.kind === 'teammate').map((r) => Math.round(r.value)); return v.length ? `${Math.min(...v)}/${Math.round(v.reduce((a, b) => a + b, 0) / v.length)}/${Math.max(...v)}` : '-' })(),
        vip: casinoVipTier(s.life),
      })
      purchases = 0
      idleMoneyWeeks = 0
      lastSeasonSeen = s.calendar.season
    }
  }
  feat('milli maç', s.hero.nationalTeam.caps)
  feat('milli gol', s.hero.nationalTeam.goals)
  feat('kupa', s.hero.trophies.length)
  feat('ilişki: sevgili', Object.values(s.life.relationships).some((r) => r.kind === 'partner') ? 1 : 0)
  if (!out.summary && cfg.seasons && cfg.seasons > 10) {
    // Never retired inside the window: build the documentary anyway (as the UI would on retiring).
    out.summary = safe(() => buildCareerSummary(s, { peakOvr }), null)
  }
  if (out.summary) {
    const sm = out.summary
    T.push(`==== BELGESEL: ${sm.name}, ${sm.age} yaş, zirve OVR ${sm.peakOvr}, ${sm.totals.apps} maç ${sm.totals.goals} gol, ${sm.caps} milli maç, kupalar ${sm.trophies.length}, ödüller ${sm.awards.length}, miras puanı ${sm.legacyScore} (${tr(legacyTier(sm.legacyScore))}) ====`)
    for (const m of sm.bestMoments) T.push(`      ★ ${tr(m)}`)
  }
  return out
}

// ───────────── Analysis ─────────────

function top<T extends string>(xs: T[], n: number): [T, number][] {
  const m = new Map<T, number>()
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

export function analyse(runs: CareerOut[]): string {
  const o: string[] = []
  const allCards = runs.flatMap((r) => r.cards)
  const weeks = runs.flatMap((r) => r.weeks)
  o.push(`# Playtest analizi (${runs.length} kariyer)`, '')
  o.push(`Toplam hafta ${weeks.length}, kart ${allCards.length} (haftada ${(allCards.length / weeks.length).toFixed(2)}), maç ${runs.reduce((a, r) => a + r.matches, 0)}`, '')
  // Distinct cards
  const distinct = new Set(allCards.map((c) => c.defId)).size
  o.push(`Farklı kart: ${distinct}`, '')
  // Repetition per career-season
  const perSeason = new Map<string, number>()
  for (const r of runs) for (const c of r.cards) {
    const k = `${r.cfg.seed}|${c.season}|${c.defId}`
    perSeason.set(k, (perSeason.get(k) ?? 0) + 1)
  }
  const over3 = [...perSeason.values()].filter((v) => v > 3).length
  const maxSeason = Math.max(0, ...perSeason.values())
  const perCareer = new Map<string, number>()
  for (const r of runs) for (const c of r.cards) perCareer.set(`${r.cfg.seed}|${c.defId}`, (perCareer.get(`${r.cfg.seed}|${c.defId}`) ?? 0) + 1)
  const careerMax = [...perCareer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  o.push(`Aynı kart bir sezonda >3 kez: ${over3} durum (en fazla ${maxSeason})`, '')
  o.push('Kariyer başına en çok tekrar eden kartlar:', ...careerMax.map(([k, v]) => `- ${k.split('|')[1]} ×${v} (seed ${k.split('|')[0]})`), '')
  o.push('## En sık kartlar (tümü)', '', ...top(allCards.map((c) => c.defId), 20).map(([k, v]) => `- ${k}: ${v}`), '')
  o.push('## Kategori dağılımı', '', ...top(allCards.map((c) => c.category), 30).map(([k, v]) => `- ${k}: ${v} (${((v / allCards.length) * 100).toFixed(1)}%)`), '')
  // News
  const news = runs.flatMap((r) => r.news.map(norm))
  const nTop = top(news, 15)
  o.push('## En sık manşetler (sayılar # ile)', '', `Toplam manşet ${news.length}, farklı ${new Set(news).size} (${((new Set(news).size / Math.max(1, news.length)) * 100).toFixed(0)}% benzersiz)`, '', ...nTop.map(([k, v]) => `- ×${v} ${k}`), '')
  const logs = runs.flatMap((r) => r.logs)
  o.push('## En sık günlük satırları', '', `Toplam ${logs.length}, farklı ${new Set(logs).size}`, '', ...top(logs, 25).map(([k, v]) => `- ×${v} ${k.slice(0, 140)}`), '')
  const com = runs.flatMap((r) => r.commentary)
  o.push('## Maç özet satırları', '', `Toplam ${com.length}, farklı ${new Set(com).size}`, '', ...top(com, 10).map(([k, v]) => `- ×${v} ${k.slice(0, 140)}`), '')
  // Dead weeks
  const dead = weeks.filter((w) => w.cards === 0 && w.heroMatches === 0 && w.offers === 0 && w.heroNews === 0 && w.objectiveEvents === 0)
  const quiet = weeks.filter((w) => w.cards === 0 && w.offers === 0 && w.heroNews === 0 && w.objectiveEvents === 0)
  const noMatchWeeks = weeks.filter((w) => w.heroMatches === 0)
  o.push('## Ölü haftalar', '',
    `- Ölü (kart yok, maç yok, teklif yok, hakkında haber yok, hedef olayı yok): ${dead.length}/${weeks.length} (${((dead.length / weeks.length) * 100).toFixed(1)}%) — sezon içi ${dead.filter((w) => w.inSeason).length}, sezon dışı ${dead.filter((w) => !w.inSeason).length}`,
    `- Sessiz (maç olsa da kart/teklif/haber/hedef yok): ${quiet.length} (${((quiet.length / weeks.length) * 100).toFixed(1)}%)`,
    `- Kahramanın maç oynamadığı hafta: ${noMatchWeeks.length} (${((noMatchWeeks.length / weeks.length) * 100).toFixed(1)}%)`,
    `- Ölü hafta dizileri (≥2 ardışık): ${runs.map((r) => streaks(r.weeks)).reduce((a, b) => a + b, 0)}`,
    `- Hafta başına hedef olayı: ${(weeks.reduce((a, w) => a + w.objectiveEvents, 0) / weeks.length).toFixed(2)}`, '')
  // Flags
  const flags = runs.flatMap((r) => r.flags)
  o.push('## Otomatik tutarlılık bayrakları', '', ...top(flags.map((f) => f.kind), 20).map(([k, v]) => `- ${k}: ${v}`), '')
  for (const kind of new Set(flags.map((f) => f.kind))) {
    o.push(`### ${kind} (örnekler)`, ...top(flags.filter((f) => f.kind === kind).map((f) => f.text.slice(0, 160)), 8).map(([k, v]) => `- ×${v} ${k}`), '')
  }
  // Trade-offs
  const nt = new Map<string, number>()
  for (const r of runs) for (const [k, v] of Object.entries(r.noTradeoff)) nt.set(k, (nt.get(k) ?? 0) + v)
  o.push('## Bedelsiz baskın seçenekli kartlar (gösterim sayısı)', '', ...[...nt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `- ${k}: ${v}`), '')
  const ob = runs.flatMap((r) => r.objectives)
  const obc = (k: string) => ob.filter((x) => x === k).length
  o.push('## Hedefler', '', `- Yeni kısa hedef: ${obc('yeni')}, sezon hedefi: ${obc('sezon')}, tamamlanan: ${obc('tamam')}, kaçan: ${obc('kaçtı')} (başarı ${((obc('tamam') / Math.max(1, obc('tamam') + obc('kaçtı'))) * 100).toFixed(0)}%)`, `- Kariyer-sezon başına yeni hedef: ${((obc('yeni') + obc('sezon')) / Math.max(1, runs.reduce((a, r) => a + r.seasons.length, 0))).toFixed(1)}`, '')
  const rf = new Map<string, number>()
  for (const r of runs) for (const [k, v] of Object.entries(r.repFrom)) rf.set(k, (rf.get(k) ?? 0) + v)
  const cs = runs.reduce((a, r) => a + r.seasons.length, 0)
  o.push('## İtibar kaynakları (kariyer-sezon başına)', '', ...[...rf.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${(v / Math.max(1, cs)).toFixed(2)}`), '')
  // Phase pacing
  o.push('## Kariyer evresine göre tempo', '', '| Evre | Hafta | Kart/hf | Yeni kart payı | Kahraman haberi/hf | Hedef olayı/hf | Milli/hf | Ödül | Röportaj/hf | Ölü % | Sessiz % |', '|---|---|---|---|---|---|---|---|---|---|---|')
  for (const ph of PHASES) {
    const ws = weeks.filter((w) => phaseOf(w.age) === ph)
    if (!ws.length) continue
    const sum = (f: (w: WeekRec) => number) => ws.reduce((a, w) => a + f(w), 0)
    const dd = ws.filter((w) => w.cards === 0 && w.heroMatches === 0 && w.offers === 0 && w.heroNews === 0 && w.objectiveEvents === 0).length
    const qq = ws.filter((w) => w.cards === 0 && w.offers === 0 && w.heroNews === 0 && w.objectiveEvents === 0).length
    o.push(`| ${ph} | ${ws.length} | ${(sum((w) => w.cards) / ws.length).toFixed(2)} | ${((sum((w) => w.newCards) / Math.max(1, sum((w) => w.cards))) * 100).toFixed(0)}% | ${(sum((w) => w.heroNews) / ws.length).toFixed(2)} | ${(sum((w) => w.objectiveEvents) / ws.length).toFixed(2)} | ${(sum((w) => w.national) / ws.length).toFixed(2)} | ${sum((w) => w.awards)} | ${(sum((w) => w.interviews) / ws.length).toFixed(2)} | ${((dd / ws.length) * 100).toFixed(1)} | ${((qq / ws.length) * 100).toFixed(1)} |`)
  }
  o.push('')
  // Novelty by career season
  o.push('## Yenilik: sezona göre ilk kez görülen kart payı', '')
  const bySeason = new Map<number, { n: number; fresh: number }>()
  for (const r of runs) {
    const seen = new Set<string>()
    const s0 = r.cards[0]?.season ?? 0
    for (const c of r.cards) {
      const k = c.season - s0 + 1
      const e = bySeason.get(k) ?? { n: 0, fresh: 0 }
      e.n++
      if (!seen.has(c.defId)) e.fresh++
      seen.add(c.defId)
      bySeason.set(k, e)
    }
  }
  o.push(...[...bySeason.entries()].sort((a, b) => a[0] - b[0]).map(([k, e]) => `- S${k}: ${e.n} kart, ilk kez ${((e.fresh / e.n) * 100).toFixed(0)}%`), '')
  // Hero headline repetition per phase
  o.push('## Kahraman manşetleri: evreye göre benzersizlik', '')
  for (const ph of PHASES) {
    const hs = runs.flatMap((r) => r.heroNewsByPhase[ph] ?? [])
    if (!hs.length) continue
    o.push(`- ${ph}: ${hs.length} manşet, ${((new Set(hs).size / hs.length) * 100).toFixed(0)}% benzersiz; en sık: ${top(hs, 3).map(([k, v]) => `×${v} «${k.slice(0, 70)}»`).join(' · ')}`)
  }
  o.push('')
  // New systems (round 3)
  o.push('## Yeni sistemler (Tur 3)', '')
  for (const r of runs) {
    const ps = r.passSpread
    o.push(`- ${r.cfg.first}: maç içi karar ${r.decisions.length} (${top(r.decisions, 5).map(([k, v]) => `${k}×${v}`).join(', ')}); pas ağı farkı ort ${ps.length ? (ps.reduce((a, b) => a + b, 0) / ps.length).toFixed(1) : '-'}`)
  }
  const projCards = allCards.filter((c) => /academy|stadium|stake|legacy_fund/.test(c.defId))
  const bizCards = allCards.filter((c) => c.defId.startsWith('business') || c.defId.startsWith('biz'))
  o.push('', `- Proje kartları: ${projCards.length} (${top(projCards.map((c) => c.defId), 12).map(([k, v]) => `${k}×${v}`).join(', ')})`, `- İş kartları: ${bizCards.length} (${top(bizCards.map((c) => c.defId), 15).map(([k, v]) => `${k}×${v}`).join(', ')})`)
  for (const r of runs) {
    const pc = r.cards.filter((c) => /academy|stadium|stake|legacy_fund/.test(c.defId)).length
    const bc = r.cards.filter((c) => c.defId.startsWith('business') || c.defId.startsWith('biz')).length
    o.push(`  - ${r.cfg.first}: proje kartı ${pc}, iş kartı ${bc}`)
  }
  o.push('')
  // Feature usage
  const keys = [...new Set(runs.flatMap((r) => Object.keys(r.feat)))].sort()
  o.push('## Özellik kullanımı (kariyer başına)', '', `| Özellik | ${runs.map((r) => r.cfg.first).join(' | ')} |`, `|---|${runs.map(() => '---').join('|')}|`)
  for (const k of keys) o.push(`| ${k} | ${runs.map((r) => r.feat[k] ?? 0).join(' | ')} |`)
  o.push('')
  // Retirement
  for (const r of runs.filter((x) => x.retireLog.length || x.summary)) {
    o.push(`## Kariyer sonu: ${r.cfg.first} ${r.cfg.last}`, '', ...r.retireLog.map((x) => `- karar: ${x}`))
    if (r.summary) o.push(`- belgesel: ${r.summary.age} yaş, zirve OVR ${r.summary.peakOvr}, ${r.summary.totals.apps} maç/${r.summary.totals.goals} gol, ${r.summary.caps} milli maç, ${r.summary.trophies.length} kupa, ${r.summary.awards.length} ödül, miras ${r.summary.legacyScore} (${tr(legacyTier(r.summary.legacyScore))}), jübile ${r.summary.testimonial ? r.summary.testimonial.score.join('-') : 'yok'}, en iyi anlar ${r.summary.bestMoments.length}`)
    o.push('')
  }
  o.push('## Sezon özetleri', '')
  for (const r of runs) {
    o.push(`### ${r.cfg.first} ${r.cfg.last} (${r.cfg.persona}, ${POS[r.cfg.archetype]})`, '| S | Yaş | OVR | İtibar | Kulüp (kademe) | Maç/Gol | Maaş | Para | Net servet | Alım | Parası boşta hafta | Projeler | Takım arkadaşı min/ort/max | VIP |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for (const x of r.seasons) o.push(`| ${x.season} | ${x.age} | ${x.ovr} | ${x.rep} | ${x.club} (${x.tier ?? '-'}) | ${x.apps}/${x.goals} | ${x.wage} | ${x.money} | ${x.netWorth} | ${x.purchases} | ${x.moneyIdleWeeks} | ${x.proj} | ${x.mates} | ${x.vip} |`)
    o.push('')
  }
  return o.join('\n')
}

function streaks(ws: WeekRec[]): number {
  let n = 0
  let run = 0
  for (const w of ws) {
    const dead = w.cards === 0 && w.heroMatches === 0 && w.offers === 0 && w.heroNews === 0 && w.objectiveEvents === 0
    run = dead ? run + 1 : 0
    if (run === 2) n++
  }
  return n
}

describe('playtest harness', () => {
  it(FULL ? 'plays full careers and writes transcripts' : 'smoke: a few weeks of a human-like career', () => {
    const r2 = FULL && env.PLAYTEST_PLAN === 'r2'
    const r3 = FULL && env.PLAYTEST_PLAN === 'r3'
    const set = r3 ? CONFIGS_R3 : r2 ? CONFIGS_R2 : CONFIGS
    const n = FULL ? Number(env.PLAYTEST_N ?? (r3 || r2 ? set.length : 5)) : 1
    const seasons = FULL ? Number(env.PLAYTEST_SEASONS ?? (r3 ? 10 : r2 ? 8 : 6)) : 1
    const runs: CareerOut[] = []
    for (let i = 0; i < n; i++) {
      const cfg = set[i % set.length]
      const parent = cfg.legacyOf !== undefined ? runs[cfg.legacyOf]?.summary ?? null : null
      runs.push(runPlaytest(cfg, i, cfg.seasons ?? seasons, parent ? legacyStartFrom(parent) : undefined))
    }
    expect(runs[0].cards.length).toBeGreaterThan(0)
    expect(runs[0].matches).toBeGreaterThan(0)
    if (!FULL) return
    const dir = env.PLAYTEST_OUT ?? 'playtest-out'
    mkdirSync(dir, { recursive: true })
    runs.forEach((r, i) => writeFileSync(join(dir, `career-${i + 1}.txt`), r.transcript.join('\n'), 'utf8'))
    writeFileSync(join(dir, 'analysis.md'), analyse(runs), 'utf8')
    writeFileSync(join(dir, 'metrics.json'), JSON.stringify(runs.map((r) => ({ cfg: r.cfg, weeks: r.weeks, seasons: r.seasons, cards: r.cards })), null, 0), 'utf8')
  }, FULL ? 1_800_000 : 60_000)
})
