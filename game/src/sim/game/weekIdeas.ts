/**
 * "What can you do today?" (owner feedback: the week before matchday must feel
 * alive). Two parts:
 *  - The extra 1-on-1 session with a teammate: one day slot, relation with him
 *    and attribute XP in the hero's weakest role stats, scaled by how much
 *    better the partner is.
 *  - `weekIdeas`: 2–3 contextual, rewarding suggestions for the Home card, each
 *    with an action key the UI deep-links into. Ideas only appear when they can
 *    actually be done now (the same blocks the actions check).
 */
import type { AttributeKey, GameState, LText, NpcPlayer } from '../../core/types'
import { absWeek, clamp, fill, heroAge, lt, meter } from '../career/common'
import { developmentAreas } from '../career/attributeLife'
import { applyXpBundle, heroOvr } from '../career/progression'
import { roleIndex } from '../career/squadRole'
import { changeRelation, teammateId } from '../life/relationships'
import { positionGroup } from '../world/attributes'
import { playerDisplayName, squadPlayers } from '../world/queries'
import { activityContext, heroClub, isInSeason, readJson, writeJson } from './internal'
import { reserveMatchBlock } from './match'
import { impressBlock, nextClubFixture, daysUntil, selectionOutlook, talkBlock, type SelectionOutlook } from './selection'

/** life.flags (JSON {wk, n}): 1-on-1 sessions this week. */
export const ONE_ON_ONE_FLAG = 'c:oneOnOne'
export const ONE_ON_ONE_PER_WEEK = 2
export const ONE_ON_ONE_ENERGY = 12
/** Base XP per development area (two areas), before the partner factor. */
export const ONE_ON_ONE_XP = 8

/** The teammate the hero would pair with: the best player of his line (the keeper coach's pick for keepers). */
export function oneOnOnePartner(state: GameState): NpcPlayer | null {
  const club = heroClub(state)
  if (!club) return null
  const h = state.hero
  const grp = positionGroup(h.position)
  const mates = squadPlayers(state.world, club.id).filter((p) => p.injuredWeeks <= 0 && (h.position === 'GK' ? p.position === 'GK' : p.position !== 'GK' && positionGroup(p.position) === grp))
  return mates.sort((a, b) => b.ovr - a.ovr)[0] ?? null
}

const sessionsThisWeek = (state: GameState): number => {
  const r = readJson<{ wk: number; n: number } | null>(state.life, ONE_ON_ONE_FLAG, null)
  return r && r.wk === absWeek(state.calendar) ? r.n : 0
}

/** Why a 1-on-1 cannot happen now (null = it can). */
export function oneOnOneBlock(state: GameState): LText | null {
  const h = state.hero
  if (!h.contract || !heroClub(state)) return lt('Bir kulübün yok.', 'You have no club.')
  if (h.injury) return lt('Sakatken yapamazsın.', "You can't do this while injured.")
  if (state.activeMatchId) return lt('Önce maçını tamamla.', 'Finish your match first.')
  if (state.calendar.slot > 1) return lt('Ek çalışma gündüz yapılır.', 'Extra sessions are held during the day.')
  if (activityContext(state).matchToday) return lt('Maç günü yapılamaz.', 'Not on match day.')
  if (sessionsThisWeek(state) >= ONE_ON_ONE_PER_WEEK) return fill(lt('Bu hafta {n} ek çalışma yaptın.', 'You did {n} extra sessions this week.'), { n: ONE_ON_ONE_PER_WEEK })
  if (state.life.energy < ONE_ON_ONE_ENERGY + 10) return lt('Enerjin yetersiz.', 'Not enough energy.')
  if (!oneOnOnePartner(state)) return lt('Çalışacak bir takım arkadaşın yok.', 'No teammate to work with.')
  return null
}

export interface OneOnOneResult {
  ok: boolean
  lines: LText[]
  partner?: string
  relation?: number
  xp?: { key: AttributeKey; xp: number }[]
}

/**
 * Extra 1-on-1 session: relation +4 with the partner, XP in the two weakest
 * role stats; one day slot. `performance` (0..1) is the played pair drill
 * (game/training passing / keeper drill): 0.6 = the quick session, a perfect
 * drill gives a third more XP and a closer bond, a poor one half the XP.
 */
