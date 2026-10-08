/**
 * Procedural player figures (match + training scenes).
 *
 * Every pose is a tiny 3D skeleton (pelvis, torso, two legs, two arms) in the
 * body frame (forward f, right r, up u). At load it is projected with the
 * scene's own 2.5D view (tilt + height lift) for five facing directions
 * (away, away-right, right, toward-right, toward the camera; the left-facing
 * ones are mirrored at draw time) and painted with canvas 2D into two sheets:
 *
 *  - a kit sheet per kit (shirt with pattern, shorts, socks, boots, outline),
 *  - one shared skin sheet (legs, arms, neck) drawn in light grey and tinted
 *    per player, so a whole team shares one kit sheet whatever the skin tone.
 *
 * The head (skin + hair, back / side / front views) and the shirt number are
 * separate small images on top. No external assets; rendering only.
 */
import Phaser from 'phaser'
import type { KitColors } from '../core/types'
import { colorNum, luminance, mixHex } from './art'
import { PPM, TILT, ZS } from './view'
import { ANIM_POSES, RUN_FRAMES, WALK_FRAMES, type KickStyle } from './figureAnim'

// ───────────────────────── Skeleton & poses ─────────────────────────

type V3 = [number, number, number] // forward, right, up (m)

interface Leg {
  /** Thigh angle from straight down (+ = forward), radians. */
  t: number
  /** Knee bend (shin swings back by this much). */
  k: number
  /** Extra sideways spread of the foot (m). */
  w?: number
}
interface Arm {
  /** Upper-arm angle from straight down (+ = forward). */
  a: number
  /** Abduction: 0 = along the body, π/2 = straight out sideways, < 0 = across. */
  b: number
  /** Elbow bend (forearm swings further forward). */
  e: number
}
interface Body {
  pu: number
  pf?: number
  /** Torso lean from vertical (+ = forward). */
  lean: number
  legs: [Leg, Leg]
  arms: [Arm | null, Arm | null]
  /** Head pushed forward (headers). */
  headF?: number
}

export { ANIM_POSES, IDLE_FRAMES, RUN_FRAMES, WALK_FRAMES, kickStyleFor, type KickStyle } from './figureAnim'
export type FigPose =
  | 'idle' | `idle${0 | 1 | 2}` | `walk${0 | 1 | 2 | 3}` | `run${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}` | 'kick0' | 'kick1' | 'kick2'
  | `kick_${KickStyle}${0 | 1}` | 'jump' | 'slide' | 'down' | 'dive' | 'catch' | 'ready'
  | 'kneel' | 'tuck' | 'up' | 'out' | 'point' | 'call' | 'bare' | 'wall'

const IDLE_LEGS: [Leg, Leg] = [{ t: 0.04, k: 0.12, w: 0.1 }, { t: -0.04, k: 0.12, w: 0.1 }]
const IDLE_ARM: Arm = { a: 0.1, b: 0.16, e: 0.35 }

function runBody(i: number): Body {
  const ph = (i / RUN_FRAMES) * Math.PI * 2
  const leg = (p: number): Leg => ({ t: 0.62 * Math.sin(p), k: 0.22 + 1.1 * Math.max(0, Math.cos(p)) })
  const arm = (p: number): Arm => ({ a: -0.62 * Math.sin(p), b: 0.14, e: 1.25 })
  return { pu: 0.97 - 0.05 * Math.abs(Math.sin(ph)), lean: 0.2, legs: [leg(ph), leg(ph + Math.PI)], arms: [arm(ph), arm(ph + Math.PI)] }
}

function walkBody(i: number): Body {
  const ph = (i / WALK_FRAMES) * Math.PI * 2
  const leg = (q: number): Leg => ({ t: 0.32 * Math.sin(q), k: 0.1 + 0.45 * Math.max(0, Math.cos(q)) })
  const arm = (q: number): Arm => ({ a: -0.3 * Math.sin(q), b: 0.15, e: 0.45 })
  return { pu: 0.975 - 0.012 * Math.abs(Math.sin(ph)), lean: 0.06, legs: [leg(ph), leg(ph + Math.PI)], arms: [arm(ph), arm(ph + Math.PI)] }
}

function idleBody(i: number): Body {
  // Breathing: chest rises a touch, arms ease out and back.
  const b = [0, 0.5, 1][i] ?? 0
  return { pu: 0.97 + 0.006 * b, lean: 0.05 - 0.015 * b, legs: IDLE_LEGS, arms: [{ ...IDLE_ARM, b: IDLE_ARM.b + 0.05 * b }, { ...IDLE_ARM, b: IDLE_ARM.b + 0.05 * b }] }
}

/** Contact (0) and follow-through (1) bodies per strike style; the kicking leg is legs[1]. */
function kickStyleBody(style: KickStyle, f: 0 | 1): Body {
  switch (style) {
    case 'power':
      return f === 0
        ? { pu: 0.94, lean: 0.1, legs: [{ t: 0.12, k: 0.3 }, { t: 0.35, k: 0.55 }], arms: [{ a: 0.6, b: 1.1, e: 0.3 }, { a: -0.5, b: 0.5, e: 0.5 }] }
        : { pu: 0.93, lean: -0.22, legs: [{ t: -0.1, k: 0.2 }, { t: 1.45, k: 0.1 }], arms: [{ a: 0.3, b: 1.25, e: 0.2 }, { a: 0.6, b: 0.6, e: 0.4 }] }
    case 'side':
      // Inside of the foot / placed: the kicking foot turns across the body and the swing stays low.
      return f === 0
        ? { pu: 0.95, lean: 0.08, legs: [{ t: 0.06, k: 0.3 }, { t: 0.3, k: 0.35, w: -0.3 }], arms: [{ a: 0.35, b: 0.85, e: 0.35 }, { a: -0.2, b: 0.45, e: 0.5 }] }
        : { pu: 0.95, lean: 0.04, legs: [{ t: 0.0, k: 0.25 }, { t: 0.62, k: 0.3, w: -0.36 }], arms: [{ a: 0.25, b: 0.9, e: 0.3 }, { a: 0.1, b: 0.5, e: 0.5 }] }
    case 'chip':
      // Stab under the ball: lean back, short follow-through.
      return f === 0
        ? { pu: 0.93, lean: -0.24, legs: [{ t: 0.12, k: 0.4 }, { t: 0.28, k: 0.6 }], arms: [{ a: 0.5, b: 1.0, e: 0.3 }, { a: 0.2, b: 0.8, e: 0.4 }] }
        : { pu: 0.94, lean: -0.2, legs: [{ t: 0.05, k: 0.3 }, { t: 0.55, k: 0.45 }], arms: [{ a: 0.6, b: 1.1, e: 0.2 }, { a: 0.4, b: 0.9, e: 0.3 }] }
    case 'outside':
      // Outside of the boot: the foot flicks outward through the ball.
      return f === 0
        ? { pu: 0.95, lean: 0.06, legs: [{ t: 0.08, k: 0.3 }, { t: 0.35, k: 0.4, w: 0.22 }], arms: [{ a: 0.4, b: 0.95, e: 0.3 }, { a: -0.3, b: 0.5, e: 0.5 }] }
        : { pu: 0.95, lean: 0.0, legs: [{ t: 0.02, k: 0.25 }, { t: 0.7, k: 0.3, w: 0.42 }], arms: [{ a: 0.3, b: 1.0, e: 0.3 }, { a: 0.3, b: 0.6, e: 0.4 }] }
  }
}

