/**
 * Stylised low-poly footballers: a jointed rig (hips, spine, head, arms with elbows, legs with knees,
 * boots) in flat-shaded kit colours, with procedural poses: shooter idle, run-up and strike; keeper
 * ready stance and dives. Forward is -z (towards the north goal).
 */
import { BoxGeometry, CylinderGeometry, Group, IcosahedronGeometry, Mesh, MeshLambertMaterial, SphereGeometry, type Object3D } from 'three'

export interface Kit {
  shirt: number
  sleeve?: number
  shorts: number
  socks: number
  boots: number
  skin: number
  hair: number
  gloves?: number
}

const mats = new Map<number, MeshLambertMaterial>()
const mat = (c: number) => {
  let m = mats.get(c)
  if (!m) {
    m = new MeshLambertMaterial({ color: c, flatShading: true })
    mats.set(c, m)
  }
  return m
}

export interface Rig {
  root: Group
  hips: Group
  spine: Group
  head: Group
  armL: Group
  armR: Group
  elbowL: Group
  elbowR: Group
  legL: Group
  legR: Group
  kneeL: Group
  kneeR: Group
}

function limb(parent: Object3D, r0: number, r1: number, len: number, color: number): Mesh {
  const m = new Mesh(new CylinderGeometry(r0, r1, len, 7, 1), mat(color))
  m.position.y = -len / 2
  parent.add(m)
  return m
}

export function buildPlayer(kit: Kit, keeper = false): Rig {
  const root = new Group()
  const hips = new Group()
  hips.position.y = 0.93
  root.add(hips)
  // Shorts.
  const pelvis = new Mesh(new BoxGeometry(0.34, 0.2, 0.22), mat(kit.shorts))
  pelvis.position.y = -0.02
  hips.add(pelvis)

  const spine = new Group()
  spine.position.y = 0.08
  hips.add(spine)
  const torso = new Mesh(new CylinderGeometry(0.21, 0.16, 0.52, 7, 1), mat(kit.shirt))
  torso.scale.z = 0.62
  torso.position.y = 0.26
  spine.add(torso)
  const neck = new Mesh(new CylinderGeometry(0.05, 0.055, 0.08, 6), mat(kit.skin))
  neck.position.y = 0.56
  spine.add(neck)
  const head = new Group()
  head.position.y = 0.66
  spine.add(head)
  const skull = new Mesh(new IcosahedronGeometry(0.115, 1), mat(kit.skin))
  skull.scale.set(0.92, 1.05, 1)
  head.add(skull)
  const hair = new Mesh(new SphereGeometry(0.122, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.52), mat(kit.hair))
  hair.position.set(0, 0.02, 0.012)
  head.add(hair)

  const arm = (side: number) => {
    const shoulder = new Group()
    shoulder.position.set(side * 0.235, 0.48, 0)
    spine.add(shoulder)
    limb(shoulder, 0.058, 0.05, 0.27, keeper ? kit.shirt : (kit.sleeve ?? kit.shirt))
    const elbow = new Group()
    elbow.position.y = -0.27
    shoulder.add(elbow)
    limb(elbow, 0.046, 0.04, 0.25, keeper ? kit.shirt : kit.skin)
    const hand = new Mesh(new IcosahedronGeometry(keeper ? 0.065 : 0.045, 0), mat(keeper ? (kit.gloves ?? 0xf2f5fa) : kit.skin))
    hand.position.y = -0.29
    elbow.add(hand)
    return { shoulder, elbow }
  }
  const L = arm(-1)
  const R = arm(1)

  const leg = (side: number) => {
    const hip = new Group()
    hip.position.set(side * 0.1, -0.06, 0)
    hips.add(hip)
    const shortLeg = new Mesh(new CylinderGeometry(0.088, 0.082, 0.17, 7), mat(kit.shorts))
    shortLeg.position.y = -0.07
    hip.add(shortLeg)
    limb(hip, 0.072, 0.058, 0.42, kit.skin).position.y = -0.24
    const knee = new Group()
    knee.position.y = -0.43
    hip.add(knee)
    limb(knee, 0.058, 0.046, 0.4, kit.socks)
    const boot = new Mesh(new BoxGeometry(0.095, 0.075, 0.24), mat(kit.boots))
    boot.position.set(0, -0.42, -0.05)
    knee.add(boot)
    return { hip, knee }
  }
  const LL = leg(-1)
  const RL = leg(1)
  return { root, hips, spine, head, armL: L.shoulder, armR: R.shoulder, elbowL: L.elbow, elbowR: R.elbow, legL: LL.hip, legR: RL.hip, kneeL: LL.knee, kneeR: RL.knee }
}

const ease = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

function reset(r: Rig): void {
  for (const g of [r.hips, r.spine, r.head, r.armL, r.armR, r.elbowL, r.elbowR, r.legL, r.legR, r.kneeL, r.kneeR]) g.rotation.set(0, 0, 0)
  r.hips.position.y = 0.93
}

