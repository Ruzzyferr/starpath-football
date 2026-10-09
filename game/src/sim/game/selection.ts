/**
 * Path off the bench (owner feedback: "we are always on the bench").
 *
 * The squad-role model (career/squadRole) only sees the hero; the match
 * context lives here, in the world layer:
 *  - `selectionTerms`: what the next fixture adds to the start chance — early
 *    cup rounds and dead rubbers for youngsters, injured/suspended rivals for
 *    the shirt, fixture congestion (rotation), the coach's challenge and a
 *    good reserve-team run-out. The selection roll (sim/game/match) adds the
 *    same sum, so every number the UI shows is the real model.
 *  - Minutes drought: after {@link CAMEO_AFTER} matchdays without minutes the
 *    manager plans a cameo (60–74', see MatchSetup.heroEntryMinute).
 *  - `selectionOutlook`: chance + concrete levers, each evaluated by running
 *    `startProbability` on a copy with the lever applied.
 *  - Weekly actions: talk to the manager, the "impress the coach" challenge.
 */
import type { Competition, Fixture, GameState, Hero, LText, Life, SquadRole } from '../../core/types'
import { DAYS_PER_WEEK } from '../../core/config'
import { absWeek, clamp, fill, heroAge, lt, meter } from '../career/common'
import { heroOvr } from '../career/progression'
import { MANAGER_REL, changeTrust, roleIndex, startProbability, trainingTrustRaw } from '../career/squadRole'
import { changeRelation } from '../life/relationships'
import { positionGroup } from '../world/attributes'
import { finalRound } from '../world/competitions'
import { playerDisplayName, seasonCompetitions, squadPlayers } from '../world/queries'
import { absDayOf, heroClub, heroFixtureOn, isInSeason, readJson, writeJson, type HeroFixture } from './internal'
import { PREP_SELECTION, SKIPPED_TRAINING_SELECTION, agendaSelection } from './agenda'

/** Matchdays in a row without minutes after which the manager plans a cameo. */
export const CAMEO_AFTER = 2
/** life.flags: consecutive available club matchdays without minutes. */
export const DRY_FLAG = 'c:dryMatches'
/** life.flags (JSON {@link ImpressRecord}): the coach's challenge since the last club match. */
export const IMPRESS_FLAG = 'c:impress'
/** life.flags (JSON {@link ReserveRecord}): the latest reserve / training match since the last club match. */
export const RESERVE_FLAG = 'c:reserve'
/** life.flags: absolute week of the last talk with the manager. */
export const TALK_FLAG = 'c:talkWeek'

/** Start-chance effect of a passed / failed coach's challenge. */
export const IMPRESS_BONUS = 0.1
export const IMPRESS_FAIL = -0.02
/** Grade (performance) the challenge asks for: an A. */
export const IMPRESS_TARGET = 0.78
/** Trust a talk with the manager earns (before diminishing returns). */
export const TALK_TRUST = 2.5

export interface ImpressRecord { day: number; ok: boolean; grade: string }
export interface ReserveRecord { day: number; rating: number; minutes: number; kind: 'reserve' | 'scrimmage' }

/** Matchdays without minutes after which the manager starts leaning toward a start, and by how much. */
export const DROUGHT_START_AFTER = 3
export const DROUGHT_START = 0.3
/** Keepers get no cameos: their drought counts from {@link CAMEO_AFTER} and weighs more. */
export const DROUGHT_START_GK = 0.5

export type SelectionKey = 'prep' | 'skippedTraining' | 'drought' | 'cup' | 'deadRubber' | 'rivalsOut' | 'congestion' | 'impress' | 'reserveForm'
export interface SelectionTerm {
  key: SelectionKey
  /** Start-chance change (0..1 scale). */
  value: number
  label: LText
}

const pts = (v: number): number => Math.round(v * 100)

/** Roles that are still fighting for a shirt. */
const fighting = (role: SquadRole | undefined): boolean => !!role && roleIndex(role) <= roleIndex('rotation')

/** Absolute day of a fixture of the current season. */
const fixtureDay = (state: GameState, f: Fixture): number => (state.calendar.season * 100 + f.week) * DAYS_PER_WEEK + f.day

