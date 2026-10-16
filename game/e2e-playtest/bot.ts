/**
 * Human-like touch bot for the playtest recorder. It reads the scene's debug
 * probe (positions on screen) and plays with one or two thumbs through real
 * CDP touch events, with a reaction delay and finger scatter, the way a person
 * does: joystick in the left half, taps on team-mates, swipes at goal, the
 * on-screen context buttons.
 */
import type { CDPSession, Page } from '@playwright/test'

export interface Pt {
  x: number
  y: number
}
export interface AgentInfo {
  id: string
  team: 'hero' | 'opp'
  keeper: boolean
  hero: boolean
  owner: boolean
  world: Pt
  feet: Pt
  head: Pt
}
export interface ButtonInfo {
  id: string
  hold: boolean
  x: number
  y: number
  r: number
}
export interface Info {
  phase: string
  finished: boolean
  mode: string
  kind: string
  heroOnBall: boolean
  heroIsKeeper: boolean
  timeLeft: number
  goal: Pt
  ownGoal: Pt
  hero: Pt
  ball: Pt
  canvas: { left: number; top: number; width: number; height: number }
  result: string | null
  paused: boolean
  clock: number
  ballWorld: { x: number; y: number; z: number }
  heroWorld: Pt
  carrier: { team: string; keeper: boolean; world: Pt; screen: Pt } | null
  buttons: ButtonInfo[]
  agents: AgentInfo[]
  passTarget: string | null
  events?: Record<string, unknown>[]
  drop?: { x: number; y: number; t: number } | null
  goalFrame: { postL: Pt; postR: Pt; barL: Pt; barR: Pt }
  pendingChoice?: unknown
  cornerChoice?: unknown
  wallChoice?: unknown
}

export interface Persona {
  name: string
  /** Reaction delay (ms) mean / sd. */
  react: [number, number]
  /** Finger scatter (CSS px, 1 sd). */
  scatter: number
  /** Shoots when within this many metres of goal. */
  shootRange: number
}

export const PERSONAS: Record<string, Persona> = {
  casual: { name: 'casual', react: [380, 110], scatter: 14, shootRange: 24 },
  average: { name: 'average', react: [280, 80], scatter: 9, shootRange: 22 },
  skilled: { name: 'skilled', react: [200, 50], scatter: 5, shootRange: 20 },
}

export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r())
export const sleep = (ms: number) => new Promise((res) => setTimeout(res, Math.max(0, ms)))

export const sceneInfo = (page: Page) =>
  page.evaluate(() => (globalThis as unknown as { __spScene?: { debugInfo(): unknown } }).__spScene?.debugInfo() ?? null) as Promise<Info | null>

export const gestureProbe = (page: Page) =>
  page.evaluate(() => (globalThis as unknown as { __spProbe?: { gestures: { outcome: string }[]; kicks: unknown[] } }).__spProbe ?? { gestures: [], kicks: [] })

const JOY = 1
const TAP = 2
const SPRINT = 3

/** Logged input, for the review. */
export interface InputLog {
  t: number
  what: string
  at?: Pt
  detail?: string
}

export class Thumbs {
  private joy: { base: Pt; cur: Pt } | null = null
  readonly log: InputLog[] = []
  private t0 = Date.now()
  constructor(private cdp: CDPSession, private r: () => number, private p: Persona) {}

