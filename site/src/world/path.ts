/**
 * One continuous camera path through the world. Each page section is anchored to a stop; between two
 * stops the camera runs along a Catmull-Rom curve through hand-placed waypoints, and its view
 * direction turns by spherical interpolation (so a 180° turn never swings through the camera), or
 * follows the path in the middle of a leg (`follow`) where the camera travels through tight spaces.
 */
import { CatmullRomCurve3, MathUtils, Quaternion, Vector3 } from 'three'
import { GOAL_HALF_W, SPOT_Z } from '../penalty'

export interface Stop {
  id: string
  pos: Vector3
  look: Vector3
  /** Vertical field of view at 16:9. */
  fov: number
  /** Depth-of-field focus distance (m). */
  focus: number
  /** Where to look on a portrait screen, when the landscape framing would lose the subject. */
  lookPortrait?: Vector3
  /** Where to look on a very wide, short screen (a phone on its side). */
  lookWide?: Vector3
  /** Waypoints on the leg from this stop to the next. */
  via?: Vector3[]
  follow?: boolean
}

const v = (x: number, y: number, z: number) => new Vector3(x, y, z)

export const STOPS: Stop[] = [
  { id: 'top', pos: v(0, 44, 205), look: v(-8, 40, -100), lookPortrait: v(146, 66, -100), lookWide: v(-52, 34, -100), fov: 52, focus: 160, via: [v(0, 34, 160), v(0, 23, 122), v(0, 10, 72), v(0, 4.2, 34)] },
  { id: 'penalti', pos: v(1.5, 2.3, SPOT_Z + 5.6), look: v(0, 0.75, 0), fov: 40, focus: 15, via: [v(5, 3.2, 26), v(-4, 4.4, 44)] },
  { id: 'anlar', pos: v(-16, 3.6, 60), look: v(52, 19, 47), fov: 50, focus: 70, via: [v(-24, 2.4, 55), v(-31, 1.75, 52.5), v(-44, 1.75, 52.5), v(-53, 1.7, 52.5)], follow: true },
  { id: 'kariyer', pos: v(-62.6, 1.7, 52.5), look: v(-70, 1.45, 52.5), fov: 56, focus: 7, via: [v(-61.3, 1.7, 48.5), v(-61.3, 1.9, 43), v(-64, 4, 37), v(-80, 14, 34)], follow: true },
  { id: 'hayat', pos: v(-92, 40, 30), look: v(-360, 34, 70), fov: 50, focus: 260, via: [v(-150, 44, 72), v(-212, 72, 112)] },
  { id: 'adil', pos: v(-205, 118, 150), look: v(0, 6, 52), fov: 42, focus: 230, via: [v(-170, 118, 182)] },
  { id: 'platformlar', pos: v(-70, 128, 205), look: v(0, 0, 52), fov: 46, focus: 200, via: [v(-10, 120, 150), v(40, 100, 90)] },
  { id: 'foot', pos: v(116, 84, 46), look: v(174, 92, -150), lookPortrait: v(180, 96, -150), fov: 50, focus: 210 },
]

export interface CameraState {
  pos: Vector3
  look: Vector3
  fov: number
  focus: number
}

const curves = new Map<number, CatmullRomCurve3>()
function curve(i: number): CatmullRomCurve3 {
  let c = curves.get(i)
  if (!c) {
    const a = STOPS[i]!
    const b = STOPS[i + 1]!
    c = new CatmullRomCurve3([a.pos, ...(a.via ?? []), b.pos], false, 'centripetal', 0.5)
    curves.set(i, c)
  }
  return c
}

/** Field of view adjusted for the screen's shape (portrait screens widen it). */
export function fovFor(stop: Stop, aspect: number): number {
  if (stop.id === 'penalti') {
    // Fit the goal's width plus a margin, whatever the screen.
    const dist = SPOT_Z + 5.6
    const hfov = 2 * Math.atan((GOAL_HALF_W + 1.4) / dist)
    const vfov = MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / aspect))
    return MathUtils.clamp(vfov, stop.fov, 74)
  }
  if (aspect >= 16 / 9) return stop.fov
  const k = Math.sqrt(16 / 9 / aspect)
  return MathUtils.clamp(MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(stop.fov) / 2) * k)), stop.fov, 82)
}

function lookFor(s: Stop, aspect: number): Vector3 {
  if (s.lookWide && aspect > 1.85) return s.look.clone().lerp(s.lookWide, MathUtils.clamp((aspect - 1.85) / 0.3, 0, 1))
  if (!s.lookPortrait || aspect >= 1.2) return s.look.clone()
  return s.look.clone().lerp(s.lookPortrait, MathUtils.clamp((1.2 - aspect) / 0.7, 0, 1))
}

const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
const q0 = new Quaternion()
const q1 = new Quaternion()
const fwd = new Vector3(0, 0, -1)

function dirQuat(from: Vector3, to: Vector3, out: Quaternion): Quaternion {
  return out.setFromUnitVectors(fwd, to.clone().sub(from).normalize())
}

/** Camera state at leg `i` (from stop i to i+1), `t` 0..1. */
export function sample(i: number, t: number, aspect: number): CameraState {
  if (!Number.isFinite(i)) i = 0
  if (!Number.isFinite(t)) t = 0
  i = Math.max(0, Math.min(STOPS.length - 1, Math.floor(i)))
  const a = STOPS[i]!
  if (i >= STOPS.length - 1 || t <= 0) return { pos: a.pos.clone(), look: lookFor(a, aspect), fov: fovFor(a, aspect), focus: a.focus }
  const b = STOPS[i + 1]!
  const e = smooth(MathUtils.clamp(t, 0, 1))
  const c = curve(i)
  const pos = c.getPointAt(e)
  dirQuat(a.pos, lookFor(a, aspect), q0)
  dirQuat(b.pos, lookFor(b, aspect), q1)
  const q = q0.clone().slerp(q1, e)
  if (a.follow) {
    // In the middle of the leg look where we are going.
    const w = Math.sin(Math.PI * MathUtils.clamp((e - 0.08) / 0.84, 0, 1))
    const tangent = c.getTangentAt(Math.min(0.999, e + 0.02))
    const qt = new Quaternion().setFromUnitVectors(fwd, tangent.setY(tangent.y * 0.3).normalize())
    q.slerp(qt, w)
  }
  const look = pos.clone().add(fwd.clone().applyQuaternion(q).multiplyScalar(20))
  return { pos, look, fov: MathUtils.lerp(fovFor(a, aspect), fovFor(b, aspect), e), focus: MathUtils.lerp(a.focus, b.focus, e) }
}
