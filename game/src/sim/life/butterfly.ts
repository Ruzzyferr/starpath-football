/**
 * Butterfly links (owner principle: "even the smallest matter must have an
 * effect somewhere"). Cross-system consequences that used to dead-end:
 *
 *  - the evening before a match, the hero's fatigue / energy / sharpness and
 *    his health & stress reach the match itself ({@link preMatchCondition});
 *  - a luxury purchase is seen by the press, the fans, the dressing room and
 *    the family ({@link luxuryReaction});
 *  - the agent's and chairman's goodwill, recent awards and a loyalty pledge
 *    move contract talks ({@link negotiationLeverage});
 *  - a hostile press, a partner crisis or a cold dressing room weigh on the
 *    hero week after week ({@link weeklyClimate});
 *  - captaincy grows leadership, the dressing-room bond lifts the team
 *    ({@link dressingRoomChemistry}).
 *
 * Every function returns cause lines that name the originating action, so the
 * "why" panels, the log and the news can show the chain to the player.
 * Pure and deterministic (an `Rng` is only taken where a headline is drawn).
 */
import type { AssetDef, Calendar, Hero, LText, Life } from '../../core/types'
import type { Rng } from '../../core/rng'
import { NEWS_SOURCES, absWeek, clamp, fill, heroAge, lt, meter, pushNews, type Lines } from '../career/common'
import { perkValue } from '../career/perks'
import { changeRelation, closeCircleMood, teammateAverage } from './relationships'
import { addStress, isBurnedOut, mentalMatchModifier } from './wellbeing'
import { echoChemistry, echoLeverage } from './echoes'

/** A cause shown to the player: what happened, and whether it helped or hurt. */
export interface Cause {
  key: string
  label: LText
  tone: 'pos' | 'neg'
}

// ───────────────────────── Evenings and nights out ─────────────────────────

/** Absolute day of the last nightlife evening (set by life/activities). */
export const NIGHTLIFE_DAY_FLAG = 'nightlife_day'
/** Activity id of the last nightlife evening ('party', 'casino'…), for cause lines. */
export const NIGHTLIFE_ACT_FLAG = 'nightlife_act'
/** Absolute day the hero was recognised at the casino (life/casino). */
export const CASINO_SEEN_DAY_FLAG = 'casino_seen_day'

/** Name of a night out for cause lines, by activity id. */
export function nightName(act: unknown): LText {
  if (act === 'casino') return lt('kumarhane ziyareti', 'casino visit')
  if (act === 'party') return lt('parti', 'nightclub outing')
  return lt('eğlence', 'night out')
}

/** True when the hero went out the evening before `today` (absolute day). */
export function nightBefore(life: Pick<Life, 'flags'>, today: number): boolean {
  return life.flags[NIGHTLIFE_DAY_FLAG] === today - 1
}

/**
 * Selection penalty for a night out the evening before the match (2 parts):
 * the hangover shows in the warm-up (−0.06), and the club knows when it was a
 * nightclub (paparazzi, −0.06 more) or the hero was spotted at the casino (−0.09 more).
 */
export function preMatchNightPenalty(life: Pick<Life, 'flags'>, today: number | undefined): number {
  if (today === undefined || !nightBefore(life, today)) return 0
  const act = life.flags[NIGHTLIFE_ACT_FLAG]
  let p = 0.06
  if (act === 'party') p += 0.06
  if (act === 'casino' && life.flags[CASINO_SEEN_DAY_FLAG] === today - 1) p += 0.09
  return p
}

/** Selection penalty from a poor conduct record: discipline under 40 costs up to −0.1. */
export const disciplineSelectionPenalty = (life: Pick<Life, 'discipline'>): number =>
  life.discipline < 40 ? ((40 - life.discipline) / 40) * 0.1 : 0

// ───────────────────────── Pre-match condition → the match ─────────────────────────

