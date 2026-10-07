/**
 * Potential as the scouts see it (GDD 2.3#12, WP-8): a star rating of the
 * hidden `potential` with an uncertainty band that narrows as the hero builds
 * a track record (matches, age, fame) and with a better agent.
 *
 * The noise is deterministic per hero + season (no RNG state consumed), so the
 * reading is stable within a season and moves a little year to year.
 */
import type { Hero, Life } from '../../core/types'
import { hashString } from '../../core/rng'
import { clamp, heroAge } from './common'
import { potentialStars } from './progression'

export interface PotentialView {
  /** Central scout estimate, 0.5..5 in half stars. */
  stars: number
  /** Uncertainty band (inclusive) in half stars. */
  low: number
  high: number
  /** 0..1 scout confidence. */
  confidence: number
}

/** Scout confidence 0.35..0.95. */
export function scoutConfidence(hero: Hero, season: number, life?: Pick<Life, 'agent'>): number {
  const age = heroAge(hero, season)
  const apps = hero.careerStats.apps
  const c = 0.35 + Math.min(0.3, apps / 400) + Math.min(0.15, Math.max(0, age - 16) * 0.02) + hero.reputation / 500 + (life?.agent?.quality ?? 0) * 0.02
  return clamp(c, 0.35, 0.95)
}

export function potentialView(hero: Hero, season: number, life?: Pick<Life, 'agent'>): PotentialView {
  const confidence = scoutConfidence(hero, season, life)
  const spread = (1 - confidence) * 16 // potential points of scout error (±)
  const h = hashString(`${hero.firstName}|${hero.lastName}|${hero.birthYear}|${season}`)
  const noise = ((h % 1000) / 1000 - 0.5) * spread
  const stars = potentialStars(hero.potential, noise)
  const band = Math.round(((1 - confidence) * 3) * 2) / 2 // ± half stars
  return { stars, low: clamp(stars - band, 0.5, 5), high: clamp(stars + band, 0.5, 5), confidence }
}
