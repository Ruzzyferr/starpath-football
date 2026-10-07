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
  acceptNegotiation, acceptOffer, acceptSponsor, blackjackAct, blackjackDeal, buyAsset, complainAboutBench, counterNegotiation,
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

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const FULL = env.PLAYTEST === '1'

type Persona = 'pro' | 'social' | 'gambler' | 'party' | 'spender'

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
    case 'injury': case 'suspension': case 'endRelation': return -1
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
  seasons: { season: number; age: number; ovr: number; rep: number; money: number; netWorth: number; wage: number; club: string; tier: number | null; apps: number; goals: number; trophies: number; purchases: number; moneyIdleWeeks: number }[]
  commentary: string[]
  repFrom: Record<string, number>
  objectives: string[]
}

function runPlaytest(cfg: PtConfig, idx: number, seasons: number): CareerOut {
  const s = newGame(input(cfg), cfg.seed)
  const rng = new Rng(cfg.seed ^ 0xa11ce)
  const out: CareerOut = { cfg, transcript: [], cards: [], news: [], logs: [], weeks: [], flags: [], noTradeoff: {}, matches: 0, seasons: [], commentary: [], repFrom: {}, objectives: [] }
  const T = out.transcript
  const when = () => `S${s.calendar.season - startSeason + 1} H${s.calendar.week} ${DAYS[s.calendar.day] ?? '?'}`
  const startSeason = s.calendar.season
  const age = () => heroAge(s.hero, s.calendar.season)
  let lastLog = s.life.log[s.life.log.length - 1]
  let lastNews = s.life.news[s.life.news.length - 1]
  let wk: WeekRec = freshWeek()
  let purchases = 0
  let idleMoneyWeeks = 0
  function freshWeek(): WeekRec {
    return { season: s.calendar.season, week: s.calendar.week, cards: 0, heroMatches: 0, offers: 0, news: 0, heroNews: 0, inSeason: s.calendar.week >= 1 && s.calendar.week <= 41, objectiveEvents: 0 }
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
      if (e.icon === '🎯' || e.icon === '⌛') out.objectives.push(t.startsWith('Yeni') ? 'yeni' : t.startsWith('Sezon hedefi') ? 'sezon' : t.startsWith('Hedef tamam') ? 'tamam' : 'kaçtı')
    }
    lastLog = L[L.length - 1]
    const N = s.life.news
    const j = lastNews ? N.lastIndexOf(lastNews) : -1
    for (const n of N.slice(j + 1)) {
      const h = tr(n.headline)
      out.news.push(h)
      wk.news++
      if (heroNameRe.test(h)) wk.heroNews++
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
    if (p === 'pro' && safeOnes.length && rng.chance(0.7)) return rng.pick(safeOnes)
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
      if (!s.life.agent && /menajerin|ajanın/i.test(blob) && !/menajer bul|ajan tut/i.test(blob)) flag('hayalet-ajan', `${v.defId}: ${v.title}`)
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
      const pick = enabled.length ? choosePick(enabled, v.choices.map((c) => c.risk)) : 0
      const r = rep('kart', () => resolveEventChoice(s, 0, pick))
      if (!r.ok && s.pendingEvents[0] === pe) s.pendingEvents.splice(0, 1)
      wk.cards++
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
    const mr = rep('maç', () => autoPlayHeroMatch(s, 'tr'))
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
      for (const q of qs) {
        const o = rng.pick(q.options)
        const a = rep('röportaj', () => answerInterview(s, q.id, o.id))
        T.push(`      🎤 ${tr(q.text)} → ${tr(o.label)}`)
        if (a.done && a.headline) T.push(`      🗞️ ${tr(a.headline)}`)
      }
      drain()
    }
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
    if (a >= 18) opts.push(['party', p === 'party' ? 3 : p === 'social' ? 0.8 : 0.25], ['casino', p === 'gambler' ? 1.6 : 0.08])
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
        const stake = Math.max(50, Math.round((s.life.money * rng.range(0.005, 0.03)) / 50) * 50)
        const before = s.life.money
        for (let i = 0; i < rng.int(1, 4) && s.life.money > stake; i++) {
          if (rng.chance(0.4)) playSlots(s, stake)
          else if (rng.chance(0.5)) playRoulette(s, [{ type: rng.chance(0.5) ? 'red' : 'black', stake }])
          else {
            let round = blackjackDeal(s, stake).value
            for (let k = 0; k < 6 && round && !round.finished; k++) round = blackjackAct(s, rng.chance(0.6) ? 'stand' : 'hit').value
          }
        }
        T.push(`[${when()}] 🎰 kumarhane: ${Math.round(s.life.money - before)} (bahis ${stake})`)
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
          return
        }
        continue
      }
      if (acceptOffer(s, o.id).ok) {
        T.push(`[${when()}] ✍️ İMZA: ${o.clubName} (${o.contract.kind})`)
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
      const grp = h.position === 'GK' ? 'goalkeeping' : h.position === 'ST' ? 'shooting' : 'physical'
      if (hireTrainer(s, grp as never, 1).ok) T.push(`[${when()}] 🧑‍🏫 kişisel antrenör`)
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
        T.push(`[${when()}] 🛒 SATIN ALDI: ${tr(pick.name as LText)} (${pick.price})`)
      }
    } else if (!cands.length && life.money > 20 * Math.max(1000, wage)) idleMoneyWeeks++
    drain()
  }

  let guard = 0
  let lastSeasonSeen = s.calendar.season
  T.push(`=== KARİYER ${idx + 1}: ${cfg.first} ${cfg.last} (${cfg.gender === 'female' ? 'K' : 'E'}, ${cfg.nationality}, ${POS[cfg.archetype]}, ${cfg.background}, persona ${cfg.persona}, ${cfg.startAge} yaş) ===`)
  drain()
  while (s.calendar.season < startSeason + seasons && guard++ < 4000) {
    const week = s.calendar.week
    const season = s.calendar.season
    playDay()
    rep('transfer', handleOffers)
    if (s.calendar.week !== week || s.calendar.season !== season) {
      out.weeks.push(wk)
      const d = dashboard(s)
      const rels = Object.values(s.life.relationships).filter((r) => ['partner', 'manager', 'bestFriend', 'agent'].includes(r.kind)).map((r) => `${r.kind}:${r.name}=${Math.round(r.value)}`).join(' ')
      const obj = safe(() => objectivesView(s), null)
      T.push(`--- [${when()}] durum: ${age()} yaş, OVR ${heroOvr(s.hero)}, itibar ${Math.round(s.hero.reputation)}, para ${Math.round(s.life.money)}, enerji ${Math.round(s.life.energy)}, mutluluk ${Math.round(s.life.happiness)}, stres ${Math.round(s.life.stress)}, rol ${s.hero.contract?.role ?? '-'}, kulüp ${d.club?.name ?? 'yok'}${d.league ? ` (${d.league.position}./${d.league.teams})` : ''} | ${rels}${obj ? ` | hedefler: ${obj.active.map((o) => `${tr(o.title)} ${o.progress}/${o.target}`).join('; ')}` : ''}`)
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
      })
      purchases = 0
      idleMoneyWeeks = 0
      lastSeasonSeen = s.calendar.season
    }
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
  o.push('## Sezon özetleri', '')
  for (const r of runs) {
    o.push(`### ${r.cfg.first} ${r.cfg.last} (${r.cfg.persona}, ${POS[r.cfg.archetype]})`, '| S | Yaş | OVR | İtibar | Kulüp (kademe) | Maç/Gol | Maaş | Para | Net servet | Alım | Parası boşta hafta |', '|---|---|---|---|---|---|---|---|---|---|---|')
    for (const x of r.seasons) o.push(`| ${x.season} | ${x.age} | ${x.ovr} | ${x.rep} | ${x.club} (${x.tier ?? '-'}) | ${x.apps}/${x.goals} | ${x.wage} | ${x.money} | ${x.netWorth} | ${x.purchases} | ${x.moneyIdleWeeks} |`)
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
    const n = FULL ? Number(env.PLAYTEST_N ?? 5) : 1
    const seasons = FULL ? Number(env.PLAYTEST_SEASONS ?? 6) : 1
    const runs: CareerOut[] = []
    for (let i = 0; i < n; i++) runs.push(runPlaytest(CONFIGS[i % CONFIGS.length], i, seasons))
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
