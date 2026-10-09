/**
 * Unified input → intent stream for the highlight player.
 *
 * Sources:
 * - Touch: dynamic virtual joystick on the left half; right half swipes
 *   (shot/pass/curl/chip), taps (pass to team-mate / header / tackle / dive),
 *   double-tap = skill; on-screen SPRINT and SKILL buttons.
 * - Mouse + keyboard: WASD/arrows move, left click = pass to clicked team-mate,
 *   left hold & release = shot with power bar (aim at cursor, drag curve = curl),
 *   right click = through ball, Shift = sprint, Space = skill (or contextual
 *   action off the ball), Ctrl/E = chip modifier.
 * - Gamepad (standard mapping): left stick move, A pass, B hold = shot,
 *   Y through ball, X cross/lofted, RT sprint, RB skill, LB chip, right stick
 *   X = curl. Analog scheme: LT depth = power, left stick picks the goal spot.
 *
 * Control schemes (settings, WP-13, see {@link getControlPrefs}): touch
 * shooting = swipe / sling-shot (pull back) / tap + oscillating meter; PC and
 * gamepad power = hold-charge / oscillating bar (gamepad also analog); mouse
 * wheel adds curl while aiming; adjustable stick dead zone.
 *
 * Coordinates: raw events are in canvas (game) pixels; a {@link InputMapper}
 * supplied by the scene maps them to pitch meters.
 */
import {
  analogPower,
  analogShotTarget,
  analyzeSwipe,
  axisDeadzone,
  chargePower,
  facesGoal,
  gestureUnit,
  OSC_PERIOD,
  oscillatingPower,
  radialDeadzone,
  shotTargetFromDir,
  slingshotSwipe,
  wheelCurl,
  type GesturePoint,
  type SwipeFeatures,
} from './kick'
import { clampN, dist, len, norm, sub, type Vec2 } from './model'
import type { AimState, HeroAction } from './runtime'
import { getBindings, isBound, type BindAction } from '../input/bindings'
import { getControlPrefs, TIMING_ASSIST_MULT } from '../input/prefs'
import { probeGesture } from './touchProbe'

/** Maps between canvas pixels and pitch meters. */
export interface InputMapper {
  /** Canvas (game) pixel → pitch ground point. */
  toWorld(gx: number, gy: number): Vec2
  /** Screen-space direction → pitch direction (unit). */
  screenDirToWorld(dx: number, dy: number): Vec2
  /** Canvas size in game pixels. */
  size(): { w: number; h: number }
  /** UI scale (device pixel ratio). */
  ui(): number
  /** Safe-area insets over the canvas (game pixels): touch buttons stay clear of the home indicator / cutouts. */
  insets?(): { top: number; right: number; bottom: number; left: number }
}

/** Context the controller needs each frame. */
/** Plan 2.1#24: stick dead zone is adjustable within 5–25 %. */
export const PAD_DEADZONE_MIN = 0.05
export const PAD_DEADZONE_MAX = 0.25
export const clampDeadzone = (v: number): number => clampN(Number.isFinite(v) ? v : 0.18, PAD_DEADZONE_MIN, PAD_DEADZONE_MAX)

/**
 * Trigger roles (standard gamepad: 6 = LT, 7 = RT). Analog power uses the right
 * trigger's pressure (plan 2.1#24), so sprint moves to the left trigger.
 */
export function padTriggers(padPower: 'hold' | 'oscillate' | 'analog'): { power: number; sprint: number } {
  return padPower === 'analog' ? { power: 7, sprint: 6 } : { power: -1, sprint: 7 }
}

/** Mouse sling-shot: the press must start within this many metres of the ball. */
export const MOUSE_SLING_GRAB = 3

export interface InputContext {
  heroPos: Vec2
  ballPos: Vec2
  heroOnBall: boolean
  heroIsKeeper: boolean
  /** Team-mate positions (meter scheme: a tap on a team-mate stays a pass). */
  mates?: readonly Vec2[]
  /** The hero cannot move (e.g. the finishing drill): the whole screen takes swipes, no joystick. */
  noMove?: boolean
}

/** Touch UI geometry for rendering. */
export interface TouchUi {
  enabled: boolean
  joystick: { baseX: number; baseY: number; knobX: number; knobY: number; r: number } | null
  sprint: { x: number; y: number; r: number; down: boolean }
  skill: { x: number; y: number; r: number; down: boolean }
}

/** Everything the scene needs from input for one frame. */
export interface FrameIntent {
  move: Vec2
  sprint: boolean
  actions: HeroAction[]
  /** Live aim (dragging / holding) for preview + power meter. */
  aim: AimState | null
  /** 0..1.15 power currently charged (PC/gamepad hold), or swipe power. */
  power: number
  /** A skip request (replay / banners). */
  skip: boolean
  /** Pause key pressed this frame (toggle). */
  pause: boolean
  /** Any user input this frame (for unlocking audio). */
  any: boolean
  /** The live power is an oscillating meter (draw it as such). */
  oscillating: boolean
  /** Extra curl dialled in with the mouse wheel (-1..1). */
  wheelCurl: number
}

