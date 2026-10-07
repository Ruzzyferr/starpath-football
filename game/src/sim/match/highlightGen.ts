/**
 * Highlight scenario generation: lays out every on-pitch player for a hero
 * moment in pitch meters, formation-aware, with the hero's team attacking +x.
 *
 * Layout pipeline:
 *  1. each player gets their formation slot (see {@link formationSlots});
 *  2. slot depth is remapped into a kind-specific band for each team
 *     (e.g. hero team pushed high, opponents in a low block);
 *  3. the whole picture slides laterally toward the ball;
 *  4. kind-specific actors (hero, ball owner, keeper, wall, markers) are placed.
 */
import type { Rng } from '../../core/rng'
import { clamp } from '../../core/rng'
import type { Formation, Lang, Position } from '../../core/types'
import { HIGHLIGHT_PROMPTS } from './commentary'
import { formationSlots } from './formations'
import type { HighlightKind, HighlightScenario, MatchPlayer, ScenarioPlayer, Side, Vec2 } from './types'
import { PITCH_LENGTH, PITCH_WIDTH } from './types'

export { formationSlots, assignSlots, type FormationSlot } from './formations'

/** A player currently on the pitch together with their formation slot index. */
export interface SlotPlayer {
  player: MatchPlayer
  slot: number
}

/** Everything needed to build a scenario. */
export interface ScenarioInput {
  kind: HighlightKind
  heroSide: Side
  heroId: string
  mates: readonly SlotPlayer[] // includes the hero
  opps: readonly SlotPlayer[]
  mateFormation: Formation
  oppFormation: Formation
  lang: Lang
  rng: Rng
}

/** Built scenario plus the actors the engine needs for crediting outcomes. */
export interface GeneratedScenario {
  scenario: HighlightScenario
  /** Teammate who supplied the ball (assist credit if the hero scores). */
  passerId: string | null
  /** Teammate expected to finish if the hero assists. */
  finisherId: string | null
  /** Main opponent in the moment (attacker for defensive kinds, keeper otherwise). */
  opponentId: string | null
}

/** Depth bands [mateBack, mateFront, oppBack, oppFront] in team-local meters. */
const BANDS: Record<HighlightKind, readonly [number, number, number, number]> = {
  build_up: [26, 62, 24, 52],
  counter: [16, 60, 40, 78],
  one_on_one: [38, 78, 24, 60],
  cross: [44, 90, 6, 36],
  edge_of_box: [44, 86, 8, 40],
  freekick: [48, 88, 6, 34],
  penalty: [60, 84, 18, 26],
  corner: [55, 96, 4, 22],
  defend: [10, 46, 42, 84],
  gk_save: [8, 38, 46, 92],
  gk_penalty: [18, 26, 60, 86],
}

/** Seconds before the moment auto-ends. */
export const TIME_LIMITS: Record<HighlightKind, number> = {
  build_up: 18,
  counter: 14,
  one_on_one: 8,
  cross: 10,
  edge_of_box: 9,
  freekick: 15,
  penalty: 12,
  corner: 9,
  defend: 12,
  gk_save: 8,
  gk_penalty: 10,
}

const SLOT_X_MIN = 16
const SLOT_X_MAX = 56
const WIDE: ReadonlySet<Position> = new Set<Position>(['LW', 'RW', 'LB', 'RB'])
const ATTACKERS: ReadonlySet<Position> = new Set<Position>(['ST', 'LW', 'RW', 'AM'])

/** Clamps a point inside the pitch with a small margin. */
function inPitch(p: Vec2): Vec2 {
  return { x: clamp(p.x, 0.5, PITCH_LENGTH - 0.5), y: clamp(p.y, 0.5, PITCH_WIDTH - 0.5) }
}

/** Maps a slot's x into a depth band (team-local meters from own goal line). */
function bandX(slotX: number, back: number, front: number): number {
  const t = clamp((slotX - SLOT_X_MIN) / (SLOT_X_MAX - SLOT_X_MIN), 0, 1)
  return back + t * (front - back)
}

interface Layout {
  pos: Map<string, Vec2>
  input: ScenarioInput
  mates: readonly SlotPlayer[]
  opps: readonly SlotPlayer[]
}

