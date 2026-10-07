/**
 * Builds the runtime cast (agents + ball) from a {@link Highlight} scenario and
 * normalises set pieces (penalty spot, free-kick wall, corner taker…) so every
 * HighlightKind starts from a playable, rules-consistent layout.
 */
import type { Attributes, Position } from '../core/types'
import type { Rng } from '../core/rng'
import type { Highlight, HighlightKind, ScenarioPlayer } from '../sim/match/types'
import { DEFENSIVE_KINDS, PITCH_LENGTH, PITCH_WIDTH } from '../sim/match/types'
import { GOAL_CENTER_Y } from './physics'
import { add, dist, norm, scale, sub, type Agent, type Team, type Vec2 } from './model'

/** Distance the opposition must stand from a set-piece ball (m). */
export const SET_PIECE_DISTANCE = 9.15
export const PENALTY_SPOT_DIST = 11

/** Static set-piece info for the runtime. */
export interface SetPiece {
  kind: 'penalty' | 'freekick' | 'corner'
  takerId: string
  spot: Vec2
  /** Ids of the defensive wall (free kicks). */
  wall: string[]
}

export interface Cast {
  agents: Agent[]
  hero: Agent
  ball: { x: number; y: number; z: number; vx: number; vy: number }
  ownerId: string | null
  setPiece: SetPiece | null
  /** Hero's team defends in this moment (defend / gk kinds). */
  defending: boolean
}

export const isDefendingKind = (k: HighlightKind) => DEFENSIVE_KINDS.has(k)
export const isKeeperKind = (k: HighlightKind) => k === 'gk_save' || k === 'gk_penalty'

/** Neutral attribute block used when synthesising extra players. */
export function flatAttrs(v: number, gk = false): Attributes {
  const a: Attributes = {
    pace: v, stamina: v, strength: v, agility: v, jumping: v,
    passing: v, shooting: v, finishing: v, dribbling: v, firstTouch: v, crossing: v, heading: v, tackling: v, setPieces: v,
    vision: v, composure: v, positioning: v, leadership: v, workRate: v,
    reflexes: gk ? v + 10 : 25, handling: gk ? v + 8 : 25,
  }
  return a
}

function makeAgent(p: ScenarioPlayer, team: Team, names?: Record<string, string>): Agent {
  return {
    id: p.id,
    team,
    number: p.number,
    role: p.role,
    isHero: p.isHero,
    isKeeper: p.role === 'GK',
    name: names?.[p.id] ?? (p.isHero ? 'YOU' : `#${p.number}`),
    attrs: { ...p.attrs },
    relationToHero: p.relationToHero,
    pos: { ...p.pos },
    vel: { x: 0, y: 0 },
    facing: team === 'hero' ? 0 : Math.PI,
    anchor: { ...p.pos },
    state: 'run',
    stateT: 0,
    z: 0,
    actionDir: { x: 1, y: 0 },
    noTouch: 0,
    think: 0,
    sprint: false,
    stamina: 1,
    intent: null,
    prev: { x: p.pos.x, y: p.pos.y, z: 0, facing: team === 'hero' ? 0 : Math.PI },
    touch: 0,
    cd: 0,
  }
}

function synthAgent(id: string, team: Team, role: Position, pos: Vec2, ovr: number): Agent {
  return makeAgent(
    { id, side: 'home', pos, role, number: role === 'GK' ? 1 : 99, isHero: false, attrs: flatAttrs(ovr, role === 'GK'), relationToHero: 0 },
    team,
  )
}

const setPos = (a: Agent, p: Vec2) => {
  a.pos = { ...p }
  a.prev = { x: p.x, y: p.y, z: 0, facing: a.facing }
  a.anchor = { ...p }
}

const faceTo = (a: Agent, p: Vec2) => {
  a.facing = Math.atan2(p.y - a.pos.y, p.x - a.pos.x)
  a.prev.facing = a.facing
}

/** Pushes non-exempt agents at least `r` away from `c` (set-piece distance). */
function clearRadius(agents: Agent[], c: Vec2, r: number, exempt: Set<string>) {
  for (const a of agents) {
    if (exempt.has(a.id)) continue
    const d = dist(a.pos, c)
    if (d < r) {
      const away = d > 0.01 ? norm(sub(a.pos, c)) : { x: -1, y: 0 }
      setPos(a, add(c, scale(away, r + 0.3)))
    }
  }
}

