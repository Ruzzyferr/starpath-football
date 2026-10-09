/**
 * Social media (GDD 4.6): follower growth, posts, virality and controversy.
 *
 * Follower model
 * --------------
 * Every hero has a fame-based *ceiling* (how many people could plausibly care
 * about a player of this reputation). Weekly organic growth is logistic toward
 * that ceiling: fast while far below it, flattening near it, and a slow 1%
 * bleed when above it (a faded star's audience drifts away). Performance
 * (rating, goals) and perks/assets scale the rate.
 *
 * Posts give a one-off bump scaled by the same headroom, with diminishing
 * returns for spamming within a week, plus a chance to go viral or to spark a
 * controversy (which the event system can pick up via `triggerTags`).
 */
import type { Calendar, Hero, LText, Life } from '../../core/types'
import type { Rng } from '../../core/rng'
import { NEWS_SOURCES, absWeek, clamp, fill, fmtNum, lt, meter, pushNews, type Lines } from '../career/common'
import { perkValue } from '../career/perks'
import { assetEffectTotal } from './assetEffects'
import { changeRelation } from './relationships'
import { addHappiness, addStress } from './wellbeing'
import { checkMoralityClause } from './sponsors'

export type PostType = 'training' | 'luxury' | 'family' | 'charity' | 'provocation' | 'sponsored' | 'thanks' | 'rival'

export interface PostDef {
  id: PostType
  name: LText
  icon: string
  /** Follower gain as a fraction of current followers (before headroom). */
  pct: number
  /** Relationship deltas. */
  fans: number
  press: number
  happiness: number
  /** Base stress (hate comments are rolled separately). */
  stress: number
  discipline: number
  /** Base viral chance (scaled up by reputation). */
  viral: number
  /** Base controversy chance. */
  controversy: number
  tags: readonly string[]
}

/**
 * Post catalogue. Intent:
 *  - training: safe, fans like the work ethic, low reach.
 *  - luxury: big reach but envy — controversy risk grows when fans are cold.
 *  - family: wholesome, best happiness, family-oriented reach.
 *  - charity: press & fans love it, highest "good" viral chance.
 *  - provocation: biggest reach & viral chance, but 35% controversy and
 *    discipline loss — a deliberate high-risk/high-reward option.
 *  - sponsored: low reach (ads are boring) but keeps sponsors happy.
 */
export const POST_TYPES: Readonly<Record<PostType, PostDef>> = {
  training: { id: 'training', icon: '💪', name: lt('Antrenman paylaşımı', 'Training post'), pct: 0.004, fans: 1, press: 0, happiness: 1, stress: 0, discipline: 0, viral: 0.03, controversy: 0.01, tags: ['social'] },
  luxury: { id: 'luxury', icon: '💎', name: lt('Lüks yaşam paylaşımı', 'Luxury lifestyle post'), pct: 0.008, fans: -1, press: 0, happiness: 3, stress: 0, discipline: 0, viral: 0.04, controversy: 0.04, tags: ['social', 'luxury'] },
  family: { id: 'family', icon: '👨‍👩‍👦', name: lt('Aile paylaşımı', 'Family post'), pct: 0.005, fans: 1, press: 1, happiness: 4, stress: -2, discipline: 0, viral: 0.03, controversy: 0.01, tags: ['social', 'family'] },
  charity: { id: 'charity', icon: '🤲', name: lt('Hayır işi paylaşımı', 'Charity post'), pct: 0.006, fans: 2, press: 2, happiness: 2, stress: -1, discipline: 1, viral: 0.05, controversy: 0.01, tags: ['social', 'charity'] },
  provocation: { id: 'provocation', icon: '😈', name: lt('Olay paylaşım', 'Provocative post'), pct: 0.012, fans: 2, press: -3, happiness: 2, stress: 2, discipline: -2, viral: 0.12, controversy: 0.35, tags: ['social', 'provocation'] },
  thanks: { id: 'thanks', icon: '🙏', name: lt('Taraftara teşekkür', 'Thanks to the fans'), pct: 0.005, fans: 4, press: 0, happiness: 2, stress: -1, discipline: 0, viral: 0.04, controversy: 0.01, tags: ['social', 'fans'] },
  rival: { id: 'rival', icon: '🥊', name: lt('Rakibe gönderme', 'Dig at a rival'), pct: 0.01, fans: 2, press: -2, happiness: 1, stress: 1, discipline: -1, viral: 0.1, controversy: 0.22, tags: ['social', 'provocation'] },
  sponsored: { id: 'sponsored', icon: '🏷️', name: lt('Sponsorlu paylaşım', 'Sponsored post'), pct: 0.002, fans: 0, press: 0, happiness: 0, stress: 0, discipline: 0, viral: 0.02, controversy: 0.01, tags: ['social', 'sponsor'] },
}

