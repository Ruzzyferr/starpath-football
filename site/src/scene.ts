/**
 * The site's WebGL world: a stylised night stadium ("Gece Maçı", the game's own identity), the
 * StarPath mark (ball, five green dots, a gold star) at stadium scale, and a camera that moves from
 * the stands down to the penalty spot as the page scrolls. The playable penalty lives here too.
 */
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Raycaster,
  Scene,
  Shape,
  SphereGeometry,
  SpriteMaterial,
  Sprite,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  CapsuleGeometry,
} from 'three'
import { BALL_R, GOAL_H, GOAL_HALF_W, SPOT_Z, type ShotResult } from './penalty'

const C = {
  sky: 0x070b14,
  pitchA: 0x1f5a26,
  pitchB: 0x1b5022,
  line: 0xf2f5fa,
  green: 0x1fd47a,
  gold: 0xffc83d,
  stand: 0x0e1626,
  standEdge: 0x1b2740,
  keeper: 0xe8579a,
  keeperDark: 0x7a1f4c,
  hero: 0xc8102e,
  heroAlt: 0xf2f5fa,
  skin: 0xc68a62,
}

export interface WorldOptions {
  lowPower: boolean
  reducedMotion: boolean
}

/** Camera rest positions: [position, look-at]. */
interface Shot {
  pos: Vector3
  look: Vector3
  fov: number
}