/** Fatigue above this starts the match on tired legs. */
export const START_FATIGUE_FROM = 40
/** Upper bound of the starting in-match fatigue (0..1 scale of the engine). */
export const START_FATIGUE_MAX = 0.3
/** Sharpness below this costs a little sharpness on the ball (ring rust). */
export const RUST_FROM = 55

/**
 * Injury proneness from the hero's life, without fatigue (the match engine
 * tracks in-match fatigue itself): low health, chronic stress and burnout raise
 * it, `injury_resist` perks lower it. 0.5..2.
 */
export function lifeInjuryProneness(life: Pick<Life, 'health' | 'stress' | 'flags'>, hero: Pick<Hero, 'perks'>): number {
  let m = 1 + (100 - clamp(life.health, 0, 100)) / 200
  if (life.stress > 70) m += (life.stress - 70) / 100
  if (isBurnedOut(life as Life)) m += 0.2
  m *= 1 - clamp(perkValue(hero, 'injury_resist'), 0, 0.6)
  return clamp(m, 0.5, 2)
}

export interface PreMatchCondition {
  /** Starting in-match fatigue of the hero, 0..{@link START_FATIGUE_MAX}. */
  startFatigue: number
  /** Injury proneness passed to the match engine (1 = average). */
  proneness: number
  /** Multiplier on the hero's physical and technical attributes (ring rust), 0.94..1. */
  rustMult: number
  /** Team-morale multiplier from the dressing-room bond (club matches only). */
  chemistry: number
  causes: Cause[]
}

/**
 * The hero's state on the morning of a match, as the match will feel it.
 * `today` is the absolute day (for the night before); `club` false for national matches.
 */
export function preMatchCondition(hero: Hero, life: Life, today: number, club = true): PreMatchCondition {
  const causes: Cause[] = []
  let start = 0
  if (hero.fatigue > START_FATIGUE_FROM) {
    const f = ((hero.fatigue - START_FATIGUE_FROM) / 100) * 0.4
    start += f
    causes.push({ key: 'fatigue', tone: 'neg', label: fill(lt('Yorgun başladın (yorgunluk {v}): bacakların erken ağırlaşır.', 'You started tired (fatigue {v}): your legs go heavy early.'), { v: Math.round(hero.fatigue) }) })
  }
  if (life.energy < 40) {
    start += ((40 - life.energy) / 100) * 0.25
    causes.push({ key: 'energy', tone: 'neg', label: fill(lt('Maç günü enerjin düşüktü ({v}).', 'Your energy was low on match day ({v}).'), { v: Math.round(life.energy) }) })
  }
  if (nightBefore(life, today)) {
    start += 0.06
    causes.push({ key: 'night', tone: 'neg', label: fill(lt('Dün geceki {n} yorgunluğunu artırdı.', "Last night's {n} added to your fatigue."), { n: nightName(life.flags[NIGHTLIFE_ACT_FLAG]) }) })
  }
  const startFatigue = Math.round(clamp(start, 0, START_FATIGUE_MAX) * 1000) / 1000

  const proneness = Math.round(lifeInjuryProneness(life, hero) * 1000) / 1000
  if (proneness >= 1.12) {
    const why = life.stress > 70
      ? lt('Yüksek stres sakatlık riskini artırdı.', 'High stress raised your injury risk.')
      : lt('Tam iyileşmemiş vücudun sakatlık riskini artırdı.', 'A body not fully recovered raised your injury risk.')
    causes.push({ key: 'prone', tone: 'neg', label: why })
  }

  let rustMult = 1
  if (hero.sharpness < RUST_FROM) {
    rustMult = Math.round((1 - ((RUST_FROM - hero.sharpness) / RUST_FROM) * 0.06) * 1000) / 1000
    causes.push({ key: 'rust', tone: 'neg', label: fill(lt('Maç temposu eksikti (keskinlik {v}): ilk dokunuşlar paslıydı.', 'You lacked match sharpness ({v}): your touch was rusty.'), { v: Math.round(hero.sharpness) }) })
  }

  const mental = mentalMatchModifier(life)
  if (mental <= 0.97) {
    const circle = closeCircleMood(life)
    const label = circle <= -3
      ? lt('Ailen ve sevdiklerinle aranın bozuk olması soğukkanlılığını düşürdü.', 'Trouble with your family and loved ones cost you composure.')
      : life.stress > 50
        ? lt('Stres soğukkanlılığını düşürdü.', 'Stress cost you composure.')
        : lt('Mutsuzluk soğukkanlılığını düşürdü.', 'Unhappiness cost you composure.')
    causes.push({ key: 'mental', tone: 'neg', label })
  } else if (mental >= 1.06) {
    causes.push({ key: 'mental', tone: 'pos', label: lt('Huzurlu bir kafa: soğukkanlılığın yerindeydi.', 'A settled mind: your composure was spot on.') })
  }

  const chem = club ? dressingRoomChemistry(hero, life) : { mult: 1, cause: null }
  if (chem.cause) causes.push(chem.cause)
  return { startFatigue, proneness, rustMult, chemistry: chem.mult, causes }
}

