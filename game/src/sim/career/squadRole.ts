/**
 * Squad role & manager trust (GDD 2.5).
 *
 * Trust (0..100) is the manager's confidence in the hero. It moves with match
 * ratings, training effort, discipline and the personal relationship, and —
 * together with the OVR gap to the squad — decides the role ladder:
 *   youth → reserve → rotation → starter → star → captain
 * Role sets the probability of starting the next match. Being benched when
 * you think you deserve to play builds frustration; the hero may complain
 * (polite / demand / public), each with different risk profiles.
 */
import type { Calendar, Hero, Life, SquadRole } from '../../core/types'
import type { Rng } from '../../core/rng'
import { absWeek, clamp, fill, heroAge, lt, meter, type Lines } from './common'
import { heroOvr } from './progression'
import { perkValue } from './perks'
import { changeRelation } from '../life/relationships'
import { ROLE_NAMES } from './contract'

/** Role ladder, lowest first. */
export const ROLE_ORDER: readonly SquadRole[] = ['youth', 'reserve', 'rotation', 'starter', 'star', 'captain']

/** Localized role names (single source of truth lives in contract.ts). */
export { ROLE_NAMES }

export const roleIndex = (r: SquadRole): number => ROLE_ORDER.indexOf(r)

/** Relationship id of the current manager. */
export const MANAGER_REL = 'manager'

/**
 * Apply a trust change. Gains are scaled by `trust_gain` perk and shrink near
 * 100 (factor 1 − trust/150), losses land in full — trust is slow to earn and
 * quick to lose, which keeps the role ladder meaningful.
 */
export function changeTrust(hero: Hero, delta: number): number {
  if (!Number.isFinite(delta) || delta === 0) return 0
  let d = delta
  if (d > 0) d *= (1 + perkValue(hero, 'trust_gain')) * (1 - hero.managerTrust / 150)
  const before = hero.managerTrust
  hero.managerTrust = meter(hero.managerTrust + d, 40)
  return hero.managerTrust - before
}

/**
 * Trust from a match: (rating − 6.3) × 3, scaled by minutes (a 10-minute cameo
 * counts 30%). A 7.5 full game → +3.6 (before diminishing); a 5.0 → −3.9.
 * The neutral point 6.3 sits slightly below the average rating (≈6.5) so a
 * merely average player slowly gains trust by being reliable.
 */
export function updateTrustFromMatch(hero: Hero, rating: number, minutes: number, goals = 0, assists = 0, won = false): number {
  if (minutes <= 0) return 0
  return changeTrust(hero, trustRawFromMatch(rating, minutes, goals, assists, won))
}

/**
 * Fair-blame shield for a poor rating: goal contributions (+0.5 for scoring in
 * a win, i.e. possibly the winner) cover up to 100% of the negative part at 2+.
 */
export const trustBlameShield = (goals: number, assists: number, won: boolean): number =>
  clamp((Math.max(0, goals) + Math.max(0, assists) + (won && goals > 0 ? 0.5 : 0)) / 2, 0, 1)

/** Raw (pre-`changeTrust`) trust change of a match; mirrored by ui/backend/postMatch.ts. */
export function trustRawFromMatch(rating: number, minutes: number, goals = 0, assists = 0, won = false): number {
  const weight = clamp(minutes / 90, 0.3, 1.2)
  const raw = (rating - 6.3) * 3 * weight
  return raw < 0 ? raw * (1 - trustBlameShield(goals, assists, won)) : raw
}

/**
 * Trust from training effort: (performance − 0.5) × 1.2 per session. A week of
 * excellent mini-game sessions (0.9) is worth about one good match.
 */
export const updateTrustFromTraining = (hero: Hero, performance: number): number =>
  changeTrust(hero, (clamp(performance, 0, 1) - 0.5) * 1.2)

/**
 * Discipline incident (late to training, red card, nightclub photos…).
 * `severity` 1..5. Costs trust 3×severity, club discipline 4×severity and
 * manager relation 2×severity.
 */