export interface SocialContext {
  calendar: Calendar
  /** Average match rating this week (0..10), if any matches were played. */
  avgRating?: number
  /** Goals + assists this week. */
  goalContributions?: number
}

/**
 * Plausible audience for a given fame: 5K at reputation 0, ~870K at 50,
 * 150M at 100 (exponential, like real-world star follower counts).
 */
export const followerCeiling = (reputation: number): number => 5000 * Math.pow(30000, clamp(reputation, 0, 100) / 100)

/** Multiplier from perks (`followers_gain`) and assets (`followers`). */
export const followerMultiplier = (hero: Pick<Hero, 'perks'>, life: Life): number =>
  1 + perkValue(hero, 'followers_gain') + assetEffectTotal(life, 'followers')

/** Weekly fade of the follower excess above the fame ceiling. */
export const OVER_CEILING_FADE = 0.08

/** Headroom factor 0.1..1: posts and growth slow down near the ceiling. */
const headroom = (followers: number, ceiling: number): number => clamp(1 - followers / ceiling, 0.1, 1)

/**
 * Weekly organic follower change (can be negative above the ceiling).
 * Rate 1.5%/week base (≈ ×2 per season far from the ceiling), +1% per rating
 * point above 6.5 (−0.5% below), +0.5% per goal contribution, plus a flat
 * trickle (20 + rep×3) so even unknowns slowly grow.
 */
export function organicFollowerGrowth(hero: Pick<Hero, 'perks' | 'reputation'>, life: Life, ctx: Pick<SocialContext, 'avgRating' | 'goalContributions'> = {}): number {
  const f = Math.max(0, life.followers)
  const ceiling = followerCeiling(hero.reputation)
  // Above the fame ceiling the excess fades fast (8 %/week): match, post and card gains are proportional,
  // and a 1 % fade let a famous career snowball to tens of billions of followers (playtest Tur 3).
  if (f > ceiling) return -Math.round((f - ceiling) * OVER_CEILING_FADE + 1)
  let rate = 0.015
  if (ctx.avgRating !== undefined) {
    const d = ctx.avgRating - 6.5
    rate += d >= 0 ? d * 0.01 : d * 0.005
  }
  rate += (ctx.goalContributions ?? 0) * 0.005
  rate = clamp(rate, 0, 0.08)
  const gain = (f * rate + 20 + hero.reputation * 3) * (1 - f / ceiling) * followerMultiplier(hero, life)
  return Math.max(0, Math.round(gain))
}

/**
 * Weekly social tick: organic growth plus hate-comment stress. Hate comments
 * hit only visible accounts (≥10K) and are likelier when fans are cold or the
 * hero played badly: 10% base, +20% if fans < −20, +20% if rating < 5.5.
 */
export function weeklySocialTick(rng: Rng, hero: Hero, life: Life, ctx: SocialContext): Lines {
  const lines: Lines = []
  const g = organicFollowerGrowth(hero, life, ctx)
  life.followers = Math.max(0, life.followers + g)
  if (g >= 1000) lines.push(fill(lt('📈 Bu hafta {n} yeni takipçi kazandın.', '📈 You gained {n} new followers this week.'), { n: fmtNum(g) }))
  else if (g < 0) lines.push(fill(lt('📉 {n} takipçi kaybettin.', '📉 You lost {n} followers.'), { n: fmtNum(-g) }))
  if (life.followers >= 10000) {
    let p = 0.1
    if ((life.relationships.fans?.value ?? 0) < -20) p += 0.2
    if (ctx.avgRating !== undefined && ctx.avgRating < 5.5) p += 0.2
    if (rng.chance(p)) {
      addStress(life, hero, rng.int(3, 6))
      lines.push(lt('💬 Sosyal medyada nefret yorumları seni üzdü.', '💬 Hate comments on social media got to you.'))
    }
  }
  return lines
}