/**
 * Dressing-room chemistry: the hero's bond with his teammates lifts or drags
 * his side's morale (±4 %), a captain who leads (leadership 70+) adds 1 %.
 * The engine weighs team morale at 30 %, so the swing on the pitch is ~±1.5 %.
 */
export function dressingRoomChemistry(hero: Pick<Hero, 'contract' | 'attrs'>, life: Life): { mult: number; cause: Cause | null } {
  const avg = teammateAverage(life)
  let m = 1 + clamp((avg / 100) * 0.08, -0.04, 0.04)
  const captain = hero.contract?.role === 'captain' && (hero.attrs?.leadership ?? 0) >= 70
  if (captain) m += 0.01
  // Echoes: a handed-over armband or a centre-back duo's shared codes (life/echoes).
  const echo = echoChemistry(hero, life)
  m += echo.value
  m = Math.round(m * 1000) / 1000
  let cause: Cause | null = null
  if (avg <= -15) cause = { key: 'chem', tone: 'neg', label: lt('Soyunma odasındaki soğukluk takımın uyumunu bozdu.', 'The cold dressing room hurt the team’s chemistry.') }
  else if (captain) cause = { key: 'chem', tone: 'pos', label: lt('Kaptanlığın takımı bir arada tuttu.', 'Your captaincy held the team together.') }
  else if (avg >= 30) cause = { key: 'chem', tone: 'pos', label: lt('Takım arkadaşlarınla bağın takıma moral verdi.', 'Your bond with your teammates lifted the team.') }
  else if (echo.cause) cause = { ...echo.cause, key: 'chem' }
  return { mult: m, cause }
}

/** Attribute keys that ring rust affects (mental and goalkeeping instinct stay). */
const RUST_KEYS = [
  'pace', 'acceleration', 'stamina', 'strength', 'agility', 'balance', 'jumping',
  'passing', 'shooting', 'finishing', 'dribbling', 'firstTouch', 'crossing', 'heading', 'tackling', 'setPieces',
  'longPassing', 'curve', 'handling', 'reflexes', 'diving', 'gkDistribution',
] as const

/** Apply ring rust to a copy of the hero's match attributes. */
export function applyRust<T extends Record<string, number>>(attrs: T, mult: number): T {
  if (mult >= 1) return attrs
  const out: Record<string, number> = { ...attrs }
  for (const k of RUST_KEYS) if (typeof out[k] === 'number') out[k] = clamp(Math.round(out[k] * mult), 1, 99)
  return out as T
}

// ───────────────────────── Luxury purchases → the people around ─────────────────────────