  private pts(extra?: { x: number; y: number; id: number }) {
    const a: { x: number; y: number; id: number; radiusX: number; radiusY: number; force: number }[] = []
    if (this.joy) a.push({ x: this.joy.cur.x, y: this.joy.cur.y, id: JOY, radiusX: 8, radiusY: 8, force: 1 })
    if (this.sprintAt && extra?.id !== SPRINT) a.push({ x: this.sprintAt.x, y: this.sprintAt.y, id: SPRINT, radiusX: 8, radiusY: 8, force: 1 })
    if (extra) a.push({ ...extra, radiusX: 8, radiusY: 8, force: 1 })
    return a
  }
  private send(type: 'touchStart' | 'touchMove' | 'touchEnd', extra?: { x: number; y: number; id: number }) {
    return this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: this.pts(extra) })
  }
  note(what: string, at?: Pt, detail?: string) {
    this.log.push({ t: Date.now() - this.t0, what, at, detail })
  }
  scatter(at: Pt): Pt {
    return { x: at.x + gauss(this.r) * this.p.scatter, y: at.y + gauss(this.r) * this.p.scatter }
  }
  reaction(): Promise<void> {
    return sleep(this.p.react[0] + gauss(this.r) * this.p.react[1])
  }

  /** Push the stick toward a screen direction (thumb stays down). */
  async stick(c: Info['canvas'], dir: Pt | null): Promise<void> {
    if (!dir || !Number.isFinite(dir.x) || !Number.isFinite(dir.y)) {
      if (dir) this.note(`bad stick target ${dir.x},${dir.y}`)
      return this.releaseStick()
    }
    const l = Math.hypot(dir.x, dir.y)
    if (l < 1e-3) return this.releaseStick()
    const radius = Math.min(c.width, c.height) * 0.11
    if (!this.joy) {
      const base = { x: c.left + c.width * 0.2, y: c.top + c.height * 0.8 }
      this.joy = { base, cur: { ...base } }
      await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: this.pts() })
    }
    this.joy.cur = { x: this.joy.base.x + (dir.x / l) * radius, y: this.joy.base.y + (dir.y / l) * radius }
    await this.send('touchMove')
  }
  private sprintAt: Pt | null = null
  /** Hold / release the SPRINT button with another finger (third touch id). */
  async sprint(btn: ButtonInfo | undefined, on: boolean): Promise<void> {
    if (on && btn && !this.sprintAt) {
      this.sprintAt = this.scatter(btn)
      this.note('hold SPRINT', this.sprintAt)
      await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: this.pts({ ...this.sprintAt, id: SPRINT }) })
    } else if (!on && this.sprintAt) {
      this.sprintAt = null
      await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: this.pts() })
    }
  }
  async releaseStick(): Promise<void> {
    if (!this.joy) return
    this.joy = null
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: this.pts() })
  }

  /** A quick tap (second finger if the stick is held). */
  async tap(at: Pt, what: string): Promise<void> {
    const q = this.scatter(at)
    this.note(what, q)
    await this.send('touchStart', { ...q, id: TAP })
    await sleep(60 + this.r() * 60)
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: this.pts() })
  }

  /** A swipe from the lower right toward a screen point (shot / pass by swipe). */
  async swipe(c: Info['canvas'], toward: Pt, strength: number, what: string): Promise<void> {
    const short = Math.min(c.width, c.height)
    const s = { x: c.left + c.width * (0.6 + this.r() * 0.25), y: c.top + c.height * (0.62 + this.r() * 0.2) }
    const aim = this.scatter(toward)
    const dx = aim.x - s.x
    const dy = aim.y - s.y
    const dl = Math.hypot(dx, dy) || 1
    const len = short * (0.12 + 0.4 * strength)
    const dur = 90 + (1 - strength) * 220
    const n = Math.max(4, Math.round(dur / 16))
    this.note(what, aim, `len ${(len / short).toFixed(2)} dur ${dur.toFixed(0)}`)
    await this.send('touchStart', { ...s, id: TAP })
    for (let k = 1; k <= n; k++) {
      const tau = k / n
      const e = 10 * tau ** 3 - 15 * tau ** 4 + 6 * tau ** 5
      await sleep(dur / n)
      await this.send('touchMove', { x: s.x + (dx / dl) * len * e, y: s.y + (dy / dl) * len * e, id: TAP })
    }
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: this.pts() })
  }
}

