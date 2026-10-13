/**
 * Live hero match: drives the real MatchSim minute by minute on a ticker,
 * publishes LiveMatchView through the `match` signal, pauses on highlights
 * (sim or play them in the Phaser scene via highlightBridge), finalises the
 * match through finishHeroMatch and builds the post-match record (stats,
 * deltas, interview) that `data.postMatch()` shows.
 */
import { Rng, clamp, hashString } from '../../core/rng'
import type { Competition, Fixture, GameState, LText, NpcPlayer } from '../../core/types'
import { worldGender } from '../../core/gender'
import { customMomentOverrides } from '../../core/customDifficulty'
import { currentLang } from '../../i18n'
import {
  GFLAG, HERO_ID, answerInterview, clearActiveMatch, finishHeroMatch, interviewFor, saveMatchProgress, startHeroMatch, resumeHeroMatch,
  type InterviewDef, type InterviewEffect, type InterviewTone,
} from '../../sim/game'
import { heroClub, readJson, weekCounters, writeJson } from '../../sim/game/internal'
import { incomeTaxRate } from '../../sim/life/economy'
import { matchEarnings, type MatchBonuses, type MatchEarnings } from '../../sim/career/matchPay'
import { HIGHLIGHT_PROMPTS, MatchSim, RATING_BASE, assignSlots, type EngineState, type MatchEvent, type MatchPlayer, type MatchSetup, type MatchSnapshot, type MatchTeam, type Side } from '../../sim/match'
import { formationSlots } from '../../sim/match/formations'
import { radarShape, type RadarSlot } from './radarShape'
import { pickKeyPlayer, playerDisplayName, seasonCompetitions } from '../../sim/world/queries'
import { match, settings } from '../store'
import type {
  Delta, FixtureView, HeroMatchStatsView, InterviewOption, LineupPlayer, LiveMatchView, MatchEventView, PassNetView, PostMatchView, PreMatchView,
} from '../store'
import { RELATION_LABEL, diffSnapshots, fixtureView, snapshot } from './mapping'
import { playHighlight, type HighlightSession } from './highlightBridge'
import { matchupViewOf } from './matchupView'
import { celebrationForMatch } from './celebration'
import { isEveningFixture } from '../../game/presentation'
import { matchExpectations } from '../../sim/game/objectives'
import { buildPassNetView, buildRelationChanges, buildTrustReasons, expectedMomentsFor, heroMapView, ratingLogView, relationValues, withBuildUpFallback } from './postMatch'
import { commit, current, get, notify } from './session'
import { scheduleAutosave } from './persistence'
import { DECISION_SECONDS, decisionDef, pickDecision, resolveDecision, type DecisionDef, type DecisionKind } from '../../sim/match/decisions'
import { DECISION_FLAG, applyPendingDecisions, pendingDecisions, recordDecision } from '../../sim/game/matchDecisions'
import { markedMan, preMatchCauses, type ReserveMatchMeta } from '../../sim/game/match'
import { heroOvr } from '../../sim/career/progression'
import { resolveMatchKits } from '../../core/kitContrast'

/** Live text-feed speeds (2.2#106: 0.5x–4x). */
export type MatchSpeed = 0.5 | 1 | 2 | 4

/** Milliseconds per simulated minute by speed. */
export const MS_PER_MINUTE: Record<MatchSpeed, number> = { 0.5: 1200, 1: 600, 2: 300, 4: 150 }

/** Prepared-match blob as stored by sim/game/match.ts (fields we read). */
interface MatchBlob {
  fixtureId: string
  compId: string
  setup: MatchSetup
  starts: boolean
  sim?: string
  /** Reserve / training match (sim/game/match prepareReserveMatch): no fixture behind it. */
  reserve?: ReserveMatchMeta
}

export const POST_FLAG = 'g:post'

/** Persisted post-match record (JSON in life.flags). */
interface PostRecord {
  view: Omit<PostMatchView, 'interview'>
  interview: InterviewDef | null
  answered: InterviewTone | null
}

interface Live {
  sim: MatchSim
  fixtureId: string
  fixture: FixtureView
  setup: MatchSetup
  heroSide: Side
  speed: MatchSpeed
  paused: boolean
  momentActive: boolean
  timer: ReturnType<typeof setInterval> | null
  session: HighlightSession | null
  lastSaved: number
  finalized: boolean
  /** In-match decision window currently open (match paused), 2.4#36/#52/#99. */
  decision: DecisionDef | null
  decisionMinute: number
}

let live: Live | null = null

// ───────────────────────── Views ─────────────────────────

