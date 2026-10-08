/**
 * Minimal but complete GameState factory for event tests. Self-contained: it
 * does not depend on the world/career generators other modules provide.
 */
import { ATTRIBUTE_KEYS, type Attributes, type Club, type GameState, type NpcPlayer, type Position, type Relationship, type SeasonStats } from '../../../core/types'
import { Rng } from '../../../core/rng'

export const emptyStats = (): SeasonStats => ({
  apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, passes: 0, passesCompleted: 0,
  tackles: 0, dribbles: 0, yellow: 0, red: 0, cleanSheets: 0, saves: 0, ratingSum: 0, motm: 0,
})

const FIRST = ['Arda', 'Kerem', 'Baran', 'Mert', 'Emre', 'Luca', 'Jonas', 'Rafa', 'Tom', 'Can', 'Onur', 'Kaan']
const LAST = ['Kaya', 'Demir', 'Şahin', 'Rossi', 'Novak', 'Silva', 'Becker', 'Walsh', 'Ortega', 'Koç']
const POS: Position[] = ['GK', 'CB', 'CB', 'LB', 'RB', 'DM', 'CM', 'CM', 'AM', 'LW', 'RW', 'ST', 'ST', 'GK', 'CB', 'CM', 'LW', 'ST']

export interface FixtureOptions {
  seed?: number
  /** Hero has a partner relationship. */
  partner?: boolean
  money?: number
  reputation?: number
  /** Hero without club/contract. */
  clubless?: boolean
  /** Hero gender (default male). */
  gender?: 'male' | 'female'
}

