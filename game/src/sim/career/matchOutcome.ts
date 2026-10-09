/**
 * Post-match application (GDD 3.6 → career/life): turns the hero's match line
 * into form, morale, sharpness, fatigue, reputation, followers, relationships,
 * contract bonuses, stats, XP, log lines and newspaper headlines.
 */
import type { AttributeKey, GameState, Hero, LText, NewsItem } from '../../core/types'
import { Rng } from '../../core/rng'
import {
  NEWS_SOURCES, absWeek, clamp, fill, fmtMoney, fmtNum, heroAge, lt, meter, pushLog, pushNews, signed, type Lines,
} from './common'
import { POSITION_WEIGHTS, applyXpBundle } from './progression'
import { perkValue } from './perks'
import { addFatigue, applyInjury, rollInjury } from './condition'
import { pushRecentRating, updateTrustFromMatch } from './squadRole'
import { applyMatchRelations } from '../life/relationships'
import { assetEffectTotal } from '../life/assetEffects'
import { followerCeiling } from '../life/social'
import { yellowAccumulationBan } from '../match/referee'
import { NO_BONUSES, matchBonuses, type MatchBonuses } from './matchPay'

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
  /** Matches banned for the red card (1..3, WP-14). Missing = 1. */
  ban?: number
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
  /** Per-match contract bonuses, itemised (WP-16 earnings step). */
  bonuses: MatchBonuses
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
export const MATCH_REP_SCALE = 0.8

/**
 * Breakthrough spotlight (balance pass, Oct 2026): a teenager who performs gets far more
 * headlines than a settled pro doing the same. Positive match fame × 1.8 at 18 and younger,
 * tapering to × 1 at 22 (BALANCE.md: reputation 18 / 21 / 25 had slipped to ~11 / 44 / 74).
 */
export const YOUTH_SPOTLIGHT = 0.8
export const youthSpotlight = (age: number): number => 1 + clamp((22 - age) / 4, 0, 1) * YOUTH_SPOTLIGHT

/**
 * Back-line fame (role balance, docs/BALANCE.md): a defender's headlines are the clean sheet
 * and the tackles, not goals and assists. Without this, match fame (goals × 0.45, assists × 0.25)
 * put attacking full-backs / ball-playing centre-backs 5–9 % above the defensive roles of their
 * position at career end. Centre-backs and full-backs only; a clean sheet counts after 60 minutes.
 */
export const BACK_LINE_TACKLE_FAME = 0.05
export const BACK_LINE_CLEAN_SHEET_FAME = 0.3
export const backLineFame = (position: Hero['position'], tackles: number, cleanSheet: boolean, minutes: number): number =>
  position === 'CB' || position === 'LB' || position === 'RB'
    ? Math.max(0, tackles) * BACK_LINE_TACKLE_FAME + (cleanSheet && minutes >= 60 ? BACK_LINE_CLEAN_SHEET_FAME : 0)
    : 0

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

/** Extra leadership XP per 90 minutes played as captain (butterfly link: armband → leadership). */
export const CAPTAIN_LEADERSHIP_XP = 0.8

/**
 * XP per successful in-match action (2.3#15, plan range 0.2–1.0). Example from
 * the plan: 3 key passes (assists) → Vision +1.5.
 */
export const ACTION_XP: Readonly<Record<'goals' | 'assists' | 'shotsOnTarget' | 'passesCompleted' | 'tackles' | 'dribbles' | 'saves', Partial<Record<AttributeKey, number>>>> = {
  goals: { finishing: 1.0, composure: 0.3 },
  assists: { vision: 0.5, passing: 0.5 },
  shotsOnTarget: { shooting: 0.4 },
  passesCompleted: { passing: 0.03, longPassing: 0.01 },
  tackles: { tackling: 0.4, anticipation: 0.15, aggression: 0.1 },
  dribbles: { dribbling: 0.5, agility: 0.1, acceleration: 0.1 },
  saves: { reflexes: 0.4, diving: 0.2, handling: 0.2, gkPositioning: 0.15 },
}
/** Action XP may take at most this share of the match XP budget. */
export const ACTION_XP_MAX_SHARE = 0.45

