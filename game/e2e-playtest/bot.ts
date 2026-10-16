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
  edgeMates?: { x: number; y: number; world: Pt }[]
  ballSpeed?: number
  intercept?: Pt | null
  dropWorld?: Pt | null
  ballZ?: number
  ballVz?: number
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
  constructor(private cdp: CDPSession, readonly r: () => number, private p: Persona) {}

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
  /** Lifts one finger (CDP: touchEnd lists only the points being released; the others stay down). */
  private lift(p: { x: number; y: number; id: number }) {
    return this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ ...p, radiusX: 8, radiusY: 8, force: 1 }] })
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
      const p = this.sprintAt
      this.sprintAt = null
      await this.lift({ ...p, id: SPRINT })
    }
  }
  async releaseStick(): Promise<void> {
    if (!this.joy) return
    const j = this.joy.cur
    this.joy = null
    await this.lift({ ...j, id: JOY })
  }

  /** A quick tap (second finger if the stick is held). */
  async tap(at: Pt, what: string): Promise<void> {
    const q = this.scatter(at)
    this.note(what, q)
    await this.send('touchStart', { ...q, id: TAP })
    await sleep(60 + this.r() * 60)
    await this.lift({ ...q, id: TAP })
  }

  /** A swipe from the lower right toward a screen point (shot / pass by swipe). */
  async swipe(c: Info['canvas'], toward: Pt, strength: number, what: string, bend = 0): Promise<void> {
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
      // A curved swipe (free kicks): the path bows sideways by `bend` × its length, most in the middle.
      const off = bend * len * 4 * e * (1 - e)
      await this.send('touchMove', { x: s.x + (dx / dl) * len * e + (-dy / dl) * off, y: s.y + (dy / dl) * len * e + (dx / dl) * off, id: TAP })
    }
    await this.lift({ x: s.x + (dx / dl) * len, y: s.y + (dy / dl) * len, id: TAP })
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
/** Moments built on a delivery into the box: a person waits for the cross, not runs at the crosser. */
const WAIT_FOR_DELIVERY = new Set(['corner', 'header', 'back_post', 'cross', 'corner_kick'])
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
export async function humanStep(th: Thumbs, info: Info, persona: Persona, state: { lastOwnerHero: boolean; actedAt: number; now: number; skills?: number }): Promise<Decision> {
  const c = info.canvas
  const hero = info.agents.find((a) => a.hero)
  if (!hero) return { kind: 'wait', why: 'no hero' }
  const carrier0 = info.agents.find((a) => a.owner)
  if (carrier0 && carrier0.team === 'hero' && info.kind !== 'timed_run' && info.kind !== 'long_ball_control') await th.sprint(undefined, false)
  const btn = (pool: string[]) => pool.map((id) => info.buttons.find((b) => b.id === id)).find(Boolean)
  const ballW = info.ballWorld
  const goalX = 105
  // Keeper.
  if (info.heroIsKeeper) {
    // Dive toward the side the ball is on (screen), like a keeper reading the shot.
    const side = info.ball.x < info.hero.x ? 'diveLeft' : 'diveRight'
    const b = btn([side, ...KEEPER_BTNS])
    const incoming = wdist(hero.world, ballW) < 22
    const kc = info.agents.find((a) => a.owner)
    // A man running at him with the ball (1v1 / sweeper): come off the line once (ÇIK) to narrow the angle, then stay
    // big — a keeper does not dive at a man still dribbling (playtest: diving at 20 m, he was walked round every time).
    if (kc && kc.team === 'opp' && !info.heroOnBall) {
      const dk = wdist(hero.world, kc.world)
      const rush = btn(['rush'])
      if (rush && dk < (info.kind === 'gk_1v1' ? 8 : 16) && dk > 3 && !(state as any).rushed) {
        ;(state as any).rushed = true
        await th.reaction()
        await th.tap(rush, `keeper ÇIK at ${dk.toFixed(0)} m`)
        return { kind: 'keeper', why: 'rush' }
      }
      // Then set and big (ORTADA KAL) as he comes in; the dive is for the shot (below), not at a man still on it.
      const stayB = btn(['stay'])
      if (stayB && dk < 8 && info.kind !== 'gk_1v1' && !(state as any).stayed) {
        ;(state as any).stayed = true
        await th.tap(stayB, `keeper ORTADA KAL at ${dk.toFixed(1)} m`)
        return { kind: 'keeper', why: 'stay big' }
      }
      await th.releaseStick()
      return { kind: 'wait', why: 'keeper set' }
    }
    // Penalty: pick a side and go as he strikes it (the run-up ends ~1.5 s in) — not long before, not after.
    if (info.kind === 'gk_penalty') {
      const ds = btn(['diveLeft', 'diveRight', 'dive'])
      // The tell over the taker (◀ / ▶): a person goes that way.
      const tellE = (info.events ?? []).filter((e: any) => e.type === 'penaltyTell').pop() as { y: number } | undefined
      if (tellE && info.goalFrame && !(state as any).pkTold) {
        ;(state as any).pkTold = true
        const gf = info.goalFrame
        const f = (tellE.y - (34 - 3.66)) / 7.32
        const sx = gf.postL.x + (gf.postR.x - gf.postL.x) * f
        ;(state as any).pkSide = sx < (gf.postL.x + gf.postR.x) / 2 ? 'diveLeft' : 'diveRight'
        th.note(`penalty tell read: ${(state as any).pkSide}`)
      }
      if (ds && !(state as any).pkSide) (state as any).pkSide = th.r() < 0.5 ? 'diveLeft' : 'diveRight'
      const pick = btn([(state as any).pkSide, 'dive'])
      if (pick && info.clock >= 1.5 && !(state as any).pkDone) {
        ;(state as any).pkDone = true
        await th.tap(pick, `penalty: ${pick.id} as he strikes`)
        return { kind: 'keeper', why: 'penalty dive' }
      }
      return { kind: 'wait', why: 'penalty: reading the taker' }
    }
    // A ball played over the top toward our box with nobody on it (the sweeper moment): come out for it — ÇIK.
    const rushB = btn(['rush'])
    if (rushB && !kc && (info.ballSpeed ?? 0) > 3 && (info.ballZ ?? 0) < 1 && wdist(hero.world, ballW) > 6 && !(state as any).rushed) {
      ;(state as any).rushed = true
      await th.reaction()
      await th.tap(rushB, `keeper ÇIK for the loose ball (${wdist(hero.world, ballW).toFixed(0)} m)`)
      return { kind: 'keeper', why: 'sweep' }
    }
    // A cross dropping into the box: CATCH it (or punch), not dive at it.
    const claimB = btn(['claim', 'punch'])
    if (claimB && !kc && (info.ballZ ?? 0) > 1 && incoming && state.now - state.actedAt > 700) {
      await th.reaction()
      await th.tap(claimB, `keeper ${claimB.id} the cross`)
      return { kind: 'keeper', why: claimB.id }
    }
    // A shot / cross on its way: dive / claim.
    const shotOn = !kc && (info.ballSpeed ?? 0) > 9
    if (b && incoming && (shotOn || info.kind === 'gk_penalty' || info.kind === 'fk_wall') && state.now - state.actedAt > 700) {
      await th.reaction()
      await th.releaseStick()
      await th.tap(b, `keeper button ${b.id}`)
      return { kind: 'keeper', why: `pressed ${b.id}` }
    }
    if (info.heroOnBall) {
      // A team-mate he can see (or his badge on the screen edge) — not one off the screen.
      const seen = info.agents.filter((a) => a.team === 'hero' && !a.hero && visible(info, a.feet)).sort((p, q) => q.world.x - p.world.x)[0]
      const edge = (info.edgeMates ?? [])[0]
      const mate = seen ? { id: seen.id, feet: seen.feet } : edge ? { id: 'edge badge', feet: { x: edge.x, y: edge.y } } : null
      if (mate && state.now - state.actedAt > 900) {
        await th.reaction()
        await th.tap(mate.feet, `keeper distributes to ${mate.id}`)
        return { kind: 'pass', why: `tap mate ${mate.id}` }
      }
    }
    // The keeper positions himself when the stick is free (assisted positioning).
    await th.releaseStick()
    return { kind: 'wait', why: 'keeper positioning' }
  }
  // On the ball.
  if (info.heroOnBall) {
    // Long ball brought down: shield it a moment as the card says (the job is keeping it).
    if ((info.kind === 'long_ball_control' || info.kind === 'shoulder_duel') && state.now - state.actedAt > 400) {
      const sh = btn(['shield'])
      if (sh) {
        await th.sprint(sh, true)
        return { kind: 'wait', why: 'shielding the long ball' }
      }
    }
    // (The left thumb stays on the stick while he reads the play: playtest round 5 — releasing it every step froze
    // the dribbler for the whole reaction time, every step.)
    if (state.now - state.actedAt < 500) return { kind: 'wait', why: 'just acted' }
    await th.reaction()
    const toGoal = goalX - hero.world.x
    const central = Math.abs(hero.world.y - 34) < 16
    // A set piece at goal: the banner says shoot, a person swipes at the goal (even if it is off the top).
    const goalAt = visible(info, info.goal) ? info.goal : { x: info.goal.x, y: Math.max(info.goal.y, c.top + 80) }
    // Dribble (the card): take the man on — run at him, SKILL 1.5–2.5 m out, then sprint past; only then pass / shoot.
    // Just did the skill: burst past him (the card: SPRINT past) before looking up.
    if (info.kind === 'dribble' && (state.skills ?? 0) >= 1 && state.now - state.actedAt < 1300) {
      await th.sprint(btn(['sprint']), true)
      await th.stick(c, { x: goalAt.x - hero.feet.x, y: goalAt.y - hero.feet.y })
      return { kind: 'move', why: 'burst past after the skill' }
    }
    // (One take-on: after the skill he plays on — shoots or passes — instead of taking on every man after it.)
    if (info.kind === 'dribble' && (state.skills ?? 0) < 1) {
      const man = info.agents.filter((a) => a.team === 'opp' && !a.keeper && a.world.x > hero.world.x - 0.5 && wdist(a.world, hero.world) < 9).sort((p, q) => wdist(p.world, hero.world) - wdist(q.world, hero.world))[0]
      if (man) {
        const d = wdist(man.world, hero.world)
        const sk = btn(['skill'])
        if (sk && d < 2.6 && d > 1.2 && state.now - state.actedAt > 600) {
          await th.tap(sk, `SKILL at ${d.toFixed(1)} m from his man`)
          state.skills = (state.skills ?? 0) + 1
          return { kind: 'button', why: 'skill' }
        }
        await th.sprint(btn(['sprint']), d < 2)
        await th.stick(c, { x: goalAt.x - hero.feet.x, y: goalAt.y - hero.feet.y })
        return { kind: 'move', why: `take on his man (${d.toFixed(1)} m)` }
      }
    }
    // One-on-one (the card): take it on toward the keeper and finish close, not from 22 m.
    const oppNear = info.agents.some((a) => a.team === 'opp' && wdist(a.world, hero.world) < 5)
    // (Through on goal after a timed run the same: run at the keeper.)
    const carryOn = (info.kind === 'one_on_one' || info.kind === 'timed_run') && toGoal > 13 && !oppNear
    if (!carryOn && (SHOOT_KINDS.has(info.kind) || (toGoal < persona.shootRange && central))) {
      // A person looks before he shoots: the goal still off screen (the camera on its way) and nobody on him — wait.
      if (!visible(info, info.goal) && !oppNear) return { kind: 'wait', why: 'looking for the goal' }
      // From distance the ŞUT button (the card: a placed shot to the keeper's far corner) — half the people use it.
      const sb = btn(['shoot'])
      if (sb && toGoal > 17 && th.r() < 0.5) {
        await th.tap(sb, `ŞUT button from ${toGoal.toFixed(0)} m`)
        return { kind: 'shoot', why: `button ${toGoal.toFixed(0)} m` }
      }
      const strength = info.kind === 'freekick' ? 0.6 : toGoal < 12 ? 0.55 : 0.85
      // A person aims for a corner, away from the keeper (the far side of him, inside the post).
      const gf = info.goalFrame
      const kp = info.agents.find((a) => a.keeper && a.team === 'opp')
      let shotAt = goalAt
      if (gf && visible(info, info.goal)) {
        const mid = { x: (gf.postL.x + gf.postR.x) / 2, y: (gf.postL.y + gf.postR.y) / 2 }
        const far = kp && Math.hypot(kp.feet.x - gf.postL.x, kp.feet.y - gf.postL.y) > Math.hypot(kp.feet.x - gf.postR.x, kp.feet.y - gf.postR.y) ? gf.postL : gf.postR
        shotAt = { x: mid.x + (far.x - mid.x) * 0.7, y: mid.y + (far.y - mid.y) * 0.7 }
      }
      // Free kick (the card): curl it round the wall — a bowed swipe, away from the side it starts on.
      const bend = info.kind === 'freekick' ? (shotAt.x < hero.feet.x ? -0.18 : 0.18) : 0
      await th.swipe(c, shotAt, strength, `shot from ${toGoal.toFixed(0)} m${visible(info, info.goal) ? "" : " (goal off screen)"}${bend ? ` curled ${bend > 0 ? "right" : "left"}` : ""}`, bend)
      return { kind: 'shoot', why: `in range ${toGoal.toFixed(0)} m` }
    }
    const opps = info.agents.filter((a) => a.team === 'opp')
    // Space in front and not yet in range: run at goal with it (what a person does in a 1v1 / on a break).
    const inFront = opps.filter((o) => !o.keeper && o.world.x > hero.world.x - 1 && wdist(o.world, hero.world) < 7).length
    if ((carryOn || (!inFront && toGoal > persona.shootRange)) && info.kind !== 'cross' && info.kind !== 'switch_play' && state.now - state.actedAt > 300) {
      await th.stick(c, { x: goalAt.x - hero.feet.x, y: goalAt.y - hero.feet.y })
      return { kind: 'move', why: 'dribble into space' }
    }
    // A cross: the runner in the box, or whip it toward the penalty spot.
    if (info.kind === 'cross') {
      const cb = btn(['cross'])
      // The card: release as the runner arrives in the box.
      const arriving = info.agents.some((a) => a.team === 'hero' && !a.hero && !a.keeper && a.world.x > 91)
      if (cb && !arriving && info.clock < 2.2) return { kind: 'wait', why: 'waiting for the runner' }
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
    // Switch of play (the card): the long diagonal to the far wing — UZUN TOP finds the freest man far away.
    if (info.kind === 'switch_play') {
      const lb = btn(['lofted'])
      if (lb) {
        await th.tap(lb, 'switch: LOFTED (long ball) button')
        return { kind: 'pass', why: 'lofted switch' }
      }
      const far = [...info.agents.filter((a) => a.team === 'hero' && !a.hero && !a.keeper && visible(info, a.feet)).map((a) => ({ p: a.feet as Pt, w: a.world })), ...(info.edgeMates ?? []).map((e) => ({ p: { x: e.x, y: e.y }, w: e.world }))]
        .sort((p, q) => Math.abs(q.w.y - hero.world.y) - Math.abs(p.w.y - hero.world.y))[0]
      if (far) {
        await th.tap(far.p, `switch: tap the far-side man (${Math.abs(far.w.y - hero.world.y).toFixed(0)} m across)`)
        return { kind: 'pass', why: 'switch tap' }
      }
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
    // A badge on the screen edge for a team-mate off screen: tap the most forward one.
    const edge = (info.edgeMates ?? []).slice().sort((p, q) => q.world.x - p.world.x)[0]
    if (edge && edge.world.x > hero.world.x - 6) {
      await th.tap(edge, `pass tap on the edge badge (mate ${(edge.world.x - hero.world.x).toFixed(0)} m fwd, off screen)`)
      return { kind: 'pass', why: 'edge badge' }
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
    if (d < 1.8 && state.now - state.actedAt > 600) {
      await th.sprint(undefined, false)
      await th.reaction()
      if (b) await th.tap(b, `defend button ${b.id} at ${d.toFixed(1)} m`)
      else await th.tap(carrier.feet, `tap on carrier at ${d.toFixed(1)} m`)
      return { kind: 'tackle', why: b ? `button ${b.id}` : 'tap carrier' }
    }
    // 1v1 (as the card says): stay goal-side on your feet, JOCKEY, and only go in when he is right on you.
    if (info.kind === 'defend_1v1') {
      const jk = btn(['jockey'])
      if (d < 1.5 && state.now - state.actedAt > 700) {
        const tk = btn(['tackle'])
        await th.reaction()
        if (tk) await th.tap(tk, `1v1 tackle at ${d.toFixed(1)} m`)
        return { kind: 'tackle', why: '1v1 tackle close' }
      }
      await th.sprint(btn(['sprint']), false)
      await th.sprint(jk, d < 6)
      await th.stick(c, { x: carrier.feet.x - hero.feet.x + (info.ownGoal.x - carrier.feet.x) * 0.15, y: carrier.feet.y - hero.feet.y + (info.ownGoal.y - carrier.feet.y) * 0.15 })
      return { kind: 'move', why: `1v1 jockey ${d.toFixed(1)} m` }
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
    // Long ball (the card): he is the target — stay and get under it, do not run away from the ball.
    if (info.kind === 'long_ball_control') {
      await th.releaseStick()
      return { kind: 'wait', why: 'waiting for the ball played to him' }
    }
    // Timed run: hold the line (stay onside) until the pass is played, then go (the drop marker takes over).
    if (info.kind === 'timed_run') {
      // The card: wait on the line until the pass is played (ask for it with CALL); the drop marker takes over then.
      await th.releaseStick()
      const call = btn(['call'])
      if (call && info.clock > 0.9 && state.now - state.actedAt > 2500) {
        await th.reaction()
        await th.tap(call, 'CALL for the ball on the line')
        return { kind: 'button', why: 'call' }
      }
      return { kind: 'wait', why: 'holding the line' }
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
    // On the marker: stand still and let it come (playtest: the stick kept hunting and he drifted off it).
    const dW = wdist(hero.world, info.dropWorld ?? hero.world)
    if (info.dropWorld ? dW < 0.6 : dScr < 14) {
      await th.sprint(undefined, false)
      await th.releaseStick()
      return { kind: 'wait', why: 'on the drop marker' }
    }
    await th.sprint(btn(['sprint']), dScr > 70)
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
  // A ball struck from far away toward the box (a cross just off the boot): a person waits for it, not runs at it.
  // (In the air only: a through ball along the ground is chased.)
  if (WAIT_FOR_DELIVERY.has(info.kind) && dBall > 15 && info.ballSpeed !== undefined && info.ballSpeed > 12 && ((info.ballZ ?? 0) > 0.4 || (info.ballVz ?? 0) > 2)) {
    await th.releaseStick()
    return { kind: 'wait', why: 'ball on its way' }
  }
  await th.sprint(btn(['sprint']), dBall > 6)
  // A moving ball: run to where he meets it, not where it is now (playtest: he ran back at a ball played past him).
  const to = info.intercept && (info.ballSpeed ?? 0) > 4 ? info.intercept : info.ball
  await th.stick(c, { x: to.x - info.hero.x, y: to.y - info.hero.y })
  return { kind: 'move', why: `to loose ball ${dBall.toFixed(1)} m` }
}