export function disciplineIncident(hero: Hero, life: Life, severity: number, cal: Calendar): Lines {
  const s = clamp(severity, 1, 5)
  changeTrust(hero, -3 * s)
  life.discipline = meter(life.discipline - 4 * s)
  changeRelation(life, MANAGER_REL, -2 * s, {
    memory: lt('Disiplinsizliğine tepkili.', 'Unhappy with your lack of discipline.'),
    week: absWeek(cal),
  })
  return [fill(lt('Teknik direktör disiplin sorununu not etti (güven -{t}).', 'The manager noted your discipline issue (trust -{t}).'), { t: 3 * s })]
}

/**
 * Weekly trust drift: 8% of the gap toward a "background" level determined by
 * the personal relationship and club discipline view. Prevents trust from
 * being frozen forever after one great or awful spell.
 *   background = 45 + managerRelation × 0.25 + (discipline − 60) × 0.3
 */
export function weeklyTrustTick(hero: Hero, life: Life): void {
  const rel = life.relationships[MANAGER_REL]?.value ?? 0
  const bg = clamp(45 + rel * 0.25 + (life.discipline - 60) * 0.3, 10, 85)
  hero.managerTrust = meter(hero.managerTrust + (bg - hero.managerTrust) * 0.08)
  // Discipline slowly recovers toward 70 when nothing happens.
  life.discipline = meter(life.discipline + (70 - life.discipline) * 0.05)
}

/** Squad context supplied by the world layer. */
export interface SquadContext {
  /** Average OVR of the club's regular starters. */
  squadAvgOvr: number
  /** Season (for age). */
  season: number
  /** Whether the captaincy is available to the hero (club decides, e.g. old captain left). */
  captaincyOpen?: boolean
}

/**
 * Merit score: OVR gap to the squad average plus trust bonus.
 * Thresholds below were picked so that a player ~5 OVR above the starters'
 * average with neutral trust is a starter, ~10 above is the star.
 */
export function roleScore(hero: Hero, ctx: SquadContext): number {
  return heroOvr(hero) - ctx.squadAvgOvr + (hero.managerTrust - 50) * 0.15
}

/** The role the hero's current merit deserves (no hysteresis). */
export function targetRole(hero: Hero, life: Life, ctx: SquadContext): SquadRole {
  const s = roleScore(hero, ctx)
  const age = heroAge(hero, ctx.season)
  let r: SquadRole
  if (s < -9) r = age <= 19 ? 'youth' : 'reserve'
  else if (s < -3) r = 'reserve'
  else if (s < 1.5) r = 'rotation'
  else if (s < 8) r = 'starter'
  else r = 'star'
  const captainMaterial =
    ctx.captaincyOpen === true && roleIndex(r) >= roleIndex('starter') && hero.attrs.leadership >= 65 &&
    hero.managerTrust >= 75 && age >= 23 && (life.relationships[MANAGER_REL]?.value ?? 0) >= 20
  if (captainMaterial) r = 'captain'
  return r
}

/**
 * Re-evaluate the role (call every ~4 weeks or after each match). Moves at
 * most ONE step per call (hysteresis: the manager does not drop a star after
 * one bad game). Captain is kept while merit stays ≥ starter.
 */
export function evaluateRoleChange(hero: Hero, life: Life, ctx: SquadContext, cal: Calendar): Lines {
  if (!hero.contract) return []
  const cur = hero.contract.role
  let target = targetRole(hero, life, ctx)
  if (cur === 'captain' && roleIndex(target) >= roleIndex('starter')) target = 'captain'
  const ci = roleIndex(cur)
  const ti = roleIndex(target)
  if (ti === ci) return []
  const next = ROLE_ORDER[ci + Math.sign(ti - ci)]
  hero.contract.role = next
  const week = absWeek(cal)
  if (roleIndex(next) > ci) {
    hero.morale = meter(hero.morale + 6)
    changeRelation(life, MANAGER_REL, 3, { memory: lt('Sana daha büyük rol verdi.', 'Gave you a bigger role.'), week })
    if (next === 'captain') {
      hero.morale = meter(hero.morale + 6)
      return [lt('©️ Kaptanlık pazubandı artık senin! Takımı sen yöneteceksin.', '©️ The captain’s armband is yours! You lead the team now.')]
    }
    return [fill(lt('⬆️ Yeni rolün: {r}. Teknik direktör sana güveniyor.', '⬆️ New role: {r}. The manager believes in you.'), { r: ROLE_NAMES[next] })]
  }
  hero.morale = meter(hero.morale - 8)
  life.stress = meter(life.stress + 5)
  return [fill(lt('⬇️ Rolün düştü: {r}. Formaya yeniden hak kazanmalısın.', '⬇️ Role dropped to {r}. You need to win your place back.'), { r: ROLE_NAMES[next] })]
}

