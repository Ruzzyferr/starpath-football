/** GameData (read-only view models) for the mock backend. */
import { Rng, hashString } from '../../core/rng'
import type { GameState, NewsItem, SponsorDeal } from '../../core/types'
import { gameState } from '../store'
import type {
  ActivityView, CasinoStatus, DayPlanView, DaySlotView, EventView, FixtureView, GameData, HorseView, InterestView,
  PerkView, PostMatchView, PreMatchView, SaveSlotInfo, ScorerRow, SeasonSummaryView, SocialPostView, SquadMemberView,
} from '../store'
import { ACTIVITIES, ASSETS, EVENTS, PERKS, SPONSOR_OFFERS, TRAINERS, TRAINING } from './mockContent'
import {
  L, absDay, fixtureView, heroClubId, heroFixtures, netWorth, nextHeroFixture, series, teamView,
} from './mockCore'
import { buildLineup, createMatchEngine, interviewOptions, weatherFor } from './mockMatch'
import { makeHorses } from './mockCasino'
import { computeOvr } from './mockState'
import { COUNTRIES } from './mockNames'

export const engine = createMatchEngine({ onFinished: () => {} })

/** Hero social posts (module state; not part of the save). */
export const heroPosts: SocialPostView[] = []

export function getState(): GameState | null {
  return gameState.value
}

export function formHistoryOf(s: GameState): number[] {
  const raw = s.life.flags.ratings
  if (typeof raw === 'string' && raw.length) return raw.split(',').map(Number).slice(-10)
  const rng = new Rng(s.meta.seed ^ 77)
  return Array.from({ length: 10 }, () => Math.round((6.2 + rng.next() * 2.2) * 10) / 10)
}

export const SAVE_PREFIX = 'starpath.save.'
export const INFO_PREFIX = 'starpath.saveinfo.'

function readInfo(slot: number): SaveSlotInfo {
  try {
    const raw = globalThis.localStorage?.getItem(INFO_PREFIX + slot)
    if (raw) return { ...(JSON.parse(raw) as SaveSlotInfo), slot, empty: false }
  } catch {
    /* ignore */
  }
  return { slot, empty: true }
}

export function slotInfoOf(s: GameState, slot: number): SaveSlotInfo {
  const club = s.hero.contract ? s.world.clubs[s.hero.contract.clubId] : null
  return {
    slot,
    empty: false,
    heroName: `${s.hero.firstName} ${s.hero.lastName}`,
    clubName: club?.name,
    crest: club?.crest,
    season: s.calendar.season,
    week: s.calendar.week,
    ovr: computeOvr(s.hero.attrs, s.hero.position),
    money: s.life.money,
    updatedAt: s.meta.updatedAt,
    playTimeSec: s.meta.playTimeSec,
  }
}

function eventView(s: GameState, index: number): EventView | null {
  const pe = s.pendingEvents[index]
  if (!pe) return null
  const def = EVENTS.find((e) => e.id === pe.defId)
  if (!def) return null
  const vars: Record<string, string> = { partner: s.life.relationships.partner?.name ?? 'Zeynep', captain: 'Kaptan', ...Object.fromEntries(Object.entries(pe.vars).map(([k, v]) => [k, String(v)])) }
  const sub = (t: string) => t.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)
  let person: EventView['person']
  if (def.person) {
    const rel = Object.values(s.life.relationships).find((r) => r.kind === def.person?.rel)
    const npc = rel?.npcId ? s.world.players[rel.npcId] : undefined
    const name = def.person.rel === 'teammate' && pe.vars.captain ? String(pe.vars.captain) : (rel?.name ?? '')
    const rng = new Rng(hashString(name || def.id))
    person = {
      name,
      role: def.person.role,
      appearance: npc?.appearance ?? { skin: rng.int(0, 6), hairStyle: rng.int(0, 14), hairColor: rng.int(0, 9), beard: def.person.rel === 'mother' || def.person.rel === 'partner' ? 0 : rng.int(0, 7), eyeColor: rng.int(0, 5), face: rng.int(0, 5), accessory: 0 },
    }
  }
  return {
    index,
    defId: def.id,
    category: def.category,
    title: def.title,
    body: { tr: sub(def.body.tr), en: sub(def.body.en) },
    person,
    choices: def.choices.map((c) => ({
      label: c.label,
      risk: c.risk,
      requirement: c.requirement ? { text: c.requirement.text, met: c.requirement.check(s) } : undefined,
      preview: c.preview.map(({ rel: _r, ...d }) => (void _r, d)),
    })),
  }
}

