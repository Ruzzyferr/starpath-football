/**
 * Equipment (docs/MONETIZASYON.md §6.2, owner decision 2026-10-19): New Star Soccer style stat gear.
 * Pure and deterministic (no RNG).
 *
 * Every boot (and the accessories) adds points to one or more specific attributes WHILE WORN, and the
 * bonus counts in matches: {@link effectiveAttrs} is the single seam the match setup reads
 * (sim/game/match.ts buildTeamFrom → match engine, highlight generation, Phaser key moments). The stored
 * base attributes are never touched, so training, decay and OVR progression all run on the base.
 * Across all equipped gear a stat gains at most {@link GEAR_STAT_CAP}.
 *
 * Gear does one thing: stats. It no longer speeds up training (the rewarded-ad training boost stays).
 * The compression set keeps its fatigue-recovery effect (it is the recovery slot, not a stat item).
 *
 * Gear comes from three places: in-game career cash (anyone, no age gate), diamonds (server-priced, see
 * server/catalog.json "spend"), and rewards for real achievements ({@link rewardGear}: boots sponsor
 * deals, major season awards, trophies). Durations count matches the hero actually plays.
 * Everything lives in `life.flags[GEAR_FLAG]` (per career); with no gear nothing changes, so the
 * golden master is untouched.
 */
import type { AttributeKey, Attributes, LText, Life, Position } from '../../core/types'

export type GearSlot = 'boots' | 'accessory' | 'recovery'
export type GearTier = 'standard' | 'pro' | 'elite' | 'legend'
/** What a piece of gear is for (reward picks by position, store grouping). */
export type GearFamily = 'allround' | 'speed' | 'finishing' | 'playmaking' | 'dribbling' | 'aerial' | 'defending' | 'setpiece' | 'keeper' | 'mental' | 'recovery'

export interface GearDef {
  id: string
  slot: GearSlot
  tier: GearTier
  family: GearFamily
  /** Price in diamonds (the server's spend table is authoritative; parity-tested). */
  price: number
  /** Price in in-game career cash (€). */
  cash: number
  /** Matches it lasts once bought (stacks when bought again). */
  matches: number
  /** Attribute points added while worn. */
  stats?: Partial<Record<AttributeKey, number>>
  /** Fatigue recovery bonus (adds to recoveryMultiplier). */
  recovery?: number
  name: LText
  icon: string
}

/** Most points all equipped gear together can add to any single attribute. */
export const GEAR_STAT_CAP = 5

/** Price and duration by tier: cheap to elite, diamonds and career cash. */
export const GEAR_TIERS: Readonly<Record<GearTier, { gems: number; cash: number; matches: number; name: LText }>> = {
  standard: { gems: 60, cash: 5_000, matches: 20, name: { tr: 'Standart', en: 'Standard' } },
  pro: { gems: 100, cash: 40_000, matches: 40, name: { tr: 'Pro', en: 'Pro' } },
  elite: { gems: 200, cash: 200_000, matches: 60, name: { tr: 'Elit', en: 'Elite' } },
  legend: { gems: 300, cash: 750_000, matches: 80, name: { tr: 'Efsane', en: 'Legend' } },
}
export const GEAR_TIER_ORDER: readonly GearTier[] = ['standard', 'pro', 'elite', 'legend']

type Spec = Omit<GearDef, 'price' | 'cash' | 'matches'> & Partial<Pick<GearDef, 'price' | 'cash' | 'matches'>>
const def = (g: Spec): GearDef => ({ price: GEAR_TIERS[g.tier].gems, cash: GEAR_TIERS[g.tier].cash, matches: GEAR_TIERS[g.tier].matches, ...g })