/** Base start probability per role. */
export const ROLE_START_BASE: Readonly<Record<SquadRole, number>> = {
  youth: 0.03, reserve: 0.12, rotation: 0.45, starter: 0.85, star: 0.95, captain: 0.97,
}

/**
 * Probability the hero starts the next match.
 * Adjustments: form ±0.1, trust ±0.1, fatigue > 60 up to −0.3 (rotation for
 * freshness), sharpness < 40 −0.1, promised start +0.15. Injured/suspended → 0.
 */
export function startProbability(hero: Hero, life: Life): number {
  if (hero.injury || hero.suspendedMatches > 0 || !hero.contract) return 0
  let p = ROLE_START_BASE[hero.contract.role]
  p += ((hero.form - 50) / 50) * 0.1
  p += ((hero.managerTrust - 50) / 50) * 0.1
  if (hero.fatigue > 60) p -= ((hero.fatigue - 60) / 40) * 0.3
  if (hero.sharpness < 40) p -= 0.1
  if (life.flags.promised_start === true) p += 0.15
  if (formGuaranteeActive(hero, life)) p = Math.max(p, FORM_GUARANTEE_START)
  return clamp(p, 0, 0.99)
}

// ───────────────────────── Form guarantee & expected minutes (WP-8) ─────────────────────────

/** life.flags key: JSON number[] of the hero's last match ratings (most recent last, max 5). */
export const RECENT_RATINGS_FLAG = 'c:recentRatings'
/** Average rating over the last 3 matches that triggers the form guarantee. */
export const FORM_GUARANTEE_RATING = 7.5
/** Start probability while the guarantee is active. */
export const FORM_GUARANTEE_START = 0.99

/** Last match ratings (oldest first). */
export function recentRatings(life: Life): number[] {
  const raw = life.flags[RECENT_RATINGS_FLAG]
  if (typeof raw !== 'string') return []
  try {
    const v = JSON.parse(raw) as unknown
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)) : []
  } catch {
    return []
  }
}

/** Record a played match rating (called by career/matchOutcome). */
export function pushRecentRating(life: Life, rating: number): void {
  if (!(rating > 0)) return
  life.flags[RECENT_RATINGS_FLAG] = JSON.stringify([...recentRatings(life), Math.round(rating * 10) / 10].slice(-5))
}

/** Contract has the form clause and the last 3 ratings average ≥ 7.5. */
export function formGuaranteeActive(hero: Hero, life: Life): boolean {
  if (!hero.contract?.formGuarantee) return false
  const last = recentRatings(life).slice(-3)
  if (last.length < 3) return false
  return last.reduce((a, b) => a + b, 0) / 3 >= FORM_GUARANTEE_RATING
}

/** Typical minutes per match for each role (shown in contract / profile). */
export const ROLE_EXPECTED_MINUTES: Readonly<Record<SquadRole, [number, number]>> = {
  youth: [0, 10], reserve: [5, 25], rotation: [35, 60], starter: [70, 85], star: [80, 90], captain: [85, 90],
}

/** Roll selection for the next match and update bench-streak bookkeeping. */
export function rollSelection(rng: Rng, hero: Hero, life: Life): { starts: boolean; lines: Lines } {
  const starts = rng.chance(startProbability(hero, life))
  return { starts, lines: trackSelection(hero, life, starts) }
}

/** Expected roles that make a bench streak frustrating. */
const EXPECTS_TO_PLAY: ReadonlySet<SquadRole> = new Set<SquadRole>(['rotation', 'starter', 'star', 'captain'])

