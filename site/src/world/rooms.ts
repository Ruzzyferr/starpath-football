/**
 * The players' tunnel under the west stand and the home dressing room behind it: lockers with the
 * squad's shirts (the 10 is Arda, the game's default hero), a bench, a tactics board drawn with the
 * Kickborn dots, warm ceiling light. Tunnel: x -34 .. -56 at z 52.5. Room: x -56 .. -70, z 45 .. 60.
 */
import { AdditiveBlending, BoxGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, Sprite, SpriteMaterial, type Scene } from 'three'
import { canvasTexture, FONT, glowTexture } from './textures'

export const ROOM = { x0: -56, x1: -70, z0: 45, z1: 60, h: 3.4 }
export const TUNNEL = { x0: -34, x1: -56, z: 52.5, w: 4.4, h: 3 }

function shirtTexture(num: number, name: string) {
  return canvasTexture(256, 256, (g) => {
    g.fillStyle = '#c8102e'
    g.fillRect(0, 0, 256, 256)
    g.fillStyle = '#a00d24'
    for (let x = 18; x < 256; x += 54) g.fillRect(x, 0, 18, 256)
    g.fillStyle = '#f2f5fa'
    g.textAlign = 'center'
    if (name) {
      g.font = `700 40px ${FONT}`
      g.fillText(name, 128, 62)
    }
    g.font = `700 132px ${FONT}`
    g.fillText(String(num), 128, 196)
  })
}

function tacticsTexture() {
  return canvasTexture(512, 320, (g) => {
    g.fillStyle = '#e9eef5'
    g.fillRect(0, 0, 512, 320)
    g.strokeStyle = '#2f7a3a'
    g.lineWidth = 4
    g.strokeRect(24, 20, 464, 280)
    g.beginPath()
    g.moveTo(256, 20)
    g.lineTo(256, 300)
    g.stroke()
    g.beginPath()
    g.arc(256, 160, 46, 0, Math.PI * 2)
    g.stroke()
    g.strokeRect(24, 90, 60, 140)
    g.strokeRect(428, 90, 60, 140)
    // 4-3-3 in red magnets.
    const pos = [[60, 160], [130, 60], [130, 125], [130, 195], [130, 260], [220, 95], [205, 160], [220, 225], [330, 70], [355, 160], [330, 250]]
    g.fillStyle = '#c8102e'
    for (const [x, y] of pos) {
      g.beginPath()
      g.arc(x!, y!, 13, 0, Math.PI * 2)
      g.fill()
    }
    // The 10's shot drawn as a green streak into the far corner of the goal.
    g.strokeStyle = '#1fd47a'
    g.lineWidth = 7
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(370, 160)
    g.quadraticCurveTo(440, 120, 486, 108)
    g.stroke()
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.arc(486, 108, 9, 0, Math.PI * 2)
    g.fill()
  })
}