/** View of a reserve / training match (not a fixture of any competition). */
function reserveFixture(s: GameState, fixtureId: string, meta: ReserveMatchMeta): FixtureView {
  const comp: Competition = {
    id: 'reserve', type: 'league', name: meta.name, season: s.calendar.season, countryId: null, leagueId: null, participantIds: [], fixtures: [],
    table: null, alive: null, winnerId: null,
  }
  const f: Fixture = { id: fixtureId, compId: 'reserve', round: 0, week: s.calendar.week, day: s.calendar.day, homeId: meta.homeId, awayId: meta.awayId, result: null }
  const v = fixtureView(s, comp, f, s.hero.contract?.clubId ?? null)
  return { ...v, compType: 'friendly', isHome: true, venue: currentLang.value === 'tr' ? 'Antrenman tesisleri' : 'Training ground' }
}

/** Fixture view of the active match: a real fixture, or the reserve / training match stored in the blob. */
function activeFixture(s: GameState, fixtureId: string, blob: MatchBlob | null): FixtureView | null {
  return findFixture(s, fixtureId) ?? (blob?.reserve && blob.fixtureId === fixtureId ? reserveFixture(s, fixtureId, blob.reserve) : null)
}

function findFixture(s: GameState, fixtureId: string): FixtureView | null {
  const clubId = s.hero.contract?.clubId ?? null
  for (const season of [s.calendar.season, s.calendar.season + 1]) {
    for (const comp of seasonCompetitions(s.world, season)) {
      const f = comp.fixtures.find((x) => x.id === fixtureId)
      if (f) return fixtureView(s, comp, f, clubId)
    }
  }
  return null
}

function heroStatsView(snap: MatchSnapshot): HeroMatchStatsView {
  const h = snap.heroStats
  return {
    minutes: h.minutes, goals: h.goals, assists: h.assists, shots: h.shots, shotsOnTarget: h.shotsOnTarget, passes: h.passes,
    passesCompleted: h.passesCompleted, tackles: h.tackles, dribbles: h.dribbles, saves: h.saves,
    rating: Number.isFinite(h.rating) ? h.rating : 0,
  }
}

const eventView = (e: MatchEvent): MatchEventView => ({
  minute: e.minute, type: e.type, side: e.side, text: e.text, score: [e.score[0], e.score[1]],
  isHero: e.playerId === HERO_ID || e.assistId === HERO_ID || e.type === 'highlight' ? true : undefined,
})

/** Notable snub for the live hub: the lowest-relation team-mate who has not fed the hero (needs a few minutes of play). */
function snubOf(l: Live, snap: MatchSnapshot): { snub?: NonNullable<LiveMatchView['snub']> } {
  if (!snap.heroOnPitch || snap.minute < 15 || snap.finished) return {}
  const team = l.heroSide === 'home' ? l.setup.home : l.setup.away
  let worst: MatchPlayer | null = null
  for (const p of team.lineup) {
    if (p.isHero || p.relationToHero > -25 || (snap.passNet?.[p.id]?.from ?? 0) > 0) continue
    if (!worst || p.relationToHero < worst.relationToHero) worst = p
  }
  return worst ? { snub: { id: worst.id, name: worst.name, relation: Math.round(worst.relationToHero) } } : {}
}

/** Radar slots per team (formation slot of each starter), cached per match setup. */
const radarSlotCache = new WeakMap<MatchSetup, { home: RadarSlot[]; away: RadarSlot[] }>()
function radarSlots(setup: MatchSetup): { home: RadarSlot[]; away: RadarSlot[] } {
  const hit = radarSlotCache.get(setup)
  if (hit) return hit
  const of = (team: MatchTeam): RadarSlot[] => {
    const slots = formationSlots(team.formation)
    const idx = assignSlots(team.lineup, team.formation)
    return team.lineup.slice(0, 11).map((p, i) => {
      const sl = slots[idx[i]!] ?? slots[i] ?? { x: 30, y: 34 }
      return { id: p.id, number: p.number, x: sl.x, y: sl.y, isHero: p.isHero || undefined, isKeeper: p.position === 'GK' }
    })
  }
  const v = { home: of(setup.home), away: of(setup.away) }
  radarSlotCache.set(setup, v)
  return v
}

/** Display names by player id for both squads (lineups and benches). */
function playerNames(l: Live): Record<string, string> {
  const names: Record<string, string> = {}
  for (const p of [...l.setup.home.lineup, ...l.setup.home.bench, ...l.setup.away.lineup, ...l.setup.away.bench]) names[p.id] = p.name
  return names
}

/** How the hero is named on the pitch and on the matchup card. */
function heroDisplayName(): string {
  const h = get().hero
  return h.nickname || h.lastName
}

