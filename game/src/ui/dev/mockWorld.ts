/** Deterministic fictional world for the UI mock backend. */
import { Rng, clamp } from '../../core/rng'
import type {
  Appearance, Club, Competition, CrestSpec, Fixture, Formation, KitColors, League, MatchResultSummary,
  NpcPlayer, Personality, Position, SeasonStats, TableRow, TacticStyle, World,
} from '../../core/types'
import { COUNTRIES, FIRST, LAST, LEAGUE_SEEDS, MANAGERS, PALETTE } from './mockNames'

export const SEASON = 2026
export const MATCH_DAY = 5 // Saturday
export const CUP_DAY = 2 // Wednesday

export function emptyStats(): SeasonStats {
  return {
    apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, passes: 0,
    passesCompleted: 0, tackles: 0, dribbles: 0, yellow: 0, red: 0, cleanSheets: 0, saves: 0, ratingSum: 0, motm: 0,
  }
}

export function randomAppearance(rng: Rng, countryId?: string): Appearance {
  const darkBias = countryId === 'BR' ? 3 : countryId === 'TR' || countryId === 'ES' || countryId === 'PT' || countryId === 'IT' ? 1 : 0
  return {
    skin: clamp(rng.int(0, 7) + darkBias, 0, 9),
    hairStyle: rng.int(0, 14),
    hairColor: rng.weighted([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], (i) => (i <= 2 ? 4 : i === 9 ? 0.3 : 1)),
    beard: rng.weighted([0, 1, 2, 3, 4, 5, 6, 7], (i) => (i === 0 ? 4 : i === 1 ? 3 : 1)),
    eyeColor: rng.weighted([0, 1, 2, 3, 4, 5], (i) => (i <= 1 ? 3 : 1)),
    face: rng.int(0, 5),
    accessory: rng.weighted([0, 1, 2, 3, 4, 5], (i) => (i === 0 ? 6 : 1)),
  }
}

const SHAPES: CrestSpec['shape'][] = ['shield', 'circle', 'diamond', 'hexagon', 'banner']
const PATTERNS: KitColors['pattern'][] = ['plain', 'stripes', 'hoops', 'halves', 'sash', 'chevron']
const FORMATIONS: Formation[] = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2', '4-1-4-1', '3-4-3']
const STYLES: TacticStyle[] = ['possession', 'counter', 'direct', 'pressing', 'defensive', 'balanced']
const PERSONALITIES: Personality[] = ['professional', 'loyal', 'ambitious', 'party', 'hothead', 'quiet', 'leader', 'joker']

const SQUAD_22: Position[] = ['GK', 'GK', 'GK', 'CB', 'CB', 'CB', 'CB', 'LB', 'LB', 'RB', 'RB', 'DM', 'DM', 'CM', 'CM', 'CM', 'AM', 'LW', 'LW', 'RW', 'ST', 'ST']
const SQUAD_16: Position[] = ['GK', 'GK', 'CB', 'CB', 'CB', 'LB', 'RB', 'DM', 'CM', 'CM', 'CM', 'AM', 'LW', 'RW', 'ST', 'ST']

function initialsOf(name: string): string {
  const words = name.replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter((w) => w.length > 1)
  const ini = words.map((w) => w[0].toLocaleUpperCase('tr-TR')).join('')
  return ini.slice(0, 4) || name.slice(0, 3).toUpperCase()
}