function poseBody(p: FigPose): Body {
  if (p.startsWith('run')) return runBody(Number(p.slice(3)))
  if (p.startsWith('walk')) return walkBody(Number(p.slice(4)))
  if (p.startsWith('idle') && p.length > 4) return idleBody(Number(p.slice(4)))
  if (p.startsWith('kick_')) return kickStyleBody(p.slice(5, -1) as KickStyle, Number(p.slice(-1)) as 0 | 1)
  switch (p) {
    case 'kick0':
      return { pu: 0.94, lean: 0.12, legs: [{ t: 0.15, k: 0.25 }, { t: -0.8, k: 1.45 }], arms: [{ a: 0.5, b: 0.95, e: 0.4 }, { a: -0.45, b: 0.45, e: 0.5 }] }
    case 'kick1':
      return { pu: 0.95, lean: 0.02, legs: [{ t: 0.08, k: 0.3 }, { t: 0.4, k: 0.35 }], arms: [{ a: 0.4, b: 1.05, e: 0.3 }, { a: -0.3, b: 0.5, e: 0.5 }] }
    case 'kick2':
      return { pu: 0.95, lean: -0.14, legs: [{ t: -0.06, k: 0.2 }, { t: 1.15, k: 0.12 }], arms: [{ a: 0.2, b: 1.15, e: 0.3 }, { a: 0.45, b: 0.5, e: 0.5 }] }
    case 'jump':
      return { pu: 0.97, lean: 0.28, headF: 0.06, legs: [{ t: 0.25, k: 1.35, w: 0.06 }, { t: 0.1, k: 1.15, w: 0.06 }], arms: [{ a: 2.3, b: 0.65, e: 0.35 }, { a: 2.3, b: 0.65, e: 0.35 }] }
    case 'slide':
      return { pu: 0.28, lean: -1.0, legs: [{ t: 0.7, k: 1.9 }, { t: 1.42, k: 0 }], arms: [{ a: -0.9, b: 0.5, e: 0 }, { a: 0.9, b: 0.6, e: 0.3 }] }
    case 'down':
      return { pu: 0.16, lean: -1.5, legs: [{ t: 1.5, k: 0.15 }, { t: 1.3, k: 0.55 }], arms: [{ a: 1.2, b: 1.2, e: 0.4 }, { a: 1.0, b: 1.25, e: 0.6 }] }
    case 'dive':
      return { pu: 0.45, pf: -0.42, lean: 1.45, legs: [{ t: -1.3, k: 0.35 }, { t: -1.48, k: 0.1 }], arms: [{ a: 1.68, b: 0.28, e: 0 }, { a: 1.68, b: 0.28, e: 0 }] }
    case 'catch':
      return { pu: 0.95, lean: 0.15, legs: [{ t: 0.08, k: 0.3, w: 0.14 }, { t: -0.08, k: 0.3, w: 0.14 }], arms: [{ a: 1.45, b: -0.2, e: 0.65 }, { a: 1.45, b: -0.2, e: 0.65 }] }
    case 'ready':
      return { pu: 0.84, lean: 0.35, legs: [{ t: 0.3, k: 0.75, w: 0.3 }, { t: 0.3, k: 0.75, w: 0.3 }], arms: [{ a: 0.6, b: 0.75, e: 0.3 }, { a: 0.6, b: 0.75, e: 0.3 }] }
    case 'kneel':
      return { pu: 0.52, lean: -0.25, legs: [{ t: 0.05, k: 1.57, w: 0.16 }, { t: -0.05, k: 1.57, w: 0.16 }], arms: [{ a: 1.57, b: 1.45, e: 0.1 }, { a: 1.57, b: 1.45, e: 0.1 }] }
    case 'tuck':
      return { pu: 0.62, lean: 0.6, legs: [{ t: 1.6, k: 2.4 }, { t: 1.5, k: 2.3 }], arms: [{ a: 1.3, b: 0.25, e: 1.0 }, { a: 1.3, b: 0.25, e: 1.0 }] }
    case 'up':
      return { pu: 0.97, lean: -0.05, legs: IDLE_LEGS, arms: [{ a: 2.85, b: 0.35, e: 0.15 }, { a: 2.85, b: 0.35, e: 0.15 }] }
    case 'out':
      return { pu: 0.97, lean: 0, legs: IDLE_LEGS, arms: [{ a: 1.57, b: 1.45, e: 0.05 }, { a: 1.57, b: 1.45, e: 0.05 }] }
    case 'point':
      return { pu: 0.97, lean: 0, legs: IDLE_LEGS, arms: [IDLE_ARM, { a: 2.75, b: 0.2, e: 0 }] }
    case 'call':
      return { pu: 0.97, lean: 0.08, legs: IDLE_LEGS, arms: [IDLE_ARM, { a: 2.9, b: 0.3, e: 0.1 }] }
    case 'bare':
      return { pu: 0.97, lean: 0.02, legs: IDLE_LEGS, arms: [null, null] }
    case 'wall':
      return { pu: 0.97, lean: 0.05, legs: [{ t: 0, k: 0.1, w: 0.04 }, { t: 0, k: 0.1, w: 0.04 }], arms: [{ a: 0.45, b: -0.55, e: 0.9 }, { a: 0.45, b: -0.55, e: 0.9 }] }
    default:
      return { pu: 0.97, lean: 0.05, legs: IDLE_LEGS, arms: [IDLE_ARM, IDLE_ARM] }
  }
}

