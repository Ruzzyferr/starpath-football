/**
 * Daily activities: availability, execution, morning reset and the
 * autopilot day planner ("auto-advance to match day", GDD 1).
 *
 * The calendar is NOT advanced here: `performActivity` returns `slotsUsed`
 * and the game layer moves `calendar.slot` forward (and calls
 * {@link startDay} when a new day begins).
 */
import type { AttributeGroup, AttributeKey, Calendar, Hero, LText, Life, Position } from '../../core/types'
import type { Rng } from '../../core/rng'
import { ACTIVITIES, ACTIVITY_BY_ID, type ActivityDef, type MoneyFormula, type RelationTarget } from '../../data/activities'
import { absWeek, clamp, fill, heroAge, fmtMoney, fmtNum, lt, meter, signed, type Lines } from '../career/common'
import { addFatigue, recoverFatigue } from '../career/condition'
import { perkValue } from '../career/perks'
import { applyXpBundle } from '../career/progression'
import { fatigueEfficiency, runTraining, trainingEnergyCost, type TrainingIntensity, type TrainingType } from '../career/training'
import { assetEffectTotal } from './assetEffects'
import { changeRelation, teammateAverage } from './relationships'
import { casinoExclusion } from './casino'
import { makePost, type PostType } from './social'
import { sponsorShootPay } from './sponsors'
import { addHappiness, addHealth, addStress, energyCap, isBurnedOut, wellbeingXpMultiplier } from './wellbeing'

/** Situation of the current slot, supplied by the game layer. */
export interface ActivityContext {
  calendar: Calendar
  inSeason: boolean
  matchToday: boolean
  matchTomorrow: boolean
}

/** Player choices for activities that take parameters. */
export interface ActivityOptions {
  /** 0..1 training mini-game score (auto = 0.6). */
  performance?: number
  intensity?: TrainingIntensity
  /** Overrides the activity's training type (e.g. generic "train" button). */
  trainingType?: TrainingType
  postType?: PostType
  trainerGroup?: AttributeGroup
  /** Trainer quality 1..3 (fee and name tier). */
  trainerQuality?: 1 | 2 | 3
}

export interface ActivityResult {
  ok: boolean
  lines: Lines
  /** Tags for the event system (e.g. 'nightlife', 'casino', 'viral'). */
  triggerTags: string[]
  /** Hint for the event system: probability to fire a follow-up card. */
  eventChance: number
  slotsUsed: number
  /** Present for training sessions: what the session gave. */
  training?: TrainingReport
}

/** Outcome of a training session (for result screens). */
export interface TrainingReport {
  type: TrainingType
  performance: number
  /** Raw XP per attribute (before the age multiplier). */
  xp: Partial<Record<AttributeKey, number>>
  /** Whole attribute points gained. */
  gains: Partial<Record<AttributeKey, number>>
  injured: boolean
}

/** Absolute day index for cooldowns / hangover tracking. */
export const absDay = (cal: Calendar): number => absWeek(cal) * 7 + cal.day

/**
 * Wealth multiplier for lifestyle costs: 1× up to 5K cash, +1× per decade
 * of wealth above that, max 4× (≥ 5M). A night out costs ~300 for a youth
 * player and ~1.2K for a millionaire.
 */
export const lifestyleScale = (money: number): number => 1 + clamp(Math.log10(Math.max(1, money) / 5000), 0, 3)

/** Weekly fee for a personal trainer by quality tier. */
export const TRAINER_FEES: Readonly<Record<1 | 2 | 3, number>> = { 1: 800, 2: 2500, 3: 7000 }

export const TRAINER_NAMES: Readonly<Record<1 | 2 | 3, readonly string[]>> = {
  1: ['Kerem Hoca', 'Coach Dani', 'Selim Usta', 'Coach Mikey'],
  2: ['Dr. Ercan Aksoy', 'Coach Helena Brandt', 'Tolga Sezer', 'Coach Rafael Moura'],
  3: ['Prof. Victor Hale', 'Dr. Leyla Karaca', 'Coach Anders Lund', 'Dr. Matteo Ricci'],
}

