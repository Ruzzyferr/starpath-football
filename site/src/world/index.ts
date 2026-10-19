/**
 * The site's world: one night scene (sky, stadium, tunnel, dressing room, city) and one camera that
 * travels through it as the page scrolls (see path.ts). Hosts the playable penalty.
 */
import {
  ACESFilmicToneMapping,
  CircleGeometry,
  Color,
  DirectionalLight,
  TorusGeometry,
  FogExp2,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { BALL_R, GOAL_H, SPOT_Z, type ShotResult } from '../penalty'
import { buildCity, type City } from './city'
import { buildPlayer, HERO_KIT, KEEPER_KIT, KICK_CONTACT_U, poseKeeperDive, poseKeeperReady, poseShooterIdle, poseShooterKick, type Rig } from './figures'
import { sample, STOPS } from './path'
import { Post, type Tier } from './post'
import { buildRooms } from './rooms'
import { buildSky, type Sky } from './sky'
import { Streak } from './streak'
import { buildStadium, type Stadium } from './stadium'
import { canvasTexture } from './textures'

export interface WorldOptions {
  lowPower: boolean
  reducedMotion: boolean
}

/** Seconds from the start of the run-up to the foot meeting the ball. */
export const KICK_RUN = 0.62
export const KICK_DELAY = KICK_RUN * KICK_CONTACT_U

export interface Anchor {
  top: number
  height: number
}

const STRIKER_START = new Vector3(-1.7, 0, SPOT_Z + 2.7)
const STRIKER_YAW = Math.atan2(-1.7, 2.7)

function ballTexture() {
  return canvasTexture(256, 128, (g) => {
    g.fillStyle = '#f2f5fa'
    g.fillRect(0, 0, 256, 128)
    g.fillStyle = '#0b1220'
    const pent = (cx: number, cy: number, r: number) => {
      g.beginPath()
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
        g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
      }
      g.closePath()
      g.fill()
    }
    for (const [x, y] of [[32, 30], [96, 70], [160, 30], [224, 70], [64, 104], [192, 104], [128, 8], [0, 70], [256, 70]] as const) pent(x, y, 14)
  })
}

export class World {
  readonly renderer: WebGLRenderer
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(50, 1, 0.1, 2400)
  private readonly opts: WorldOptions
  private readonly post: Post
  private readonly stadium: Stadium
  private readonly city: City
  private readonly sky: Sky
  private readonly ball: Mesh
  private readonly ballShadow: Mesh
  private readonly keeper: Rig
  private readonly keeperPivot = new Group()
  private readonly striker: Rig
  private readonly aimDots: Mesh[] = []
  private readonly aimRing: Mesh
  private readonly streak: Streak
  /** The hero's looping strike (the identity: born to kick). */
  private demo = { on: false, timer: 1.2, n: 0 }
  private staticStrike = false
  private readonly ray = new Raycaster()
  private leg = 0
  private legT = 0
  private target = { leg: 0, t: 0 }
  private running = false
  private raf = 0
  private last = 0
  private clock = 0
  private frameTimes: number[] = []
  private tierLocked = false
  private reported = false
  private flight: { r: ShotResult; t: number; curl: number; after: Vector3 | null; done: boolean } | null = null
  private keeperDive: { side: number; x: number; y: number; t: number; start: number } | null = null
  private kickT = -1
  private pendingShot: { r: ShotResult; curl: number } | null = null
  onKickEnd: ((r: ShotResult) => void) | null = null
  onTierChange: ((t: Tier) => void) | null = null