export const FIG_POSES: readonly FigPose[] = [
  ...(ANIM_POSES as readonly FigPose[]),
  'idle', 'kick0', 'kick1', 'kick2', 'jump', 'slide', 'down', 'dive', 'catch', 'ready',
  'kneel', 'tuck', 'up', 'out', 'point', 'call', 'bare', 'wall',
]

const THIGH = 0.46
const SHIN = 0.46
const UPPER = 0.3
const FORE = 0.28
const TORSO = 0.52

interface Joints {
  P: V3
  C: V3
  T: V3
  N: V3
  neck: V3
  head: V3
  hip: [V3, V3]
  knee: [V3, V3]
  ankle: [V3, V3]
  toe: [V3, V3]
  sh: [V3, V3]
  elbow: [V3 | null, V3 | null]
  hand: [V3 | null, V3 | null]
}

const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]

function joints(b: Body): Joints {
  const P: V3 = [b.pf ?? 0, 0, b.pu]
  const T: V3 = [Math.sin(b.lean), 0, Math.cos(b.lean)]
  const N: V3 = [Math.cos(b.lean), 0, -Math.sin(b.lean)]
  const C = add(P, T, TORSO)
  const neck = add(P, T, TORSO + 0.08)
  const head = add(add(P, T, TORSO + 0.27), [1, 0, 0], b.headF ?? 0)
  const hip: [V3, V3] = [add(P, [0, -0.12, 0]), add(P, [0, 0.12, 0])]
  const knee = [0, 1].map((i) => {
    const l = b.legs[i]!
    return add(hip[i]!, [Math.sin(l.t) * THIGH, 0, -Math.cos(l.t) * THIGH])
  }) as [V3, V3]
  const ankle = [0, 1].map((i) => {
    const l = b.legs[i]!
    const s = l.t - l.k
    return add(knee[i]!, [Math.sin(s) * SHIN, (i ? 1 : -1) * (l.w ?? 0) * 0.5, -Math.cos(s) * SHIN])
  }) as [V3, V3]
  const toe = [0, 1].map((i) => {
    const l = b.legs[i]!
    const s = l.t - l.k
    return add(ankle[i]!, [Math.cos(s) * 0.2, 0, Math.sin(s) * 0.2 - 0.02])
  }) as [V3, V3]
  const sh: [V3, V3] = [add(C, [0, -0.25, 0]), add(C, [0, 0.25, 0])]
  const elbow: [V3 | null, V3 | null] = [null, null]
  const hand: [V3 | null, V3 | null] = [null, null]
  for (const i of [0, 1]) {
    const a = b.arms[i]
    if (!a) continue
    const side = i ? 1 : -1
    const dir = (ang: number): V3 => [Math.sin(ang) * Math.cos(a.b), side * Math.sin(a.b), -Math.cos(ang) * Math.cos(a.b)]
    elbow[i] = add(sh[i]!, dir(a.a), UPPER)
    hand[i] = add(elbow[i]!, dir(a.a + a.e), FORE)
  }
  return { P, C, T, N, neck, head, hip, knee, ankle, toe, sh, elbow, hand }
}

// ───────────────────────── Projection ─────────────────────────

/** Ground directions of the five drawn views (screen x right, screen y toward the camera). */
const DIR_VECS: readonly [number, number][] = [[0, -1], [Math.SQRT1_2, -Math.SQRT1_2], [1, 0], [Math.SQRT1_2, Math.SQRT1_2], [0, 1]]
export const FIG_DIRS = DIR_VECS.length

interface P2 {
  x: number
  y: number
  /** Toward the camera (painter's order). */
  d: number
}

function projector(dir: number, S: number) {
  const [dx, dy] = DIR_VECS[dir]!
  return (v: V3): P2 => {
    const gx = v[0] * dx - v[1] * dy
    const gy = v[0] * dy + v[1] * dx
    return { x: gx * S, y: gy * S * TILT - v[2] * S * ZS, d: gy }
  }
}

// ───────────────────────── Primitives ─────────────────────────

type Layer = 'kit' | 'skin'
interface Prim {
  layer: Layer
  depth: number
  /** Silhouette (for the outline), at the primitive's own width. */
  sil: (c: CanvasRenderingContext2D, grow: number) => void
  paint: (c: CanvasRenderingContext2D, kit: KitPaint) => void
  /** Bounding box (px). */
  box: [number, number, number, number]
}

interface KitPaint {
  shirt: string
  trim: string
  shorts: string
  socks: string
  boots: string
  gloves: string | null
  pattern: KitColors['pattern']
  keeper: boolean
}

function seg(c: CanvasRenderingContext2D, a: P2, b: P2, w: number, col?: string): void {
  if (col) c.strokeStyle = col
  c.lineWidth = w
  c.beginPath()
  c.moveTo(a.x, a.y)
  c.lineTo(b.x, b.y)
  c.stroke()
}

/** Thick segment with a soft light-side highlight (light from the top-left). */
function limb(c: CanvasRenderingContext2D, a: P2, b: P2, w: number, col: string, hi = 0.28): void {
  seg(c, a, b, w, col)
  if (w < 2.5) return
  const o = w * 0.16
  c.globalAlpha = 0.55
  seg(c, { x: a.x - o, y: a.y - o, d: 0 }, { x: b.x - o, y: b.y - o, d: 0 }, w * 0.42, mixHex(col, '#ffffff', hi))
  c.globalAlpha = 1
}