function liveView(l: Live): LiveMatchView {
  const snap = l.sim.snapshot()
  const hl = snap.pendingHighlight
  const lang = currentLang.value
  const seed = hashString(l.fixtureId) % 97
  return {
    fixture: l.fixture,
    minute: snap.minute,
    score: [snap.score[0], snap.score[1]],
    possession: [snap.possession[0], snap.possession[1]],
    shots: [snap.shots[0], snap.shots[1]],
    shotsOnTarget: [snap.shotsOnTarget[0] ?? 0, snap.shotsOnTarget[1] ?? 0],
    events: snap.events.map(eventView),
    ballX: clamp(Number.isFinite(snap.ballX) ? snap.ballX : 0.5, 0.02, 0.98),
    // The engine tracks the ball along the pitch only; sway it across for the radar.
    ballY: clamp(0.5 + 0.32 * Math.sin(snap.minute * 0.83 + snap.events.length * 0.61 + seed), 0.08, 0.92),
    radar: (() => {
      const ballX = clamp(Number.isFinite(snap.ballX) ? snap.ballX : 0.5, 0.02, 0.98)
      const ballY = clamp(0.5 + 0.32 * Math.sin(snap.minute * 0.83 + snap.events.length * 0.61 + seed), 0.08, 0.92)
      const r = radarShape({ ...radarSlots(l.setup), ballX, ballY, minute: snap.minute })
      // A benched hero is not on the pitch: no gold dot.
      if (!snap.heroOnPitch) for (const p of [...r.home, ...r.away]) delete p.isHero
      return r
    })(),
    phase: snap.phase,
    heroOnPitch: snap.heroOnPitch,
    heroSide: l.heroSide,
    heroStats: heroStatsView(snap),
    pendingMoment: hl ? { id: hl.id, minute: hl.minute, kind: hl.kind, prompt: HIGHLIGHT_PROMPTS[hl.kind]?.[lang] ?? hl.scenario.prompt, matchup: matchupViewOf(hl, playerNames(l), heroDisplayName()) } : null,
    momentActive: l.momentActive,
    decision: l.decision
      ? {
        kind: l.decision.kind, title: l.decision.title, prompt: l.decision.prompt, fallback: l.decision.fallback, seconds: DECISION_SECONDS,
        options: l.decision.options.map((o) => ({ id: o.id, label: o.label, hint: o.hint, risky: !!o.gamble })),
      }
      : null,
    speed: l.speed,
    paused: l.paused,
    finished: snap.finished,
    ...snubOf(l, snap),
  }
}

function publish(): void {
  if (live) match.value = liveView(live)
}

/** Lineup discs from a MatchTeam (formation coords normalised to the own half). */
function lineupOf(team: MatchTeam): LineupPlayer[] {
  const slots = formationSlots(team.formation)
  const idx = assignSlots(team.lineup, team.formation)
  return team.lineup.map((p, i) => {
    const sl = slots[idx[i]!] ?? slots[i] ?? { x: 30, y: 34 }
    return {
      id: p.id, name: p.name, number: p.number, position: p.position, ovr: p.ovr, isHero: p.isHero,
      x: clamp(sl.x / 52.5, 0.03, 1), y: clamp(sl.y / 68, 0.05, 0.95),
    }
  })
}

const ODDS = (p: number): number => Math.round((1 / Math.max(0.05, p)) * 0.93 * 100) / 100

const HINTS: Record<string, LText> = {
  possession: { tr: 'Topa sahip olmayı seviyorlar; pres yapıp hata zorla.', en: 'They love the ball; press them into mistakes.' },
  counter: { tr: 'Kontra atakta tehlikeliler; topu kolay kaybetme.', en: 'Deadly on the break; don\'t give the ball away cheaply.' },
  direct: { tr: 'Uzun toplarla oynuyorlar; ikinci toplara hazır ol.', en: 'They go long; be ready for second balls.' },
  pressing: { tr: 'Yüksek pres yapıyorlar; ilk dokunuşun temiz olmalı.', en: 'They press high; your first touch must be clean.' },
  defensive: { tr: 'Geride kalabalıklar; ceza sahası dışından şut dene.', en: 'They sit deep; try your luck from range.' },
  balanced: { tr: 'Dengeli bir takım; kanatlarda boşluk ara.', en: 'A balanced side; look for space out wide.' },
}

