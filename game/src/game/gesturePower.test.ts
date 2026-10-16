/**
 * Touch shooting (owner feedback from the Android build): power must follow the
 * swipe across the whole range, identically on every screen size, device pixel
 * ratio and camera zoom, and no deliberate swipe may be dropped.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { analyzeSwipe, gestureUnit, peakSpeed, swipePower, GESTURE_UNIT_MAX_CSS, type GesturePoint } from './kick'
import { InputController, type InputMapper } from './input'
import { FIT_BY_DISTANCE, fitZoom, screenDirToPitch, unproject } from './view'

interface Screen {
  name: string
  cssW: number
  cssH: number
  dpr: number
}
const SCREENS: Screen[] = [
  { name: 'phone portrait dpr3', cssW: 390, cssH: 844, dpr: 3 },
  { name: 'phone landscape dpr2.75', cssW: 915, cssH: 412, dpr: 2.75 },
  { name: 'small phone dpr2', cssW: 360, cssH: 740, dpr: 2 },
  { name: 'tablet dpr2', cssW: 1024, cssH: 1366, dpr: 2 },
  { name: 'desktop dpr1', cssW: 1440, cssH: 900, dpr: 1 },
]

/**
 * A human-like swipe of `lenCss` CSS px over `dur` seconds (minimum-jerk
 * profile), sampled at `hz`, as the input layer sees it on a given screen and
 * camera zoom. `lift` < 1 releases mid-motion (a flick).
 */
function swipe(scr: Screen, lenCss: number, dur: number, opts: { hz?: number; zoom?: number; lift?: number; jitter?: number } = {}): GesturePoint[] {
  const hz = opts.hz ?? 120
  const zoom = opts.zoom ?? 1
  const lift = opts.lift ?? 1
  const w = scr.cssW * scr.dpr
  const h = scr.cssH * scr.dpr
  const unit = gestureUnit(w, h, scr.dpr)
  const n = Math.max(2, Math.round(dur * hz))
  const mj = (x: number) => 10 * x ** 3 - 15 * x ** 4 + 6 * x ** 5
  const pts: GesturePoint[] = []
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * (opts.jitter ?? 0)
  for (let k = 0; k <= n; k++) {
    const tau = (k / n) * lift
    const s = mj(tau) / mj(lift)
    // Up the screen toward goal, in canvas px.
    const gx = w * 0.6
    const gy = h * 0.8 - lenCss * scr.dpr * s
    const world = unproject((gx - w / 2) / zoom, (gy - h / 2) / zoom)
    pts.push({ sx: gx / unit, sy: gy / unit, wx: world.x, wy: world.y, t: Math.max(0, (dur * k) / n + (k > 0 ? rnd() : 0)) })
  }
  return pts
}

/** The same physical swipe on a screen: lengths are a share of the gesture unit in CSS px. */
const unitCss = (scr: Screen) => gestureUnit(scr.cssW * scr.dpr, scr.cssH * scr.dpr, scr.dpr) / scr.dpr

describe('gesture unit', () => {
  it('is the short side on phones and capped on big screens, in canvas pixels', () => {
    expect(gestureUnit(390 * 3, 844 * 3, 3)).toBe(390 * 3)
    expect(gestureUnit(1024 * 2, 1366 * 2, 2)).toBe(GESTURE_UNIT_MAX_CSS * 2)
    expect(gestureUnit(1440, 900, 1)).toBe(GESTURE_UNIT_MAX_CSS)
  })
})