interface TouchGesture {
  id: number
  pts: GesturePoint[]
  fingers: number
  start: number
  /** A still long-press off the ball already called for the ball (WP-14). */
  called?: boolean
}

/** A touch that began on an on-screen button: a tap/hold uses the button, a drag becomes a swipe. */
interface ButtonTouch {
  id: number
  kind: 'sprint' | 'skill'
  x: number
  y: number
  t: number
  pts: GesturePoint[]
}

const TAP_MAX_TIME = 0.28
/** A touch on a button that travels this far (gesture units) is a swipe, not a button press. */
export const BUTTON_DRAG_TO_SWIPE = 0.07
/** …and one released after travelling at least this far toward goal is a flick-shot. */
export const BUTTON_FLICK_MIN = 0.05
/**
 * Joystick-side flick on the ball (owner feedback: swipes starting left of the
 * swipe zone were swallowed by the joystick): a short-lived, long, fast flick
 * toward goal from the joystick thumb is a shot, not a dribble.
 */
export const JOY_FLICK = { maxLife: 0.6, minLength: 0.14, minSpeed: 0.6, maxDwell: 0.1 } as const
/** A finger that has moved less than this (gesture units) is resting, not swiping. */
const IDLE_FINGER = 0.025
/** A gesture with no sample for this long is a lost pointer (missed pointerup), not a live swipe. */
const STALE_GESTURE = 2.5
/** Seconds the released power stays on the ring after a shot. */
export const RELEASE_FLASH = 0.8
const DOUBLE_TAP_TIME = 0.32
const HOLD_SHOT_MIN = 0.16
/** Touch: a still press this long off the ball raises the hand and calls for a pass (WP-14). */
export const CALL_HOLD = 0.45
/** Tap-meter: an armed meter that is never fired is dropped after this long. */
const METER_TIMEOUT = 4

/** Oscillating meter power; timing assist slows the bar. */
function oscPower(t: number): number {
  return oscillatingPower(t, getControlPrefs().timingAssist ? OSC_PERIOD * TIMING_ASSIST_MULT : OSC_PERIOD)
}

/** Converts device input into a per-frame intent stream. Call {@link dispose} when done. */
export class InputController {
  private readonly canvas: HTMLCanvasElement
  private readonly map: InputMapper
  private readonly keys = new Set<string>()
  private readonly queued: HeroAction[] = []
  private joy: { id: number; bx: number; by: number; x: number; y: number; t0: number; pts: GesturePoint[] } | null = null
  private gesture: TouchGesture | null = null
  private button: ButtonTouch | null = null
  /** Power of the last released shot gesture and when (power meter feedback on release). */
  private release: { power: number; t: number } | null = null
  /** Other fingers down in the swipe zone (not the gesture's): a moving one makes a two-finger chip. */
  private readonly others = new Map<number, { x: number; y: number; moved: boolean }>()
  private sprintTouch: number | null = null
  private skillTouch: number | null = null
  private lastTap = { t: -1, x: 0, y: 0 }
  private mouse = { x: 0, y: 0, inside: false }
  private mouseHold: { t0: number; path: GesturePoint[] } | null = null
  private pad = { buttons: [] as boolean[], holdB: -1, lastSeen: 0 }
  private touchMode = false
  private skipFlag = false
  private pauseFlag = false
  private keyShoot: { t0: number } | null = null
  private oneTap: { id: number; t: number; x: number; y: number } | null = null
  /** Tap + oscillating meter scheme: armed toward `at` since `t0`. */
  private meter: { t0: number; at: Vec2 } | null = null
  /** Curl dialled in with the mouse wheel for the next shot. */
  private wheel = 0
  private anyFlag = false
  private readonly off: (() => void)[] = []

