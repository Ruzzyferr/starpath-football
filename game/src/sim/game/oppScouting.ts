/**
 * Opponent video scouting (TestFlight build 4: "watching the opponent's video
 * resolves instantly"). The next club opponent's REAL squad and tactic style
 * are read into a handful of tendencies (their left-back bombs forward, they
 * go long to a tall striker, the keeper's penalty side…). The training
 * mini-game (game/training/scouting) replays them as short top-down clips; the
 * player spots each pattern. The score becomes a scouting buff for the match
 * against that opponent (+anticipation / +positioning, shown in the pre-match
 * "Rakip analizi" card) plus a little anticipation / vision XP.
 *
 * Nothing here touches the career RNG: tendencies are derived from attributes
 * and stable hashes, so the autopilot and the balance harness are unaffected
 * (they never play the mini-game; the plain 'video' activity is unchanged).
 */
import type { AttributeKey, GameState, Hero, KitColors, LText, NpcPlayer, Position, TacticStyle } from '../../core/types'
import { hashString } from '../../core/rng'
import { applyXpBundle } from '../career/progression'
import { clamp, fill, lt } from '../career/common'
import { deriveAttributes } from '../world/attributes'
import { selectLineupFromPlayers } from '../world/formations'
import { squadPlayers } from '../world/queries'
import { heroClub, readJson, writeJson } from './internal'
import { daysUntil, nextClubFixture } from './selection'

/** life.flags JSON {@link ScoutBuff}: the scouting done for the next club match. */
export const SCOUT_FLAG = 'c:scout'

export type PatternId = 'fbLeft' | 'fbRight' | 'longBall' | 'gkPenLeft' | 'gkPenRight' | 'highPress' | 'cornerNear' | 'counter' | 'shortBuild'

export interface Tendency {
  id: PatternId
  /** 0..1: how marked the habit is (the clips show the strongest ones). */
  strength: number
  /** Surname and shirt number of the player the pattern is about (if any). */
  player?: string
  number?: number
}

export interface ScoutReport {
  fixtureId: string
  oppId: string
  name: string
  short: string
  colors: KitColors
  style: TacticStyle
  /** Strongest first; at least 4. */
  tendencies: Tendency[]
}

export interface ScoutBuff {
  fixtureId: string
  oppId: string
  grade: string
  performance: number
  /** Attribute points added to the hero for that match. */
  bonus: number
  spotted: PatternId[]
  /** What was spotted, as the pre-match card shows it (with player names). */
  notes?: LText[]
}

/** Attribute points per grade (D: nothing learned). */
export const SCOUT_BONUS: Record<string, number> = { S: 4, A: 3, B: 2, C: 1, D: 0 }

/**
 * Reading the game (balance study 2026-10: the video was the same test for
 * every hero, so Anticipation and Vision did nothing). The hero's reading
 * stat — Anticipation, Vision, Positioning (a keeper: GK Positioning) — does
 * two things:
 *  - SLOW-MO: a sharp reader sees the clips slower (1× at 30 .. 1.5× at 90):
 *    more time to answer and a longer full-credit window;
 *  - TAKEAWAY: what he turns the answers into (×0.9 at 30 .. ×1.1 at 90).
 * The played score (right answers, spotted early) × the takeaway = the grade.
 */
export function scoutReading(h: Pick<Hero, 'attrs' | 'position'>): number {
  const a = h.attrs
  return Math.round(h.position === 'GK' ? (a.anticipation + a.gkPositioning + a.vision) / 3 : (a.anticipation + a.vision + a.positioning) / 3)
}
const read01 = (reading: number): number => clamp((reading - 30) / 60, 0, 1)
/** Clip playback slow-down for a reading stat (≥ 1). */
export const scoutSlowMo = (reading: number): number => Math.round((1 + 0.5 * read01(reading)) * 100) / 100
/** Takeaway multiplier for a reading stat. */
export const scoutTakeaway = (reading: number): number => Math.round((0.9 + 0.2 * read01(reading)) * 100) / 100
/** The session's final score: the played score × the takeaway (0..1). */
export const scoutEffective = (performance: number, reading: number): number => Math.round(clamp(clamp(performance, 0, 1) * scoutTakeaway(reading), 0, 1) * 1000) / 1000

const avg = (ps: NpcPlayer[], k: AttributeKey): number => (ps.length ? ps.reduce((a, p) => a + (deriveAttributes(p)[k] ?? 50), 0) / ps.length : 50)
const attr = (p: NpcPlayer | undefined, k: AttributeKey): number => (p ? deriveAttributes(p)[k] ?? 50 : 50)
const is = (set: readonly Position[]) => (p: NpcPlayer): boolean => set.includes(p.position)
const best = (ps: NpcPlayer[], score: (p: NpcPlayer) => number): NpcPlayer | undefined => ps.reduce<NpcPlayer | undefined>((b, p) => (!b || score(p) > score(b) ? p : b), undefined)
const n01 = (v: number, lo: number, hi: number): number => clamp((v - lo) / (hi - lo), 0, 1)