/** Step 1–3: formation-aware base layout for both teams. */
function baseLayout(input: ScenarioInput, ballY: number): Layout {
  const [mb, mf, ob, of] = BANDS[input.kind]
  const pos = new Map<string, Vec2>()
  const shiftY = (ballY - PITCH_WIDTH / 2) * 0.3
  const mateSlots = formationSlots(input.mateFormation)
  const oppSlots = formationSlots(input.oppFormation)
  const jitter = () => input.rng.range(-1.5, 1.5)
  for (const sp of input.mates) {
    const s = mateSlots[sp.slot] ?? mateSlots[0]
    const x = s.role === 'GK' ? Math.max(4, mb - 18) : bandX(s.x, mb, mf)
    pos.set(sp.player.id, inPitch({ x: x + jitter(), y: s.y + shiftY * (s.role === 'GK' ? 0.2 : 1) + jitter() }))
  }
  for (const sp of input.opps) {
    const s = oppSlots[sp.slot] ?? oppSlots[0]
    const local = s.role === 'GK' ? Math.max(2, ob - 20) : bandX(s.x, ob, of)
    const y = PITCH_WIDTH - s.y + shiftY * (s.role === 'GK' ? 0.2 : 1)
    pos.set(sp.player.id, inPitch({ x: PITCH_LENGTH - local + jitter(), y: y + jitter() }))
  }
  return { pos, input, mates: input.mates, opps: input.opps }
}

function roleOf(sp: SlotPlayer): Position {
  return sp.player.position
}

/** Opponent goalkeeper (or the first opponent if none is listed as GK). */
function oppKeeper(l: Layout): SlotPlayer | undefined {
  return l.opps.find((o) => roleOf(o) === 'GK') ?? l.opps[0]
}

function mateKeeper(l: Layout): SlotPlayer | undefined {
  return l.mates.find((m) => roleOf(m) === 'GK' && m.player.id !== l.input.heroId)
}

/** Weighted teammate pick; low relation to the hero makes a player a less likely passer. */
function pickMate(l: Layout, weight: (sp: SlotPlayer) => number): SlotPlayer | undefined {
  const pool = l.mates.filter((m) => m.player.id !== l.input.heroId && roleOf(m) !== 'GK')
  if (pool.length === 0) return undefined
  return l.input.rng.weighted(pool, weight)
}

function relationWeight(sp: SlotPlayer): number {
  return Math.max(0.1, 1 + sp.player.relationToHero / 100)
}

/** Nearest players of a team to a point (excluding goalkeepers and given ids). */
function nearest(l: Layout, team: readonly SlotPlayer[], p: Vec2, n: number, exclude: ReadonlySet<string>): SlotPlayer[] {
  return team
    .filter((sp) => roleOf(sp) !== 'GK' && !exclude.has(sp.player.id))
    .map((sp) => ({ sp, d: dist2(l.pos.get(sp.player.id) ?? p, p) }))
    .sort((a, b) => a.d - b.d || (a.sp.player.id < b.sp.player.id ? -1 : 1))
    .slice(0, n)
    .map((e) => e.sp)
}

function dist2(a: Vec2, b: Vec2): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2
}

function set(l: Layout, id: string | undefined, p: Vec2): void {
  if (id) l.pos.set(id, inPitch(p))
}

/** Places `markers` tightly around a target point (man-marking / closing down). */
function closeDown(l: Layout, markers: readonly SlotPlayer[], target: Vec2, radius: number, towardX: number): void {
  markers.forEach((m, i) => {
    const angle = (i - (markers.length - 1) / 2) * 0.6
    const dir = Math.sign(towardX - target.x) || 1
    set(l, m.player.id, {
      x: target.x + dir * radius * Math.cos(angle),
      y: target.y + radius * Math.sin(angle) * 1.4,
    })
  })
}

function heroSlot(l: Layout): SlotPlayer {
  const h = l.mates.find((m) => m.player.id === l.input.heroId)
  if (!h) throw new Error('highlightGen: hero is not among teammates')
  return h
}

/** Hero flank: low y (left) or high y (right) based on their base position. */
function heroFlankY(l: Layout): number {
  const p = l.pos.get(l.input.heroId)
  return p && p.y > PITCH_WIDTH / 2 ? PITCH_WIDTH - 5 : 5
}