export const GEAR: readonly GearDef[] = [
  // ── Standard ──
  def({ id: 'classic_boots', slot: 'boots', tier: 'standard', family: 'allround', icon: '👟', name: { tr: 'Klasik Krampon', en: 'Classic Boots' }, stats: { shooting: 1, passing: 1, dribbling: 1, firstTouch: 1 } }),
  def({ id: 'sprint_boots', slot: 'boots', tier: 'standard', family: 'speed', icon: '🏃', name: { tr: 'Koşu Kramponu', en: 'Sprint Boots' }, stats: { pace: 2, acceleration: 1 } }),
  def({ id: 'grip_boots', slot: 'boots', tier: 'standard', family: 'defending', icon: '🦶', name: { tr: 'Tutunan Krampon', en: 'Grip Boots' }, stats: { tackling: 2, balance: 1 } }),
  def({ id: 'training_gloves', slot: 'accessory', tier: 'standard', family: 'keeper', icon: '🧤', name: { tr: 'Antrenman Eldiveni', en: 'Training Gloves' }, stats: { reflexes: 1, handling: 1, diving: 1 } }),
  def({ id: 'compression', slot: 'recovery', tier: 'standard', family: 'recovery', price: 80, cash: 10_000, matches: 40, recovery: 0.2, icon: '🩳', name: { tr: 'Kompresyon Seti', en: 'Compression Set' } }),
  // ── Pro ──
  def({ id: 'striker_boots', slot: 'boots', tier: 'pro', family: 'finishing', icon: '🎯', name: { tr: 'Nişancı Kramponu', en: 'Striker Boots' }, stats: { shooting: 3, finishing: 2, curve: 1 } }),
  def({ id: 'speed_boots', slot: 'boots', tier: 'pro', family: 'speed', icon: '⚡', name: { tr: 'Hız Kramponu', en: 'Speed Boots' }, stats: { pace: 3, acceleration: 3 } }),
  def({ id: 'playmaker_boots', slot: 'boots', tier: 'pro', family: 'playmaking', icon: '🧭', name: { tr: 'Oyun Kurucu Kramponu', en: 'Playmaker Boots' }, stats: { passing: 3, vision: 2, longPassing: 2 } }),
  def({ id: 'aerial_boots', slot: 'boots', tier: 'pro', family: 'aerial', icon: '🦅', name: { tr: 'Hava Hakimi Kramponu', en: 'Aerial Boots' }, stats: { heading: 3, jumping: 2, strength: 1 } }),
  def({ id: 'keeper_gloves', slot: 'accessory', tier: 'pro', family: 'keeper', icon: '🧤', name: { tr: 'Kaleci Eldiveni Pro', en: 'Pro Keeper Gloves' }, stats: { reflexes: 2, handling: 2, diving: 2 } }),
  def({ id: 'mind_band', slot: 'accessory', tier: 'pro', family: 'mental', icon: '🧠', name: { tr: 'Zihin Bandı', en: 'Mind Band' }, stats: { composure: 2, anticipation: 2, vision: 2 } }),
  // ── Elite ──
  def({ id: 'gold_boots', slot: 'boots', tier: 'elite', family: 'allround', icon: '👟', name: { tr: 'Altın Krampon', en: 'Golden Boots' }, stats: { shooting: 2, finishing: 2, passing: 2, dribbling: 2, firstTouch: 2, pace: 2 } }),
  def({ id: 'dribbler_boots', slot: 'boots', tier: 'elite', family: 'dribbling', icon: '🌀', name: { tr: 'Dripling Kramponu', en: 'Dribbler Boots' }, stats: { dribbling: 4, agility: 3, balance: 2, firstTouch: 2 } }),
  def({ id: 'sweeper_boots', slot: 'boots', tier: 'elite', family: 'defending', icon: '🛡️', name: { tr: 'Libero Kramponu', en: 'Sweeper Boots' }, stats: { tackling: 4, positioning: 3, anticipation: 2, strength: 2 } }),
  def({ id: 'freekick_boots', slot: 'boots', tier: 'elite', family: 'setpiece', icon: '🌙', name: { tr: 'Frikik Kramponu', en: 'Free-Kick Boots' }, stats: { setPieces: 4, curve: 4, crossing: 3, longPassing: 2 } }),
  def({ id: 'elite_gloves', slot: 'accessory', tier: 'elite', family: 'keeper', icon: '🧤', name: { tr: 'Elit Kaleci Eldiveni', en: 'Elite Keeper Gloves' }, stats: { reflexes: 4, diving: 3, handling: 3, gkPositioning: 2 } }),
  // ── Legend ──
  def({ id: 'legend_striker', slot: 'boots', tier: 'legend', family: 'finishing', icon: '🔥', name: { tr: 'Efsane Golcü Kramponu', en: 'Legend Striker Boots' }, stats: { finishing: 4, shooting: 4, composure: 3, curve: 3, acceleration: 2 } }),
  def({ id: 'legend_maestro', slot: 'boots', tier: 'legend', family: 'playmaking', icon: '🎼', name: { tr: 'Efsane Maestro Kramponu', en: 'Legend Maestro Boots' }, stats: { passing: 4, vision: 4, longPassing: 3, firstTouch: 3, dribbling: 3 } }),
  def({ id: 'legend_wall', slot: 'boots', tier: 'legend', family: 'defending', icon: '🧱', name: { tr: 'Efsane Duvar Kramponu', en: 'Legend Wall Boots' }, stats: { tackling: 4, heading: 4, positioning: 3, jumping: 3, strength: 3 } }),
  def({ id: 'legend_gloves', slot: 'accessory', tier: 'legend', family: 'keeper', icon: '🧤', name: { tr: 'Efsane Kaleci Eldiveni', en: 'Legend Keeper Gloves' }, stats: { reflexes: 4, diving: 4, handling: 4, gkPositioning: 3, gkDistribution: 3 } }),
]

export const GEAR_BY_ID: Readonly<Record<string, GearDef>> = Object.fromEntries(GEAR.map((g) => [g.id, g]))
export const isKeeperGear = (g: GearDef): boolean => g.family === 'keeper'

/**
 * Cash a player can BUY per career season (packs + diamonds→cash). Kept small so bought money cannot
 * fast-track XP facilities, trainers and reputation (measured in sim/game/gearBalance.node.test.ts).
 */