/**
 * Bench-streak bookkeeping. After 3 consecutive benchings for a player who
 * expects minutes, morale drops each further benching and the UI should offer
 * the complaint decision (flag `can_complain`).
 */
export function trackSelection(hero: Hero, life: Life, started: boolean): Lines {
  if (started) {
    life.flags.bench_streak = 0
    life.flags.can_complain = false
    life.flags.promised_start = false
    return []
  }
  const streak = (typeof life.flags.bench_streak === 'number' ? life.flags.bench_streak : 0) + 1
  life.flags.bench_streak = streak
  if (hero.contract && EXPECTS_TO_PLAY.has(hero.contract.role) && streak >= 3) {
    hero.morale = meter(hero.morale - 3)
    life.flags.can_complain = true
    return [fill(lt('Üst üste {n} maçtır yedek kulübesindesin. Sabrın tükeniyor.', 'Benched for {n} matches in a row. Your patience is wearing thin.'), { n: streak })]
  }
  return []
}

export type ComplaintApproach = 'polite' | 'demand' | 'public'
export type ComplaintOutcome = 'promised' | 'listened' | 'rebuffed' | 'transferListed'

/**
 * Complain about playing time.
 *  - polite: low risk, modest upside (P(promise) ≈ 0.25 + trust/200).
 *  - demand: higher upside if you are clearly good enough (OVR above squad),
 *    otherwise a sharp trust hit.
 *  - public (press): fans side with you, but the manager rarely forgives:
 *    big trust/relationship/discipline cost, ~25% chance of being transfer-listed.
 */
export function benchComplaint(
  rng: Rng, hero: Hero, life: Life, approach: ComplaintApproach, ctx: SquadContext, cal: Calendar,
): { outcome: ComplaintOutcome; lines: Lines } {
  const week = absWeek(cal)
  const gap = heroOvr(hero) - ctx.squadAvgOvr
  const lines: Lines = []
  life.flags.can_complain = false
  let outcome: ComplaintOutcome
  if (approach === 'polite') {
    const p = clamp(0.25 + hero.managerTrust / 200 + gap * 0.02, 0.05, 0.85)
    outcome = rng.chance(p) ? 'promised' : 'listened'
    if (outcome === 'listened') changeTrust(hero, 1)
  } else if (approach === 'demand') {
    const p = clamp(0.2 + gap * 0.05 + (hero.reputation - 30) * 0.005, 0.05, 0.85)
    outcome = rng.chance(p) ? 'promised' : 'rebuffed'
    if (outcome === 'rebuffed') {
      changeTrust(hero, -8)
      changeRelation(life, MANAGER_REL, -8, { memory: lt('Ondan forma talep ettin.', 'You demanded a starting spot.'), week })
    }
  } else {
    changeRelation(life, 'fans', 6, { hero })
    changeRelation(life, 'press', 4)
    changeRelation(life, MANAGER_REL, -18, { memory: lt('Onu basına şikâyet ettin.', 'You criticised him in the press.'), week })
    changeTrust(hero, -15)
    life.discipline = meter(life.discipline - 10)
    outcome = rng.chance(0.25) ? 'transferListed' : 'rebuffed'
  }
  switch (outcome) {
    case 'promised':
      life.flags.promised_start = true
      hero.morale = meter(hero.morale + 6)
      lines.push(lt('Teknik direktör: "Haklısın, önümüzdeki maç sahadasın."', 'Manager: "Fair enough, you start the next game."'))
      break
    case 'listened':
      lines.push(lt('Teknik direktör seni dinledi ama söz vermedi.', 'The manager listened but made no promises.'))
      break
    case 'rebuffed':
      hero.morale = meter(hero.morale - 5)
      lines.push(lt('Teknik direktör: "Formayı antrenmanda kazanırsın, laf ile değil."', 'Manager: "You earn your place in training, not with words."'))
      break
    case 'transferListed':
      life.flags.transfer_listed = true
      hero.morale = meter(hero.morale - 10)
      lines.push(lt('Kulüp seni transfer listesine koydu!', 'The club has put you on the transfer list!'))
      break
  }
  return { outcome, lines }
}