/**
 * Creates the cast for a highlight.
 * @param names optional display names by player id
 */
export function buildCast(h: Highlight, rng: Rng, names?: Record<string, string>): Cast {
  const sc = h.scenario
  const kind = sc.kind ?? h.kind
  const agents = sc.players.map((p) => makeAgent(p, p.side === h.side ? 'hero' : 'opp', names))
  const hero = agents.find((a) => a.isHero)
  if (!hero) throw new Error(`Highlight ${h.id} has no hero player`)
  const defending = isDefendingKind(kind)

  // Keeper mode: the hero is the keeper.
  if (isKeeperKind(kind)) {
    hero.isKeeper = true
    hero.role = 'GK'
  }
  // Make sure both goals are guarded.
  const ensureKeeper = (team: Team) => {
    if (agents.some((a) => a.team === team && a.isKeeper)) return
    const x = team === 'hero' ? 1.2 : PITCH_LENGTH - 1.2
    agents.push(synthAgent(`gk_${team}`, team, 'GK', { x, y: GOAL_CENTER_Y }, 62))
  }
  ensureKeeper('opp')
  ensureKeeper('hero')

  const ball = { x: sc.ball.pos.x, y: sc.ball.pos.y, z: sc.ball.z ?? 0, vx: sc.ball.vel?.x ?? 0, vy: sc.ball.vel?.y ?? 0 }
  let ownerId = sc.ball.ownerId
  let setPiece: SetPiece | null = null
  const oppKeeper = agents.find((a) => a.team === 'opp' && a.isKeeper)!

  switch (kind) {
    case 'penalty': {
      const spot = { x: PITCH_LENGTH - PENALTY_SPOT_DIST, y: GOAL_CENTER_Y }
      setPos(oppKeeper, { x: PITCH_LENGTH - 0.25, y: GOAL_CENTER_Y })
      faceTo(oppKeeper, spot)
      setPos(hero, { x: spot.x - 1.6, y: spot.y - 0.5 })
      faceTo(hero, { x: PITCH_LENGTH, y: GOAL_CENTER_Y })
      for (const a of agents) {
        if (a === hero || a === oppKeeper) continue
        if (a.pos.x > PITCH_LENGTH - 17.5) setPos(a, { x: PITCH_LENGTH - 19 - rng.range(0, 6), y: clampY(a.pos.y, 12, PITCH_WIDTH - 12) })
      }
      clearRadius(agents, spot, SET_PIECE_DISTANCE, new Set([hero.id, oppKeeper.id]))
      Object.assign(ball, { x: spot.x, y: spot.y, z: 0, vx: 0, vy: 0 })
      ownerId = null
      setPiece = { kind: 'penalty', takerId: hero.id, spot, wall: [] }
      break
    }
    case 'gk_penalty': {
      const spot = { x: PENALTY_SPOT_DIST, y: GOAL_CENTER_Y }
      setPos(hero, { x: 0.25, y: GOAL_CENTER_Y })
      faceTo(hero, spot)
      let taker = agents.find((a) => a.id === sc.ball.ownerId && a.team === 'opp')
      if (!taker) taker = nearest(agents.filter((a) => a.team === 'opp' && !a.isKeeper), spot)
      if (!taker) throw new Error('gk_penalty needs an opposition taker')
      setPos(taker, { x: spot.x + 1.6, y: spot.y + 0.5 })
      faceTo(taker, { x: 0, y: GOAL_CENTER_Y })
      for (const a of agents) {
        if (a === hero || a === taker) continue
        if (a.pos.x < 17.5) setPos(a, { x: 19 + rng.range(0, 6), y: clampY(a.pos.y, 12, PITCH_WIDTH - 12) })
      }
      clearRadius(agents, spot, SET_PIECE_DISTANCE, new Set([hero.id, taker.id]))
      Object.assign(ball, { x: spot.x, y: spot.y, z: 0, vx: 0, vy: 0 })
      ownerId = null
      setPiece = { kind: 'penalty', takerId: taker.id, spot, wall: [] }
      break
    }
    case 'freekick': {
      const spot = { x: Math.min(ball.x, PITCH_LENGTH - 17), y: ball.y }
      Object.assign(ball, { x: spot.x, y: spot.y, z: 0, vx: 0, vy: 0 })
      const goal = { x: PITCH_LENGTH, y: GOAL_CENTER_Y }
      const toGoal = norm(sub(goal, spot))
      setPos(hero, sub(spot, scale(toGoal, 1.5)))
      faceTo(hero, goal)
      const d = dist(spot, goal)
      const n = d < 20 ? 5 : d < 25 ? 4 : 3
      // Wall covers the near-post half of the goal.
      const nearPostY = spot.y < GOAL_CENTER_Y ? GOAL_CENTER_Y - 1.8 : GOAL_CENTER_Y + 1.8
      const wallDir = norm(sub({ x: PITCH_LENGTH, y: nearPostY }, spot))
      const wallC = add(spot, scale(wallDir, SET_PIECE_DISTANCE))
      const perp = { x: -wallDir.y, y: wallDir.x }
      const outfieldOpp = agents.filter((a) => a.team === 'opp' && !a.isKeeper).sort((p, q) => dist(p.pos, wallC) - dist(q.pos, wallC))
      const wall: string[] = []
      for (let i = 0; i < n; i++) {
        let a = outfieldOpp[i]
        if (!a) {
          a = synthAgent(`wall_${i}`, 'opp', 'CB', wallC, 64)
          agents.push(a)
        }
        const off = (i - (n - 1) / 2) * 0.62
        setPos(a, add(wallC, scale(perp, off)))
        faceTo(a, spot)
        a.state = 'wall'
        wall.push(a.id)
      }
      // Keeper shades to the far post side.
      setPos(oppKeeper, { x: PITCH_LENGTH - 0.8, y: GOAL_CENTER_Y + (spot.y < GOAL_CENTER_Y ? 1.2 : -1.2) })
      faceTo(oppKeeper, spot)
      clearRadius(agents, spot, SET_PIECE_DISTANCE, new Set([hero.id, ...wall]))
      ownerId = null
      setPiece = { kind: 'freekick', takerId: hero.id, spot, wall }
      break
    }
    case 'corner': {
      const top = ball.y < GOAL_CENTER_Y
      const spot = { x: PITCH_LENGTH - 0.6, y: top ? 0.6 : PITCH_WIDTH - 0.6 }
      Object.assign(ball, { x: spot.x, y: spot.y, z: 0, vx: 0, vy: 0 })
      let taker = agents.find((a) => a.id === sc.ball.ownerId && a.team === 'hero' && !a.isHero)
      if (!taker) taker = nearest(agents.filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper), spot)
      if (!taker) {
        taker = synthAgent('corner_taker', 'hero', 'RW', spot, 66)
        agents.push(taker)
      }
      setPos(taker, { x: spot.x + 0.3 - 1.2, y: spot.y + (top ? -0.4 : 0.4) })
      faceTo(taker, { x: PITCH_LENGTH - 11, y: GOAL_CENTER_Y })
      // Hero in the box.
      if (hero.pos.x < PITCH_LENGTH - 16 || Math.abs(hero.pos.y - GOAL_CENTER_Y) > 10) {
        setPos(hero, { x: PITCH_LENGTH - 12, y: GOAL_CENTER_Y + (top ? 2 : -2) })
      }
      setPos(oppKeeper, { x: PITCH_LENGTH - 0.9, y: GOAL_CENTER_Y + (top ? -1 : 1) })
      clearRadius(agents, spot, SET_PIECE_DISTANCE, new Set([taker.id]))
      ownerId = null
      setPiece = { kind: 'corner', takerId: taker.id, spot, wall: [] }
      break
    }
    case 'corner_kick': {
      // The hero stands over the ball at the flag; the delivery is chosen in the runtime.
      const top = ball.y < GOAL_CENTER_Y
      const spot = { x: PITCH_LENGTH - 0.6, y: top ? 0.6 : PITCH_WIDTH - 0.6 }
      Object.assign(ball, { x: spot.x, y: spot.y, z: 0, vx: 0, vy: 0 })
      setPos(hero, { x: spot.x + 0.3 - 1.2, y: spot.y + (top ? -0.4 : 0.4) })
      faceTo(hero, { x: PITCH_LENGTH - 11, y: GOAL_CENTER_Y })
      setPos(oppKeeper, { x: PITCH_LENGTH - 0.9, y: GOAL_CENTER_Y + (top ? -1 : 1) })
      clearRadius(agents, spot, SET_PIECE_DISTANCE, new Set([hero.id]))
      ownerId = null
      setPiece = { kind: 'corner', takerId: hero.id, spot, wall: [] }
      break
    }
    case 'fk_wall': {
      // Opposition direct free kick at our goal (x = 0). The wall is (re)set by the hero.
      const spot = { x: clampY(ball.x, 16.5, 32), y: ball.y }
      Object.assign(ball, { x: spot.x, y: spot.y, z: 0, vx: 0, vy: 0 })
      let taker = agents.find((a) => a.id === sc.ball.ownerId && a.team === 'opp' && !a.isKeeper)
      if (!taker) taker = nearest(agents.filter((a) => a.team === 'opp' && !a.isKeeper), spot)
      if (!taker) throw new Error('fk_wall needs an opposition taker')
      const goal = { x: 0, y: GOAL_CENTER_Y }
      setPos(taker, add(spot, scale(norm(sub(spot, goal)), 1.6)))
      faceTo(taker, goal)
      const ourKeeper = agents.find((a) => a.team === 'hero' && a.isKeeper)
      if (ourKeeper) {
        setPos(ourKeeper, { x: 0.9, y: GOAL_CENTER_Y + (spot.y - GOAL_CENTER_Y) * 0.12 })
        faceTo(ourKeeper, spot)
      }
      clearRadius(agents, spot, SET_PIECE_DISTANCE, new Set([taker.id]))
      const wall = arrangeWall(agents, spot, DEFAULT_WALL, 0, hero.isKeeper ? null : hero)
      ownerId = null
      setPiece = { kind: 'freekick', takerId: taker.id, spot, wall }
      break
    }
    case 'hold_up': {
      // Back to goal: the hero has it, facing his own half, the marker on his back.
      ownerId = hero.id
      hero.facing = Math.PI
      hero.prev.facing = Math.PI
      break
    }
    case 'defend':
    case 'defend_1v1':
    case 'block': {
      const owner = agents.find((a) => a.id === ownerId)
      if (!owner || owner.team !== 'opp' || owner.isKeeper) {
        const n = nearest(agents.filter((a) => a.team === 'opp' && !a.isKeeper), { x: ball.x, y: ball.y })
        ownerId = n ? n.id : null
      }
      break
    }
    case 'rebound': {
      // The keeper has just parried a team-mate's shot: he is on the ground.
      oppKeeper.state = 'down'
      oppKeeper.stateT = -0.35
      ownerId = null
      break
    }
    case 'gk_save': {
      setPos(hero, { x: Math.max(0.6, Math.min(hero.pos.x, 4)), y: clampY(hero.pos.y, GOAL_CENTER_Y - 3, GOAL_CENTER_Y + 3) })
      const owner = agents.find((a) => a.id === ownerId)
      if (!owner || owner.team !== 'opp') {
        const n = nearest(agents.filter((a) => a.team === 'opp' && !a.isKeeper), { x: ball.x, y: ball.y })
        ownerId = n ? n.id : null
      }
      // Remove the synthetic duplicate keeper if the hero now guards the goal.
      const dup = agents.findIndex((a) => a.team === 'hero' && a.isKeeper && !a.isHero)
      if (dup >= 0) agents.splice(dup, 1)
      break
    }
    default: {
      // Open-play attacking kinds: the hero starts on the ball unless the scenario says otherwise.
      if (ownerId === null && dist(hero.pos, { x: ball.x, y: ball.y }) < 1.5 && ball.z < 0.5) ownerId = hero.id
      break
    }
  }
  if (kind === 'gk_penalty') {
    const dup = agents.findIndex((a) => a.team === 'hero' && a.isKeeper && !a.isHero)
    if (dup >= 0) agents.splice(dup, 1)
  }
  const owner = agents.find((a) => a.id === ownerId)
  if (owner) {
    ball.x = owner.pos.x + Math.cos(owner.facing) * 0.45
    ball.y = owner.pos.y + Math.sin(owner.facing) * 0.45
    ball.z = 0
  }
  return { agents, hero, ball, ownerId: owner ? owner.id : null, setPiece, defending }
}