/** The hero's next unplayed club fixture (today included), or null. */
export function nextClubFixture(state: GameState, skipId?: string | null): HeroFixture | null {
  const club = heroClub(state)
  if (!club) return null
  const cal = state.calendar
  let best: HeroFixture | null = null
  for (const comp of seasonCompetitions(state.world, cal.season)) {
    if (comp.type === 'international') continue
    for (const f of comp.fixtures) {
      if (f.result || f.id === skipId || (f.homeId !== club.id && f.awayId !== club.id)) continue
      if (f.week < cal.week || (f.week === cal.week && f.day < cal.day)) continue
      if (!best || f.week < best.fixture.week || (f.week === best.fixture.week && f.day < best.fixture.day)) best = { competition: comp, fixture: f }
    }
  }
  return best
}

/** Days until a fixture of the current season. */
export const daysUntil = (state: GameState, f: Fixture): number => (f.week - state.calendar.week) * DAYS_PER_WEEK + f.day - state.calendar.day

/** League position facts: can the result still change anything that matters? */
function deadRubber(comp: Competition, clubId: string, f: Fixture): boolean {
  if (comp.type !== 'league' || !comp.table?.length) return false
  const rounds = comp.fixtures.reduce((a, x) => Math.max(a, x.round), 0)
  if (rounds <= 0 || f.round < rounds * 0.75) return false
  const table = [...comp.table].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga))
  const i = table.findIndex((r) => r.clubId === clubId)
  if (i < 0) return false
  const row = table[i]!
  const left = Math.max(0, rounds - row.p)
  const swing = 3 * left
  const n = table.length
  const champion = i === 0 && row.pts - (table[1]?.pts ?? 0) > swing
  const top4 = table[Math.min(3, n - 1)]!.pts
  const dropLine = table[Math.max(0, n - 3)]!.pts
  const midTable = row.pts + swing < top4 && row.pts - dropLine > swing && i < n - 3
  return champion || midTable
}