function heroShot(aspect: number): Shot {
  // Wide from the stand behind the spot: goal and box in the lower half, open night sky above.
  const narrow = aspect < 0.8
  return narrow
    ? { pos: new Vector3(0, 2.4, 27), look: new Vector3(0, 6.2, -4), fov: 64 }
    : { pos: new Vector3(1.6, 2.3, 21.5), look: new Vector3(-0.4, 4.6, -4), fov: 44 }
}
function playShot(aspect: number): Shot {
  // Behind the ball. On a portrait phone the camera backs off until the goal fits the width.
  const halfW = GOAL_HALF_W + 1.4
  const dist = SPOT_Z + 5.6
  const hFovNeeded = 2 * Math.atan(halfW / dist)
  const vFov = MathUtils.radToDeg(2 * Math.atan(Math.tan(hFovNeeded / 2) / aspect))
  return { pos: new Vector3(0, 1.9, SPOT_Z + 5.6), look: new Vector3(0, 0.6, 0), fov: Math.max(40, Math.min(vFov, 74)) }
}

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  draw(g)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** Half pitch, 68 m wide, from 6 m behind the goal line to the halfway line, with markings. */
function pitchTexture(maxAniso: number): CanvasTexture {
  const PX = 26 // pixels per metre
  const W = 80
  const L = 64
  const t = canvasTexture(W * PX, L * PX, (g) => {
    const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`
    g.fillStyle = hex(C.pitchA)
    g.fillRect(0, 0, W * PX, L * PX)
    // Mowing bands, 5.5 m deep, across the pitch.
    for (let i = 0; i < 12; i++) {
      if (i % 2) continue
      g.fillStyle = hex(C.pitchB)
      g.fillRect(0, (6 + i * 5.5) * PX, W * PX, 5.5 * PX)
    }
    // Speckle so the grass is not a flat print.
    const img = g.getImageData(0, 0, W * PX, L * PX)
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 10
      const d = img.data
      d[i] = d[i]! + n
      d[i + 1] = d[i + 1]! + n
      d[i + 2] = d[i + 2]! + n
    }
    g.putImageData(img, 0, 0)
    // Markings. Origin of the canvas: x = -40 m, z = -6 m (behind the goal line).
    const X = (x: number) => (x + 40) * PX
    const Z = (z: number) => (z + 6) * PX
    g.strokeStyle = 'rgba(242,245,250,0.92)'
    g.lineWidth = 0.12 * PX
    g.lineCap = 'square'
    const rect = (x0: number, z0: number, x1: number, z1: number) => g.strokeRect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0))
    rect(-34, 0, 34, 52.5) // touchlines, goal line, halfway line
    rect(-20.16, 0, 20.16, 16.5) // penalty area
    rect(-9.16, 0, 9.16, 5.5) // goal area
    g.beginPath()
    g.arc(X(0), Z(SPOT_Z), 0.2 * PX, 0, Math.PI * 2)
    g.fillStyle = 'rgba(242,245,250,0.95)'
    g.fill()
    // The "D": the arc of 9.15 m around the spot outside the area.
    const a = Math.acos(5.5 / 9.15)
    g.beginPath()
    g.arc(X(0), Z(SPOT_Z), 9.15 * PX, Math.PI / 2 - a, Math.PI / 2 + a)
    g.stroke()
    // Centre circle.
    g.beginPath()
    g.arc(X(0), Z(52.5), 9.15 * PX, Math.PI, Math.PI * 2)
    g.stroke()
  })
  t.anisotropy = maxAniso
  return t
}

function ballTexture(): CanvasTexture {
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

/** LED boards behind the goal, with the game's own fictional sponsors. */
function boardTexture(): CanvasTexture {
  const names = ['LUMEN TV', 'GOAL+', 'PIXEL COLA', 'STARPATH', 'ORBIT AIR', 'KICKR']
  const cols = ['#1f6fc0', '#d99a0b', '#0e9f57', '#0b1220', '#c22a3a', '#5a6f99']
  return canvasTexture(2048, 64, (g) => {
    const w = 2048 / names.length
    names.forEach((n, i) => {
      g.fillStyle = cols[i]!
      g.fillRect(i * w, 0, w, 64)
      g.fillStyle = n === 'STARPATH' ? '#1fd47a' : 'rgba(242,245,250,0.9)'
      g.font = '700 40px "Barlow Condensed", Arial Narrow, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(n, i * w + w / 2, 34)
    })
  })
}

function glowTexture(): CanvasTexture {
  return canvasTexture(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    r.addColorStop(0, 'rgba(255,255,255,1)')
    r.addColorStop(0.25, 'rgba(255,250,235,0.55)')
    r.addColorStop(1, 'rgba(255,250,235,0)')
    g.fillStyle = r
    g.fillRect(0, 0, 128, 128)
  })
}

/** A simple low-poly footballer: legs, shorts, shirt, arms, head. */
function figure(shirt: number, shorts: number, socks: number): { root: Group; body: Group; armL: Object3D; armR: Object3D } {
  const root = new Group()
  const body = new Group()
  root.add(body)
  const mat = (c: number) => new MeshLambertMaterial({ color: c })
  const leg = new CapsuleGeometry(0.075, 0.62, 4, 8)
  for (const s of [-1, 1]) {
    const l = new Mesh(leg, mat(socks))
    l.position.set(s * 0.11, 0.42, 0)
    body.add(l)
  }
  const hips = new Mesh(new CapsuleGeometry(0.17, 0.12, 4, 10), mat(shorts))
  hips.position.y = 0.86
  body.add(hips)
  const torso = new Mesh(new CapsuleGeometry(0.2, 0.42, 4, 12), mat(shirt))
  torso.position.y = 1.22
  torso.scale.z = 0.72
  body.add(torso)
  const head = new Mesh(new SphereGeometry(0.12, 14, 10), mat(C.skin))
  head.position.y = 1.66
  body.add(head)
  const arm = new CapsuleGeometry(0.06, 0.5, 4, 8)
  const mk = (s: number) => {
    const pivot = new Group()
    pivot.position.set(s * 0.27, 1.42, 0)
    const a = new Mesh(arm, mat(shirt))
    a.position.y = -0.28
    pivot.add(a)
    const hand = new Mesh(new SphereGeometry(0.07, 8, 6), mat(shirt === C.keeper ? C.keeperDark : C.skin))
    hand.position.y = -0.58
    pivot.add(hand)
    body.add(pivot)
    return pivot
  }
  const armL = mk(-1)
  const armR = mk(1)
  return { root, body, armL, armR }
}

function starShape(outer: number, inner: number): Shape {
  const s = new Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer
    const a = Math.PI / 2 + (i * Math.PI) / 5
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  s.closePath()
  return s
}

export type KickListener = (r: ShotResult) => void

export class World {
  readonly renderer: WebGLRenderer
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(46, 1, 0.1, 400)
  private readonly opts: WorldOptions
  private readonly ball: Mesh
  private readonly ballShadow: Mesh
  private readonly keeper: ReturnType<typeof figure>
  private readonly striker: ReturnType<typeof figure>
  private readonly motifDots: Mesh[] = []
  private readonly aimDots: Mesh[] = []
  private readonly star: Mesh
  private readonly aimStar: Mesh
  private readonly net: LineSegments
  private readonly netBase: Float32Array
  private crowd!: InstancedMesh
  private readonly ray = new Raycaster()
  /** 0 = hero shot, 1 = play shot. Smoothed toward `progressTarget`. */
  private progress = 0
  progressTarget = 0
  private running = false
  private raf = 0
  private last = 0
  private clock = 0
  private flight: { r: ShotResult; t: number; curl: number; from: Vector3; after: Vector3 | null; done: boolean } | null = null
  private netDent: { x: number; y: number; amt: number } | null = null
  private keeperDive: { side: number; x: number; y: number; t: number; start: number } | null = null
  private kickAnim = 0
  onKickEnd: ((r: ShotResult) => void) | null = null

  constructor(canvas: HTMLCanvasElement, opts: WorldOptions) {
    this.opts = opts
    this.renderer = new WebGLRenderer({ canvas, antialias: !opts.lowPower, powerPreference: 'high-performance', alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.lowPower ? 1.25 : 1.75))
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = SRGBColorSpace
    this.scene.background = new Color(C.sky)
    this.scene.fog = new Fog(C.sky, 60, 170)

    // Light: cold moon from above, warm floodlights from the corners.
    this.scene.add(new HemisphereLight(0x9fb4ff, 0x0b2a14, 0.55))
    const key = new DirectionalLight(0xfff4e0, 1.7)
    key.position.set(-20, 40, 30)
    this.scene.add(key)
    const rim = new DirectionalLight(0xcfe0ff, 1.1)
    rim.position.set(25, 30, -40)
    this.scene.add(rim)

    const aniso = this.renderer.capabilities.getMaxAnisotropy()
    // Pitch.
    const pitch = new Mesh(new PlaneGeometry(80, 64), new MeshLambertMaterial({ map: pitchTexture(Math.min(8, aniso)) }))
    pitch.rotation.x = -Math.PI / 2
    pitch.position.set(0, 0, 26) // canvas spans z -6..58
    this.scene.add(pitch)
    // Surround beyond the pitch texture.
    const apron = new Mesh(new PlaneGeometry(260, 260), new MeshLambertMaterial({ color: 0x173f1c }))
    apron.rotation.x = -Math.PI / 2
    apron.position.set(0, -0.02, 20)
    this.scene.add(apron)

    this.buildGoal()
    this.net = this.buildNet()
    this.netBase = Float32Array.from(this.net.geometry.getAttribute('position').array as Float32Array)
    this.buildStands()
    this.buildLights()
    this.buildBoards()
    this.buildSky()

    // Ball and its contact shadow.
    this.ball = new Mesh(new SphereGeometry(BALL_R, 24, 16), new MeshLambertMaterial({ map: ballTexture() }))
    this.ball.position.set(0, BALL_R, SPOT_Z)
    this.scene.add(this.ball)
    this.ballShadow = new Mesh(new CircleGeometry(0.12, 20), new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }))
    this.ballShadow.rotation.x = -Math.PI / 2
    this.ballShadow.position.set(0, 0.01, SPOT_Z)
    this.scene.add(this.ballShadow)

    // Keeper on the line, striker beside the ball.
    this.keeper = figure(C.keeper, 0x111827, C.keeper)
    this.keeper.root.position.set(0, 0, 0.35)
    this.scene.add(this.keeper.root)
    this.striker = figure(C.hero, C.heroAlt, C.hero)
    this.striker.root.position.set(-1.25, 0, SPOT_Z + 1.5)
    this.striker.root.rotation.y = Math.PI + 0.45
    this.scene.add(this.striker.root)

    // The mark: five green dots from the ball to a gold star, at stadium scale.
    const dotGeo = new SphereGeometry(1, 20, 14)
    const green = new MeshBasicMaterial({ color: C.green })
    for (let i = 0; i < 5; i++) {
      const d = new Mesh(dotGeo, green)
      this.scene.add(d)
      this.motifDots.push(d)
    }
    const starGeo = new ExtrudeGeometry(starShape(1, 0.46), { depth: 0.25, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 1 })
    starGeo.center()
    this.star = new Mesh(starGeo, new MeshBasicMaterial({ color: C.gold }))
    this.scene.add(this.star)
    this.placeMotif()

    // Aim preview: the same mark, small, from the ball to where the shot is going.
    const aimMat = new MeshBasicMaterial({ color: C.green, transparent: true, opacity: 0.95, depthTest: false })
    for (let i = 0; i < 6; i++) {
      const d = new Mesh(dotGeo, aimMat)
      d.scale.setScalar(0.07)
      d.visible = false
      d.renderOrder = 10
      this.scene.add(d)
      this.aimDots.push(d)
    }
    this.aimStar = new Mesh(starGeo, new MeshBasicMaterial({ color: C.gold, depthTest: false }))
    this.aimStar.scale.setScalar(0.24)
    this.aimStar.visible = false
    this.aimStar.renderOrder = 11
    this.scene.add(this.aimStar)

    this.resize()
  }

  private buildGoal(): void {
    const white = new MeshLambertMaterial({ color: 0xffffff, emissive: 0x333333 })
    const postGeo = new CylinderGeometry(0.06, 0.06, GOAL_H + 0.06, 12)
    for (const s of [-1, 1]) {
      const p = new Mesh(postGeo, white)
      p.position.set(s * GOAL_HALF_W, (GOAL_H + 0.06) / 2, 0)
      this.scene.add(p)
    }
    const bar = new Mesh(new CylinderGeometry(0.06, 0.06, GOAL_HALF_W * 2 + 0.12, 12), white)
    bar.rotation.z = Math.PI / 2
    bar.position.set(0, GOAL_H, 0)
    this.scene.add(bar)
    // Back stanchions.
    const back = new MeshLambertMaterial({ color: 0xc9d2e0 })
    for (const s of [-1, 1]) {
      const st = new Mesh(new CylinderGeometry(0.03, 0.03, 2.1, 6), back)
      st.position.set(s * GOAL_HALF_W, 1.05, -1.8)
      st.rotation.x = 0.18
      this.scene.add(st)
    }
  }

  /** Net as a grid of line segments whose back panel can be dented by the ball. */
  private buildNet(): LineSegments {
    const pts: number[] = []
    const seg = (a: number[], b: number[]) => pts.push(...a, ...b)
    const nx = 30
    const ny = 10
    const depthTop = -1.0
    const depthBottom = -2.0
    // Back panel nodes (x across, y up); z goes from bottom depth to top depth.
    const node = (i: number, j: number) => {
      const x = -GOAL_HALF_W + (i / nx) * GOAL_HALF_W * 2
      const y = (j / ny) * GOAL_H
      const z = depthBottom + (depthTop - depthBottom) * (j / ny)
      return [x, y, z]
    }
    for (let i = 0; i <= nx; i++) for (let j = 0; j < ny; j++) seg(node(i, j), node(i, j + 1))
    for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) seg(node(i, j), node(i + 1, j))
    // Roof and sides (static).
    for (let i = 0; i <= nx; i++) {
      const x = -GOAL_HALF_W + (i / nx) * GOAL_HALF_W * 2
      seg([x, GOAL_H, 0], [x, GOAL_H, depthTop])
    }
    for (const s of [-1, 1]) {
      for (let j = 0; j <= ny; j++) {
        const y = (j / ny) * GOAL_H
        seg([s * GOAL_HALF_W, y, 0], [s * GOAL_HALF_W, y, depthBottom + (depthTop - depthBottom) * (j / ny)])
      }
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3))
    const net = new LineSegments(g, new LineBasicMaterial({ color: 0xe6ecf5, transparent: true, opacity: 0.55 }))
    this.scene.add(net)
    return net
  }

  private buildStands(): void {
    // Stepped concrete bowl behind the goal and along both sides.
    const standMat = new MeshLambertMaterial({ color: C.stand })
    const edgeMat = new MeshLambertMaterial({ color: C.standEdge })
    const tiers = 14
    const seats: Matrix4[] = []
    const colours: number[] = []
    const palette = [C.hero, C.hero, C.heroAlt, 0x1d4ed8, 0x0b1b44, 0xffc83d, 0x2a3a5c, C.hero]
    const density = this.opts.lowPower ? 0.45 : 1
    const m = new Matrix4()
    const addBlock = (cx: number, cz: number, w: number, d: number, rotY: number, rows: number) => {
      for (let r = 0; r < rows; r++) {
        const y = 0.6 + r * 0.75
        const off = r * 0.9
        const geo = new BoxGeometry(w, 0.75, 0.9)
        const step = new Mesh(geo, r % 4 === 3 ? edgeMat : standMat)
        const g = new Group()
        g.rotation.y = rotY
        g.position.set(cx, 0, cz)
        step.position.set(0, y, -off)
        g.add(step)
        this.scene.add(g)
        // Fans on this row.
        const n = Math.floor((w / 0.55) * density)
        for (let k = 0; k < n; k++) {
          if (Math.random() < 0.18) continue
          const lx = -w / 2 + (k + 0.5) * (w / n)
          const local = new Vector3(lx, y + 0.7, -off)
          local.applyAxisAngle(new Vector3(0, 1, 0), rotY)
          m.makeTranslation(cx + local.x, local.y, cz + local.z)
          seats.push(m.clone())
          colours.push(palette[(Math.random() * palette.length) | 0]!)
        }
      }
    }
    addBlock(0, -15, 110, 0, 0, tiers) // behind the goal
    addBlock(-46, 30, 92, 0, Math.PI / 2, tiers) // left side
    addBlock(46, 30, 92, 0, -Math.PI / 2, tiers) // right side
    const fan = new BoxGeometry(0.42, 0.62, 0.3)
    this.crowd = new InstancedMesh(fan, new MeshLambertMaterial({ color: 0xffffff }), seats.length)
    const col = new Color()
    seats.forEach((mm, i) => {
      this.crowd.setMatrixAt(i, mm)
      this.crowd.setColorAt(i, col.setHex(colours[i]!).multiplyScalar(0.08 + Math.random() * 0.09))
    })
    this.scene.add(this.crowd)
    // Roof edge: a dark slab over each stand.
    const roofMat = new MeshLambertMaterial({ color: 0x0a101c })
    const roof = (x: number, z: number, w: number, d: number, ry: number) => {
      const r = new Mesh(new BoxGeometry(w, 0.6, d), roofMat)
      r.position.set(x, 12.2, z)
      r.rotation.y = ry
      this.scene.add(r)
    }
    roof(0, -31, 112, 8, 0)
    roof(-62, 30, 96, 8, Math.PI / 2)
    roof(62, 30, 96, 8, Math.PI / 2)
  }

  private buildLights(): void {
    const glow = glowTexture()
    const mastMat = new MeshLambertMaterial({ color: 0x1b2740 })
    const panelMat = new MeshBasicMaterial({ color: 0xfff6dc })
    for (const [x, z] of [[-40, -14], [40, -14], [-48, 62], [48, 62]] as const) {
      const mast = new Mesh(new CylinderGeometry(0.35, 0.5, 30, 8), mastMat)
      mast.position.set(x, 15, z)
      this.scene.add(mast)
      const head = new Group()
      head.position.set(x, 30.5, z)
      head.lookAt(0, 0, 18)
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
        const p = new Mesh(new PlaneGeometry(0.9, 0.6), panelMat)
        p.position.set(-1.6 + i * 1.05, -0.7 + j * 0.72, 0)
        head.add(p)
      }
      this.scene.add(head)
      const s = new Sprite(new SpriteMaterial({ map: glow, color: 0xfff1cf, transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0.9 }))
      s.position.set(x, 30.5, z)
      s.scale.setScalar(16)
      this.scene.add(s)
    }
  }

  private buildBoards(): void {
    const tex = boardTexture()
    const mat = new MeshBasicMaterial({ map: tex, color: 0x9aa3b0 })
    const b = new Mesh(new PlaneGeometry(56, 0.9), mat)
    b.position.set(0, 0.45, -5.5)
    this.scene.add(b)
  }

  private buildSky(): void {
    const n = this.opts.lowPower ? 260 : 600
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI - Math.PI
      const ph = 0.12 + Math.random() * 0.9
      const r = 160
      pos[i * 3] = Math.cos(th) * Math.cos(ph) * r
      pos[i * 3 + 1] = Math.sin(ph) * r
      pos[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * r + 20
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    const stars = new Points(g, new PointsMaterial({ color: 0xcfe0ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }))
    this.scene.add(stars)
  }

  /** The mark at stadium scale: from the ball over the goal into the sky. */
  private motifShift = 0

  private placeMotif(shiftX = 0): void {
    // The mark drawn in the goal's plane: the path of a shot into the top corner, carried on into
    // the night sky up to the star. Dots are evenly spaced and equal, as on the app icon.
    const p0 = new Vector3(6.2 + shiftX, 5.4 + (shiftX ? 0.8 : 0), -0.8)
    const p1 = new Vector3(7.4 + shiftX, 8.0, -0.8)
    const p2 = new Vector3(10.6 + shiftX, 9.2, -0.8)
    const pts: Vector3[] = []
    for (let i = 0; i <= 200; i++) {
      const s = i / 200
      pts.push(p0.clone().lerp(p1, s).lerp(p1.clone().lerp(p2, s), s))
    }
    // Arc-length spacing.
    const len: number[] = [0]
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1]! + pts[i]!.distanceTo(pts[i - 1]!))
    const total = len[len.length - 1]!
    for (let i = 0; i < 5; i++) {
      const target = (total * (i + 0.2)) / 5.7
      const j = len.findIndex((l) => l >= target)
      this.motifDots[i]!.position.copy(pts[Math.max(0, j)]!)
      this.motifDots[i]!.scale.setScalar(0.42)
    }
    this.star.position.copy(p2).add(new Vector3(0.6, 0.4, 0))
    this.star.scale.setScalar(1.55)
  }

  resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    // Wide, short screens (a phone on its side): carry the mark further right, clear of the title.
    const shift = w / h > 1.9 ? 3.2 : 0
    if (shift !== this.motifShift) {
      this.motifShift = shift
      this.placeMotif(shift)
    }
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
      this.update(dt)
      this.renderer.render(this.scene, this.camera)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  /** One frame, for stills (poster renders) and when the loop is paused. */
  renderOnce(): void {
    this.update(0)
    this.renderer.render(this.scene, this.camera)
  }

  setProgress(p: number, immediate = false): void {
    this.progressTarget = MathUtils.clamp(p, 0, 1)
    if (immediate || this.opts.reducedMotion) this.progress = this.progressTarget
  }

  private applyCamera(): void {
    const a = this.camera.aspect
    const h = heroShot(a)
    const p = playShot(a)
    const e = this.progress * this.progress * (3 - 2 * this.progress)
    // A swooping path: rise slightly, then drop to the spot.
    const pos = h.pos.clone().lerp(p.pos, e)
    pos.y += Math.sin(e * Math.PI) * 2.2
    const look = h.look.clone().lerp(p.look, e)
    this.camera.position.copy(pos)
    this.camera.fov = MathUtils.lerp(h.fov, p.fov, e)
    this.camera.updateProjectionMatrix()
    this.camera.lookAt(look)
  }

  private update(dt: number): void {
    this.clock += dt
    const k = 1 - Math.pow(0.0015, dt)
    this.progress += (this.progressTarget - this.progress) * (this.opts.reducedMotion ? 1 : k)
    this.applyCamera()
    // The mark fades out as the camera comes down to the spot.
    const motifOn = this.progress < 0.85
    for (const d of this.motifDots) d.visible = motifOn
    this.star.visible = motifOn
    this.striker.root.visible = this.progress < 0.55
    if (!this.opts.reducedMotion) {
      this.star.rotation.y = Math.sin(this.clock * 0.6) * 0.35
      this.motifDots.forEach((d, i) => {
        d.scale.setScalar(0.42 * (1 + 0.1 * Math.sin(this.clock * 2.4 - i * 0.8)))
      })
      // Keeper bounces on his toes until he has to move.
      if (!this.keeperDive) {
        this.keeper.root.position.x = Math.sin(this.clock * 1.4) * 0.35
        this.keeper.body.position.y = Math.abs(Math.sin(this.clock * 4)) * 0.04
        this.keeper.armL.rotation.z = -0.5
        this.keeper.armR.rotation.z = 0.5
      }
    }
    this.updateFlight(dt)
    this.updateNet(dt)
  }

  // ───────────── Play ─────────────

  /** World point on the goal plane (z = 0) under a screen point, or null if the ray misses it. */
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

  /** Screen position (CSS px) of a world point. */
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

  /** Show the dotted aim path from the ball to (x, y) on the goal plane; null hides it. */
  showAim(target: { x: number; y: number } | null, power = 0.8, curl = 0): void {
    const on = !!target && !this.flight
    for (const d of this.aimDots) d.visible = on
    this.aimStar.visible = on
    if (!target || !on) return
    const n = this.aimDots.length
    for (let i = 0; i < n; i++) {
      const s = (i + 1) / (n + 1)
      const p = this.pathPoint(s, target.x, target.y, curl, power)
      this.aimDots[i]!.position.copy(p)
      this.aimDots[i]!.scale.setScalar(0.06 + s * 0.05)
    }
    this.aimStar.position.set(target.x, target.y, 0.05)
    this.aimStar.rotation.set(0, 0, 0)
  }

  /** Point along the shot path (0 at the ball, 1 on the goal plane). */
  private pathPoint(s: number, x: number, y: number, curl: number, power: number): Vector3 {
    const loft = 0.25 + (1 - Math.min(power, 1)) * 0.9
    return new Vector3(
      x * s + curl * 1.1 * Math.sin(Math.PI * s),
      BALL_R + (y - BALL_R) * s + loft * Math.sin(Math.PI * s),
      SPOT_Z * (1 - s),
    )
  }

  get busy(): boolean {
    return !!this.flight
  }

  kick(r: ShotResult, curl: number): void {
    this.showAim(null)
    this.flight = { r, t: 0, curl, from: new Vector3(0, BALL_R, SPOT_Z), after: null, done: false }
    this.keeperDive = { side: r.keeperSide, x: r.diveX, y: r.diveY, t: 0, start: r.keeperStart }
    this.kickAnim = 0.001
  }

  private updateFlight(dt: number): void {
    // Striker's strike.
    if (this.kickAnim > 0) {
      this.kickAnim += dt
      const a = Math.min(1, this.kickAnim / 0.35)
      this.striker.root.position.z = SPOT_Z + 1.5 - Math.sin(a * Math.PI * 0.5) * 0.9
      this.striker.body.rotation.x = -Math.sin(a * Math.PI) * 0.25
    }
    if (this.keeperDive) {
      const kd = this.keeperDive
      kd.t += dt
      const u = MathUtils.clamp((kd.t - kd.start) / 0.42, 0, 1)
      const e = 1 - Math.pow(1 - u, 3)
      const k = this.keeper
      k.root.position.x = MathUtils.lerp(k.root.position.x, kd.x * 0.82, e)
      const side = kd.side !== 0 ? kd.side : Math.sign(kd.x) || 0
      const lay = Math.abs(kd.x) > 0.9 ? side : 0
      k.body.rotation.z = -lay * 1.25 * e
      k.body.position.y = Math.sin(e * Math.PI) * Math.max(0.15, (kd.y - 0.8) * 0.5) + (lay ? 0.25 * e : 0)
      k.armL.rotation.z = MathUtils.lerp(-0.5, -2.9, e)
      k.armR.rotation.z = MathUtils.lerp(0.5, 2.9, e)
    }
    const f = this.flight
    if (!f) return
    f.t += dt
    const r = f.r
    const ball = this.ball
    if (f.t <= r.t) {
      const s = f.t / r.t
      ball.position.copy(this.pathPoint(s, r.x, r.y, f.curl, r.speed / 28))
      ball.rotation.x -= dt * 30
    } else {
      if (!f.after) {
        // Bounce off the keeper or the post, or carry on into the net / out.
        const o = r.outcome
        f.after = o === 'goal' ? new Vector3(r.x * 0.08, -0.6, -9) : o === 'saved' || o === 'weak' ? new Vector3(-r.x * 0.9 + (Math.random() - 0.5) * 3, 2.5, 7) : o === 'post' ? new Vector3(-Math.sign(r.x) * 3, 1.2, 6) : new Vector3(r.x * 0.15, o === 'over' ? 0.5 : -0.2, -14)
        if (o === 'goal') this.netDent = { x: r.x, y: r.y, amt: 0.001 }
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
    this.ballShadow.position.set(ball.position.x, 0.01, ball.position.z)
  }

  private updateNet(dt: number): void {
    const nd = this.netDent
    const attr = this.net.geometry.getAttribute('position') as BufferAttribute
    const arr = attr.array as Float32Array
    if (!nd) return
    nd.amt += dt
    const strength = nd.amt < 0.15 ? nd.amt / 0.15 : Math.max(0, 1 - (nd.amt - 0.15) / 1.2)
    const backN = (31 * 10 + 11 * 30) * 2 // vertices of the back panel segments
    for (let i = 0; i < backN; i++) {
      const bx = this.netBase[i * 3]!
      const by = this.netBase[i * 3 + 1]!
      const d2 = (bx - nd.x) ** 2 + (by - nd.y) ** 2
      const push = Math.exp(-d2 / 0.9) * 0.7 * strength
      arr[i * 3 + 2] = this.netBase[i * 3 + 2]! - push
    }
    attr.needsUpdate = true
    if (strength <= 0 && nd.amt > 0.2) this.netDent = null
  }

  /** Back to the spot for the next kick. */
  resetKick(): void {
    this.flight = null
    this.keeperDive = null
    this.kickAnim = 0
    this.ball.position.set(0, BALL_R, SPOT_Z)
    this.ballShadow.position.set(0, 0.01, SPOT_Z)
    this.striker.root.position.set(-1.25, 0, SPOT_Z + 1.5)
    this.striker.body.rotation.set(0, 0, 0)
    const k = this.keeper
    k.root.position.x = 0
    k.body.rotation.z = 0
    k.body.position.y = 0
    k.armL.rotation.z = -0.5
    k.armR.rotation.z = 0.5
  }

  dispose(): void {
    this.stop()
    this.renderer.dispose()
  }
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

