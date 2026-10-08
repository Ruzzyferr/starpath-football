/**
 * Mock GameActions — believable, deterministic behaviour so every screen can be
 * built and demoed without the real simulation. The lead replaces this with
 * installBackend({ actions, data }) wired to sim/**.
 *
 * Dev shortcut: `?dev=<ScreenId>` (e.g. ?dev=home, ?dev=liveMatch) loads the
 * mock career and jumps straight to that screen.
 */
import * as eco from '../../sim/life/economy'
import { Rng, clamp, hashString } from '../../core/rng'
import type { GameState, Investment, MatchResultSummary, SeasonStats } from '../../core/types'
import {
  blackjack, gameState, installBackend, navigate, negotiation,
  type Delta, type EventOutcomeView, type GameActions, type InteractionKind, type NegotiationView, type OfferTerms,
  type PostKind, type ScreenId, type SocialPostView,
} from '../store'
import { ACTIVITIES, ASSETS, EVENTS, SPONSOR_OFFERS, TRAINERS, TRAINING, type MDelta } from './mockContent'
import {
  L, addLog, addNews, applyDeltas, commit, get, heroClubId, isMatchSlotNow, nextHeroFixture, teamView, withRng,
} from './mockCore'
import { INFO_PREFIX, SAVE_PREFIX, engine, heroPosts, mockData, slotInfoOf } from './mockData'
import { computeTable, makeResult, simulateScore } from './mockWorld'
import { buildState, computeOvr, createMockState } from './mockState'
import { createCasino } from './mockCasino'
import type { FinishedMatch } from './mockMatch'

// ───────────────────────── Calendar ─────────────────────────

function simulateDay(s: GameState, rng: Rng): void {
  const { week, day, season } = s.calendar
  const heroId = heroClubId(s)
  for (const comp of Object.values(s.world.competitions)) {
    if (comp.season !== season) continue
    let touched = false
    for (const f of comp.fixtures) {
      if (f.result || f.week !== week || f.day !== day) continue
      if (heroId && (f.homeId === heroId || f.awayId === heroId)) {
        quickSimHero(s, rng, f.id)
        touched = true
        continue
      }
      f.result = makeResult(rng, s.world, s.world.clubs[f.homeId], s.world.clubs[f.awayId])
      touched = true
    }
    if (touched && comp.type === 'league') comp.table = computeTable(comp)
  }
}

function endWeek(s: GameState, rng: Rng): void {
  s.calendar.week++
  s.calendar.day = 0
  const { life, hero } = s
  const wage = hero.contract?.wage ?? 0
  const sponsors = life.sponsors.reduce((a, x) => a + x.weekly, 0)
  const upkeep = life.assets.reduce((a, o) => a + (ASSETS.find((d) => d.id === o.defId)?.upkeep ?? 0), 0)
  const business = life.assets.reduce((a, o) => {
    const e = ASSETS.find((d) => d.id === o.defId)?.effect
    return a + (e?.key === 'weekly_income' ? e.value : 0)
  }, 0)
  const trainer = life.trainer?.weeklyFee ?? 0
  const commission = Math.round((wage + sponsors) * (life.agent?.commission ?? 0))
  let net = wage + sponsors + business - upkeep - trainer - commission
  if (life.bank.loan) {
    const pay = Math.min(life.bank.loan.weeklyPayment, life.bank.loan.remaining)
    net -= pay
    const remaining = life.bank.loan.remaining - pay
    life.bank.loan = remaining > 0 ? { ...life.bank.loan, remaining } : null
  }
  life.money += net
  life.bank.savings = Math.round(life.bank.savings * 1.0006)
  life.bank.investments = life.bank.investments.map((i) => {
    const vol = i.kind === 'crypto' ? 0.2 : i.kind === 'startup' ? 0.1 : i.kind === 'bonds' ? 0.005 : 0.03
    return { ...i, value: Math.max(0, Math.round(i.value * (1 + 0.002 + (rng.next() - 0.5) * vol))) }
  })
  life.casino = { ...life.casino, visitsThisWeek: 0, addiction: clamp(life.casino.addiction - 1, 0, 100) }
  for (const r of Object.values(life.relationships)) {
    if (s.calendar.week - r.lastContactWeek > 3 && r.value > 0) life.relationships[r.id] = { ...r, value: r.value - 1 }
  }
  addLog(s, L(`Haftalık bakiye: ${net >= 0 ? '+' : '−'}${Math.abs(net).toLocaleString('tr-TR')} €`, `Weekly balance: ${net >= 0 ? '+' : '−'}€${Math.abs(net).toLocaleString('en-GB')}`), 'money', 'coins')
}

function endDay(s: GameState, rng: Rng): void {
  simulateDay(s, rng)
  s.calendar.day++
  s.calendar.slot = 0
  s.life.energy = clamp(s.life.energy + 45, 0, 100)
  s.hero.fatigue = clamp(s.hero.fatigue - 12, 0, 100)
  for (const k of ['plan0', 'plan1', 'plan2', 'done0', 'done1', 'done2']) delete s.life.flags[k]
  if (s.calendar.day > 6) endWeek(s, rng)
  s.meta.playTimeSec += 240
}

function moveSlot(s: GameState, rng: Rng, n = 1): void {
  for (let i = 0; i < n; i++) {
    s.calendar.slot++
    if (s.calendar.slot > 2) {
      endDay(s, rng)
      break
    }
  }
}