/** Context terms for a club fixture (empty for internationals or without a club). */
export function selectionTerms(state: GameState, ref: HeroFixture | null): SelectionTerm[] {
  const h = state.hero
  const club = heroClub(state)
  if (!ref || ref.national || !club || !h.contract) return []
  const out: SelectionTerm[] = []
  const role = h.contract.role
  const age = heroAge(h, state.calendar.season)
  const young = age <= 21
  const gk = h.position === 'GK'
  const { competition: comp, fixture: f } = ref
  if (fighting(role)) {
    // Early cup rounds: the manager rests regulars and looks at the kids (the cup keeper is a tradition).
    if (comp.type === 'cup' && f.round / Math.max(1, finalRound(comp)) <= 0.5 && (young || gk)) {
      out.push({ key: 'cup', value: gk ? 0.35 : 0.22, label: gk ? lt('Kupa maçlarında genç kaleciye şans verilir.', 'Early cup rounds are for the cup keeper.') : lt('Kupanın erken turu: hoca gençlere şans veriyor.', 'Early cup round: the manager gives the youngsters a chance.') })
    }
    // A long drought (keepers get no cameos): the manager owes the hero a start.
    const dry = dryMatches(state.life)
    if (dry >= (gk ? CAMEO_AFTER : DROUGHT_START_AFTER)) out.push({ key: 'drought', value: gk ? DROUGHT_START_GK : DROUGHT_START, label: fill(lt('{n} maçtır süre almadın: hoca sana bir şans borçlu.', 'No minutes in {n} games: the manager owes you a chance.'), { n: dry }) })
    if (young && deadRubber(comp, club.id, f)) out.push({ key: 'deadRubber', value: 0.18, label: lt('Ligde hedef kalmadı: gençler denenecek.', 'Nothing left to play for: the youngsters get a look.') })
    // Rivals for the shirt who are out (same line, at least as good).
    const ovr = heroOvr(h)
    const grp = positionGroup(h.position)
    const out1 = squadPlayers(state.world, club.id)
      .filter((p) => (gk ? p.position === 'GK' : p.position !== 'GK' && positionGroup(p.position) === grp) && p.ovr >= ovr - 2 && (p.injuredWeeks > 0 || (p.suspendedMatches ?? 0) > 0))
      .sort((a, b) => b.ovr - a.ovr)
    if (out1.length) {
      const name = playerDisplayName(out1[0]!, 'short')
      const v = Math.min(0.18, 0.06 * out1.length)
      out.push({
        key: 'rivalsOut', value: v,
        label: out1.length === 1
          ? { tr: `Mevki rakibin ${name} yok (sakat/cezalı).`, en: `Your rival for the shirt, ${name}, is out (injured/banned).` }
          : { tr: `${out1.length} mevki rakibin yok (${name} dahil).`, en: `${out1.length} rivals for your shirt are out (${name} among them).` },
      })
    }
    // Fixture congestion: a second game within 3 days means rotation.
    const day = fixtureDay(state, f)
    let prev = -Infinity
    for (const c of seasonCompetitions(state.world, state.calendar.season)) {
      if (c.type === 'international') continue
      for (const x of c.fixtures) {
        if (x.id === f.id || (x.homeId !== club.id && x.awayId !== club.id)) continue
        const d = fixtureDay(state, x)
        if (d < day && d > prev) prev = d
      }
    }
    if (day - prev <= 3) out.push({ key: 'congestion', value: 0.08, label: lt('Yoğun fikstür: hoca rotasyona gidecek.', 'Fixture pile-up: the manager will rotate.') })
  }
  // Daily agenda (sim/game/agenda): preparation goals done for this opponent, compulsory training skipped.
  const ag = agendaSelection(state, f.id)
  if (ag.prep > 0) out.push({ key: 'prep', value: PREP_SELECTION * ag.prep, label: fill(lt('Bu rakibe {n} hazırlık yaptın.', 'You did {n} preparation(s) for this opponent.'), { n: ag.prep }) })
  if (ag.skipped) out.push({ key: 'skippedTraining', value: SKIPPED_TRAINING_SELECTION, label: lt('Zorunlu antrenmanı kaçırdın.', 'You skipped compulsory training.') })
  const imp = readJson<ImpressRecord | null>(state.life, IMPRESS_FLAG, null)
  if (imp) out.push(imp.ok
    ? { key: 'impress', value: IMPRESS_BONUS, label: fill(lt('Hocayı etkiledin ({g} notu).', 'You impressed the coach ({g} grade).'), { g: imp.grade }) }
    : { key: 'impress', value: IMPRESS_FAIL, label: lt('Hocanın sınavında hedefi tutturamadın.', 'You missed the coach’s target.') })
  const res = readJson<ReserveRecord | null>(state.life, RESERVE_FLAG, null)
  if (res) {
    const v = res.rating >= 7.5 ? 0.06 : res.rating >= 6.8 ? 0.03 : res.rating < 5.8 ? -0.03 : 0
    if (v !== 0) {
      const what = res.kind === 'reserve' ? { tr: 'U21 maçında', en: 'in the U21 game' } : { tr: 'çift kalede', en: 'in the training match' }
      out.push({ key: 'reserveForm', value: v, label: { tr: `${what.tr} ${res.rating.toFixed(1)} reyting.`, en: `${res.rating.toFixed(1)} rating ${what.en}.` } })
    }
  }
  return out
}

export const termsTotal = (terms: readonly SelectionTerm[]): number => terms.reduce((a, t) => a + t.value, 0)

/** Absolute day the selection for a fixture is made (the match day). */
const selectionDay = (state: GameState, ref: HeroFixture): number => absDayOf(state) + Math.max(0, daysUntil(state, ref.fixture))

// ───────────────────────── Minutes drought ─────────────────────────

export const dryMatches = (life: Life): number => (typeof life.flags[DRY_FLAG] === 'number' ? life.flags[DRY_FLAG] as number : 0)

/** True when the next club match on the bench comes with a planned cameo. */
export const cameoDue = (state: GameState): boolean => dryMatches(state.life) >= CAMEO_AFTER

/** After a club match: drought bookkeeping and the one-match bonuses expire. */
export function afterClubMatch(life: Life, minutes: number): void {
  life.flags[DRY_FLAG] = minutes > 0 ? 0 : dryMatches(life) + 1
  writeJson(life, IMPRESS_FLAG, null)
  writeJson(life, RESERVE_FLAG, null)
}