const sdist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
/** Kinds whose banner asks for a shot from a dead ball. */
const SHOOT_KINDS = new Set(['freekick', 'penalty', 'long_shot'])
/** On screen and not under the score bar / the thumb buttons: something a person can see and tap. */
export function visible(info: Info, p: Pt): boolean {
  const c = info.canvas
  if (p.x < c.left + 10 || p.x > c.left + c.width - 10 || p.y < c.top + 70 || p.y > c.top + c.height - 10) return false
  return !info.buttons.some((b) => sdist(b, p) < b.r + 14)
}
const wdist = sdist

/** Buttons a person reaches for, by situation. */
const DEFEND_BTNS = ['tackle', 'press', 'block', 'intercept', 'slide', 'jump', 'head']
const ATTACK_OFF_BTNS = ['shoot', 'head', 'jump', 'control', 'first_touch', 'volley']
const KEEPER_BTNS = ['dive', 'claim', 'save', 'rush', 'punch']

export interface Decision {
  kind: 'shoot' | 'pass' | 'tackle' | 'button' | 'move' | 'wait' | 'keeper'
  why: string
}

/**
 * One step of the human policy. Returns what it did (for the log). The bot
 * does what a typical player tries: shoot when close, otherwise tap the most
 * forward free team-mate; chase the ball / the carrier with the stick and hit
 * the context button when close.
 */