function preMatch(s: GameState): PreMatchView | null {
  const f = nextHeroFixture(s)
  const heroId = heroClubId(s)
  if (!f || !heroId) return null
  const fx = fixtureView(s, f, heroId) as FixtureView
  const home = s.world.clubs[f.homeId]
  const away = s.world.clubs[f.awayId]
  const oppId = f.homeId === heroId ? f.awayId : f.homeId
  const opp = s.world.clubs[oppId]
  const league = Object.values(s.world.competitions).find((c) => c.type === 'league' && c.participantIds.includes(oppId))
  const oppForm = league?.table?.find((r) => r.clubId === oppId)?.form ?? []
  const key = opp.squad.map((id) => s.world.players[id]).sort((a, b) => b.ovr - a.ovr)[0]
  const starting = !!s.hero.contract && s.hero.contract.role !== 'reserve' && s.hero.contract.role !== 'youth' && !s.hero.injury
  const hr = home.reputation + 4
  const ar = away.reputation
  const ph = hr / (hr + ar)
  const odds = (p: number) => Math.round((1 / Math.max(0.05, p)) * 0.93 * 100) / 100
  const hints = [
    L('Rakip yüksek pres yapıyor; ilk dokunuşun temiz olmalı.', 'They press high; your first touch must be clean.'),
    L('Kanatlar boş kalıyor; çaprazlara koşu yap.', 'The flanks are open; make diagonal runs.'),
    L('Duran toplarda zayıflar; ön direğe gir.', 'They’re weak at set pieces; attack the near post.'),
    L('Geride kalabalıklar; ceza sahası dışından şut dene.', 'They sit deep; try your luck from range.'),
  ]
  return {
    fixture: fx,
    weather: weatherFor(hashString(f.id), f.week),
    importance: f.compId.startsWith('trcup') ? 0.7 : Math.abs(home.reputation - away.reputation) < 6 ? 0.6 : 0.35,
    homeFormation: home.formation,
    awayFormation: away.formation,
    homeLineup: buildLineup(s, home, 'home', starting && f.homeId === heroId),
    awayLineup: buildLineup(s, away, 'away', starting && f.awayId === heroId),
    opponentForm: oppForm,
    opponentKeyPlayer: key ? { name: `${key.firstName} ${key.lastName}`, position: key.position, ovr: key.ovr } : null,
    tacticHint: hints[hashString(oppId) % hints.length],
    heroStarting: starting,
    odds: { home: odds(ph * 0.75), draw: odds(0.25), away: odds((1 - ph) * 0.75) },
  }
}

function postMatch(s: GameState): PostMatchView | null {
  const m = engine.finished()
  if (!m) return null
  const hs = m.heroSide
  const my = hs === 'home' ? 0 : 1
  const won = m.score[my] > m.score[1 - my]
  const rating = m.stats.rating
  const motmHero = rating >= 7.6
  const lineupScorer = m.scorers.find((x) => x.side === hs && x.playerId !== 'hero')
  const npc = lineupScorer ? s.world.players[lineupScorer.playerId] : undefined
  const goalBonus = s.hero.contract?.goalBonus ?? 0
  const assistBonus = s.hero.contract?.assistBonus ?? 0
  const deltas = [
    { key: 'money' as const, value: m.stats.goals * goalBonus + m.stats.assists * assistBonus + (won ? 2500 : 0) },
    { key: 'form' as const, value: Math.round((rating - 6.5) * 4) },
    { key: 'reputation' as const, value: rating >= 7.5 ? 2 : rating < 5.8 ? -1 : 0 },
    { key: 'managerTrust' as const, value: Math.round((rating - 6.4) * 3) },
    { key: 'fatigue' as const, value: Math.round(m.stats.minutes / 4) },
  ].filter((d) => d.value !== 0)
  return {
    fixture: m.fixture,
    score: m.score,
    heroSide: hs,
    rating,
    stats: m.stats,
    team: m.team,
    motm: motmHero
      ? { name: `${s.hero.firstName} ${s.hero.lastName}`, isHero: true, rating, appearance: s.hero.appearance }
      : { name: npc ? `${npc.firstName} ${npc.lastName}` : (lineupScorer?.name ?? '—'), isHero: false, rating: Math.max(7.1, Math.round((rating + 0.6) * 10) / 10), appearance: npc?.appearance },
    scorers: m.scorers.map(({ minute, name, side }) => ({ minute, name, side })),
    interview: m.interviewAnswered ? null : interviewOptions(won),
    deltas,
  }
}

let horseCache: { key: string; horses: HorseView[] } | null = null

