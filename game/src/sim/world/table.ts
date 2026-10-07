/**
 * League / group standings: incremental updates, full recomputation and
 * sorting (points → goal difference → goals for → head-to-head mini-table → id).
 */
import type { Fixture, TableRow } from '../../core/types'

/** Number of recent results kept in `TableRow.form` (oldest first, newest last). */
export const FORM_LENGTH = 5
export const POINTS_WIN = 3
export const POINTS_DRAW = 1

/** A zeroed standings row. */
export function emptyRow(clubId: string): TableRow {
  return { clubId, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] }
}

/** Zeroed rows for a list of clubs (in the given order). */
export function createTable(clubIds: readonly string[]): TableRow[] {
  return clubIds.map(emptyRow)
}

export function goalDifference(row: TableRow): number {
  return row.gf - row.ga
}

/** Apply one match from the perspective of `row` (goals for / against). Mutates the row. */
export function applyToRow(row: TableRow, goalsFor: number, goalsAgainst: number): void {
  row.p++
  row.gf += goalsFor
  row.ga += goalsAgainst
  let outcome: 'W' | 'D' | 'L'
  if (goalsFor > goalsAgainst) {
    row.w++
    row.pts += POINTS_WIN
    outcome = 'W'
  } else if (goalsFor === goalsAgainst) {
    row.d++
    row.pts += POINTS_DRAW
    outcome = 'D'
  } else {
    row.l++
    outcome = 'L'
  }
  row.form.push(outcome)
  if (row.form.length > FORM_LENGTH) row.form.splice(0, row.form.length - FORM_LENGTH)
}

/** Apply a result to both clubs' rows (missing rows are ignored). Mutates `rows`. */
export function applyResultToTable(rows: TableRow[], homeId: string, awayId: string, home: number, away: number): void {
  for (const row of rows) {
    if (row.clubId === homeId) applyToRow(row, home, away)
    else if (row.clubId === awayId) applyToRow(row, away, home)
  }
}

function chronological(fixtures: readonly Fixture[]): Fixture[] {
  return [...fixtures].sort((a, b) => a.week - b.week || a.day - b.day || a.round - b.round)
}

/** Recompute a table from scratch from played fixtures (unsorted; row order = clubIds). */
export function computeTable(clubIds: readonly string[], fixtures: readonly Fixture[]): TableRow[] {
  const rows = createTable(clubIds)
  const byId = new Map(rows.map((r) => [r.clubId, r]))
  for (const f of chronological(fixtures)) {
    if (!f.result) continue
    const h = byId.get(f.homeId)
    const a = byId.get(f.awayId)
    if (h) applyToRow(h, f.result.home, f.result.away)
    if (a) applyToRow(a, f.result.away, f.result.home)
  }
  return rows
}

function primaryCompare(a: TableRow, b: TableRow): number {
  return b.pts - a.pts || goalDifference(b) - goalDifference(a) || b.gf - a.gf
}

/**
 * Sorted copy of `rows`. When `fixtures` is given, clubs level on points, GD
 * and GF are separated by a head-to-head mini-table among exactly those clubs.
 * Final tiebreak is club id, so sorting is total and deterministic.
 */
export function sortTable(rows: readonly TableRow[], fixtures?: readonly Fixture[]): TableRow[] {
  const sorted = [...rows].sort((a, b) => primaryCompare(a, b) || (a.clubId < b.clubId ? -1 : a.clubId > b.clubId ? 1 : 0))
  if (!fixtures) return sorted
  let i = 0
  while (i < sorted.length) {
    let j = i + 1
    while (j < sorted.length && primaryCompare(sorted[i], sorted[j]) === 0) j++
    if (j - i > 1) {
      const tied = sorted.slice(i, j)
      sorted.splice(i, j - i, ...sortByHeadToHead(tied, fixtures))
    }
    i = j
  }
  return sorted
}

function sortByHeadToHead(tied: TableRow[], fixtures: readonly Fixture[]): TableRow[] {
  const ids = new Set(tied.map((r) => r.clubId))
  const mini = computeTable(
    tied.map((r) => r.clubId),
    fixtures.filter((f) => f.result && ids.has(f.homeId) && ids.has(f.awayId)),
  )
  const miniById = new Map(mini.map((r) => [r.clubId, r]))
  return [...tied].sort((a, b) => {
    const ma = miniById.get(a.clubId) as TableRow
    const mb = miniById.get(b.clubId) as TableRow
    return primaryCompare(ma, mb) || (a.clubId < b.clubId ? -1 : a.clubId > b.clubId ? 1 : 0)
  })
}

/** 1-based position of a club in a SORTED table, or 0 when absent. */
export function tablePosition(sortedRows: readonly TableRow[], clubId: string): number {
  return sortedRows.findIndex((r) => r.clubId === clubId) + 1
}

/** Form as a compact string, e.g. "WWDLW" (oldest → newest). */
export function formString(row: TableRow): string {
  return row.form.join('')
}

/** Points from the recent form window (0 … 15). */
export function formPoints(row: TableRow): number {
  let s = 0
  for (const f of row.form) s += f === 'W' ? POINTS_WIN : f === 'D' ? POINTS_DRAW : 0
  return s
}