export function makePlayer(rng: Rng, id: string, clubId: string | null, pos: Position, baseOvr: number, nameStyle: string, countryId: string): NpcPlayer {
  const ovr = clamp(Math.round(rng.normal(baseOvr, 5)), 40, 92)
  const birthYear = SEASON - rng.int(18, 34)
  const age = SEASON - birthYear
  const potential = clamp(ovr + (age < 23 ? rng.int(4, 16) : age < 28 ? rng.int(0, 5) : 0), ovr, 95)
  const value = Math.round((Math.pow(ovr / 10, 4.2) * 70 * (age < 24 ? 1.4 : age > 30 ? 0.6 : 1)) / 1000) * 1000
  return {
    id,
    firstName: rng.pick(FIRST[nameStyle] ?? FIRST.tr),
    lastName: rng.pick(LAST[nameStyle] ?? LAST.tr),
    nationality: countryId,
    birthYear,
    position: pos,
    foot: rng.weighted(['R', 'L', 'B'] as const, (f) => (f === 'R' ? 7 : f === 'L' ? 2.5 : 0.5)),
    ovr,
    potential,
    styleSeed: rng.nextUint(),
    clubId,
    value,
    wage: Math.round(value / 260 / 50) * 50 + 500,
    contractUntil: SEASON + rng.int(0, 4),
    morale: rng.int(40, 90),
    form: rng.int(35, 85),
    personality: rng.pick(PERSONALITIES),
    appearance: randomAppearance(rng, countryId),
    injuredWeeks: rng.chance(0.06) ? rng.int(1, 6) : 0,
    stats: emptyStats(),
  }
}

/** Circle-method double round robin. Returns [home, away] pairs per round. */
export function roundRobin(ids: string[]): [string, string][][] {
  const list = [...ids]
  if (list.length % 2) list.push('__bye')
  const n = list.length
  const rounds: [string, string][][] = []
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = []
    for (let i = 0; i < n / 2; i++) {
      const a = list[i]
      const b = list[n - 1 - i]
      if (a === '__bye' || b === '__bye') continue
      round.push(r % 2 === 0 ? [a, b] : [b, a])
    }
    rounds.push(round)
    list.splice(1, 0, list.pop() as string)
  }
  const second = rounds.map((rd) => rd.map(([h, a]) => [a, h] as [string, string]))
  return [...rounds, ...second]
}

export function simulateScore(rng: Rng, home: Club, away: Club): [number, number] {
  const diff = (home.reputation - away.reputation) / 40
  const lh = clamp(1.45 + diff + 0.2, 0.3, 3.5)
  const la = clamp(1.15 - diff, 0.25, 3.2)
  return [rng.poisson(lh), rng.poisson(la)]
}

export function makeResult(rng: Rng, world: World, home: Club, away: Club, score?: [number, number]): MatchResultSummary {
  const [h, a] = score ?? simulateScore(rng, home, away)
  const scorers: MatchResultSummary['scorers'] = []
  const pickScorer = (club: Club) => {
    const pool = club.squad.map((id) => world.players[id]).filter((p) => p && p.position !== 'GK')
    const p = rng.weighted(pool, (pl) => (pl.position === 'ST' ? 5 : pl.position === 'LW' || pl.position === 'RW' || pl.position === 'AM' ? 3 : pl.position === 'CM' ? 1.5 : 0.5))
    return p
  }
  for (let i = 0; i < h; i++) {
    const p = pickScorer(home)
    scorers.push({ minute: rng.int(2, 90), playerId: p.id, team: 'home', penalty: rng.chance(0.08) || undefined })
    p.stats.goals++
  }
  for (let i = 0; i < a; i++) {
    const p = pickScorer(away)
    scorers.push({ minute: rng.int(2, 90), playerId: p.id, team: 'away', penalty: rng.chance(0.08) || undefined })
    p.stats.goals++
  }
  scorers.sort((x, y) => x.minute - y.minute)
  return { home: h, away: a, scorers }
}

export function computeTable(comp: Competition): TableRow[] {
  const rows: Record<string, TableRow> = {}
  for (const id of comp.participantIds) rows[id] = { clubId: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] }
  const played = comp.fixtures.filter((f) => f.result).sort((a, b) => a.week - b.week || a.day - b.day)
  for (const f of played) {
    const r = f.result as MatchResultSummary
    const H = rows[f.homeId]
    const A = rows[f.awayId]
    if (!H || !A) continue
    H.p++; A.p++
    H.gf += r.home; H.ga += r.away; A.gf += r.away; A.ga += r.home
    if (r.home > r.away) { H.w++; A.l++; H.pts += 3; H.form.push('W'); A.form.push('L') }
    else if (r.home < r.away) { A.w++; H.l++; A.pts += 3; A.form.push('W'); H.form.push('L') }
    else { H.d++; A.d++; H.pts++; A.pts++; H.form.push('D'); A.form.push('D') }
  }
  const list = Object.values(rows)
  for (const r of list) r.form = r.form.slice(-5)
  return list.sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf || a.clubId.localeCompare(b.clubId))
}