function maybeRandomStuff(s: GameState, rng: Rng): void {
  if (s.pendingEvents.length < 3 && rng.chance(0.14)) {
    const pending = new Set(s.pendingEvents.map((e) => e.defId))
    const nowWeek = s.calendar.week
    const pool = EVENTS.filter((e) => !pending.has(e.id) && (s.life.eventHistory[e.id] === undefined || nowWeek - s.life.eventHistory[e.id] > 4))
    if (pool.length) {
      const def = rng.pick(pool)
      const teammates = Object.values(s.life.relationships).filter((r) => r.kind === 'teammate')
      s.pendingEvents.push({ defId: def.id, vars: { captain: teammates[0]?.name ?? 'Kaptan' }, firedAt: { ...s.calendar } })
    }
  }
  if (rng.chance(0.15)) {
    const clubs = Object.values(s.world.clubs)
    const c = rng.pick(clubs)
    const lines: [string, string, -1 | 0 | 1][] = [
      [`${c.name} yeni teknik direktör arayışında`, `${c.name} on the hunt for a new manager`, 0],
      [`${c.name} stadyumunu genişletiyor`, `${c.name} to expand their stadium`, 1],
      [`${c.name} taraftarı yönetime tepkili`, `${c.name} fans protest against the board`, -1],
    ]
    const [tr, en, sent] = rng.pick(lines)
    addNews(s, L(tr, en), sent)
  }
}

function executeActivity(s: GameState, rng: Rng, id: string): Delta[] {
  const a = ACTIVITIES.find((x) => x.id === id)
  if (!a) return []
  const out: Delta[] = []
  s.life.energy = clamp(s.life.energy - a.energy, 0, 100)
  if (a.energy) out.push({ key: 'energy', value: -a.energy })
  s.life.money -= a.cost
  if (a.cost) out.push({ key: 'money', value: -a.cost })
  out.push(...applyDeltas(s, a.effects.filter((e) => e.key !== 'energy' && e.key !== 'money'), rng))
  if (a.category === 'casino') s.life.casino = { ...s.life.casino, visitsThisWeek: s.life.casino.visitsThisWeek + 1 }
  s.life.flags[`done${s.calendar.slot}`] = id
  if (a.slots === 2 && s.calendar.slot < 2) s.life.flags[`done${s.calendar.slot + 1}`] = id
  addLog(s, a.name, a.category === 'training' ? 'career' : a.category === 'family' || a.category === 'social' ? 'relation' : 'event', a.icon)
  return out
}

// ───────────────────────── Match results ─────────────────────────

function addMatchStats(st: SeasonStats, m: FinishedMatch['stats'], motm: boolean, clean: boolean): SeasonStats {
  return {
    ...st,
    apps: st.apps + 1,
    starts: st.starts + (m.minutes >= 45 ? 1 : 0),
    minutes: st.minutes + m.minutes,
    goals: st.goals + m.goals,
    assists: st.assists + m.assists,
    shots: st.shots + m.shots,
    shotsOnTarget: st.shotsOnTarget + m.shotsOnTarget,
    passes: st.passes + m.passes,
    passesCompleted: st.passesCompleted + m.passesCompleted,
    tackles: st.tackles + m.tackles,
    dribbles: st.dribbles + m.dribbles,
    saves: st.saves + m.saves,
    cleanSheets: st.cleanSheets + (clean ? 1 : 0),
    ratingSum: st.ratingSum + m.rating,
    motm: st.motm + (motm ? 1 : 0),
  }
}

function writeHeroResult(s: GameState, fixtureId: string, score: [number, number], stats: FinishedMatch['stats'], scorers: FinishedMatch['scorers']): void {
  const comp = Object.values(s.world.competitions).find((c) => c.fixtures.some((f) => f.id === fixtureId))
  const f = comp?.fixtures.find((x) => x.id === fixtureId)
  if (!comp || !f) return
  const heroId = heroClubId(s)
  const heroSide = f.homeId === heroId ? 'home' : 'away'
  const res: MatchResultSummary = {
    home: score[0],
    away: score[1],
    scorers: scorers.map((x) => ({ minute: x.minute, playerId: x.playerId, team: x.side })),
    heroRating: stats.rating,
  }
  f.result = res
  for (const sc of scorers) {
    const p = s.world.players[sc.playerId]
    if (p) p.stats = { ...p.stats, goals: p.stats.goals + 1 }
  }
  if (comp.type === 'league') comp.table = computeTable(comp)
  const conceded = heroSide === 'home' ? score[1] : score[0]
  const motm = stats.rating >= 7.6
  s.hero.seasonStats = addMatchStats(s.hero.seasonStats, stats, motm, conceded === 0)
  s.hero.careerStats = addMatchStats(s.hero.careerStats, stats, motm, conceded === 0)
  const ratings = typeof s.life.flags.ratings === 'string' && s.life.flags.ratings ? s.life.flags.ratings.split(',') : mockData.formHistory().map(String)
  s.life.flags.ratings = [...ratings, stats.rating.toFixed(1)].slice(-10).join(',')
  s.hero.sharpness = clamp(s.hero.sharpness + 6, 0, 100)
  const opp = s.world.clubs[heroSide === 'home' ? f.awayId : f.homeId]
  const my = heroSide === 'home' ? score[0] : score[1]
  const txt = L(`${opp.name} maçı: ${score[0]}-${score[1]} · puan ${stats.rating.toFixed(1).replace('.', ',')}${stats.goals ? ` · ${stats.goals} gol` : ''}`, `vs ${opp.name}: ${score[0]}-${score[1]} · rated ${stats.rating.toFixed(1)}${stats.goals ? ` · ${stats.goals} goal${stats.goals > 1 ? 's' : ''}` : ''}`)
  addLog(s, txt, 'match', 'ball')
  const name = `${s.hero.firstName} ${s.hero.lastName}`
  if (stats.goals >= 2) addNews(s, L(`${name} şov yaptı: ${opp.name} karşısında ${stats.goals} gol!`, `${name} steals the show with ${stats.goals} goals against ${opp.name}!`), 1)
  else if (my < conceded) addNews(s, L(`${opp.name} deplasmanında hayal kırıklığı`, `Disappointment against ${opp.name}`), -1)
  else addNews(s, L(`${opp.name} maçında kritik sonuç: ${score[0]}-${score[1]}`, `Key result against ${opp.name}: ${score[0]}-${score[1]}`), 0)
}

