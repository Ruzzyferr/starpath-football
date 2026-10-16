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
import type { Formation, Lang, Position, Role } from '../../core/types'
import { HIGHLIGHT_PROMPTS } from './commentary'
import { formationSlots } from './formations'
import type { ExpectedMoments, HighlightKind, HighlightScenario, MatchPlayer, ScenarioPlayer, Side, Vec2 } from './types'
import { DEFENSIVE_KINDS, PITCH_LENGTH, PITCH_WIDTH } from './types'

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
  // Hero + one runner break; the rest of both teams is behind the ball.
  counter_2v1: [14, 50, 52, 86],
  long_ball_control: [30, 72, 20, 50],
  rebound: [44, 90, 4, 26],
  interception: [10, 40, 50, 80],
  // Back to goal 30 m out: the opponents' back line is deep and tight.
  hold_up: [26, 66, 18, 44],
  // Isolated: the rest of both teams is upfield of the duel.
  defend_1v1: [12, 50, 44, 86],
  // Opponents camped on the edge of our box.
  block: [6, 36, 50, 86],
  // Hero's corner: both teams packed into the opponents' box.
  corner_kick: [55, 96, 4, 22],
  // Opposition free kick 18–28 m from our goal: everyone is back.
  fk_wall: [4, 30, 56, 88],
  // Take-on 30–40 m out: a back line set, one defender stepping out.
  dribble: [36, 78, 14, 44],
  // Open-play cross: both teams in and around the box.
  header: [44, 92, 6, 34],
  // Keeper 1v1 / sweeper: our line beaten, their forwards through.
  gk_1v1: [10, 46, 46, 86],
  gk_sweep: [14, 50, 48, 82],
  // Cross from their far flank into our box.
  back_post: [4, 34, 56, 92],
  // 25-30 m out, the opposition block deep and narrow.
  long_shot: [40, 80, 8, 38],
  // Our build-up on one flank, their press shifted across.
  switch_play: [18, 58, 30, 66],
  // We lost it upfield: our team high, their break on.
  recovery_run: [30, 70, 40, 86],
  // A ball into the channel behind their line.
  shoulder_duel: [34, 74, 16, 42],
  // On their last line: a high line set at the edge of their third.
  timed_run: [40, 80, 20, 44],
  // They build from the back, our front line presses high.
  press_trap: [52, 92, 4, 46],
  // Cross into our box: everyone back.
  gk_claim: [4, 34, 56, 92],
  // Ball in our keeper's hands, their front line pressing high.
  gk_distribution: [8, 40, 46, 80],
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
  counter_2v1: 10,
  long_ball_control: 10,
  rebound: 8,
  interception: 10,
  hold_up: 10,
  defend_1v1: 10,
  block: 8,
  // The delivery picker / wall setup does not count against the clock.
  corner_kick: 9,
  fk_wall: 8,
  // Plan 2.1#36: a dribbling moment lasts 3–8 s.
  dribble: 8,
  header: 8,
  gk_1v1: 8,
  gk_sweep: 8,
  back_post: 8,
  long_shot: 8,
  switch_play: 10,
  recovery_run: 12,
  shoulder_duel: 9,
  timed_run: 10,
  press_trap: 10,
  gk_claim: 8,
  gk_distribution: 9,
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
    const s = (mateSlots[sp.slot] ?? mateSlots[0])!
    const x = s.role === 'GK' ? Math.max(4, mb - 18) : bandX(s.x, mb, mf)
    pos.set(sp.player.id, inPitch({ x: x + jitter(), y: s.y + shiftY * (s.role === 'GK' ? 0.2 : 1) + jitter() }))
  }
  for (const sp of input.opps) {
    const s = (oppSlots[sp.slot] ?? oppSlots[0])!
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

/**
 * Moves every opponent not named in `keep` well behind the play (playtest: a "one-on-one" or a "2-on-1" read as a
 * crowd because the rest of the back line stood in its formation spots around the hero).
 */
function clearBehind(l: Layout, keep: ReadonlySet<string>, fromX: number): void {
  const rng = l.input.rng
  l.opps.forEach((o, i) => {
    if (keep.has(o.player.id) || roleOf(o) === 'GK') return
    set(l, o.player.id, { x: fromX - rng.range(16, 30), y: clamp(8 + ((i * 11) % 52) + rng.range(-3, 3), 4, PITCH_WIDTH - 4) })
  })
}

const placeOneOnOne: Placer = (l) => {
  const rng = l.input.rng
  const hp = { x: rng.range(80, 87), y: rng.range(26, 42) }
  set(l, l.input.heroId, hp)
  const gk = oppKeeper(l)
  set(l, gk?.player.id, { x: 101.5, y: 34 + (hp.y - 34) * 0.3 })
  const chasers = nearest(l, l.opps, hp, 2, new Set([gk?.player.id ?? '']))
  chasers.forEach((c, i) => set(l, c.player.id, { x: hp.x - 3 - i * 3, y: hp.y + (i ? 3 : -3) }))
  clearBehind(l, new Set(chasers.map((c) => c.player.id)), hp.x)
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
    // His best headers attack the box (playtest: a 20-Heading winger was the target and lost every header).
    const strikers = l.mates
      .filter((m) => m.player.id !== l.input.heroId && roleOf(m) !== 'GK' && !['CB', 'LB', 'RB'].includes(roleOf(m)))
      .sort((a, b) => b.player.attrs.heading + (ATTACKERS.has(roleOf(b)) ? 15 : 0) - (a.player.attrs.heading + (ATTACKERS.has(roleOf(a)) ? 15 : 0)))
      .slice(0, 3)
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

/**
 * corner_kick: the hero stands over the ball at the corner flag; the best
 * headers attack the box, one team-mate offers a short option.
 */
const placeCornerKick: Placer = (l) => {
  const rng = l.input.rng
  const top = rng.chance(0.5)
  const bp = { x: PITCH_LENGTH - 0.5, y: top ? 0.5 : PITCH_WIDTH - 0.5 }
  set(l, l.input.heroId, { x: bp.x - 0.8, y: bp.y + (top ? -0.3 : 0.3) })
  const gk = oppKeeper(l)
  set(l, gk?.player.id, { x: 104, y: 34 + (top ? -2 : 2) })
  const outfield = l.mates.filter((m) => m.player.id !== l.input.heroId && roleOf(m) !== 'GK')
  const tall = [...outfield].sort((a, b) => b.player.attrs.heading - a.player.attrs.heading || (a.player.id < b.player.id ? -1 : 1)).slice(0, 5)
  fillBox(l, tall, new Set([gk?.player.id ?? '']))
  // Short option: a passer drifts toward the corner, 10 m in from the flag.
  const short = pickMate(l, (m) => (tall.includes(m) ? 0.05 : 1) * relationWeight(m) * (m.player.attrs.passing + 1))
  if (short) set(l, short.player.id, { x: PITCH_LENGTH - rng.range(9, 12), y: top ? rng.range(8, 11) : PITCH_WIDTH - rng.range(8, 11) })
  const finisher = tall[0] ?? null
  return { ball: owned(bp, l.input.heroId), passerId: null, finisherId: finisher?.player.id ?? null, opponentId: gk?.player.id ?? null }
}

/**
 * fk_wall: the opponents have a direct free kick 18–28 m out; a wall of four
 * stands by default (the hero re-sets it in the runtime). The hero is in goal
 * (keeper) or in the wall (captain).
 */
const placeFkWall: Placer = (l) => {
  const rng = l.input.rng
  const bp = { x: rng.range(18, 27), y: rng.range(20, 48) }
  const taker = l.input.rng.weighted(
    l.opps.filter((o) => roleOf(o) !== 'GK'),
    (o) => (o.player.attrs.setPieces + o.player.attrs.shooting + 1) ** 2,
  )
  set(l, taker?.player.id, { x: bp.x + 1.4, y: bp.y + 0.6 })
  const keeper = mateKeeper(l)
  const heroIsGk = roleOf(heroSlot(l)) === 'GK'
  const gkId = heroIsGk ? l.input.heroId : keeper?.player.id
  set(l, gkId, { x: 1, y: 34 + (bp.y - 34) * 0.15 })
  // Default wall of four on the ball → near-post line.
  const nearY = bp.y < 34 ? 32.2 : 35.8
  const len = Math.hypot(bp.x, nearY - bp.y) || 1
  const ux = -bp.x / len
  const uy = (nearY - bp.y) / len
  const skip = new Set([gkId ?? ''])
  const wall = heroIsGk ? nearest(l, l.mates, bp, 4, skip) : [heroSlot(l), ...nearest(l, l.mates, bp, 3, new Set([...skip, l.input.heroId]))]
  wall.forEach((w, i) => {
    const off = (i - 1.5) * 0.62
    set(l, w.player.id, { x: bp.x + ux * 9.15 - uy * off, y: bp.y + uy * 9.15 + ux * off })
  })
  // Their runners and our markers in the box.
  const runners = l.opps.filter((o) => o !== taker && roleOf(o) !== 'GK').sort((a, b) => b.player.attrs.heading - a.player.attrs.heading).slice(0, 4)
  const wallIds = new Set(wall.map((w) => w.player.id))
  const markers = l.mates.filter((m) => !wallIds.has(m.player.id) && m.player.id !== gkId && roleOf(m) !== 'GK')
  runners.forEach((r, i) => {
    const p = { x: rng.range(7, 15), y: 24 + ((i * 6) % 20) + rng.range(-1.5, 1.5) }
    set(l, r.player.id, p)
    const m = markers[i]
    if (m) set(l, m.player.id, { x: p.x - 1.1, y: p.y + rng.range(-0.8, 0.8) })
  })
  return { ball: owned(bp, taker?.player.id ?? null), passerId: null, finisherId: null, opponentId: taker?.player.id ?? null }
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
  const ap = { x: rng.range(26, 38), y: rng.range(14, 54) }
  set(l, att?.player.id, ap)
  const hp = { x: ap.x - rng.range(4, 7), y: ap.y + (34 - ap.y) * 0.3 }
  set(l, l.input.heroId, hp)
  const keeper = mateKeeper(l)
  set(l, keeper?.player.id, { x: 3, y: 34 + (ap.y - 34) * 0.15 })
  // A break: the opponents' runners join the carrier...
  const support = l.opps.filter((o) => o !== att && ATTACKERS.has(roleOf(o))).slice(0, 2)
  support.forEach((s, i) => set(l, s.player.id, { x: ap.x - 4 + i * 4, y: ap.y > 34 ? ap.y - 12 - i * 9 : ap.y + 12 + i * 9 }))
  // ...while one team-mate is back with the hero; the rest are recovering from upfield.
  const skip = new Set([l.input.heroId, keeper?.player.id ?? ''])
  const backs = nearest(l, l.mates, { x: 12, y: 34 }, 0, skip)
  backs.forEach((b, i) => set(l, b.player.id, { x: rng.range(10, 16), y: 34 + (i ? 1 : -1) * rng.range(6, 12) }))
  for (const b of backs) skip.add(b.player.id)
  for (const m of l.mates) {
    if (skip.has(m.player.id) || roleOf(m) === 'GK') continue
    const p = l.pos.get(m.player.id)
    if (p) set(l, m.player.id, { x: Math.max(p.x, ap.x + rng.range(8, 22)), y: p.y })
  }
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

const placeCounter2v1: Placer = (l) => {
  const rng = l.input.rng
  const hp = { x: rng.range(58, 68), y: rng.range(20, 48) }
  set(l, l.input.heroId, hp)
  const runner = pickMate(l, (m) => relationWeight(m) * (ATTACKERS.has(roleOf(m)) ? 3 : 0.4) * (m.player.attrs.pace + 20))
  const ry = hp.y > 34 ? hp.y - rng.range(11, 15) : hp.y + rng.range(11, 15)
  if (runner) set(l, runner.player.id, { x: hp.x + rng.range(-1, 3), y: ry })
  const gk = oppKeeper(l)
  set(l, gk?.player.id, { x: 102.5, y: 34 + (hp.y - 34) * 0.15 })
  const skip = new Set([gk?.player.id ?? ''])
  // The last defender: between the two attackers, goal-side.
  const lastMan = l.opps
    .filter((o) => roleOf(o) !== 'GK')
    .sort((a, b) => (roleOf(a) === 'CB' ? 0 : 1) - (roleOf(b) === 'CB' ? 0 : 1) || (a.player.id < b.player.id ? -1 : 1))[0]
  if (lastMan) {
    set(l, lastMan.player.id, { x: hp.x + rng.range(13, 18), y: (hp.y + ry) / 2 + rng.range(-2, 2) })
    skip.add(lastMan.player.id)
  }
  // Two recovering chasers a few meters behind the hero.
  nearest(l, l.opps, hp, 2, skip).forEach((c, i) => set(l, c.player.id, { x: hp.x - rng.range(6, 10) - i * 2, y: hp.y + (i ? 4 : -4) }))
  return { ball: owned(hp, l.input.heroId), passerId: null, finisherId: runner?.player.id ?? null, opponentId: gk?.player.id ?? null }
}

const placeLongBall: Placer = (l) => {
  const rng = l.input.rng
  const hp = { x: rng.range(60, 74), y: rng.range(14, 54) }
  set(l, l.input.heroId, hp)
  const passer = pickMate(l, (m) => relationWeight(m) * (['CB', 'DM', 'CM', 'LB', 'RB'].includes(roleOf(m)) ? 2 : 0.4) * (m.player.attrs.passing + 20))
  const pp = { x: hp.x - rng.range(28, 38), y: clamp(hp.y + rng.range(-18, 18), 6, 62) }
  if (passer) set(l, passer.player.id, pp)
  const gk = oppKeeper(l)
  const skip = new Set([gk?.player.id ?? ''])
  // Tight marker on the hero's back (goal-side) and a covering defender.
  const [marker, cover] = nearest(l, l.opps, hp, 2, skip)
  if (marker) set(l, marker.player.id, { x: hp.x + rng.range(1.2, 2), y: hp.y + rng.range(-0.8, 0.8) })
  if (cover) set(l, cover.player.id, { x: hp.x + rng.range(7, 10), y: hp.y + (hp.y > 34 ? -1 : 1) * rng.range(5, 8) })
  return { ball: owned(pp, passer?.player.id ?? null), passerId: passer?.player.id ?? null, finisherId: null, opponentId: marker?.player.id ?? null }
}

const placeRebound: Placer = (l) => {
  const rng = l.input.rng
  const gk = oppKeeper(l)
  const gy = 34 + rng.range(-2, 2)
  set(l, gk?.player.id, { x: 103.4, y: gy })
  const shooter = pickMate(l, (m) => (ATTACKERS.has(roleOf(m)) ? 3 : 0.5) * (m.player.attrs.shooting + 10))
  if (shooter) set(l, shooter.player.id, { x: rng.range(84, 89), y: rng.range(24, 44) })
  const side = rng.chance(0.5) ? 1 : -1
  const bp = { x: 101.4, y: gy + side * rng.range(1.2, 2.4) }
  const hp = { x: rng.range(91, 95), y: clamp(34 + rng.range(-8, 8), 26, 42) }
  set(l, l.input.heroId, hp)
  // Defenders scrambling in the box (some closer to the ball than the hero, some behind).
  const skip = new Set([gk?.player.id ?? ''])
  // Defenders were tracking the shot: one goal-side near the post, the others caught a few meters off.
  nearest(l, l.opps, bp, 3, skip).forEach((d, i) => {
    const r = i === 0 ? rng.range(4.5, 7) : rng.range(6, 10)
    const ang = Math.PI + (i % 2 ? 1 : -1) * rng.range(0.5, 1.2)
    set(l, d.player.id, { x: clamp(bp.x + Math.cos(ang) * r, 88, 103.5), y: bp.y + Math.sin(ang) * r })
  })
  const other = l.mates.find((m) => m !== shooter && ATTACKERS.has(roleOf(m)) && m.player.id !== l.input.heroId)
  if (other) set(l, other.player.id, { x: rng.range(90, 96), y: 34 - (hp.y - 34) + rng.range(-2, 2) })
  const vel = { x: -rng.range(4.5, 8), y: side * rng.range(1, 4) }
  return {
    ball: { pos: bp, z: 0.25, ownerId: null, vel },
    passerId: null,
    finisherId: null,
    opponentId: gk?.player.id ?? null,
  }
}

const placeInterception: Placer = (l) => {
  const rng = l.input.rng
  const pool = l.opps.filter((o) => roleOf(o) !== 'GK')
  const carrier = pool.length ? rng.weighted(pool, (o) => (['CM', 'AM', 'DM', 'LW', 'RW'].includes(roleOf(o)) ? 3 : 0.4) * (o.player.attrs.passing + 10)) : undefined
  const cp = { x: rng.range(42, 52), y: rng.range(18, 50) }
  set(l, carrier?.player.id, cp)
  const runner = l.opps.filter((o) => o !== carrier && ATTACKERS.has(roleOf(o)))[0] ?? l.opps.find((o) => o !== carrier && roleOf(o) !== 'GK')
  const rp = { x: rng.range(22, 30), y: clamp(cp.y + rng.range(-12, 12), 10, 58) }
  set(l, runner?.player.id, rp)
  // Hero near the lane (not on it): must read the pass and step in.
  const t = rng.range(0.45, 0.65)
  const lane = { x: cp.x + (rp.x - cp.x) * t, y: cp.y + (rp.y - cp.y) * t }
  const dx = rp.x - cp.x
  const dy = rp.y - cp.y
  const n = Math.hypot(dx, dy) || 1
  const off = rng.range(3, 5) * (rng.chance(0.5) ? 1 : -1)
  set(l, l.input.heroId, { x: lane.x - (dy / n) * off - 1.5, y: lane.y + (dx / n) * off })
  const keeper = mateKeeper(l)
  set(l, keeper?.player.id, { x: 3, y: 34 + (cp.y - 34) * 0.12 })
  return { ball: owned(cp, carrier?.player.id ?? null), passerId: null, finisherId: null, opponentId: runner?.player.id ?? null }
}

const placeHoldUp: Placer = (l) => {
  const rng = l.input.rng
  const hp = { x: rng.range(64, 76), y: rng.range(20, 48) }
  set(l, l.input.heroId, hp)
  const gk = oppKeeper(l)
  const skip = new Set([gk?.player.id ?? ''])
  // A centre-back tight on his back (goal-side), a second defender closing from the side.
  const [marker, closer] = nearest(l, l.opps, hp, 2, skip)
  if (marker) set(l, marker.player.id, { x: hp.x + rng.range(0.9, 1.3), y: hp.y + rng.range(-0.5, 0.5) })
  const side = hp.y > 34 ? -1 : 1
  if (closer) set(l, closer.player.id, { x: hp.x + rng.range(3, 5), y: hp.y + side * rng.range(3, 5) })
  // Support arriving: a midfielder for the lay-off, a runner going beyond.
  const support = pickMate(l, (m) => relationWeight(m) * (['CM', 'AM', 'DM'].includes(roleOf(m)) ? 3 : 0.4))
  if (support) set(l, support.player.id, { x: hp.x - rng.range(9, 13), y: hp.y + rng.range(-8, 8) })
  const runner = l.mates.find((m) => m !== support && m.player.id !== l.input.heroId && ATTACKERS.has(roleOf(m)))
  if (runner) set(l, runner.player.id, { x: hp.x + rng.range(-2, 3), y: hp.y + side * rng.range(12, 16) })
  return { ball: owned(hp, l.input.heroId), passerId: support?.player.id ?? null, finisherId: runner?.player.id ?? null, opponentId: marker?.player.id ?? null }
}

const placeDefend1v1: Placer = (l) => {
  const rng = l.input.rng
  // A wide forward / winger isolated against the hero with space behind him.
  const pool = l.opps.filter((o) => roleOf(o) !== 'GK')
  const att = pool.length ? rng.weighted(pool, (o) => (['LW', 'RW', 'ST'].includes(roleOf(o)) ? 3 : 0.3) * (o.player.attrs.dribbling + 10)) : undefined
  const ap = { x: rng.range(30, 40), y: rng.range(14, 54) }
  set(l, att?.player.id, ap)
  const hp = { x: ap.x - rng.range(4.5, 6.5), y: ap.y + (34 - ap.y) * 0.25 }
  set(l, l.input.heroId, hp)
  const keeper = mateKeeper(l)
  set(l, keeper?.player.id, { x: 3, y: 34 + (ap.y - 34) * 0.15 })
  // Nobody else near: team-mates recovering from upfield, opponents' support trailing.
  const skip = new Set([l.input.heroId, keeper?.player.id ?? '', att?.player.id ?? ''])
  for (const m of l.mates) {
    if (skip.has(m.player.id) || roleOf(m) === 'GK') continue
    const p = l.pos.get(m.player.id)
    if (p) set(l, m.player.id, { x: Math.max(p.x, ap.x + rng.range(10, 24)), y: p.y })
  }
  for (const o of l.opps) {
    if (skip.has(o.player.id) || roleOf(o) === 'GK') continue
    const p = l.pos.get(o.player.id)
    if (p) set(l, o.player.id, { x: Math.max(p.x, ap.x + rng.range(8, 20)), y: p.y })
  }
  return { ball: owned(ap, att?.player.id ?? null), passerId: null, finisherId: null, opponentId: att?.player.id ?? null }
}

const placeBlock: Placer = (l) => {
  const rng = l.input.rng
  // A shooter with the ball on the edge of our box, lining one up.
  const pool = l.opps.filter((o) => roleOf(o) !== 'GK')
  const att = pool.length ? rng.weighted(pool, (o) => (ATTACKERS.has(roleOf(o)) || roleOf(o) === 'CM' ? 3 : 0.4) * (o.player.attrs.shooting + 10)) : undefined
  const ap = { x: rng.range(18, 24), y: rng.range(22, 46) }
  set(l, att?.player.id, ap)
  // The hero a few meters off the shooting line (goal-side): he must step across.
  const toGoal = { x: -ap.x, y: 34 - ap.y }
  const n = Math.hypot(toGoal.x, toGoal.y) || 1
  const along = rng.range(2.5, 4)
  const off = rng.range(2.2, 3.6) * (rng.chance(0.5) ? 1 : -1)
  set(l, l.input.heroId, { x: ap.x + (toGoal.x / n) * along - (toGoal.y / n) * off, y: ap.y + (toGoal.y / n) * along + (toGoal.x / n) * off })
  const keeper = mateKeeper(l)
  set(l, keeper?.player.id, { x: 2.5, y: 34 + (ap.y - 34) * 0.2 })
  // Bodies in the box: a couple of defenders marking runners.
  const skip = new Set([l.input.heroId, keeper?.player.id ?? '', att?.player.id ?? ''])
  const runners = l.opps.filter((o) => !skip.has(o.player.id) && ATTACKERS.has(roleOf(o))).slice(0, 2)
  runners.forEach((r, i) => {
    const rp = { x: rng.range(8, 14), y: 34 + (i ? 1 : -1) * rng.range(4, 9) }
    set(l, r.player.id, rp)
    const m = nearest(l, l.mates, rp, 1, skip)[0]
    if (m) {
      set(l, m.player.id, { x: rp.x - 1, y: rp.y + rng.range(-0.8, 0.8) })
      skip.add(m.player.id)
    }
  })
  return { ball: owned(ap, att?.player.id ?? null), passerId: null, finisherId: null, opponentId: att?.player.id ?? null }
}

const placeDribble: Placer = (l) => {
  const rng = l.input.rng
  const hp = { x: rng.range(62, 76), y: rng.range(12, 56) }
  set(l, l.input.heroId, hp)
  const gk = oppKeeper(l)
  const skip = new Set([gk?.player.id ?? ''])
  // One defender squared up in front, a second covering behind him.
  const [man, cover] = nearest(l, l.opps, hp, 2, skip)
  if (man) set(l, man.player.id, { x: hp.x + rng.range(4.5, 6), y: hp.y + rng.range(-1, 1) })
  if (cover) set(l, cover.player.id, { x: hp.x + rng.range(11, 15), y: hp.y + (34 - hp.y) * 0.4 })
  const passer = pickMate(l, (m) => relationWeight(m) * (['CM', 'DM', 'LB', 'RB'].includes(roleOf(m)) ? 2 : 0.5))
  if (passer) set(l, passer.player.id, { x: hp.x - rng.range(8, 12), y: hp.y + rng.range(-8, 8) })
  return { ball: owned(hp, l.input.heroId), passerId: passer?.player.id ?? null, finisherId: null, opponentId: man?.player.id ?? null }
}

const placeHeader: Placer = (l) => {
  const rng = l.input.rng
  const flankY = rng.chance(0.5) ? 5 : PITCH_WIDTH - 5
  const gk = oppKeeper(l)
  set(l, gk?.player.id, { x: 102, y: 34 + (flankY - 34) * 0.1 })
  const crosser = pickMate(l, (m) => (m.player.id === l.input.heroId ? 0 : relationWeight(m) * (WIDE.has(roleOf(m)) ? 3 : 0.3) * (m.player.attrs.crossing + 1)))
  const cp = { x: rng.range(84, 92), y: flankY }
  set(l, crosser?.player.id, cp)
  const hp = { x: rng.range(92, 97), y: rng.range(28, 40) }
  set(l, l.input.heroId, hp)
  const others = l.mates.filter((m) => ATTACKERS.has(roleOf(m)) && m.player.id !== l.input.heroId && m !== crosser).slice(0, 2)
  fillBox(l, others, new Set([gk?.player.id ?? '']))
  // His marker a stride off him (playtest: at 1.4 m goal-side the marker met every cross first, the header was never
  // his to win); the duel in the air is then Heading / Jumping and the timing of his leap.
  closeDown(l, nearest(l, l.opps, hp, 1, new Set([gk?.player.id ?? ''])), hp, 2.4, PITCH_LENGTH)
  closeDown(l, nearest(l, l.opps, cp, 1, new Set([gk?.player.id ?? ''])), cp, 4, PITCH_LENGTH)
  return { ball: owned(cp, crosser?.player.id ?? null), passerId: crosser?.player.id ?? null, finisherId: null, opponentId: gk?.player.id ?? null }
}

const placeGk1v1: Placer = (l) => {
  const rng = l.input.rng
  const att = oppAttacker(l)
  const ap = { x: rng.range(22, 30), y: rng.range(24, 44) }
  set(l, att?.player.id, ap)
  set(l, l.input.heroId, { x: 3.5, y: 34 + (ap.y - 34) * 0.3 })
  // Our defenders are beaten: chasing from behind the attacker.
  const chasers = nearest(l, l.mates, ap, 2, new Set([l.input.heroId]))
  chasers.forEach((c, i) => set(l, c.player.id, { x: ap.x + 3 + i * 3, y: ap.y + (i ? 3 : -3) }))
  // A one-on-one: everyone else is upfield, behind the play (playtest: ten players piled into the box with them).
  const keep = new Set([att?.player.id ?? '', l.input.heroId, ...chasers.map((c) => c.player.id)])
  ;[...l.opps, ...l.mates].forEach((p, i) => {
    if (keep.has(p.player.id) || roleOf(p) === 'GK') return
    set(l, p.player.id, { x: ap.x + rng.range(12, 24), y: clamp(8 + ((i * 11) % 52) + rng.range(-3, 3), 4, PITCH_WIDTH - 4) })
  })
  return { ball: owned(ap, att?.player.id ?? null), passerId: null, finisherId: null, opponentId: att?.player.id ?? null }
}

const placeGkSweep: Placer = (l) => {
  const rng = l.input.rng
  const att = oppAttacker(l)
  // The ball has just been played over our line from midfield (the runtime gives it pace).
  const bp = { x: rng.range(30, 36), y: rng.range(22, 46) }
  // Their forward is already running in behind, a stride or two ahead of the ball.
  const ap = { x: bp.x - rng.range(1, 3), y: bp.y + rng.range(-3, 3) }
  set(l, att?.player.id, ap)
  set(l, l.input.heroId, { x: 3, y: 34 + (bp.y - 34) * 0.2 })
  const backs = nearest(l, l.mates, ap, 2, new Set([l.input.heroId]))
  backs.forEach((c, i) => set(l, c.player.id, { x: ap.x + 6 + i * 3, y: ap.y + (i ? 6 : -6) }))
  // The ball over the top is the keeper's or the forward's: the rest are upfield (playtest: a centre-back got there first
  // and the moment ended before the keeper could do anything).
  const keep = new Set([att?.player.id ?? '', l.input.heroId, ...backs.map((c) => c.player.id)])
  ;[...l.opps, ...l.mates].forEach((p, i) => {
    if (keep.has(p.player.id) || roleOf(p) === 'GK') return
    const q = l.pos.get(p.player.id)
    if (q && q.x < ap.x + 8) set(l, p.player.id, { x: ap.x + rng.range(10, 22), y: clamp(8 + ((i * 11) % 52) + rng.range(-3, 3), 4, PITCH_WIDTH - 4) })
  })
  return { ball: owned(bp, null), passerId: null, finisherId: null, opponentId: att?.player.id ?? null }
}

const placeBackPost: Placer = (l) => {
  const rng = l.input.rng
  // Their winger on the far flank (we defend x = 0); the hero tucks in at the back post.
  const top = rng.chance(0.5)
  const pool = l.opps.filter((o) => roleOf(o) !== 'GK')
  const crosser = pool.length ? rng.weighted(pool, (o) => (WIDE.has(roleOf(o)) ? 3 : 0.3) * (o.player.attrs.crossing + 5)) : undefined
  const cp = { x: rng.range(12, 20), y: top ? 4 : PITCH_WIDTH - 4 }
  set(l, crosser?.player.id, cp)
  const farY = top ? 34 + rng.range(4, 7) : 34 - rng.range(4, 7)
  const runner = pool.find((o) => o !== crosser && ATTACKERS.has(roleOf(o)))
  set(l, runner?.player.id, { x: rng.range(9, 13), y: farY + (top ? 3 : -3) })
  set(l, l.input.heroId, { x: rng.range(5, 8), y: farY })
  const keeper = mateKeeper(l)
  set(l, keeper?.player.id, { x: 1.2, y: 34 + (cp.y - 34) * 0.12 })
  const near = l.opps.filter((o) => o !== crosser && o !== runner && ATTACKERS.has(roleOf(o))).slice(0, 2)
  near.forEach((n, i) => set(l, n.player.id, { x: rng.range(8, 12), y: 34 + (top ? -1 : 1) * (2 + i * 4) }))
  const cbs = nearest(l, l.mates, { x: 8, y: 34 }, 2, new Set([l.input.heroId, keeper?.player.id ?? '']))
  cbs.forEach((c, i) => set(l, c.player.id, { x: rng.range(6, 9), y: 34 + (top ? -1 : 1) * (1 + i * 4) }))
  return { ball: owned(cp, crosser?.player.id ?? null), passerId: null, finisherId: null, opponentId: runner?.player.id ?? null }
}

// ───────────────────────── Attribute moments ─────────────────────────

/** long_shot: 25–30 m out with room to strike; their back line has dropped to the box. */
const placeLongShot: Placer = (l) => {
  const rng = l.input.rng
  const hp = { x: rng.range(75, 80), y: rng.range(22, 46) }
  set(l, l.input.heroId, hp)
  const gk = oppKeeper(l)
  set(l, gk?.player.id, { x: 102.5, y: 34 })
  const skip = new Set([gk?.player.id ?? ''])
  // The block has dropped: the nearest midfielder is 6–8 m off him, the back line at the box.
  const [closer, ...rest] = nearest(l, l.opps, hp, 5, skip)
  if (closer) set(l, closer.player.id, { x: hp.x + rng.range(6, 8), y: hp.y + rng.range(-2, 2) })
  rest.forEach((o, i) => set(l, o.player.id, { x: rng.range(87, 90), y: 22 + i * 8 + rng.range(-1.5, 1.5) }))
  const passer = pickMate(l, (m) => relationWeight(m) * (['CM', 'AM', 'DM'].includes(roleOf(m)) ? 2 : 0.5))
  if (passer) set(l, passer.player.id, { x: hp.x - rng.range(8, 14), y: hp.y + rng.range(-12, 12) })
  return { ball: owned(hp, l.input.heroId), passerId: passer?.player.id ?? null, finisherId: null, opponentId: gk?.player.id ?? null }
}

/** switch_play: pressed on one flank, near options marked, the far-side wide man free. */
const placeSwitchPlay: Placer = (l) => {
  const rng = l.input.rng
  const top = (l.pos.get(l.input.heroId)?.y ?? 34) < PITCH_WIDTH / 2
  const hp = { x: rng.range(36, 52), y: top ? rng.range(10, 18) : rng.range(50, 58) }
  set(l, l.input.heroId, hp)
  const gk = oppKeeper(l)
  const skip = new Set([gk?.player.id ?? ''])
  // Their press has shifted across to the ball side.
  for (const o of l.opps) {
    if (o === gk) continue
    const p = l.pos.get(o.player.id)
    if (p) set(l, o.player.id, { x: p.x, y: p.y * 0.55 + hp.y * 0.45 })
  }
  // Two pressers on the hero.
  const pressers = nearest(l, l.opps, hp, 2, skip)
  pressers.forEach((o, i) => {
    skip.add(o.player.id)
    set(l, o.player.id, { x: hp.x + (i ? rng.range(1, 3) : rng.range(4, 5)), y: hp.y + (top ? 1 : -1) * (i ? rng.range(4, 5) : rng.range(-1, 1)) })
  })
  // The far-side wide man: free on the opposite flank.
  const farY = top ? rng.range(58, 63) : rng.range(5, 10)
  const wide = pickMate(l, (m) => relationWeight(m) * (WIDE.has(roleOf(m)) ? 4 : ['CM', 'AM'].includes(roleOf(m)) ? 0.6 : 0.2) * (Math.abs((l.pos.get(m.player.id)?.y ?? 34) - hp.y) > 20 ? 2 : 0.5))
  const fp = { x: hp.x + rng.range(6, 16), y: farY }
  set(l, wide?.player.id, fp)
  // Near options are marked tightly.
  const near = nearest(l, l.mates.filter((m) => m !== wide && m.player.id !== l.input.heroId), hp, 2, new Set())
  for (const m of near) {
    const mp = l.pos.get(m.player.id)
    const marker = nearest(l, l.opps, mp ?? hp, 1, skip)[0]
    if (mp && marker) {
      skip.add(marker.player.id)
      set(l, marker.player.id, { x: mp.x + rng.range(0.8, 1.4), y: mp.y + rng.range(-0.8, 0.8) })
    }
  }
  // Nobody within 14 m of the far-side man.
  for (const o of l.opps) {
    const p = l.pos.get(o.player.id)
    if (o === gk || !p || Math.hypot(p.x - fp.x, p.y - fp.y) > 14) continue
    set(l, o.player.id, { x: p.x, y: p.y + (top ? -1 : 1) * 14 })
  }
  return { ball: owned(hp, l.input.heroId), passerId: null, finisherId: wide?.player.id ?? null, opponentId: pressers[0]?.player.id ?? null }
}

/** recovery_run: we lost it upfield; their carrier breaks, the hero is a few strides behind him. */
const placeRecoveryRun: Placer = (l) => {
  const rng = l.input.rng
  const att = oppAttacker(l)
  const ap = { x: rng.range(50, 58), y: rng.range(18, 50) }
  set(l, att?.player.id, ap)
  // The hero is caught upfield: goal-wrong side of the carrier.
  set(l, l.input.heroId, { x: ap.x + rng.range(5, 7.5), y: ap.y + rng.range(-3, 3) })
  const support = l.opps.filter((o) => o !== att && ATTACKERS.has(roleOf(o)))[0]
  set(l, support?.player.id, { x: ap.x - rng.range(2, 5), y: ap.y > 34 ? ap.y - rng.range(10, 14) : ap.y + rng.range(10, 14) })
  const keeper = mateKeeper(l)
  set(l, keeper?.player.id, { x: 3, y: 34 + (ap.y - 34) * 0.15 })
  // One defender back on the edge of the box; the rest of the team caught upfield.
  const skip = new Set([l.input.heroId, keeper?.player.id ?? ''])
  const backs = nearest(l, l.mates, { x: 20, y: 34 }, 1, skip)
  backs.forEach((b) => {
    skip.add(b.player.id)
    set(l, b.player.id, { x: rng.range(14, 18), y: 34 + (ap.y > 34 ? -1 : 1) * rng.range(6, 10) })
  })
  for (const m of l.mates) {
    if (skip.has(m.player.id) || roleOf(m) === 'GK') continue
    const p = l.pos.get(m.player.id)
    if (p) set(l, m.player.id, { x: Math.max(p.x, ap.x + rng.range(12, 26)), y: p.y })
  }
  return { ball: owned(ap, att?.player.id ?? null), passerId: null, finisherId: null, opponentId: att?.player.id ?? null }
}

/** shoulder_duel: a ball is about to be played into the channel; the hero and his marker side by side. */
const placeShoulderDuel: Placer = (l) => {
  const rng = l.input.rng
  const top = rng.chance(0.5)
  const hp = { x: rng.range(62, 70), y: top ? rng.range(14, 22) : rng.range(46, 54) }
  set(l, l.input.heroId, hp)
  const gk = oppKeeper(l)
  const skip = new Set([gk?.player.id ?? ''])
  const marker = nearest(l, l.opps, hp, 1, skip)[0]
  // Shoulder to shoulder: level with him, on the inside.
  if (marker) {
    skip.add(marker.player.id)
    set(l, marker.player.id, { x: hp.x + rng.range(-0.3, 0.3), y: hp.y + (top ? 1 : -1) * rng.range(0.7, 0.9) })
  }
  const passer = pickMate(l, (m) => relationWeight(m) * (['CB', 'DM', 'CM', 'LB', 'RB'].includes(roleOf(m)) ? 2 : 0.4) * (m.player.attrs.passing + 20))
  // From behind, down the line: the ball runs on the outside of the pair.
  const pp = { x: hp.x - rng.range(13, 17), y: clamp(hp.y - (top ? 1 : -1) * rng.range(2, 5), 4, 64) }
  if (passer) set(l, passer.player.id, pp)
  // Cover is a long way across: the duel decides it.
  for (const o of l.opps) {
    const p = l.pos.get(o.player.id)
    if (o === gk || o === marker || !p || Math.hypot(p.x - hp.x, p.y - hp.y) > 9) continue
    set(l, o.player.id, { x: p.x, y: p.y + (top ? 1 : -1) * 9 })
  }
  return { ball: owned(pp, passer?.player.id ?? null), passerId: passer?.player.id ?? null, finisherId: null, opponentId: marker?.player.id ?? null }
}

/** timed_run: the hero on their last line, a team-mate on the ball in midfield looking for the run. */
const placeTimedRun: Placer = (l) => {
  const rng = l.input.rng
  const lineX = rng.range(76, 82)
  const hp = { x: lineX - rng.range(1, 2), y: rng.range(26, 42) }
  set(l, l.input.heroId, hp)
  const gk = oppKeeper(l)
  set(l, gk?.player.id, { x: 101.5, y: 34 })
  const skip = new Set([gk?.player.id ?? ''])
  // Their back four on one line across the pitch.
  const backs = nearest(l, l.opps, { x: lineX + 6, y: 34 }, 4, skip)
  backs.sort((a, b) => (l.pos.get(a.player.id)?.y ?? 0) - (l.pos.get(b.player.id)?.y ?? 0))
  backs.forEach((b, i) => {
    skip.add(b.player.id)
    set(l, b.player.id, { x: lineX + rng.range(-0.3, 0.3), y: 14 + i * 13.5 + rng.range(-1, 1) })
  })
  const passer = pickMate(l, (m) => relationWeight(m) * (['CM', 'AM', 'DM'].includes(roleOf(m)) ? 3 : 0.3) * (m.player.attrs.vision + 20))
  const pp = { x: lineX - rng.range(22, 28), y: rng.range(26, 42) }
  if (passer) set(l, passer.player.id, pp)
  // Their midfield has been bypassed: it is the back line against the run.
  const screen = nearest(l, l.opps, pp, 1, skip)[0]
  if (screen) set(l, screen.player.id, { x: pp.x - rng.range(1, 3), y: pp.y + (rng.chance(0.5) ? 1 : -1) * rng.range(3, 5) })
  for (const o of l.opps) {
    const p = l.pos.get(o.player.id)
    if (o === gk || o === screen || skip.has(o.player.id) || !p) continue
    set(l, o.player.id, { x: Math.min(p.x, pp.x - rng.range(2, 8)), y: p.y })
  }
  // Our other players keep out of the passing lane (wide or behind the ball).
  for (const m of l.mates) {
    const p = l.pos.get(m.player.id)
    if (!p || m === passer || m.player.id === l.input.heroId || roleOf(m) === 'GK' || p.x < pp.x - 2) continue
    if (Math.abs(p.y - (pp.y + hp.y) / 2) < 9) set(l, m.player.id, { x: p.x, y: p.y + (p.y < 34 ? -9 : 9) })
  }
  return { ball: owned(pp, passer?.player.id ?? null), passerId: passer?.player.id ?? null, finisherId: null, opponentId: gk?.player.id ?? null }
}

/** press_trap: their centre-back on the ball at the edge of their box; the hero presses him. */
const placePressTrap: Placer = (l) => {
  const rng = l.input.rng
  const pool = l.opps.filter((o) => roleOf(o) !== 'GK')
  const carrier = pool.length ? rng.weighted(pool, (o) => (['CB', 'LB', 'RB', 'DM'].includes(roleOf(o)) ? 3 : 0.3)) : undefined
  const cp = { x: rng.range(86, 92), y: rng.range(20, 48) }
  set(l, carrier?.player.id, cp)
  const gk = oppKeeper(l)
  set(l, gk?.player.id, { x: 102.5, y: 34 + (cp.y - 34) * 0.15 })
  // His options: the other centre-back across, a full-back wide and a midfielder showing short.
  const others = pool.filter((o) => o !== carrier)
  const options = [
    { x: cp.x + rng.range(-1, 2), y: cp.y > 34 ? cp.y - rng.range(13, 17) : cp.y + rng.range(13, 17) },
    { x: cp.x - rng.range(6, 10), y: cp.y > 34 ? rng.range(58, 63) : rng.range(5, 10) },
    { x: cp.x - rng.range(10, 14), y: 34 + rng.range(-5, 5) },
  ]
  others.slice(0, 3).forEach((o, i) => set(l, o.player.id, options[i]!))
  // The hero presses the man on the ball, curving his run to cut one lane.
  set(l, l.input.heroId, { x: cp.x - rng.range(7, 10), y: cp.y + rng.range(-3, 3) })
  // A team-mate presses the second option; the rest hold a midfield line.
  const presser = nearest(l, l.mates, options[0]!, 1, new Set([l.input.heroId]))[0]
  if (presser) set(l, presser.player.id, { x: options[0]!.x - rng.range(4, 6), y: options[0]!.y })
  return { ball: owned(cp, carrier?.player.id ?? null), passerId: null, finisherId: null, opponentId: carrier?.player.id ?? null }
}

/** gk_claim: their winger is about to cross into our six-yard box; the hero keeper on his line. */
const placeGkClaim: Placer = (l) => {
  const rng = l.input.rng
  const top = rng.chance(0.5)
  const pool = l.opps.filter((o) => roleOf(o) !== 'GK')
  const crosser = pool.length ? rng.weighted(pool, (o) => (WIDE.has(roleOf(o)) ? 3 : 0.3) * (o.player.attrs.crossing + 5)) : undefined
  const cp = { x: rng.range(12, 20), y: top ? rng.range(3, 6) : PITCH_WIDTH - rng.range(3, 6) }
  set(l, crosser?.player.id, cp)
  set(l, l.input.heroId, { x: rng.range(1.5, 2.5), y: 34 + (cp.y - 34) * 0.1 })
  // Their forwards attack the ball from the penalty spot, our defenders goal-side of them: the six-yard box is the keeper's.
  const runners = pool.filter((o) => o !== crosser && ATTACKERS.has(roleOf(o))).slice(0, 3)
  runners.forEach((r, i) => set(l, r.player.id, { x: rng.range(10, 13), y: 34 + (i - 1) * 5 + rng.range(-1.5, 1.5) }))
  const backs = nearest(l, l.mates, { x: 8, y: 34 }, 3, new Set([l.input.heroId]))
  backs.forEach((b, i) => set(l, b.player.id, { x: rng.range(9, 11), y: 34 + (i - 1) * 5 + rng.range(-1, 1) }))
  return { ball: owned(cp, crosser?.player.id ?? null), passerId: null, finisherId: null, opponentId: runners[0]?.player.id ?? crosser?.player.id ?? null }
}

/** gk_distribution: the hero keeper has just gathered it; their forwards press our back line high. */
const placeGkDistribution: Placer = (l) => {
  const rng = l.input.rng
  const hp = { x: rng.range(5, 9), y: rng.range(28, 40) }
  set(l, l.input.heroId, hp)
  const outfield = l.mates.filter((m) => m.player.id !== l.input.heroId && roleOf(m) !== 'GK')
  const defs = outfield.filter((m) => ['CB', 'LB', 'RB', 'DM'].includes(roleOf(m))).slice(0, 4)
  const spots = [{ x: rng.range(14, 18), y: rng.range(20, 26) }, { x: rng.range(14, 18), y: rng.range(42, 48) }, { x: rng.range(24, 32), y: rng.range(4, 10) }, { x: rng.range(24, 32), y: rng.range(58, 64) }]
  defs.forEach((d, i) => set(l, d.player.id, spots[i]!))
  // Their front line marks the short options; one of them is a little looser (the right pass).
  const free = rng.int(0, Math.max(0, defs.length - 1))
  const skip = new Set<string>()
  defs.forEach((d, i) => {
    const p = l.pos.get(d.player.id)
    const marker = p ? nearest(l, l.opps, p, 1, skip)[0] : undefined
    if (!p || !marker) return
    skip.add(marker.player.id)
    // (Build 9: the free man is a little free — 2.8–4.2 m — so the throw's pace and line, Distribution, decide it.)
    const gap = i === free ? rng.range(2.8, 4.2) : rng.range(1.2, 2.2)
    set(l, marker.player.id, { x: p.x + (i === free ? gap * 0.6 : 0.8), y: p.y + (p.y > 34 ? -1 : 1) * (i === free ? gap * 0.8 : 0.6) })
  })
  // A presser on the keeper himself.
  const presser = nearest(l, l.opps, hp, 1, skip)[0]
  if (presser) set(l, presser.player.id, { x: hp.x + rng.range(9, 12), y: hp.y + rng.range(-3, 3) })
  return { ball: owned(hp, l.input.heroId), passerId: null, finisherId: defs[free]?.player.id ?? null, opponentId: presser?.player.id ?? null }
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
  counter_2v1: placeCounter2v1,
  long_ball_control: placeLongBall,
  rebound: placeRebound,
  interception: placeInterception,
  hold_up: placeHoldUp,
  defend_1v1: placeDefend1v1,
  block: placeBlock,
  corner_kick: placeCornerKick,
  fk_wall: placeFkWall,
  dribble: placeDribble,
  header: placeHeader,
  gk_1v1: placeGk1v1,
  gk_sweep: placeGkSweep,
  back_post: placeBackPost,
  long_shot: placeLongShot,
  switch_play: placeSwitchPlay,
  recovery_run: placeRecoveryRun,
  shoulder_duel: placeShoulderDuel,
  timed_run: placeTimedRun,
  press_trap: placePressTrap,
  gk_claim: placeGkClaim,
  gk_distribution: placeGkDistribution,
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
  const heroRole = input.mates.find((sp) => sp.player.id === input.heroId)?.player.role
  if (input.kind === 'freekick' || input.kind === 'penalty' || input.kind === 'gk_penalty' || input.kind === 'corner' || input.kind === 'rebound' || input.kind === 'corner_kick' || input.kind === 'fk_wall') {
    ball.pos = actors.ball.pos // set-piece ball sits on its spot, not on the taker
  }
  return {
    scenario: {
      kind: input.kind,
      players,
      ball,
      timeLimit: TIME_LIMITS[input.kind],
      prompt: HIGHLIGHT_PROMPTS[input.kind][input.lang],
      ...(heroRole ? { heroRole } : {}),
    },
    passerId: actors.passerId,
    finisherId: actors.finisherId,
    opponentId: actors.opponentId,
  }
}

// ───────────────────────── Hero involvement planning ─────────────────────────

/** How often each highlight kind occurs for a hero playing a given position. */
const KIND_WEIGHTS: Record<Position, Partial<Record<HighlightKind, number>>> = {
  // Plan 2.1#119 (S21): ST ≈ 45 % shot, 20 % header, 23 % pass/link, 10 % dribble; the shot share
  // stays at the BALANCE goal-tally level (docs/BALANCE.md) instead of the plan's 50 %.
  ST: { build_up: 1.0, counter: 1.2, one_on_one: 1.7, header: 1.8, edge_of_box: 1.4, corner: 0.8, defend: 0.3, counter_2v1: 0.7, long_ball_control: 1.0, rebound: 0.9, hold_up: 1.0, dribble: 1.3, timed_run: 0.6, shoulder_duel: 0.5, press_trap: 0.3, long_shot: 0.2 },
  LW: { build_up: 1.3, counter: 1.2, one_on_one: 1, cross: 2.5, edge_of_box: 1.1, corner: 0.4, defend: 0.8, counter_2v1: 0.9, long_ball_control: 0.8, rebound: 0.3, hold_up: 0.2, dribble: 0.9, timed_run: 0.35, shoulder_duel: 0.3, press_trap: 0.35, recovery_run: 0.45, long_shot: 0.35 },
  RW: { build_up: 1.3, counter: 1.2, one_on_one: 1, cross: 2.5, edge_of_box: 1.1, corner: 0.4, defend: 0.8, counter_2v1: 0.9, long_ball_control: 0.8, rebound: 0.3, hold_up: 0.2, dribble: 0.9, timed_run: 0.35, shoulder_duel: 0.3, press_trap: 0.35, recovery_run: 0.45, long_shot: 0.35 },
  AM: { build_up: 2.0, counter: 1, one_on_one: 0.8, cross: 0.6, edge_of_box: 1.8, corner: 0.3, defend: 0.6, counter_2v1: 0.8, long_ball_control: 0.5, rebound: 0.6, hold_up: 0.6, dribble: 0.8, long_shot: 0.8, press_trap: 0.35, timed_run: 0.25, switch_play: 0.3, recovery_run: 0.3 },
  CM: { build_up: 2.5, counter: 1.1, one_on_one: 0.5, cross: 0.5, edge_of_box: 1.7, corner: 0.5, defend: 1.3, counter_2v1: 0.5, long_ball_control: 0.5, rebound: 0.3, interception: 0.8, block: 0.4, defend_1v1: 0.3, dribble: 0.3, long_shot: 0.7, switch_play: 0.8, recovery_run: 0.6, press_trap: 0.35 },
  DM: { build_up: 2.8, counter: 0.7, one_on_one: 0.2, cross: 0.2, edge_of_box: 0.9, corner: 0.6, defend: 2.4, long_ball_control: 0.3, interception: 1.5, block: 0.9, defend_1v1: 0.6, switch_play: 0.8, recovery_run: 0.55, long_shot: 0.3, press_trap: 0.2 },
  // Full-backs (plan 2.1#124): overlap + cross going forward, and the back post when the ball is on the far side; 50/50.
  LB: { build_up: 1.4, counter: 0.9, cross: 2, edge_of_box: 0.4, corner: 0.4, defend: 2.0, counter_2v1: 0.3, long_ball_control: 0.5, interception: 0.7, defend_1v1: 1.4, block: 0.5, back_post: 1.2, switch_play: 0.45, recovery_run: 0.7, shoulder_duel: 0.15 },
  RB: { build_up: 1.4, counter: 0.9, cross: 2, edge_of_box: 0.4, corner: 0.4, defend: 2.0, counter_2v1: 0.3, long_ball_control: 0.5, interception: 0.7, defend_1v1: 1.4, block: 0.5, back_post: 1.2, switch_play: 0.45, recovery_run: 0.7, shoulder_duel: 0.15 },
  CB: { build_up: 0.9, counter: 0.2, edge_of_box: 0.2, corner: 2.2, defend: 3.0, rebound: 0.3, interception: 2, defend_1v1: 1.2, block: 1.1, back_post: 0.6, switch_play: 0.45, recovery_run: 0.3 },
  // Keeper career (plan 2.1#85): shot-stopping, 1v1s and sweeping (+ penalties / free kicks from set pieces).
  GK: { gk_save: 0.55, gk_1v1: 0.25, gk_sweep: 0.2, gk_claim: 0.18, gk_distribution: 0.14 },
}

/**
 * Role identity (owner feedback): how a role reshapes its position's moment mix. {@link kindWeights}
 * multiplies the position weights, then rescales so the total stays the position's and the shooting
 * kinds take {@link ROLE_SHOT_SHARE} × the position's shooting share. A kind the position never gets
 * stays absent.
 */
export const ROLE_KIND_MULT: Readonly<Record<Role, Partial<Record<HighlightKind, number>>>> = {
  // Strikers: in behind → 1v1s and breaks; target → hold-up and link-up; pivot → headers, corners, high balls.
  // Runner (Tur 4): his long balls are balls over the top (timed_run), not back-to-goal aerial ones he is built to
  // lose (long_ball_control 1.6 → 0.7, shoulder_duel 0.4); his pace presses their centre-backs (press_trap 2.2).
  runner: { one_on_one: 1.7, counter: 1.6, counter_2v1: 1.3, timed_run: 2.0, press_trap: 2.2, long_ball_control: 0.7, shoulder_duel: 0.4, dribble: 0.7, build_up: 0.35, header: 0.35, corner: 0.5, hold_up: 0.2, defend: 0.6 },
  targetForward: { hold_up: 4.0, build_up: 1.8, long_ball_control: 1.2, edge_of_box: 1.0, rebound: 1.3, header: 0.8, one_on_one: 0.6, counter: 0.7, defend: 0.8 },
  pivot: { header: 2.6, corner: 2.2, long_ball_control: 1.8, hold_up: 1.4, rebound: 1.3, one_on_one: 0.5, counter: 0.5, dribble: 0.5, build_up: 0.7 },
  // Wingers: byline crosses; cutting in to shoot; roaming playmaking; take-ons.
  touchlineWinger: { cross: 1.6, counter: 1.2, dribble: 1.1, one_on_one: 0.9, edge_of_box: 0.5 },
  invertedWinger: { edge_of_box: 2.2, rebound: 1.6, one_on_one: 1.2, dribble: 1.2, cross: 0.45 },
  freeWinger: { build_up: 1.8, hold_up: 2.5, long_ball_control: 1.2, edge_of_box: 1.3, counter_2v1: 1.4, cross: 0.7, defend: 0.6 },
  dribbler: { dribble: 2.8, one_on_one: 1.1, cross: 0.8 },
  // Midfield: screen and win it back; both boxes; run the game.
  anchor: { interception: 2.0, block: 1.6, defend: 1.4, defend_1v1: 1.4, build_up: 0.8, long_ball_control: 0.7, edge_of_box: 1.3, counter: 0.6, one_on_one: 0.4, cross: 0.6 },
  boxToBox: { rebound: 1.6, counter: 1.4, interception: 1.2, edge_of_box: 1.1, defend: 1.1, build_up: 0.85 },
  playmaker: { build_up: 1.5, long_ball_control: 1.3, counter_2v1: 1.3, edge_of_box: 1.1, defend: 0.55, interception: 0.6, block: 0.55, defend_1v1: 0.7 },
  // Full-backs: overlap and cross; lock the flank; both. Tur 5 (cross judged by delivery): attacking cross 1.7 → 1.4,
  // defensive full-back plays a little more out from the back (build_up 0.7 → 1.1, counter 0.6 → 0.8).
  attackingFullBack: { cross: 1.4, counter: 1.4, counter_2v1: 2.2, edge_of_box: 1.2, defend: 0.7, defend_1v1: 0.75, back_post: 0.75, build_up: 1.3 },
  defensiveFullBack: { defend_1v1: 1.5, defend: 1.3, interception: 1.4, block: 1.4, back_post: 1.4, build_up: 1.1, cross: 0.5, counter: 0.8, counter_2v1: 0.4 },
  balancedFullBack: {},
  // Centre-backs: step out and intercept; own the air; build from the back. Tur 5 (career fame): ball-player
  // build_up 2.0 → 1.6, aerial defender build_up 0.8 → 1.1.
  stopper: { interception: 1.8, defend_1v1: 1.7, defend: 1.0, block: 1.1, build_up: 0.6, back_post: 0.8 },
  aerialDefender: { corner: 1.5, back_post: 2.0, defend: 1.15, interception: 0.9, defend_1v1: 0.75, build_up: 1.1 },
  ballPlayingDefender: { build_up: 1.6, interception: 1.1, defend: 0.85, defend_1v1: 0.8, block: 0.9 },
  // Keepers: point-blank reactions; diving saves; sweeping up behind the line.
  reflexKeeper: { gk_1v1: 1.5, gk_save: 1.1, gk_sweep: 0.7 },
  shotStopper: { gk_save: 1.25, gk_1v1: 0.9, gk_sweep: 0.7 },
  sweeperKeeper: { gk_sweep: 2.2, gk_save: 0.9 },
}

/**
 * Shooting share of a role relative to its position (1 = the position's), set so a striker's or winger's
 * expected goals per moment stay within ~±6 % of the position mix (BALANCE goal bands; roles.test checks
 * it). Defensive roles score a little less, attacking full-backs a little more. The engine's team factor
 * absorbs the hero's expected goals either way.
 */
export const ROLE_SHOT_SHARE: Readonly<Partial<Record<Role, number>>> = {
  // A runner's chances (1v1s, breaks) convert best, so he gets fewer of them: same goals, different goals.
  runner: 0.83, targetForward: 1.0, pivot: 1.05,
  touchlineWinger: 1.06, invertedWinger: 0.91, freeWinger: 0.95, dribbler: 1.05,
  anchor: 0.9, playmaker: 0.86, boxToBox: 1.0,
  attackingFullBack: 1.1, defensiveFullBack: 0.85,
  stopper: 0.95, aerialDefender: 1.25, ballPlayingDefender: 0.95,
}

/** Position mix reshaped by the role (see {@link ROLE_KIND_MULT}, {@link ROLE_SHOT_SHARE}). */
function roleMix(pos: Position, role: Role | undefined): Partial<Record<HighlightKind, number>> {
  const base = KIND_WEIGHTS[pos]
  const mult = role ? ROLE_KIND_MULT[role] : undefined
  if (!role || !mult || !Object.keys(mult).length) return { ...base }
  const out: Partial<Record<HighlightKind, number>> = {}
  // [base, reshaped] totals of the shooting and the other kinds.
  const shoot = { base: 0, now: 0 }
  const rest = { base: 0, now: 0 }
  for (const [k, v] of Object.entries(base) as [HighlightKind, number][]) {
    const m = v * (mult[k] ?? 1)
    out[k] = m
    const g = SHOOTING_KINDS.has(k) ? shoot : rest
    g.base += v
    g.now += m
  }
  const all = shoot.base + rest.base
  const shootTarget = rest.base > 0 ? Math.min(all, shoot.base * (ROLE_SHOT_SHARE[role] ?? 1)) : shoot.base
  const restTarget = all - shootTarget
  for (const k of Object.keys(out) as HighlightKind[]) {
    const isShot = SHOOTING_KINDS.has(k)
    const g = isShot ? shoot : rest
    if (g.now > 0) out[k] = ((out[k] ?? 0) * (isShot ? shootTarget : restTarget)) / g.now
  }
  return out
}

/** Base number of open-play highlights per 90 minutes by position. */
const BASE_COUNT: Record<Position, number> = {
  // ST 6 → 6.4 (Oct 2026): restores the striker's chances diluted by the attribute moments (shoulder duel, press).
  ST: 6.4, LW: 5.8, RW: 5.8, AM: 6, CM: 6, DM: 5.5, LB: 5.5, RB: 5.5, CB: 5, GK: 5,
}

/** Minimum / maximum highlights per 90 minutes. */
export const HIGHLIGHTS_MIN_90 = 4
export const HIGHLIGHTS_MAX_90 = 9

/** Kinds that end in a shot at goal for the hero. */
const SHOOTING_KINDS: ReadonlySet<HighlightKind> = new Set<HighlightKind>(['counter', 'one_on_one', 'cross', 'edge_of_box', 'corner', 'counter_2v1', 'rebound', 'dribble', 'header', 'long_shot', 'timed_run'])

/** Keeper moments per 90 (plan 2.1#85): 4–8. */
export const GK_HIGHLIGHTS_MAX_90 = 8

/** Kind weights for a position, reshaped by the hero's role (copy, safe to mutate). */
export function kindWeights(pos: Position, ovr?: number, marked = 0, role?: Role): Partial<Record<HighlightKind, number>> {
  const w = roleMix(pos, role)
  const p = Math.max(tightening(ovr), marked)
  const e = Math.max(eliteMarking(ovr), marked)
  if (p > 0) for (const k of Object.keys(w) as HighlightKind[]) if (SHOOTING_KINDS.has(k)) w[k] = (w[k] ?? 0) * (1 - SHOOT_TIGHTENING * p) * (1 - ELITE_SHOOT * e)
  return w
}

/**
 * Better players meet tighter defences (higher tiers, double marking), so clean
 * shooting chances do not grow with OVR the way conversion does. 0 at OVR 68
 * and below, 1 at 84+. Keeps 66-70 strikers near 15-20 goals and elite ones near 30
 * a season (BALANCE.md, gol dengesi) without touching per-kind odds.
 */
const tightening = (ovr?: number): number => (ovr === undefined ? 0 : clamp((ovr - 68) / 16, 0, 1))
// Balance pass (Oct 2026): 0.6 → 0.4 and ELITE_SHOOT 0.5 → 0.2, COUNT_TIGHTENING 0.2 → 0.15. After the attribute
// moments joined the mix, 77-82 strikers had fallen to ~13-17 goals a season (target 25-35, BALANCE.md).
const SHOOT_TIGHTENING = 0.4
const COUNT_TIGHTENING = 0.15
/**
 * Second stage for stars (playtest Tur 2: 407 goals in 459 games; ST careers at 0.91 goals a
 * game, best seasons 1.35). Elite players are man-marked and doubled: from OVR 74 to 88 clean
 * chances thin out further, so a superstar striker ends near 0.6-0.7 a game over a career and
 * about 1.0 in a peak season (real-world elite range). 0 at 74 and below, 1 at 88+.
 */
const eliteMarking = (ovr?: number): number => (ovr === undefined ? 0 : clamp((ovr - 74) / 14, 0, 1))
const ELITE_SHOOT = 0.2
const ELITE_COUNT = 0.1

/** Kinds where the hero's team is defending. */
export function isDefensiveKind(kind: HighlightKind): boolean {
  return DEFENSIVE_KINDS.has(kind)
}

/**
 * Position guarantees (GAP-AUDIT WP-2 #7): a centre-back gets at least 3
 * defensive moments, a winger at least 2 crosses in a full match. Returns the
 * kind to force for the current slot, or null when the guarantee is safe.
 * @param counts kinds generated so far
 * @param slotsLeft planned open-play slots left, including the current one
 */
export function guaranteedKind(pos: Position, counts: Partial<Record<HighlightKind, number>>, slotsLeft: number, rng: Rng, role?: Role): HighlightKind | null {
  const need = (kinds: HighlightKind[], n: number) => Math.max(0, n - kinds.reduce((a, k) => a + (counts[k] ?? 0), 0))
  if (pos === 'CB') {
    const missing = need(['defend', 'interception', 'defend_1v1', 'block', 'back_post'], 3)
    if (missing > 0 && slotsLeft <= missing) return rng.chance(0.5) ? 'defend' : 'interception'
  }
  if (pos === 'LW' || pos === 'RW') {
    // Wingers who cut in, roam or dribble are guaranteed one cross; a touchline winger two.
    const missing = need(['cross'], role === 'invertedWinger' || role === 'freeWinger' || role === 'dribbler' ? 1 : 2)
    if (missing > 0 && slotsLeft <= missing) return 'cross'
  }
  return null
}

/**
 * Pre-match preview (GAP-AUDIT WP-2 #3): the band of open-play moments the
 * hero can expect and the likely kinds, from the same inputs as
 * {@link plannedHighlightCount} (without its noise). Set pieces can add one.
 */
export function expectedMoments(input: HighlightPlanInput): ExpectedMoments {
  let n = BASE_COUNT[input.position]
  n += clamp(input.relationAvg, -100, 100) * 0.015
  n += (input.morale - 1) * 5
  n += ((input.form - 50) / 50) * 1
  n += focusPositioningMoments(input)
  const share = input.minutes >= 89 ? 1 : input.minutes < 10 ? 0 : input.minutes / 90
  let min = clamp(Math.round(n - 1.2), HIGHLIGHTS_MIN_90, HIGHLIGHTS_MAX_90)
  let max = clamp(Math.round(n + 1.2), HIGHLIGHTS_MIN_90, HIGHLIGHTS_MAX_90) + 1
  if (share < 1) {
    min = share === 0 ? 0 : Math.max(0, Math.round(min * share) - 1)
    max = share === 0 ? 0 : Math.max(1, Math.round(max * share))
  }
  const w = roleMix(input.position, input.role)
  const total = Object.values(w).reduce((a, v) => a + (v ?? 0), 0) || 1
  const kinds = (Object.keys(w) as HighlightKind[])
    .map((kind) => ({ kind, share: Math.round(((w[kind] ?? 0) / total) * 1000) / 1000 }))
    .sort((a, b) => b.share - a.share || (a.kind < b.kind ? -1 : 1))
  // Rounded shares must still sum to exactly 1: the largest share absorbs the rounding error.
  if (kinds.length) kinds[0]!.share = Math.round((1 - kinds.slice(1).reduce((s, k) => s + k.share, 0)) * 1000) / 1000
  return { min, max, kinds }
}


/**
 * Picks the kind of an open-play highlight. A trailing team late on pushes
 * forward (fewer defensive moments); a leading team sits deeper.
 */
export function pickHighlightKind(pos: Position, rng: Rng, goalDiff: number, minute: number, heroGoals = 0, ovr?: number, marked = 0, role?: Role): HighlightKind {
  const w = kindWeights(pos, ovr, marked, role)
  // A hero already on a hat-trick sees fewer shooting chances (realistic goal concentration).
  if (heroGoals > 0) {
    const brake = heroGoals >= 2 ? 0.5 : 0.78
    for (const k of Object.keys(w) as HighlightKind[]) if (SHOOTING_KINDS.has(k)) w[k] = (w[k] ?? 0) * brake
  }
  const late = minute >= 70
  // Recovery runs are a late-game test of the legs (Stamina, Work Rate).
  if (w.recovery_run) w.recovery_run *= minute >= 65 ? 2 : minute < 45 ? 0.5 : 1
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
  /** Hero OVR (optional; tighter defences cut the count of chances above 68). */
  ovr?: number
  /** 0..1 extra marking for a prolific scorer (defences adapt to form, not only to OVR). */
  marked?: number
  /** Pre-match focus (GAP 2.1#9): attack +0.6 moments, defend −0.6 (and more defensive kinds downstream). */
  focus?: MatchFocus
  /** Hero Positioning 0..100: off-ball movement relative to his level finds more chances. */
  positioning?: number
  /** Hero's playing role: reshapes the kind mix of the preview (not the count). */
  role?: Role
}

/** Pre-match focus mode. */
export type MatchFocus = 'attack' | 'balance' | 'defend'
/** Moments added (attack) / removed (defend) by the focus. */
export const FOCUS_MOMENTS = 0.6
/** Max moments from Positioning (relative to OVR; ±30 points = full effect). */
export const POSITIONING_MOMENTS = 0.6

/** Focus + Positioning share of the count, shared by the plan and the preview. */
export function focusPositioningMoments(input: Pick<HighlightPlanInput, 'focus' | 'positioning' | 'ovr'>): number {
  const f = input.focus === 'attack' ? FOCUS_MOMENTS : input.focus === 'defend' ? -FOCUS_MOMENTS : 0
  if (input.positioning === undefined) return f
  const rel = clamp((input.positioning - (input.ovr ?? 60)) / 30, -1, 1)
  return f + rel * POSITIONING_MOMENTS
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
  n += focusPositioningMoments(input)
  const mk = input.marked ?? 0
  n *= (1 - COUNT_TIGHTENING * Math.max(tightening(input.ovr), mk)) * (1 - ELITE_COUNT * Math.max(eliteMarking(input.ovr), mk))
  n += rng.normal(0, 0.8)
  const full = clamp(Math.round(n), HIGHLIGHTS_MIN_90, input.position === 'GK' ? GK_HIGHLIGHTS_MAX_90 : HIGHLIGHTS_MAX_90)
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