function hull(pts: P2[]): P2[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y)
  if (p.length < 3) return p
  const cross = (o: P2, a: P2, b: P2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lo: P2[] = []
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2]!, lo[lo.length - 1]!, q) <= 0) lo.pop()
    lo.push(q)
  }
  const up: P2[] = []
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]
    while (up.length >= 2 && cross(up[up.length - 2]!, up[up.length - 1]!, q!) <= 0) up.pop()
    up.push(q!)
  }
  return lo.slice(0, -1).concat(up.slice(0, -1))
}

function polyPath(c: CanvasRenderingContext2D, pts: P2[]): void {
  c.beginPath()
  pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)))
  c.closePath()
}

function bbox(pts: P2[], pad: number): [number, number, number, number] {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of pts) {
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad]
}

interface FrameGeo {
  prims: Prim[]
  box: [number, number, number, number]
  /** Head centre relative to the ground pivot (px). */
  head: { x: number; y: number }
  /** Shirt-number spot (px), its width, and whether the back faces the camera. */
  num: { x: number; y: number; w: number; back: boolean; show: boolean }
  /** Hip point (px) — rotation pivot for flips and cartwheels. */
  hip: { x: number; y: number }
}

function buildFrame(pose: FigPose, dir: number, S: number): FrameGeo {
  const b = poseBody(pose)
  const J = joints(b)
  const pr = projector(dir, S)
  const prims: Prim[] = []
  const all: P2[] = []
  const W = (m: number) => m * S

  const segPrim = (layer: Layer, A: V3, B: V3, w: number, colOf: (k: KitPaint) => string, hi = 0.28, bias = 0) => {
    const a = pr(A)
    const bb = pr(B)
    const ww = W(w)
    all.push(a, bb)
    prims.push({
      layer,
      depth: (a.d + bb.d) / 2 + bias,
      sil: (c, g) => seg(c, a, bb, ww + g),
      paint: (c, k) => limb(c, a, bb, ww, colOf(k), hi),
      box: bbox([a, bb], ww / 2 + 3),
    })
  }

  // Legs: skin underneath, then shorts, socks and boots.
  for (const i of [0, 1]) {
    const hip = J.hip[i]!
    const kn = J.knee[i]!
    const an = J.ankle[i]!
    const toe = J.toe[i]
    const bias = 0.001 * (i ? 1 : -1)
    segPrim('skin', hip!, kn, 0.2, () => '#d6d6d6', 0.4, bias)
    segPrim('skin', kn!, an, 0.16, () => '#d6d6d6', 0.4, bias)
    const thighMid = add(hip!, [(kn[0] - hip[0]) * 0.5, (kn[1] - hip[1]) * 0.5, (kn[2] - hip[2]) * 0.5])
    segPrim('kit', hip!, thighMid, 0.25, (k) => k.shorts, 0.25, bias + 0.0005)
    const sockTop = add(kn!, [(an[0] - kn[0]) * 0.18, (an[1] - kn[1]) * 0.18, (an[2] - kn[2]) * 0.18])
    segPrim('kit', sockTop, an!, 0.17, (k) => k.socks, 0.3, bias + 0.0005)
    segPrim('kit', an!, toe!, 0.15, (k) => k.boots, 0.35, bias + 0.0007)
  }

  // Torso (shirt) and shorts seat as convex hulls with thickness.
  const torsoPts3: V3[] = []
  for (const s of [-1, 1]) for (const n of [-1, 1]) {
    torsoPts3.push(add(add(J.C, [0, s * 0.25, 0]), J.N, n * 0.14))
    torsoPts3.push(add(add(J.P, [0, s * 0.19, 0]), J.N, n * 0.13))
    torsoPts3.push(add(add(add(J.P, J.T, TORSO * 0.55), [0, s * 0.21, 0]), J.N, n * 0.145))
  }
  const torso = hull(torsoPts3.map(pr))
  all.push(...torso)
  const torsoDepth = pr(add(J.P, J.T, TORSO * 0.5)).d
  // Which face of the torso the camera sees (front when it points toward the camera).
  const Np = pr(add([0, 0, 0], J.N))
  const front = Np.d >= 0
  const faceN = front ? 1 : -1
  const face = (base: V3, r: number, t: number) => pr(add(add(add(base, [0, r, 0]), J.T, t), J.N, faceN * 0.145))
  const faceWide = Math.abs(Np.d) > 0.22
  const round = W(0.07)
  const seatPts3: V3[] = []
  for (const s of [-1, 1]) for (const n of [-1, 1]) {
    seatPts3.push(add(add(add(J.P, J.T, 0.06), [0, s * 0.2, 0]), J.N, n * 0.135))
    seatPts3.push(add(add(add(J.P, J.T, -0.1), [0, s * 0.195, 0]), J.N, n * 0.135))
  }
  const seat = hull(seatPts3.map(pr))
  prims.push({
    layer: 'kit',
    depth: torsoDepth - 0.0004,
    sil: (c, g) => {
      polyPath(c, seat)
      c.lineWidth = round + g
      c.lineJoin = 'round'
      c.stroke()
      c.fill()
    },
    paint: (c, k) => {
      polyPath(c, seat)
      c.fillStyle = k.shorts
      c.strokeStyle = k.shorts
      c.lineWidth = round
      c.lineJoin = 'round'
      c.fill()
      c.stroke()
    },
    box: bbox(seat, round + 3),
  })
  prims.push({
    layer: 'kit',
    depth: torsoDepth,
    sil: (c, g) => {
      polyPath(c, torso)
      c.lineWidth = round + g
      c.lineJoin = 'round'
      c.stroke()
      c.fill()
    },
    paint: (c, k) => {
      c.save()
      polyPath(c, torso)
      c.lineJoin = 'round'
      c.fillStyle = k.shirt
      c.strokeStyle = k.shirt
      c.lineWidth = round
      c.fill()
      c.stroke()
      // Clip to the rounded torso for the pattern and shading.
      polyPath(c, torso)
      c.lineWidth = round
      c.stroke()
      c.clip()
      // The stroke ring is outside the clip path; widen the clip by re-filling with a stroke-sized hull.
      c.fillStyle = k.trim
      c.strokeStyle = k.trim
      const band = (pts: P2[]) => {
        polyPath(c, pts)
        c.fill()
      }
      const P0 = J.P
      const C0 = J.C
      switch (k.pattern) {
        case 'stripes':
          if (faceWide) for (let r = -0.27; r < 0.26; r += 0.12) band([face(C0, r, 0.06), face(C0, r + 0.06, 0.06), face(P0, (r + 0.06) * 0.8, -0.05), face(P0, r * 0.8, -0.05)])
          break
        case 'hoops':
          for (let t = 0.04; t < TORSO; t += 0.17) {
            const pts: V3[] = []
            for (const s of [-1, 1]) for (const n of [-1, 1]) for (const tt of [t, t + 0.085]) pts.push(add(add(add(P0, J.T, tt), [0, s * 0.22, 0]), J.N, n * 0.13))
            band(hull(pts.map(pr)))
          }
          break
        case 'halves': {
          const pts: V3[] = []
          for (const r of [-0.23, 0]) for (const n of [-1, 1]) for (const tt of [-0.06, TORSO + 0.06]) pts.push(add(add(add(P0, J.T, tt), [0, r, 0]), J.N, n * 0.14))
          band(hull(pts.map(pr)))
          break
        }
        case 'sash':
          if (faceWide) band([face(C0, 0.21, 0.06), face(C0, 0.08, 0.06), face(P0, -0.17, -0.04), face(P0, -0.04, -0.04)])
          break
        case 'chevron':
          if (faceWide) {
            c.lineWidth = W(0.075)
            c.lineJoin = 'miter'
            c.beginPath()
            const a = face(C0, -0.22, -0.08)
            const m = face(C0, 0, -0.24)
            const z = face(C0, 0.22, -0.08)
            c.moveTo(a.x, a.y)
            c.lineTo(m.x, m.y)
            c.lineTo(z.x, z.y)
            c.stroke()
          }
          break
        case 'plain':
          break
      }
      // Collar.
      const n0 = pr(add(J.C, J.T, 0.03))
      c.fillStyle = k.trim
      c.beginPath()
      c.ellipse(n0.x, n0.y, W(0.075), W(0.04), 0, 0, Math.PI * 2)
      c.fill()
      // Shading: light from the upper left, darker toward the waist and the right.
      const [x0, y0, x1, y1] = bbox(torso, round)
      const gx = c.createLinearGradient(x0, y0, x1, y1)
      gx.addColorStop(0, 'rgba(255,255,255,0.26)')
      gx.addColorStop(0.45, 'rgba(255,255,255,0.02)')
      gx.addColorStop(1, 'rgba(0,0,0,0.3)')
      c.fillStyle = gx
      c.fillRect(x0 - round, y0 - round, x1 - x0 + round * 2, y1 - y0 + round * 2)
      c.restore()
    },
    box: bbox(torso, round + 3),
  })

  // Neck (skin, under the head).
  segPrim('skin', J.C, J.neck, 0.13, () => '#d6d6d6', 0.3, -0.0001)

  // Arms: skin, then sleeves (short; keepers wear long sleeves and gloves).
  for (const i of [0, 1]) {
    const el = J.elbow[i]
    const hd = J.hand[i]
    if (!el || !hd) continue
    const sh = J.sh[i]!
    const bias = 0.0002
    segPrim('skin', sh!, el, 0.135, () => '#d6d6d6', 0.4, bias)
    segPrim('skin', el, hd, 0.12, () => '#d6d6d6', 0.4, bias)
    const sleeveEnd = add(sh!, [(el[0] - sh[0]) * 0.6, (el[1] - sh[1]) * 0.6, (el[2] - sh[2]) * 0.6])
    const a = pr(sh!)
    const sEnd = pr(sleeveEnd)
    const e = pr(el)
    const h = pr(hd)
    const ww = W(0.175)
    all.push(a, e, h)
    prims.push({
      layer: 'kit',
      depth: (a.d + e.d) / 2 + bias + 0.0003,
      sil: (c, g) => seg(c, a, sEnd, ww + g),
      paint: (c, k) => {
        if (k.keeper) {
          limb(c, a, e, ww, k.shirt)
          limb(c, e, h, W(0.13), k.shirt)
          c.fillStyle = k.gloves ?? '#f2f2f2'
          c.beginPath()
          c.arc(h.x, h.y, W(0.085), 0, Math.PI * 2)
          c.fill()
        } else limb(c, a, sEnd, ww, k.shirt)
      },
      box: bbox([a, e, h], ww / 2 + W(0.09) + 3),
    })
    // Hand (skin).
    prims.push({
      layer: 'skin',
      depth: h.d + 0.0002,
      sil: (c, g) => {
        c.beginPath()
        c.arc(h.x, h.y, W(0.065) + g / 2, 0, Math.PI * 2)
        c.fill()
      },
      paint: (c) => {
        c.fillStyle = '#e4e4e4'
        c.beginPath()
        c.arc(h.x, h.y, W(0.065), 0, Math.PI * 2)
        c.fill()
      },
      box: bbox([h], W(0.07) + 3),
    })
  }

  prims.sort((p, q) => p.depth - q.depth)
  let box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const p of prims) box = [Math.min(box[0], p.box[0]), Math.min(box[1], p.box[1]), Math.max(box[2], p.box[2]), Math.max(box[3], p.box[3])]
  const hp = pr(J.head)
  const np = pr(add(J.P, J.T, TORSO * 0.62))
  const show = Math.abs(b.lean) < 0.7 && pose !== 'tuck'
  const hipP = pr(J.P)
  // Torso width on screen (px) for sizing the number.
  const tw = Math.max(...torso.map((p) => p.x)) - Math.min(...torso.map((p) => p.x))
  void all
  return { prims, box, head: { x: hp.x, y: hp.y }, num: { x: np.x, y: np.y, w: tw, back: !front, show: show && faceWide }, hip: { x: hipP.x, y: hipP.y } }
}