/** Action XP bundle for a match line, scaled to fit `ACTION_XP_MAX_SHARE` of `budget`. */
export function matchActionXp(m: Pick<HeroMatchInput, 'goals' | 'assists' | 'shotsOnTarget' | 'passesCompleted' | 'tackles' | 'dribbles' | 'saves'>, budget: number): { bundle: Partial<Record<AttributeKey, number>>; total: number } {
  const raw: Partial<Record<AttributeKey, number>> = {}
  let total = 0
  for (const key of Object.keys(ACTION_XP) as (keyof typeof ACTION_XP)[]) {
    const n = Math.max(0, m[key] ?? 0)
    if (!n) continue
    for (const [attr, xp] of Object.entries(ACTION_XP[key])) {
      const v = n * (xp ?? 0)
      raw[attr as AttributeKey] = (raw[attr as AttributeKey] ?? 0) + v
      total += v
    }
  }
  const cap = Math.max(0, budget) * ACTION_XP_MAX_SHARE
  const scale = total > cap && total > 0 ? cap / total : 1
  const bundle: Partial<Record<AttributeKey, number>> = {}
  for (const k in raw) bundle[k as AttributeKey] = (raw[k as AttributeKey] ?? 0) * scale
  return { bundle, total: total * scale }
}

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
    return { lines: [lt('Maçta forma şansı bulamadın.', 'You did not get on the pitch.')], headlines, bonusPaid: 0, bonuses: NO_BONUSES, reputationDelta: 0, followersDelta: 0 }
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
  let repD = ((rating - NEUTRAL_RATING) * 0.4 + goals * 0.45 + assists * 0.25 + (m.motm ? 0.5 : 0) + backLineFame(hero.position, m.tackles ?? 0, !!m.cleanSheet, minutes)) * stage * MATCH_REP_SCALE
  // Fame gets harder to add the more you have: ×0.75 at 20, ×0.4 at 50, ×0.1 at 85.
  repD = repD > 0 ? repD * Math.pow(Math.max(0, 1 - hero.reputation / 100), 1.3) * youthSpotlight(heroAge(hero, cal.season)) : repD * 0.5
  const repBefore = hero.reputation
  hero.reputation = clamp(Math.round((hero.reputation + repD) * 100) / 100, 0, 100)
  const reputationDelta = hero.reputation - repBefore

  // ── Followers: % growth on good games + flat discovery for goals ──
  const pct = Math.max(0, (rating - 6) * 0.004 + goals * 0.006 + (m.motm ? 0.01 : 0)) * (0.5 + imp) + 0.001
  const flat = goals * 40 * (1 + hero.reputation / 20) + (m.motm ? 100 : 0)
  // The proportional part needs headroom under the fame ceiling (no billions of followers for a 72-rated striker).
  const room = clamp(1 - life.followers / followerCeiling(hero.reputation), 0.05, 1)
  let followersDelta = Math.round((life.followers * pct * room + flat) * (1 + perkValue(hero, 'followers_gain') + assetEffectTotal(life, 'followers')))
  if (m.red || rating < 4.5) followersDelta = -Math.round(life.followers * 0.002) // unfollows after a shocker
  life.followers = Math.max(0, life.followers + followersDelta)

  // ── Relationships ──
  // Fans, manager, assist partners, dressing room — with fair loss blame and a ledger (life/relationships).
  applyMatchRelations(life, hero, { rating, goals, assists, won: m.won, drew: m.drew, red: m.red, motm: m.motm, assistedBy: m.assistedBy, assistedTo: m.assistedTo }, week)
  const trustD = updateTrustFromMatch(hero, rating, minutes, goals, assists, m.won)
  if (minutes > 0) pushRecentRating(life, rating) // form-guarantee clause (squadRole)
  if (Math.abs(trustD) >= 1) lines.push(fill(lt('Teknik direktör güveni {d}', 'Manager trust {d}'), { d: signed(trustD) }))

  // ── Discipline: cards ──
  if (m.red) {
    const ban = Math.max(1, Math.min(3, Math.round(m.ban ?? 1)))
    hero.suspendedMatches += ban
    life.discipline = meter(life.discipline - 4 - ban * 2)
    lines.push(ban === 1
      ? lt('🟥 Kırmızı kart: bir sonraki maçta cezalısın.', '🟥 Red card: suspended for the next match.')
      : fill(lt('🟥 Kırmızı kart: {n} maç ceza aldın.', '🟥 Red card: banned for {n} matches.'), { n: ban }))
  } else if ((m.yellow ?? 0) > 0 && yellowAccumulationBan(hero.seasonStats.yellow)) {
    // Accumulation ban every 5 yellows.
    hero.suspendedMatches += 1
    lines.push(lt('🟨 5. sarı kart: bir maç cezalısın.', '🟨 Fifth yellow card: one-match ban.'))
  }

  // ── Contract bonuses ──
  const bonuses = matchBonuses(hero.contract, { goals, assists, minutes, cleanSheet: !!m.cleanSheet, isKeeper: hero.position === 'GK', saves: m.saves ?? 0 })
  let bonusPaid = bonuses.goal + bonuses.assist + bonuses.appearance
  if (bonusPaid > 0) {
    life.money += bonusPaid
    lines.push(fill(lt('💰 Gol/asist primi: {m}', '💰 Goal/assist bonus: {m}'), { m: fmtMoney(bonusPaid) }))
  }
  // Goalkeeper clean-sheet bonus (2.5#4): keepers earn the goal bonus (min 10% of the weekly wage) per shutout.
  if (bonuses.cleanSheet > 0) {
    const keeperBonus = bonuses.cleanSheet
    life.money += keeperBonus
    bonusPaid += keeperBonus
    lines.push(fill(lt('🧤 Kaleci primi (gol yemedin): {m}', '🧤 Clean-sheet bonus: {m}'), { m: fmtMoney(keeperBonus) }))
  }
  if (bonuses.save > 0) {
    life.money += bonuses.save
    bonusPaid += bonuses.save
    lines.push(fill(lt('🧤 Kurtarış primi: {m}', '🧤 Save bonus: {m}'), { m: fmtMoney(bonuses.save) }))
  }

  // ── Experience XP ──
  const w = POSITION_WEIGHTS[hero.position]
  const wsum = Object.values(w).reduce((a, b) => a + (b ?? 0), 0)
  const totalXp = MATCH_XP_PER_90 * (minutes / 90) * (0.6 + rating / 10) * (1 + imp * 0.3)
  // In-match actions are training too (2.3#15): each success sends a small XP to its own
  // attribute, carved out of the same budget (the total match XP is unchanged).
  const action = matchActionXp(m, totalXp)
  const lump = totalXp - action.total
  const bundle: Partial<Record<AttributeKey, number>> = {}
  for (const k in w) bundle[k as AttributeKey] = (lump * (w[k as AttributeKey] ?? 0)) / wsum
  for (const k in action.bundle) bundle[k as AttributeKey] = (bundle[k as AttributeKey] ?? 0) + (action.bundle[k as AttributeKey] ?? 0)
  // Butterfly: the armband is a school of its own: a captain's match grows leadership (and some composure).
  if (hero.contract?.role === 'captain') {
    bundle.leadership = (bundle.leadership ?? 0) + CAPTAIN_LEADERSHIP_XP * (minutes / 90)
    bundle.composure = (bundle.composure ?? 0) + CAPTAIN_LEADERSHIP_XP * 0.25 * (minutes / 90)
  }
  lines.push(...applyXpBundle(hero, bundle, cal.season).lines.filter((l) => l.en.startsWith('Overall') || l.en.startsWith('🌟')))

  // ── Injury ──
  if (m.injured) lines.push(...applyInjury(hero, life, rollInjury(rng, hero, life, [0.4, 0.42, 0.18])))

  if (followersDelta !== 0) lines.push(fill(lt('Takipçi {d} ({t})', 'Followers {d} ({t})'), { d: followersDelta > 0 ? `+${fmtNum(followersDelta).tr}` : `-${fmtNum(-followersDelta).tr}`, t: fmtNum(life.followers) }))

  // ── Headlines ──
  const h = pickHeadline(rng, hero, m, rating, goals, assists, life.news.slice(-12).map((n) => n.headline.tr))
  if (h) {
    headlines.push(pushNews(life, rng, cal, h.text, h.sentiment, rng.pick(NEWS_SOURCES)))
  }
  for (const l of lines) pushLog(life, cal, l, 'match', '⚽')
  if (!rngIn) state.rng = rng.state
  return { lines, headlines, bonusPaid, bonuses, reputationDelta, followersDelta }
}