const GROUP_INDEX: Readonly<Record<AttributeGroup, number>> = { physical: 0, technical: 1, mental: 2, goalkeeping: 3 }

/** The trainer on offer for a speciality and tier (the same name the hire uses). */
export function trainerName(group: AttributeGroup, quality: 1 | 2 | 3): string {
  const list = TRAINER_NAMES[quality]
  return list[GROUP_INDEX[group] % list.length]
}

/** Money delta of an activity (negative = cost). Deterministic. */
export function activityMoney(def: ActivityDef, hero: Pick<Hero, 'reputation'>, life: Life): number {
  const f: MoneyFormula | undefined = def.moneyFormula
  const s = lifestyleScale(life.money)
  let m = def.money ?? 0
  switch (f) {
    case 'shopping': m -= clamp(life.money * 0.03, 150, 25000); break // 3% of cash: impulse spend
    case 'travel': m -= clamp(1500 + life.money * 0.04, 1500, 250000); break
    case 'charity': m -= clamp(life.money * 0.02, 200, 100000); break // tithe-like donation
    case 'interview': m += Math.round(50 * hero.reputation); break // rep 20 → 1K fee, rep 80 → 4K
    case 'party': m -= 300 * s; break
    case 'date': m -= 150 * s; break
    case 'golf': m -= 120 * s; break
    case 'dinner': m -= 200 * s; break
    case 'physio': m -= 150; break // private session; club physio is in the weekly tick
    default: break
  }
  return Math.round(m)
}

/** Energy an activity will cost (negative = restores), including perks. */
export function activityEnergy(def: ActivityDef, hero: Hero, opts: ActivityOptions = {}): number {
  if (def.special === 'train') return trainingEnergyCost(opts.trainingType ?? def.trainingType ?? 'tactical', opts.intensity ?? 'normal')
  let e = def.energy
  if (e > 0 && def.triggerTags.includes('nightlife')) e *= 1 - clamp(perkValue(hero, 'nightlife_energy'), 0, 0.8)
  return Math.round(e)
}

const hasPartner = (life: Life): boolean => !!life.relationships.partner

/**
 * Why an activity is unavailable right now, or null if it can be done.
 * Checks slot fit, day, season, injury, match proximity, partner/sponsor/
 * trainer requirements, reputation, money, energy and cooldown.
 */
