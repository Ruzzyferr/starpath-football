/**
 * Gear bought with diamonds (docs/MONETIZASYON.md §6.2). Pure and deterministic (no RNG).
 *
 * Gear only speeds up TRAINING XP (and the compression set, fatigue recovery). It never enters the
 * match engine: what money buys is getting to a stat sooner, never a better result with the same stats.
 * Durations are counted in matches the hero actually plays and are shown before buying.
 * Everything lives in `life.flags[GEAR_FLAG]` (per career); with no gear every multiplier is 1, so the
 * golden master is untouched.
 */
import type { AttributeGroup, LText, Life } from '../../core/types'

export type GearSlot = 'boots' | 'accessory' | 'recovery'

export interface GearDef {
  id: string
  slot: GearSlot
  /** Price in diamonds. */
  price: number
  /** Matches it lasts once equipped. */
  matches: number
  /** Training XP bonus on every attribute. */
  xpAll?: number
  /** Training XP bonus on one attribute group. */
  xpGroup?: { group: AttributeGroup; pct: number }
  /** Fatigue recovery bonus (adds to recoveryMultiplier). */
  recovery?: number
  name: LText
  desc: LText
  icon: string
}

export const GEAR: readonly GearDef[] = [
  { id: 'gold_boots', slot: 'boots', price: 300, matches: 60, xpAll: 0.15, icon: '👟', name: { tr: 'Altın Krampon', en: 'Golden Boots' }, desc: { tr: 'Tüm antrenman XP’si +%15.', en: 'All training XP +15%.' } },
  { id: 'speed_boots', slot: 'boots', price: 150, matches: 40, xpGroup: { group: 'physical', pct: 0.2 }, icon: '⚡', name: { tr: 'Hız Kramponu', en: 'Speed Boots' }, desc: { tr: 'Fiziksel antrenman XP’si +%20.', en: 'Physical training XP +20%.' } },
  { id: 'striker_boots', slot: 'boots', price: 150, matches: 40, xpGroup: { group: 'technical', pct: 0.2 }, icon: '🎯', name: { tr: 'Nişancı Kramponu', en: 'Striker Boots' }, desc: { tr: 'Teknik antrenman XP’si (şut, pas, dribling) +%20.', en: 'Technical training XP (shooting, passing, dribbling) +20%.' } },
  { id: 'mind_band', slot: 'accessory', price: 150, matches: 40, xpGroup: { group: 'mental', pct: 0.2 }, icon: '🧠', name: { tr: 'Zihin Bandı', en: 'Mind Band' }, desc: { tr: 'Mental antrenman XP’si +%20.', en: 'Mental training XP +20%.' } },
  { id: 'keeper_gloves', slot: 'accessory', price: 150, matches: 40, xpGroup: { group: 'goalkeeping', pct: 0.2 }, icon: '🧤', name: { tr: 'Kaleci Eldiveni Pro', en: 'Pro Keeper Gloves' }, desc: { tr: 'Kalecilik antrenman XP’si +%20.', en: 'Goalkeeping training XP +20%.' } },
  { id: 'compression', slot: 'recovery', price: 120, matches: 40, recovery: 0.2, icon: '🩳', name: { tr: 'Kompresyon Seti', en: 'Compression Set' }, desc: { tr: 'Yorgunluk toparlanması +%20.', en: 'Fatigue recovery +20%.' } },
]

export const GEAR_BY_ID: Readonly<Record<string, GearDef>> = Object.fromEntries(GEAR.map((g) => [g.id, g]))

/** Ceiling on the total gear XP bonus (§6.2: separate from facilities, perks and the trainer). */
export const GEAR_XP_CAP = 0.25
/** Physio session: diamonds, and the halved price with a watched ad. */
export const PHYSIO_PRICE = 100
/** One-off training boost from a rewarded ad: the next session's XP. */
export const AD_TRAIN_BOOST = 0.2

export const GEAR_FLAG = 'g:gear'
const AD_BOOST_FLAG = 'g:adTrain'

export interface GearState {
  /** Matches left per owned item (equipped or waiting in the bag). */
  inv: Record<string, number>
  eq: Partial<Record<GearSlot, string>>
}