interface Headline { text: LText; sentiment: -1 | 0 | 1 }

/** Positions with a clean-sheet headline (keepers, centre-backs; holding midfielders and full-backs). */
const CLEAN_SHEET_POS: ReadonlySet<string> = new Set(['GK', 'CB', 'DM', 'LB', 'RB'])

/**
 * Situational headline templates (≥10 situations, several variants each).
 * Only "newsworthy" games produce a headline: goals ≥ 2, rating ≥ 8 or ≤ 4.5,
 * a red card, a big-game winner, or a missed penalty.
 */
function pickHeadline(rng: Rng, hero: Hero, m: HeroMatchInput, rating: number, goals: number, assists: number, recent: readonly string[] = []): Headline | null {
  const vars = { name: heroName(hero), his: hero.gender === 'female' ? 'her' : 'his', opp: m.opponentName ?? lt('rakip', 'the opposition'), g: goals, a: assists }
  // Variety: skip templates printed in the last few headlines (fall back to all when every one was used).
  const T = (variants: LText[], sentiment: Headline['sentiment']): Headline => {
    const filled = variants.map((v) => fill(v, vars))
    const fresh = filled.filter((f) => !recent.includes(f.tr))
    return { text: rng.pick(fresh.length ? fresh : filled), sentiment }
  }
  if (m.red) {
    return T([
      lt('{name} kırmızı kartla takımını yaktı!', '{name} sees red and lets {his} team down!'),
      lt('Kontrolsüz {name}: erken duş!', 'Hot-headed {name} sent for an early bath!'),
      lt('{opp} maçında sinirler koptu: {name} oyundan atıldı', 'Tempers snap against {opp}: {name} sent off'),
      lt('Hakem affetmedi: {name} kırmızıyı gördü', 'No mercy from the referee: red for {name}'),
    ], -1)
  }
  if (goals >= 3) {
    return T([
      lt('{name} hat-trick yaptı! {opp} darmadağın', '{name} hat-trick demolishes {opp}!'),
      lt('Topu eve götürdü: {name} {g} golle şov yaptı', '{name} takes the match ball home after {g}-goal show'),
      lt('{name} durdurulamıyor: {g} gol!', 'Unstoppable {name} bags {g}!'),
      lt('{opp} savunması {name} karşısında çaresiz: {g} gol', '{opp} defence helpless as {name} scores {g}'),
      lt('Gecenin tek konusu {name}: {g} gol, bir maç topu', 'All about {name}: {g} goals and a match ball'),
    ], 1)
  }
  if (m.ownGoal) {
    return T([
      lt('{name} kendi kalesine attı, gece kabusa döndü', '{name} own goal turns the night into a nightmare'),
      lt('Talihsiz an: {name} topu kendi ağlarına gönderdi', 'Cruel moment as {name} turns the ball into {his} own net'),
    ], -1)
  }
  if (m.missedPenalty && !m.won) {
    return T([
      lt('{name} penaltıyı kaçırdı, taraftar hayal kırıklığında', '{name} penalty miss leaves fans deflated'),
      lt('Beyaz noktada büyük şok: {name}', 'Spot-kick agony for {name}'),
      lt('{opp} maçının kırılma anı: {name} penaltıdan atamadı', 'The turning point against {opp}: {name} misses from the spot'),
    ], -1)
  }
  if (goals >= 2) {
    return T([
      lt('{name} iki golle {opp} karşısında parladı', '{name} brace sinks {opp}'),
      lt('Çifte darbe: {name} yine sahnede', 'Double trouble: {name} strikes twice'),
      lt('{opp} ağlarını iki kez sarstı: {name}', '{name} rattles the {opp} net twice'),
      lt('İki gol, tek isim: {name}', 'Two goals, one name: {name}'),
      lt('{name} fileleri iki kez havalandırdı', '{name} finds the net twice'),
      lt('İki vuruş, iki gol: {name}', 'Two strikes, two goals: {name}'),
      lt('Bir değil iki: {name} durmuyor', 'Not one but two: {name} keeps going'),
      lt('{name} skor tabelasına iki kez adını yazdırdı', '{name} on the scoresheet twice'),
    ], 1)
  }
  if (goals >= 1 && m.won && m.importance >= 0.7) {
    return T([
      lt('Büyük maçın yıldızı: {name} galibiyeti getirdi', 'Big-game player {name} delivers the win'),
      lt('{name} kritik maçta sahneye çıktı', '{name} steps up when it matters most'),
      lt('Kilidi {name} açtı, {opp} yıkıldı', '{name} unlocks {opp} in the big one'),
      lt('Baskı altında soğukkanlı: {name} farkı yarattı', 'Ice-cool {name} makes the difference under pressure'),
    ], 1)
  }
  if (assists >= 2) {
    return T([
      lt('Asist kralı {name}: {a} gol pası', 'Provider-in-chief {name} lays on {a}'),
      lt('{name} oyunu kurdu, arkadaşları bitirdi', '{name} pulls the strings as teammates feast'),
      lt('{opp} karşısında orkestra şefi {name}', '{name} conducts the orchestra against {opp}'),
      lt('Gollerin mimarı {name}: {a} asist', 'Architect {name}: {a} assists'),
    ], 1)
  }
  // Defensive clean sheets (playtest Tur 4: four CB variants printed ×20 in a career; DM and full-back clean
  // sheets fell through to the generic "dazzling display" line).
  if (m.cleanSheet && CLEAN_SHEET_POS.has(hero.position) && rating >= 7.5) {
    if (hero.position !== 'GK' && hero.position !== 'CB') {
      return T([
        lt('{name} önde kesti, arkada kapattı: {opp} gol bulamadı', '{name} broke it up and shut the door: no goal for {opp}'),
        lt('Sessiz kahraman {name}: sıfır gol, sayısız top kapma', 'Quiet hero {name}: a clean sheet and countless tackles'),
        lt('{opp} hücumu {name} filtresinden geçemedi', '{opp} could not get through the {name} filter'),
        lt('Gol yememenin arkasındaki isim: {name}', 'The name behind the clean sheet: {name}'),
        lt('{name} kanadı kilitledi, {opp} çaresiz', '{name} locks the flank, {opp} helpless'),
        lt('Kirli işleri {name} yaptı, kale gole kapandı', '{name} did the dirty work, the goal stayed shut'),
        lt('{opp} atakları {name} önünde söndü', '{opp} attacks fizzled out in front of {name}'),
        lt('Her ikili mücadelede {name}: sıfır gol', '{name} in every duel: a clean sheet'),
        lt('{name} görünmez duvar gibiydi', '{name} was an invisible wall'),
      ], 1)
    }
    return T(hero.position === 'GK'
      ? [
        lt('{name} geçit vermedi: kalesini gole kapattı', '{name} stands firm as clean sheet secured'),
        lt('Duvar gibi {name}: {opp} çaresiz kaldı', 'Brick wall {name} frustrates {opp}'),
        lt('{opp} forvetleri {name} engeline takıldı', '{opp} forwards hit the {name} wall'),
        lt('Kale kapısında kilit: {name}', 'Lock on the goal: {name}'),
        lt('{name} kurtarışlarıyla sıfırı korudu', '{name} saves keep the clean sheet'),
        lt('Gol yok, geçit yok: {name} yine iş başında', 'No goals, no way through: {name} at it again'),
        lt('{opp} şut çekti, {name} hepsine cevap verdi', '{opp} kept shooting, {name} had an answer for all of it'),
        lt('Eldivenler konuştu: {name} gol vermedi', 'The gloves did the talking: {name} keeps a clean sheet'),
      ]
      : [
        lt('{name} geçit vermedi: savunma kale gibi', '{name} stands firm at the back'),
        lt('Duvar gibi {name}: {opp} çaresiz kaldı', 'Brick wall {name} frustrates {opp}'),
        lt('{opp} hücumu {name} barajını aşamadı', '{opp} attack cannot get past {name}'),
        lt('Savunmanın patronu {name}: gol yok', 'Defensive boss {name}: nothing gets through'),
        lt('{opp} forvetleri {name} ile geçen 90 dakikayı unutmak isteyecek', '{opp} forwards will want to forget 90 minutes against {name}'),
        lt('Hava topları da yerdeki toplar da {name}: kalesi gole kapalı', 'In the air and on the ground it was all {name}: no goal'),
        lt('{name} arkada duvar ördü', '{name} builds a wall at the back'),
        lt('Sıfırın mimarı {name}', 'Architect of the clean sheet: {name}'),
      ], 1)
  }
  if (rating >= 8) {
    return T([
      lt('{name} sahada döktürdü: maçın en iyisi', '{name} the star of the show'),
      lt('Göz kamaştıran performans: {name}', 'Dazzling display from {name}'),
      lt('{name} yükselişini sürdürüyor', 'The rise of {name} continues'),
      lt('{opp} maçının en parlak ismi {name}', '{name} shines brightest against {opp}'),
      lt('Reytinglerin zirvesinde {name}', '{name} tops the ratings'),
      lt('{name} imzalı bir gece', 'A night signed by {name}'),
    ], 1)
  }
  if (rating <= 4.5) {
    return T([
      lt('{name} için unutulacak bir gece', 'A night to forget for {name}'),
      lt('Eleştirilerin hedefinde {name} var', '{name} under fire after woeful display'),
      lt('{name} formdan düştü mü?', 'Has {name} lost {his} touch?'),
      lt('{opp} karşısında silik {name}', 'Anonymous {name} against {opp}'),
    ], -1)
  }
  if (goals >= 1 && !m.won && !m.drew) {
    return T([
      lt('{name} attı ama yetmedi', '{name} scores in vain'),
      lt('{name} golüne rağmen {opp} kazandı', '{opp} win despite {name} goal'),
      lt('Tek teselli {name} golü', '{name} goal the only consolation'),
      lt('{name} skoru dengelemeye yetmedi', '{name} strike not enough'),
      lt('{opp} kazandı, {name} golüyle iz bıraktı', '{opp} win, but {name} leaves a mark'),
      lt('Kayıp gecede bir parıltı: {name}', 'One bright spot on a losing night: {name}'),
    ], 0)
  }
  return null
}