/** The next club opponent's tendencies (null: no club match coming within a week). */
export function scoutingReport(s: GameState): ScoutReport | null {
  const club = heroClub(s)
  const next = nextClubFixture(s)
  if (!club || !next || s.hero.retired) return null
  if (daysUntil(s, next.fixture) > 7) return null
  const oppId = next.fixture.homeId === club.id ? next.fixture.awayId : next.fixture.homeId
  const opp = s.world.clubs[oppId]
  if (!opp) return null
  const squad = squadPlayers(s.world, opp.id)
  const ids = new Set(selectLineupFromPlayers(squad, opp.formation).playerIds)
  const xi = squad.filter((p) => ids.has(p.id))
  const style = opp.style
  const num = (p: NpcPlayer | undefined): number => (p ? 2 + (hashString(p.id) % 30) : 9)
  const who = (p: NpcPlayer | undefined): Pick<Tendency, 'player' | 'number'> => (p ? { player: p.lastName, number: num(p) } : {})
  const out: Tendency[] = []
  // Full-backs: the one who bombs forward (pace, crossing, stamina) and is loose at the back.
  const fbAttack = (p: NpcPlayer): number => (attr(p, 'pace') + attr(p, 'crossing') + attr(p, 'stamina')) / 3 - (attr(p, 'positioning') + attr(p, 'tackling')) / 4
  const lb = best(xi.filter(is(['LB'])), fbAttack)
  const rb = best(xi.filter(is(['RB'])), fbAttack)
  const fb = lb && (!rb || fbAttack(lb) >= fbAttack(rb)) ? { p: lb, id: 'fbLeft' as const } : rb ? { p: rb, id: 'fbRight' as const } : null
  if (fb) out.push({ id: fb.id, strength: n01(fbAttack(fb.p), 20, 50) + (style === 'possession' || style === 'pressing' ? 0.15 : 0), ...who(fb.p) })
  // A target man: heading, jumping, strength.
  const st = best(xi.filter(is(['ST'])), (p) => attr(p, 'heading') + attr(p, 'jumping') + attr(p, 'strength'))
  if (st) out.push({ id: 'longBall', strength: n01((attr(st, 'heading') + attr(st, 'jumping') + attr(st, 'strength')) / 3, 55, 82) + (style === 'direct' ? 0.4 : 0), ...who(st) })
  // High press: work rate and stamina of the XI, or a pressing coach.
  out.push({ id: 'highPress', strength: n01((avg(xi, 'workRate') + avg(xi, 'stamina')) / 2, 55, 80) + (style === 'pressing' ? 0.45 : style === 'defensive' ? -0.3 : 0) })
  // Counter-attacks through the fastest forward.
  const runner = best(xi.filter(is(['LW', 'RW', 'ST'])), (p) => attr(p, 'pace') + attr(p, 'acceleration'))
  if (runner) out.push({ id: 'counter', strength: n01((attr(runner, 'pace') + attr(runner, 'acceleration')) / 2, 60, 88) + (style === 'counter' ? 0.45 : 0), ...who(runner) })
  // Short build-up through the middle.
  out.push({ id: 'shortBuild', strength: n01(avg(xi.filter(is(['CM', 'DM', 'AM'])), 'passing'), 55, 82) + (style === 'possession' ? 0.45 : style === 'direct' ? -0.3 : 0) })
  // Corners to the near post: their best header among the centre-backs.
  const cb = best(xi.filter(is(['CB'])), (p) => attr(p, 'heading') + attr(p, 'jumping'))
  if (cb) out.push({ id: 'cornerNear', strength: n01((attr(cb, 'heading') + attr(cb, 'jumping')) / 2, 55, 85), ...who(cb) })
  // The keeper's penalty side: a stable habit of this keeper.
  const gk = xi.find((p) => p.position === 'GK')
  if (gk) out.push({ id: hashString(`pen:${gk.id}`) % 2 ? 'gkPenLeft' : 'gkPenRight', strength: 0.45 + (hashString(`penS:${gk.id}`) % 30) / 100, ...who(gk) })
  out.sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))
  return { fixtureId: next.fixture.id, oppId, name: opp.name, short: opp.shortName, colors: opp.colors, style, tendencies: out.slice(0, 5) }
}