/** Build a GameState with 1 league × 4 clubs × 18 NPCs, a contracted hero and the usual relationships. */
export function makeTestState(opts: FixtureOptions = {}): GameState {
  const rng = new Rng(opts.seed ?? 1234)
  const players: Record<string, NpcPlayer> = {}
  const clubs: Record<string, Club> = {}
  const clubNames = ['Kuzey Yıldızı', 'Liman FK', 'Atlas United', 'Demirkent SK']
  clubNames.forEach((name, ci) => {
    const id = `c${ci}`
    const squad: string[] = []
    for (let i = 0; i < 18; i++) {
      const pid = `${id}p${i}`
      squad.push(pid)
      players[pid] = {
        id: pid, firstName: rng.pick(FIRST), lastName: rng.pick(LAST), nationality: 'TR', birthYear: 1995 + rng.int(0, 12),
        position: POS[i]!, foot: 'R', ovr: rng.int(55, 80), potential: 80, styleSeed: rng.nextUint(), clubId: id,
        value: 1_000_000, wage: 5000, contractUntil: 2028, morale: 60, form: 50, personality: 'professional',
        appearance: { skin: 0, hairStyle: 0, hairColor: 0, beard: 0, eyeColor: 0, face: 0, accessory: 0 },
        injuredWeeks: 0, stats: emptyStats(),
      }
    }
    clubs[id] = {
      id, name, shortName: name.slice(0, 3).toUpperCase(), city: ['İstanbul', 'İzmir', 'Ankara', 'Trabzon'][ci]!, countryId: 'TR', leagueId: 'L1',
      colors: { primary: '#ff0000', secondary: '#ffffff', pattern: 'plain' },
      awayColors: { primary: '#ffffff', secondary: '#ff0000', pattern: 'plain' },
      crest: { shape: 'shield', symbol: 0, colors: ['#f00', '#fff', '#000'], initials: 'KY' },
      reputation: 60, budget: 5_000_000, wageBudget: 200_000, stadium: { name: `${name} Arena`, capacity: 30000 },
      formation: '4-4-2', style: 'balanced', managerName: 'Hakan Toprak', squad,
    }
  })
  const attrs = Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, 55])) as Attributes
  const rel = (id: string, kind: Relationship['kind'], name: string, value: number, npcId?: string): Relationship => ({
    id, kind, name, value, memory: [], lastContactWeek: 0, ...(npcId ? { npcId } : {}),
  })
  const relationships: Record<string, Relationship> = {
    mother: rel('mother', 'mother', 'Ayşe', 60),
    father: rel('father', 'father', 'Mehmet', 40),
    sibling: rel('sibling', 'sibling', 'Ece', 30),
    bestFriend: rel('bestFriend', 'bestFriend', 'Ozan', 50),
    manager: rel('manager', 'manager', 'Hakan Toprak', 10),
    agent: rel('agent', 'agent', 'Rıza Ateş', 20),
    fans: rel('fans', 'fans', 'Kuzey Yıldızı', 10),
    press: rel('press', 'press', 'Media', 0),
    chairman: rel('chairman', 'chairman', 'Halit Bey', 5),
    tm1: rel('tm1', 'teammate', `${players.c0p6!.firstName} ${players.c0p6!.lastName}`, 20, 'c0p6'),
    tm2: rel('tm2', 'teammate', `${players.c0p11!.firstName} ${players.c0p11!.lastName}`, -10, 'c0p11'),
  }
  if (opts.partner) relationships.partner = rel('partner', 'partner', 'Selin', 45)

  const state: GameState = {
    version: 1,
    meta: { id: 'test', slot: 0, createdAt: 0, updatedAt: 0, playTimeSec: 0, seed: opts.seed ?? 1234, difficulty: 'normal' },
    rng: rng.state,
    calendar: { season: 2026, week: 0, day: 0, slot: 0 },
    world: {
      countries: {
        TR: { id: 'TR', name: { tr: 'Türkiye', en: 'Türkiye' }, adjective: { tr: 'Türk', en: 'Turkish' }, flag: ['#e30a17', '#fff', '#e30a17'], reputation: 70, nameStyle: 'tr' },
      },
      leagues: { L1: { id: 'L1', countryId: 'TR', name: 'Süper Lig', tier: 1, clubIds: Object.keys(clubs), promote: 0, relegate: 2 } },
      clubs,
      players,
      competitions: {},
      honours: [],
    },
    hero: {
      ...(opts.gender === 'female' ? { gender: 'female' as const } : {}),
      firstName: 'Ali', lastName: 'Yılmaz', nickname: 'Aliço', nationality: 'TR', birthYear: 2008, position: 'ST', foot: 'R',
      appearance: { skin: 0, hairStyle: 0, hairColor: 0, beard: 0, eyeColor: 0, face: 0, accessory: 0 },
      role: 'runner', background: 'street', attrs, attrXp: {}, potential: 85, perkPoints: 0, perks: [],
      form: 50, morale: 60, sharpness: 70, fatigue: 20, injury: null, suspendedMatches: 0,
      contract: opts.clubless ? null : { clubId: 'c0', wage: 3000, untilSeason: 2029, signingBonus: 0, goalBonus: 500, assistBonus: 250, releaseClause: null, role: 'rotation' },
      managerTrust: 50, reputation: opts.reputation ?? 30, shirtNumber: 9,
      nationalTeam: { called: false, caps: 0, goals: 0 },
      seasonStats: emptyStats(), careerStats: emptyStats(), history: [], trophies: [], awards: [], retired: false,
    },
    life: {
      money: opts.money ?? 20_000,
      bank: { savings: 0, loan: null, investments: [], creditScore: 600 },
      assets: [], energy: 80, happiness: 60, health: 90, stress: 30, discipline: 70, followers: 5000,
      relationships, agent: { name: 'Rıza Ateş', quality: 2, commission: 0.08 }, sponsors: [], trainer: null,
      casino: { addiction: 0, won: 0, lost: 0, visitsThisWeek: 0 },
      flags: {}, eventHistory: {}, log: [], news: [],
    },
    pendingEvents: [],
    activeMatchId: null,
  }
  return state
}