export function buildRooms(scene: Scene): void {
  const wall = new MeshLambertMaterial({ color: 0x1b2740, emissive: 0x141a26, side: DoubleSide })
  const floor = new MeshLambertMaterial({ color: 0x10151f, emissive: 0x0a0d14 })
  const ceil = new MeshLambertMaterial({ color: 0x0e1420, side: DoubleSide })
  const lamp = new MeshBasicMaterial({ color: 0xfff1d6 })

  // ── Tunnel: walls, ceiling, light strip, and a canopy at the pitch end.
  const T = TUNNEL
  const tLen = T.x0 - T.x1
  const tx = (T.x0 + T.x1) / 2
  for (const s of [-1, 1]) {
    const w = new Mesh(new PlaneGeometry(tLen, T.h), wall)
    w.position.set(tx, T.h / 2, T.z + (s * T.w) / 2)
    scene.add(w)
  }
  const tc = new Mesh(new PlaneGeometry(tLen, T.w), ceil)
  tc.rotation.x = Math.PI / 2
  tc.position.set(tx, T.h, T.z)
  scene.add(tc)
  const tf = new Mesh(new PlaneGeometry(tLen, T.w), floor)
  tf.rotation.x = -Math.PI / 2
  tf.position.set(tx, 0.01, T.z)
  scene.add(tf)
  for (let x = T.x0 - 2; x > T.x1; x -= 3.2) {
    const l = new Mesh(new PlaneGeometry(1.6, 0.25), lamp)
    l.rotation.x = Math.PI / 2
    l.position.set(x, T.h - 0.02, T.z)
    scene.add(l)
  }
  const canopy = new Mesh(new BoxGeometry(4, 0.3, T.w + 1.2), new MeshLambertMaterial({ color: 0x24324f }))
  canopy.position.set(T.x0 - 1.2, T.h + 0.15, T.z)
  scene.add(canopy)

  // ── Dressing room shell.
  const R = ROOM
  const rw = R.x0 - R.x1
  const rd = R.z1 - R.z0
  const cx = (R.x0 + R.x1) / 2
  const cz = (R.z0 + R.z1) / 2
  const rf = new Mesh(new PlaneGeometry(rw, rd), floor)
  rf.rotation.x = -Math.PI / 2
  rf.position.set(cx, 0.01, cz)
  scene.add(rf)
  const rc = new Mesh(new PlaneGeometry(rw, rd), ceil)
  rc.rotation.x = Math.PI / 2
  rc.position.set(cx, R.h, cz)
  scene.add(rc)
  // Back wall (lockers) and side walls; the front wall has the tunnel door, the north wall the exit.
  const back = new Mesh(new PlaneGeometry(rd, R.h), wall)
  back.rotation.y = Math.PI / 2
  back.position.set(R.x1, R.h / 2, cz)
  scene.add(back)
  const southW = new Mesh(new PlaneGeometry(rw, R.h), wall)
  southW.position.set(cx, R.h / 2, R.z1)
  scene.add(southW)
  const seg = (x0: number, x1: number, z: number, y0 = 0, y1 = R.h) => {
    const m = new Mesh(new PlaneGeometry(Math.abs(x1 - x0), y1 - y0), wall)
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z)
    scene.add(m)
  }
  // North wall with an exit door at x -60.4 .. -62.2.
  seg(R.x0, -60.4, R.z0)
  seg(-62.2, R.x1, R.z0)
  seg(-60.4, -62.2, R.z0, 2.5, R.h)
  // Front wall (x = -56) with the tunnel opening.
  const front = (z0: number, z1: number, y0 = 0, y1 = R.h) => {
    const m = new Mesh(new PlaneGeometry(Math.abs(z1 - z0), y1 - y0), wall)
    m.rotation.y = Math.PI / 2
    m.position.set(R.x0, (y0 + y1) / 2, (z0 + z1) / 2)
    scene.add(m)
  }
  front(R.z0, T.z - T.w / 2)
  front(T.z + T.w / 2, R.z1)
  front(T.z - T.w / 2, T.z + T.w / 2, T.h, R.h)
  // Ceiling light panels.
  for (let x = R.x0 - 2.5; x > R.x1 + 1; x -= 4) for (const z of [cz - 4, cz + 4]) {
    const l = new Mesh(new PlaneGeometry(2.4, 0.5), lamp)
    l.rotation.x = Math.PI / 2
    l.position.set(x, R.h - 0.02, z)
    scene.add(l)
  }
  const glow = new SpriteMaterial({ map: glowTexture(), color: 0xffd9a0, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false })
  for (const z of [cz - 4, cz + 4]) {
    const s = new Sprite(glow)
    s.position.set(cx, R.h - 0.4, z)
    s.scale.setScalar(3.5)
    scene.add(s)
  }

  // Lockers along the back wall, a shirt hanging in each.
  const lockerMat = new MeshLambertMaterial({ color: 0x24324f, emissive: 0x0d1424 })
  const trimMat = new MeshLambertMaterial({ color: 0xc8102e, emissive: 0x2a0308 })
  const nums = [1, 4, 5, 6, 10, 7, 8, 9, 11]
  const lockers = new Group()
  scene.add(lockers)
  nums.forEach((n, i) => {
    const z = R.z0 + 1.1 + i * 1.53
    const box = new Mesh(new BoxGeometry(0.6, 2.3, 1.4), lockerMat)
    box.position.set(R.x1 + 0.32, 1.15, z)
    lockers.add(box)
    const trim = new Mesh(new BoxGeometry(0.62, 0.08, 1.42), trimMat)
    trim.position.set(R.x1 + 0.32, 2.34, z)
    lockers.add(trim)
    const shirt = new Group()
    shirt.position.set(R.x1 + 0.68, 1.55, z)
    shirt.rotation.y = Math.PI / 2
    const front = new MeshBasicMaterial({ map: shirtTexture(n, n === 10 ? 'ARDA' : '') , color: n === 10 ? 0xffffff : 0xb9b9b9 })
    const body = new Mesh(new BoxGeometry(0.62, 0.78, 0.05), [trimMat, trimMat, trimMat, trimMat, front, trimMat])
    shirt.add(body)
    for (const s of [-1, 1]) {
      const sleeve = new Mesh(new BoxGeometry(0.24, 0.22, 0.05), trimMat)
      sleeve.position.set(s * 0.4, 0.26, 0)
      sleeve.rotation.z = s * -0.5
      shirt.add(sleeve)
    }
    lockers.add(shirt)
  })
  // Spot glow above the 10.
  const spot = new Sprite(new SpriteMaterial({ map: glowTexture(), color: 0xffe6b0, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false }))
  spot.position.set(R.x1 + 0.8, 2.6, R.z0 + 1.1 + 4 * 1.53)
  spot.scale.setScalar(1.4)
  scene.add(spot)
  // Bench.
  const bench = new Mesh(new BoxGeometry(0.5, 0.45, rd - 2), new MeshLambertMaterial({ color: 0x5a3b22, emissive: 0x1a0f06 }))
  bench.position.set(R.x1 + 1.6, 0.225, cz)
  scene.add(bench)
  // Tactics board on the south wall.
  const tb = new Mesh(new PlaneGeometry(3.2, 2), new MeshBasicMaterial({ map: tacticsTexture(), color: 0xd8dde6 }))
  tb.position.set(cx - 1.2, 1.7, R.z1 - 0.03)
  tb.rotation.y = Math.PI
  scene.add(tb)
}
