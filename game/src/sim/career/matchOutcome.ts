/**
 * Post-match application (GDD 3.6 → career/life): turns the hero's match line
 * into form, morale, sharpness, fatigue, reputation, followers, relationships,
 * contract bonuses, stats, XP, log lines and newspaper headlines.
 */
import type { AttributeKey, GameState, Hero, LText, NewsItem } from '../../core/types'
import { Rng } from '../../core/rng'
import {
  NEWS_SOURCES, absWeek, clamp, fill, fmtMoney, fmtNum, lt, meter, pushLog, pushNews, signed, type Lines,
} from './common'
import { POSITION_WEIGHTS, applyXpBundle } from './progression'
import { perkValue } from './perks'
import { addFatigue, applyInjury, rollInjury } from './condition'
import { pushRecentRating, updateTrustFromMatch } from './squadRole'
import { applyMatchRelations } from '../life/relationships'
import { assetEffectTotal } from '../life/assetEffects'

/** The hero's line from a finished match (produced by the match engine / UI). */
export interface HeroMatchInput {
  /** 0..10 match rating. */
  rating: number
  goals: number
  assists: number
  minutes: number
  started: boolean
  won: boolean
  drew: boolean
  /** 0..1: friendly 0, league 0.3–0.5, derby/title decider 0.8, final 1. */
  importance: number
  shots?: number
  shotsOnTarget?: number
  passes?: number
  passesCompleted?: number
  tackles?: number
  dribbles?: number
  saves?: number
  cleanSheet?: boolean
  yellow?: number
  red?: boolean
  motm?: boolean
  /** The engine flagged an in-match injury to the hero. */
  injured?: boolean
  isAway?: boolean
  /** Opponent display name for headlines. */
  opponentName?: string
  /** Opponent reputation 1..100 (big games against big clubs count more). */
  opponentReputation?: number
  /** Teammate NPC ids who assisted the hero's goals. */
  assistedBy?: string[]
  /** Teammate NPC ids the hero assisted. */
  assistedTo?: string[]
  /** Penalty missed / own goal — for headlines & morale. */
  missedPenalty?: boolean
  ownGoal?: boolean
}

export interface MatchApplyResult {
  lines: Lines
  headlines: NewsItem[]
  bonusPaid: number
  reputationDelta: number
  followersDelta: number
}

/** Average rating used as the neutral point for most deltas. */
export const NEUTRAL_RATING = 6.5
/**
 * Match reputation scale (balance pass, docs/BALANCE.md): fame used to hit
 * 90+ by 19 and 100 by 20 for nearly every career. Now a regular starter at a
 * small club gains ~5–8 a season, a star in a top league ~8–12 until fame saturates.
 */
export const MATCH_REP_SCALE = 1.0

/** Form = EMA of a rating-derived target: ~last 5 matches matter (α = 0.35). */
export const FORM_ALPHA = 0.35
/** Rating → form target: 4.0 → 0, 6.5 → 50, 9.0 → 100. */
export const formTarget = (rating: number): number => clamp(50 + (rating - NEUTRAL_RATING) * 20, 0, 100)

/**
 * Match XP: "experience" pours ~16 XP × (0.6 + rating/10) per 90 minutes into
 * the position's weighted attributes (a 7.0 game ≈ 21 XP ≈ two-thirds of a
 * training session). Playing time is therefore a real development lever —
 * the classic reason to go on loan.
 */
export const MATCH_XP_PER_90 = 16

/** Fatigue per 90 minutes before stamina; stamina 80 → ×0.88, stamina 40 → ×1.04. */
export const FATIGUE_PER_90 = 30
/** Extra fatigue from an away trip (reduced by private-jet `travel_fatigue`). */
export const AWAY_TRAVEL_FATIGUE = 6

const heroName = (h: Hero): string => (h.nickname && h.nickname !== h.lastName ? h.nickname : `${h.firstName} ${h.lastName}`)

/**
 * Apply a finished match to the hero. Mutates `state.hero`, `state.life` and
 * (if no Rng is passed) advances `state.rng`.
 */