const FLASHY: ReadonlySet<string> = new Set(['car', 'watch', 'boat', 'jet', 'island', 'fashion'])
/** life.flags key: JSON {id, w} of the last purchase that drew a reaction (cause lines). */
export const LUX_LAST_FLAG = 'lux:last'
/** life.flags key: absolute week of the last luxury headline. */
export const LUX_NEWS_FLAG = 'lux:news'
/** Weeks between two luxury headlines. */
export const LUX_NEWS_GAP = 4

/**
 * How the people around the hero react to a purchase (real life: a supercar
 * is noticed). Show-off items (car, watch, boat, jet, island, fashion) that
 * cost at least 5 % of a year's wage:
 *  - followers +0.4 % per level (the photos travel) and a headline for big buys;
 *  - fans −2 per level when the hero is out of form (form < 45);
 *  - a youngster (< 23) flaunting it: teammates' jealousy −1/−2 and discipline −level in season;
 *  - the partner enjoys it (+2).
 * A house pleases the family and the partner (+3); a facility impresses the manager (+1, discipline +1).
 * Level = 1 at 5 % of a year's wage, 2 at 50 %, 3 at 5×.
 */
export function luxuryReaction(rng: Rng, hero: Hero, life: Life, def: AssetDef, cal: Calendar, inSeason: boolean): Lines {
  const lines: Lines = []
  const week = absWeek(cal)
  const opts = { week, cause: 'other' as const, why: fill(lt('{n} satın aldın', 'You bought the {n}'), { n: def.name }) }
  if (def.category === 'house') {
    let any = false
    for (const id of ['mother', 'father', 'partner']) if (changeRelation(life, id, 3, { ...opts, hero }) !== 0) any = true
    if (any) lines.push(fill(lt('🏠 {n}: ailen ve sevdiklerin yeni evden çok mutlu.', '🏠 {n}: your family and loved ones love the new home.'), { n: def.name }))
    return lines
  }
  if (def.category === 'facility') {
    changeRelation(life, 'manager', 1, { ...opts, hero })
    life.discipline = meter(life.discipline + 1)
    lines.push(lt('🏋️ Teknik direktör kendi tesisine yatırım yapmanı takdir etti.', '🏋️ The manager appreciates you investing in your own facility.'))
    return lines
  }
  if (!FLASHY.has(def.category)) return lines
  const annual = Math.max(20_000, (hero.contract?.wage ?? 400) * 52)
  const ratio = def.price / annual
  if (ratio < 0.05) return lines
  const level = clamp(Math.floor(Math.log10(ratio / 0.05)) + 1, 1, 3)
  const young = heroAge(hero, cal.season) < 23
  const parts: string[][] = [[], []]
  const gain = Math.round(life.followers * 0.004 * level + 20 * level)
  life.followers += gain
  if (hero.form < 45 && changeRelation(life, 'fans', -2 * level, { ...opts, hero }) !== 0) {
    parts[0]!.push('taraftar tepkili')
    parts[1]!.push('fans are unhappy')
  }
  if (young) {
    const d = level >= 2 ? -2 : -1
    for (const r of Object.values(life.relationships)) if (r.kind === 'teammate') changeRelation(life, r.id, d, { ...opts, why: fill(lt('{n} kıskançlığı', 'Jealous of your {n}'), { n: def.name }) })
    parts[0]!.push('takım arkadaşların kıskanıyor')
    parts[1]!.push('teammates are jealous')
    if (inSeason) {
      life.discipline = meter(life.discipline - level)
      parts[0]!.push(`disiplin -${level}`)
      parts[1]!.push(`discipline -${level}`)
    }
  }
  if (changeRelation(life, 'partner', 2, { ...opts, hero }) !== 0) {
    parts[0]!.push('sevgilin keyifli')
    parts[1]!.push('your partner loves it')
  }
  life.flags[LUX_LAST_FLAG] = JSON.stringify({ id: def.id, w: week })
  lines.push(fill(lt('📸 {n} gündemde: takipçi +{f}{p}.', '📸 Your {n} is the talk of the town: followers +{f}{p}.'), {
    n: def.name, f: gain,
    p: { tr: parts[0]!.length ? `, ${parts[0]!.join(', ')}` : '', en: parts[1]!.length ? `, ${parts[1]!.join(', ')}` : '' },
  }))
  const lastNews = life.flags[LUX_NEWS_FLAG]
  if (ratio >= 0.15 && (typeof lastNews !== 'number' || week - lastNews >= LUX_NEWS_GAP)) {
    life.flags[LUX_NEWS_FLAG] = week
    changeRelation(life, 'press', 1, opts)
    const n = hero.nickname || hero.lastName
    const bad = hero.form < 45 || young
    const headline = bad
      ? fill(rng.pick([
        lt('Form yerlerde, {n} {i} peşinde', 'Form on the floor, {n} out buying a new {i}'),
        lt('{n} yeni {i} ile antrenmana geldi, soyunma odası konuşuyor', '{n} turns up to training in a new {i}; the dressing room is talking'),
      ]), { n, i: def.name })
      : fill(lt('{n} kendini ödüllendirdi: yeni bir {i}', '{n} treats themself: a brand-new {i}'), { n, i: def.name })
    pushNews(life, rng, cal, headline, bad ? -1 : 0, rng.pick(NEWS_SOURCES))
  }
  return lines
}