interface Actors {
  ball: HighlightScenario['ball']
  passerId: string | null
  finisherId: string | null
  opponentId: string | null
}

type Placer = (l: Layout) => Actors

const owned = (pos: Vec2, ownerId: string | null, z = 0): HighlightScenario['ball'] => ({ pos: { ...pos }, z, ownerId })

const placeBuildUp: Placer = (l) => {
  const rng = l.input.rng
  const hp = { x: rng.range(40, 55), y: clamp((l.pos.get(l.input.heroId)?.y ?? 34), 8, 60) }
  set(l, l.input.heroId, hp)
  const passer = pickMate(l, (m) => relationWeight(m) * (['CB', 'DM', 'CM', 'LB', 'RB'].includes(roleOf(m)) ? 2 : 0.5))
  if (passer) set(l, passer.player.id, { x: hp.x - rng.range(10, 16), y: hp.y + rng.range(-10, 10) })
  closeDown(l, nearest(l, l.opps, hp, 1, new Set()), hp, 4, PITCH_LENGTH)
  return { ball: owned(hp, l.input.heroId), passerId: null, finisherId: null, opponentId: null }
}

const placeCounter: Placer = (l) => {
  const rng = l.input.rng
  const hp = { x: rng.range(46, 58), y: rng.range(18, 50) }
  set(l, l.input.heroId, hp)
  const runner = pickMate(l, (m) => relationWeight(m) * (ATTACKERS.has(roleOf(m)) ? 3 : 0.3))
  if (runner) set(l, runner.player.id, { x: hp.x + rng.range(-2, 6), y: hp.y > 34 ? hp.y - 18 : hp.y + 18 })
  const chasers = nearest(l, l.opps, hp, 2, new Set())
  chasers.forEach((c, i) => set(l, c.player.id, { x: hp.x - 4 - i * 3, y: hp.y + (i ? 5 : -4) }))
  return { ball: owned(hp, l.input.heroId), passerId: null, finisherId: runner?.player.id ?? null, opponentId: null }
}

const placeOneOnOne: Placer = (l) => {
  const rng = l.input.rng
  const hp = { x: rng.range(80, 87), y: rng.range(26, 42) }
  set(l, l.input.heroId, hp)
  const gk = oppKeeper(l)
  set(l, gk?.player.id, { x: 101.5, y: 34 + (hp.y - 34) * 0.3 })
  const chasers = nearest(l, l.opps, hp, 2, new Set([gk?.player.id ?? '']))
  chasers.forEach((c, i) => set(l, c.player.id, { x: hp.x - 3 - i * 3, y: hp.y + (i ? 3 : -3) }))
  const passer = pickMate(l, (m) => relationWeight(m) * (['CM', 'AM', 'DM'].includes(roleOf(m)) ? 2 : 0.6))
  if (passer) set(l, passer.player.id, { x: hp.x - rng.range(18, 26), y: hp.y + rng.range(-12, 12) })
  return { ball: owned(hp, l.input.heroId), passerId: passer?.player.id ?? null, finisherId: null, opponentId: gk?.player.id ?? null }
}

/** Packs attackers into the box and puts a defender on each. */
function fillBox(l: Layout, attackers: readonly SlotPlayer[], skip: ReadonlySet<string>): void {
  const rng = l.input.rng
  const markers = l.opps.filter((o) => roleOf(o) !== 'GK' && !skip.has(o.player.id))
  attackers.forEach((a, i) => {
    if (skip.has(a.player.id)) return
    const p = { x: rng.range(90, 99), y: 22 + ((i * 7) % 26) + rng.range(-2, 2) }
    set(l, a.player.id, p)
    const m = markers[i]
    if (m) set(l, m.player.id, { x: p.x + 1.2, y: p.y + rng.range(-1, 1) })
  })
}