/** Shooter waiting behind the ball: breathing, weight on the back foot, arms loose. */
export function poseShooterIdle(r: Rig, t: number): void {
  reset(r)
  const b = Math.sin(t * 1.6)
  r.spine.rotation.x = 0.06 + b * 0.015
  r.hips.position.y = 0.92 + b * 0.006
  r.armL.rotation.z = -0.18
  r.armR.rotation.z = 0.18
  r.armL.rotation.x = 0.05 + b * 0.03
  r.armR.rotation.x = -0.05 - b * 0.03
  r.elbowL.rotation.x = -0.2
  r.elbowR.rotation.x = -0.2
  r.legL.rotation.x = -0.08
  r.legR.rotation.x = 0.12
  r.kneeR.rotation.x = 0.1
  r.head.rotation.x = -0.05
}

/**
 * Run-up and strike with the right foot. `u` 0..1 over the whole move; contact at KICK_CONTACT_U.
 * Returns the forward distance travelled (m) so the root can be moved.
 */
export const KICK_CONTACT_U = 0.72
export function poseShooterKick(r: Rig, u: number): number {
  reset(r)
  const run = clamp01(u / 0.6)
  // Two strides: alternating legs and arms.
  if (u < 0.6) {
    const s = Math.sin(run * Math.PI * 2)
    r.legL.rotation.x = s * 0.6
    r.legR.rotation.x = -s * 0.6
    r.kneeL.rotation.x = Math.max(0, -s) * 0.9 + 0.1
    r.kneeR.rotation.x = Math.max(0, s) * 0.9 + 0.1
    r.armL.rotation.x = -s * 0.5
    r.armR.rotation.x = s * 0.5
    r.spine.rotation.x = 0.15
    r.hips.position.y = 0.92 - Math.abs(s) * 0.03
  } else {
    // Plant the left foot, draw the right leg back, strike through, follow through.
    const k = clamp01((u - 0.6) / 0.4)
    const back = k < 0.3 ? ease(k / 0.3) : 1 - ease(clamp01((k - 0.3) / 0.7))
    const through = k < 0.3 ? 0 : ease(clamp01((k - 0.3) / 0.7))
    r.legL.rotation.x = -0.15
    r.kneeL.rotation.x = 0.35
    r.legR.rotation.x = back * 0.9 - through * 1.25
    r.kneeR.rotation.x = back * 1.5 + (1 - through) * 0.1
    r.spine.rotation.x = 0.1 - through * 0.12
    r.spine.rotation.y = -0.25 * through
    r.armL.rotation.z = -0.9
    r.armR.rotation.z = 0.6
    r.armL.rotation.x = -0.4 * through
    r.hips.position.y = 0.88
  }
  return ease(run) * 1.15
}

/** Keeper on the line: knees bent, weight forward, hands out, bouncing on the toes. */
export function poseKeeperReady(r: Rig, t: number, still = false): void {
  reset(r)
  const b = still ? 0 : Math.abs(Math.sin(t * 4))
  r.hips.position.y = 0.8 + b * 0.04
  r.spine.rotation.x = 0.32
  r.head.rotation.x = -0.25
  r.legL.rotation.x = -0.45
  r.legR.rotation.x = -0.45
  r.legL.rotation.z = -0.12
  r.legR.rotation.z = 0.12
  r.kneeL.rotation.x = 0.75
  r.kneeR.rotation.x = 0.75
  r.armL.rotation.set(-0.5, 0, -0.75)
  r.armR.rotation.set(-0.5, 0, 0.75)
  r.elbowL.rotation.x = -0.6
  r.elbowR.rotation.x = -0.6
}

/** A dive towards `side` (-1 left, 1 right as seen by the shooter), `e` 0..1, `high` 0 low .. 1 high. */
export function poseKeeperDive(r: Rig, side: number, e: number, high: number): void {
  poseKeeperReady(r, 0, true)
  const s = side || 1
  // Body stretches out sideways; arms reach past the head.
  r.spine.rotation.x = 0.1 * (1 - e)
  r.legL.rotation.x = -0.1
  r.legR.rotation.x = -0.1
  r.kneeL.rotation.x = 0.3 * (1 - e)
  r.kneeR.rotation.x = 0.3 * (1 - e)
  r.legL.rotation.z = s > 0 ? -0.25 * e : 0.05
  r.legR.rotation.z = s < 0 ? 0.25 * e : -0.05
  const up = 2.6 + high * 0.5
  r.armL.rotation.set(-0.2 * (1 - e), 0, -0.75 - (up - 0.75) * e)
  r.armR.rotation.set(-0.2 * (1 - e), 0, 0.75 + (up - 0.75) * e)
  r.elbowL.rotation.x = -0.6 * (1 - e)
  r.elbowR.rotation.x = -0.6 * (1 - e)
  r.head.rotation.z = s * 0.3 * e
}

export const HERO_KIT: Kit = { shirt: 0xc8102e, sleeve: 0xf2f5fa, shorts: 0xf2f5fa, socks: 0xc8102e, boots: 0x111827, skin: 0xb98060, hair: 0x2a1a12 }
export const KEEPER_KIT: Kit = { shirt: 0xe8579a, shorts: 0x111827, socks: 0xe8579a, boots: 0x111827, skin: 0xd7a07a, hair: 0x1a1410, gloves: 0x1fd47a }
