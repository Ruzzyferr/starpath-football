/**
 * Match perk hook (WP-8): turns the hero's `match_*` perk effects into match
 * modifiers WITHOUT touching match AI code.
 *
 * How it is consumed
 * ------------------
 * Both the minute-by-minute sim (sim/match/engine + autoResolve) and the
 * real-time Phaser runtime (game/runtime, game/kick, game/ai) read the hero's
 * `MatchPlayer.attrs`. `sim/game/match.ts` builds the hero's match attributes
 * through {@link heroMatchAttributes}, so every perk below is consumed by the
 * exact formulas that already use those attributes:
 *
 * | effect key            | attribute boost (value × factor)        | consumer (examples)                                  |
 * |-----------------------|-----------------------------------------|------------------------------------------------------|
 * | match_finesse         | shooting, setPieces                     | kick.maxSpin (curl), kick.kickSkill('shot')          |
 * | match_shot_power      | shooting, strength                      | kick.shotSpeed                                       |
 * | match_box_presence    | positioning, finishing                  | engine shooter pick, kickSkill close range           |
 * | match_penalty_steady  | composure, finishing                    | kickSkill('penalty'), runtime aim wobble             |
 * | match_header          | heading, jumping                        | kickSkill('header'), runtime head radius             |
 * | match_chip            | composure, finishing                    | kickSkill('chip')                                    |
 * | match_aim_time        | composure                               | runtime bullet-time aim window (0.85+comp×1.35)      |
 * | match_through_ball    | vision, passing                         | kickSkill('through')                                 |
 * | match_cross           | crossing                                | kickSkill('cross'), maxSpin cross                    |
 * | match_free_kick       | setPieces                               | kickSkill('freekick'), topspin/curl                  |
 * | match_tired_passing   | passing, stamina                        | engine pass completion, stamina drain                |
 * | match_assist          | vision                                  | engine assist pick, runtime teammate runs            |
 * | match_one_on_one      | dribbling, agility                      | ai dribble-vs-tackle duel                            |
 * | match_ball_retention  | dribbling, firstTouch                   | ai duel, runtime close control                       |
 * | match_sprint_ball     | pace, stamina                           | model sprint speed, engine stamina drain             |
 * | stamina_drain         | stamina                                 | engine fatigue rate (1.3 − stamina/100)              |
 * | match_intercept       | positioning, tackling                   | ai tackle/intercept read                             |
 * | match_clean_tackle    | tackling                                | ai tackle success                                    |
 * | match_aerial_def      | heading, strength                       | runtime head radius, clearances                      |
 * | match_gk_reaction     | reflexes, agility                       | ai keeper reaction, runtime GK bullet-time           |
 * | match_gk_penalty      | reflexes, positioning                   | runtime penalty read (positioning×0.6+reflexes×0.2)  |
 * | match_gk_sweeper      | agility, pace, passing                  | ai keeper reach / distribution                       |
 * | big_game              | composure (flat, important matches)     | everything composure-based                           |
 *
 * Fraction effects (0.15 = +15%) add `value × FACTOR` attribute points (with
 * FACTOR ≈ 40, so +15% ≈ +6 points); attributes are capped at 99. Flag-like
 * effects (`match_long_throw`, `match_skill_rabona`, `match_weak_foot`) are
 * reported by {@link heroMatchPerkFlags} for UI / future runtime use.
 */
import type { AttributeKey, Attributes, Hero } from '../../core/types'
import { PERK_BY_ID } from '../../data/perks'
import { clamp } from './common'

/** Attribute points per 1.0 of a fractional perk effect. */
export const PERK_POINTS_PER_UNIT = 40