/** Pre-match view from the prepared match (null before playMatch()). */
export function preMatchView(s: GameState): PreMatchView | null {
  const blob = readJson<MatchBlob | null>(s.life, GFLAG.match, null)
  if (!blob || blob.fixtureId !== s.activeMatchId) return null
  const fx = activeFixture(s, blob.fixtureId, blob)
  if (!fx) return null
  const { home, away } = blob.setup
  const heroSide = blob.setup.heroSide ?? 'home'
  const opp = heroSide === 'home' ? away : home
  const oppClub = s.world.clubs[opp.id]
  const keyNpc = pickKeyPlayer(opp.lineup.map((p) => s.world.players[p.id]).filter((p): p is NpcPlayer => !!p))
  const key = opp.lineup.find((p) => p.id === keyNpc?.id) ?? [...opp.lineup].sort((a, b) => b.ovr - a.ovr)[0]
  // Opponent form from its league table row (current season).
  let form: ('W' | 'D' | 'L')[] = []
  for (const comp of seasonCompetitions(s.world, s.calendar.season)) {
    const row = comp.type === 'league' ? comp.table?.find((r) => r.clubId === opp.id) : undefined
    if (row) { form = row.form.slice(-5); break }
  }
  const avg = (t: MatchTeam) => t.lineup.reduce((a, p) => a + p.ovr, 0) / Math.max(1, t.lineup.length)
  const diff = avg(home) - avg(away) + (blob.setup.neutralVenue ? 0 : 2.5)
  const pHome = 1 / (1 + Math.exp(-diff / 6))
  const pDraw = 0.27 - Math.min(0.12, Math.abs(diff) / 60)
  return {
    fixture: fx,
    weather: blob.setup.weather,
    importance: blob.setup.importance,
    homeFormation: home.formation,
    awayFormation: away.formation,
    homeLineup: lineupOf(home),
    awayLineup: lineupOf(away),
    opponentForm: form,
    opponentKeyPlayer: key ? {
      name: key.name, position: key.position, ovr: key.ovr,
      ...(keyNpc ? { form: Math.round(keyNpc.form), contractUntil: keyNpc.contractUntil } : {}),
    } : null,
    heroAvailability: { suspendedMatches: s.hero.suspendedMatches, injured: !!s.hero.injury, contractUntil: s.hero.contract?.untilSeason ?? null },
    tacticHint: (HINTS[oppClub?.style ?? 'balanced'] ?? HINTS.balanced)!,
    heroStarting: blob.starts,
    odds: { home: ODDS(pHome * (1 - pDraw)), draw: ODDS(pDraw), away: ODDS((1 - pHome) * (1 - pDraw)) },
    expectedMoments: expectedFor(s, blob),
    referee: blob.setup.referee ? { ...blob.setup.referee } : null,
    markedMan: markedMan(s.hero),
    ...(blob.setup.heroEntryMinute !== undefined ? { plannedEntry: blob.setup.heroEntryMinute } : {}),
  }
}

/** Difficulty + assist settings for a live moment; a Custom career overrides them (GAP 2.1#128). */
function momentDifficulty(s: GameState): { difficulty: GameState['meta']['difficulty'] | number; settings: typeof settings.value } {
  if (!s.meta.custom) return { difficulty: s.meta.difficulty, settings: settings.value }
  const o = customMomentOverrides(s.meta.custom)
  return { difficulty: o.difficulty, settings: { ...settings.value, aimAssist: o.aimAssist, slowMoAim: o.slowMoAim } }
}

/** Expected moments for the hero (a bench player gets the cameo estimate). */
function expectedFor(s: GameState, blob: MatchBlob): PreMatchView['expectedMoments'] {
  const side = blob.setup.heroSide
  if (!side) return null
  const team = side === 'home' ? blob.setup.home : blob.setup.away
  const hero = [...team.lineup, ...team.bench].find((p) => p.isHero)
  const position = hero?.position ?? s.hero.position
  const mates = team.lineup.filter((p) => !p.isHero)
  const relationAvg = mates.length ? mates.reduce((a, p) => a + p.relationToHero, 0) / mates.length : 0
  try {
    const e0 = expectedMomentsFor({
      position, relationAvg, morale: team.morale, form: s.hero.form, minutes: blob.starts ? 90 : 25,
      positioning: hero?.attrs.positioning, ovr: hero?.ovr, ...(s.hero.matchFocus ? { focus: s.hero.matchFocus } : {}),
      ...(hero?.role ? { role: hero.role } : {}),
    })
    const e = withBuildUpFallback(e0, hero?.attrs, blob.setup.difficulty)
    return { min: e.min, max: e.max, kinds: e.kinds.map((k) => ({ kind: k.kind, share: k.share })) }
  } catch {
    return null
  }
}

function interviewOptions(def: InterviewDef): InterviewOption[] {
  const toDelta = (x: InterviewEffect): Delta => {
    const u = x.chance < 1 ? { uncertain: true } : {}
    switch (x.key) {
      case 'teammates': return { key: 'relation', value: x.value, rel: 'teammate', label: RELATION_LABEL.teammate, ...u }
      case 'manager': return { key: 'relation', value: x.value, rel: 'manager', label: RELATION_LABEL.manager, ...u }
      case 'press': return { key: 'relation', value: x.value, rel: 'press', label: RELATION_LABEL.press, ...u }
      case 'fans': return { key: 'relation', value: x.value, rel: 'fans', label: RELATION_LABEL.fans, ...u }
      default: return { key: x.key, value: x.value, ...u }
    }
  }
  return def.options.map((o) => ({ id: o.id, tone: o.tone, label: o.label, preview: o.effects.map(toDelta) }))
}

export function postMatchView(s: GameState): PostMatchView | null {
  const rec = readJson<PostRecord | null>(s.life, POST_FLAG, null)
  if (!rec) return null
  return {
    ...rec.view,
    interview: rec.interview && !rec.answered ? { question: rec.interview.question, options: interviewOptions(rec.interview) } : null,
  }
}

// ───────────────────────── Controller ─────────────────────────

function stopTimer(): void {
  if (live?.timer) clearInterval(live.timer)
  if (live) live.timer = null
}