const placeCross: Placer = (l) => {
  const rng = l.input.rng
  const heroWide = WIDE.has(roleOf(heroSlot(l)))
  const flankY = heroFlankY(l)
  const gk = oppKeeper(l)
  set(l, gk?.player.id, { x: 102, y: 34 + (flankY - 34) * 0.1 })
  if (heroWide) {
    const hp = { x: rng.range(84, 92), y: flankY + (flankY < 34 ? 2 : -2) }
    set(l, l.input.heroId, hp)
    const strikers = l.mates.filter((m) => ATTACKERS.has(roleOf(m)) && m.player.id !== l.input.heroId).slice(0, 3)
    fillBox(l, strikers, new Set([gk?.player.id ?? '']))
    closeDown(l, nearest(l, l.opps, hp, 1, new Set([gk?.player.id ?? ''])), hp, 3, 0)
    const finisher = strikers[0] ?? pickMate(l, relationWeight)
    return { ball: owned(hp, l.input.heroId), passerId: null, finisherId: finisher?.player.id ?? null, opponentId: gk?.player.id ?? null }
  }
  const crosser = pickMate(l, (m) => relationWeight(m) * (WIDE.has(roleOf(m)) ? 3 : 0.3) * (m.player.attrs.crossing + 1))
  const cp = { x: rng.range(86, 92), y: flankY }
  set(l, crosser?.player.id, cp)
  const hp = { x: rng.range(93, 98), y: rng.range(28, 40) }
  set(l, l.input.heroId, hp)
  const others = l.mates.filter((m) => ATTACKERS.has(roleOf(m)) && m.player.id !== l.input.heroId && m !== crosser).slice(0, 2)
  fillBox(l, others, new Set([gk?.player.id ?? '']))
  closeDown(l, nearest(l, l.opps, hp, 1, new Set([gk?.player.id ?? ''])), hp, 1.5, PITCH_LENGTH)
  return { ball: owned(cp, crosser?.player.id ?? null), passerId: crosser?.player.id ?? null, finisherId: null, opponentId: gk?.player.id ?? null }
}

const placeEdgeOfBox: Placer = (l) => {
  const rng = l.input.rng
  const hp = { x: rng.range(76, 83), y: rng.range(22, 46) }
  set(l, l.input.heroId, hp)
  const gk = oppKeeper(l)
  set(l, gk?.player.id, { x: 102.5, y: 34 })
  closeDown(l, nearest(l, l.opps, hp, 2, new Set([gk?.player.id ?? ''])), hp, 3.5, PITCH_LENGTH)
  const passer = pickMate(l, (m) => relationWeight(m) * (['CM', 'AM', 'LW', 'RW'].includes(roleOf(m)) ? 2 : 0.5))
  if (passer) set(l, passer.player.id, { x: hp.x - rng.range(8, 14), y: hp.y + rng.range(-14, 14) })
  return { ball: owned(hp, l.input.heroId), passerId: passer?.player.id ?? null, finisherId: null, opponentId: gk?.player.id ?? null }
}

const placeFreekick: Placer = (l) => {
  const rng = l.input.rng
  const bp = { x: rng.range(76, 84), y: rng.range(20, 48) }
  set(l, l.input.heroId, { x: bp.x - 2, y: bp.y - 1 })
  const gk = oppKeeper(l)
  set(l, gk?.player.id, { x: 103, y: 34 + (bp.y - 34) * 0.15 })
  // Wall of 4 at 9.15 m on the line ball → goal centre.
  const gx = PITCH_LENGTH - bp.x
  const gy = 34 - bp.y
  const len = Math.hypot(gx, gy) || 1
  const ux = gx / len
  const uy = gy / len
  const wall = nearest(l, l.opps, bp, 4, new Set([gk?.player.id ?? '']))
  wall.forEach((w, i) => {
    const off = (i - 1.5) * 0.75
    set(l, w.player.id, { x: bp.x + ux * 9.15 - uy * off, y: bp.y + uy * 9.15 + ux * off })
  })
  const others = l.mates.filter((m) => m.player.id !== l.input.heroId && roleOf(m) !== 'GK').slice(0, 4)
  fillBox(l, others, new Set([gk?.player.id ?? '', ...wall.map((w) => w.player.id)]))
  return { ball: owned(bp, l.input.heroId), passerId: null, finisherId: null, opponentId: gk?.player.id ?? null }
}