/** The last purchase that drew a reaction, if within `weeks` weeks (cause lines). */
export function recentLuxury(life: Pick<Life, 'flags'>, week: number, weeks = 6): { id: string; w: number } | null {
  const raw = life.flags[LUX_LAST_FLAG]
  if (typeof raw !== 'string') return null
  try {
    const v = JSON.parse(raw) as { id: string; w: number }
    return week - v.w <= weeks ? v : null
  } catch {
    return null
  }
}

// ───────────────────────── Contract talks ─────────────────────────

export interface Leverage {
  /** Extra hidden wage headroom (fraction, can be negative). */
  headroom: number
  /** Patience change in points. */
  patience: number
  causes: Cause[]
}

/**
 * Who sits at the table besides the club's offer: the agent's goodwill (±4 %
 * headroom, ±10 patience), the chairman's goodwill on a renewal (±5 %), a
 * loyalty pledge (+2 %), awards of this or last season (+3 % each, max +9 %)
 * and a poor discipline record (−3 %).
 */
export function negotiationLeverage(hero: Pick<Hero, 'awards'> & { contract?: Hero['contract'] }, life: Pick<Life, 'agent' | 'relationships' | 'flags' | 'discipline'>, season: number, sameClub: boolean): Leverage {
  let headroom = 0
  let patience = 0
  const causes: Cause[] = []
  const agentRel = life.agent ? life.relationships.agent?.value : undefined
  if (agentRel !== undefined && Math.abs(agentRel) >= 20) {
    headroom += clamp((agentRel / 100) * 0.04, -0.04, 0.04)
    patience += Math.round(clamp(agentRel / 10, -10, 10))
    causes.push(agentRel > 0
      ? { key: 'agent', tone: 'pos', label: lt('Menajerinle aran iyi: senin için sıkı pazarlık ediyor.', 'You get on with your agent: they fight hard for you.') }
      : { key: 'agent', tone: 'neg', label: lt('Menajerinle aran soğuk: pazarlığa isteksiz.', 'Things are cold with your agent: their heart is not in it.') })
  }
  const chair = life.relationships.chairman?.value
  if (sameClub && chair !== undefined && Math.abs(chair) >= 15) {
    headroom += clamp((chair / 100) * 0.05, -0.05, 0.05)
    causes.push(chair > 0
      ? { key: 'chairman', tone: 'pos', label: lt('Başkan seni seviyor: kasanın kapısı biraz daha açık.', 'The chairman likes you: the purse is a little more open.') }
      : { key: 'chairman', tone: 'neg', label: lt('Başkanla aran bozuk: kulüp cimri davranıyor.', 'You are on bad terms with the chairman: the club is tight-fisted.') })
  }
  if (sameClub && life.flags.loyalty_pledge === true) {
    headroom += 0.02
    causes.push({ key: 'loyalty', tone: 'pos', label: lt('Taraftara verdiğin sadakat sözü yönetimin gözünde değerli.', 'The loyalty pledge you made to the fans counts with the board.') })
  }
  const recent = hero.awards.filter((a) => a.season >= season - 1)
  if (recent.length) {
    headroom += Math.min(0.09, 0.03 * recent.length)
    causes.push({ key: 'awards', tone: 'pos', label: fill(lt('Son ödüllerin ({n}) pazarlık gücünü artırdı.', 'Your recent awards ({n}) strengthen your hand.'), { n: recent.length }) })
  }
  if (life.discipline < 40) {
    headroom -= 0.03
    causes.push({ key: 'discipline', tone: 'neg', label: lt('Disiplin sicilin pazarlık gücünü zayıflattı.', 'Your discipline record weakens your hand.') })
  }
  // Echoes: a renewal pushed for earlier, a closed investigation (life/echoes).
  const echo = echoLeverage(life, sameClub, hero.contract?.clubId)
  headroom += echo.headroom
  patience += echo.patience
  causes.push(...echo.causes)
  return { headroom: Math.round(headroom * 1000) / 1000, patience, causes }
}