  constructor(canvas: HTMLCanvasElement, mapper: InputMapper) {
    this.canvas = canvas
    this.map = mapper
    this.touchMode = typeof window !== 'undefined' && (('ontouchstart' in window) || window.matchMedia?.('(pointer: coarse)').matches === true)
    canvas.style.touchAction = 'none'
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, ev: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(ev, fn as EventListener, opts)
      this.off.push(() => el.removeEventListener(ev, fn as EventListener, opts))
    }
    on(canvas, 'pointerdown', (e) => this.onDown(e))
    on(canvas, 'pointermove', (e) => this.onMove(e))
    on(canvas, 'pointerup', (e) => this.onUp(e))
    on(canvas, 'pointercancel', (e) => this.onUp(e, true))
    // A lost capture without a pointerup (rare WebView quirk) must not leave a stuck gesture behind.
    on(canvas, 'lostpointercapture', (e) => {
      if (this.gesture?.id === e.pointerId || this.joy?.id === e.pointerId || this.button?.id === e.pointerId) this.onUp(e, true)
    })
    on(canvas, 'pointerleave', () => (this.mouse.inside = false))
    on(canvas, 'contextmenu', (e) => e.preventDefault())
    on(
      canvas,
      'wheel',
      (e) => {
        e.preventDefault()
        this.anyFlag = true
        this.wheel = wheelCurl(this.wheel, (e as WheelEvent).deltaY)
      },
      { passive: false },
    )
    on(window, 'keydown', (e) => this.onKey(e as KeyboardEvent, true))
    on(window, 'keyup', (e) => this.onKey(e as KeyboardEvent, false))
    on(window, 'blur', () => {
      this.keys.clear()
      this.keyShoot = null
      this.oneTap = null
      this.joy = null
      this.gesture = null
      this.button = null
      this.sprintTouch = null
      this.skillTouch = null
      this.others.clear()
      this.mouseHold = null
      this.meter = null
    })
  }

  /** Removes all listeners. */
  dispose(): void {
    for (const f of this.off) f()
    this.off.length = 0
  }

  /** True once a touch has been used (show on-screen controls). */
  get isTouch(): boolean {
    return this.touchMode
  }

  // ───────────────────────── DOM handlers ─────────────────────────

  private toGame(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect()
    const { w, h } = this.map.size()
    return { x: ((e.clientX - r.left) / Math.max(1, r.width)) * w, y: ((e.clientY - r.top) / Math.max(1, r.height)) * h }
  }

  private now(): number {
    return performance.now() / 1000
  }

  /**
   * Event time (s). The event's own timestamp, not the handler time: on a busy
   * phone several touch moves are delivered in one batch, and stamping them
   * "now" collapsed their spacing and scrambled the swipe speed.
   */
  private stamp(e: PointerEvent): number {
    const now = performance.now()
    const ts = e.timeStamp
    return (ts > 0 && Math.abs(now - ts) < 1000 ? Math.min(ts, now) : now) / 1000
  }

  /** Gesture unit in canvas pixels (see {@link gestureUnit}). */
  private unit(): number {
    const { w, h } = this.map.size()
    return gestureUnit(w, h, this.map.ui())
  }

  /** Released-shot power still worth showing on the ring (fades over {@link RELEASE_FLASH}). */
  releaseFlash(): { power: number; alpha: number } | null {
    const r = this.release
    if (!r) return null
    const age = this.now() - r.t
    if (age > RELEASE_FLASH) return null
    return { power: r.power, alpha: 1 - age / RELEASE_FLASH }
  }

  private point(p: { x: number; y: number }, t: number): GesturePoint {
    const s = this.unit()
    const wp = this.map.toWorld(p.x, p.y)
    return { sx: p.x / s, sy: p.y / s, wx: wp.x, wy: wp.y, t }
  }

  /** Touch button layout (game pixels). */
  touchUi(): TouchUi {
    const { w, h } = this.map.size()
    const u = this.map.ui()
    const prefs = getControlPrefs()
    const r = (Math.min(w, h) * 0.075 + 6 * u) * prefs.touchScale
    const pad = r * 0.6
    const ins = this.map.insets?.()
    const side = ins ? Math.max(ins.left, ins.right) : 0
    const bottom = h - (ins?.bottom ?? 0)
    const m = (x: number) => (prefs.leftHanded ? w - x : x)
    const sprint = { x: m(w - side - pad - r), y: bottom - pad - r, r, down: this.sprintTouch !== null }
    const skill = { x: m(w - side - pad - r * 3.4), y: bottom - pad - r * 0.7, r: r * 0.8, down: this.skillTouch !== null }
    const joy = this.joy ? { baseX: this.joy.bx, baseY: this.joy.by, knobX: this.joy.x, knobY: this.joy.y, r: r * 1.25 } : null
    return { enabled: this.touchMode, joystick: joy, sprint, skill }
  }

  private hit(b: { x: number; y: number; r: number }, p: { x: number; y: number }): boolean {
    return Math.hypot(p.x - b.x, p.y - b.y) < b.r * 1.15
  }

  private onDown(e: PointerEvent): void {
    this.anyFlag = true
    const p = this.toGame(e)
    const t = this.stamp(e)
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      this.touchMode = true
      try {
        this.canvas.setPointerCapture(e.pointerId)
      } catch {
        /* pointer capture unsupported */
      }
      // A gesture whose pointer went silent long ago lost its pointerup: drop it so this touch can swipe.
      const g0 = this.gesture
      if (g0 && t - g0.pts[g0.pts.length - 1]!.t > STALE_GESTURE) this.gesture = null
      const ui = this.touchUi()
      const noMove = !!this.lastCtx?.noMove
      if (!noMove && !this.button && this.hit(ui.sprint, p)) {
        this.sprintTouch = e.pointerId
        this.button = { id: e.pointerId, kind: 'sprint', x: p.x, y: p.y, t, pts: [this.point(p, t)] }
        return
      }
      if (!noMove && !this.lastCtx?.heroIsKeeper && !this.button && this.hit(ui.skill, p)) {
        // The skill fires on release (a drag off the button is a swipe instead).
        this.skillTouch = e.pointerId
        this.button = { id: e.pointerId, kind: 'skill', x: p.x, y: p.y, t, pts: [this.point(p, t)] }
        return
      }
      const { w } = this.map.size()
      const prefs = getControlPrefs()
      if (prefs.oneHand && !noMove) {
        // One thumb: hold = joystick, quick tap = contextual pass / shot / tackle.
        if (!this.joy) {
          this.joy = { id: e.pointerId, bx: p.x, by: p.y, x: p.x, y: p.y, t0: t, pts: [this.point(p, t)] }
          this.oneTap = { id: e.pointerId, t, x: p.x, y: p.y }
        }
        return
      }
      const inJoyZone = !noMove && (prefs.leftHanded ? p.x > w * 0.58 : p.x < w * 0.42)
      if (inJoyZone && !this.joy) {
        this.joy = { id: e.pointerId, bx: p.x, by: p.y, x: p.x, y: p.y, t0: t, pts: [this.point(p, t)] }
        return
      }
      const g = this.gesture
      if (g && this.pathLength(g.pts) < IDLE_FINGER) {
        // The current gesture finger is only resting (a parked thumb): the new finger takes the swipe.
        const f = g.pts[0]!
        this.others.set(g.id, { x: f.sx, y: f.sy, moved: false })
        this.gesture = null
      }
      if (!this.gesture) this.gesture = { id: e.pointerId, pts: [this.point(p, t)], fingers: this.fingerCount(), start: t }
      else {
        const q = this.point(p, t)
        this.others.set(e.pointerId, { x: q.sx, y: q.sy, moved: false })
      }
      return
    }
    // Mouse.
    this.mouse = { x: p.x, y: p.y, inside: true }
    if (e.button === 2) {
      this.queued.push({ kind: 'pass', target: this.map.toWorld(p.x, p.y), through: true, lofted: this.chipMod() })
      return
    }
    if (e.button === 0) this.mouseHold = { t0: t, path: [this.point(p, t)] }
  }

  private onMove(e: PointerEvent): void {
    const p = this.toGame(e)
    const t = this.stamp(e)
    if (e.pointerType === 'mouse') {
      this.mouse = { x: p.x, y: p.y, inside: true }
      if (this.mouseHold) this.mouseHold.path.push(this.point(p, t))
      return
    }
    if (this.joy && this.joy.id === e.pointerId) {
      const ui = this.touchUi()
      const r = ui.joystick?.r ?? 60
      let dx = p.x - this.joy.bx
      let dy = p.y - this.joy.by
      const l = Math.hypot(dx, dy)
      // Dynamic joystick: the base follows the thumb if it drifts too far.
      if (l > r * 1.4) {
        this.joy.bx += (dx / l) * (l - r * 1.4)
        this.joy.by += (dy / l) * (l - r * 1.4)
        dx = p.x - this.joy.bx
        dy = p.y - this.joy.by
      }
      this.joy.x = p.x
      this.joy.y = p.y
      this.sample(this.joy.pts, e, p, t)
      return
    }
    const b = this.button
    if (b && b.id === e.pointerId) {
      this.sample(b.pts, e, p, t)
      // Dragged off the button: it is a swipe (the thumb started on SPRINT/SKILL on its way to goal).
      if (!this.gesture && Math.hypot(p.x - b.x, p.y - b.y) / this.unit() > BUTTON_DRAG_TO_SWIPE) {
        if (this.sprintTouch === b.id) this.sprintTouch = null
        if (this.skillTouch === b.id) this.skillTouch = null
        this.button = null
        this.gesture = { id: b.id, pts: b.pts, fingers: this.fingerCount(), start: b.t }
      }
      return
    }
    const o = this.others.get(e.pointerId)
    if (o && !o.moved) {
      const q = this.point(p, t)
      if (Math.hypot(q.sx - o.x, q.sy - o.y) > IDLE_FINGER) o.moved = true
    }
    if (this.gesture) {
      const g = this.gesture
      if (g.id === e.pointerId) this.sample(g.pts, e, p, t)
      g.fingers = Math.max(g.fingers, this.fingerCount())
    }
  }

  /** Fingers taking part in the swipe: the gesture's own plus every other one that moves. */
  private fingerCount(): number {
    let n = 1
    for (const o of this.others.values()) if (o.moved) n++
    return n
  }

  private pathLength(pts: readonly GesturePoint[]): number {
    const a = pts[0]
    let m = 0
    if (a) for (const q of pts) m = Math.max(m, Math.hypot(q.sx - a.sx, q.sy - a.sy))
    return m
  }

  /** The browser's coalesced samples of a move (oldest first, the event itself last), if any. */
  private coalesced(e: PointerEvent): PointerEvent[] {
    try {
      return typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : []
    } catch {
      return []
    }
  }

  /** Appends a move (and the browser's coalesced in-between samples) to a path. */
  private sample(pts: GesturePoint[], e: PointerEvent, p: { x: number; y: number }, t: number): void {
    const s = this.unit()
    const push = (q: { x: number; y: number }, tq: number) => {
      const last = pts[pts.length - 1]
      if (!last || (tq >= last.t && Math.hypot(q.x / s - last.sx, q.y / s - last.sy) > 0.002)) pts.push(this.point(q, tq))
    }
    for (const c of this.coalesced(e).slice(0, -1)) push(this.toGame(c), this.stamp(c))
    push(p, t)
  }

  private onUp(e: PointerEvent, cancel = false): void {
    const p = this.toGame(e)
    const t = this.stamp(e)
    if (e.pointerType === 'mouse') {
      if (e.button === 0 && this.mouseHold && !cancel) this.releaseMouse(p, t)
      this.mouseHold = null
      return
    }
    const ignored = { power: 0, length: 0, speed: 0, duration: 0 }
    const b = this.button
    if (b && b.id === e.pointerId) {
      this.button = null
      // A short sharp flick off the button toward goal (with the ball) is a shot, not a button press.
      if (!cancel) this.sample(b.pts, e, p, t)
      const ctx = this.lastCtx
      const sw = !cancel && ctx?.heroOnBall && !ctx.heroIsKeeper ? analyzeSwipe(b.pts, 1) : null
      if (sw && !sw.isTap && sw.length >= BUTTON_FLICK_MIN && t - b.t <= 0.25 && facesGoal(ctx!.ballPos, sw.dir)) {
        this.queueSwipe(sw)
        probeGesture({ outcome: 'swipe', power: sw.power, length: sw.length, speed: sw.speed, duration: sw.duration })
      } else {
        if (b.kind === 'skill' && !cancel) this.queued.push({ kind: 'skill' })
        probeGesture({ outcome: 'button', ...ignored })
      }
    }
    if (this.sprintTouch === e.pointerId) this.sprintTouch = null
    if (this.skillTouch === e.pointerId) this.skillTouch = null
    const joy = this.joy
    if (joy && joy.id === e.pointerId) {
      this.joy = null
      if (!this.oneTap && !cancel) {
        this.sample(joy.pts, e, p, t)
        const sw = this.joyFlick(joy.pts, t - joy.t0, t)
        if (sw) {
          this.queueSwipe(sw)
          probeGesture({ outcome: 'swipe', power: sw.power, length: sw.length, speed: sw.speed, duration: sw.duration })
        } else probeGesture({ outcome: 'joystick', ...ignored })
      }
    }
    if (this.oneTap && this.oneTap.id === e.pointerId) {
      const ot = this.oneTap
      this.oneTap = null
      const { w, h } = this.map.size()
      const still = Math.hypot(p.x - ot.x, p.y - ot.y) < Math.min(w, h) * 0.04
      if (!cancel && still && t - ot.t < TAP_MAX_TIME) {
        if (this.meterTap(p, t)) {
          // Meter scheme consumed the tap (armed or fired).
        } else if (t - this.lastTap.t < DOUBLE_TAP_TIME) {
          this.queued.push({ kind: 'skill' })
          this.lastTap.t = -1
        } else {
          this.queued.push({ kind: 'tapAt', at: this.map.toWorld(p.x, p.y) })
          this.lastTap = { t, x: p.x, y: p.y }
        }
        this.skipFlag = true
      }
    }
    this.others.delete(e.pointerId)
    const g = this.gesture
    if (g && g.id === e.pointerId) {
      this.gesture = null
      if (g.called) return
      if (cancel) {
        // Cancelled mid-swipe (system gesture, lost capture): a real swipe still counts,
        // from its last sample, since a cancel event carries no reliable position.
        const sw = this.swipeOf(g)
        if (!sw.isTap) {
          this.queueSwipe(sw)
          probeGesture({ outcome: 'swipe', power: sw.power, length: sw.length, speed: sw.speed, duration: sw.duration })
        } else probeGesture({ outcome: 'cancel', ...ignored })
        return
      }
      this.sample(g.pts, e, p, t)
      const sw = this.swipeOf(g)
      const dur = t - g.start
      if (sw.isTap && dur < TAP_MAX_TIME) {
        const at = this.map.toWorld(p.x, p.y)
        const { w, h } = this.map.size()
        const near = Math.hypot(p.x - this.lastTap.x, p.y - this.lastTap.y) < Math.min(w, h) * 0.08
        if (this.meterTap(p, t)) {
          // Meter scheme consumed the tap (armed or fired).
        } else if (t - this.lastTap.t < DOUBLE_TAP_TIME && near) {
          this.queued.push({ kind: 'skill' })
          this.lastTap.t = -1
        } else {
          this.queued.push({ kind: 'tapAt', at })
          this.lastTap = { t, x: p.x, y: p.y }
        }
        this.skipFlag = true
        probeGesture({ outcome: 'tap', power: 0, length: sw.length, speed: sw.speed, duration: dur })
      } else if (!sw.isTap) {
        this.queueSwipe(sw)
        probeGesture({ outcome: 'swipe', power: sw.power, length: sw.length, speed: sw.speed, duration: dur })
      } else probeGesture({ outcome: 'ignored', power: 0, length: sw.length, speed: sw.speed, duration: dur })
    }
  }

  /** Queues a swipe and remembers its power for the release flash on the ring. */
  private queueSwipe(sw: SwipeFeatures): void {
    this.queued.push({ kind: 'swipe', swipe: sw })
    if (this.lastCtx?.heroOnBall) this.release = { power: sw.power, t: this.now() }
  }

  /**
   * A joystick-side touch that was really a shot: short-lived, long and fast,
   * toward goal, with the hero on the ball (see {@link JOY_FLICK}).
   */
  private joyFlick(pts: GesturePoint[], life: number, released: number): SwipeFeatures | null {
    const ctx = this.lastCtx
    if (!ctx || !ctx.heroOnBall || ctx.heroIsKeeper || life > JOY_FLICK.maxLife || pts.length < 2) return null
    const sw = analyzeSwipe(pts, 1)
    if (sw.isTap || sw.length < JOY_FLICK.minLength || sw.speed < JOY_FLICK.minSpeed) return null
    // A swipe lifts off as it ends; a joystick push holds its position before letting go.
    const end = pts[pts.length - 1]!
    const still = pts.find((q) => Math.hypot(q.sx - end.sx, q.sy - end.sy) < 0.012) ?? end
    if (Math.max(end.t, released) - still.t > JOY_FLICK.maxDwell) return null
    return facesGoal(ctx.ballPos, sw.dir) ? sw : null
  }

  /** Swipe features under the active touch scheme (sling-shot reverses the drag). */
  private swipeOf(g: TouchGesture): SwipeFeatures {
    const sw = analyzeSwipe(g.pts, g.fingers)
    return getControlPrefs().touchShot === 'slingshot' && this.lastCtx?.heroOnBall ? slingshotSwipe(sw, g.fingers) : sw
  }

  /**
   * Tap + oscillating meter scheme. First tap toward goal (not on a team-mate)
   * arms the meter; the next tap fires with the meter's current power.
   * @returns true when the tap was consumed
   */
  private meterTap(p: { x: number; y: number }, t: number): boolean {
    const ctx = this.lastCtx
    if (getControlPrefs().touchShot !== 'meter' || !ctx || !ctx.heroOnBall || ctx.heroIsKeeper) {
      this.meter = null
      return false
    }
    if (this.meter) {
      const m = this.meter
      this.meter = null
      this.queued.push(this.holdShotAction(m.at, oscPower(t - m.t0), null))
      this.lastTap.t = -1
      return true
    }
    const at = this.map.toWorld(p.x, p.y)
    const onMate = (ctx.mates ?? []).some((m) => dist(m, at) < 3.2)
    if (onMate || !facesGoal(ctx.ballPos, norm(sub(at, ctx.ballPos)))) return false
    this.meter = { t0: t, at }
    return true
  }

  /** Power for a hold of `held` seconds under a power scheme. */
  private schemePower(held: number, scheme: 'hold' | 'oscillate'): number {
    return scheme === 'oscillate' ? oscPower(held) : chargePower(held)
  }

  private chipMod(): boolean {
    return this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.keys.has(getBindings().chip)
  }

  private releaseMouse(p: { x: number; y: number }, t: number): void {
    const hold = this.mouseHold!
    const held = t - hold.t0
    const at = this.map.toWorld(p.x, p.y)
    this.skipFlag = true
    // Mouse sling-shot (2.1#23): press on the ball, drag back, release — same scheme as touch.
    const ctx = this.lastCtx
    if (getControlPrefs().touchShot === 'slingshot' && ctx?.heroOnBall && !ctx.heroIsKeeper && hold.path.length >= 2) {
      const p0 = hold.path[0]!
      if (dist({ x: p0.wx, y: p0.wy }, ctx.ballPos) < MOUSE_SLING_GRAB) {
        const sw = slingshotSwipe(analyzeSwipe(hold.path), this.chipMod() ? 2 : 1)
        if (!sw.isTap) {
          this.queued.push({ kind: 'swipe', swipe: { ...sw, curl: clampN(sw.curl + this.wheel, -1, 1) } })
          this.wheel = 0
          return
        }
      }
    }
    if (held < HOLD_SHOT_MIN) {
      // Click: pass to a clicked team-mate / contextual tap.
      this.queued.push({ kind: 'tapAt', at })
      return
    }
    const power = this.schemePower(held, getControlPrefs().pcPower)
    this.queued.push(this.holdShotAction(at, power, hold.path))
    this.wheel = 0
  }

  /** Hold-release toward a point: shot if toward goal, else lofted/driven pass. */
  private holdShotAction(at: Vec2, power: number, path: GesturePoint[] | null): HeroAction {
    const ctx = this.lastCtx
    const from = ctx ? ctx.ballPos : at
    const dir = norm(sub(at, from))
    const curl = clampN((path && path.length > 3 ? analyzeSwipe(path).curl * 0.8 : 0) + this.wheel, -1, 1)
    if (ctx?.heroIsKeeper) return { kind: 'dive', dir: len(dir) > 0 ? dir : { x: 0, y: 1 } }
    if (!ctx || !ctx.heroOnBall || facesGoal(from, dir)) {
      const target = at.x > 99 ? { x: 105, y: at.y } : shotTargetFromDir(from, dir)
      return { kind: 'shoot', target, power, curl, chip: this.chipMod() }
    }
    return { kind: 'pass', target: at, lofted: power > 0.6 || this.chipMod() }
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const tgt = e.target as HTMLElement | null
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return
    const code = e.code
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) e.preventDefault()
    if (down) {
      this.anyFlag = true
      if (!this.keys.has(code)) {
        const act = isBound(code, 'skill') ? 'skill' : isBound(code, 'action') ? 'action' : isBound(code, 'pass') ? 'pass' : isBound(code, 'through') ? 'through' : isBound(code, 'shoot') ? 'shoot' : isBound(code, 'call') ? 'call' : isBound(code, 'pause') ? 'pause' : null
        if (act === 'call') this.queued.push({ kind: 'call' })
        else if (act === 'skill') this.queued.push(this.lastCtx?.heroOnBall ? { kind: 'skill' } : { kind: 'action' })
        else if (act === 'action') this.queued.push({ kind: 'action' })
        else if (act === 'pass' || act === 'through') {
          this.queued.push({ kind: 'pass', target: this.map.toWorld(this.mouse.x, this.mouse.y), through: act === 'through', lofted: this.chipMod() })
        } else if (act === 'shoot') this.keyShoot = { t0: this.now() }
        else if (act === 'pause') this.pauseFlag = true
        if (code === 'Enter' || code === 'Escape') this.skipFlag = true
      }
      this.keys.add(code)
    } else {
      this.keys.delete(code)
      if (this.keyShoot && isBound(code, 'shoot')) {
        const held = this.now() - this.keyShoot.t0
        this.keyShoot = null
        const scheme = getControlPrefs().pcPower
        const power = scheme === 'oscillate' ? oscPower(held) : Math.max(0.35, chargePower(held))
        this.queued.push(this.holdShotAction(this.map.toWorld(this.mouse.x, this.mouse.y), power, null))
        this.wheel = 0
        this.skipFlag = true
      }
    }
  }

  // ───────────────────────── Polling ─────────────────────────

  private lastCtx: InputContext | null = null

  /**
   * Collects the intent for this frame.
   * @param ctx hero/ball context (for aim interpretation)
   */
  poll(ctx: InputContext): FrameIntent {
    this.lastCtx = ctx
    const t = this.now()
    let move = { x: 0, y: 0 }
    let sprint = false
    let aim: AimState | null = null
    let power = 0
    let oscillating = false
    const prefs = getControlPrefs()

    // Keyboard.
    const k = this.keys
    const bd = getBindings()
    const down = (a: BindAction, arrow: string) => k.has(bd[a]) || (k.has(arrow) && isBound(arrow, a, bd))
    const kx = (down('right', 'ArrowRight') ? 1 : 0) - (down('left', 'ArrowLeft') ? 1 : 0)
    const ky = (down('down', 'ArrowDown') ? 1 : 0) - (down('up', 'ArrowUp') ? 1 : 0)
    if (kx || ky) move = this.map.screenDirToWorld(kx, ky)
    if (k.has(bd.sprint) || (bd.sprint === 'ShiftLeft' && k.has('ShiftRight'))) sprint = true

    // Touch joystick.
    if (this.joy) {
      const r = this.touchUi().joystick?.r ?? 60
      const dx = this.joy.x - this.joy.bx
      const dy = this.joy.y - this.joy.by
      const l = Math.hypot(dx, dy)
      if (l > r * 0.12) {
        const mag = Math.min(1, (l - r * 0.12) / (r * 0.75))
        const d = this.map.screenDirToWorld(dx, dy)
        move = { x: d.x * mag, y: d.y * mag }
        // Pushing to the rim sprints automatically.
        if (l > r * 1.15) sprint = true
      }
    }
    if (this.sprintTouch !== null) sprint = true

    // Touch long-press off the ball: raise the hand and call for it.
    const lg = this.gesture
    if (lg && !lg.called && !ctx.heroOnBall && !ctx.heroIsKeeper && t - lg.start >= CALL_HOLD && this.swipeOf(lg).isTap) {
      lg.called = true
      this.queued.push({ kind: 'call' })
    }

    // Touch aim (live swipe).
    if (this.gesture && this.gesture.pts.length > 2) {
      const sw: SwipeFeatures = this.swipeOf(this.gesture)
      if (!sw.isTap) {
        aim = { kind: 'swipe', swipe: sw }
        power = sw.power
      }
    }

    // Tap meter (touch): oscillates until the second tap.
    if (this.meter) {
      if (!ctx.heroOnBall || t - this.meter.t0 > METER_TIMEOUT || prefs.touchShot !== 'meter') this.meter = null
      else {
        power = oscPower(t - this.meter.t0)
        oscillating = true
        const act = this.holdShotAction(this.meter.at, power, null)
        if (act.kind === 'shoot') aim = { kind: 'target', target: act.target, power, curl: act.curl, chip: act.chip }
      }
    }

    // Mouse hold aim.
    if (this.mouseHold) {
      const held = t - this.mouseHold.t0
      if (held >= HOLD_SHOT_MIN) {
        power = this.schemePower(held, prefs.pcPower)
        oscillating = prefs.pcPower === 'oscillate'
        const at = this.map.toWorld(this.mouse.x, this.mouse.y)
        const act = this.holdShotAction(at, power, this.mouseHold.path)
        if (act.kind === 'shoot') aim = { kind: 'target', target: act.target, power, curl: act.curl, chip: act.chip }
      }
    }

    if (this.keyShoot) {
      const held = t - this.keyShoot.t0
      power = this.schemePower(held, prefs.pcPower)
      oscillating = prefs.pcPower === 'oscillate'
      const act = this.holdShotAction(this.map.toWorld(this.mouse.x, this.mouse.y), power, null)
      if (act.kind === 'shoot') aim = { kind: 'target', target: act.target, power, curl: act.curl, chip: act.chip }
    }

    // Gamepad.
    const padRes = this.pollPad(ctx, t)
    if (padRes) {
      if (len(padRes.move) > 0.01) move = padRes.move
      sprint = sprint || padRes.sprint
      if (padRes.aim) {
        aim = padRes.aim
        power = padRes.power
        oscillating = prefs.padPower === 'oscillate'
      }
    }

    const actions = this.queued.splice(0, this.queued.length)
    const skip = this.skipFlag
    this.skipFlag = false
    const pause = this.pauseFlag
    this.pauseFlag = false
    const any = this.anyFlag
    this.anyFlag = false
    return { move, sprint, actions, aim, power, skip, pause, any, oscillating, wheelCurl: this.wheel }
  }

  private pollPad(ctx: InputContext, t: number): { move: Vec2; sprint: boolean; aim: AimState | null; power: number } | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null
    const pads = navigator.getGamepads()
    const gp = Array.from(pads).find((p) => p && p.connected)
    if (!gp) return null
    const b = (i: number) => !!gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.4)
    const prev = this.pad.buttons
    const pressed = (i: number) => b(i) && !prev[i]
    const released = (i: number) => !b(i) && !!prev[i]
    const prefs = getControlPrefs()
    const dz = clampDeadzone(prefs.padDeadzone)
    const trig = padTriggers(prefs.padPower)
    const ls = radialDeadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0, dz)
    const mag = ls.mag
    const dead = mag <= 0
    const move = dead ? { x: 0, y: 0 } : this.map.screenDirToWorld(ls.x, ls.y)
    const mv = { x: move.x * mag, y: move.y * mag }
    const stickDir = dead ? null : norm(move)
    const chip = b(4)
    const curl = -axisDeadzone(gp.axes[2] ?? 0, dz) * 0.8
    const padPower = (): number => {
      const held = t - this.pad.holdB
      if (prefs.padPower === 'analog') return analogPower(gp.buttons[trig.power]?.value ?? 0)
      return prefs.padPower === 'oscillate' ? oscPower(held) : chargePower(held)
    }
    let aim: AimState | null = null
    let power = 0
    if (b(0) || b(1) || b(2) || b(3) || mag > 0) this.anyFlag = true

    if (pressed(0)) {
      if (ctx.heroOnBall) this.queued.push({ kind: 'pass', dir: stickDir ?? undefined, lofted: chip })
      else if (ctx.heroIsKeeper) this.queued.push(stickDir ? { kind: 'dive', dir: stickDir } : { kind: 'action' })
      else this.queued.push({ kind: 'action' })
      this.skipFlag = true
    }
    if (pressed(3) && ctx.heroOnBall) this.queued.push({ kind: 'pass', dir: stickDir ?? undefined, through: true, lofted: chip })
    // Y off the ball: call for it.
    else if (pressed(3) && !ctx.heroIsKeeper) this.queued.push({ kind: 'call' })
    if (pressed(2) && ctx.heroOnBall) this.queued.push({ kind: 'pass', dir: stickDir ?? undefined, lofted: true })
    if (pressed(5)) this.queued.push(ctx.heroOnBall ? { kind: 'skill' } : { kind: 'action' })
    if (pressed(1)) this.pad.holdB = t
    const shotTarget = () => {
      if (prefs.padPower === 'analog') return analogShotTarget(mv.y)
      const dir = stickDir && stickDir.x > 0.1 ? stickDir : norm(sub({ x: 105, y: 34 }, ctx.ballPos))
      return shotTargetFromDir(ctx.ballPos, dir)
    }
    if (b(1) && this.pad.holdB >= 0) {
      power = padPower()
      if (ctx.heroOnBall) aim = { kind: 'target', target: shotTarget(), power, curl, chip }
    }
    if (released(1) && this.pad.holdB >= 0) {
      power = padPower()
      if (ctx.heroOnBall) this.queued.push({ kind: 'shoot', target: shotTarget(), power, curl, chip })
      else if (ctx.heroIsKeeper) this.queued.push(stickDir ? { kind: 'dive', dir: stickDir } : { kind: 'action' })
      else this.queued.push({ kind: 'action' })
      this.pad.holdB = -1
      this.skipFlag = true
    }
    this.pad.buttons = gp.buttons.map((_, i) => b(i))
    this.pad.lastSeen = t
    return { move: mv, sprint: b(trig.sprint), aim, power }
  }

  /** Vibrate (mobile / gamepad) if supported. */
  rumble(ms: number, strength = 0.6): void {
    try {
      if (this.touchMode && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms)
      const gp = typeof navigator !== 'undefined' && navigator.getGamepads ? Array.from(navigator.getGamepads()).find((p) => p && p.connected) : null
      const act = (gp as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, o: object) => Promise<unknown> } }) | null | undefined)?.vibrationActuator
      act?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 })?.catch(() => undefined)
    } catch {
      /* haptics are best effort */
    }
  }
}