describe('swipe power mapping', () => {
  it('spans the full range: short/slow is soft, long/fast is full power', () => {
    for (const scr of SCREENS) {
      const u = unitCss(scr)
      const soft = analyzeSwipe(swipe(scr, u * 0.07, 0.45)).power
      const mid = analyzeSwipe(swipe(scr, u * 0.3, 0.3)).power
      const hard = analyzeSwipe(swipe(scr, u * 0.55, 0.13)).power
      expect(soft, scr.name).toBeLessThan(0.22)
      expect(mid, scr.name).toBeGreaterThan(0.4)
      expect(mid, scr.name).toBeLessThan(0.8)
      expect(hard, scr.name).toBeGreaterThanOrEqual(0.98)
      expect(hard - soft, scr.name).toBeGreaterThanOrEqual(0.85)
    }
  })

  it('is monotonic in length and in speed', () => {
    const scr = SCREENS[0]!
    const u = unitCss(scr)
    let prev = -1
    for (let f = 0.06; f <= 0.6; f += 0.06) {
      const p = analyzeSwipe(swipe(scr, u * f, 0.25)).power
      expect(p).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = p
    }
    prev = 2
    for (let d = 0.08; d <= 0.8; d += 0.08) {
      const p = analyzeSwipe(swipe(scr, u * 0.35, d)).power
      expect(p).toBeLessThanOrEqual(prev + 1e-9)
      prev = p
    }
    expect(swipePower(0.5, 3.2)).toBeCloseTo(1, 6)
    expect(swipePower(0.6, 9)).toBeLessThanOrEqual(1.15)
    expect(swipePower(0.05, 0.3)).toBeLessThan(0.15)
  })

  it('is independent of the device pixel ratio', () => {
    const base: Screen = { name: 'p', cssW: 390, cssH: 844, dpr: 1 }
    for (const dpr of [1, 1.5, 2, 2.75, 3, 4]) {
      const scr = { ...base, dpr }
      for (const [len, dur] of [[40, 0.3], [150, 0.2], [260, 0.12]] as const) {
        expect(analyzeSwipe(swipe(scr, len, dur)).power).toBeCloseTo(analyzeSwipe(swipe(base, len, dur)).power, 6)
      }
    }
  })

  it('is independent of the camera zoom (far / normal / close), and the aim direction too', () => {
    const scr = SCREENS[0]!
    const w = scr.cssW * scr.dpr
    const vh = scr.cssH * scr.dpr
    const zooms = (Object.keys(FIT_BY_DISTANCE) as (keyof typeof FIT_BY_DISTANCE)[]).map((m) => fitZoom(w, vh, false, m))
    const ref = analyzeSwipe(swipe(scr, 180, 0.2, { zoom: zooms[0] }))
    for (const zoom of zooms) {
      const f = analyzeSwipe(swipe(scr, 180, 0.2, { zoom }))
      expect(f.power).toBeCloseTo(ref.power, 6)
      expect(f.dir.x).toBeCloseTo(ref.dir.x, 6)
      expect(f.dir.y).toBeCloseTo(ref.dir.y, 6)
    }
  })

  it('does not depend on the touch sampling rate or on batched / jittery timestamps', () => {
    const scr = SCREENS[0]!
    const u = unitCss(scr)
    for (const [f, dur] of [[0.12, 0.35], [0.3, 0.2], [0.5, 0.12]] as const) {
      const ref = analyzeSwipe(swipe(scr, u * f, dur, { hz: 120 })).power
      expect(analyzeSwipe(swipe(scr, u * f, dur, { hz: 60 })).power).toBeCloseTo(ref, 1)
      expect(Math.abs(analyzeSwipe(swipe(scr, u * f, dur, { hz: 90, jitter: 0.008 })).power - ref)).toBeLessThan(0.08)
    }
  })

  it('a flick released mid-motion keeps its speed; slowing before release does not erase it', () => {
    const scr = SCREENS[0]!
    const u = unitCss(scr)
    const flick = analyzeSwipe(swipe(scr, u * 0.4, 0.12, { lift: 0.7 }))
    expect(flick.power).toBeGreaterThan(0.9)
    const full = swipe(scr, u * 0.4, 0.2)
    expect(peakSpeed(full)).toBeGreaterThan((0.4 / 0.2) * 1.4)
  })
})

// ───────────────────────── Input controller: no dropped swipes ─────────────────────────

class FakeCanvas extends EventTarget {
  style: Record<string, string> = {}
  readonly w: number
  readonly h: number
  constructor(w: number, h: number) {
    super()
    this.w = w
    this.h = h
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.w, height: this.h }
  }
  setPointerCapture() {}
}

