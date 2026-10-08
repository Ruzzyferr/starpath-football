/** Mock GameState fixture: a rich, deterministic mid-season career. */
import { Rng, clamp } from '../../core/rng'
import { SAVE_VERSION } from '../../core/config'
import {
  ATTRIBUTE_KEYS, isGoalkeepingAttr, type AttributeKey, type Attributes, type GameState, type Hero, type Life, type LogEntry,
  type NewsItem, type Position, type Relationship, type SeasonStats, type Archetype,
} from '../../core/types'
import type { NewGameInput } from '../store'
import { buildWorld, emptyStats, SEASON } from './mockWorld'

export const START_WEEK = 12

const POS_WEIGHTS: Record<Position, Partial<Record<AttributeKey, number>>> = {
  GK: { reflexes: 4, handling: 4, gkPositioning: 2, gkDistribution: 1, composure: 1, jumping: 1, agility: 1 },
  CB: { tackling: 3, heading: 3, strength: 2, positioning: 3, jumping: 1, composure: 1 },
  LB: { pace: 2, tackling: 2, crossing: 2, stamina: 2, positioning: 1 },
  RB: { pace: 2, tackling: 2, crossing: 2, stamina: 2, positioning: 1 },
  DM: { tackling: 3, passing: 2, positioning: 2, stamina: 1, strength: 1, vision: 1 },
  CM: { passing: 3, vision: 2, stamina: 2, firstTouch: 1, workRate: 1, tackling: 1 },
  AM: { passing: 2, vision: 3, dribbling: 2, firstTouch: 2, shooting: 1, composure: 1 },
  LW: { pace: 3, dribbling: 3, crossing: 2, agility: 1, finishing: 1 },
  RW: { pace: 3, dribbling: 3, crossing: 2, agility: 1, finishing: 1 },
  ST: { finishing: 4, shooting: 2, composure: 2, pace: 1, heading: 1, firstTouch: 1, positioning: 1 },
}

export function computeOvr(attrs: Attributes, pos: Position): number {
  const w = POS_WEIGHTS[pos]
  let sum = 0
  let tot = 0
  for (const k of Object.keys(w) as AttributeKey[]) {
    sum += attrs[k] * (w[k] ?? 0)
    tot += w[k] ?? 0
  }
  return Math.round(sum / tot)
}

const ARCH_BONUS: Record<Archetype, AttributeKey[]> = {
  poacher: ['finishing', 'composure', 'positioning'],
  playmaker: ['vision', 'passing', 'firstTouch'],
  winger: ['pace', 'dribbling', 'crossing'],
  wall: ['tackling', 'strength', 'heading'],
  boxToBox: ['stamina', 'workRate', 'tackling'],
  keeper: ['reflexes', 'handling', 'gkPositioning'],
}

function makeAttrs(rng: Rng, arch: Archetype, base: number): Attributes {
  const a = {} as Attributes
  for (const k of ATTRIBUTE_KEYS) {
    const gk = isGoalkeepingAttr(k)
    a[k] = clamp(Math.round(rng.normal(gk && arch !== 'keeper' ? 25 : base, 6)), 10, 90)
  }
  for (const k of ARCH_BONUS[arch]) a[k] = clamp(a[k] + rng.int(8, 13), 10, 92)
  return a
}

function statsLine(rng: Rng, apps: number, goalRate: number): SeasonStats {
  const s = emptyStats()
  s.apps = apps
  s.starts = Math.max(0, apps - rng.int(0, 5))
  s.minutes = s.starts * 85 + (apps - s.starts) * 22
  s.goals = Math.round(apps * goalRate)
  s.assists = Math.round(apps * goalRate * 0.55)
  s.shots = s.goals * 4 + rng.int(3, 12)
  s.shotsOnTarget = Math.round(s.shots * 0.46)
  s.passes = apps * rng.int(22, 34)
  s.passesCompleted = Math.round(s.passes * 0.79)
  s.tackles = apps * rng.int(0, 2)
  s.dribbles = apps * rng.int(1, 3)
  s.yellow = rng.int(0, 4)
  s.ratingSum = apps * clamp(rng.normal(7.0, 0.25), 6.2, 7.8)
  s.motm = Math.round(apps * 0.12)
  return s
}

function addStats(a: SeasonStats, b: SeasonStats): SeasonStats {
  const out = { ...a }
  for (const k of Object.keys(b) as (keyof SeasonStats)[]) out[k] = a[k] + b[k]
  return out
}

