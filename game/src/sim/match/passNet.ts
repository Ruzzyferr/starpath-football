/**
 * Per-pair pass telemetry (GAP 2.4#36). Pure counting: nothing here draws from
 * the match RNG or feeds back into outcomes, so the golden master is untouched.
 * Background involvement is derived from a stateless hash of (seed, clock, mate).
 */
import type { PassPair } from './types'

export type PassNet = Record<string, PassPair>

/** Stateless 0..1 hash (FNV-1a over the parts). */
export function hash01(...parts: (string | number)[]): number {
  let h = 2166136261
  for (const c of parts.join('|')) {
    h ^= c.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 15
  h = Math.imul(h, 2246822519)
  h ^= h >>> 13
  return ((h >>> 0) % 100000) / 100000
}

/** How willing a team-mate is to look for the hero: 0.15 (relation -100) .. 1.35 (relation +100). */
export function feedWillingness(relation: number): number {
  return 0.15 + ((Math.max(-100, Math.min(100, relation)) + 100) / 200) * 1.2
}

export function addPass(net: PassNet, id: string, dir: keyof PassPair, n = 1): void {
  const p = (net[id] ??= { from: 0, to: 0 })
  p[dir] += n
}

export function mergePassNet(into: PassNet, add: PassNet | undefined): void {
  if (!add) return
  for (const [id, p] of Object.entries(add)) {
    addPass(into, id, 'from', p.from)
    addPass(into, id, 'to', p.to)
  }
}

export interface MateRel {
  id: string
  relation: number
}

/**
 * One background minute: which team-mates fed the hero (possession only) and
 * which the hero passed to. `attempts` is the hero pass count already decided.
 */
export function backgroundPasses(net: PassNet, mates: readonly MateRel[], seed: number, stamp: string, inPossession: boolean, attempts: number): void {
  if (mates.length === 0) return
  if (inPossession) {
    for (const m of mates) {
      if (hash01(seed, stamp, 'f', m.id) < 0.16 * feedWillingness(m.relation)) addPass(net, m.id, 'from')
    }
  }
  for (let i = 0; i < attempts; i++) {
    // hero prefers friends a little, picks by weighted hash roll
    const total = mates.reduce((a, m) => a + 0.6 + feedWillingness(m.relation) * 0.4, 0)
    let r = hash01(seed, stamp, 't', i) * total
    for (const m of mates) {
      r -= 0.6 + feedWillingness(m.relation) * 0.4
      if (r <= 0) {
        addPass(net, m.id, 'to')
        break
      }
    }
  }
}

export type PassBand = 'cold' | 'cool' | 'warm' | 'close'

/** Relationship band used for the "why" line. */
export function relationBand(relation: number): PassBand {
  return relation <= -25 ? 'cold' : relation < 25 ? 'cool' : relation < 60 ? 'warm' : 'close'
}

export interface PassRow {
  id: string
  name: string
  from: number
  to: number
  relation: number
  band: PassBand
}

/** Splits the pass network into those who fed the hero (most first) and those who ignored him (lowest relation first). */
export function splitPassNet(rows: readonly PassRow[], max = 4): { fed: PassRow[]; ignored: PassRow[] } {
  const fed = rows.filter((r) => r.from > 0).sort((a, b) => b.from - a.from || b.relation - a.relation).slice(0, max)
  const ignored = rows.filter((r) => r.from === 0).sort((a, b) => a.relation - b.relation || a.name.localeCompare(b.name)).slice(0, max)
  return { fed, ignored }
}