function startTimer(): void {
  stopTimer()
  const l = live
  if (!l || l.paused || l.finalized || l.momentActive || l.decision || l.sim.pendingHighlight || l.sim.finished) return
  l.timer = setInterval(tick, MS_PER_MINUTE[l.speed])
}

function persistProgress(force = false): void {
  const l = live
  const s = current()
  if (!l || !s || l.finalized) return
  const minute = l.sim.snapshot().minute
  if (!force && minute - l.lastSaved < 5) return
  l.lastSaved = minute
  saveMatchProgress(s, l.sim)
}

/** One simulated minute (ticker callback). */
export function tick(): void {
  const l = live
  if (!l || l.paused || l.momentActive || l.decision || l.finalized) return
  if (l.sim.pendingHighlight) {
    stopTimer()
    publish()
    return
  }
  l.sim.step()
  if (l.sim.finished) {
    finalize()
    return
  }
  if (l.sim.pendingHighlight) {
    stopTimer()
    persistProgress(true)
  } else {
    persistProgress()
    maybeOpenDecision(l)
  }
  publish()
}

/** Events of the last minute from the hero's point of view (feeds the penalty / free-kick windows). */
export function recentEvents(snap: { minute: number; events: { type: string; side: 'home' | 'away' | null; minute: number }[] }, side: 'home' | 'away') {
  return snap.events.filter((e) => snap.minute - e.minute <= 1).map((e) => ({ type: e.type, own: e.side ? e.side === side : null, minute: e.minute }))
}

/** Open the in-match decision window when the pure rules say so (pauses the ticker). */
function maybeOpenDecision(l: Live): void {
  if (l.decision || l.finalized || settings.value.matchDecisions === false) return
  const s = current()
  if (!s) return
  const snap = l.sim.snapshot()
  const ev = snap.events[snap.events.length - 1]
  const side = l.heroSide
  const diff = side === 'home' ? snap.score[0] - snap.score[1] : snap.score[1] - snap.score[0]
  const kind = pickDecision({
    seed: l.fixtureId, minute: snap.minute, shown: pendingDecisions(s).length, lastMinute: l.decisionMinute,
    heroOnPitch: snap.heroOnPitch, diff,
    last: ev ? { type: ev.type, own: ev.side ? ev.side === side : null, minute: ev.minute } : null,
    recent: recentEvents(snap, side),
    isKeeper: s.hero.position === 'GK',
    isCaptain: s.hero.contract?.role === 'captain', heroOvr: heroOvr(s.hero), heroYellow: snap.heroStats.yellow,
  })
  if (!kind) return
  l.decision = decisionDef(kind, heroOvr(s.hero), s.hero.attrs.leadership)
  l.decisionMinute = snap.minute
  stopTimer()
}

/** Dev/e2e only (`__sp.openDecision`): open a decision window right now. */
export function debugOpenDecision(kind: DecisionKind): boolean {
  const l = live
  const s = current()
  if (!l || !s || l.decision || l.finalized || l.momentActive) return false
  l.decision = decisionDef(kind, heroOvr(s.hero), s.hero.attrs.leadership)
  l.decisionMinute = l.sim.snapshot().minute
  stopTimer()
  publish()
  return true
}

/** Take a choice of the open decision window (or its default when the timer ran out). */
export function decide(optionId: string): void {
  const l = live
  const s = current()
  if (!l || !s || !l.decision) return
  const def = l.decision
  const out = resolveDecision(def, optionId, `${l.fixtureId}:${l.decisionMinute}`)
  l.decision = null
  recordDecision(s, out)
  l.sim.applyHeroDecision(out.effects.rating, out.effects.book, out.effects.teamBoost)
  commit(s, { silent: true })
  persistProgress(true)
  publish()
  startTimer()
}

function newLive(s: GameState, sim: MatchSim, paused: boolean): Live | null {
  const fixtureId = s.activeMatchId
  const blob = readJson<MatchBlob | null>(s.life, GFLAG.match, null)
  if (!fixtureId || !blob) return null
  const fixture = activeFixture(s, fixtureId, blob)
  if (!fixture) return null
  return {
    sim, fixtureId, fixture, setup: blob.setup, heroSide: blob.setup.heroSide ?? 'home',
    speed: settings.value.matchSpeed, paused, momentActive: false, timer: null, session: null, lastSaved: 0, finalized: false,
    decision: null, decisionMinute: -99,
  }
}

/** Prepare/start (or resume) today's hero match. Returns false when there is none. */
export function startMatch(): boolean {
  const s = get()
  if (live && live.fixtureId === s.activeMatchId && !live.finalized) {
    publish()
    return true
  }
  clearLive()
  const sim = startHeroMatch(s, currentLang.value)
  if (!sim) return false
  live = newLive(s, sim, true)
  if (!live) return false
  // Clear any stale post-match record from an earlier game.
  writeJson(s.life, POST_FLAG, null)
  writeJson(s.life, DECISION_FLAG, [])
  publish()
  commit(s, { silent: true })
  return true
}