function quickSimHero(s: GameState, rng: Rng, fixtureId: string): void {
  const comp = Object.values(s.world.competitions).find((c) => c.fixtures.some((f) => f.id === fixtureId))
  const f = comp?.fixtures.find((x) => x.id === fixtureId)
  if (!f) return
  const home = s.world.clubs[f.homeId]
  const away = s.world.clubs[f.awayId]
  const score = simulateScore(rng, home, away)
  const heroSide = f.homeId === heroClubId(s) ? 'home' : 'away'
  const mine = heroSide === 'home' ? score[0] : score[1]
  const goals = Math.min(mine, rng.chance(0.35) ? 1 : 0)
  const base = makeResult(rng, s.world, home, away, score)
  const scorers: FinishedMatch['scorers'] = base.scorers.map((x, i) => ({
    minute: x.minute,
    name: '',
    side: x.team,
    playerId: x.team === heroSide && i < goals ? 'hero' : x.playerId,
  }))
  const rating = Math.round(clamp(rng.normal(6.6 + goals * 0.9, 0.5), 4.5, 9.6) * 10) / 10
  writeHeroResult(s, fixtureId, score, {
    minutes: 90, goals, assists: rng.chance(0.2) ? 1 : 0, shots: goals + rng.int(0, 3), shotsOnTarget: goals + rng.int(0, 1),
    passes: rng.int(18, 35), passesCompleted: rng.int(14, 28), tackles: rng.int(0, 2), dribbles: rng.int(0, 4), saves: 0, rating,
  }, scorers)
}

// ───────────────────────── Negotiation ─────────────────────────

interface Limits {
  wage: number
  years: number
  signingBonus: number
  goalBonus: number
  releaseClause: number
}
let limits: Limits | null = null

function agentLine(s: GameState, n: Pick<NegotiationView, 'patience' | 'clubOffer'>, lim: Limits): NegotiationView['agentLine'] {
  const q = s.life.agent?.quality ?? 0
  if (!s.life.agent) return L('Menajerin yok; kulüp seni zorlayacak.', 'No agent; the club will squeeze you.')
  if (n.patience < 35) return L('Sabırları tükeniyor. Şimdi imzalamak akıllıca olabilir.', 'They’re losing patience. Signing now might be wise.')
  if (q >= 3 && n.clubOffer.wage < lim.wage * 0.92) return L(`Haftalık ${Math.round(lim.wage / 500) * 500} €’ya kadar çıkabileceklerini duydum.`, `I hear they can stretch to €${Math.round(lim.wage / 500) * 500} a week.`)
  return L('İmza parası konusunda biraz daha zorlayabiliriz.', 'We can push a little more on the signing bonus.')
}

// ───────────────────────── Casino host ─────────────────────────

let casinoRng = new Rng(4242)
const casino = createCasino(
  {
    rng: () => casinoRng,
    canAfford: (amount) => (gameState.value?.life.money ?? 0) >= amount,
    settle(net) {
      const s = gameState.value
      if (!s) return
      s.life.money += net
      s.life.casino = {
        ...s.life.casino,
        won: s.life.casino.won + Math.max(0, net),
        lost: s.life.casino.lost + Math.max(0, -net),
        addiction: clamp(s.life.casino.addiction + (net < 0 ? 1.5 : 1), 0, 100),
        visitsThisWeek: s.life.casino.visitsThisWeek + 1,
      }
      if (s.life.casino.addiction > 60 && s.life.casino.visitsThisWeek % 5 === 0) {
        s.life.stress = clamp(s.life.stress + 3, 0, 100)
        s.life.discipline = clamp(s.life.discipline - 2, 0, 100)
      }
      commit(s)
    },
  },
  () => mockData.horses(),
)

// ───────────────────────── Saves ─────────────────────────

function store(key: string, value: string | null): void {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key)
    else globalThis.localStorage?.setItem(key, value)
  } catch (e) {
    throw new Error(`save failed: ${(e as Error).message}`, { cause: e })
  }
}
function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}
function isState(x: unknown): x is GameState {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return typeof o.version === 'number' && !!o.hero && !!o.life && !!o.world && !!o.calendar && !!o.meta
}

// ───────────────────────── Actions ─────────────────────────