export const PURCHASED_CASH_PER_SEASON = Number((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SP_CASH_CAP ?? 200_000)

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

/**
 * Reads the career's gear. Saves from before the stat redesign hold the same ids (gold_boots,
 * speed_boots, striker_boots, mind_band, keeper_gloves, compression) in the same slots, so they load as
 * they are and now give stats; an id that no longer exists is dropped.
 */
export function readGear(life: Pick<Life, 'flags'>): GearState {
  const raw = life.flags[GEAR_FLAG]
  if (typeof raw !== 'string') return { inv: {}, eq: {} }
  try {
    const o = JSON.parse(raw) as Partial<GearState>
    const inv: Record<string, number> = {}
    // Clamped: a hand-edited save cannot stack years of gear (10 purchases' worth at most).
    for (const [id, n] of Object.entries(o.inv ?? {})) if (GEAR_BY_ID[id] && typeof n === 'number' && n > 0) inv[id] = Math.min(Math.floor(n), GEAR_BY_ID[id]!.matches * 10)
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

/** Adds an item (bought or earned; stacks its matches) and equips it when its slot is free. */
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

/** Points per attribute from the given items, each attribute capped at {@link GEAR_STAT_CAP}. */
export function statBonusOf(items: readonly GearDef[]): Partial<Record<AttributeKey, number>> {
  const out: Partial<Record<AttributeKey, number>> = {}
  for (const d of items) for (const [k, v] of Object.entries(d.stats ?? {}) as [AttributeKey, number][]) out[k] = Math.min(GEAR_STAT_CAP, (out[k] ?? 0) + v)
  return out
}

/** Points the equipped gear adds per attribute right now (capped). */
export function gearStatBonus(life: Pick<Life, 'flags'>): Partial<Record<AttributeKey, number>> {
  return statBonusOf(equippedGear(life))
}

/**
 * THE match seam: the hero's attributes as a match sees them, base + equipped gear (capped, ≤ 99).
 * Returns a new object; the base is never written. Every match path builds the hero from this
 * (sim/game/match.ts buildTeamFrom).
 */
export function effectiveAttrs(base: Attributes, life: Pick<Life, 'flags'>): Attributes {
  const bonus = gearStatBonus(life)
  const keys = Object.keys(bonus) as AttributeKey[]
  if (!keys.length) return base
  const out = { ...base }
  for (const k of keys) out[k] = Math.min(99, Math.max(1, Math.round(base[k] + (bonus[k] ?? 0))))
  return out
}

/** Fatigue recovery bonus from equipped gear. */
export function gearRecovery(life: Pick<Life, 'flags'>): number {
  return equippedGear(life).reduce((a, d) => a + (d.recovery ?? 0), 0)
}

/** Buys an item with in-game career cash (no real money: open to every age). */
export function buyGearWithCash(life: Pick<Life, 'flags' | 'money'>, id: string): { ok: true; def: GearDef } | { ok: false; why: 'unknown' | 'money' } {
  const def = GEAR_BY_ID[id]
  if (!def) return { ok: false, why: 'unknown' }
  if (life.money < def.cash) return { ok: false, why: 'money' }
  life.money -= def.cash
  addGear(life, id)
  return { ok: true, def }
}

/** Gear families that suit a position, best first (reward picks). */
const FAMILY_FOR: Readonly<Record<Position, readonly GearFamily[]>> = {
  GK: ['keeper'],
  CB: ['defending', 'aerial'], LB: ['defending', 'speed'], RB: ['defending', 'speed'], DM: ['defending', 'playmaking'],
  CM: ['playmaking', 'allround'], AM: ['playmaking', 'dribbling', 'setpiece'],
  LW: ['dribbling', 'speed', 'finishing'], RW: ['dribbling', 'speed', 'finishing'], ST: ['finishing', 'speed', 'aerial'],
}

/** The item a reward of `tier` gives a hero at `position`: the best-fitting family in that tier. */
export function rewardGearFor(position: Position, tier: GearTier): GearDef {
  const inTier = GEAR.filter((g) => g.tier === tier && g.family !== 'recovery' && g.family !== 'mental')
  for (const f of FAMILY_FOR[position]) {
    const hit = inTier.find((g) => g.family === f)
    if (hit) return hit
  }
  // Outfielders fall back on the tier's all-round (or first) boots; keepers always have gloves per tier.
  return inTier.find((g) => g.family === 'allround') ?? inTier.find((g) => g.slot === 'boots')!
}

/** Gives an earned item (sponsor deal, award, trophy) to the hero; returns it for the log line. */
export function rewardGear(life: Pick<Life, 'flags'>, position: Position, tier: GearTier): GearDef {
  const def = rewardGearFor(position, tier)
  addGear(life, def.id)
  return def
}

/** Log line for an earned item. */
export function rewardLine(def: GearDef, why: LText): LText {
  return {
    tr: `🎁 ${why.tr}: ${def.icon} ${def.name.tr} (${GEAR_TIERS[def.tier].name.tr}, ${def.matches} maç) çantanda.`,
    en: `🎁 ${why.en}: ${def.icon} ${def.name.en} (${GEAR_TIERS[def.tier].name.en}, ${def.matches} matches) is in your bag.`,
  }
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
  // At most a few days' worth of ads (3 a day): an edited save cannot bank hundreds.
  return typeof n === 'number' && n > 0 ? Math.min(Math.floor(n), 9) : 0
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