const placePenalty: Placer = (l) => {
  const rng = l.input.rng
  const bp = { x: PITCH_LENGTH - 11, y: 34 }
  set(l, l.input.heroId, { x: bp.x - 1.6, y: 34 })
  const gk = oppKeeper(l)
  set(l, gk?.player.id, { x: PITCH_LENGTH - 0.4, y: 34 })
  const rest = [...l.mates, ...l.opps].filter((sp) => sp.player.id !== l.input.heroId && sp !== gk && sp !== mateKeeper(l))
  rest.forEach((sp, i) => set(l, sp.player.id, { x: rng.range(84, 87.5), y: 16 + ((i * 2.4) % 36) }))
  return { ball: owned(bp, l.input.heroId), passerId: null, finisherId: null, opponentId: gk?.player.id ?? null }
}

const placeCorner: Placer = (l) => {
  const rng = l.input.rng
  const top = rng.chance(0.5)
  const bp = { x: PITCH_LENGTH - 0.5, y: top ? 0.5 : PITCH_WIDTH - 0.5 }
  const taker = pickMate(l, (m) => relationWeight(m) * (m.player.attrs.setPieces + m.player.attrs.crossing + 1))
  set(l, taker?.player.id, { x: bp.x - 0.8, y: bp.y + (top ? -0.3 : 0.3) })
  const gk = oppKeeper(l)
  set(l, gk?.player.id, { x: 104, y: 34 + (top ? -2 : 2) })
  const hp = { x: rng.range(93, 98), y: rng.range(28, 40) }
  set(l, l.input.heroId, hp)
  const tall = l.mates
    .filter((m) => m !== taker && m.player.id !== l.input.heroId && roleOf(m) !== 'GK')
    .sort((a, b) => b.player.attrs.heading - a.player.attrs.heading)
    .slice(0, 5)
  fillBox(l, tall, new Set([gk?.player.id ?? '']))
  closeDown(l, nearest(l, l.opps, hp, 1, new Set([gk?.player.id ?? ''])), hp, 1.2, PITCH_LENGTH)
  return { ball: owned(bp, taker?.player.id ?? null), passerId: taker?.player.id ?? null, finisherId: null, opponentId: gk?.player.id ?? null }
}

/** Opponent's most dangerous attacker (for defensive moments). */
function oppAttacker(l: Layout): SlotPlayer | undefined {
  const pool = l.opps.filter((o) => roleOf(o) !== 'GK')
  if (pool.length === 0) return undefined
  return l.input.rng.weighted(pool, (o) => (ATTACKERS.has(roleOf(o)) ? 3 : 0.4) * (o.player.ovr + 1))
}

const placeDefend: Placer = (l) => {
  const rng = l.input.rng
  const att = oppAttacker(l)
  const ap = { x: rng.range(24, 36), y: rng.range(14, 54) }
  set(l, att?.player.id, ap)
  set(l, l.input.heroId, { x: ap.x - rng.range(4, 7), y: ap.y + (34 - ap.y) * 0.3 })
  const keeper = mateKeeper(l)
  set(l, keeper?.player.id, { x: 3, y: 34 + (ap.y - 34) * 0.15 })
  const support = l.opps.filter((o) => o !== att && ATTACKERS.has(roleOf(o))).slice(0, 2)
  support.forEach((s, i) => set(l, s.player.id, { x: ap.x - 6 + i * 3, y: ap.y > 34 ? ap.y - 14 - i * 8 : ap.y + 14 + i * 8 }))
  return { ball: owned(ap, att?.player.id ?? null), passerId: null, finisherId: null, opponentId: att?.player.id ?? null }
}

const placeGkSave: Placer = (l) => {
  const rng = l.input.rng
  const att = oppAttacker(l)
  const ap = { x: rng.range(13, 22), y: rng.range(22, 46) }
  set(l, att?.player.id, ap)
  set(l, l.input.heroId, { x: 2.5, y: 34 + (ap.y - 34) * 0.35 })
  const defenders = nearest(l, l.mates, ap, 2, new Set([l.input.heroId]))
  defenders.forEach((d, i) => set(l, d.player.id, { x: ap.x - 2 + i * 3, y: ap.y + (i ? 4 : -4) }))
  return { ball: owned(ap, att?.player.id ?? null), passerId: null, finisherId: null, opponentId: att?.player.id ?? null }
}