export async function humanStep(th: Thumbs, info: Info, persona: Persona, state: { lastOwnerHero: boolean; actedAt: number; now: number }): Promise<Decision> {
  const c = info.canvas
  const hero = info.agents.find((a) => a.hero)
  if (!hero) return { kind: 'wait', why: 'no hero' }
  const carrier0 = info.agents.find((a) => a.owner)
  if (carrier0 && carrier0.team === 'hero' && info.kind !== 'timed_run') await th.sprint(undefined, false)
  const btn = (pool: string[]) => pool.map((id) => info.buttons.find((b) => b.id === id)).find(Boolean)
  const ballW = info.ballWorld
  const goalX = 105
  // Keeper.
  if (info.heroIsKeeper) {
    // Dive toward the side the ball is on (screen), like a keeper reading the shot.
    const side = info.ball.x < info.hero.x ? 'diveLeft' : 'diveRight'
    const b = btn([side, ...KEEPER_BTNS])
    const incoming = wdist(hero.world, ballW) < 22
    if (b && incoming && state.now - state.actedAt > 700) {
      await th.reaction()
      await th.releaseStick()
      await th.tap(b, `keeper button ${b.id}`)
      return { kind: 'keeper', why: `pressed ${b.id}` }
    }
    if (info.heroOnBall) {
      const mate = info.agents.filter((a) => a.team === 'hero' && !a.hero).sort((p, q) => q.world.x - p.world.x)[0]
      if (mate && state.now - state.actedAt > 900) {
        await th.reaction()
        await th.tap(mate.feet, `keeper distributes to ${mate.id}`)
        return { kind: 'pass', why: `tap mate ${mate.id}` }
      }
    }
    await th.stick(c, { x: info.ball.x - info.hero.x, y: info.ball.y - info.hero.y })
    return { kind: 'move', why: 'keeper tracks ball' }
  }
  // On the ball.
  if (info.heroOnBall) {
    await th.releaseStick()
    if (state.now - state.actedAt < 500) return { kind: 'wait', why: 'just acted' }
    await th.reaction()
    const toGoal = goalX - hero.world.x
    const central = Math.abs(hero.world.y - 34) < 16
    // A set piece at goal: the banner says shoot, a person swipes at the goal (even if it is off the top).
    const goalAt = visible(info, info.goal) ? info.goal : { x: info.goal.x, y: Math.max(info.goal.y, c.top + 80) }
    if (SHOOT_KINDS.has(info.kind) || (toGoal < persona.shootRange && central)) {
      const strength = toGoal < 12 ? 0.55 : 0.85
      await th.swipe(c, goalAt, strength, `shot from ${toGoal.toFixed(0)} m${visible(info, info.goal) ? '' : ' (goal off screen)'}`)
      return { kind: 'shoot', why: `in range ${toGoal.toFixed(0)} m` }
    }
    const opps = info.agents.filter((a) => a.team === 'opp')
    // Space in front and not yet in range: run at goal with it (what a person does in a 1v1 / on a break).
    const inFront = opps.filter((o) => !o.keeper && o.world.x > hero.world.x - 1 && wdist(o.world, hero.world) < 7).length
    if (!inFront && toGoal > persona.shootRange && info.kind !== 'cross' && info.kind !== 'switch_play' && state.now - state.actedAt > 300) {
      await th.stick(c, { x: goalAt.x - hero.feet.x, y: goalAt.y - hero.feet.y })
      return { kind: 'move', why: 'dribble into space' }
    }
    // A cross: the runner in the box, or whip it toward the penalty spot.
    if (info.kind === 'cross') {
      const cb = btn(['cross'])
      if (cb) {
        await th.tap(cb, 'cross: CROSS button')
        return { kind: 'pass', why: 'CROSS button' }
      }
      const runner = info.agents.filter((a) => a.team === 'hero' && !a.hero && !a.keeper && a.world.x > 88 && visible(info, a.feet)).sort((p, q) => q.world.x - p.world.x)[0]
      if (runner) {
        await th.tap(runner.feet, `cross: tap on runner ${runner.id} in the box`)
        return { kind: 'pass', why: `cross to ${runner.id}` }
      }
      await th.swipe(c, goalAt, 0.7, 'cross: swipe toward the box')
      return { kind: 'pass', why: 'cross swipe' }
    }
    const allMates = info.agents.filter((a) => a.team === 'hero' && !a.hero && !a.keeper)
    const mates = allMates
      .filter((a) => visible(info, a.feet))
      .map((m) => ({ m, free: Math.min(...opps.map((o) => wdist(o.world, m.world))), fwd: m.world.x - hero.world.x }))
      .filter((x) => x.fwd > -8)
      .sort((p, q) => q.fwd + q.free * 2 - (p.fwd + p.free * 2))
    const pick = mates[0]
    if (pick) {
      await th.tap(pick.m.feet, `pass tap on ${pick.m.id} (${pick.fwd.toFixed(0)} m fwd, ${pick.free.toFixed(1)} m free)`)
      return { kind: 'pass', why: `tap ${pick.m.id}` }
    }
    // No team-mate on screen to tap: swipe the ball forward (a pass into space / a cross).
    th.note(`no visible team-mate (${allMates.length} off screen)`)
    if (toGoal < 35) {
      await th.swipe(c, goalAt, 0.75, `no visible mate: shot/cross toward goal from ${toGoal.toFixed(0)} m`)
      return { kind: 'shoot', why: 'no visible mate' }
    }
    await th.swipe(c, { x: info.hero.x, y: c.top + c.height * 0.15 }, 0.45, 'no visible mate: swipe pass forward')
    return { kind: 'pass', why: 'no visible mate, swipe forward' }
  }
  const carrier = info.agents.find((a) => a.owner)
  // Defending: chase the man on the ball, challenge when close.
  if (carrier && carrier.team === 'opp') {
    const d = wdist(hero.world, carrier.world)
    // Block (as the card says): get into the line between him and our goal, ~3 m off him, and stay on your feet.
    if (info.kind === 'block') {
      const own = { x: 0, y: 34 }
      const dx = own.x - carrier.world.x
      const dy = own.y - carrier.world.y
      const l = Math.hypot(dx, dy) || 1
      const spot = { x: carrier.world.x + (dx / l) * 3, y: carrier.world.y + (dy / l) * 3 }
      if (wdist(hero.world, spot) < 0.8) {
        await th.releaseStick()
        return { kind: 'wait', why: 'set in the shooting line' }
      }
      // The spot on screen: 3 m along the line from him to our goal (both are on screen-space known points).
      const f = 3 / l
      const spotS = { x: carrier.feet.x + (info.ownGoal.x - carrier.feet.x) * f, y: carrier.feet.y + (info.ownGoal.y - carrier.feet.y) * f }
      await th.stick(c, { x: spotS.x - hero.feet.x, y: spotS.y - hero.feet.y })
      return { kind: 'move', why: 'into the shooting line' }
    }
    const b = btn(DEFEND_BTNS)
    if (d < 2.6 && state.now - state.actedAt > 600) {
      await th.sprint(undefined, false)
      await th.reaction()
      if (b) await th.tap(b, `defend button ${b.id} at ${d.toFixed(1)} m`)
      else await th.tap(carrier.feet, `tap on carrier at ${d.toFixed(1)} m`)
      return { kind: 'tackle', why: b ? `button ${b.id}` : 'tap carrier' }
    }
    // The big PRESS / INTERCEPT button does the closing down for you: a person hits it when the man is in reach.
    const smart = btn(['press', 'intercept'])
    if (smart && d < 14 && state.now - state.actedAt > 1500) {
      await th.reaction()
      await th.tap(smart, `${smart.id} at ${d.toFixed(1)} m`)
      return { kind: 'tackle', why: `${smart.id} button` }
    }
    await th.sprint(btn(['sprint']), d > 5)
    await th.stick(c, { x: carrier.feet.x - hero.feet.x, y: carrier.feet.y - hero.feet.y })
    return { kind: 'move', why: `chase carrier ${d.toFixed(1)} m` }
  }
  // Team-mate on the ball: run forward into space.
  if (carrier && carrier.team === 'hero') {
    // Timed run: hold the line (stay onside) until the pass is played, then go (the drop marker takes over).
    if (info.kind === 'timed_run') {
      if (info.clock < 1.6) {
        await th.releaseStick()
        return { kind: 'wait', why: 'holding the line' }
      }
      // Go: sprint in behind toward goal (the passer plays it into the run).
      await th.sprint(btn(['sprint']), true)
      await th.stick(c, { x: info.goal.x - hero.feet.x, y: info.goal.y - hero.feet.y })
      return { kind: 'move', why: 'timed run in behind' }
    }
    await th.stick(c, { x: info.goal.x - hero.feet.x, y: info.goal.y - hero.feet.y })
    return { kind: 'move', why: 'make a run' }
  }
  // A ball in the air with the drop marker on screen: run to the marker (what a person does when he sees it).
  if (info.drop && !carrier) {
    const b2 = btn(ATTACK_OFF_BTNS)
    const dScr = sdist(info.drop, hero.feet)
    if (b2 && dScr < 60 && state.now - state.actedAt > 700) {
      await th.reaction()
      await th.tap(b2, `button ${b2.id} at the drop marker`)
      return { kind: 'button', why: `${b2.id} at drop` }
    }
    await th.stick(c, { x: info.drop.x - hero.feet.x, y: info.drop.y - hero.feet.y })
    return { kind: 'move', why: 'to drop marker' }
  }
  // Loose / in the air: go to the ball, press the attacking button when it arrives.
  const dBall = wdist(hero.world, ballW)
  const b = btn(ATTACK_OFF_BTNS)
  if (b && dBall < 3 && state.now - state.actedAt > 600) {
    await th.reaction()
    await th.tap(b, `button ${b.id} on loose ball at ${dBall.toFixed(1)} m`)
    return { kind: 'button', why: b.id }
  }
  await th.sprint(btn(['sprint']), dBall > 6)
  await th.stick(c, { x: info.ball.x - info.hero.x, y: info.ball.y - info.hero.y })
  return { kind: 'move', why: `to loose ball ${dBall.toFixed(1)} m` }
}