const clampY = (y: number, lo: number, hi: number) => (y < lo ? lo : y > hi ? hi : y)

/** Where each player stood before the first wall was set (stable wall picks). */
const WALL_HOME = new WeakMap<Agent, Vec2>()

/** Wall size the defence lines up by default (fk_wall). */
export const DEFAULT_WALL = 4
export const WALL_MIN = 2
export const WALL_MAX = 5
/** Wall shift along its line (m): + toward the middle of the goal, − outside the near post. */
export const WALL_NUDGE_MAX = 1.5
/** Spacing between wall players (m). */
export const WALL_GAP = 0.62

/** Where the wall stands for a free kick at our goal (x = 0): the line and its across direction. */
export function wallGeometry(spot: Vec2): { anchor: Vec2; across: Vec2; nearPostY: number } {
  const nearSide = spot.y < GOAL_CENTER_Y ? -1 : 1
  const nearPostY = GOAL_CENTER_Y + nearSide * 3.66
  // The end man lines up just outside the near post; the wall runs in toward the middle.
  const dir = norm(sub({ x: 0, y: nearPostY + nearSide * 0.35 }, spot))
  const anchor = add(spot, scale(dir, SET_PIECE_DISTANCE))
  let across = { x: -dir.y, y: dir.x }
  if (across.y * -nearSide < 0) across = { x: -across.x, y: -across.y }
  return { anchor, across, nearPostY }
}