export function oneOnOne(state: GameState, performance?: number): OneOnOneResult {
  const why = oneOnOneBlock(state)
  if (why) return { ok: false, lines: [why] }
  const { hero, life } = state
  const mate = oneOnOnePartner(state)!
  const name = playerDisplayName(mate, 'short')
  const perf = performance === undefined || !Number.isFinite(performance) ? null : clamp(performance, 0, 1)
  const factor = clamp(1 + (mate.ovr - heroOvr(hero)) / 20, 0.6, 1.5) * (perf === null ? 1 : 0.5 + perf * (5 / 6))
  const areas = developmentAreas(hero).slice(0, 2)
  const bundle: Partial<Record<AttributeKey, number>> = {}
  for (const k of areas) bundle[k] = Math.round(ONE_ON_ONE_XP * factor * 10) / 10
  applyXpBundle(hero, bundle, state.calendar.season)
  const week = absWeek(state.calendar)
  const rel = changeRelation(life, teammateId(mate.id), perf === null ? 4 : Math.round(2 + perf * (10 / 3)), { hero, contact: true, week, cause: 'activity', memory: lt('Seninle birebir çalıştı.', 'Worked one-on-one with you.') })
  life.energy = meter(life.energy - ONE_ON_ONE_ENERGY)
  writeJson(life, ONE_ON_ONE_FLAG, { wk: week, n: sessionsThisWeek(state) + 1 })
  state.calendar.slot = Math.min(2, state.calendar.slot + 1)
  return {
    ok: true, partner: name, relation: rel,
    xp: areas.map((k) => ({ key: k, xp: bundle[k] ?? 0 })),
    lines: [fill(lt('{n} ile birebir çalıştın.', 'You worked one-on-one with {n}.'), { n: name })],
  }
}

// ───────────────────────── Ideas ─────────────────────────

export type IdeaAction = 'impress' | 'reserve' | 'scrimmage' | 'talk' | 'oneOnOne' | 'rest' | 'video' | 'training' | 'teamDinner'
export interface WeekIdea {
  action: IdeaAction
  title: LText
  /** Why it matters now (contextual). */
  why: LText
  /** Concrete reward chip. */
  reward: LText
  /** Attribute the idea trains (UI names it). */
  attr?: AttributeKey
  score: number
}

const pct = (n: number): string => `${n}`

/**
 * 2–3 contextual suggestions for today, best first. Each is doable right now;
 * the reward is the model value where one exists (selection levers).
 */