export function activityBlock(hero: Hero, life: Life, def: ActivityDef, ctx: ActivityContext, opts: ActivityOptions = {}): LText | null {
  const c = def.conditions
  const slot = ctx.calendar.slot
  if (!def.allowedSlots.includes(slot)) return lt('Bu saatte yapılamaz.', 'Not available at this time of day.')
  if (slot + def.slots > 3) return lt('Gün içinde yeterli zaman kalmadı.', 'Not enough time left today.')
  if (c.days && !c.days.includes(ctx.calendar.day)) return lt('Bugün yapılamaz.', 'Not available today.')
  if (c.offSeasonOnly && ctx.inSeason) return lt('Sadece sezon arasında.', 'Off-season only.')
  if (c.inSeasonOnly && !ctx.inSeason) return lt('Sadece sezon içinde.', 'In-season only.')
  const type = opts.trainingType ?? def.trainingType
  const injuredOk = c.injuredOk || (def.special === 'train' && type === 'recovery')
  if (hero.injury && !injuredOk) return lt('Sakatken yapamazsın.', "You can't do this while injured.")
  if (c.notMatchDay && ctx.matchToday) return lt('Maç günü yapılamaz.', 'Not on match day.')
  if (c.notBeforeMatch && ctx.matchTomorrow) return lt('Maçtan önceki gün yapılamaz.', 'Not the day before a match.')
  if (c.requiresPartner && !hasPartner(life)) return lt('Bir sevgilin yok.', "You don't have a partner.")
  if (c.requiresSponsor && life.sponsors.length === 0) return lt('Sponsorun yok.', 'You have no sponsor.')
  if (c.requiresTrainer && !life.trainer) return lt('Özel antrenörün yok.', 'You have no personal trainer.')
  if (c.minAge !== undefined && heroAge(hero, ctx.calendar.season) < c.minAge) {
    const n = c.minAge - heroAge(hero, ctx.calendar.season)
    return fill(lt('{a} yaş sınırı var. {n} yıl sonra kapılar açılır.', 'Strictly {a}+. The doors open in {n} year(s).'), { a: c.minAge, n })
  }
  if (def.special === 'casino' && casinoExclusion(life) > 0) {
    return fill(lt('Kumarhaneyi kendine {n} hafta kapattın.', 'You locked yourself out of the casino for {n} more week(s).'), { n: casinoExclusion(life) })
  }
  if (c.minReputation !== undefined && hero.reputation < c.minReputation) return lt('Henüz yeterince tanınmıyorsun.', "You're not famous enough yet.")
  if (c.minMoney !== undefined && life.money < c.minMoney) return lt('Yeterli paran yok.', 'Not enough money.')
  const cost = -activityMoney(def, hero, life)
  if (cost > 0 && cost > life.money) return lt('Yeterli paran yok.', 'Not enough money.')
  if (def.special === 'trainer') {
    const fee = TRAINER_FEES[opts.trainerQuality ?? 1]
    if (life.money < fee * 2) return lt('İki haftalık ücreti karşılayacak paran yok.', "You can't cover two weeks of fees.")
  }
  const energy = activityEnergy(def, hero, opts)
  if (energy > 0 && life.energy < energy) return lt('Enerjin yetersiz.', 'Not enough energy.')
  if (c.cooldownDays) {
    const last = life.flags[`act_${def.id}`]
    if (typeof last === 'number' && absDay(ctx.calendar) - last < c.cooldownDays) return lt('Bunu kısa süre önce yaptın.', 'You did this recently.')
  }
  return null
}

export interface ActivityAvailability {
  def: ActivityDef
  available: boolean
  reason: LText | null
  /** Preview numbers for the UI. */
  energy: number
  money: number
}

/** All activities with availability and previews for the current slot. */
export function availableActivities(hero: Hero, life: Life, ctx: ActivityContext): ActivityAvailability[] {
  return ACTIVITIES.map((def) => {
    const reason = activityBlock(hero, life, def, ctx)
    return { def, available: reason === null, reason, energy: activityEnergy(def, hero), money: activityMoney(def, hero, life) }
  })
}

/** Relationship ids for a target. */
function targetIds(life: Life, t: RelationTarget): string[] {
  switch (t) {
    case 'family': return ['mother', 'father', 'sibling'].filter((id) => life.relationships[id])
    case 'teammates': return Object.values(life.relationships).filter((r) => r.kind === 'teammate').map((r) => r.id)
    default: return life.relationships[t] ? [t] : []
  }
}

/** Physio sessions recorded this week (feed into condition.weeklyInjuryTick). */
export function physioSessionsThisWeek(life: Life, cal: Calendar): number {
  return life.flags.physio_week === absWeek(cal) && typeof life.flags.physio_count === 'number' ? life.flags.physio_count : 0
}

/** Compact delta summary line: "Enerji -30 · Mutluluk +10 · Para -500 €". */
function deltaLine(parts: { label: LText; v: number; money?: boolean }[]): LText | null {
  const shown = parts.filter((p) => Math.round(p.v) !== 0)
  if (shown.length === 0) return null
  const fmt = (lang: 'tr' | 'en') =>
    shown.map((p) => `${p.label[lang]} ${p.money ? (p.v > 0 ? '+' : '') + fmtMoney(p.v)[lang] : signed(p.v)}`).join(' · ')
  return { tr: fmt('tr'), en: fmt('en') }
}

/**
 * Perform an activity in the current slot. Validates availability, applies
 * every effect, and returns feedback + event tags. Never mutates on failure.
 */
