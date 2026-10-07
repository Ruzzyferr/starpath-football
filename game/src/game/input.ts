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
 *   Y through ball, X cross/lofted, RT sprint, RB skill, LB chip.
 *
 * Coordinates: raw events are in canvas (game) pixels; a {@link InputMapper}
 * supplied by the scene maps them to pitch meters.
 */
import { analyzeSwipe, facesGoal, shotTargetFromDir, type GesturePoint, type SwipeFeatures } from './kick'
import { len, norm, sub, type Vec2 } from './model'
import type { AimState, HeroAction } from './runtime'

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
}

/** Context the controller needs each frame. */
export interface InputContext {
  heroPos: Vec2
  ballPos: Vec2
  heroOnBall: boolean
  heroIsKeeper: boolean
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
  /** Any user input this frame (for unlocking audio). */
  any: boolean
}

interface TouchGesture {
  id: number
  pts: GesturePoint[]
  fingers: number
  start: number
}

const TAP_MAX_TIME = 0.28
const DOUBLE_TAP_TIME = 0.32
const HOLD_SHOT_MIN = 0.16
const CHARGE_TIME = 0.95

/** Converts device input into a per-frame intent stream. Call {@link dispose} when done. */
export class InputController {
  private readonly canvas: HTMLCanvasElement
  private readonly map: InputMapper
  private readonly keys = new Set<string>()
  private readonly queued: HeroAction[] = []
  private joy: { id: number; bx: number; by: number; x: number; y: number } | null = null
  private gesture: TouchGesture | null = null
  private readonly rightTouches = new Set<number>()
  private sprintTouch: number | null = null
  private skillTouch: number | null = null
  private lastTap = { t: -1, x: 0, y: 0 }
  private mouse = { x: 0, y: 0, inside: false }
  private mouseHold: { t0: number; path: GesturePoint[] } | null = null
  private pad = { buttons: [] as boolean[], holdB: -1, lastSeen: 0 }
  private touchMode = false
  private skipFlag = false
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
    on(canvas, 'pointerleave', () => (this.mouse.inside = false))
    on(canvas, 'contextmenu', (e) => e.preventDefault())
    on(window, 'keydown', (e) => this.onKey(e as KeyboardEvent, true))
    on(window, 'keyup', (e) => this.onKey(e as KeyboardEvent, false))
    on(window, 'blur', () => {
      this.keys.clear()
      this.joy = null
      this.gesture = null
      this.mouseHold = null
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

  private point(p: { x: number; y: number }, t: number): GesturePoint {
    const { w, h } = this.map.size()
    const s = Math.min(w, h)
    const wp = this.map.toWorld(p.x, p.y)
    return { sx: p.x / s, sy: p.y / s, wx: wp.x, wy: wp.y, t }
  }

  /** Touch button layout (game pixels). */
  touchUi(): TouchUi {
    const { w, h } = this.map.size()
    const u = this.map.ui()
    const r = Math.min(w, h) * 0.075 + 6 * u
    const pad = r * 0.6
    const sprint = { x: w - pad - r, y: h - pad - r, r, down: this.sprintTouch !== null }
    const skill = { x: w - pad - r * 3.4, y: h - pad - r * 0.7, r: r * 0.8, down: this.skillTouch !== null }
    const joy = this.joy ? { baseX: this.joy.bx, baseY: this.joy.by, knobX: this.joy.x, knobY: this.joy.y, r: r * 1.25 } : null
    return { enabled: this.touchMode, joystick: joy, sprint, skill }
  }

  private hit(b: { x: number; y: number; r: number }, p: { x: number; y: number }): boolean {
    return Math.hypot(p.x - b.x, p.y - b.y) < b.r * 1.15
  }

  private onDown(e: PointerEvent): void {
    this.anyFlag = true
    const p = this.toGame(e)
    const t = this.now()
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      this.touchMode = true
      try {
        this.canvas.setPointerCapture(e.pointerId)
      } catch {
        /* pointer capture unsupported */
      }
      const ui = this.touchUi()
      if (this.hit(ui.sprint, p)) {
        this.sprintTouch = e.pointerId
        return
      }
      if (this.hit(ui.skill, p)) {
        this.skillTouch = e.pointerId
        this.queued.push({ kind: 'skill' })
        return
      }
      const { w } = this.map.size()
      if (p.x < w * 0.42 && !this.joy) {
        this.joy = { id: e.pointerId, bx: p.x, by: p.y, x: p.x, y: p.y }
        return
      }
      this.rightTouches.add(e.pointerId)
      if (!this.gesture) this.gesture = { id: e.pointerId, pts: [this.point(p, t)], fingers: 1, start: t }
      else this.gesture.fingers = Math.max(this.gesture.fingers, this.rightTouches.size)
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
    const t = this.now()
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
      return
    }
    if (this.gesture && this.gesture.id === e.pointerId) {
      const g = this.gesture
      const last = g.pts[g.pts.length - 1]
      const { w, h } = this.map.size()
      const s = Math.min(w, h)
      if (Math.hypot(p.x / s - last.sx, p.y / s - last.sy) > 0.002) g.pts.push(this.point(p, t))
      g.fingers = Math.max(g.fingers, this.rightTouches.size)
    }
  }

  private onUp(e: PointerEvent, cancel = false): void {
    const p = this.toGame(e)
    const t = this.now()
    if (e.pointerType === 'mouse') {
      if (e.button === 0 && this.mouseHold && !cancel) this.releaseMouse(p, t)
      this.mouseHold = null
      return
    }
    if (this.sprintTouch === e.pointerId) this.sprintTouch = null
    if (this.skillTouch === e.pointerId) this.skillTouch = null
    if (this.joy && this.joy.id === e.pointerId) this.joy = null
    this.rightTouches.delete(e.pointerId)
    const g = this.gesture
    if (g && g.id === e.pointerId) {
      this.gesture = null
      if (cancel) return
      g.pts.push(this.point(p, t))
      const sw = analyzeSwipe(g.pts, g.fingers)
      const dur = t - g.start
      if (sw.isTap && dur < TAP_MAX_TIME) {
        const at = this.map.toWorld(p.x, p.y)
        const { w, h } = this.map.size()
        const near = Math.hypot(p.x - this.lastTap.x, p.y - this.lastTap.y) < Math.min(w, h) * 0.08
        if (t - this.lastTap.t < DOUBLE_TAP_TIME && near) {
          this.queued.push({ kind: 'skill' })
          this.lastTap.t = -1
        } else {
          this.queued.push({ kind: 'tapAt', at })
          this.lastTap = { t, x: p.x, y: p.y }
        }
        this.skipFlag = true
      } else if (!sw.isTap) {
        this.queued.push({ kind: 'swipe', swipe: sw })
      }
    }
  }

  private chipMod(): boolean {
    return this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.keys.has('KeyE')
  }

  private releaseMouse(p: { x: number; y: number }, t: number): void {
    const hold = this.mouseHold!
    const held = t - hold.t0
    const at = this.map.toWorld(p.x, p.y)
    this.skipFlag = true
    if (held < HOLD_SHOT_MIN) {
      // Click: pass to a clicked team-mate / contextual tap.
      this.queued.push({ kind: 'tapAt', at })
      return
    }
    const power = Math.min(1.15, held / CHARGE_TIME)
    this.queued.push(this.holdShotAction(at, power, hold.path))
  }

  /** Hold-release toward a point: shot if toward goal, else lofted/driven pass. */
  private holdShotAction(at: Vec2, power: number, path: GesturePoint[] | null): HeroAction {
    const ctx = this.lastCtx
    const from = ctx ? ctx.ballPos : at
    const dir = norm(sub(at, from))
    const curl = path && path.length > 3 ? analyzeSwipe(path).curl * 0.8 : 0
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
        if (code === 'Space') this.queued.push(this.lastCtx?.heroOnBall ? { kind: 'skill' } : { kind: 'action' })
        if (code === 'Enter' || code === 'Escape') this.skipFlag = true
        if (code === 'KeyF') this.queued.push({ kind: 'action' })
      }
      this.keys.add(code)
    } else {
      this.keys.delete(code)
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

    // Keyboard.
    const k = this.keys
    const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0)
    const ky = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0)
    if (kx || ky) move = this.map.screenDirToWorld(kx, ky)
    if (k.has('ShiftLeft') || k.has('ShiftRight')) sprint = true

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

    // Touch aim (live swipe).
    if (this.gesture && this.gesture.pts.length > 2) {
      const sw: SwipeFeatures = analyzeSwipe(this.gesture.pts, this.gesture.fingers)
      if (!sw.isTap) {
        aim = { kind: 'swipe', swipe: sw }
        power = sw.power
      }
    }

    // Mouse hold aim.
    if (this.mouseHold) {
      const held = t - this.mouseHold.t0
      if (held >= HOLD_SHOT_MIN) {
        power = Math.min(1.15, held / CHARGE_TIME)
        const at = this.map.toWorld(this.mouse.x, this.mouse.y)
        const act = this.holdShotAction(at, power, this.mouseHold.path)
        if (act.kind === 'shoot') aim = { kind: 'target', target: act.target, power, curl: act.curl, chip: act.chip }
      }
    }

    // Gamepad.
    const padRes = this.pollPad(ctx, t)
    if (padRes) {
      if (len(padRes.move) > 0.01) move = padRes.move
      sprint = sprint || padRes.sprint
      if (padRes.aim) {
        aim = padRes.aim
        power = padRes.power
      }
    }

    const actions = this.queued.splice(0, this.queued.length)
    const skip = this.skipFlag
    this.skipFlag = false
    const any = this.anyFlag
    this.anyFlag = false
    return { move, sprint, actions, aim, power, skip, any }
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
    const ax = gp.axes[0] ?? 0
    const ay = gp.axes[1] ?? 0
    const dead = Math.hypot(ax, ay) < 0.18
    const move = dead ? { x: 0, y: 0 } : this.map.screenDirToWorld(ax, ay)
    const mag = dead ? 0 : Math.min(1, (Math.hypot(ax, ay) - 0.18) / 0.75)
    const mv = { x: move.x * mag, y: move.y * mag }
    const stickDir = dead ? null : norm(move)
    const chip = b(4)
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
    if (pressed(2) && ctx.heroOnBall) this.queued.push({ kind: 'pass', dir: stickDir ?? undefined, lofted: true })
    if (pressed(5)) this.queued.push(ctx.heroOnBall ? { kind: 'skill' } : { kind: 'action' })
    if (pressed(1)) this.pad.holdB = t
    const shotTarget = () => {
      const dir = stickDir && stickDir.x > 0.1 ? stickDir : norm(sub({ x: 105, y: 34 }, ctx.ballPos))
      return shotTargetFromDir(ctx.ballPos, dir)
    }
    if (b(1) && this.pad.holdB >= 0) {
      power = Math.min(1.15, (t - this.pad.holdB) / CHARGE_TIME)
      if (ctx.heroOnBall) aim = { kind: 'target', target: shotTarget(), power, curl: -(gp.axes[2] ?? 0) * 0.8, chip }
    }
    if (released(1) && this.pad.holdB >= 0) {
      power = Math.min(1.15, (t - this.pad.holdB) / CHARGE_TIME)
      if (ctx.heroOnBall) this.queued.push({ kind: 'shoot', target: shotTarget(), power, curl: -(gp.axes[2] ?? 0) * 0.8, chip })
      else if (ctx.heroIsKeeper) this.queued.push(stickDir ? { kind: 'dive', dir: stickDir } : { kind: 'action' })
      else this.queued.push({ kind: 'action' })
      this.pad.holdB = -1
      this.skipFlag = true
    }
    this.pad.buttons = gp.buttons.map((_, i) => b(i))
    this.pad.lastSeen = t
    return { move: mv, sprint: b(7), aim, power }
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
