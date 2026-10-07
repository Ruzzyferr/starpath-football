/**
 * Club records (2.6#107) and manager sackings/appointments (2.6#40).
 * Both run at season end and are pure functions of the world: new managers are
 * named from a private seeded Rng, so the main simulation stream is untouched.
 */
import type { ClubRecords, World } from '../../core/types'
import { Rng } from '../../core/rng'
import { COUNTRY_DEFS } from '../../data/world/countries'
import { randomName } from './players'
import { seasonCompetitions } from './queries'
import { sortTable } from './table'

export const emptyRecords = (): ClubRecords => ({ titles: 0, bestFinish: null, mostPoints: null, biggestWin: null, heaviestDefeat: null })

/** Folds this season's finished league tables and results into world.records. */
export function updateClubRecords(world: World, season: number): void {
  const rec = (world.records ??= {})
  for (const comp of seasonCompetitions(world, season)) {
    if (comp.type !== 'league' || !comp.table) continue
    const league = comp.leagueId ? world.leagues[comp.leagueId] : undefined
    const tier = league?.tier ?? 1
    sortTable(comp.table, comp.fixtures).forEach((row, i) => {
      const r = (rec[row.clubId] ??= emptyRecords())
      const pos = i + 1
      const b = r.bestFinish
      if (!b || tier < b.tier || (tier === b.tier && pos < b.pos)) r.bestFinish = { pos, season, tier }
      if (!r.mostPoints || row.pts > r.mostPoints.pts) r.mostPoints = { pts: row.pts, season }
      if (tier === 1 && pos === 1) r.titles++
    })
  }
  for (const comp of seasonCompetitions(world, season)) {
    for (const f of comp.fixtures) {
      if (!f.result) continue
      const { home, away } = f.result
      for (const [clubId, gf, ga, opp] of [[f.homeId, home, away, f.awayId], [f.awayId, away, home, f.homeId]] as const) {
        if (!world.clubs[clubId]) continue
        const r = (rec[clubId] ??= emptyRecords())
        const margin = gf - ga
        if (margin > 0 && (!r.biggestWin || margin > r.biggestWin.gf - r.biggestWin.ga || (margin === r.biggestWin.gf - r.biggestWin.ga && gf > r.biggestWin.gf)))
          r.biggestWin = { gf, ga, opponentId: opp, season }
        if (margin < 0 && (!r.heaviestDefeat || -margin > r.heaviestDefeat.ga - r.heaviestDefeat.gf))
          r.heaviestDefeat = { gf, ga, opponentId: opp, season }
      }
    }
  }
}

/** Expectation = rank by reputation inside the league; sack when the final position is far below it or the club is relegated. */
export function reviewManagers(world: World, season: number): void {
  const log = (world.managerChanges ??= [])
  for (const comp of seasonCompetitions(world, season)) {
    if (comp.type !== 'league' || !comp.table || !comp.leagueId) continue
    const league = world.leagues[comp.leagueId]
    const table = sortTable(comp.table, comp.fixtures)
    const n = table.length
    if (n < 6) continue
    const expected = [...table].sort((a, b) => (world.clubs[b.clubId]?.reputation ?? 0) - (world.clubs[a.clubId]?.reputation ?? 0) || (a.clubId < b.clubId ? -1 : 1))
    const relegated = league && league.tier < 3 ? 3 : 0
    table.forEach((row, i) => {
      const club = world.clubs[row.clubId]
      if (!club) return
      const exp = expected.findIndex((e) => e.clubId === row.clubId)
      const down = relegated > 0 && i >= n - relegated
      const underperformed = i - exp >= Math.max(5, Math.round(n * 0.3))
      if (!down && !underperformed) return
      const def = COUNTRY_DEFS.find((c) => c.id === club.countryId)
      const nm = randomName(new Rng(`mgr:${club.id}:${season}`), def?.nameStyle ?? 'english')
      const to = `${nm.firstName} ${nm.lastName}`
      if (to === club.managerName) return
      log.push({ season, clubId: club.id, from: club.managerName, to, reason: down ? 'relegated' : 'sacked' })
      club.managerName = to
    })
  }
}