const placeGkPenalty: Placer = (l) => {
  const rng = l.input.rng
  const taker = oppAttacker(l)
  const bp = { x: 11, y: 34 }
  set(l, taker?.player.id, { x: bp.x + 1.6, y: 34 })
  set(l, l.input.heroId, { x: 0.4, y: 34 })
  const oppGk = oppKeeper(l)
  const rest = [...l.mates, ...l.opps].filter((sp) => sp.player.id !== l.input.heroId && sp !== taker && sp !== oppGk)
  rest.forEach((sp, i) => set(l, sp.player.id, { x: rng.range(17.5, 21), y: 16 + ((i * 2.4) % 36) }))
  return { ball: owned(bp, taker?.player.id ?? null), passerId: null, finisherId: null, opponentId: taker?.player.id ?? null }
}

const PLACERS: Record<HighlightKind, Placer> = {
  build_up: placeBuildUp,
  counter: placeCounter,
  one_on_one: placeOneOnOne,
  cross: placeCross,
  edge_of_box: placeEdgeOfBox,
  freekick: placeFreekick,
  penalty: placePenalty,
  corner: placeCorner,
  defend: placeDefend,
  gk_save: placeGkSave,
  gk_penalty: placeGkPenalty,
}

function toScenarioPlayer(sp: SlotPlayer, side: Side, pos: Vec2): ScenarioPlayer {
  const p = sp.player
  return {
    id: p.id,
    side,
    pos: { x: Math.round(pos.x * 10) / 10, y: Math.round(pos.y * 10) / 10 },
    role: p.position,
    number: p.number,
    isHero: p.isHero,
    attrs: p.attrs,
    relationToHero: p.relationToHero,
  }
}

/**
 * Builds a complete highlight scenario with every on-pitch player positioned.
 * The hero's team always attacks toward +x.
 */
export function buildScenario(input: ScenarioInput): GeneratedScenario {
  const layout = baseLayout(input, input.rng.range(14, 54))
  const actors = PLACERS[input.kind](layout)
  const oppSide: Side = input.heroSide === 'home' ? 'away' : 'home'
  const players: ScenarioPlayer[] = [
    ...input.mates.map((sp) => toScenarioPlayer(sp, input.heroSide, layout.pos.get(sp.player.id) ?? { x: 50, y: 34 })),
    ...input.opps.map((sp) => toScenarioPlayer(sp, oppSide, layout.pos.get(sp.player.id) ?? { x: 55, y: 34 })),
  ]
  const owner = actors.ball.ownerId ? layout.pos.get(actors.ball.ownerId) : undefined
  const ball = { ...actors.ball, pos: owner ? { ...owner } : actors.ball.pos }
  if (input.kind === 'freekick' || input.kind === 'penalty' || input.kind === 'gk_penalty' || input.kind === 'corner') {
    ball.pos = actors.ball.pos // set-piece ball sits on its spot, not on the taker
  }
  return {
    scenario: {
      kind: input.kind,
      players,
      ball,
      timeLimit: TIME_LIMITS[input.kind],
      prompt: HIGHLIGHT_PROMPTS[input.kind][input.lang],
    },
    passerId: actors.passerId,
    finisherId: actors.finisherId,
    opponentId: actors.opponentId,
  }
}

// ───────────────────────── Hero involvement planning ─────────────────────────

/** How often each highlight kind occurs for a hero playing a given position. */
const KIND_WEIGHTS: Record<Position, Partial<Record<HighlightKind, number>>> = {
  ST: { build_up: 1, counter: 2, one_on_one: 2.5, cross: 2, edge_of_box: 2, corner: 1, defend: 0.3 },
  LW: { build_up: 1.5, counter: 2, one_on_one: 1.5, cross: 2.5, edge_of_box: 1.5, corner: 0.4, defend: 0.8 },
  RW: { build_up: 1.5, counter: 2, one_on_one: 1.5, cross: 2.5, edge_of_box: 1.5, corner: 0.4, defend: 0.8 },
  AM: { build_up: 2.5, counter: 1.5, one_on_one: 1.2, cross: 0.6, edge_of_box: 2.5, corner: 0.3, defend: 0.6 },
  CM: { build_up: 3, counter: 1.2, one_on_one: 0.5, cross: 0.5, edge_of_box: 1.8, corner: 0.5, defend: 1.5 },
  DM: { build_up: 3, counter: 0.8, one_on_one: 0.2, cross: 0.2, edge_of_box: 1, corner: 0.6, defend: 3 },
  LB: { build_up: 1.5, counter: 1, cross: 2, edge_of_box: 0.4, corner: 0.4, defend: 3.5 },
  RB: { build_up: 1.5, counter: 1, cross: 2, edge_of_box: 0.4, corner: 0.4, defend: 3.5 },
  CB: { build_up: 1, counter: 0.2, edge_of_box: 0.2, corner: 2.2, defend: 5 },
  GK: { gk_save: 1 },
}