export function performActivity(
  rng: Rng, hero: Hero, life: Life, activityId: string, ctx: ActivityContext, opts: ActivityOptions = {},
): ActivityResult {
  const def = ACTIVITY_BY_ID[activityId]
  if (!def) return { ok: false, lines: [lt('Bilinmeyen aktivite.', 'Unknown activity.')], triggerTags: [], eventChance: 0, slotsUsed: 0 }
  const block = activityBlock(hero, life, def, ctx, opts)
  if (block) return { ok: false, lines: [block], triggerTags: [], eventChance: 0, slotsUsed: 0 }

  const lines: Lines = []
  const tags = [...def.triggerTags]
  const week = absWeek(ctx.calendar)
  const today = absDay(ctx.calendar)
  const e0 = life.energy
  const h0 = life.happiness
  const s0 = life.stress
  const m0 = life.money
  const f0 = hero.fatigue
  let trainingReport: TrainingReport | undefined

  // ── Special handlers ──
  switch (def.special) {
    case 'train': {
      const type = opts.trainingType ?? def.trainingType ?? 'tactical'
      const r = runTraining(rng, hero, life, { type, performance: opts.performance, intensity: opts.intensity, season: ctx.calendar.season })
      if (!r.ok) return { ok: false, lines: r.lines, triggerTags: [], eventChance: 0, slotsUsed: 0 }
      trainingReport = { type, performance: Math.max(0, Math.min(1, opts.performance ?? 0.6)), xp: r.xp, gains: r.gains, injured: r.injured }
      lines.push(...r.lines)
      if (r.injured) tags.push('injury')
      if ((opts.performance ?? 0.6) >= 0.8 && ctx.inSeason) changeRelation(life, 'manager', 1, { hero, cause: 'activity', why: { tr: 'Antrenmanda göz doldurdun', en: 'You impressed in training' } })
      break
    }
    case 'gym': {
      // Own weights session: 12 raw XP split strength/stamina/jumping.
      const m = (1 + perkValue(hero, 'xp_physical') + perkValue(hero, 'xp_all') + assetEffectTotal(life, 'xp_bonus')) * wellbeingXpMultiplier(life) * fatigueEfficiency(hero.fatigue)
      lines.push(...applyXpBundle(hero, { strength: 6 * m, stamina: 4 * m, jumping: 2 * m }, ctx.calendar.season).lines)
      break
    }
    case 'video': {
      // Film study: 10 raw XP into reading the game. Works while injured.
      const m = (1 + perkValue(hero, 'xp_tactical') + perkValue(hero, 'xp_all')) * wellbeingXpMultiplier(life)
      lines.push(...applyXpBundle(hero, { positioning: 5 * m, vision: 4 * m, composure: 1 * m }, ctx.calendar.season).lines)
      break
    }
    case 'physio': {
      if (life.flags.physio_week !== week) { life.flags.physio_week = week; life.flags.physio_count = 0 }
      life.flags.physio_count = (typeof life.flags.physio_count === 'number' ? life.flags.physio_count : 0) + 1
      break
    }
    case 'post': {
      const r = makePost(rng, hero, life, opts.postType ?? 'training', ctx)
      lines.push(...r.lines)
      tags.push(...r.triggerTags.filter((t) => !tags.includes(t)))
      break
    }
    case 'shoot': {
      const pay = sponsorShootPay(life)
      life.money += pay
      break
    }
    case 'trainer': {
      const q = opts.trainerQuality ?? 1
      const group = opts.trainerGroup ?? 'technical'
      const name = trainerName(group, q)
      life.trainer = { name, group, weeklyFee: TRAINER_FEES[q], quality: q }
      lines.push(fill(lt('{n} artık özel antrenörün ({f}/hafta).', '{n} is now your personal trainer ({f}/week).'), { n: name, f: fmtMoney(TRAINER_FEES[q]) }))
      break
    }
    case 'fireTrainer':
      life.trainer = null
      break
    case 'sleepIn':
    case 'casino':
    default:
      break
  }

  // ── Generic effects ──
  if (def.special !== 'train') {
    const energy = activityEnergy(def, hero, opts)
    if (energy >= 0) life.energy = meter(life.energy - energy)
    else life.energy = Math.max(life.energy, Math.min(energyCap(life), meter(life.energy - energy)))
  }
  life.money += activityMoney(def, hero, life)
  let happy = def.happiness ?? 0
  if (def.category === 'family') happy *= 1 + perkValue(hero, 'family_bond')
  if (happy) addHappiness(life, happy)
  if (def.stress) addStress(life, hero, def.stress)
  if (def.health) addHealth(life, def.health)
  if (def.fatigue) {
    if (def.fatigue > 0) addFatigue(hero, def.fatigue)
    else recoverFatigue(hero, life, -def.fatigue)
  }
  if (def.reputation) hero.reputation = meter(hero.reputation + def.reputation)
  if (def.followersPct) life.followers = Math.round(life.followers * (1 + def.followersPct) + 2)
  let disc = def.discipline ?? 0
  if (ctx.inSeason) disc += def.disciplineInSeason ?? 0
  if (ctx.matchTomorrow) disc += def.disciplineBeforeMatch ?? 0
  if (disc) life.discipline = meter(life.discipline + disc)
  for (const r of def.relations ?? []) {
    if (r.target === 'manager' && !ctx.inSeason) continue
    for (const id of targetIds(life, r.target)) {
      const close = r.target === 'family' || r.target === 'partner' || r.target === 'bestFriend'
      changeRelation(life, id, r.delta, { memory: close ? def.memory : undefined, week, contact: close || r.target === 'teammates', hero, cause: 'activity', why: def.name })
    }
  }
  if (def.triggerTags.includes('nightlife')) life.flags.nightlife_day = today
  if (def.conditions.cooldownDays) life.flags[`act_${def.id}`] = today
  if (ctx.matchTomorrow && def.triggerTags.includes('nightlife')) tags.push('pre_match_night')

  if (def.special !== 'train' && def.special !== 'post') lines.unshift({ tr: `${def.icon} ${def.done.tr}`, en: `${def.icon} ${def.done.en}` })
  const summary = deltaLine([
    { label: lt('Enerji', 'Energy'), v: life.energy - e0 },
    { label: lt('Mutluluk', 'Happiness'), v: life.happiness - h0 },
    { label: lt('Stres', 'Stress'), v: life.stress - s0 },
    { label: lt('Yorgunluk', 'Fatigue'), v: hero.fatigue - f0 },
    { label: lt('Para', 'Money'), v: life.money - m0, money: true },
  ])
  if (summary) lines.push(summary)
  return { ok: true, lines, triggerTags: tags, eventChance: def.eventChance, slotsUsed: def.slots, ...(trainingReport ? { training: trainingReport } : {}) }
}