function ptr(type: string, id: number, x: number, y: number, t: number): Event {
  const e = new Event(type)
  Object.defineProperties(e, {
    pointerId: { value: id },
    pointerType: { value: 'touch' },
    clientX: { value: x },
    clientY: { value: y },
    button: { value: 0 },
    timeStamp: { value: t * 1000 },
  })
  return e
}

describe('InputController touch swipes', () => {
  const W = 390
  const H = 844
  let canvas: FakeCanvas
  let input: InputController
  let clock = 0
  const realNow = performance.now.bind(performance)
  beforeEach(() => {
    ;(globalThis as { window?: unknown }).window ??= new EventTarget()
    clock = 10
    performance.now = () => clock * 1000
    canvas = new FakeCanvas(W, H)
    const mapper: InputMapper = {
      // Simple top-down mapping: up the screen = toward the goal at x = 105.
      toWorld: (gx, gy) => ({ x: 105 - (gy / H) * 40, y: 14 + (gx / W) * 40 }),
      screenDirToWorld: (dx, dy) => screenDirToPitch(dx, dy),
      size: () => ({ w: W, h: H }),
      ui: () => 1,
    }
    input = new InputController(canvas as unknown as HTMLCanvasElement, mapper)
  })
  afterEach(() => {
    input.dispose()
    performance.now = realNow
  })
  const ctx = { heroPos: { x: 88, y: 34 }, ballPos: { x: 88.5, y: 34 }, heroOnBall: true, heroIsKeeper: false }

  /** Swipes from (x, y) up by `len` px over `dur` s at 60 Hz; returns the actions polled after it. */
  function doSwipe(x: number, y: number, len: number, dur: number, opts: { cancel?: boolean; id?: number } = {}) {
    input.poll(ctx)
    const id = opts.id ?? 1
    canvas.dispatchEvent(ptr('pointerdown', id, x, y, clock))
    const n = Math.max(2, Math.round(dur * 60))
    for (let k = 1; k <= n; k++) {
      clock += dur / n
      canvas.dispatchEvent(ptr('pointermove', id, x, y - (len * k) / n, clock))
    }
    clock += 0.004
    canvas.dispatchEvent(opts.cancel ? ptr('pointercancel', id, 0, 0, clock) : ptr('pointerup', id, x, y - len, clock))
    return input.poll(ctx).actions
  }

  it('a swipe in the swipe zone shoots', () => {
    const acts = doSwipe(W * 0.7, H * 0.8, 200, 0.15)
    expect(acts.map((a) => a.kind)).toEqual(['swipe'])
  })

  it('a fast flick from the joystick side with the hero on the ball still shoots', () => {
    const acts = doSwipe(W * 0.3, H * 0.8, 200, 0.15)
    expect(acts.map((a) => a.kind)).toEqual(['swipe'])
  })

  it('a slow joystick push stays a joystick (no accidental shot)', () => {
    const acts = doSwipe(W * 0.2, H * 0.8, 60, 0.8)
    expect(acts).toEqual([])
  })

  it('a quick tap on a team-mate in the joystick half is a pass tap, not a dead joystick touch', () => {
    // Playtest (Android): a team-mate on the left of the screen could not be tapped to pass.
    input.poll(ctx)
    canvas.dispatchEvent(ptr('pointerdown', 9, W * 0.25, H * 0.45, clock))
    clock += 0.09
    canvas.dispatchEvent(ptr('pointerup', 9, W * 0.25 + 2, H * 0.45 + 1, clock))
    const acts = input.poll(ctx).actions
    expect(acts.map((a) => a.kind)).toEqual(['tapAt'])
  })

  it('a joystick push toward goal that holds before letting go stays a joystick', () => {
    input.poll(ctx)
    canvas.dispatchEvent(ptr('pointerdown', 8, W * 0.2, H * 0.8, clock))
    for (let k = 1; k <= 12; k++) {
      clock += 0.025
      canvas.dispatchEvent(ptr('pointermove', 8, W * 0.2, H * 0.8 - k * 10, clock))
    }
    clock += 0.2
    canvas.dispatchEvent(ptr('pointerup', 8, W * 0.2, H * 0.8 - 120, clock))
    expect(input.poll(ctx).actions).toEqual([])
  })

  it('a slower deliberate swipe from the joystick side still shoots', () => {
    expect(doSwipe(W * 0.3, H * 0.8, 0.22 * W, 0.33).map((a) => a.kind)).toEqual(['swipe'])
  })

  it('a swipe that starts on the SKILL / SPRINT button is a swipe, not a skill move', () => {
    const ui = input.touchUi()
    expect(doSwipe(ui.skill.x, ui.skill.y, 220, 0.16).map((a) => a.kind)).toEqual(['swipe'])
    expect(doSwipe(ui.sprint.x, ui.sprint.y, 220, 0.16).map((a) => a.kind)).toEqual(['swipe'])
  })

  it('a tiny sharp flick off a button toward goal shoots', () => {
    const ui = input.touchUi()
    expect(doSwipe(ui.skill.x, ui.skill.y, 0.065 * W, 0.06).map((a) => a.kind)).toEqual(['swipe'])
  })

  it('a tap on SKILL still fires the skill', () => {
    const ui = input.touchUi()
    input.poll(ctx)
    canvas.dispatchEvent(ptr('pointerdown', 3, ui.skill.x, ui.skill.y, clock))
    clock += 0.08
    canvas.dispatchEvent(ptr('pointerup', 3, ui.skill.x, ui.skill.y, clock))
    expect(input.poll(ctx).actions.map((a) => a.kind)).toEqual(['skill'])
  })

  // TestFlight 6: "I press Sprint and the player throws himself to the ground". Off the ball a thumb
  // drifting on SPRINT used to become a swipe = a slide tackle (or a keeper dive).
  it('off the ball, a thumb sliding around on SPRINT stays sprint: no swipe, no slide', () => {
    const off = { ...ctx, heroOnBall: false }
    const ui = input.touchUi()
    input.poll(off)
    canvas.dispatchEvent(ptr('pointerdown', 4, ui.sprint.x, ui.sprint.y, clock))
    let sprinting = true
    for (let k = 1; k <= 20; k++) {
      clock += 0.03
      canvas.dispatchEvent(ptr('pointermove', 4, ui.sprint.x - k * 4, ui.sprint.y - k * 3, clock))
      const f = input.poll(off)
      sprinting &&= f.sprint
      expect(f.actions).toEqual([])
    }
    clock += 0.03
    canvas.dispatchEvent(ptr('pointerup', 4, ui.sprint.x - 80, ui.sprint.y - 60, clock))
    expect(input.poll(off).actions).toEqual([])
    expect(sprinting).toBe(true)
    // Same for a keeper (it used to be a dive).
    const gk = { ...off, heroIsKeeper: true }
    input.poll(gk)
    canvas.dispatchEvent(ptr('pointerdown', 5, ui.sprint.x, ui.sprint.y, clock))
    for (let k = 1; k <= 10; k++) {
      clock += 0.03
      canvas.dispatchEvent(ptr('pointermove', 5, ui.sprint.x - k * 8, ui.sprint.y, clock))
    }
    canvas.dispatchEvent(ptr('pointerup', 5, ui.sprint.x - 80, ui.sprint.y, clock + 0.03))
    expect(input.poll(gk).actions).toEqual([])
  })

  it('context buttons: a tap fires its button on the press, SPRINT / JOCKEY are holds, a drag never swipes', () => {
    const def = { ...ctx, heroOnBall: false }
    input.setButtons([
      { id: 'tackle', hold: false, key: 'KeyF' },
      { id: 'slide', hold: false, key: 'Space' },
      { id: 'jockey', hold: true, key: 'KeyE' },
      { id: 'sprint', hold: true, key: 'ShiftLeft' },
    ])
    const ui = input.touchUi()
    expect(ui.buttons.map((b) => b.id)).toEqual(['tackle', 'slide', 'jockey', 'sprint'])
    // Buttons never overlap and stay on screen.
    for (const b of ui.buttons) {
      expect(b.x - b.r).toBeGreaterThanOrEqual(0)
      expect(b.x + b.r).toBeLessThanOrEqual(W)
      expect(b.y + b.r).toBeLessThanOrEqual(H)
      for (const o of ui.buttons) if (o !== b) expect(Math.hypot(o.x - b.x, o.y - b.y)).toBeGreaterThan(o.r + b.r)
    }
    const at = (id: string) => ui.buttons.find((b) => b.id === id)!
    input.poll(def)
    canvas.dispatchEvent(ptr('pointerdown', 7, at('tackle').x, at('tackle').y, clock))
    expect(input.poll(def).actions).toEqual([{ kind: 'btn', id: 'tackle' }])
    canvas.dispatchEvent(ptr('pointerup', 7, at('tackle').x, at('tackle').y, clock + 0.05))
    expect(input.poll(def).actions).toEqual([])
    // Hold SPRINT and drag the thumb across the screen: sprint all the way, never a swipe.
    canvas.dispatchEvent(ptr('pointerdown', 8, at('sprint').x, at('sprint').y, clock))
    for (let k = 1; k <= 12; k++) {
      clock += 0.02
      canvas.dispatchEvent(ptr('pointermove', 8, at('sprint').x - k * 15, at('sprint').y - k * 20, clock))
      const f = input.poll(def)
      expect(f.sprint).toBe(true)
      expect(f.actions).toEqual([])
    }
    canvas.dispatchEvent(ptr('pointerup', 8, at('sprint').x - 180, at('sprint').y - 240, clock + 0.02))
    const after = input.poll(def)
    expect(after.actions).toEqual([])
    expect(after.sprint).toBe(false)
    // JOCKEY is a hold.
    canvas.dispatchEvent(ptr('pointerdown', 9, at('jockey').x, at('jockey').y, clock))
    expect(input.poll(def).hold).toBe('jockey')
    canvas.dispatchEvent(ptr('pointerup', 9, at('jockey').x, at('jockey').y, clock + 0.3))
    expect(input.poll(def).hold).toBe(null)
    input.setButtons(null)
  })

  it('context buttons on the ball: a tap fires on release, a swipe that starts on one is a swipe', () => {
    input.setButtons([
      { id: 'pass', hold: false, key: 'KeyQ' },
      { id: 'shoot', hold: false, key: 'KeyC' },
      { id: 'skill', hold: false, key: 'Space' },
      { id: 'sprint', hold: true, key: 'ShiftLeft' },
    ])
    const ui = input.touchUi()
    const at = (id: string) => ui.buttons.find((b) => b.id === id)!
    input.poll(ctx)
    canvas.dispatchEvent(ptr('pointerdown', 12, at('skill').x, at('skill').y, clock))
    expect(input.poll(ctx).actions).toEqual([])
    clock += 0.08
    canvas.dispatchEvent(ptr('pointerup', 12, at('skill').x, at('skill').y, clock))
    expect(input.poll(ctx).actions).toEqual([{ kind: 'btn', id: 'skill' }])
    for (const id of ['pass', 'shoot', 'sprint']) expect(doSwipe(at(id).x, at(id).y, 0.28 * W, 0.3, { id: 13 }).map((a) => a.kind), id).toEqual(['swipe'])
    input.setButtons(null)
  })

  it('a swipe ended by pointercancel still shoots', () => {
    expect(doSwipe(W * 0.7, H * 0.8, 200, 0.15, { cancel: true }).map((a) => a.kind)).toEqual(['swipe'])
  })

  it('a gesture that lost its pointerup does not block the next swipe', () => {
    input.poll(ctx)
    canvas.dispatchEvent(ptr('pointerdown', 5, W * 0.7, H * 0.8, clock))
    canvas.dispatchEvent(ptr('pointermove', 5, W * 0.7, H * 0.7, clock + 0.05))
    clock += 4
    expect(doSwipe(W * 0.7, H * 0.8, 200, 0.15, { id: 6 }).map((a) => a.kind)).toEqual(['swipe'])
  })

  it('with the hero static (finishing drill) the whole screen takes swipes', () => {
    input.poll({ ...ctx, noMove: true })
    canvas.dispatchEvent(ptr('pointerdown', 9, W * 0.1, H * 0.85, clock))
    for (let k = 1; k <= 30; k++) {
      clock += 0.02
      canvas.dispatchEvent(ptr('pointermove', 9, W * 0.1, H * 0.85 - k * 3, clock))
    }
    canvas.dispatchEvent(ptr('pointerup', 9, W * 0.1, H * 0.85 - 90, clock))
    expect(input.poll({ ...ctx, noMove: true }).actions.map((a) => a.kind)).toEqual(['swipe'])
  })

  it('a resting finger does not steal or chip the swipe; two moving fingers chip', () => {
    const run = (restMoves: boolean) => {
      input.poll({ ...ctx, noMove: true })
      canvas.dispatchEvent(ptr('pointerdown', 20, W * 0.15, H * 0.9, clock))
      clock += 0.05
      canvas.dispatchEvent(ptr('pointerdown', 21, W * 0.7, H * 0.8, clock))
      for (let k = 1; k <= 10; k++) {
        clock += 0.016
        canvas.dispatchEvent(ptr('pointermove', 21, W * 0.7, H * 0.8 - k * 20, clock))
        if (restMoves) canvas.dispatchEvent(ptr('pointermove', 20, W * 0.15, H * 0.9 - k * 20, clock))
      }
      canvas.dispatchEvent(ptr('pointerup', 21, W * 0.7, H * 0.8 - 200, clock))
      clock += 0.05
      canvas.dispatchEvent(ptr('pointerup', 20, W * 0.15, H * 0.9, clock))
      return input.poll({ ...ctx, noMove: true }).actions
    }
    const one = run(false)
    expect(one.map((a) => a.kind)).toEqual(['swipe'])
    expect(one[0]?.kind === 'swipe' && one[0].swipe.chip).toBe(false)
    clock += 1
    const two = run(true)
    expect(two.map((a) => a.kind)).toEqual(['swipe'])
    expect(two[0]?.kind === 'swipe' && two[0].swipe.chip).toBe(true)
  })

  it('the released power is held on the ring for feedback', () => {
    const acts = doSwipe(W * 0.7, H * 0.8, 250, 0.12)
    const sw = acts[0]
    expect(sw?.kind).toBe('swipe')
    const flash = input.releaseFlash()
    expect(flash?.power).toBeCloseTo(sw?.kind === 'swipe' ? sw.swipe.power : -1, 6)
    clock += 2
    expect(input.releaseFlash()).toBeNull()
  })
})