/** After loading a save with a match in progress: rebuild the controller (paused). */
export function resumeAfterLoad(s: GameState): void {
  clearLive()
  if (!s.activeMatchId) return
  const sim = resumeHeroMatch(s)
  if (!sim) return
  live = newLive(s, sim, true)
  if (live?.sim.finished) finalize()
  else publish()
}

export function setSpeed(speed: MatchSpeed): void {
  if (!live) return
  live.speed = speed
  if (live.timer) startTimer()
  publish()
}

export function setPaused(paused: boolean): void {
  if (!live) return
  live.paused = paused
  if (paused) {
    stopTimer()
    persistProgress(true)
  } else startTimer()
  publish()
}

// Auto-pause: backgrounding the app (platform/lifecycle `sp:app-pause`) pauses a running live match;
// it comes back paused with a hint, the player resumes with the play button.
let autoPaused = false
export function installAutoPause(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('sp:app-pause', () => {
    if (live && !live.paused && !live.finalized && !live.sim.finished) {
      autoPaused = true
      setPaused(true)
    }
  })
  window.addEventListener('sp:app-resume', () => {
    if (!autoPaused) return
    autoPaused = false
    if (live?.paused) notify({ tr: 'Maç duraklatıldı. Devam etmek için oynat tuşuna bas.', en: 'Match paused. Press play to resume.' }, 'info')
  })
}

/**
 * "Skip to next moment" (2.2#106): run the minutes straight through to the
 * hero's next moment (or the final whistle) without waiting on the ticker.
 */
export function skipToMoment(): void {
  const l = live
  if (!l || l.finalized || l.momentActive || l.decision || l.sim.pendingHighlight) return
  stopTimer()
  let guard = 0
  while (!l.sim.finished && !l.sim.pendingHighlight && guard++ < 200) l.sim.step()
  if (l.sim.finished) {
    finalize()
    return
  }
  persistProgress(true)
  publish()
}

/** Let the sim resolve the pending highlight. */
export function simMoment(): void {
  const l = live
  if (!l || !l.sim.pendingHighlight || l.momentActive) return
  l.sim.skipHighlight()
  afterMoment()
}

function afterMoment(): void {
  const l = live
  if (!l) return
  l.momentActive = false
  l.session = null
  if (l.sim.finished) {
    finalize()
    return
  }
  persistProgress(true)
  publish()
  startTimer()
}

function rawFixture(s: GameState, id: string): { homeId: string; day: number } | null {
  for (const season of [s.calendar.season, s.calendar.season + 1]) {
    for (const comp of seasonCompetitions(s.world, season)) {
      const f = comp.fixtures.find((x) => x.id === id)
      if (f) return f
    }
  }
  return null
}

/** Home ground capacity (stadium tier) and floodlights for the match scene. */
function matchStadium(s: GameState, l: Live): { capacity: number; night: boolean } {
  const fx = rawFixture(s, l.fixtureId)
  const home = fx ? s.world.clubs[fx.homeId] : undefined
  const capacity = l.setup.neutralVenue ? 60_000 : home?.stadium.capacity ?? (l.fixtureId.startsWith('reserve:') ? 1_500 : 42_000)
  return { capacity, night: isEveningFixture(l.fixtureId, fx?.day ?? 5, l.setup.importance) }
}

/** Hand the pending highlight to the Phaser scene (#match-canvas). */
export function playMoment(): void {
  const l = live
  const hl = l?.sim.pendingHighlight
  if (!l || !hl || l.momentActive) return
  const s = get()
  l.momentActive = true
  stopTimer()
  publish()
  const heroTeam = l.heroSide === 'home' ? l.setup.home : l.setup.away
  const oppTeam = l.heroSide === 'home' ? l.setup.away : l.setup.home
  // Kits as worn: on a clash the away side changes to its change kit (colours only; the sim is untouched).
  const kits = resolveMatchKits(l.setup.home.colors, l.setup.away.colors, s.world.clubs[l.setup.away.id]?.awayColors)
  const heroColors = l.heroSide === 'home' ? kits.home : kits.away
  const oppColors = l.heroSide === 'home' ? kits.away : kits.home
  const names = playerNames(l)
  const done = (fn: () => void) => {
    if (live !== l || !l.momentActive) return
    fn()
    afterMoment()
  }
  l.session = playHighlight(
    {
      highlight: hl, heroColors, oppColors, heroTeamShort: heroTeam.shortName, oppTeamShort: oppTeam.shortName,
      heroName: heroDisplayName(), names, weather: l.setup.weather, importance: l.setup.importance,
      ...momentDifficulty(s), lang: currentLang.value, gender: worldGender(s.world),
      stadium: matchStadium(s, l), celebration: celebrationForMatch(s), matchKey: l.fixtureId,
    },
    (result) => done(() => l.sim.resolveHighlight(result)),
    () => done(() => l.sim.skipHighlight()),
  )
}