export interface WorldBuild {
  world: World
  heroClubId: string
}

export function buildWorld(seed: number, playedWeeks: number): WorldBuild {
  const rng = new Rng(seed)
  const world: World = { countries: {}, leagues: {}, clubs: {}, players: {}, competitions: {}, honours: [] }
  for (const c of COUNTRIES) world.countries[c.id] = c

  let pid = 0
  LEAGUE_SEEDS.forEach((ls, li) => {
    const country = world.countries[ls.countryId]
    const league: League = { id: ls.id, countryId: ls.countryId, name: ls.name, tier: ls.tier, clubIds: [], promote: ls.promote, relegate: ls.relegate }
    world.leagues[ls.id] = league
    const baseRep = ls.tier === 1 ? country.reputation - 8 : country.reputation - 28
    ls.clubs.forEach(([name, short, city], i) => {
      const id = `${ls.id}-${String(i + 1).padStart(2, '0')}`
      const rep = clamp(Math.round(baseRep + 18 - (i * 30) / ls.clubs.length + rng.int(-4, 4)), 25, 96)
      const c0 = PALETTE[(i * 5 + li * 3) % PALETTE.length]
      let c1 = PALETTE[(i * 3 + li * 7 + 4) % PALETTE.length]
      if (c1 === c0) c1 = '#ffffff'
      const c2 = i % 3 === 0 ? '#ffc83d' : i % 3 === 1 ? '#ffffff' : '#0b1220'
      const club: Club = {
        id,
        name,
        shortName: short,
        city,
        countryId: ls.countryId,
        leagueId: ls.id,
        colors: { primary: c0, secondary: c1, pattern: PATTERNS[(i + li) % PATTERNS.length] },
        awayColors: { primary: c1 === '#ffffff' ? '#f2f5fa' : c1, secondary: c0, pattern: PATTERNS[(i + li + 3) % PATTERNS.length] },
        crest: { shape: SHAPES[(i + li * 2) % SHAPES.length], symbol: (i * 7 + li * 3) % 16, colors: [c0, c1, c2], initials: initialsOf(name) },
        reputation: rep,
        budget: Math.round(Math.pow(rep / 10, 3.2) * 9000) * 10,
        wageBudget: Math.round(Math.pow(rep / 10, 3) * 600) * 10,
        stadium: { name: `${city} ${['Arena', 'Stadyumu', 'Park', 'Parkı'][i % 4]}`, capacity: Math.round((8000 + rep * rep * 6.5) / 500) * 500 },
        formation: FORMATIONS[(i + li) % FORMATIONS.length],
        style: STYLES[(i * 2 + li) % STYLES.length],
        managerName: MANAGERS[(i + li * 5) % MANAGERS.length],
        squad: [],
      }
      const template = ls.id === 'tr1' ? SQUAD_22 : SQUAD_16
      const baseOvr = clamp(Math.round(rep * 0.62 + 22), 45, 86)
      for (const pos of template) {
        const pidStr = `p${++pid}`
        const nat = rng.chance(0.78) ? ls.countryId : rng.pick(COUNTRIES).id
        const style = world.countries[nat].nameStyle
        const p = makePlayer(rng, pidStr, id, pos, baseOvr, style, nat)
        world.players[pidStr] = p
        club.squad.push(pidStr)
      }
      world.clubs[id] = club
      league.clubIds.push(id)
    })

    // League competition
    const rounds = roundRobin(league.clubIds)
    const fixtures: Fixture[] = []
    rounds.forEach((rd, r) => {
      rd.forEach(([h, a], k) => {
        fixtures.push({ id: `${ls.id}-r${r + 1}-${k}`, compId: `${ls.id}-${SEASON}`, round: r + 1, week: r, day: MATCH_DAY, homeId: h, awayId: a, result: null })
      })
    })
    const comp: Competition = {
      id: `${ls.id}-${SEASON}`,
      type: 'league',
      name: { tr: ls.name, en: ls.name },
      season: SEASON,
      countryId: ls.countryId,
      leagueId: ls.id,
      participantIds: [...league.clubIds],
      fixtures,
      table: null,
      alive: null,
      winnerId: null,
    }
    for (const f of fixtures) {
      if (f.week < playedWeeks) {
        const res = makeResult(rng, world, world.clubs[f.homeId], world.clubs[f.awayId])
        f.result = res
        for (const pidS of [...world.clubs[f.homeId].squad, ...world.clubs[f.awayId].squad]) {
          const p = world.players[pidS]
          if (p.position === 'GK' && !pidS.endsWith('0')) continue
          if (rng.chance(0.75)) {
            p.stats.apps++
            p.stats.starts++
            p.stats.minutes += 90
            p.stats.ratingSum += clamp(rng.normal(6.7, 0.6), 4.5, 9.5)
            if (rng.chance(0.08)) p.stats.assists++
          }
        }
      }
    }
    comp.table = computeTable(comp)
    world.competitions[comp.id] = comp

    // Honours
    for (let y = 1; y <= 4; y++) {
      const winner = league.clubIds[rng.int(0, Math.min(4, league.clubIds.length - 1))]
      world.honours.push({ season: SEASON - y, compKey: ls.id, name: { tr: ls.name, en: ls.name }, winnerId: winner })
    }
  })

  // Turkish cup: tr1 + 14 of tr2 = 32 teams
  const cupIds = [...world.leagues.tr1.clubIds, ...world.leagues.tr2.clubIds.slice(0, 14)]
  const shuffled = rng.shuffle([...cupIds])
  const cupFixtures: Fixture[] = []
  const alive: string[] = []
  for (let i = 0; i < shuffled.length; i += 2) {
    const h = shuffled[i]
    const a = shuffled[i + 1]
    const res = makeResult(rng, world, world.clubs[h], world.clubs[a])
    if (res.home === res.away) res.penalties = { home: 4, away: rng.int(2, 5) === 4 ? 3 : rng.int(2, 3) }
    const homeWins = res.home > res.away || (res.home === res.away && (res.penalties?.home ?? 0) > (res.penalties?.away ?? 0))
    cupFixtures.push({ id: `trcup-r1-${i / 2}`, compId: `trcup-${SEASON}`, round: 1, week: 5, day: CUP_DAY, homeId: h, awayId: a, result: res })
    alive.push(homeWins ? h : a)
  }
  for (let i = 0; i < alive.length; i += 2) {
    cupFixtures.push({ id: `trcup-r2-${i / 2}`, compId: `trcup-${SEASON}`, round: 2, week: 14, day: CUP_DAY, homeId: alive[i], awayId: alive[i + 1], result: null })
  }
  world.competitions[`trcup-${SEASON}`] = {
    id: `trcup-${SEASON}`, type: 'cup', name: { tr: 'Hilal Kupası', en: 'Crescent Cup' }, season: SEASON,
    countryId: 'TR', leagueId: null, participantIds: cupIds, fixtures: cupFixtures, table: null, alive, winnerId: null,
  }
  for (let y = 1; y <= 4; y++) world.honours.push({ season: SEASON - y, compKey: 'trcup', name: { tr: 'Hilal Kupası', en: 'Crescent Cup' }, winnerId: world.leagues.tr1.clubIds[rng.int(0, 8)] })

  // Hero club: mid-table tr1 club that is in the cup round 2.
  const table = world.competitions[`tr1-${SEASON}`].table as TableRow[]
  const mid = table.slice(6, 12).map((r) => r.clubId)
  const heroClubId = mid.find((id) => alive.includes(id)) ?? mid[0]
  if (!alive.includes(heroClubId)) {
    // Swap the hero club into round 2 so the demo has a cup tie.
    const f = cupFixtures.find((x) => x.round === 2) as Fixture
    alive[alive.indexOf(f.homeId)] = heroClubId
    f.homeId = heroClubId
  }
  return { world, heroClubId }
}