/** Overnight fatigue recovery (before perks/facilities). */
export const OVERNIGHT_RECOVERY = 8
/** Energy fraction kept after a night out (hangover). */
export const HANGOVER_ENERGY = 0.7

/**
 * Morning reset: energy refills to the wellbeing cap plus the `sleep` asset
 * bonus (≤100); after a nightlife evening only 70% and half the overnight
 * fatigue recovery. Call once when the calendar enters slot 0 of a new day.
 */
export function startDay(hero: Hero, life: Life, ctx: { calendar: Calendar }): Lines {
  const lines: Lines = []
  let target = Math.min(100, energyCap(life) + assetEffectTotal(life, 'sleep'))
  let rec = OVERNIGHT_RECOVERY
  if (life.flags.nightlife_day === absDay(ctx.calendar) - 1) {
    target = Math.round(target * HANGOVER_ENERGY)
    rec /= 2
    lines.push(lt('🥴 Dün geceden kalma bir başın var.', '🥴 You are hungover from last night.'))
  }
  life.energy = meter(target)
  recoverFatigue(hero, life, rec)
  return lines
}

/** An autopilot step. */
export interface PlannedActivity {
  activityId: string
  options: ActivityOptions
}

/** Training focus rotation by position (weakness-agnostic but role-relevant). */
const FOCUS: Readonly<Record<Position, readonly TrainingType[]>> = {
  GK: ['goalkeeping', 'tactical', 'goalkeeping', 'physical'],
  CB: ['tactical', 'physical', 'passing'],
  LB: ['physical', 'passing', 'tactical'],
  RB: ['physical', 'passing', 'tactical'],
  DM: ['tactical', 'passing', 'physical'],
  CM: ['passing', 'tactical', 'physical', 'shooting'],
  AM: ['passing', 'dribbling', 'shooting', 'setPiece'],
  LW: ['dribbling', 'physical', 'shooting', 'passing'],
  RW: ['dribbling', 'physical', 'shooting', 'passing'],
  ST: ['shooting', 'physical', 'dribbling', 'setPiece'],
}