/** Simulate the rest of the match (remaining highlights auto-resolved). */
export function simToEnd(): void {
  const l = live
  if (!l || l.finalized) return
  if (l.decision) decide(l.decision.fallback)
  l.session?.stop()
  l.momentActive = false
  stopTimer()
  l.sim.simulateToEnd(true)
  finalize()
}

/** Final whistle: apply the match to the career and build the post-match record. */
/** Earnings breakdown for the post-match step, from the contract, sponsors, agent and this week's match count. */
function earningsFor(s: GameState, bonuses: MatchBonuses): MatchEarnings {
  const season = s.calendar.season
  return matchEarnings({
    contract: s.hero.contract,
    bonuses,
    sponsorsWeekly: s.life.sponsors.filter((d) => d.untilSeason >= season).reduce((a, d) => a + Math.max(0, d.weekly || 0), 0),
    agentCommission: s.life.agent?.commission ?? 0,
    taxRate: incomeTaxRate(heroClub(s)?.countryId),
    matchesThisWeek: weekCounters(s.life).matches,
    retired: s.hero.retired,
  })
}

function finalize(): void {
  const l = live
  if (!l || l.finalized) return
  stopTimer()
  l.finalized = true
  const s = get()
  const blob = readJson<MatchBlob | null>(s.life, GFLAG.match, null)
  if (!blob) {
    publish()
    return
  }
  const engine = JSON.parse(l.sim.serialize()) as EngineState
  const snap = l.sim.snapshot()
  const before = snapshot(s)
  const trustBefore = s.hero.managerTrust
  const relBefore = relationValues(s.life.relationships)
  applyPendingDecisions(s)
  let report: ReturnType<typeof finishHeroMatch>
  try {
    report = finishHeroMatch(s, l.sim)
  } catch (e) {
    console.error('[StarPath] finishHeroMatch failed', e)
    notify({ tr: 'Maç sonucu işlenemedi.', en: 'Could not process the match result.' })
    publish()
    return
  }
  const after = snapshot(s)
  const side = l.heroSide
  const nameOf = (id: string): string => {
    if (id === HERO_ID) return s.hero.nickname || `${s.hero.firstName} ${s.hero.lastName}`
    const p = s.world.players[id]
    if (p) return playerDisplayName(p, 'short')
    for (const t of [l.setup.home, l.setup.away]) {
      const m = [...t.lineup, ...t.bench].find((x) => x.id === id)
      if (m) return m.name
    }
    return '—'
  }
  const res = report.result
  const motmId = res.motmId
  const motmRt = motmId ? engine.players[motmId] : undefined
  const motmRating = motmId === HERO_ID
    ? report.rating
    : Math.max(
      motmRt ? Math.round(clamp(6.6 + motmRt.goals * 0.7 + motmRt.assists * 0.4 + motmRt.saves * 0.15, 6.5, 9.8) * 10) / 10 : 7.2,
      // The engine picked them over the hero: never show a lower rating than his.
      report.minutes > 0 ? Math.min(10, Math.round((report.rating + 0.1) * 10) / 10) : 0,
    )
  const motmNpc = motmId && motmId !== HERO_ID ? s.world.players[motmId] : undefined
  const st = heroStatsView(snap)
  const view: PostRecord['view'] = {
    fixture: { ...l.fixture, result: res },
    score: [res.home, res.away],
    heroSide: side,
    rating: report.minutes > 0 ? report.rating : 0,
    stats: { ...st, rating: report.minutes > 0 ? report.rating : 0 },
    team: {
      possession: [snap.possession[0], snap.possession[1]],
      shots: [snap.shots[0], snap.shots[1]],
      shotsOnTarget: [snap.shotsOnTarget[0] ?? 0, snap.shotsOnTarget[1] ?? 0],
      corners: [engine.teams.home.corners ?? 0, engine.teams.away.corners ?? 0],
      fouls: [engine.teams.home.fouls ?? 0, engine.teams.away.fouls ?? 0],
    },
    motm: motmId === HERO_ID
      ? { name: `${s.hero.firstName} ${s.hero.lastName}`, isHero: true, rating: motmRating, appearance: s.hero.appearance }
      : { name: motmId ? nameOf(motmId) : '—', isHero: false, rating: motmRating, ...(motmNpc ? { appearance: motmNpc.appearance } : {}) },
    scorers: res.scorers.map((g) => ({ minute: g.minute, name: nameOf(g.playerId) + (g.ownGoal ? ' (o.g.)' : ''), side: g.team })),
    deltas: diffSnapshots(before, after).filter((d) => d.key !== 'energy'),
    ...postDetails(s, snap, report, trustBefore, relBefore),
    ...conditionFor(s, l.fixtureId),
    ...passNetFor(l, snap, report.minutes),
    ...(report.bonuses && s.hero.contract ? { earnings: earningsFor(s, report.bonuses) } : {}),
  }
  const opp = side === 'home' ? l.setup.away : l.setup.home
  if (blob.reserve) delete view.expectations
  const interview = !blob.reserve && (report.minutes > 0 || blob.starts)
    ? interviewFor(s, new Rng(hashString(`iv:${l.fixtureId}`)), {
      won: report.won, drew: report.drew, goals: st.goals, assists: st.assists, rating: report.rating, motm: motmId === HERO_ID,
      started: blob.starts, minutes: report.minutes, opponent: opp.name,
    })
    : null
  writeJson(s.life, POST_FLAG, { view, interview, answered: null } satisfies PostRecord)
  match.value = { ...liveView(l), finished: true, paused: true }
  commit(s)
  scheduleAutosave(300)
}