const POST_TEXT: Record<PostKind, [string, string]> = {
  training: ['Ekstra mesai. Hedef: daha iyisi. ⚽', 'Extra hours. Target: better. ⚽'],
  luxury: ['Yeni oyuncak 🏎️', 'New toy 🏎️'],
  family: ['Her şey onlar için ❤️', 'All for them ❤️'],
  charity: ['Bugün çocuklarla harika bir gündü. Teşekkürler!', 'Amazing day with the kids today. Thank you!'],
  provocative: ['Bazıları konuşur, biz gol atarız. 🤫', 'Some talk, we score. 🤫'],
  fans: ['Bu armayı taşımak bir onur. Cumartesi görüşürüz! 🔥', 'Wearing this badge is an honour. See you Saturday! 🔥'],
  rival: ['Cumartesi sahada konuşuruz. 😏', "We'll talk on the pitch on Saturday. 😏"],
}
const POST_DELTAS: Record<PostKind, MDelta[]> = {
  training: [{ key: 'followers', value: 4000 }, { key: 'managerTrust', value: 1 }],
  luxury: [{ key: 'followers', value: 9000 }, { key: 'relation', value: -3, rel: 'fans', label: L('Taraftar', 'Fans') }],
  family: [{ key: 'followers', value: 6000 }, { key: 'happiness', value: 3 }],
  charity: [{ key: 'followers', value: 5000 }, { key: 'reputation', value: 2 }],
  provocative: [{ key: 'followers', value: 15000 }, { key: 'discipline', value: -4 }, { key: 'relation', value: -6, rel: 'press', label: L('Basın', 'Press') }],
  rival: [{ key: 'followers', value: 10000 }, { key: 'discipline', value: -2 }, { key: 'relation', value: -3, rel: 'press', label: L('Basın', 'Press') }],
  fans: [{ key: 'followers', value: 7000 }, { key: 'relation', value: 5, rel: 'fans', label: L('Taraftar', 'Fans') }],
}
const INTERACT: Record<InteractionKind, { rel: number; money: number; energy: number; extra?: MDelta[]; memory: [string, string] }> = {
  call: { rel: 3, money: 0, energy: 2, memory: ['Telefonda uzun uzun konuştunuz', 'You had a long phone call'] },
  dinner: { rel: 6, money: 250, energy: 8, extra: [{ key: 'happiness', value: 3 }], memory: ['Birlikte yemeğe çıktınız', 'You went out for dinner'] },
  gift: { rel: 8, money: 1500, energy: 4, memory: ['Hediye aldın', 'You bought a gift'] },
  train: { rel: 5, money: 0, energy: 15, extra: [{ key: 'workRate', value: 1 }], memory: ['Birlikte antrenman yaptınız', 'You trained together'] },
  party: { rel: 5, money: 600, energy: 15, extra: [{ key: 'discipline', value: -2 }, { key: 'happiness', value: 4 }], memory: ['Partide eğlendiniz', 'You partied together'] },
  holiday: { rel: 15, money: 9000, energy: -20, extra: [{ key: 'stress', value: -12 }], memory: ['Birlikte tatile çıktınız', 'You went on holiday together'] },
  apologize: { rel: 10, money: 0, energy: 3, memory: ['Özür diledin', 'You apologised'] },
}

const INVEST_NAMES: Record<Investment['kind'], [string, string]> = {
  index: ['Küresel Endeks Fonu', 'Global Index Fund'],
  startup: ['Sporteknoloji girişimi', 'Sports-tech startup'],
  property: ['Kiralık daire', 'Rental apartment'],
  crypto: ['YıldızCoin', 'StarCoin'],
  bonds: ['Devlet tahvili', 'Government bonds'],
}