// ───────────────────────── Weekly actions ─────────────────────────

export const talkedThisWeek = (state: GameState): boolean => state.life.flags[TALK_FLAG] === absWeek(state.calendar)

/** Can the hero ask the manager for a word this week? Null = yes, else why not. */
export function talkBlock(state: GameState): LText | null {
  if (!state.hero.contract || !heroClub(state)) return lt('Bir kulübün yok.', 'You have no club.')
  if (talkedThisWeek(state)) return lt('Bu hafta zaten konuştunuz.', 'You already talked this week.')
  return null
}

/** Trust a talk would earn right now (manager relation below −20: he barely listens). */
const talkTrust = (life: Life): number => ((life.relationships[MANAGER_REL]?.value ?? 0) < -20 ? 0.5 : TALK_TRUST)

/**
 * Ask the manager what it takes to play: trust +2.5 (diminishing), relation +2,
 * and his honest advice — the strongest thing holding the hero back.
 */
export function talkToManager(state: GameState): { ok: boolean; lines: LText[] } {
  const why = talkBlock(state)
  if (why) return { ok: false, lines: [why] }
  const { hero, life } = state
  changeTrust(hero, talkTrust(life))
  changeRelation(life, MANAGER_REL, 2, { memory: lt('Forma için ne yapman gerektiğini sordun.', 'You asked what it takes to play.'), week: absWeek(state.calendar) })
  life.flags[TALK_FLAG] = absWeek(state.calendar)
  const tip = hero.fatigue > 60
    ? lt('"Yorgunsun. Dinlen, sonra konuşalım."', '"You look tired. Rest, then we talk."')
    : hero.sharpness < 40
      ? lt('"Maç temposu lazım. U21 maçında oyna, kendini göster."', '"You need match sharpness. Play for the U21s and show me."')
      : hero.form < 45
        ? lt('"Formun düştü. Antrenmanda A notu görmek istiyorum."', '"Your form has dipped. I want to see A grades in training."')
        : lt('"Kapım açık. Antrenmanda göz doldur, şansın gelecek."', '"My door is open. Shine in training and your chance will come."')
  return { ok: true, lines: [lt('Teknik direktörle konuştun.', 'You talked to the manager.'), tip] }
}

/** Can the coach's challenge be taken now? Null = yes. */
export function impressBlock(state: GameState): LText | null {
  const h = state.hero
  if (!h.contract || !heroClub(state)) return lt('Bir kulübün yok.', 'You have no club.')
  if (!isInSeason(state.calendar.week)) return lt('Sezon dışında hoca sınav yapmaz.', 'No challenges in the off-season.')
  if (h.injury) return lt('Sakatken yapamazsın.', "You can't do this while injured.")
  if (readJson<ImpressRecord | null>(state.life, IMPRESS_FLAG, null)) return lt('Bu maç için sınavını verdin.', 'You already took the challenge before this match.')
  if (state.calendar.slot > 1) return lt('Sınav gündüz yapılır.', 'The challenge is held during the day.')
  const today = heroFixtureOn(state, state.calendar.week, state.calendar.day)
  if (today && !today.fixture.result) return lt('Maç günü yapılamaz.', 'Not on match day.')
  return null
}

/** Record the challenge drill result (the drill itself is a normal training session). */
export function resolveImpress(state: GameState, performance: number, grade: string): { ok: boolean; passed: boolean; lines: LText[] } {
  const why = impressBlock(state)
  if (why) return { ok: false, passed: false, lines: [why] }
  const passed = performance >= IMPRESS_TARGET
  writeJson(state.life, IMPRESS_FLAG, { day: absDayOf(state), ok: passed, grade } satisfies ImpressRecord)
  if (passed) changeRelation(state.life, MANAGER_REL, 2, { memory: lt('Antrenmandaki sınavını geçtin.', 'You passed his training challenge.'), week: absWeek(state.calendar) })
  else state.hero.morale = meter(state.hero.morale - 2)
  return {
    ok: true, passed,
    lines: [passed
      ? fill(lt('Hocayı etkiledin: ilk 11 şansın +%{n}.', 'You impressed the coach: start chance +{n}%.'), { n: pts(IMPRESS_BONUS) })
      : fill(lt('Hedef A notuydu, {g} aldın. Bir dahakine.', 'The target was an A, you got {g}. Next time.'), { g: grade })],
  }
}