export function readGear(life: Pick<Life, 'flags'>): GearState {
  const raw = life.flags[GEAR_FLAG]
  if (typeof raw !== 'string') return { inv: {}, eq: {} }
  try {
    const o = JSON.parse(raw) as Partial<GearState>
    const inv: Record<string, number> = {}
    for (const [id, n] of Object.entries(o.inv ?? {})) if (GEAR_BY_ID[id] && typeof n === 'number' && n > 0) inv[id] = Math.floor(n)
    const eq: Partial<Record<GearSlot, string>> = {}
    for (const [slot, id] of Object.entries(o.eq ?? {})) if (typeof id === 'string' && inv[id] && GEAR_BY_ID[id]?.slot === slot) eq[slot as GearSlot] = id
    return { inv, eq }
  } catch {
    return { inv: {}, eq: {} }
  }
}

function writeGear(life: Pick<Life, 'flags'>, g: GearState): void {
  if (!Object.keys(g.inv).length) delete life.flags[GEAR_FLAG]
  else life.flags[GEAR_FLAG] = JSON.stringify(g)
}

/** Equipped items with matches left. */
export function equippedGear(life: Pick<Life, 'flags'>): GearDef[] {
  const g = readGear(life)
  return Object.values(g.eq).map((id) => GEAR_BY_ID[id!]).filter((d): d is GearDef => !!d)
}

/** Adds a bought item (stacks its matches) and equips it when its slot is free. */
export function addGear(life: Pick<Life, 'flags'>, id: string): boolean {
  const def = GEAR_BY_ID[id]
  if (!def) return false
  const g = readGear(life)
  g.inv[id] = (g.inv[id] ?? 0) + def.matches
  if (!g.eq[def.slot]) g.eq[def.slot] = id
  writeGear(life, g)
  return true
}

/** Puts an owned item in its slot; the one it replaces keeps its matches in the bag. */
export function equipGear(life: Pick<Life, 'flags'>, id: string): boolean {
  const g = readGear(life)
  const def = GEAR_BY_ID[id]
  if (!def || !g.inv[id]) return false
  g.eq[def.slot] = id
  writeGear(life, g)
  return true
}

export function unequipGear(life: Pick<Life, 'flags'>, slot: GearSlot): void {
  const g = readGear(life)
  delete g.eq[slot]
  writeGear(life, g)
}

/** Gear XP bonus for an attribute of `group` (capped at {@link GEAR_XP_CAP}). */
export function gearXpBonus(life: Pick<Life, 'flags'>, group: AttributeGroup): number {
  let b = 0
  for (const d of equippedGear(life)) b += (d.xpAll ?? 0) + (d.xpGroup?.group === group ? d.xpGroup.pct : 0)
  return Math.min(GEAR_XP_CAP, b)
}

/** Fatigue recovery bonus from equipped gear. */
export function gearRecovery(life: Pick<Life, 'flags'>): number {
  return equippedGear(life).reduce((a, d) => a + (d.recovery ?? 0), 0)
}

/** One match played: equipped items lose a match; worn-out ones leave. Returns the ones that wore out. */
export function wearGear(life: Pick<Life, 'flags'>): GearDef[] {
  const g = readGear(life)
  const out: GearDef[] = []
  for (const [slot, id] of Object.entries(g.eq) as [GearSlot, string][]) {
    const left = (g.inv[id] ?? 0) - 1
    if (left > 0) g.inv[id] = left
    else {
      delete g.inv[id]
      delete g.eq[slot]
      out.push(GEAR_BY_ID[id]!)
    }
  }
  writeGear(life, g)
  return out
}

/** Rewarded-ad training boost: sessions banked (each = +{@link AD_TRAIN_BOOST} XP on one session). */
export function adTrainBoosts(life: Pick<Life, 'flags'>): number {
  const n = life.flags[AD_BOOST_FLAG]
  return typeof n === 'number' && n > 0 ? n : 0
}
export function addAdTrainBoost(life: Pick<Life, 'flags'>): void {
  life.flags[AD_BOOST_FLAG] = adTrainBoosts(life) + 1
}
/** Uses one banked boost (call once per session); returns the XP multiplier for that session. */
export function takeAdTrainBoost(life: Pick<Life, 'flags'>): number {
  const n = adTrainBoosts(life)
  if (!n) return 1
  if (n === 1) delete life.flags[AD_BOOST_FLAG]
  else life.flags[AD_BOOST_FLAG] = n - 1
  return 1 + AD_TRAIN_BOOST
}