function passNetFor(l: Live, snap: MatchSnapshot, minutes: number): { passNet?: PassNetView } {
  if (minutes <= 0) return {}
  try {
    const team = l.heroSide === 'home' ? l.setup.home : l.setup.away
    const v = buildPassNetView(snap.passNet, team.lineup)
    return v ? { passNet: v } : {}
  } catch {
    return {}
  }
}

/** Pre-match causes (life/butterfly) for the rating step: what the week before did to this match. */
function conditionFor(s: GameState, fixtureId: string): Pick<PostMatchView, 'condition'> {
  const c = preMatchCauses(s, fixtureId)
  return c.length ? { condition: c.map((x) => ({ label: x.label, tone: x.tone })) } : {}
}

/** Rating breakdown, maps, trust reasons and relationship rows for the post-match flow. */
function postDetails(
  s: GameState, snap: MatchSnapshot, report: ReturnType<typeof finishHeroMatch>, trustBefore: number, relBefore: Record<string, number>,
): Pick<PostMatchView, 'ratingBase' | 'ratingLog' | 'heroMap' | 'trust' | 'expectations' | 'relations'> {
  const out: Pick<PostMatchView, 'ratingBase' | 'ratingLog' | 'heroMap' | 'trust' | 'expectations' | 'relations'> = {}
  try {
    const log = ratingLogView(snap.heroLog)
    if (report.minutes > 0) {
      out.ratingBase = RATING_BASE
      out.ratingLog = log
    }
    const map = heroMapView(snap.heroMap)
    if (map && report.minutes > 0) out.heroMap = map
    const h = snap.heroStats
    const resultLine = log.find((e) => e.source === 'final' && e.key === 'result')
    const marks = matchExpectations(s)
    if (marks.length) out.expectations = marks
    out.trust = buildTrustReasons({
      before: trustBefore, after: s.hero.managerTrust, rating: report.minutes > 0 ? report.rating : 0, minutes: report.minutes,
      goals: h.goals, assists: h.assists, yellow: h.yellow, red: h.red, won: report.won, drew: report.drew,
      ...(resultLine ? { resultPts: resultLine.delta } : {}),
    })
    out.relations = buildRelationChanges(relBefore, s.life.relationships)
  } catch (e) {
    console.error('[StarPath] post-match details failed', e)
  }
  return out
}

/** Apply an interview answer; returns the chips that actually landed. */
export function answer(optionId: string): Delta[] {
  const s = get()
  const rec = readJson<PostRecord | null>(s.life, POST_FLAG, null)
  if (!rec?.interview || rec.answered) return []
  const tone = rec.interview.options.find((o) => o.id === optionId)?.tone
  if (!tone) return []
  const before = snapshot(s)
  answerInterview(s, rec.interview, tone)
  rec.answered = tone
  writeJson(s.life, POST_FLAG, rec)
  const deltas = diffSnapshots(before, snapshot(s))
  commit(s)
  return deltas
}

/** Leave the post-match screen: forget the record and the live view. */
export function finishMatch(): void {
  const s = current()
  if (live && !live.finalized) {
    // Leaving a running match: play it out so the result is never lost.
    simToEnd()
  }
  clearLive()
  if (s) {
    writeJson(s.life, POST_FLAG, null)
    commit(s)
  }
}

export function clearLive(): void {
  stopTimer()
  live?.session?.stop()
  live = null
  match.value = null
}

/** Persist the live match into the state (before a manual save). */
export function persistNow(): void {
  persistProgress(true)
}

export const liveActive = (): boolean => !!live && !live.finalized

/**
 * A U21 / training match opened from the bench but never kicked off (the player
 * backed out of the pre-match screen) is dropped, so it cannot block the day.
 * True when one was dropped. A league match or a reserve game already under way stays.
 */
export function dropUnstartedReserve(): boolean {
  const s = current()
  if (!s || !live || live.finalized || !s.activeMatchId?.startsWith('reserve:')) return false
  if (live.sim.snapshot().minute > 0) return false
  clearLive()
  clearActiveMatch(s)
  commit(s, { silent: true })
  return true
}
export const liveFixtureId = (): string | null => live?.fixtureId ?? null