// ───────────────────────── Sheet layout ─────────────────────────

export interface FigFrameMeta {
  head: { x: number; y: number }
  num: { x: number; y: number; w: number; back: boolean; show: boolean }
  hip: { x: number; y: number }
}

interface Layout {
  S: number
  w: number
  h: number
  frames: { name: string; geo: FrameGeo; x: number; y: number; w: number; h: number; ox: number; oy: number }[]
  meta: Map<string, FigFrameMeta>
}

const layouts = new Map<number, Layout>()

export const frameName = (pose: FigPose, dir: number) => `${pose}:${dir}`

function layout(S: number): Layout {
  const hit = layouts.get(S)
  if (hit) return hit
  const SHEET_W = 1024
  const frames: Layout['frames'] = []
  const meta = new Map<string, FigFrameMeta>()
  let x = 0
  let y = 0
  let rowH = 0
  const pad = 2
  for (const pose of FIG_POSES) {
    for (let dir = 0; dir < FIG_DIRS; dir++) {
      const geo = buildFrame(pose, dir, S)
      const [bx0, by0, bx1, by1] = geo.box
      const fw = Math.ceil(bx1 - bx0) + pad * 2
      const fh = Math.ceil(by1 - by0) + pad * 2
      if (x + fw > SHEET_W) {
        x = 0
        y += rowH
        rowH = 0
      }
      const name = frameName(pose, dir)
      // Pivot = ground point under the pelvis (0,0 in figure space).
      frames.push({ name, geo, x, y, w: fw, h: fh, ox: -bx0 + pad, oy: -by0 + pad })
      meta.set(name, { head: geo.head, num: geo.num, hip: geo.hip })
      x += fw
      rowH = Math.max(rowH, fh)
    }
  }
  const L: Layout = { S, w: SHEET_W, h: y + rowH, frames, meta }
  layouts.set(S, L)
  return L
}

