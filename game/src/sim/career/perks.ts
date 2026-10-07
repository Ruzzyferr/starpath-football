/**
 * Perk helpers: ownership queries, effect lookup and unlocking.
 * Data lives in `data/perks.ts`.
 */
import type { Hero } from '../../core/types'
import { PERKS, PERK_BY_ID, type PerkDef } from '../../data/perks'
import { fill, lt, type Lines } from './common'
import { heroOvr } from './progression'

/** True if the hero owns the perk. */
export const hasPerk = (hero: Pick<Hero, 'perks'>, id: string): boolean => hero.perks.includes(id)

/**
 * Summed effect value of every owned perk with this effect key (0 if none).
 * Example: `xp * (1 + perkValue(hero, 'xp_all'))`.
 */
export function perkValue(hero: Pick<Hero, 'perks'>, key: string): number {
  let v = 0
  for (const id of hero.perks) {
    const p = PERK_BY_ID[id]
    if (p && p.effect.key === key) v += p.effect.value
  }
  return v
}

/** Why a perk cannot be unlocked (null = it can). */
export type PerkBlock = 'owned' | 'innate' | 'points' | 'ovr' | 'attr' | 'position' | 'prereq' | 'reputation' | 'unknown'

/** Check whether the hero may unlock a perk now. */
export function perkBlock(hero: Hero, id: string): PerkBlock | null {
  const p = PERK_BY_ID[id]
  if (!p) return 'unknown'
  if (hasPerk(hero, id)) return 'owned'
  if (p.group === 'innate') return 'innate'
  if (hero.perkPoints < p.cost) return 'points'
  const r = p.requirement
  if (r.minOvr !== undefined && heroOvr(hero) < r.minOvr) return 'ovr'
  if (r.positions && !r.positions.includes(hero.position)) return 'position'
  if (r.attrs) for (const [k, v] of Object.entries(r.attrs)) if (hero.attrs[k as keyof Hero['attrs']] < (v ?? 0)) return 'attr'
  if (r.perks && !r.perks.every((x) => hasPerk(hero, x))) return 'prereq'
  if (r.minReputation !== undefined && hero.reputation < r.minReputation) return 'reputation'
  return null
}

/** Perks the hero could buy right now (ignores perk-point balance if `ignorePoints`). */
export function availablePerks(hero: Hero, ignorePoints = false): PerkDef[] {
  return PERKS.filter((p) => {
    const b = perkBlock(hero, p.id)
    return b === null || (ignorePoints && b === 'points')
  })
}

/** Spend perk points on a perk. Returns feedback; no-op with an explanation if blocked. */
export function unlockPerk(hero: Hero, id: string): Lines {
  const b = perkBlock(hero, id)
  const p = PERK_BY_ID[id]
  if (b !== null || !p) {
    return [fill(lt('“{p}” açılamadı: koşullar sağlanmıyor.', 'Could not unlock “{p}”: requirements not met.'), { p: p?.name ?? lt(id, id) })]
  }
  hero.perkPoints -= p.cost
  hero.perks.push(id)
  return [fill(lt('{i} Yeni yetenek: {p}', '{i} New perk: {p}'), { i: p.icon, p: p.name })]
}

/** Grant an innate (free) perk without spending points. Idempotent. */
export function grantInnatePerk(hero: Hero, id: string): void {
  if (!hasPerk(hero, id) && PERK_BY_ID[id]) hero.perks.push(id)
}