export function weekIdeas(state: GameState, outlook: SelectionOutlook | null = selectionOutlook(state, (s) => !reserveMatchBlock(s, 'reserve')), max = 3): WeekIdea[] {
  const h = state.hero
  if (h.retired || !h.contract || !heroClub(state)) return []
  const ideas: WeekIdea[] = []
  const lever = (k: string): number => outlook?.levers.find((l) => l.key === k)?.points ?? 0
  const chance = outlook ? Math.round(outlook.chance * 100) : 100
  const benchy = roleIndex(h.contract.role) <= roleIndex('rotation') || chance < 70
  const ctx = activityContext(state)
  const next = nextClubFixture(state)
  const until = next ? daysUntil(state, next.fixture) : null
  const opp = next ? state.world.clubs[next.fixture.homeId === h.contract.clubId ? next.fixture.awayId : next.fixture.homeId] : undefined

  if (!impressBlock(state) && lever('impress') > 0) {
    ideas.push({
      action: 'impress', score: 60 + lever('impress') + (benchy ? 20 : 0),
      title: lt('Hocanın sınavı', 'The coach’s challenge'),
      why: lt('Bir antrenmanda A notu hedefle. Tutturursan hoca seni ilk 11 için not eder.', 'Aim for an A grade in one drill. Hit it and the coach pencils you in.'),
      reward: fill(lt('İlk 11 şansı +%{n}', 'Start chance +{n}%'), { n: pct(lever('impress')) }),
    })
  }
  if (!reserveMatchBlock(state, 'reserve')) {
    ideas.push({
      action: 'reserve', score: 55 + (h.sharpness < 60 ? 25 : 0) + (benchy ? 15 : 0),
      title: lt('U21 maçına çık', 'Play for the U21s'),
      why: h.sharpness < 60
        ? lt('Maç temposun düşük. 45 dakika oyna, sahada kendini göster.', 'Your match sharpness is low. Play 45 minutes and show yourself.')
        : lt('45 dakikalık maç: dakika, maç temposu ve hocanın gözü.', 'A 45-minute game: minutes, sharpness and the coach watching.'),
      reward: lever('reserve') > 0 ? fill(lt('7.5+ reyting: ilk 11 şansı +%{n}', '7.5+ rating: start chance +{n}%'), { n: pct(lever('reserve')) }) : lt('Maç temposu +6', 'Sharpness +6'),
    })
  } else if (!reserveMatchBlock(state, 'scrimmage')) {
    ideas.push({
      action: 'scrimmage', score: 35 + (h.sharpness < 60 ? 20 : 0),
      title: lt('Çift kale antrenman maçı', 'Training match'),
      why: lt('B takımıyla A takımına karşı 30 dakika: ilk 11\'e kendini göster.', '30 minutes for the B team against the first XI: show them.'),
      reward: lt('Maç temposu +4 · güven', 'Sharpness +4 · trust'),
    })
  }
  if (!talkBlock(state) && lever('talk') > 0 && chance < 85) {
    ideas.push({
      action: 'talk', score: 40 + lever('talk') * 2 + ((state.life.flags.bench_streak as number) >= 2 ? 15 : 0),
      title: lt('Teknik direktörle konuş', 'Talk to the manager'),
      why: lt('Forma için ne yapman gerektiğini sor. Kapısını çalan oyuncuyu hatırlar.', 'Ask what it takes to play. He remembers the players who knock on his door.'),
      reward: fill(lt('İlk 11 şansı +%{n}', 'Start chance +{n}%'), { n: pct(lever('talk')) }),
    })
  }
  const partner = !oneOnOneBlock(state) ? oneOnOnePartner(state) : null
  if (partner) {
    const area = developmentAreas(h)[0]
    ideas.push({
      action: 'oneOnOne', score: 38 + (heroAge(h, state.calendar.season) <= 21 ? 8 : 0),
      title: fill(lt('{n} ile birebir çalış', 'One-on-one with {n}'), { n: playerDisplayName(partner, 'short') }),
      why: lt('Zayıf yönünü hattının en iyisiyle çalış.', 'Work on your weak spot with the best in your line.'),
      ...(area ? { attr: area } : {}),
      reward: lt('İlişki +4 · özellik XP', 'Relation +4 · attribute XP'),
    })
  }
  if (h.fatigue > 60 && !ctx.matchToday) {
    ideas.push({
      action: 'rest', score: 50 + (h.fatigue - 60),
      title: lt('Dinlen', 'Rest'),
      why: lt('Yorgunluğun ilk 11 şansını düşürüyor.', 'Your fatigue is costing you the shirt.'),
      reward: lever('rest') > 0 ? fill(lt('İlk 11 şansı +%{n}', 'Start chance +{n}%'), { n: pct(lever('rest')) }) : lt('Yorgunluk −8', 'Fatigue −8'),
    })
  }
  if (until !== null && until <= 2 && until >= 0 && opp && isInSeason(state.calendar.week)) {
    ideas.push({
      action: 'video', score: 30,
      title: fill(lt('{c} maçını incele', 'Study {c}'), { c: opp.shortName }),
      why: lt('Video analiz: rakibi tanı, hocayla ilişkin de ısınır.', 'Video analysis: know the opponent, and the manager notices.'),
      reward: lt('Taktik XP · hoca +1', 'Tactical XP · manager +1'),
    })
  }
  if (ctx.calendar.slot <= 1 && !ctx.matchToday) {
    ideas.push({
      action: 'training', score: 25 + (benchy ? 10 : 0),
      title: lt('Antrenmanda göz doldur', 'Shine in training'),
      why: lt('A ve S notları hocanın güvenini artırır.', 'A and S grades build the manager’s trust.'),
      reward: lever('drill') > 0 ? fill(lt('S notu: ilk 11 şansı +%{n}', 'S grade: start chance +{n}%'), { n: pct(lever('drill')) }) : lt('Özellik XP', 'Attribute XP'),
    })
  }
  if (ctx.calendar.slot === 2 && !ctx.matchTomorrow && (state.life.relationships.teammates?.value ?? 0) < 30) {
    ideas.push({
      action: 'teamDinner', score: 28,
      title: lt('Takım yemeği', 'Team dinner'),
      why: lt('Soyunma odasıyla bağın zayıf; sahada pas da buna göre gelir.', 'Your bond with the dressing room is weak, and the passes show it.'),
      reward: lt('Takım arkadaşları +', 'Teammates +'),
    })
  }
  return ideas.sort((a, b) => b.score - a.score).slice(0, max)
}