/** Sheet resolution (px per metre of figure) per quality profile. */
export const FIG_RES = { low: 30, medium: 36, high: 42 } as const

/** Figures are drawn a touch larger than life for readability on phones. */
export const FIG_SCALE = 1.3

function makeSheet(scene: Phaser.Scene, key: string, S: number, draw: (c: CanvasRenderingContext2D, f: Layout['frames'][number]) => void): string {
  if (scene.textures.exists(key)) return key
  const L = layout(S)
  const cv = document.createElement('canvas')
  cv.width = L.w
  cv.height = Math.max(1, Math.ceil(L.h))
  const c = cv.getContext('2d')
  if (c) {
    c.lineCap = 'round'
    c.lineJoin = 'round'
    for (const f of L.frames) {
      c.save()
      c.beginPath()
      c.rect(f.x, f.y, f.w, f.h)
      c.clip()
      c.translate(f.x + f.ox, f.y + f.oy)
      draw(c, f)
      c.restore()
    }
  }
  const tex = scene.textures.addCanvas(key, cv)
  if (tex) {
    for (const f of L.frames) {
      const fr = tex.add(f.name, 0, f.x, f.y, f.w, f.h)
      if (fr) {
        fr.customPivot = true
        fr.pivotX = f.ox / f.w
        fr.pivotY = f.oy / f.h
      }
    }
  }
  return key
}

export interface FigureKitOptions {
  keeper?: boolean
  /** Outline colour (colour-blind / kit-clash modes); default a dark ink outline. */
  outline?: number | null
}

/** Kit sheet (shirt, shorts, socks, boots + silhouette outline) for one kit. */
export function figureKitSheet(scene: Phaser.Scene, kit: KitColors, S: number, o: FigureKitOptions = {}): string {
  const outline = o.outline ?? null
  const key = `figkit_${S}_${kit.primary}_${kit.secondary}_${kit.pattern}_${o.keeper ? 'gk' : 'of'}_${outline ?? 'ink'}`
  const shirt = kit.primary
  const lightShirt = luminance(shirt) > 0.6
  const paint: KitPaint = {
    shirt,
    trim: kit.secondary,
    shorts: o.keeper ? mixHex(kit.primary, '#000000', 0.55) : kit.pattern === 'plain' && luminance(kit.secondary) < 0.12 ? mixHex(kit.secondary, '#ffffff', 0.12) : kit.secondary,
    socks: kit.pattern === 'plain' || kit.pattern === 'halves' ? kit.primary : kit.secondary === '#ffffff' && lightShirt ? kit.primary : kit.primary,
    boots: '#16181d',
    gloves: o.keeper ? '#f4f6f8' : null,
    pattern: kit.pattern,
    keeper: !!o.keeper,
  }
  const ink = outline !== null ? '#' + outline.toString(16).padStart(6, '0') : 'rgba(8,12,18,0.9)'
  const ow = Math.max(1.6, S * 0.045) * (outline !== null ? 1.8 : 1)
  return makeSheet(scene, key, S, (c, f) => {
    // 1) Silhouette ring: everything grown by the outline, then punched out.
    c.strokeStyle = ink
    c.fillStyle = ink
    for (const p of f.geo.prims) {
      c.strokeStyle = ink
      c.fillStyle = ink
      p.sil(c, ow * 2)
    }
    c.globalCompositeOperation = 'destination-out'
    for (const p of f.geo.prims) {
      c.strokeStyle = '#000'
      c.fillStyle = '#000'
      p.sil(c, 0)
    }
    c.globalCompositeOperation = 'source-over'
    // 2) Kit parts in painter's order.
    for (const p of f.geo.prims) if (p.layer === 'kit') p.paint(c, paint)
  })
}

/** Shared skin sheet (light grey, tinted per player). */
export function figureSkinSheet(scene: Phaser.Scene, S: number): string {
  const dummy: KitPaint = { shirt: '#fff', trim: '#fff', shorts: '#fff', socks: '#fff', boots: '#000', gloves: null, pattern: 'plain', keeper: false }
  return makeSheet(scene, `figskin_${S}`, S, (c, f) => {
    for (const p of f.geo.prims) if (p.layer === 'skin') p.paint(c, dummy)
  })
}

export function figureMeta(S: number, name: string): FigFrameMeta {
  return layout(S).meta.get(name)!
}