export interface PostResult {
  lines: Lines
  followersGained: number
  viral: boolean
  controversy: boolean
  triggerTags: string[]
}

/** Spam penalty: each extra post in the same week is worth 60% of the previous. */
export const SPAM_DECAY = 0.6

/**
 * Publish a post. Applies reach (with headroom, spam decay, perks/assets),
 * relationship/meter effects, and rolls viral (×4–12 reach, +1 reputation,
 * positive headline) and controversy (stress, press/fans hit, discipline,
 * negative headline, `controversy` tag for the event system).
 * Luxury controversy chance rises when fans are cold (+5% per 10 below 0).
 */
export function makePost(rng: Rng, hero: Hero, life: Life, type: PostType, ctx: Pick<SocialContext, 'calendar'>): PostResult {
  const def = POST_TYPES[type]
  const wk = absWeek(ctx.calendar)
  const lines: Lines = []
  const tags = [...def.tags]
  if (life.flags.posts_week !== wk) {
    life.flags.posts_week = wk
    life.flags.posts_count = 0
  }
  const count = typeof life.flags.posts_count === 'number' ? life.flags.posts_count : 0
  life.flags.posts_count = count + 1
  const spam = Math.pow(SPAM_DECAY, count)

  const ceiling = followerCeiling(hero.reputation)
  let gain = (life.followers * def.pct + 5 + hero.reputation * 2) * headroom(life.followers, ceiling) * spam * followerMultiplier(hero, life)

  const viral = rng.chance(def.viral * (1 + hero.reputation / 100) * spam)
  if (viral) {
    gain *= rng.range(4, 12)
    hero.reputation = meter(hero.reputation + 1)
    tags.push('viral')
    lines.push(fill(lt('🔥 {p} viral oldu!', '🔥 Your {p} went viral!'), { p: def.name }))
    pushNews(life, rng, ctx.calendar, fill(lt('{n} sosyal medyayı salladı', '{n} breaks the internet'), { n: hero.nickname }), 1, rng.pick(NEWS_SOURCES))
  }
  let contP = def.controversy
  const fans = life.relationships.fans?.value ?? 0
  if (type === 'luxury' && fans < 0) contP += (-fans / 10) * 0.05
  const controversy = rng.chance(clamp(contP, 0, 0.9))

  gain = Math.round(gain)
  life.followers += gain
  addHappiness(life, def.happiness)
  if (def.stress) addStress(life, hero, def.stress)
  life.discipline = meter(life.discipline + def.discipline)
  if (def.fans) changeRelation(life, 'fans', def.fans, { hero, cause: 'social', why: def.name, week: wk })
  if (def.press) changeRelation(life, 'press', def.press, { hero, cause: 'social', why: def.name, week: wk })

  if (controversy) {
    tags.push('controversy')
    addStress(life, hero, 8)
    changeRelation(life, 'press', -6, { memory: lt('Tartışmalı paylaşımı', 'Controversial post'), hero, cause: 'social', week: wk })
    changeRelation(life, 'fans', -4, { hero, cause: 'social', why: lt('Tartışmalı paylaşımın', 'Your controversial post'), week: wk })
    life.discipline = meter(life.discipline - (type === 'provocation' ? 4 : 1))
    hero.reputation = meter(hero.reputation - 1)
    lines.push(lt('⚠️ Paylaşımın tepki çekti, basın üstüne geliyor.', '⚠️ Your post backfired; the press is all over it.'))
    pushNews(life, rng, ctx.calendar, fill(lt('{n} paylaşımıyla ortalığı karıştırdı', '{n} sparks outrage with social media post'), { n: hero.nickname }), -1, rng.pick(NEWS_SOURCES))
    // Butterfly: a provocation that blows up reaches the sponsors' morality clauses (a gaffe, severity 1).
    if (type === 'provocation' && life.sponsors.length > 0) lines.push(...checkMoralityClause(rng, life, hero, 1, ctx.calendar).lines)
  }
  lines.unshift(fill(lt('{i} {p}: +{n} takipçi', '{i} {p}: +{n} followers'), { i: def.icon, p: def.name, n: fmtNum(gain) }))
  return { lines, followersGained: gain, viral, controversy, triggerTags: tags }
}
