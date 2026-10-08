/**
 * Applies validated data-only mods to a freshly generated world (2.10#60 / 2.6#119).
 * Only NEW careers use this (newGame): it overrides league and club identity
 * (names, short codes, cities, kit colours, stadium names) and sprinkles the
 * packs' name lists over the generated players. It is purely a rename pass:
 * no RNG of the main stream is read, every random pick comes from a private
 * Rng seeded by (world seed label, club/player id), so the same world + the
 * same mods always give the same result and a mod-free world is untouched.
 */
import type { World } from '../../core/types'
import { Rng } from '../../core/rng'
import { COUNTRY_BY_ID } from '../../data/world/countries'
import { normalizeClubName } from '../../data/world/names'
import { worldGender } from '../../core/gender'
import { activeMods, type InstalledMod } from './mods'

export interface ModWorldReport {
  leagues: number
  clubs: number
  players: number
}

/** Chance a generated player takes a name from a mod's list (per name part). */
export const MOD_NAME_SHARE = 0.4

function initialsOf(name: string): string {
  const tokens = name.split(/[\s-]+/).filter((t) => /^[\p{L}]/u.test(t))
  const letters = tokens.map((t) => t[0]!.toUpperCase())
  return (letters.length > 1 ? letters.join('') : (tokens[0] ?? 'FC').slice(0, 1).toUpperCase()).slice(0, 3)
}

export function applyWorldMods(world: World, mods: readonly InstalledMod[], salt: string | number = 0): ModWorldReport {
  const report: ModWorldReport = { leagues: 0, clubs: 0, players: 0 }
  const active = activeMods(mods)
  if (!active.length) return report

  // ── leagues & clubs (later packs win over earlier ones) ──
  for (const mod of active) {
    for (const l of mod.pack.world?.leagues ?? []) {
      const league = world.leagues[l.id]
      if (!league || league.name === l.name) continue
      league.name = l.name
      report.leagues++
      for (const comp of Object.values(world.competitions)) if (comp.leagueId === l.id && comp.type === 'league') comp.name = { tr: l.name, en: l.name }
    }
    for (const c of mod.pack.world?.clubs ?? []) {
      const club = world.clubs[c.id]
      if (!club) continue
      const mates = Object.values(world.clubs).filter((o) => o.countryId === club.countryId && o.id !== club.id)
      let changed = false
      if (c.name && normalizeClubName(c.name) !== normalizeClubName(club.name) && !mates.some((o) => normalizeClubName(o.name) === normalizeClubName(c.name as string))) {
        club.name = c.name
        club.crest = { ...club.crest, initials: initialsOf(c.name) }
        changed = true
      }
      if (c.shortName && c.shortName !== club.shortName && !mates.some((o) => o.shortName === c.shortName)) { club.shortName = c.shortName; changed = true }
      if (c.city && c.city !== club.city) { club.city = c.city; changed = true }
      if (c.stadium && c.stadium !== club.stadium.name) { club.stadium = { ...club.stadium, name: c.stadium }; changed = true }
      if (c.primary || c.secondary) {
        const primary = c.primary ?? club.colors.primary
        const secondary = c.secondary ?? club.colors.secondary
        if (primary !== club.colors.primary || secondary !== club.colors.secondary) {
          club.colors = { ...club.colors, primary, secondary }
          club.crest = { ...club.crest, colors: [primary, secondary, club.crest.colors[2]] }
          // The away kit swaps the home colours so it always contrasts.
          club.awayColors = { ...club.awayColors, primary: secondary, secondary: primary }
          changed = true
        }
      }
      if (changed) report.clubs++
    }
  }

  // ── player names ──
  const female = worldGender(world) === 'female'
  const clubNames = new Map<string, Set<string>>()
  for (const club of Object.values(world.clubs)) clubNames.set(club.id, new Set(club.squad.map((id) => { const p = world.players[id]; return p ? `${p.firstName} ${p.lastName}` : '' })))
  for (const mod of active) {
    for (const n of mod.pack.names ?? []) {
      const firsts = (female ? n.firstFemale ?? n.first : n.first) ?? []
      const lasts = n.last ?? []
      if (!firsts.length && !lasts.length) continue
      for (const p of Object.values(world.players)) {
        if (COUNTRY_BY_ID[p.nationality]?.nameStyle !== n.style) continue
        const rng = new Rng(`${salt}:${mod.id}:${p.id}`)
        const first = firsts.length && rng.chance(MOD_NAME_SHARE) ? rng.pick(firsts) : p.firstName
        const last = lasts.length && rng.chance(MOD_NAME_SHARE) ? rng.pick(lasts) : p.lastName
        if (first === p.firstName && last === p.lastName) continue
        const used = p.clubId ? clubNames.get(p.clubId) : undefined
        const full = `${first} ${last}`
        if (used?.has(full)) continue
        used?.delete(`${p.firstName} ${p.lastName}`)
        used?.add(full)
        p.firstName = first
        p.lastName = last
        report.players++
      }
    }
  }
  return report
}