export const mockActions: GameActions = {
  newGame(input) {
    engine.clear()
    negotiation.value = null
    blackjack.value = null
    heroPosts.length = 0
    const seed = input.seed ?? hashString(`${input.firstName}|${input.lastName}|${input.nationality}|${input.position}`)
    gameState.value = buildState(input, seed, true)
  },
  async save(slot) {
    const s = get()
    const sl = slot ?? s.meta.slot ?? 1
    s.meta.slot = sl
    s.meta.updatedAt = Date.now()
    store(SAVE_PREFIX + sl, JSON.stringify(s))
    store(INFO_PREFIX + sl, JSON.stringify(slotInfoOf(s, sl)))
    commit(s)
  },
  async load(slot) {
    const raw = read(SAVE_PREFIX + slot)
    if (!raw) return false
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!isState(parsed)) return false
      engine.clear()
      negotiation.value = null
      blackjack.value = null
      parsed.meta.slot = slot
      gameState.value = parsed
      return true
    } catch {
      return false
    }
  },
  async deleteSave(slot) {
    store(SAVE_PREFIX + slot, null)
    store(INFO_PREFIX + slot, null)
  },
  async exportSave(slot) {
    const raw = read(SAVE_PREFIX + slot)
    if (raw) return raw
    const s = gameState.value
    if (s && s.meta.slot === slot) return JSON.stringify(s)
    throw new Error('empty slot')
  },
  async importSave(json, slot) {
    try {
      const parsed: unknown = JSON.parse(json)
      if (!isState(parsed)) return false
      parsed.meta.slot = slot
      store(SAVE_PREFIX + slot, JSON.stringify(parsed))
      store(INFO_PREFIX + slot, JSON.stringify(slotInfoOf(parsed, slot)))
      return true
    } catch {
      return false
    }
  },
  async resetAll() {
    for (const sl of [1, 2, 3]) {
      store(SAVE_PREFIX + sl, null)
      store(INFO_PREFIX + sl, null)
    }
    engine.clear()
    negotiation.value = null
    blackjack.value = null
    gameState.value = null
  },

  planSlot(slot, activityId) {
    const s = get()
    if (activityId) s.life.flags[`plan${slot}`] = activityId
    else delete s.life.flags[`plan${slot}`]
    commit(s)
  },
  doActivity(id) {
    const s = get()
    if (isMatchSlotNow(s)) return []
    const a = ACTIVITIES.find((x) => x.id === id)
    const out = withRng(s, (rng) => {
      const d = executeActivity(s, rng, id)
      moveSlot(s, rng, a?.slots ?? 1)
      maybeRandomStuff(s, rng)
      return d
    })
    commit(s)
    return out
  },
  advance() {
    const s = get()
    withRng(s, (rng) => {
      if (isMatchSlotNow(s)) {
        const f = nextHeroFixture(s)
        if (f) quickSimHero(s, rng, f.id)
        endDay(s, rng)
        return
      }
      const planned = s.life.flags[`plan${s.calendar.slot}`]
      const a = typeof planned === 'string' ? ACTIVITIES.find((x) => x.id === planned) : undefined
      if (a && s.life.energy >= a.energy && s.life.money >= a.cost) {
        executeActivity(s, rng, a.id)
        moveSlot(s, rng, a.slots)
      } else {
        s.life.energy = clamp(s.life.energy + 6, 0, 100)
        moveSlot(s, rng)
      }
      maybeRandomStuff(s, rng)
    })
    commit(s)
  },
  advanceToMatch() {
    for (let i = 0; i < 40; i++) {
      const s = get()
      if (isMatchSlotNow(s) || !nextHeroFixture(s)) break
      mockActions.advance()
    }
  },

  resolveEvent(index, choice): EventOutcomeView {
    const s = get()
    const pe = s.pendingEvents[index]
    const def = pe && EVENTS.find((e) => e.id === pe.defId)
    if (!pe || !def) return { text: L('Olay bulunamadı.', 'Event not found.'), deltas: [], success: false }
    const c = def.choices[choice] ?? def.choices[0]
    const out = withRng(s, (rng): EventOutcomeView => {
      if (c.requirement && !c.requirement.check(s)) {
        return { text: L('Bu seçenek için şartları sağlamıyorsun.', 'You don’t meet the requirements for this choice.'), deltas: [], success: false }
      }
      const ok = rng.chance(c.chance)
      const res = ok || !c.fail ? c.success : c.fail
      const deltas = applyDeltas(s, res.deltas)
      return { text: res.text, deltas, success: ok || !c.fail }
    })
    s.pendingEvents.splice(index, 1)
    s.life.eventHistory[def.id] = s.calendar.week
    addLog(s, def.title, 'event', 'chat')
    commit(s)
    return out
  },

  train(sessionId, performance) {
    return mockActions.trainSession(sessionId, performance).deltas
  },
  trainSession(sessionId, performance) {
    const s = get()
    const perf = Math.max(0, Math.min(1, performance ?? 0.6))
    const sess = TRAINING.find((x) => x.id === sessionId)
    const fail = { ok: false, error: L('Bu antrenman için enerjin yetersiz.', 'Not enough energy for this session.'), performance: perf, xp: 0, attrXp: [], deltas: [], injured: false }
    if (!sess || (sess.energy > 0 && s.life.energy < sess.energy)) return fail
    const out: Delta[] = [{ key: 'energy', value: -sess.energy }]
    s.life.energy = clamp(s.life.energy - sess.energy, 0, 100)
    if (sess.group === 'recovery') {
      s.hero.fatigue = clamp(s.hero.fatigue - 20, 0, 100)
      out.push({ key: 'fatigue', value: -20 })
    } else {
      const bonus = s.life.trainer && s.life.trainer.group === sess.group ? (TRAINERS.find((t) => t.name === s.life.trainer?.name)?.bonus ?? 0.2) : 0
      const xp = (sess.xp / 100) * (0.3 + 1.2 * perf) * (1 + bonus)
      const attrXp = { ...s.hero.attrXp }
      for (const k of sess.focus) {
        let v = (attrXp[k] ?? 0) + xp
        if (v >= 1) {
          v -= 1
          s.hero.attrs = { ...s.hero.attrs, [k]: Math.min(99, s.hero.attrs[k] + 1) }
          out.push({ key: k, value: 1 })
        }
        attrXp[k] = Math.round(v * 100) / 100
      }
      s.hero.attrXp = attrXp
      out.push({ key: 'xp', value: Math.round(xp * 100 * sess.focus.length) })
      s.hero.fatigue = clamp(s.hero.fatigue + Math.round(sess.energy / 3), 0, 100)
      out.push({ key: 'fatigue', value: Math.round(sess.energy / 3) })
    }
    addLog(s, L(`Antrenman: ${sess.name.tr}`, `Training: ${sess.name.en}`), 'career', sess.icon)
    commit(s)
    const total = sess.group === 'recovery' ? 0 : Math.round(sess.xp * (0.3 + 1.2 * perf))
    const attrXp = sess.focus.map((key) => ({ key, xp: Math.round((total / Math.max(1, sess.focus.length)) * 10) / 10 }))
    return { ok: true, performance: perf, xp: total, attrXp, deltas: [...(total ? [{ key: 'xp' as const, value: total }] : []), ...out.filter((d) => d.key !== 'xp')], injured: false }
  },
  unlockPerk(perkId) {
    const s = get()
    const p = mockData.perks().find((x) => x.id === perkId)
    if (!p || !p.available) return false
    s.hero.perks = [...s.hero.perks, perkId]
    s.hero.perkPoints -= p.cost
    addLog(s, L(`Yeni yetenek: ${p.name.tr}`, `New perk: ${p.name.en}`), 'career', 'sparkle')
    commit(s)
    return true
  },
  hireTrainer(offerId) {
    const s = get()
    const o = TRAINERS.find((x) => x.id === offerId)
    if (!o) return false
    s.life.trainer = { name: o.name, group: o.group, weeklyFee: o.weeklyFee }
    addLog(s, L(`${o.name} özel antrenörün oldu`, `${o.name} is now your personal trainer`), 'career', 'whistle')
    commit(s)
    return true
  },
  fireTrainer() {
    const s = get()
    s.life.trainer = null
    commit(s)
  },

  interact(relationshipId, kind) {
    const s = get()
    const r = s.life.relationships[relationshipId]
    if (!r) return []
    const cfg = INTERACT[kind]
    if (s.life.money < cfg.money) return []
    const relGain = kind === 'apologize' && r.value >= 0 ? 2 : cfg.rel
    s.life.money -= cfg.money
    s.life.energy = clamp(s.life.energy - cfg.energy, 0, 100)
    const memory = [{ tr: cfg.memory[0], en: cfg.memory[1] }, ...r.memory].slice(0, 5)
    s.life.relationships[relationshipId] = { ...r, value: clamp(r.value + relGain, -100, 100), memory, lastContactWeek: s.calendar.week }
    const out: Delta[] = [{ key: 'relation', value: relGain, label: r.name }]
    if (cfg.money) out.push({ key: 'money', value: -cfg.money })
    if (cfg.energy) out.push({ key: 'energy', value: -cfg.energy })
    if (cfg.extra) out.push(...applyDeltas(s, cfg.extra))
    addLog(s, L(`${r.name}: ${cfg.memory[0].toLocaleLowerCase('tr-TR')}`, `${r.name}: ${cfg.memory[1].toLowerCase()}`), 'relation', 'heart')
    commit(s)
    return out
  },
  buy(assetId) {
    const s = get()
    const d = ASSETS.find((x) => x.id === assetId)
    if (!d || s.life.money < d.price || (d.minReputation ?? 0) > s.hero.reputation) return false
    s.life.money -= d.price
    s.life.assets = [...s.life.assets, { defId: d.id, boughtSeason: s.calendar.season, boughtWeek: s.calendar.week, pricePaid: d.price }]
    s.hero.reputation = clamp(s.hero.reputation + d.fame, 0, 100)
    s.life.happiness = clamp(s.life.happiness + Math.ceil(d.happiness / 2), 0, 100)
    addLog(s, L(`Satın aldın: ${d.name.tr}`, `Bought: ${d.name.en}`), 'money', d.icon)
    commit(s)
    return true
  },
  sell(assetIndex) {
    const s = get()
    const o = s.life.assets[assetIndex]
    if (!o) return 0
    const d = ASSETS.find((x) => x.id === o.defId)
    const value = Math.round(o.pricePaid * (d?.resale ?? 0.5))
    s.life.money += value
    s.life.assets = s.life.assets.filter((_, i) => i !== assetIndex)
    addLog(s, L(`Sattın: ${d?.name.tr ?? o.defId}`, `Sold: ${d?.name.en ?? o.defId}`), 'money', 'coins')
    commit(s)
    return value
  },
  bankDeposit(amount) {
    const s = get()
    const a = Math.min(amount, s.life.money)
    if (a <= 0) return
    s.life.money -= a
    s.life.bank.savings += a
    commit(s)
  },
  bankTermDeposit(amount, weeks) {
    const s = get()
    eco.openTermDeposit(s.life, amount, weeks, s.calendar)
    commit(s)
  },
  bankBreakTerm(id) {
    const s = get()
    eco.breakTermDeposit(s.life, id)
    commit(s)
  },
  bankWithdraw(amount) {
    const s = get()
    const a = Math.min(amount, s.life.bank.savings)
    if (a <= 0) return
    s.life.bank.savings -= a
    s.life.money += a
    commit(s)
  },
  takeLoan(amount, weeks) {
    const s = get()
    if (s.life.bank.loan || amount <= 0 || weeks <= 0) return false
    const rate = s.life.bank.creditScore > 700 ? 0.08 : 0.12
    const total = amount * (1 + (rate * weeks) / 52)
    s.life.bank.loan = { principal: amount, remaining: Math.round(total), weeklyPayment: Math.round(total / weeks), rate }
    s.life.money += amount
    addLog(s, L('Kredi çektin', 'You took out a loan'), 'money', 'bank')
    commit(s)
    return true
  },
  repayLoan(amount) {
    const s = get()
    const loan = s.life.bank.loan
    if (!loan) return
    const a = Math.min(amount, loan.remaining, s.life.money)
    if (a <= 0) return
    s.life.money -= a
    const remaining = loan.remaining - a
    s.life.bank.loan = remaining > 0 ? { ...loan, remaining } : null
    if (!s.life.bank.loan) s.life.bank.creditScore = Math.min(850, s.life.bank.creditScore + 15)
    commit(s)
  },
  invest(kind, amount) {
    const s = get()
    const a = Math.min(amount, s.life.money)
    if (a <= 0) return
    s.life.money -= a
    const [tr, en] = INVEST_NAMES[kind]
    s.life.bank.investments = [...s.life.bank.investments, { id: `inv${s.calendar.week}-${s.life.bank.investments.length}-${Math.round(a)}`, kind, name: { tr, en }, amount: a, value: a }]
    commit(s)
  },
  divest(investmentId) {
    const s = get()
    const inv = s.life.bank.investments.find((i) => i.id === investmentId)
    if (!inv) return 0
    s.life.money += inv.value
    s.life.bank.investments = s.life.bank.investments.filter((i) => i.id !== investmentId)
    commit(s)
    return inv.value
  },
  post(kind) {
    const s = get()
    const deltas = applyDeltas(s, POST_DELTAS[kind])
    const h = s.hero
    const [tr, en] = POST_TEXT[kind]
    const gain = deltas.find((d) => d.key === 'followers')?.value ?? 0
    const p: SocialPostView = {
      id: `hp${heroPosts.length}-${s.calendar.week}`,
      author: `${h.firstName} ${h.lastName}`,
      handle: `@${(h.firstName + h.lastName).toLocaleLowerCase('tr-TR').replace(/[^a-z0-9ğüşıöç]/g, '')}`,
      isHero: true,
      verified: h.reputation > 30,
      kind,
      text: { tr, en },
      likes: Math.round(gain * 2.4 + s.life.followers * 0.04),
      comments: Math.round(gain * 0.06 + 20),
      weekAgo: 0,
    }
    heroPosts.unshift(p)
    commit(s)
    return p
  },
  acceptSponsor(id) {
    const s = get()
    const o = SPONSOR_OFFERS.find((x) => x.id === id)
    if (!o || s.hero.reputation < o.minReputation) return
    s.life.sponsors = [...s.life.sponsors, { ...o }]
    addLog(s, L(`${o.brand} ile sponsorluk anlaşması imzaladın`, `Signed a sponsorship deal with ${o.brand}`), 'money', 'handshake')
    commit(s)
  },
  declineSponsor(id) {
    const s = get()
    s.life.flags[`declined_${id}`] = true
    commit(s)
  },
  hireAgent(quality) {
    const s = get()
    const names = ['Cem Varol', 'Selin Demirtaş', 'Marco Bellini', 'Jorge Mendoza', 'Ayla Kaan']
    s.life.agent = { name: names[clamp(quality - 1, 0, 4)], quality: clamp(quality, 1, 5), commission: 0.04 + quality * 0.012 }
    commit(s)
  },
  casino,

  openNegotiation(clubId) {
    const s = get()
    const club = s.world.clubs[clubId]
    if (!club) return
    const own = heroClubId(s) === clubId
    const ovr = computeOvr(s.hero.attrs, s.hero.position)
    const cur = s.hero.contract
    const base = Math.round(Math.max((cur?.wage ?? 2000) * (own ? 1.15 : 1.4), Math.pow(ovr / 10, 3.4) * 4 * (club.reputation / 60)) / 100) * 100
    const lim: Limits = {
      wage: Math.round(base * (1.25 + (s.life.agent?.quality ?? 0) * 0.03)),
      years: own ? 5 : 4,
      signingBonus: Math.round(base * 18),
      goalBonus: Math.round(base * 0.35),
      releaseClause: Math.round(base * 900),
    }
    limits = lim
    const clubOffer: OfferTerms = {
      wage: base,
      years: own ? 3 : 4,
      signingBonus: Math.round(base * 8),
      goalBonus: Math.round(base * 0.15),
      releaseClause: Math.round(base * 1600),
      role: ovr >= 72 ? 'starter' : 'rotation',
    }
    const view: NegotiationView = {
      club: teamView(s, clubId) as NonNullable<ReturnType<typeof teamView>>,
      kind: own ? 'renewal' : 'transfer',
      clubOffer,
      ranges: {
        wage: [Math.round(base * 0.5), Math.round(base * 2.2)],
        years: [1, 5],
        signingBonus: [0, Math.round(base * 30)],
        goalBonus: [0, Math.round(base * 0.6)],
        releaseClause: [Math.round(base * 400), Math.round(base * 2400)],
      },
      patience: 100,
      round: 1,
      maxRounds: 5,
      agentLine: L('', ''),
      agentEstimate: (s.life.agent?.quality ?? 0) >= 3 ? Math.round(lim.wage / 500) * 500 : null,
      status: 'open',
      lastResponse: null,
    }
    view.agentLine = agentLine(s, view, lim)
    negotiation.value = view
  },
  proposeTerms(terms) {
    const s = get()
    const n = negotiation.value
    const lim = limits
    if (!n || !lim || n.status !== 'open') return
    const over = (v: number, l: number) => Math.max(0, (v - l) / Math.max(1, l))
    const excess =
      over(terms.wage, lim.wage) * 1.6 +
      over(terms.years, lim.years) * 0.5 +
      over(terms.signingBonus, lim.signingBonus) * 0.6 +
      over(terms.goalBonus, lim.goalBonus) * 0.5 +
      (terms.releaseClause !== null && terms.releaseClause < lim.releaseClause * 0.6 ? 0.25 : 0)
    let next: NegotiationView
    if (excess <= 0.0001) {
      next = { ...n, clubOffer: { ...terms }, round: n.round + 1, lastResponse: L('Bu şartları kabul ediyoruz. İmzaya hazırız.', 'We accept these terms. Ready to sign.') }
    } else {
      const patience = Math.max(0, Math.round(n.patience - 12 - excess * 55))
      const round = n.round + 1
      if (patience <= 0 || round > n.maxRounds) {
        next = { ...n, patience, round, status: 'rejected', lastResponse: L('Görüşmeleri sonlandırıyoruz.', 'We are ending the talks.') }
      } else {
        const mid = (a: number, b: number) => Math.round((a + (Math.min(b, a * 1.6)) ) / 2 / 50) * 50
        const counter: OfferTerms = {
          wage: Math.min(lim.wage, mid(n.clubOffer.wage, terms.wage)),
          years: Math.min(lim.years, terms.years),
          signingBonus: Math.min(lim.signingBonus, mid(n.clubOffer.signingBonus, terms.signingBonus)),
          goalBonus: Math.min(lim.goalBonus, mid(n.clubOffer.goalBonus, terms.goalBonus)),
          releaseClause: terms.releaseClause === null ? n.clubOffer.releaseClause : Math.max(Math.round(lim.releaseClause * 0.6), terms.releaseClause),
          role: terms.role,
        }
        next = { ...n, patience, round, clubOffer: counter, lastResponse: L('Bu rakamlar fazla. Karşı teklifimiz masada.', 'Those numbers are too high. Our counter-offer is on the table.') }
      }
    }
    next.agentLine = agentLine(s, next, lim)
    negotiation.value = next
  },
  acceptOffer() {
    const s = get()
    const n = negotiation.value
    if (!n || n.status !== 'open') return
    const t = n.clubOffer
    const prevClub = heroClubId(s)
    s.hero.contract = {
      clubId: n.club.id,
      wage: t.wage,
      untilSeason: s.calendar.season + t.years,
      signingBonus: t.signingBonus,
      goalBonus: t.goalBonus,
      assistBonus: Math.round(t.goalBonus / 2),
      releaseClause: t.releaseClause,
      role: t.role,
    }
    s.life.money += t.signingBonus
    if (prevClub !== n.club.id) {
      s.hero.managerTrust = 50
      addNews(s, L(`Transfer tamam: ${s.hero.firstName} ${s.hero.lastName} artık ${n.club.name}’da!`, `Done deal: ${s.hero.firstName} ${s.hero.lastName} joins ${n.club.name}!`), 1, 'Transfer Radar')
      addLog(s, L(`${n.club.name} ile sözleşme imzaladın`, `Signed for ${n.club.name}`), 'career', 'handshake')
    } else {
      addLog(s, L('Sözleşmeni yeniledin', 'You renewed your contract'), 'career', 'handshake')
    }
    negotiation.value = { ...n, status: 'accepted', lastResponse: L('Hayırlı olsun!', 'Congratulations!') }
    commit(s)
  },
  walkAway() {
    const n = negotiation.value
    if (!n) return
    negotiation.value = { ...n, status: 'walkedAway' }
    if (n.kind === 'renewal') {
      const s = get()
      s.hero.managerTrust = clamp(s.hero.managerTrust - 3, 0, 100)
      commit(s)
    }
  },
  requestTransfer() {
    const s = get()
    s.life.flags.transferRequested = true
    s.hero.managerTrust = clamp(s.hero.managerTrust - 10, 0, 100)
    const fans = Object.values(s.life.relationships).find((r) => r.kind === 'fans')
    if (fans) s.life.relationships[fans.id] = { ...fans, value: clamp(fans.value - 12, -100, 100) }
    addNews(s, L(`${s.hero.firstName} ${s.hero.lastName} transfer talep etti!`, `${s.hero.firstName} ${s.hero.lastName} hands in a transfer request!`), -1)
    addLog(s, L('Transfer talebinde bulundun', 'You requested a transfer'), 'career', 'sign-out')
    commit(s)
  },

  playMatch() {
    const s = get()
    const pre = mockData.preMatch()
    if (!pre) return
    engine.start(pre, hashString(pre.fixture.fixtureId))
    s.activeMatchId = pre.fixture.fixtureId
    commit(s)
  },
  setMatchFocus(focus) {
    const s = get()
    if (focus === 'balance') delete s.hero.matchFocus
    else s.hero.matchFocus = focus
    commit(s)
  },
  matchSetSpeed(speed) {
    engine.setSpeed(speed)
  },
  matchPause(paused) {
    engine.pause(paused)
  },
  simMoment() {
    engine.simMoment()
  },
  playMoment() {
    engine.playMoment()
  },
  matchSimToEnd() {
    engine.simToEnd()
  },
  matchSkipToMoment() {
    engine.skipToMoment()
  },
  answerInterview(optionId) {
    const s = get()
    const post = mockData.postMatch()
    const opt = post?.interview?.options.find((o) => o.id === optionId)
    if (!opt) return []
    const deltas: MDelta[] = opt.preview.map((d) => (d.key === 'relation' ? { ...d, rel: 'teammate' as const } : { ...d }))
    const out = withRng(s, (rng) => applyDeltas(s, deltas, rng))
    engine.markInterview()
    commit(s)
    return out
  },
  finishMatch() {
    const s = get()
    const m = engine.finished()
    if (!m) {
      engine.clear()
      return
    }
    const post = mockData.postMatch()
    if (post) applyDeltas(s, post.deltas)
    writeHeroResult(s, m.fixture.fixtureId, m.score, m.stats, m.scorers)
    s.activeMatchId = null
    engine.clear()
    withRng(s, (rng) => {
      if (s.calendar.slot < 2) s.calendar.slot = 2
      endDay(s, rng)
    })
    commit(s)
  },

  continueSeason() {
    const s = get()
    const id = heroClubId(s)
    if (id) {
      const club = s.world.clubs[id]
      const league = Object.values(s.world.competitions).find((c) => c.type === 'league' && c.participantIds.includes(id))
      s.hero.history = [...s.hero.history, {
        season: s.calendar.season, clubId: id, clubName: club.name, leagueName: s.world.leagues[club.leagueId].name,
        stats: s.hero.seasonStats, leaguePosition: (league?.table?.findIndex((r) => r.clubId === id) ?? -1) + 1 || null, trophies: [],
      }]
    }
    s.calendar = { season: s.calendar.season + 1, week: 0, day: 0, slot: 0 }
    s.hero.seasonStats = {
      apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, passes: 0, passesCompleted: 0,
      tackles: 0, dribbles: 0, yellow: 0, red: 0, cleanSheets: 0, saves: 0, ratingSum: 0, motm: 0,
    }
    for (const p of Object.values(s.world.players)) p.stats = { ...p.stats, goals: 0, assists: 0, apps: 0, starts: 0, minutes: 0, ratingSum: 0 }
    for (const comp of Object.values(s.world.competitions)) {
      comp.season = s.calendar.season
      for (const f of comp.fixtures) if (comp.type === 'league' || f.round > 1) f.result = null
      if (comp.type === 'league') comp.table = computeTable(comp)
    }
    s.hero.perkPoints += 1
    addLog(s, L(`${s.calendar.season}/${(s.calendar.season + 1) % 100} sezonu başladı`, `The ${s.calendar.season}/${(s.calendar.season + 1) % 100} season begins`), 'career', 'calendar')
    commit(s)
  },
}

// ───────────────────────── Install ─────────────────────────

export function installMockBackend(): void {
  installBackend({ actions: mockActions, data: mockData })
  casinoRng = new Rng(4242)
  let dev: string | null = null
  try {
    dev = new URLSearchParams(globalThis.location?.search ?? '').get('dev')
  } catch {
    dev = null
  }
  if (!dev) return
  gameState.value = createMockState()
  const id = dev as ScreenId
  if (id === 'liveMatch' || id === 'postMatch') {
    mockActions.playMatch()
    if (id === 'postMatch') mockActions.matchSimToEnd()
  }
  if (id === 'contract') mockActions.openNegotiation(heroClubId(gameState.value as GameState) ?? 'tr1-01')
  navigate(id === 'title' ? 'home' : id, undefined, { tab: true })
}