/** Base number of open-play highlights per 90 minutes by position. */
const BASE_COUNT: Record<Position, number> = {
  ST: 7, LW: 6.5, RW: 6.5, AM: 6.5, CM: 6, DM: 5.5, LB: 5.5, RB: 5.5, CB: 5, GK: 5,
}

/** Minimum / maximum highlights per 90 minutes. */
export const HIGHLIGHTS_MIN_90 = 4
export const HIGHLIGHTS_MAX_90 = 9

/** Kind weights for a position (copy, safe to mutate). */
export function kindWeights(pos: Position): Partial<Record<HighlightKind, number>> {
  return { ...KIND_WEIGHTS[pos] }
}

/** Kinds where the hero's team is defending. */
export function isDefensiveKind(kind: HighlightKind): boolean {
  return kind === 'defend' || kind === 'gk_save' || kind === 'gk_penalty'
}

/**
 * Picks the kind of an open-play highlight. A trailing team late on pushes
 * forward (fewer defensive moments); a leading team sits deeper.
 */
export function pickHighlightKind(pos: Position, rng: Rng, goalDiff: number, minute: number): HighlightKind {
  const w = kindWeights(pos)
  const late = minute >= 70
  if (late && goalDiff < 0 && w.defend) w.defend *= 0.5
  if (late && goalDiff > 0 && w.defend) w.defend *= 1.6
  if (late && goalDiff > 0 && w.counter) w.counter *= 1.5
  const kinds = Object.keys(w) as HighlightKind[]
  return rng.weighted(kinds, (k) => w[k] ?? 0)
}

/** Inputs for {@link plannedHighlightCount}. */
export interface HighlightPlanInput {
  position: Position
  /** Average relationToHero of on-pitch teammates (-100..100). */
  relationAvg: number
  /** Team morale modifier 0.8..1.2. */
  morale: number
  /** Hero form 0..100 (50 neutral). */
  form: number
  /** Minutes the hero is expected to be on the pitch in this plan window. */
  minutes: number
}

/**
 * Number of open-play highlights to schedule. For a full 90 minutes this is
 * always within [4, 9]; shorter windows are prorated (at least 1 if ≥ 10').
 */
export function plannedHighlightCount(input: HighlightPlanInput, rng: Rng): number {
  let n = BASE_COUNT[input.position]
  n += clamp(input.relationAvg, -100, 100) * 0.015
  n += (input.morale - 1) * 5
  n += ((input.form - 50) / 50) * 1
  n += rng.normal(0, 0.8)
  const full = clamp(Math.round(n), HIGHLIGHTS_MIN_90, HIGHLIGHTS_MAX_90)
  if (input.minutes >= 89) return full
  if (input.minutes < 10) return 0
  return Math.max(1, Math.round((full * input.minutes) / 90))
}

/**
 * Spreads `count` highlight minutes over [from, to] (inclusive): the window is
 * cut into equal segments and one minute is drawn per segment, so moments are
 * spaced naturally. Minutes in `exclude` are avoided when possible.
 */
export function planHighlightMinutes(from: number, to: number, count: number, rng: Rng, exclude: readonly number[] = []): number[] {
  const out: number[] = []
  if (count <= 0 || to < from) return out
  const span = (to - from + 1) / count
  for (let i = 0; i < count; i++) {
    const lo = Math.floor(from + i * span)
    const hi = Math.max(lo, Math.floor(from + (i + 1) * span) - 1)
    let m = rng.int(lo, hi)
    for (let tries = 0; tries < 4 && (exclude.includes(m) || out.includes(m)); tries++) m = rng.int(lo, hi)
    if (!out.includes(m)) out.push(m)
  }
  return out
}