/** What the player reads on screen for a pattern (with the player's name when known). */
export function patternText(id: PatternId, t?: Pick<Tendency, 'player' | 'number'>): LText {
  const p = t?.player ? { p: t.player } : null
  switch (id) {
    case 'fbLeft':
      return p ? fill(lt('Sol bek ({p}) hücuma çıkıyor, arkasında boşluk kalıyor', 'Their left-back ({p}) pushes up and leaves space behind'), p) : lt('Sol bek hücuma çıkıyor, arkasında boşluk kalıyor', 'Their left-back pushes up and leaves space behind')
    case 'fbRight':
      return p ? fill(lt('Sağ bek ({p}) hücuma çıkıyor, arkasında boşluk kalıyor', 'Their right-back ({p}) pushes up and leaves space behind'), p) : lt('Sağ bek hücuma çıkıyor, arkasında boşluk kalıyor', 'Their right-back pushes up and leaves space behind')
    case 'longBall':
      return p ? fill(lt('Uzun topla uzun boylu forvet {p} aranıyor', 'They play long to their tall striker {p}'), p) : lt('Uzun topla uzun boylu forvet aranıyor', 'They play long to their tall striker')
    case 'gkPenLeft':
      return p ? fill(lt('Kaleci {p} penaltıda soluna atlıyor', 'Keeper {p} dives to his left on penalties'), p) : lt('Kaleci penaltıda soluna atlıyor', 'The keeper dives to his left on penalties')
    case 'gkPenRight':
      return p ? fill(lt('Kaleci {p} penaltıda sağına atlıyor', 'Keeper {p} dives to his right on penalties'), p) : lt('Kaleci penaltıda sağına atlıyor', 'The keeper dives to his right on penalties')
    case 'highPress':
      return lt('Top kaybında önde, yüksek baskı yapıyorlar', 'They press high as soon as they lose the ball')
    case 'cornerNear':
      return p ? fill(lt('Kornerlerde ön direğe, {p} için oynuyorlar', 'On corners they aim for the near post and {p}'), p) : lt('Kornerlerde ön direğe oynuyorlar', 'On corners they aim for the near post')
    case 'counter':
      return p ? fill(lt('Topu kazanınca hızlı kontra: {p} boşluğa koşuyor', 'They break fast when they win it: {p} runs into space'), p) : lt('Topu kazanınca hızlı kontraya çıkıyorlar', 'They break fast when they win the ball')
    case 'shortBuild':
      return lt('Kısa paslarla ortadan oyun kuruyorlar', 'They build through the middle with short passes')
  }
}

/** The opposite habit (a tempting wrong answer). */
export const MIRROR: Partial<Record<PatternId, PatternId>> = { fbLeft: 'fbRight', fbRight: 'fbLeft', gkPenLeft: 'gkPenRight', gkPenRight: 'gkPenLeft' }

/** Grade letter for a 0..1 score (same cut-offs as the training drills). */
export function scoutGrade(p: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  return p >= 0.92 ? 'S' : p >= 0.78 ? 'A' : p >= 0.6 ? 'B' : p >= 0.4 ? 'C' : 'D'
}

/**
 * Store the scouting result for the next match and give the XP. The caller
 * has already run the 'video' activity (time, energy, preparation goal).
 */
export function applyScouting(s: GameState, performance: number, spotted: PatternId[]): { buff: ScoutBuff; xp: { key: AttributeKey; xp: number }[]; lines: LText[]; grade: string; effective: number; reading: number } | null {
  const rep = scoutingReport(s)
  if (!rep) return null
  const reading = scoutReading(s.hero)
  // The grade and everything after it follow the played score × the hero's reading.
  const perf = scoutEffective(performance, reading)
  const grade = scoutGrade(perf)
  const prev = readJson<ScoutBuff | null>(s.life, SCOUT_FLAG, null)
  const keep = prev && prev.fixtureId === rep.fixtureId && prev.performance > perf ? prev : null
  const buff: ScoutBuff = keep ?? { fixtureId: rep.fixtureId, oppId: rep.oppId, grade, performance: Math.round(perf * 1000) / 1000, bonus: SCOUT_BONUS[grade] ?? 0, spotted: [...new Set(spotted)], notes: [...new Set(spotted)].map((id) => patternText(id, rep.tendencies.find((x) => x.id === id))) }
  writeJson(s.life, SCOUT_FLAG, buff)
  const xp = { anticipation: Math.round((1.5 + 3 * perf) * 10) / 10, vision: Math.round((1 + 2 * perf) * 10) / 10 }
  applyXpBundle(s.hero, xp, s.calendar.season)
  const lines: LText[] = [buff.bonus > 0
    ? fill(lt('Rakip analizi: {c} maçında önsezi ve pozisyon alma +{b}.', 'Opponent analysis: anticipation and positioning +{b} against {c}.'), { c: rep.short, b: buff.bonus })
    : lt('Videodan pek bir şey çıkaramadın.', 'You did not get much out of the video.')]
  return { buff, xp: [{ key: 'anticipation', xp: xp.anticipation }, { key: 'vision', xp: xp.vision }], lines, grade, effective: perf, reading }
}

/** The scouting buff for a fixture (null: none). */
export function scoutBuff(s: GameState, fixtureId: string | undefined): ScoutBuff | null {
  if (!fixtureId) return null
  const b = readJson<ScoutBuff | null>(s.life, SCOUT_FLAG, null)
  return b && b.fixtureId === fixtureId && b.bonus > 0 ? b : null
}

/** Attributes the scouting buff raises for the hero's position. */
export function scoutAttrs(position: Position): AttributeKey[] {
  return position === 'GK' ? ['anticipation', 'gkPositioning', 'reflexes'] : ['anticipation', 'positioning']
}
