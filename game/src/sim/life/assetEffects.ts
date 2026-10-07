/**
 * Read-only queries over owned assets' special effects. Kept separate from
 * economy.ts so career modules (training, matchOutcome) can depend on it
 * without pulling in the whole economy.
 *
 * Effect key contract (AssetDef.effect.key → meaning of value):
 *  - `recovery`          fraction: faster fatigue recovery & shorter injuries (total capped 0.5)
 *  - `xp_bonus`          fraction: training XP bonus (training ground, home gym; capped 0.3)
 *  - `travel_fatigue`    fraction: less fatigue from away trips (private jet; capped 0.8)
 *  - `happiness_partner` points/week added to the partner relationship (luxury home)
 *  - `stress_relief`     points/week stress reduction (spa, pool, pet, yacht; capped 12)
 *  - `rent_income`       currency/week passive rent (property)
 *  - `business_income`   expected currency/week profit, with weekly variance (business)
 *  - `followers`         fraction: follower growth bonus (supercars, art, fashion)
 *  - `sleep`             extra energy restored each morning (premium bed / smart home)
 *  - `injury_resist`     fraction: lower injury risk (physio room)
 *  - `security`          0..1: lowers burglary/paparazzi event chance (events read it)
 */
import type { AssetDef, Life } from '../../core/types'
import { ASSET_BY_ID } from '../../data/assets'

/** Caps per effect key so stacking many items has diminishing payoff. */
export const ASSET_EFFECT_CAPS: Readonly<Record<string, number>> = {
  recovery: 0.5,
  xp_bonus: 0.3,
  travel_fatigue: 0.8,
  stress_relief: 12,
  followers: 0.5,
  sleep: 15,
  injury_resist: 0.3,
  security: 1,
}

/** Definitions of every asset the hero owns (unknown ids skipped). */
export function ownedAssetDefs(life: Life): AssetDef[] {
  const out: AssetDef[] = []
  for (const a of life.assets) {
    const d = ASSET_BY_ID[a.defId]
    if (d) out.push(d)
  }
  return out
}

/** Sum of an effect key over owned assets, capped by {@link ASSET_EFFECT_CAPS}. */
export function assetEffectTotal(life: Life, key: string): number {
  let v = 0
  for (const d of ownedAssetDefs(life)) if (d.effect?.key === key) v += d.effect.value
  const cap = ASSET_EFFECT_CAPS[key]
  return cap !== undefined ? Math.min(v, cap) : v
}

/** True if any owned asset has this effect. */
export const hasAssetEffect = (life: Life, key: string): boolean => ownedAssetDefs(life).some((d) => d.effect?.key === key)