// ───────────────────────── Outlook (meter + levers) ─────────────────────────

export type LeverKey = 'impress' | 'drill' | 'talk' | 'rest' | 'reserve'
export interface SelectionLever {
  key: LeverKey
  /** Start-chance change in percentage points if the lever is pulled (model-evaluated). */
  points: number
  label: LText
}

export interface SelectionOutlook {
  /** Start chance at the next club match (0..1), with today's context. */
  chance: number
  fixtureId: string | null
  daysUntil: number | null
  terms: SelectionTerm[]
  levers: SelectionLever[]
  /** Consecutive club matchdays without minutes. */
  dry: number
  /** The next match on the bench comes with a planned cameo. */
  cameoDue: boolean
  role: SquadRole | null
}

/** Copies of the two objects the selection model reads. */
const cloneHL = (hero: Hero, life: Life): { hero: Hero; life: Life } => ({ hero: structuredClone(hero), life: structuredClone(life) })

/** Is a reserve / training match on offer this week (see reserveMatch.ts)? Injected to avoid an import cycle. */
export type ReserveCheck = (state: GameState) => boolean

export function selectionOutlook(state: GameState, reserveOpen: ReserveCheck = () => false, skipId?: string | null): SelectionOutlook | null {
  const h = state.hero
  if (!h.contract || !heroClub(state)) return null
  const ref = nextClubFixture(state, skipId)
  const terms = selectionTerms(state, ref)
  const extra = termsTotal(terms)
  const day = ref ? selectionDay(state, ref) : absDayOf(state)
  const p0 = startProbability(h, state.life, day, extra)
  const levers: SelectionLever[] = []
  const unavailable = !!h.injury || h.suspendedMatches > 0
  const delta = (fn: (x: { hero: Hero; life: Life }) => number | void): number => {
    const c = cloneHL(h, state.life)
    const add = fn(c) ?? 0
    return pts(startProbability(c.hero, c.life, day, extra + add) - p0)
  }
  if (!unavailable) {
    if (!impressBlock(state)) {
      const n = delta((c) => { changeTrust(c.hero, trainingTrustRaw(c.hero, 0.9)); return IMPRESS_BONUS })
      levers.push({ key: 'impress', points: n, label: fill(lt('Hocanın sınavında A notu: +%{n}', 'Pass the coach’s challenge (A grade): +{n}%'), { n }) })
    }
    if (isInSeason(state.calendar.week)) {
      const n = delta((c) => { changeTrust(c.hero, trainingTrustRaw(c.hero, 0.95)) })
      levers.push({ key: 'drill', points: n, label: fill(lt('Antrenmanda S notu: +%{n}', 'S grade in training: +{n}%'), { n }) })
    }
    if (!talkBlock(state)) {
      const n = delta((c) => { changeTrust(c.hero, talkTrust(c.life)) })
      levers.push({ key: 'talk', points: n, label: fill(lt('Teknik direktörle konuş: +%{n}', 'Talk to the manager: +{n}%'), { n }) })
    }
    if (h.fatigue > 60) {
      const n = delta((c) => { c.hero.fatigue = clamp(c.hero.fatigue - 16, 0, 100) })
      levers.push({ key: 'rest', points: n, label: fill(lt('Bir gün dinlen (yorgunluk −16): +%{n}', 'Rest a day (fatigue −16): +{n}%'), { n }) })
    }
    if (reserveOpen(state) && !readJson<ReserveRecord | null>(state.life, RESERVE_FLAG, null)) {
      const n = delta(() => 0.06)
      levers.push({ key: 'reserve', points: n, label: fill(lt('U21 maçında 7.5+ reyting: +%{n}', '7.5+ rating in a U21 game: +{n}%'), { n }) })
    }
  }
  return {
    chance: p0, fixtureId: ref?.fixture.id ?? null, daysUntil: ref ? daysUntil(state, ref.fixture) : null,
    terms, levers: levers.filter((l) => l.points >= 1).sort((a, b) => b.points - a.points),
    dry: dryMatches(state.life), cameoDue: cameoDue(state), role: h.contract.role,
  }
}