  constructor(canvas: HTMLCanvasElement, opts: WorldOptions) {
    this.opts = opts
    this.renderer = new WebGLRenderer({ canvas, antialias: !opts.lowPower, powerPreference: 'high-performance', alpha: false, stencil: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.lowPower ? 1.25 : 1.5))
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    this.renderer.outputColorSpace = SRGBColorSpace
    this.scene.background = new Color(0x070b14)
    this.scene.fog = new FogExp2(0x0a1020, 0.0019)

    this.scene.add(new HemisphereLight(0x9fb4ff, 0x0b2a14, 0.6))
    const key = new DirectionalLight(0xfff0d8, 1.8)
    key.position.set(-30, 60, 40)
    this.scene.add(key)
    const rim = new DirectionalLight(0xc6d8ff, 1.0)
    rim.position.set(40, 40, -60)
    this.scene.add(rim)

    const aniso = this.renderer.capabilities.getMaxAnisotropy()
    this.sky = buildSky(this.scene, opts.lowPower)
    this.stadium = buildStadium(this.scene, { lowPower: opts.lowPower }, aniso)
    buildRooms(this.scene)
    this.city = buildCity(this.scene, opts.lowPower)

    this.ball = new Mesh(new SphereGeometry(BALL_R, 24, 16), new MeshLambertMaterial({ map: ballTexture() }))
    this.ball.position.set(0, BALL_R, SPOT_Z)
    this.scene.add(this.ball)
    this.ballShadow = new Mesh(new CircleGeometry(0.13, 20), new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }))
    this.ballShadow.rotation.x = -Math.PI / 2
    this.ballShadow.position.set(0, 0.012, SPOT_Z)
    this.scene.add(this.ballShadow)

    this.keeper = buildPlayer(KEEPER_KIT, true)
    this.keeper.root.rotation.y = Math.PI
    this.keeperPivot.add(this.keeper.root)
    this.keeperPivot.position.set(0, 0, 0.4)
    this.scene.add(this.keeperPivot)
    this.striker = buildPlayer(HERO_KIT)
    this.scene.add(this.striker.root)
    this.placeStriker(0)

    const dotGeo = new SphereGeometry(1, 16, 10)
    const aimMat = new MeshBasicMaterial({ color: 0x1fd47a, transparent: true, opacity: 0.95, depthTest: false })
    for (let i = 0; i < 6; i++) {
      const d = new Mesh(dotGeo, aimMat)
      d.visible = false
      d.renderOrder = 10
      this.scene.add(d)
      this.aimDots.push(d)
    }
    this.aimRing = new Mesh(new TorusGeometry(0.26, 0.035, 8, 40), new MeshBasicMaterial({ color: 0x1fd47a, depthTest: false }))
    this.aimRing.visible = false
    this.aimRing.renderOrder = 11
    this.scene.add(this.aimRing)
    this.streak = new Streak(this.scene)

    const tier: Tier = opts.reducedMotion ? 'low' : opts.lowPower ? 'mid' : 'high'
    this.post = new Post(this.renderer, this.scene, this.camera, tier)
    this.resize()
  }

  get tier(): Tier {
    return this.post.tier
  }

  resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.setSize(w, h, false)
    this.post.setSize(w, h)
    this.camera.aspect = w / h
    this.applyCamera()
  }

  /**
   * Scroll position → camera. Stop i is held while section i fills the screen; the camera travels to
   * the next stop while the section scrolls out.
   */
  setScroll(y: number, vh: number, anchors: Anchor[], immediate = false): void {
    let leg = anchors.length - 1
    let t = 0
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i]!
      const next = anchors[i + 1]
      if (!next) {
        leg = i
        t = 0
        break
      }
      const holdEnd = a.top + Math.max(0, a.height - vh)
      if (y < next.top) {
        leg = i
        t = y <= holdEnd ? 0 : (y - holdEnd) / Math.max(1, next.top - holdEnd)
        break
      }
    }
    if (this.opts.reducedMotion) {
      // No travel: cut to whichever stop is nearer.
      if (t > 0.5) {
        leg += 1
      }
      t = 0
      immediate = true
    }
    if (!Number.isFinite(t)) t = 0
    this.target = { leg: Math.max(0, leg), t }
    if (immediate) {
      this.leg = leg
      this.legT = t
    }
    if (leg >= 3) this.city.loadBillboards(['/media/screens/' + document.documentElement.lang + '-5.webp', '/media/screens/' + document.documentElement.lang + '-6.webp'])
  }

  /** Put the camera at leg + t directly (stills, tests). */
  setLeg(leg: number, t = 0): void {
    this.target = { leg, t }
    this.leg = leg
    this.legT = t
  }

  /** True when the camera rests at the penalty spot (play is enabled). */
  get atPenalty(): boolean {
    return this.leg === 1 && this.legT < 0.08
  }

  private applyCamera(): void {
    const s = sample(this.leg, this.legT, this.camera.aspect)
    this.camera.position.copy(s.pos)
    this.camera.fov = s.fov
    this.camera.updateProjectionMatrix()
    this.camera.lookAt(s.look)
    this.post.setFocus(s.focus, s.aperture)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    const loop = (t: number) => {
      if (!this.running) return
      this.raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (t - this.last) / 1000)
      this.last = t
      try {
        this.update(dt)
        this.post.render(this.clock)
      } catch (e) {
        // One bad frame must not stop the world; report it once.
        if (!this.reported) {
          this.reported = true
          console.warn('[Kickborn] frame skipped', e)
        }
      }
      this.watchFrameRate(dt)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  renderOnce(): void {
    this.update(0)
    this.post.render(this.clock)
  }

  /** Drop a tier when the frame rate cannot hold (never climbs back within a visit). */
  private watchFrameRate(dt: number): void {
    if (this.tierLocked || dt <= 0) return
    this.frameTimes.push(dt)
    if (this.frameTimes.length < 90) return
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
    this.frameTimes.length = 0
    if (avg > 1 / 38) {
      const next: Tier = this.post.tier === 'high' ? 'mid' : 'low'
      this.post.setTier(next)
      this.onTierChange?.(next)
      if (next === 'low') this.tierLocked = true
    }
  }

  private update(dt: number): void {
    this.clock += dt
    // Ease the camera along the path towards the scroll target.
    const k = 1 - Math.pow(0.002, dt)
    const cur = this.leg + this.legT
    const tgt = this.target.leg + this.target.t
    let next = this.opts.reducedMotion || dt === 0 ? tgt : cur + (tgt - cur) * k
    if (!Number.isFinite(next)) next = Number.isFinite(tgt) ? tgt : 0
    next = Math.max(0, Math.min(STOPS.length - 1, next))
    if (Math.abs(tgt - next) < 1e-4) next = tgt
    this.leg = Math.min(STOPS.length - 1, Math.floor(next))
    this.legT = next - this.leg
    this.applyCamera()

    const reduced = this.opts.reducedMotion
    this.sky.update(this.clock, reduced)
    this.stadium.update(reduced ? 0 : this.clock, dt, this.camera.position.y)
    this.city.update(this.clock, reduced ? 0 : dt)
    this.updateDemo(dt)
    this.updatePlayers(dt)
    this.updateFlight(dt)
    this.streak.update(dt, this.camera)
  }

  // ───────────── Players ─────────────

  private placeStriker(run: number): void {
    const f = new Vector3(-Math.sin(STRIKER_YAW), 0, -Math.cos(STRIKER_YAW))
    this.striker.root.position.copy(STRIKER_START).addScaledVector(f, run)
    this.striker.root.rotation.y = STRIKER_YAW
  }

  private updatePlayers(dt: number): void {
    const still = this.opts.reducedMotion
    if (this.kickT >= 0) {
      this.kickT += dt
      const u = Math.min(1, this.kickT / KICK_RUN)
      const run = poseShooterKick(this.striker, u)
      this.placeStriker(run * 2.45)
      if (this.pendingShot && this.kickT >= KICK_DELAY) {
        const p = this.pendingShot
        this.pendingShot = null
        this.flight = { r: p.r, t: 0, curl: p.curl, after: null, done: false }
        this.streak.start(this.ball.position)
        this.keeperDive = { side: p.r.keeperSide, x: p.r.diveX, y: p.r.diveY, t: 0, start: p.r.keeperStart }
      }
    } else if (!this.staticStrike) poseShooterIdle(this.striker, still ? 0 : this.clock)

    if (this.keeperDive) {
      const kd = this.keeperDive
      kd.t += dt
      const u = MathUtils.clamp((kd.t - kd.start) / 0.42, 0, 1)
      const e = 1 - Math.pow(1 - u, 3)
      const side = kd.side !== 0 ? kd.side : Math.sign(kd.x) || 0
      const lay = Math.abs(kd.x) > 0.9 ? side : 0
      this.keeperPivot.position.x = MathUtils.lerp(0, kd.x * 0.78, e)
      this.keeperPivot.rotation.z = -lay * 1.2 * e
      this.keeperPivot.position.y = Math.sin(e * Math.PI) * Math.max(0.12, (kd.y - 0.7) * 0.45) + (lay ? 0.28 * e : 0)
      poseKeeperDive(this.keeper, -side, e, MathUtils.clamp((kd.y - 0.6) / 1.6, 0, 1))
    } else {
      poseKeeperReady(this.keeper, this.clock, still)
      if (!still) this.keeperPivot.position.x = Math.sin(this.clock * 1.3) * 0.3
    }
  }

  // ───────────── Play ─────────────

  screenToGoal(clientX: number, clientY: number): Vector2 | null {
    const ndc = new Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1)
    this.ray.setFromCamera(ndc, this.camera)
    const o = this.ray.ray.origin
    const d = this.ray.ray.direction
    if (Math.abs(d.z) < 1e-6) return null
    const t = -o.z / d.z
    if (t <= 0) return null
    return new Vector2(o.x + d.x * t, o.y + d.y * t)
  }

  toScreen(v: Vector3): Vector2 {
    const p = v.clone().project(this.camera)
    return new Vector2(((p.x + 1) / 2) * window.innerWidth, ((1 - p.y) / 2) * window.innerHeight)
  }

  ballScreen(): Vector2 {
    return this.toScreen(new Vector3(0, BALL_R, SPOT_Z))
  }

  goalMidScreenY(): number {
    return this.toScreen(new Vector3(0, GOAL_H * 0.5, 0)).y
  }

  showAim(target: { x: number; y: number } | null, power = 0.8, curl = 0): void {
    const on = !!target && !this.busy
    for (const d of this.aimDots) d.visible = on
    this.aimRing.visible = on
    if (!target || !on) return
    const n = this.aimDots.length
    for (let i = 0; i < n; i++) {
      const s = (i + 1) / (n + 1)
      this.aimDots[i]!.position.copy(this.pathPoint(s, target.x, target.y, curl, power))
      this.aimDots[i]!.scale.setScalar(0.06 + s * 0.05)
    }
    this.aimRing.position.set(target.x, target.y, 0.05)
  }

  private pathPoint(s: number, x: number, y: number, curl: number, power: number): Vector3 {
    const loft = 0.25 + (1 - Math.min(power, 1)) * 0.9
    return new Vector3(x * s + curl * 1.1 * Math.sin(Math.PI * s), BALL_R + (y - BALL_R) * s + loft * Math.sin(Math.PI * s), SPOT_Z * (1 - s))
  }

  get busy(): boolean {
    return !!this.flight || !!this.pendingShot || this.kickT >= 0
  }

  kick(r: ShotResult, curl: number): void {
    this.showAim(null)
    this.kickT = 0
    this.pendingShot = { r, curl }
  }

  setScore(goals: number, kicks: number): void {
    this.stadium.setScore(goals, kicks)
  }

  private updateFlight(dt: number): void {
    const f = this.flight
    if (!f) return
    f.t += dt
    const r = f.r
    const ball = this.ball
    if (f.t <= r.t) {
      ball.position.copy(this.pathPoint(f.t / r.t, r.x, r.y, f.curl, r.speed / 28))
      ball.rotation.x -= dt * 30
      this.streak.push(ball.position)
    } else {
      if (!f.after) {
        this.streak.push(ball.position)
        this.streak.end()
        const o = r.outcome
        f.after = o === 'goal' ? new Vector3(r.x * 0.08, -0.6, -9) : o === 'saved' || o === 'weak' ? new Vector3(-r.x * 0.9 + (Math.random() - 0.5) * 3, 2.5, 7) : o === 'post' ? new Vector3(-Math.sign(r.x) * 3, 1.2, 6) : new Vector3(r.x * 0.15, o === 'over' ? 0.5 : -0.2, -14)
        if (o === 'goal') this.stadium.dentNet(r.x, r.y)
      }
      const a = f.after
      a.y -= 9.8 * dt
      ball.position.addScaledVector(a, dt)
      if (r.outcome === 'goal' && ball.position.z < -1.75) {
        ball.position.z = -1.75
        a.z = 0
        a.x *= 0.6
      }
      if (ball.position.y < BALL_R) {
        ball.position.y = BALL_R
        a.y = Math.abs(a.y) * 0.45
        a.x *= 0.8
        a.z *= 0.8
      }
      if (f.t > r.t + 1.6 && !f.done) {
        f.done = true
        this.onKickEnd?.(r)
      }
    }
    this.ballShadow.position.set(ball.position.x, 0.012, ball.position.z)
  }

  resetKick(): void {
    this.flight = null
    this.keeperDive = null
    this.pendingShot = null
    this.kickT = -1
    this.ball.position.set(0, BALL_R, SPOT_Z)
    this.ballShadow.position.set(0, 0.012, SPOT_Z)
    this.placeStriker(0)
    this.keeperPivot.position.set(0, 0, 0.4)
    this.keeperPivot.rotation.set(0, 0, 0)
    this.demo.on = false
  }

  /** The hero shows the strike: a scripted penalty into a top or bottom corner, the keeper beaten. */
  private demoShot(): ShotResult {
    const n = this.demo.n++
    const side = n % 2 ? -1 : 1
    const high = n % 3 !== 2
    return { outcome: 'goal', x: side * 2.75, y: high ? 1.95 : 0.45, t: 0.46, speed: 26, keeperSide: (-side) as -1 | 1, diveX: -side * 2.3, diveY: high ? 1.2 : 0.6, keeperStart: 0.1 }
  }

  private updateDemo(dt: number): void {
    const inHero = this.leg === 0 && this.legT < 0.3
    if (this.opts.reducedMotion) {
      // A still of the strike: the striker through the ball, the streak drawn into the top corner.
      if (inHero && !this.staticStrike) {
        this.staticStrike = true
        const pts: Vector3[] = []
        for (let i = 0; i <= 60; i++) pts.push(this.pathPoint(i / 60, 2.75, 1.95, 0.25, 0.95))
        this.streak.setPath(pts)
        this.ball.position.copy(pts[pts.length - 1]!)
        poseShooterKick(this.striker, 0.8)
        this.placeStriker(2.3)
      } else if (!inHero && this.staticStrike) {
        this.staticStrike = false
        this.streak.clear()
        this.resetKick()
      }
      return
    }
    if (!inHero) {
      if (this.demo.on) {
        this.resetKick()
        this.streak.clear()
      }
      this.demo.timer = 0.8
      return
    }
    if (this.busy) return
    this.demo.timer -= dt
    if (this.demo.timer > 0) return
    this.demo.timer = 2.4
    this.demo.on = true
    this.kick(this.demoShot(), 0.25)
  }

  /** Run the world forward (for stills). */
  advance(seconds: number, step = 1 / 60): void {
    for (let t = 0; t < seconds; t += step) this.update(step)
  }

  dispose(): void {
    this.stop()
    this.renderer.dispose()
  }
}