/** Effect key → attribute weights (share of the boost each attribute receives). */
export const MATCH_PERK_ATTRS: Readonly<Record<string, Partial<Record<AttributeKey, number>>>> = {
  match_finesse: { shooting: 0.6, setPieces: 1 },
  match_shot_power: { shooting: 0.6, strength: 0.8 },
  match_box_presence: { positioning: 1, finishing: 0.6 },
  match_penalty_steady: { composure: 0.5, finishing: 0.3 },
  match_header: { heading: 1, jumping: 0.6 },
  match_chip: { composure: 0.6, finishing: 0.5 },
  match_aim_time: { composure: 1 },
  match_through_ball: { vision: 1, passing: 0.5 },
  match_cross: { crossing: 1 },
  match_free_kick: { setPieces: 1 },
  match_tired_passing: { passing: 0.2, stamina: 0.25 },
  match_assist: { vision: 1 },
  match_one_on_one: { dribbling: 1, agility: 0.6 },
  match_ball_retention: { dribbling: 0.7, firstTouch: 0.8 },
  match_sprint_ball: { pace: 0.8, stamina: 0.5 },
  stamina_drain: { stamina: 1 },
  match_intercept: { positioning: 0.8, tackling: 0.6 },
  match_clean_tackle: { tackling: 0.8 },
  match_aerial_def: { heading: 0.9, strength: 0.6 },
  match_gk_reaction: { reflexes: 1.2, agility: 0.6 },
  match_gk_penalty: { reflexes: 0.6, positioning: 1 },
  match_gk_sweeper: { agility: 0.8, pace: 0.8, passing: 0.6 },
}

/** Flat composure in matches with importance ≥ this (big_game perk). */
export const BIG_GAME_IMPORTANCE = 0.7

/** Boolean-ish match effects (no attribute change). */
export const MATCH_PERK_FLAGS = ['match_long_throw', 'match_skill_rabona', 'match_weak_foot'] as const

export interface MatchPerkContext {
  /** 0..1 match importance (derby/final…). */
  importance?: number
}

/** Summed attribute boosts the hero's perks give in a match (points, unrounded). */
export function heroMatchPerkBoosts(hero: Pick<Hero, 'perks'>, ctx: MatchPerkContext = {}): Partial<Record<AttributeKey, number>> {
  const out: Partial<Record<AttributeKey, number>> = {}
  const add = (k: AttributeKey, v: number) => {
    out[k] = (out[k] ?? 0) + v
  }
  for (const id of hero.perks) {
    const p = PERK_BY_ID[id]
    if (!p) continue
    const { key, value } = p.effect
    if (key === 'big_game') {
      if ((ctx.importance ?? 0) >= BIG_GAME_IMPORTANCE) add('composure', value)
      continue
    }
    const w = MATCH_PERK_ATTRS[key]
    if (!w) continue
    for (const [k, share] of Object.entries(w) as [AttributeKey, number][]) add(k, value * PERK_POINTS_PER_UNIT * share)
  }
  return out
}

/** The hero's attributes for a match: `base` plus perk boosts (rounded, capped at 99). */
export function heroMatchAttributes(hero: Pick<Hero, 'perks'>, base: Attributes, ctx: MatchPerkContext = {}): Attributes {
  const boosts = heroMatchPerkBoosts(hero, ctx)
  const out = { ...base }
  for (const [k, v] of Object.entries(boosts) as [AttributeKey, number][]) out[k] = clamp(Math.round(base[k] + v), 1, 99)
  return out
}

/** Flag-like match perks the hero owns (e.g. 'match_long_throw'). */
export function heroMatchPerkFlags(hero: Pick<Hero, 'perks'>): string[] {
  const keys = new Set(hero.perks.map((id) => PERK_BY_ID[id]?.effect.key).filter((k): k is string => !!k))
  return MATCH_PERK_FLAGS.filter((k) => keys.has(k))
}

/** Perk effect keys that change the hero's match attributes (for tests / UI). */
export const CONSUMED_MATCH_EFFECTS: readonly string[] = [...Object.keys(MATCH_PERK_ATTRS), 'big_game']