// ───────────────────────── Drills: a swipe on a frame with no fixed step is not lost ─────────────────────────

describe('drill fixed-step input', () => {
  it('on a 120 Hz screen every swipe still shoots (frames that run no physics step carry their actions)', async () => {
    const { createDrill } = await import('./training/drills')
    const { flatAttrs } = await import('./setup')
    const d = createDrill('finishing', { attrs: flatAttrs(65), seed: 3, aimAssist: 'half' })
    const idle = { move: { x: 0, y: 0 }, sprint: false, actions: [], aim: null }
    // Countdown at 120 Hz.
    while (!d.live) d.update(1 / 120, idle)
    let shots = 0
    let tries = 0
    for (let frame = 0; frame < 120 * 30 && !d.finished; frame++) {
      const v = d.view()
      // Swipe on every other frame the ball is ready: half of them land on frames with no step.
      const fire = v.heroOnBall && frame % 37 === 0
      const sw = { dir: { x: 1, y: 0 }, length: 0.4, duration: 0.15, speed: 3, power: 0.9, curl: 0, chip: false, isTap: false }
      if (fire) tries++
      d.update(1 / 120, fire ? { ...idle, actions: [{ kind: 'swipe', swipe: sw }] } : idle)
      for (const e of d.drainEvents()) if (e.type === 'kick') shots++
    }
    expect(tries).toBeGreaterThan(5)
    expect(shots).toBe(tries)
  })
})