export const DEFAULT_INPUT: NewGameInput = {
  firstName: 'Deniz',
  lastName: 'Arslan',
  nickname: 'D. Arslan',
  nationality: 'TR',
  birthYear: SEASON - 19,
  position: 'ST',
  foot: 'R',
  archetype: 'poacher',
  background: 'academy',
  appearance: { skin: 3, hairStyle: 12, hairColor: 1, beard: 1, eyeColor: 1, face: 5, accessory: 0 },
  difficulty: 'normal',
}

function L(tr: string, en: string) {
  return { tr, en }
}

/** Build a full GameState. `fresh` = a brand-new career (no history). */
export function buildState(input: NewGameInput, seed: number, fresh: boolean): GameState {
  const playedWeeks = fresh ? 0 : START_WEEK
  const { world, heroClubId } = buildWorld(seed, playedWeeks)
  const rng = new Rng(seed ^ 0x5eed)
  const club = world.clubs[heroClubId]!
  const attrs = makeAttrs(rng, input.archetype, fresh ? 54 : 63)
  const teammates = club.squad.slice(0, 22).filter((id) => world.players[id]!.position !== 'GK').slice(0, 6)

  const season = fresh ? emptyStats() : statsLine(rng, 12, 0.42)
  const prev1 = statsLine(rng, 24, 0.28)
  const prev2 = statsLine(rng, 9, 0.15)
  const career = fresh ? emptyStats() : addStats(addStats(prev1, prev2), season)

  const hero: Hero = {
    firstName: input.firstName,
    lastName: input.lastName,
    nickname: input.nickname || `${input.firstName[0] ?? ''}. ${input.lastName}`,
    gender: input.gender ?? 'male',
    nationality: input.nationality,
    birthYear: input.birthYear,
    position: input.position,
    foot: input.foot,
    appearance: input.gender === 'female' ? { ...input.appearance, gender: 'female' } : input.appearance,
    archetype: input.archetype,
    background: input.background,
    attrs,
    attrXp: Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, Math.round(rng.next() * 90) / 100])) as Partial<Record<AttributeKey, number>>,
    potential: 88,
    perkPoints: fresh ? 1 : 2,
    perks: fresh ? [] : ['clinical', 'engine', 'finesse'],
    form: fresh ? 50 : 68,
    morale: 72,
    sharpness: fresh ? 60 : 82,
    fatigue: 24,
    injury: null,
    suspendedMatches: 0,
    contract: {
      clubId: heroClubId,
      wage: fresh ? 2500 : 9500,
      untilSeason: SEASON + 2,
      signingBonus: 50000,
      goalBonus: 1500,
      assistBonus: 750,
      releaseClause: 12000000,
      role: fresh ? 'rotation' : 'starter',
    },
    managerTrust: fresh ? 50 : 64,
    reputation: fresh ? 12 : 38,
    shirtNumber: 9,
    nationalTeam: { called: !fresh, caps: fresh ? 0 : 3, goals: fresh ? 0 : 1 },
    seasonStats: season,
    careerStats: career,
    history: fresh ? [] : [
      { season: SEASON - 2, clubId: heroClubId, clubName: club.name, leagueName: world.leagues[club.leagueId]!.name, stats: prev2, leaguePosition: 9, trophies: [] },
      { season: SEASON - 1, clubId: heroClubId, clubName: club.name, leagueName: world.leagues[club.leagueId]!.name, stats: prev1, leaguePosition: 6, trophies: ['Hilal Kupası'] },
    ],
    trophies: fresh ? [] : [{ season: SEASON - 1, name: L('Hilal Kupası', 'Crescent Cup') }],
    awards: fresh ? [] : [
      { season: SEASON - 1, key: 'young_player', name: L('Yılın Genç Oyuncusu', 'Young Player of the Year') },
      { season: SEASON - 1, key: 'potm_month', name: L('Ayın Oyuncusu (Mart)', 'Player of the Month (March)') },
    ],
    retired: false,
  }

  const relationships: Record<string, Relationship> = {}
  const addRel = (id: string, kind: Relationship['kind'], name: string, value: number, memory: [string, string][], npcId?: string) => {
    relationships[id] = { id, kind, name, value, memory: memory.map(([tr, en]) => ({ tr, en })), lastContactWeek: playedWeeks - rng.int(0, 3), npcId }
  }
  addRel('mother', 'mother', 'Ayşe Arslan', 78, [['Doğum gününü kutladın', 'You called on her birthday'], ['Maçına geldi', 'She came to your match']])
  addRel('father', 'father', 'Kemal Arslan', 61, [['Taktik tartışması yaptınız', 'You argued about tactics']])
  addRel('sibling', 'sibling', 'Elif Arslan', 70, [['Birlikte FIFA oynadınız', 'You played video games together']])
  addRel('partner', 'partner', 'Zeynep', 54, [['Randevuyu iptal ettin', 'You cancelled a date'], ['Hediye aldın', 'You bought her a gift']])
  addRel('bestFriend', 'bestFriend', 'Oğuz', 82, [['Mahalle maçına gittin', 'You joined the neighbourhood game']])
  addRel('manager', 'manager', club.managerName, 34, [['Seni ilk 11’e aldı', 'He put you in the starting XI']])
  addRel('agent', 'agent', 'Cem Varol', 45, [['Yeni sponsor buldu', 'Found a new sponsor']])
  addRel('fans', 'fans', club.name, 58, [['Derbide gol attın', 'You scored in the derby']])
  addRel('press', 'press', 'Spor Basını', 12, [['Röportajda sert konuştun', 'You were blunt in an interview']])
  addRel('chairman', 'chairman', 'Nihat Özkan', 30, [])
  teammates.forEach((pid, i) => {
    const p = world.players[pid]!
    const v = [65, 40, 12, -8, -35, 80][i] ?? 20
    addRel(`tm-${pid}`, 'teammate', `${p.firstName} ${p.lastName}`, v, v > 30 ? [['Gol pası verdi', 'Set up your goal']] : v < 0 ? [['Antrenmanda tartıştınız', 'You clashed at training']] : [], pid)
  })

  const log: LogEntry[] = []
  const kinds: NonNullable<LogEntry['kind']>[] = ['match', 'event', 'money', 'relation', 'career', 'award', 'injury']
  const LOG_TEXT: Record<string, [string, string]> = {
    match: ['{opp} maçında gol attın, puan 7,8', 'Scored against {opp}, rated 7.8'],
    event: ['Basın toplantısında takımı savundun', 'Defended the team at a press conference'],
    money: ['Sponsor ödemesi yattı', 'Sponsor payment received'],
    relation: ['{name} ile ilişkin güçlendi', 'Your bond with {name} grew stronger'],
    career: ['İlk 11’de yer almaya başladın', 'Became a regular starter'],
    award: ['Haftanın 11’ine seçildin', 'Named in the Team of the Week'],
    injury: ['Hafif ayak bileği burkulması', 'Minor ankle sprain'],
  }
  const icons: Record<string, string> = { match: 'ball', event: 'chat', money: 'coins', relation: 'heart', career: 'career', award: 'medal', injury: 'bandage' }
  const opps = world.leagues[club.leagueId]!.clubIds.filter((x) => x !== heroClubId).map((x) => world.clubs[x]!.name)
  const total = fresh ? 1 : 40
  for (let i = 0; i < total; i++) {
    const kind = fresh ? 'career' : kinds[i % kinds.length]
    const wk = Math.max(0, playedWeeks - Math.floor(i / 3))
    const [tr, en] = LOG_TEXT[kind!]!
    const opp = opps[i % opps.length]
    const name = Object.values(relationships)[i % 8]!.name
    log.push({ season: SEASON - (wk === 0 && i > 30 ? 1 : 0), week: wk, day: (i * 3) % 7, kind, icon: icons[kind!], text: { tr: tr.replace('{opp}', opp!).replace('{name}', name), en: en.replace('{opp}', opp!).replace('{name}', name) } })
  }
  if (fresh) log[0]!.text = L(`${club.name} ile ilk profesyonel sözleşmeni imzaladın!`, `You signed your first pro contract with ${club.name}!`)

  const HEAD: [string, string, -1 | 0 | 1][] = [
    ['{hero} durdurulamıyor: üst üste üçüncü gol', '{hero} unstoppable: third goal in a row', 1],
    ['{club} teknik direktörü: "Gençlerimize güveniyoruz"', '{club} boss: "We trust our youngsters"', 0],
    ['Avrupa devleri {hero} için tribünde', 'European giants scouting {hero}', 1],
    ['{club} deplasmanda dağıldı', '{club} collapse away from home', -1],
    ['Derbi öncesi gergin bekleyiş', 'Tension builds before the derby', 0],
    ['{hero} gece hayatıyla gündemde', '{hero} in the headlines for nightlife', -1],
    ['Transfer bombası: {rival} yıldızını satıyor', 'Transfer bombshell: {rival} sell their star', 0],
    ['Ümit Milli Takım kadrosu açıklandı', 'U21 national squad announced', 1],
    ['{rival} hocasıyla yollarını ayırdı', '{rival} part ways with their manager', 0],
    ['Taraftarlardan {hero} için koreografi', 'Fans unveil a tifo for {hero}', 1],
    ['Sakatlık kabusu: {rival} kaptanı sezonu kapattı', 'Injury nightmare: {rival} captain out for the season', -1],
    ['Lig liderliğinde nefesler tutuldu', 'Title race goes to the wire', 0],
  ]
  const news: NewsItem[] = []
  const heroName = `${input.firstName} ${input.lastName}`
  for (let i = 0; i < (fresh ? 4 : 25); i++) {
    const [tr, en, sentiment] = HEAD[i % HEAD.length]!
    const rival = world.clubs[world.leagues.tr1!.clubIds[(i * 5) % 18]!]!.name
    const sub = (s: string) => s.replace('{hero}', heroName).replace('{club}', club.name).replace('{rival}', rival)
    news.push({
      id: `n${i}`,
      season: SEASON,
      week: Math.max(0, playedWeeks - Math.floor(i / 2)),
      headline: { tr: sub(tr), en: sub(en) },
      body: { tr: 'Kulüp kaynaklarına göre gelişmeler önümüzdeki günlerde netleşecek.', en: 'According to club sources, things will become clearer in the coming days.' },
      source: ['Fotomaç Gazetesi', 'Yıldız Spor', 'Albion Sport Daily', 'Gol TV', 'Tribün Dergi'][i % 5]!,
      sentiment,
    })
  }

  const life: Life = {
    money: fresh ? 15000 : 185000,
    bank: {
      savings: fresh ? 0 : 60000,
      loan: fresh ? null : { principal: 120000, remaining: 74000, weeklyPayment: 1800, rate: 0.09 },
      investments: fresh ? [] : [
        { id: 'inv1', kind: 'index', name: L('Dünya Endeks Fonu', 'World Index Fund'), amount: 40000, value: 44800 },
        { id: 'inv2', kind: 'startup', name: L('FitTrack girişimi', 'FitTrack startup'), amount: 20000, value: 13500 },
        { id: 'inv3', kind: 'property', name: L('İzmir kiralık daire', 'İzmir rental flat'), amount: 90000, value: 97000 },
      ],
      creditScore: 712,
    },
    assets: fresh ? [] : [
      { defId: 'flat_city', boughtSeason: SEASON - 1, boughtWeek: 20, pricePaid: 220000 },
      { defId: 'suv', boughtSeason: SEASON, boughtWeek: 3, pricePaid: 145000 },
      { defId: 'dog', boughtSeason: SEASON, boughtWeek: 8, pricePaid: 2500 },
    ],
    energy: 78,
    happiness: 66,
    health: 91,
    stress: 32,
    discipline: 74,
    followers: fresh ? 1200 : 248000,
    relationships,
    agent: { name: 'Cem Varol', quality: 3, commission: 0.08 },
    sponsors: fresh ? [] : [
      { id: 'sp_local', brand: 'Kardelen Su', category: 'drink', weekly: 1200, untilSeason: SEASON + 1, minReputation: 15 },
      { id: 'sp_boots0', brand: 'Volta Boots', category: 'boots', weekly: 2800, untilSeason: SEASON + 2, minReputation: 30 },
    ],
    trainer: fresh ? null : { name: 'Hakan Tekin', group: 'technical', weeklyFee: 2400 },
    casino: { addiction: fresh ? 0 : 14, won: fresh ? 0 : 8200, lost: fresh ? 0 : 11650, visitsThisWeek: 0 },
    flags: {},
    eventHistory: {},
    log,
    news,
  }

  const st: GameState = {
    version: SAVE_VERSION,
    meta: { id: `career-${seed}`, slot: 1, createdAt: Date.UTC(2026, 9, 1), updatedAt: Date.UTC(2026, 9, 7), playTimeSec: fresh ? 0 : 14 * 3600 + 22 * 60, seed, difficulty: input.difficulty },
    rng: new Rng(seed ^ 0xabc).state,
    calendar: { season: SEASON, week: playedWeeks, day: 3, slot: 0 },
    world,
    hero,
    life,
    pendingEvents: fresh ? [] : [
      { defId: 'penalty_taker', vars: { captain: relationships[`tm-${teammates[0]}`]?.name ?? 'Kaptan' }, firedAt: { season: SEASON, week: playedWeeks, day: 3, slot: 0 } },
      { defId: 'viral_skill', vars: {}, firedAt: { season: SEASON, week: playedWeeks, day: 3, slot: 0 } },
    ],
    activeMatchId: null,
  }
  return st
}

export function createMockState(seed = 2026): GameState {
  return buildState(DEFAULT_INPUT, seed, false)
}
