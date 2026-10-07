/**
 * Live hero match: drives the real MatchSim minute by minute on a ticker,
 * publishes LiveMatchView through the `match` signal, pauses on highlights
 * (sim or play them in the Phaser scene via highlightBridge), finalises the
 * match through finishHeroMatch and builds the post-match record (stats,
 * deltas, interview) that `data.postMatch()` shows.
 */
import { Rng, clamp, hashString } from '../../core/rng'
import type { GameState, LText, NpcPlayer } from '../../core/types'
import { worldGender } from '../../core/gender'
import { currentLang } from '../../i18n'
import {
  GFLAG, HERO_ID, answerInterview, finishHeroMatch, interviewFor, saveMatchProgress, startHeroMatch, resumeHeroMatch,
  type InterviewDef, type InterviewEffect, type InterviewTone,
} from '../../sim/game'
import { readJson, weekCounters, writeJson } from '../../sim/game/internal'
import { matchEarnings, type MatchBonuses, type MatchEarnings } from '../../sim/career/matchPay'
import { HIGHLIGHT_PROMPTS, MatchSim, RATING_BASE, assignSlots, type EngineState, type MatchEvent, type MatchSetup, type MatchSnapshot, type MatchTeam, type Side } from '../../sim/match'
import { formationSlots } from '../../sim/match/formations'
import { pickKeyPlayer, playerDisplayName, seasonCompetitions } from '../../sim/world/queries'
import { match, settings } from '../store'
import type {
  Delta, FixtureView, HeroMatchStatsView, InterviewOption, LineupPlayer, LiveMatchView, MatchEventView, PostMatchView, PreMatchView,
} from '../store'
import { RELATION_LABEL, diffSnapshots, fixtureView, snapshot } from './mapping'
import { playHighlight, type HighlightSession } from './highlightBridge'
import { celebrationForMatch } from './celebration'
import { isEveningFixture } from '../../game/presentation'
import { buildRelationChanges, buildTrustReasons, expectedMomentsFor, heroMapView, ratingLogView, relationValues } from './postMatch'
import { commit, current, get, notify } from './session'
import { scheduleAutosave } from './persistence'

/** Milliseconds per simulated minute by speed. */
export const MS_PER_MINUTE: Record<1 | 2 | 4, number> = { 1: 600, 2: 300, 4: 150 }

/** Prepared-match blob as stored by sim/game/match.ts (fields we read). */
interface MatchBlob {
  fixtureId: string
  compId: string
  setup: MatchSetup
  starts: boolean
  sim?: string
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
  speed: 1 | 2 | 4
  paused: boolean
  momentActive: boolean
  timer: ReturnType<typeof setInterval> | null
  session: HighlightSession | null
  lastSaved: number
  finalized: boolean
}

let live: Live | null = null

// ───────────────────────── Views ─────────────────────────

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
    phase: snap.phase,
    heroOnPitch: snap.heroOnPitch,
    heroSide: l.heroSide,
    heroStats: heroStatsView(snap),
    pendingMoment: hl ? { id: hl.id, minute: hl.minute, kind: hl.kind, prompt: HIGHLIGHT_PROMPTS[hl.kind]?.[lang] ?? hl.scenario.prompt } : null,
    momentActive: l.momentActive,
    speed: l.speed,
    paused: l.paused,
    finished: snap.finished,
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
    const sl = slots[idx[i]] ?? slots[i] ?? { x: 30, y: 34 }
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
  const fx = findFixture(s, blob.fixtureId)
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
    tacticHint: HINTS[oppClub?.style ?? 'balanced'] ?? HINTS.balanced,
    heroStarting: blob.starts,
    odds: { home: ODDS(pHome * (1 - pDraw)), draw: ODDS(pDraw), away: ODDS((1 - pHome) * (1 - pDraw)) },
    expectedMoments: expectedFor(s, blob),
    referee: blob.setup.referee ? { ...blob.setup.referee } : null,
  }
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
    const e = expectedMomentsFor({ position, relationAvg, morale: team.morale, form: s.hero.form, minutes: blob.starts ? 90 : 25 })
    return { min: e.min, max: e.max, kinds: e.kinds.map((k) => ({ kind: k.kind, share: k.share })) }
  } catch {
    return null
  }
}