/**
 * Autopilot: a sensible routine for the remaining slots of the day.
 *  - match day: light video in the morning, rest in the evening;
 *  - injured: physio → video → family/rest;
 *  - day before a match: light tactical/set-piece only, then rest (never
 *    physical, hard or nightlife);
 *  - fatigued (>60) or burned out: yoga, rest, family/rest;
 *  - normal: two role-focused normal sessions, evening tends the weakest
 *    relationship (family → partner → teammates) or rests.
 * Every step is validated; unavailable picks fall back to rest.
 */
export function autoPlanDay(hero: Hero, life: Life, ctx: ActivityContext): PlannedActivity[] {
  const plan: PlannedActivity[] = []
  const fam = ['mother', 'father', 'sibling'].map((id) => life.relationships[id]?.value).filter((v): v is number => v !== undefined)
  const famAvg = fam.length ? fam.reduce((a, b) => a + b, 0) / fam.length : 50
  const focus = FOCUS[hero.position]
  const evening = (): PlannedActivity => {
    if (famAvg < 30) return { activityId: 'family_visit', options: {} }
    if (hasPartner(life) && (life.relationships.partner?.value ?? 50) < 30) return { activityId: 'date_night', options: {} }
    if (ctx.inSeason && teammateAverage(life) < 0) return { activityId: 'team_dinner', options: {} }
    return { activityId: 'rest', options: {} }
  }
  const tired = hero.fatigue > 60 || isBurnedOut(life)
  for (let slot = ctx.calendar.slot; slot < 3; slot++) {
    let p: PlannedActivity
    if (ctx.matchToday) p = slot === 0 ? { activityId: 'video', options: {} } : { activityId: 'rest', options: {} }
    else if (hero.injury) p = slot === 0 ? { activityId: 'physio', options: {} } : slot === 1 ? { activityId: 'video', options: {} } : evening()
    else if (ctx.matchTomorrow) {
      const t: TrainingType = slot === 0 ? 'tactical' : hero.position === 'GK' ? 'goalkeeping' : 'setPiece'
      p = slot < 2 ? { activityId: `train_${t}`, options: { trainingType: t, intensity: 'light' } } : { activityId: 'rest', options: {} }
    } else if (tired) p = slot === 0 ? { activityId: 'train_recovery', options: { trainingType: 'recovery' } } : slot === 1 ? { activityId: 'rest', options: {} } : evening()
    else if (slot < 2) {
      const t = slot === 1 && hero.fatigue > 45 ? 'recovery' : focus[(ctx.calendar.day * 2 + slot) % focus.length]
      p = { activityId: `train_${t}`, options: { trainingType: t, intensity: 'normal' } }
    } else p = evening()
    const def = ACTIVITY_BY_ID[p.activityId]
    const sub: ActivityContext = { ...ctx, calendar: { ...ctx.calendar, slot } }
    if (!def || activityBlock(hero, life, def, sub, p.options)) p = { activityId: 'rest', options: {} }
    plan.push(p)
  }
  return plan
}

/** Human-readable follower count line (UI helper). */
export const followersLine = (life: Life): LText => fill(lt('{n} takipçi', '{n} followers'), { n: fmtNum(life.followers) })