export function applyMatchToHero(state: GameState, m: HeroMatchInput, rngIn?: Rng): MatchApplyResult {
  const rng = rngIn ?? new Rng(state.rng)
  const { hero, life, calendar: cal } = state
  const week = absWeek(cal)
  const lines: Lines = []
  const headlines: NewsItem[] = []
  const rating = clamp(Number.isFinite(m.rating) ? m.rating : NEUTRAL_RATING, 0, 10)
  const minutes = clamp(Math.round(m.minutes), 0, 130)
  const played = minutes > 0
  const imp = clamp(m.importance, 0, 1)
  const goals = Math.max(0, m.goals | 0)
  const assists = Math.max(0, m.assists | 0)

  // ── Stats ──
  for (const s of [hero.seasonStats, hero.careerStats]) {
    if (played) { s.apps++; s.minutes += minutes; s.ratingSum += rating }
    if (m.started) s.starts++
    s.goals += goals
    s.assists += assists
    s.shots += m.shots ?? 0
    s.shotsOnTarget += m.shotsOnTarget ?? 0
    s.passes += m.passes ?? 0
    s.passesCompleted += m.passesCompleted ?? 0
    s.tackles += m.tackles ?? 0
    s.dribbles += m.dribbles ?? 0
    s.saves += m.saves ?? 0
    s.yellow += m.yellow ?? 0
    if (m.red) s.red++
    if (m.cleanSheet && played) s.cleanSheets++
    if (m.motm) s.motm++
  }
  if (!played) {
    // Unused sub: only morale & form drift.
    hero.morale = meter(hero.morale + (m.won ? 1 : m.drew ? 0 : -2))
    return { lines: [lt('Maçta forma şansı bulamadın.', 'You did not get on the pitch.')], headlines, bonusPaid: 0, reputationDelta: 0, followersDelta: 0 }
  }
  const resultWord = m.won ? lt('Galibiyet', 'Win') : m.drew ? lt('Beraberlik', 'Draw') : lt('Mağlubiyet', 'Defeat')
  lines.push(fill(lt('{r} · Puanın {x} · {g} gol, {a} asist', '{r} · Rating {x} · {g} goals, {a} assists'), {
    r: resultWord, x: rating.toFixed(1), g: goals, a: assists,
  }))

  // ── Form, morale, sharpness, fatigue ──
  hero.form = meter(hero.form * (1 - FORM_ALPHA) + formTarget(rating) * FORM_ALPHA)
  const result = m.won ? 4 : m.drew ? 0 : -4
  const moraleD = (result + (rating - NEUTRAL_RATING) * 2 + goals * 2 + (m.motm ? 3 : 0) - (m.missedPenalty ? 3 : 0) - (m.red ? 5 : 0)) * (0.75 + imp * 0.5)
  hero.morale = meter(hero.morale + moraleD)
  hero.sharpness = meter(hero.sharpness + (minutes / 90) * 12)
  const staminaMult = 1.2 - hero.attrs.stamina / 250
  addFatigue(hero, (minutes / 90) * FATIGUE_PER_90 * staminaMult)
  if (m.isAway) addFatigue(hero, AWAY_TRAVEL_FATIGUE * (1 - assetEffectTotal(life, 'travel_fatigue')))

  // ── Reputation (diminishing at the top, bigger on big stages) ──
  const stage = 0.5 + imp + clamp(((m.opponentReputation ?? 50) - 50) / 100, -0.3, 0.4)
  let repD = ((rating - NEUTRAL_RATING) * 0.4 + goals * 0.3 + assists * 0.2 + (m.motm ? 0.5 : 0)) * stage * MATCH_REP_SCALE
  // Fame gets harder to add the more you have: ×0.75 at 20, ×0.4 at 50, ×0.1 at 85.
  repD = repD > 0 ? repD * Math.pow(Math.max(0, 1 - hero.reputation / 100), 1.3) : repD * 0.5
  const repBefore = hero.reputation
  hero.reputation = clamp(Math.round((hero.reputation + repD) * 100) / 100, 0, 100)
  const reputationDelta = hero.reputation - repBefore

  // ── Followers: % growth on good games + flat discovery for goals ──
  const pct = Math.max(0, (rating - 6) * 0.004 + goals * 0.006 + (m.motm ? 0.01 : 0)) * (0.5 + imp) + 0.001
  const flat = goals * 40 * (1 + hero.reputation / 20) + (m.motm ? 100 : 0)
  let followersDelta = Math.round((life.followers * pct + flat) * (1 + perkValue(hero, 'followers_gain') + assetEffectTotal(life, 'followers')))
  if (m.red || rating < 4.5) followersDelta = -Math.round(life.followers * 0.002) // unfollows after a shocker
  life.followers = Math.max(0, life.followers + followersDelta)

  // ── Relationships ──
  // Fans, manager, assist partners, dressing room — with fair loss blame and a ledger (life/relationships).
  applyMatchRelations(life, hero, { rating, goals, assists, won: m.won, drew: m.drew, red: m.red, motm: m.motm, assistedBy: m.assistedBy, assistedTo: m.assistedTo }, week)
  const trustD = updateTrustFromMatch(hero, rating, minutes)
  if (minutes > 0) pushRecentRating(life, rating) // form-guarantee clause (squadRole)
  if (Math.abs(trustD) >= 1) lines.push(fill(lt('Teknik direktör güveni {d}', 'Manager trust {d}'), { d: signed(trustD) }))

  // ── Discipline: cards ──
  if (m.red) {
    hero.suspendedMatches += 1
    life.discipline = meter(life.discipline - 6)
    lines.push(lt('🟥 Kırmızı kart: bir sonraki maçta cezalısın.', '🟥 Red card: suspended for the next match.'))
  } else if ((m.yellow ?? 0) > 0 && hero.seasonStats.yellow > 0 && hero.seasonStats.yellow % 5 === 0) {
    // Accumulation ban every 5 yellows.
    hero.suspendedMatches += 1
    lines.push(lt('🟨 5. sarı kart: bir maç cezalısın.', '🟨 Fifth yellow card: one-match ban.'))
  }

  // ── Contract bonuses ──
  let bonusPaid = 0
  if (hero.contract) bonusPaid = goals * hero.contract.goalBonus + assists * hero.contract.assistBonus
  if (bonusPaid > 0) {
    life.money += bonusPaid
    lines.push(fill(lt('💰 Gol/asist primi: {m}', '💰 Goal/assist bonus: {m}'), { m: fmtMoney(bonusPaid) }))
  }

  // ── Experience XP ──
  const w = POSITION_WEIGHTS[hero.position]
  const wsum = Object.values(w).reduce((a, b) => a + (b ?? 0), 0)
  const totalXp = MATCH_XP_PER_90 * (minutes / 90) * (0.6 + rating / 10) * (1 + imp * 0.3)
  const bundle: Partial<Record<AttributeKey, number>> = {}
  for (const k in w) bundle[k as AttributeKey] = (totalXp * (w[k as AttributeKey] ?? 0)) / wsum
  lines.push(...applyXpBundle(hero, bundle, cal.season).lines.filter((l) => l.en.startsWith('Overall') || l.en.startsWith('🌟')))

  // ── Injury ──
  if (m.injured) lines.push(...applyInjury(hero, life, rollInjury(rng, hero, life, [0.55, 0.35, 0.1])))

  if (followersDelta !== 0) lines.push(fill(lt('Takipçi {d} ({t})', 'Followers {d} ({t})'), { d: followersDelta > 0 ? `+${fmtNum(followersDelta).tr}` : `-${fmtNum(-followersDelta).tr}`, t: fmtNum(life.followers) }))

  // ── Headlines ──
  const h = pickHeadline(rng, hero, m, rating, goals, assists)
  if (h) {
    headlines.push(pushNews(life, rng, cal, h.text, h.sentiment, rng.pick(NEWS_SOURCES)))
  }
  for (const l of lines) pushLog(life, cal, l, 'match', '⚽')
  if (!rngIn) state.rng = rng.state
  return { lines, headlines, bonusPaid, reputationDelta, followersDelta }
}