function interviewOptions(s: GameState, def: InterviewDef): InterviewOption[] {
  const toDelta = (x: InterviewEffect): Delta => {
    const u = x.chance < 1 ? { uncertain: true } : {}
    switch (x.key) {
      case 'teammates': return { key: 'relation', value: x.value, label: RELATION_LABEL.teammate, ...u }
      case 'manager': return { key: 'relation', value: x.value, label: s.life.relationships.manager?.name ?? RELATION_LABEL.manager, ...u }
      case 'press': return { key: 'relation', value: x.value, label: RELATION_LABEL.press, ...u }
      case 'fans': return { key: 'relation', value: x.value, label: RELATION_LABEL.fans, ...u }
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
    interview: rec.interview && !rec.answered ? { question: rec.interview.question, options: interviewOptions(s, rec.interview) } : null,
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
  if (!l || l.paused || l.finalized || l.momentActive || l.sim.pendingHighlight || l.sim.finished) return
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
  if (!l || l.paused || l.momentActive || l.finalized) return
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
  } else persistProgress()
  publish()
}

function newLive(s: GameState, sim: MatchSim, paused: boolean): Live | null {
  const fixtureId = s.activeMatchId
  const blob = readJson<MatchBlob | null>(s.life, GFLAG.match, null)
  if (!fixtureId || !blob) return null
  const fixture = findFixture(s, fixtureId)
  if (!fixture) return null
  return {
    sim, fixtureId, fixture, setup: blob.setup, heroSide: blob.setup.heroSide ?? 'home',
    speed: settings.value.matchSpeed, paused, momentActive: false, timer: null, session: null, lastSaved: 0, finalized: false,
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

export function setSpeed(speed: 1 | 2 | 4): void {
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
  const capacity = l.setup.neutralVenue ? 60_000 : home?.stadium.capacity ?? 42_000
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
  const names: Record<string, string> = {}
  for (const p of [...heroTeam.lineup, ...heroTeam.bench, ...oppTeam.lineup, ...oppTeam.bench]) names[p.id] = p.name
  const done = (fn: () => void) => {
    if (live !== l || !l.momentActive) return
    fn()
    afterMoment()
  }
  l.session = playHighlight(
    {
      highlight: hl, heroColors: heroTeam.colors, oppColors: oppTeam.colors, heroTeamShort: heroTeam.shortName, oppTeamShort: oppTeam.shortName,
      heroName: s.hero.nickname || s.hero.lastName, names, weather: l.setup.weather, importance: l.setup.importance,
      difficulty: s.meta.difficulty, lang: currentLang.value, settings: settings.value, gender: worldGender(s.world),
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
    ...(report.bonuses && s.hero.contract ? { earnings: earningsFor(s, report.bonuses) } : {}),
  }
  const opp = side === 'home' ? l.setup.away : l.setup.home
  const interview = report.minutes > 0 || blob.starts
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

/** Rating breakdown, maps, trust reasons and relationship rows for the post-match flow. */
function postDetails(
  s: GameState, snap: MatchSnapshot, report: ReturnType<typeof finishHeroMatch>, trustBefore: number, relBefore: Record<string, number>,
): Pick<PostMatchView, 'ratingBase' | 'ratingLog' | 'heroMap' | 'trust' | 'relations'> {
  const out: Pick<PostMatchView, 'ratingBase' | 'ratingLog' | 'heroMap' | 'trust' | 'relations'> = {}
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
export const liveFixtureId = (): string | null => live?.fixtureId ?? null