/** Positions of an n-man wall shifted by `nudge` (m), near-post end first. */
export function wallSpots(spot: Vec2, count: number, nudge: number): Vec2[] {
  const { anchor, across } = wallGeometry(spot)
  const n = Math.round(clampY(count, WALL_MIN, WALL_MAX))
  const out: Vec2[] = []
  for (let i = 0; i < n; i++) out.push(add(anchor, scale(across, 0.3 + i * WALL_GAP + clampY(nudge, -WALL_NUDGE_MAX, WALL_NUDGE_MAX))))
  return out
}

/**
 * Lines up the hero's team in a wall for an opposition free kick (fk_wall).
 * Deterministic in its inputs: the same count/nudge always picks the same
 * players (nearest outfielders by id-stable order) and the same spots, so
 * a live preview and the committed choice agree. Players released from a
 * previous wall drop into the box to mark. Returns the wall ids.
 * @param captain the hero when he organises from inside the wall (else null)
 */
export function arrangeWall(agents: Agent[], spot: Vec2, count: number, nudge: number, captain: Agent | null): string[] {
  const spots = wallSpots(spot, count, nudge)
  const { anchor } = wallGeometry(spot)
  const home = (a: Agent): Vec2 => {
    let h = WALL_HOME.get(a)
    if (!h) {
      h = { ...a.pos }
      WALL_HOME.set(a, h)
    }
    return h
  }
  // Candidates by distance from where they stood before any wall was set (stable).
  const pool = agents
    .filter((a) => a.team === 'hero' && !a.isKeeper && a !== captain)
    .sort((p, q) => dist(home(p), anchor) - dist(home(q), anchor) || (p.id < q.id ? -1 : 1))
    .slice(0, WALL_MAX)
  if (captain) home(captain)
  const members = captain ? [captain, ...pool.slice(0, spots.length - 1)] : pool.slice(0, spots.length)
  const ids = new Set(members.map((m) => m.id))
  // Candidates left out drop into the box to mark (fixed spot per candidate).
  pool.forEach((a, i) => {
    if (ids.has(a.id)) return
    a.state = 'run'
    setPos(a, { x: 7 + (i % 2) * 3, y: GOAL_CENTER_Y + (i % 2 === 0 ? -1 : 1) * (2 + i * 1.4) })
  })
  members.forEach((m, i) => {
    setPos(m, spots[i])
    faceTo(m, spot)
    m.state = 'wall'
  })
  return members.map((m) => m.id)
}

function nearest(list: Agent[], p: Vec2): Agent | undefined {
  let best: Agent | undefined
  let bd = Infinity
  for (const a of list) {
    const d = dist(a.pos, p)
    if (d < bd) {
      bd = d
      best = a
    }
  }
  return best
}