export const mockData: GameData = {
  countries: () => COUNTRIES,
  heroOvr() {
    const s = getState()
    return s ? computeOvr(s.hero.attrs, s.hero.position) : 0
  },
  heroAge() {
    const s = getState()
    if (!s) return 0
    return (s.calendar.week >= 20 ? s.calendar.season + 1 : s.calendar.season) - s.hero.birthYear
  },
  ovrHistory() {
    const s = getState()
    if (!s) return []
    const ovr = computeOvr(s.hero.attrs, s.hero.position)
    return Array.from({ length: 12 }, (_, i) => Math.round(ovr - (11 - i) * 0.9 + Math.sin(i * 1.7) * 0.6))
  },
  formHistory() {
    const s = getState()
    return s ? formHistoryOf(s) : []
  },
  activities() {
    const s = getState()
    if (!s) return []
    return ACTIVITIES.map((a): ActivityView => {
      let lockedReason: ActivityView['lockedReason']
      if (a.minReputation && s.hero.reputation < a.minReputation) lockedReason = L(`Şöhret ${a.minReputation}+ gerekli`, `Requires fame ${a.minReputation}+`)
      else if (a.cost > 0 && s.life.money < a.cost) lockedReason = L('Yeterli paran yok', 'Not enough money')
      else if (a.energy > 0 && s.life.energy < a.energy) lockedReason = L('Yeterli enerjin yok', 'Not enough energy')
      const { minReputation: _m, effects, ...rest } = a
      void _m
      return { ...rest, effects: effects.map(({ rel: _r, ...d }) => (void _r, d)), available: !lockedReason, lockedReason }
    })
  },
  dayPlan(): DayPlanView {
    const s = getState()
    if (!s) return { slots: [], energyBudget: 0, projectedEnergy: 0 }
    const f = nextHeroFixture(s)
    const matchToday = !!f && absDay(f.week, f.day) === absDay(s.calendar.week, s.calendar.day)
    let projected = s.life.energy
    const slots: DaySlotView[] = ([0, 1, 2] as const).map((slot) => {
      const planned = s.life.flags[`plan${slot}`]
      const done = s.life.flags[`done${slot}`]
      const activityId = typeof done === 'string' ? done : typeof planned === 'string' ? planned : null
      let state: DaySlotView['state'] = slot < s.calendar.slot ? 'done' : slot === s.calendar.slot ? 'current' : 'upcoming'
      if (matchToday && slot === 2) state = 'match'
      else if (matchToday && slot === 1 && state !== 'done') state = 'blocked'
      if (state !== 'done' && activityId) {
        const a = ACTIVITIES.find((x) => x.id === activityId)
        if (a) projected -= a.energy
      }
      return { slot, state, activityId: state === 'match' || state === 'blocked' ? null : activityId }
    })
    return { slots, energyBudget: s.life.energy, projectedEnergy: Math.max(0, Math.min(100, Math.round(projected))) }
  },
  eventView(i) {
    const s = getState()
    return s ? eventView(s, i) : null
  },
  nextFixture() {
    const s = getState()
    if (!s) return null
    const f = nextHeroFixture(s)
    return f ? fixtureView(s, f, heroClubId(s)) : null
  },
  fixtures() {
    const s = getState()
    if (!s) return []
    const id = heroClubId(s)
    return heroFixtures(s).map((f) => fixtureView(s, f, id)).filter((x): x is FixtureView => !!x)
  },
  preMatch() {
    const s = getState()
    return s ? preMatch(s) : null
  },
  postMatch() {
    const s = getState()
    return s ? postMatch(s) : null
  },
  trainingSessions: () => TRAINING,
  perks() {
    const s = getState()
    if (!s) return []
    return PERKS.map((p): PerkView => {
      const owned = s.hero.perks.includes(p.id)
      return { ...p, owned, available: !owned && p.requires.every((r) => s.hero.perks.includes(r)) && s.hero.perkPoints >= p.cost }
    })
  },
  trainerOffers: () => TRAINERS,
  assetCatalog: () => ASSETS,
  squad() {
    const s = getState()
    const id = s && heroClubId(s)
    if (!s || !id) return []
    const rels = Object.values(s.life.relationships)
    return s.world.clubs[id].squad.map((pid): SquadMemberView => {
      const r = rels.find((x) => x.npcId === pid)
      const p = s.world.players[pid]
      return { player: p, relation: r ? r.value : ((hashString(pid) % 60) - 15), relationId: r?.id ?? null }
    })
  },
  interest() {
    const s = getState()
    if (!s) return []
    const own = heroClubId(s)
    const ids = ['en1-03', 'es1-02', 'de1-05', 'tr1-01', 'en1-11'].filter((x) => x !== own && s.world.clubs[x])
    const notes = [
      L('Baş scout son 3 maçını izledi.', 'Chief scout watched your last 3 games.'),
      L('Kulüp yönetimi menajerinle temas kurdu.', 'The board contacted your agent.'),
      L('Teknik direktör ismini listeye ekledi.', 'The manager added your name to his list.'),
      L('Yerel rakip; ilgi henüz düşük.', 'Domestic rival; interest still low.'),
      L('Kiralık seçeneği değerlendiriliyor.', 'Considering a loan option.'),
    ]
    return ids.map((id, i): InterestView => ({
      club: teamView(s, id) as NonNullable<ReturnType<typeof teamView>>,
      level: Math.max(10, Math.min(95, s.hero.reputation + 40 - i * 12)),
      note: notes[i],
      leagueName: s.world.leagues[s.world.clubs[id].leagueId].name,
    }))
  },
  transferNews() {
    const s = getState()
    if (!s) return []
    const players = Object.values(s.world.players).filter((p) => p.ovr >= 76).slice(0, 8)
    const clubs = Object.values(s.world.clubs)
    return players.map((p, i): NewsItem => {
      const from = s.world.clubs[p.clubId ?? ''] ?? clubs[0]
      const to = clubs[(i * 17 + 5) % clubs.length]
      const fee = Math.round(p.value / 100000) / 10
      return {
        id: `tn${i}`,
        season: s.calendar.season,
        week: Math.max(0, s.calendar.week - i),
        headline: {
          tr: `${p.firstName} ${p.lastName}, ${from.name}’dan ${to.name}’a: ${fee.toLocaleString('tr-TR')} Mn €`,
          en: `${p.firstName} ${p.lastName} joins ${to.name} from ${from.name} for €${fee}M`,
        },
        source: 'Transfer Radar',
        sentiment: 0,
      }
    })
  },
  topScorers(leagueId) {
    const s = getState()
    if (!s) return []
    const lg = s.world.leagues[leagueId]
    if (!lg) return []
    const rows: ScorerRow[] = []
    for (const cid of lg.clubIds) for (const pid of s.world.clubs[cid].squad) {
      const p = s.world.players[pid]
      if (p.stats.goals > 0) rows.push({ playerId: pid, name: `${p.firstName} ${p.lastName}`, clubId: cid, goals: p.stats.goals, assists: p.stats.assists, isHero: false })
    }
    const hid = heroClubId(s)
    if (hid && lg.clubIds.includes(hid)) rows.push({ playerId: 'hero', name: `${s.hero.firstName} ${s.hero.lastName}`, clubId: hid, goals: s.hero.seasonStats.goals, assists: s.hero.seasonStats.assists, isHero: true })
    return rows.sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 20)
  },
  socialFeed() {
    const s = getState()
    if (!s) return []
    const h = s.hero
    const name = `${h.firstName} ${h.lastName}`
    const handle = `@${(h.firstName + h.lastName).toLocaleLowerCase('tr-TR').replace(/[^a-z0-9ğüşıöç]/g, '')}`
    const base: SocialPostView[] = [
      { id: 'f1', author: name, handle, isHero: true, verified: true, kind: 'training', text: L('Sabah 7, saha boş, hedef büyük. 💪', '7 a.m., empty pitch, big goals. 💪'), likes: 18400, comments: 412, weekAgo: 0 },
      { id: 'f2', author: 'Tribün Sesi', handle: '@tribunsesi', isHero: false, kind: 'fan', text: L(`${name} bu sezon başka bir seviyede. Milli takım kapıda!`, `${name} is on another level this season. National team calling!`), likes: 5200, comments: 233, weekAgo: 0 },
      { id: 'f3', author: 'Gol TV', handle: '@goltv', isHero: false, verified: true, kind: 'press', text: L('Haftanın golü oylamasında ilk sırada! #HaftanınGolü', 'Leading the Goal of the Week vote! #GOTW'), likes: 9100, comments: 640, weekAgo: 1 },
      { id: 'f4', author: 'kararsiz_taraftar', handle: '@kararsiz', isHero: false, kind: 'hater', text: L('Abartılıyor. Büyük maçta yok.', 'Overrated. Disappears in big games.'), likes: 310, comments: 88, weekAgo: 1 },
      { id: 'f5', author: 'Volta Boots', handle: '@voltaboots', isHero: false, verified: true, kind: 'brand', text: L('Yeni renk, aynı hız. ⚡', 'New colourway, same speed. ⚡'), likes: 22000, comments: 120, weekAgo: 2 },
      { id: 'f6', author: name, handle, isHero: true, verified: true, kind: 'family', text: L('Annemin yemekleri > her şey ❤️', 'Mum’s cooking > everything ❤️'), likes: 31000, comments: 980, weekAgo: 3 },
    ]
    return [...heroPosts, ...base]
  },
  followerHistory() {
    const s = getState()
    return s ? series(`fol${s.meta.seed}`, 16, s.life.followers, 0.04, 0.05) : []
  },
  sponsorOffers() {
    const s = getState()
    if (!s) return []
    const taken = new Set(s.life.sponsors.map((x) => x.brand))
    return SPONSOR_OFFERS.filter((o: SponsorDeal) => !taken.has(o.brand) && !s.life.flags[`declined_${o.id}`])
  },
  investmentHistory(id) {
    const s = getState()
    const inv = s?.life.bank.investments.find((i) => i.id === id)
    if (!inv) return []
    const vol = inv.kind === 'crypto' ? 0.25 : inv.kind === 'startup' ? 0.15 : inv.kind === 'bonds' ? 0.01 : 0.04
    return series(`inv${id}`, 20, inv.value, vol, inv.value >= inv.amount ? 0.006 : -0.01)
  },
  netWorthHistory() {
    const s = getState()
    return s ? series(`nw${s.meta.seed}`, 20, netWorth(s), 0.05, 0.03) : []
  },
  casinoStatus(): CasinoStatus {
    const s = getState()
    const c = s?.life.casino ?? { addiction: 0, won: 0, lost: 0, visitsThisWeek: 0 }
    return { ...c, minBet: 50, maxBet: Math.max(500, Math.min(50000, Math.round((s?.life.money ?? 0) * 0.25 / 50) * 50)) }
  },
  horses() {
    const s = getState()
    const key = s ? `${s.calendar.season}-${s.calendar.week}-${s.calendar.day}` : 'none'
    if (!horseCache || horseCache.key !== key) horseCache = { key, horses: makeHorses(new Rng(hashString(key))) }
    return horseCache.horses
  },
  seasonSummary(): SeasonSummaryView | null {
    const s = getState()
    const id = s && heroClubId(s)
    if (!s || !id) return null
    const league = Object.values(s.world.competitions).find((c) => c.type === 'league' && c.participantIds.includes(id))
    const pos = (league?.table?.findIndex((r) => r.clubId === id) ?? 7) + 1
    const st = s.hero.seasonStats
    const ovr = computeOvr(s.hero.attrs, s.hero.position)
    return {
      season: s.calendar.season,
      club: teamView(s, id) as NonNullable<ReturnType<typeof teamView>>,
      leaguePosition: pos,
      leagueName: s.world.leagues[s.world.clubs[id].leagueId].name,
      stats: { apps: st.apps, goals: st.goals, assists: st.assists, avgRating: st.apps ? Math.round((st.ratingSum / st.apps) * 100) / 100 : 0, motm: st.motm },
      trophies: [L('Hilal Kupası', 'Crescent Cup')],
      awards: [
        { key: 'golden_star', name: L('Altın Yıldız', 'Golden Star'), won: false },
        { key: 'top_scorer', name: L('Gol Kralı', 'Top Scorer'), won: st.goals >= 5 },
        { key: 'young_player', name: L('Sezonun Genç Oyuncusu', 'Young Player of the Season'), won: true },
        { key: 'goal_of_season', name: L('Sezonun Golü', 'Goal of the Season'), won: true },
        { key: 'team_of_season', name: L('Sezonun 11’i', 'Team of the Season'), won: false },
      ],
      ovrStart: ovr - 6,
      ovrEnd: ovr,
      moneyEarned: 486000,
      followersGained: 192000,
      highlights: [
        L('Derbide 90+3’te galibiyet golü', 'Stoppage-time derby winner'),
        L('İlk milli takım golü', 'First national team goal'),
        L('Üst üste 4 maçta gol', 'Scored in 4 consecutive games'),
      ],
    }
  },
  saveSlots() {
    return [1, 2, 3].map(readInfo)
  },
  team(id) {
    const s = getState()
    return s ? teamView(s, id) : null
  },
  leagueTable(leagueId) {
    const s = getState()
    const comp = s ? Object.values(s.world.competitions).find((c) => c.type === 'league' && c.leagueId === leagueId) : undefined
    return comp?.table ?? null
  },
}