interface Headline { text: LText; sentiment: -1 | 0 | 1 }

/**
 * Situational headline templates (≥10 situations, several variants each).
 * Only "newsworthy" games produce a headline: goals ≥ 2, rating ≥ 8 or ≤ 4.5,
 * a red card, a big-game winner, or a missed penalty.
 */
function pickHeadline(rng: Rng, hero: Hero, m: HeroMatchInput, rating: number, goals: number, assists: number): Headline | null {
  const vars = { name: heroName(hero), his: hero.gender === 'female' ? 'her' : 'his', opp: m.opponentName ?? lt('rakip', 'the opposition'), g: goals, a: assists }
  const T = (variants: LText[], sentiment: Headline['sentiment']): Headline => ({ text: fill(rng.pick(variants), vars), sentiment })
  if (m.red) {
    return T([
      lt('{name} kırmızı kartla takımını yaktı!', '{name} sees red and lets {his} team down!'),
      lt('Kontrolsüz {name}: erken duş!', 'Hot-headed {name} sent for an early bath!'),
    ], -1)
  }
  if (goals >= 3) {
    return T([
      lt('{name} hat-trick yaptı! {opp} darmadağın', '{name} hat-trick demolishes {opp}!'),
      lt('Topu eve götürdü: {name} {g} golle şov yaptı', '{name} takes the match ball home after {g}-goal show'),
      lt('{name} durdurulamıyor: {g} gol!', 'Unstoppable {name} bags {g}!'),
    ], 1)
  }
  if (m.ownGoal) {
    return T([
      lt('{name} kendi kalesine attı, gece kabusa döndü', '{name} own goal turns the night into a nightmare'),
    ], -1)
  }
  if (m.missedPenalty && !m.won) {
    return T([
      lt('{name} penaltıyı kaçırdı, taraftar hayal kırıklığında', '{name} penalty miss leaves fans deflated'),
      lt('Beyaz noktada büyük şok: {name}', 'Spot-kick agony for {name}'),
    ], -1)
  }
  if (goals >= 2) {
    return T([
      lt('{name} iki golle {opp} karşısında parladı', '{name} brace sinks {opp}'),
      lt('Çifte darbe: {name} yine sahnede', 'Double trouble: {name} strikes twice'),
    ], 1)
  }
  if (goals >= 1 && m.won && m.importance >= 0.7) {
    return T([
      lt('Büyük maçın adamı: {name} galibiyeti getirdi', 'Big-game player {name} delivers the win'),
      lt('{name} kritik maçta sahneye çıktı', '{name} steps up when it matters most'),
    ], 1)
  }
  if (assists >= 2) {
    return T([
      lt('Asist kralı {name}: {a} gol pası', 'Provider-in-chief {name} lays on {a}'),
      lt('{name} oyunu kurdu, arkadaşları bitirdi', '{name} pulls the strings as teammates feast'),
    ], 1)
  }
  if (m.cleanSheet && (hero.position === 'GK' || hero.position === 'CB') && rating >= 7.5) {
    return T([
      lt('{name} geçit vermedi: kalesini gole kapattı', '{name} stands firm as clean sheet secured'),
      lt('Duvar gibi {name}: {opp} çaresiz kaldı', 'Brick wall {name} frustrates {opp}'),
    ], 1)
  }
  if (rating >= 8) {
    return T([
      lt('{name} sahada döktürdü: maçın en iyisi', '{name} the star of the show'),
      lt('Göz kamaştıran performans: {name}', 'Dazzling display from {name}'),
      lt('{name} yükselişini sürdürüyor', 'The rise of {name} continues'),
    ], 1)
  }
  if (rating <= 4.5) {
    return T([
      lt('{name} için unutulacak bir gece', 'A night to forget for {name}'),
      lt('Eleştirilerin hedefinde {name} var', '{name} under fire after woeful display'),
      lt('{name} formdan düştü mü?', 'Has {name} lost {his} touch?'),
    ], -1)
  }
  if (goals >= 1 && !m.won && !m.drew) {
    return T([lt('{name} attı ama yetmedi', '{name} scores in vain')], 0)
  }
  return null
}