// ───────────────────────── Weekly climate ─────────────────────────

/** Fame factor 0..1 from followers (0 at 1K, 1 at 1M): how loud the press around the hero is. */
export const fameReach = (followers: number): number => clamp(Math.log10(Math.max(1, followers) / 1000) / 3, 0, 1)

/**
 * The weekly weight of the hero's relationships (call in the weekly tick):
 *  - hostile press (≤ −30): stress up to +4.5, louder with more followers; a friendly press (≥ 40) a little fame;
 *  - partner crisis (≤ −30): stress +2;
 *  - a cold dressing room (teammates average ≤ −25): stress +1.5, morale −1;
 *  - therapy (`in_therapy`): stress −1.
 * A line is logged every 4 weeks per pressure so the log does not repeat itself.
 */
export function weeklyClimate(hero: Hero, life: Life, cal: Calendar): Lines {
  const lines: Lines = []
  const w = absWeek(cal)
  const say = (key: string, text: LText): void => {
    const f = `clim:${key}`
    const last = life.flags[f]
    if (typeof last !== 'number' || w - last >= 4) {
      life.flags[f] = w
      lines.push(text)
    }
  }
  const press = life.relationships.press?.value ?? 0
  const reach = fameReach(life.followers)
  if (press <= -30) {
    const d = addStress(life, hero, ((-press - 30) / 70) * 3 * (0.5 + reach))
    if (d >= 0.5) say('press', fill(lt('📰 Basınla aran gergin: manşetler üstüne geliyor (stres +{d}).', '📰 The press is against you: the headlines keep coming (stress +{d}).'), { d: d.toFixed(1) }))
  } else if (press >= 40) {
    hero.reputation = clamp(hero.reputation + 0.02 * (0.5 + reach), 0, 100)
  }
  const partner = Object.values(life.relationships).find((r) => r.kind === 'partner')
  if (partner && partner.value <= -30) {
    addStress(life, hero, 2)
    say('partner', fill(lt('💔 {n} ile kriz sürüyor: kafan sahada değil (stres +2).', '💔 The crisis with {n} goes on: your head is not on the pitch (stress +2).'), { n: partner.name }))
  }
  if (teammateAverage(life) <= -25) {
    addStress(life, hero, 1.5)
    hero.morale = meter(hero.morale - 1)
    say('squad', lt('🧊 Soyunma odasında yalnızsın: kimse sana pas vermek istemiyor.', '🧊 You are alone in the dressing room: nobody wants to pass to you.'))
  }
  if (life.flags.in_therapy === true) addStress(life, hero, -1)
  return lines
}