/** Shirt-number decal for a kit (white or dark ink to suit the shirt, with a contrasting edge). */
export function figureNumberTexture(scene: Phaser.Scene, kit: KitColors, num: number): string | null {
  if (num <= 0) return null
  const key = `fignum_${kit.primary}_${kit.secondary}_${num}`
  if (scene.textures.exists(key)) return key
  const cv = document.createElement('canvas')
  cv.width = 64
  cv.height = 48
  const c = cv.getContext('2d')
  if (c) {
    const light = luminance(kit.primary) > 0.55
    c.font = `900 40px 'Teko', 'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.lineJoin = 'round'
    c.lineWidth = 6
    c.strokeStyle = light ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.8)'
    c.strokeText(String(num), 32, 26)
    c.fillStyle = light ? '#14161c' : '#ffffff'
    c.fillText(String(num), 32, 26)
  }
  scene.textures.addCanvas(key, cv)
  return key
}

// ───────────────────────── Heads (back / side / front) ─────────────────────────

const SKINS = ['#f1c9a5', '#e0ac7e', '#c68c5c', '#a86b3f', '#7a4a2a', '#56331c']
const HAIRS = ['#1b1209', '#3b2412', '#6b4423', '#a8763e', '#d9b36c', '#222222', '#8c2f12']

/** Skin tone of head variant `idx` (matches {@link figureHeadTexture}). */
export const skinTone = (idx: number): string => SKINS[idx % SKINS.length]!

/**
 * Head with three frames 'b' (back), 's' (side, facing right) and 'f' (front).
 * Hair style varies by index (short crop, buzz, curly top, long tied back for
 * female players).
 */
export function figureHeadTexture(scene: Phaser.Scene, idx: number, female = false): string {
  const v = idx % 42
  const key = `fighead_${female ? 'f' : 'm'}_${v}`
  if (scene.textures.exists(key)) return key
  const size = 48
  const skin = SKINS[idx % SKINS.length]
  const hair = HAIRS[Math.floor(idx / SKINS.length) % HAIRS.length]
  const style = female ? 3 : Math.floor(idx / 7) % 3
  const cv = document.createElement('canvas')
  cv.width = size * 3
  cv.height = size
  const c = cv.getContext('2d')!
  const r = size * 0.34
  const ink = 'rgba(8,12,18,0.9)'
  const views = ['b', 's', 'f'] as const
  views.forEach((view, i) => {
    const cx = i * size + size / 2
    const cy = size / 2 + 2
    c.save()
    c.beginPath()
    c.rect(i * size, 0, size, size)
    c.clip()
    // Ponytail behind (female).
    if (style === 3) {
      c.fillStyle = hair!
      c.strokeStyle = ink
      c.lineWidth = 2
      c.beginPath()
      if (view === 'b') c.ellipse(cx, cy + r * 0.9, r * 0.3, r * 0.62, 0, 0, Math.PI * 2)
      else if (view === 's') c.ellipse(cx - r * 0.95, cy + r * 0.45, r * 0.28, r * 0.6, 0.5, 0, Math.PI * 2)
      if (view !== 'f') {
        c.fill()
        c.stroke()
      }
    }
    // Outline + skull.
    c.fillStyle = ink
    c.beginPath()
    c.arc(cx, cy, r + 1.8, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = skin!
    c.beginPath()
    c.arc(cx, cy, r, 0, Math.PI * 2)
    c.fill()
    c.save()
    c.beginPath()
    c.arc(cx, cy, r, 0, Math.PI * 2)
    c.clip()
    c.fillStyle = hair!
    if (view === 'b') {
      // Back of the head: hair down to the nape.
      c.beginPath()
      c.ellipse(cx, cy - r * (style === 1 ? 0.25 : 0.05), r * 1.1, r * (style === 1 ? 0.9 : 1.05), 0, 0, Math.PI * 2)
      c.fill()
    } else if (view === 's') {
      c.beginPath()
      c.ellipse(cx - r * 0.25, cy - r * 0.42, r * 1.0, r * (style === 2 ? 0.85 : 0.72), -0.2, 0, Math.PI * 2)
      c.fill()
      // Ear.
      c.fillStyle = mixHex(skin!, '#000000', 0.15)
      c.beginPath()
      c.ellipse(cx - r * 0.12, cy + r * 0.12, r * 0.14, r * 0.2, 0, 0, Math.PI * 2)
      c.fill()
      // Eye.
      c.fillStyle = '#15110d'
      c.fillRect(cx + r * 0.55, cy - r * 0.02, Math.max(1.5, r * 0.12), Math.max(1.5, r * 0.14))
    } else {
      c.beginPath()
      c.ellipse(cx, cy - r * 0.62, r * 1.08, r * (style === 2 ? 0.7 : 0.55), 0, 0, Math.PI * 2)
      c.fill()
      if (style === 3) {
        c.beginPath()
        c.ellipse(cx - r * 0.95, cy + r * 0.05, r * 0.26, r * 0.7, 0, 0, Math.PI * 2)
        c.ellipse(cx + r * 0.95, cy + r * 0.05, r * 0.26, r * 0.7, 0, 0, Math.PI * 2)
        c.fill()
      }
      c.fillStyle = '#15110d'
      const ew = Math.max(1.5, r * 0.13)
      c.fillRect(cx - r * 0.38 - ew / 2, cy - r * 0.02, ew, ew * 1.15)
      c.fillRect(cx + r * 0.38 - ew / 2, cy - r * 0.02, ew, ew * 1.15)
    }
    if (style === 2 && view !== 'f') {
      // Curly top texture.
      c.fillStyle = mixHex(hair!, '#ffffff', 0.18)
      for (let k = 0; k < 7; k++) {
        c.beginPath()
        c.arc(cx - r * 0.6 + (k % 4) * r * 0.4, cy - r * (0.7 - Math.floor(k / 4) * 0.35), r * 0.12, 0, Math.PI * 2)
        c.fill()
      }
    }
    // Volume: light from the upper left.
    const g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.45, 1, cx, cy, r * 1.05)
    g.addColorStop(0, 'rgba(255,255,255,0.3)')
    g.addColorStop(0.6, 'rgba(255,255,255,0)')
    g.addColorStop(1, 'rgba(0,0,0,0.32)')
    c.fillStyle = g
    c.fillRect(cx - r, cy - r, r * 2, r * 2)
    c.restore()
    c.restore()
  })
  const tex = scene.textures.addCanvas(key, cv)
  views.forEach((view, i) => tex?.add(view, 0, i * size, 0, size, size))
  return key
}

/** Head diameter drawn on screen (m) and the head texture's skull diameter (px). */
const HEAD_M = 0.4
const HEAD_TEX_D = 48 * 0.68

// ───────────────────────── Direction picking ─────────────────────────

/**
 * Maps a ground-plane facing (screen x right, screen y toward the camera,
 * not foreshortened) to one of the drawn views and a mirror flag. `prev`
 * adds hysteresis so a player running along a sector edge does not flicker.
 */
export function pickDir(gx: number, gy: number, prev: number): { dir: number; flip: boolean; sector: number } {
  const ang = Math.atan2(gy, gx)
  const s = ang / (Math.PI / 4)
  let sector = Math.round(s)
  if (Number.isFinite(prev)) {
    let d = s - prev
    while (d > 4) d -= 8
    while (d < -4) d += 8
    if (Math.abs(d) < 0.62) sector = prev
  }
  sector = ((sector % 8) + 8) % 8
  if (sector > 4) sector -= 8 // -3..4
  const map: Record<number, [number, boolean]> = { [-2]: [0, false], [-1]: [1, false], 0: [2, false], 1: [3, false], 2: [4, false], 3: [3, true], 4: [2, true], [-3]: [1, true] }
  const [dir, flip] = map[sector] ?? [2, false]
  return { dir, flip, sector }
}

/** Screen-space facing (from `pitchDirToScreen`) → ground-plane direction for {@link pickDir}. */
export const groundDir = (sx: number, sy: number): [number, number] => [sx, sy / TILT]

// ───────────────────────── Rig ─────────────────────────

export interface FigureRigOptions {
  kitKey: string
  skinKey: string
  headKey: string
  numKey: string | null
  skin: string
  S: number
  /** Tint applied to the head (training dummies). */
  headTint?: number
}

/**
 * The display objects of one figure: skin, kit, number and head images,
 * added to a container in that order. `set` picks the frame and places the
 * parts; `lift` raises the whole figure (jumps), `rot` rolls it around the
 * hips (cartwheels, flips).
 */
export class FigureRig {
  readonly skin: Phaser.GameObjects.Image
  readonly kit: Phaser.GameObjects.Image
  readonly num: Phaser.GameObjects.Image | null
  readonly head: Phaser.GameObjects.Image
  /** Skin tone (hex) of this figure. */
  readonly skinHex: string
  private S: number
  private k: number
  private sector = Number.NaN
  frame: FigPose = 'idle'
  dir = 2
  flip = false

  constructor(scene: Phaser.Scene, o: FigureRigOptions) {
    this.S = o.S
    this.skinHex = o.skin
    this.k = (PPM * FIG_SCALE) / o.S
    const f0 = frameName('idle', 2)
    this.skin = scene.add.image(0, 0, o.skinKey, f0).setTint(colorNum(mixHex(o.skin, '#ffffff', 0.1)))
    this.kit = scene.add.image(0, 0, o.kitKey, f0)
    this.num = o.numKey ? scene.add.image(0, 0, o.numKey) : null
    this.head = scene.add.image(0, 0, o.headKey, 'f')
    if (o.headTint !== undefined) this.head.setTint(o.headTint)
    for (const im of [this.skin, this.kit]) im.setScale(this.k)
    this.head.setScale((HEAD_M * PPM * FIG_SCALE) / HEAD_TEX_D)
  }

  parts(): Phaser.GameObjects.Image[] {
    return this.num ? [this.skin, this.kit, this.num, this.head] : [this.skin, this.kit, this.head]
  }

  /** Height of the head centre above the ground (world px) for labels / tags. */
  headY(): number {
    return this.head.y
  }

  setVisible(v: boolean): void {
    for (const p of this.parts()) p.setVisible(v)
  }

  /**
   * @param pose frame to show
   * @param gx ground facing x, @param gy ground facing y (see {@link groundDir})
   * @param liftPx raise (world px), @param rot roll around the hips (radians)
   */
  set(pose: FigPose, gx: number, gy: number, liftPx = 0, rot = 0): void {
    const pd = pickDir(gx, gy, this.sector)
    this.sector = pd.sector
    this.dir = pd.dir
    this.flip = pd.flip
    this.frame = pose
    const name = frameName(pose, pd.dir)
    const m = figureMeta(this.S, name)
    const k = this.k
    const fx = pd.flip ? -1 : 1
    const hipX = m.hip.x * k * fx
    const hipY = m.hip.y * k - liftPx
    const cr = Math.cos(rot)
    const sr = Math.sin(rot)
    // Place a figure-space offset (px at sheet scale) rotated around the hip.
    const at = (ox: number, oy: number) => {
      const dx = ox * k * fx - hipX
      const dy = oy * k - liftPx - hipY
      return { x: hipX + dx * cr - dy * sr, y: hipY + dx * sr + dy * cr }
    }
    const g = at(0, 0)
    for (const im of [this.skin, this.kit]) {
      im.setFrame(name, true, true)
      im.setFlipX(pd.flip).setPosition(g.x, g.y).setRotation(rot)
    }
    const h = at(m.head.x, m.head.y)
    this.head.setFrame(pd.dir <= 1 ? 'b' : pd.dir === 2 ? 's' : 'f').setFlipX(pd.flip).setPosition(h.x, h.y).setRotation(rot)
    if (this.num) {
      const n = m.num
      if (!n.show || n.w < 4) this.num.setVisible(false)
      else {
        const p = at(n.x, n.y)
        const back = n.back
        const scale = ((n.w * k) / 64) * (back ? 1.3 : 0.5)
        const side = pd.dir === 2
        this.num
          .setVisible(true)
          .setPosition(p.x + (back ? 0 : n.w * k * 0.16 * (pd.flip ? 1 : -1)), p.y + (back ? 0 : -n.w * k * 0.2))
          .setScale(side ? scale * 0.45 : scale, scale)
          .setRotation(rot)
          .setAlpha(side ? 0.85 : 1)
      }
    }
  }
}
