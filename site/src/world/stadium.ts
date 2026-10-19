/**
 * The stadium at night: pitch, goals and nets, four stands with a sprite crowd and camera flashes,
 * cantilever roofs with lit fascias, lattice floodlight towers with light cones and haze, LED boards,
 * the video board, and a vomitory gap in the west stand for the players' tunnel.
 * Pitch: x ±34, z 0 (north goal line) .. 105 (south goal line).
 */
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  RepeatWrapping,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Scene,
  type Texture,
} from 'three'
import { GOAL_H, GOAL_HALF_W, SPOT_Z } from '../penalty'
import { canvasTexture, fanTexture, FONT, glowTexture, hazeTexture, hex } from './textures'

export const PITCH = { halfW: 34, length: 105 }
const C = { pitchA: 0x1d5a26, pitchB: 0x195022, stand: 0x0c1322, standEdge: 0x152036, roof: 0x0a0f1a }

export interface StadiumOptions {
  lowPower: boolean
}

export interface Stadium {
  update(t: number, dt: number, cameraY: number): void
  dentNet(x: number, y: number): void
  /** Scoreboard text, e.g. after a kick. */
  setScore(goals: number, kicks: number): void
}

function pitchTexture(px: number, maxAniso: number): Texture {
  // Canvas covers x -40..40, z -6..111.
  const W = 80
  const L = 117
  const t = canvasTexture(W * px, L * px, (g) => {
    g.fillStyle = hex(C.pitchA)
    g.fillRect(0, 0, W * px, L * px)
    for (let i = 0; i < 20; i++) {
      if (i % 2) continue
      g.fillStyle = hex(C.pitchB)
      g.fillRect(0, (6 + i * 5.25) * px, W * px, 5.25 * px)
    }
    const img = g.getImageData(0, 0, W * px, L * px)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 9
      d[i] = d[i]! + n
      d[i + 1] = d[i + 1]! + n
      d[i + 2] = d[i + 2]! + n
    }
    g.putImageData(img, 0, 0)
    const X = (x: number) => (x + 40) * px
    const Z = (z: number) => (z + 6) * px
    g.strokeStyle = 'rgba(242,245,250,0.9)'
    g.fillStyle = 'rgba(242,245,250,0.95)'
    g.lineWidth = Math.max(2, 0.12 * px)
    const rect = (x0: number, z0: number, x1: number, z1: number) => g.strokeRect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0))
    rect(-34, 0, 34, 105)
    g.beginPath()
    g.moveTo(X(-34), Z(52.5))
    g.lineTo(X(34), Z(52.5))
    g.stroke()
    for (const [z0, dir] of [[0, 1], [105, -1]] as const) {
      rect(-20.16, z0, 20.16, z0 + dir * 16.5)
      rect(-9.16, z0, 9.16, z0 + dir * 5.5)
      const spot = z0 + dir * SPOT_Z
      g.beginPath()
      g.arc(X(0), Z(spot), 0.2 * px, 0, Math.PI * 2)
      g.fill()
      const a = Math.acos(5.5 / 9.15)
      g.beginPath()
      if (dir > 0) g.arc(X(0), Z(spot), 9.15 * px, Math.PI / 2 - a, Math.PI / 2 + a)
      else g.arc(X(0), Z(spot), 9.15 * px, -Math.PI / 2 - a, -Math.PI / 2 + a)
      g.stroke()
    }
    g.beginPath()
    g.arc(X(0), Z(52.5), 9.15 * px, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.arc(X(0), Z(52.5), 0.2 * px, 0, Math.PI * 2)
    g.fill()
  })
  t.anisotropy = maxAniso
  return t
}

function boardTexture(names: string[]): Texture {
  const cols = ['#1f6fc0', '#d99a0b', '#0e9f57', '#0b1220', '#c22a3a', '#5a6f99']
  return canvasTexture(2048, 64, (g) => {
    const w = 2048 / names.length
    names.forEach((n, i) => {
      g.fillStyle = cols[i % cols.length]!
      g.fillRect(i * w, 0, w, 64)
      g.fillStyle = n === 'KICKBORN' ? '#1fd47a' : 'rgba(242,245,250,0.92)'
      g.font = `700 40px ${FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(n, i * w + w / 2, 34)
    })
  })
}

/** Light cone: bright at the lamp, fading towards the pitch and at grazing angles. */
function coneMaterial(intensity: number): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms: { uColor: { value: new Color(0xfff1d2) }, uIntensity: { value: intensity } },
    vertexShader: /* glsl */ `
      varying float vH; varying vec3 vN; varying vec3 vV;
      void main() {
        vH = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uIntensity;
      varying float vH; varying vec3 vN; varying vec3 vV;
      void main() {
        float facing = pow(abs(dot(vN, vV)), 2.2);
        float a = uIntensity * pow(vH, 1.6) * facing;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  })
}

function hazeMaterial(tex: Texture, opacity: number): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { tMap: { value: tex }, uTime: { value: 0 }, uOpacity: { value: opacity }, uFade: { value: 1 }, uColor: { value: new Color(0xbfd0ff) } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tMap; uniform float uTime; uniform float uOpacity; uniform float uFade; uniform vec3 uColor; varying vec2 vUv;
      void main() {
        float n = texture2D(tMap, vUv * 1.6 + vec2(uTime * 0.004, uTime * 0.0025)).r;
        n += texture2D(tMap, vUv * 2.7 - vec2(uTime * 0.003, 0.0)).r * 0.6;
        float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
        float a = n * uOpacity * edge * uFade;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  })
}

export function buildStadium(scene: Scene, opts: StadiumOptions, maxAniso: number): Stadium {
  const low = opts.lowPower
  const updates: ((t: number, dt: number) => void)[] = []

  // ── Pitch and surround.
  const pitch = new Mesh(new PlaneGeometry(80, 117), new MeshLambertMaterial({ map: pitchTexture(low ? 14 : 22, Math.min(8, maxAniso)) }))
  pitch.rotation.x = -Math.PI / 2
  pitch.position.set(0, 0, 52.5)
  scene.add(pitch)
  const apron = new Mesh(new PlaneGeometry(130, 160), new MeshLambertMaterial({ color: 0x10301a }))
  apron.rotation.x = -Math.PI / 2
  apron.position.set(0, -0.02, 52.5)
  scene.add(apron)

  // ── Goals.
  const white = new MeshLambertMaterial({ color: 0xffffff, emissive: 0x444444 })
  const goal = (z: number, dir: number) => {
    const g = new Group()
    const post = new CylinderGeometry(0.06, 0.06, GOAL_H + 0.06, 12)
    for (const s of [-1, 1]) {
      const p = new Mesh(post, white)
      p.position.set(s * GOAL_HALF_W, (GOAL_H + 0.06) / 2, 0)
      g.add(p)
    }
    const bar = new Mesh(new CylinderGeometry(0.06, 0.06, GOAL_HALF_W * 2 + 0.12, 12), white)
    bar.rotation.z = Math.PI / 2
    bar.position.y = GOAL_H
    g.add(bar)
    g.position.z = z
    if (dir < 0) g.rotation.y = Math.PI
    scene.add(g)
  }
  goal(0, 1)
  goal(105, -1)

  // Net of the north goal (the one we shoot at) as a dentable grid.
  const nx = 30
  const ny = 10
  const pts: number[] = []
  const seg = (a: number[], b: number[]) => pts.push(...a, ...b)
  const node = (i: number, j: number) => [-GOAL_HALF_W + (i / nx) * GOAL_HALF_W * 2, (j / ny) * GOAL_H, -2 + (j / ny)]
  for (let i = 0; i <= nx; i++) for (let j = 0; j < ny; j++) seg(node(i, j), node(i, j + 1))
  for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) seg(node(i, j), node(i + 1, j))
  const backN = pts.length / 3
  for (let i = 0; i <= nx; i++) {
    const x = -GOAL_HALF_W + (i / nx) * GOAL_HALF_W * 2
    seg([x, GOAL_H, 0], [x, GOAL_H, -1])
  }
  for (const s of [-1, 1]) for (let j = 0; j <= ny; j++) {
    const y = (j / ny) * GOAL_H
    seg([s * GOAL_HALF_W, y, 0], [s * GOAL_HALF_W, y, -2 + j / ny])
  }
  const netGeo = new BufferGeometry()
  netGeo.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3))
  const net = new LineSegments(netGeo, new LineBasicMaterial({ color: 0xe6ecf5, transparent: true, opacity: 0.6 }))
  scene.add(net)
  const netBase = Float32Array.from(pts)
  const south = net.clone()
  south.rotation.y = Math.PI
  south.position.z = 105
  scene.add(south)
  let dent: { x: number; y: number; t: number } | null = null
  updates.push((_t, dt) => {
    if (!dent) return
    dent.t += dt
    const s = dent.t < 0.15 ? dent.t / 0.15 : Math.max(0, 1 - (dent.t - 0.15) / 1.2)
    const arr = (netGeo.getAttribute('position') as BufferAttribute).array as Float32Array
    for (let i = 0; i < backN; i++) {
      const d2 = (netBase[i * 3]! - dent.x) ** 2 + (netBase[i * 3 + 1]! - dent.y) ** 2
      arr[i * 3 + 2] = netBase[i * 3 + 2]! - Math.exp(-d2 / 0.9) * 0.7 * s
    }
    netGeo.getAttribute('position').needsUpdate = true
    if (s <= 0 && dent.t > 0.2) dent = null
  })

  // ── Stands, crowd, roofs.
  const standMat = new MeshLambertMaterial({ color: C.stand })
  const facadeTex = canvasTexture(256, 128, (g) => {
    g.fillStyle = '#0c1322'
    g.fillRect(0, 0, 256, 128)
    g.fillStyle = '#ffe1a8'
    g.fillRect(0, 40, 256, 5)
    g.fillRect(0, 92, 256, 4)
    g.fillStyle = '#9fb3d9'
    for (let x = 0; x < 256; x += 32) {
      g.globalAlpha = 0.5
      g.fillRect(x + 6, 50, 18, 30)
    }
    g.globalAlpha = 1
    g.fillStyle = '#05080f'
    for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 4, 128)
  })
  facadeTex.wrapS = RepeatWrapping
  const facadeMat = (w: number) => {
    const t = facadeTex.clone()
    t.needsUpdate = true
    t.repeat.set(w / 16, 1)
    return new MeshLambertMaterial({ color: 0x0c1322, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.7 })
  }
  const edgeMat = new MeshLambertMaterial({ color: C.standEdge })
  const roofMat = new MeshLambertMaterial({ color: C.roof })
  const fasciaMat = new MeshBasicMaterial({ color: 0x45587a })
  const fanMats: Matrix4[] = []
  const fanCols: Color[] = []
  const navy = new Color(0x1b2740)
  const palette = [0xc8102e, 0xc8102e, 0xc8102e, 0x8a96ad, 0x1d4ed8, 0x0b1b44, 0xd9a93a, 0x2a3a5c, 0x6b7a99]
  const density = low ? 0.4 : 0.85
  const tiers = 16
  const up = new Vector3(0, 1, 0)
  const m4 = new Matrix4()
  const q = new Quaternion()
  /** A stand: front edge centred at (cx, cz), `len` long, facing the pitch along `face` (unit, horizontal). */
  const stand = (cx: number, cz: number, len: number, rot: number, gap?: [number, number]) => {
    const g = new Group()
    g.position.set(cx, 0, cz)
    g.rotation.y = rot
    scene.add(g)
    const blocks: [number, number][] = gap ? [[-len / 2, gap[0]], [gap[1], len / 2]] : [[-len / 2, len / 2]]
    for (const [a, b] of blocks) {
      const w = b - a
      const mid = (a + b) / 2
      for (let r = 0; r < tiers; r++) {
        const y = 0.9 + r * 0.72
        const step = new Mesh(new BoxGeometry(w, 0.72, 0.95), r % 5 === 4 ? edgeMat : standMat)
        step.position.set(mid, y, r * 0.92)
        g.add(step)
        const n = Math.floor((w / 0.62) * density)
        for (let k = 0; k < n; k++) {
          if (Math.random() < 0.12) continue
          const local = new Vector3(a + (k + 0.5 + (Math.random() - 0.5) * 0.4) * (w / n), y + 0.62, r * 0.92 - 0.15)
          const world = local.applyAxisAngle(up, rot).add(new Vector3(cx, 0, cz))
          q.setFromAxisAngle(up, rot + Math.PI)
          const s = 0.9 + Math.random() * 0.25
          m4.compose(world, q, new Vector3(s, s, s))
          fanMats.push(m4.clone())
          const base = new Color(palette[(Math.random() * palette.length) | 0]!).lerp(navy, 0.45)
          fanCols.push(base.multiplyScalar(0.12 + Math.random() * 0.1))
        }
      }
      // Back wall and the void under the tiers.
      const back = new Mesh(new BoxGeometry(w, 14, 1), facadeMat(w))
      back.position.set(mid, 7, tiers * 0.92 + 0.3)
      g.add(back)
      // Roof: slab and a lit fascia along its front edge.
      const depth = tiers * 0.92 + 6
      const roof = new Mesh(new BoxGeometry(w + 2, 0.5, depth), roofMat)
      roof.position.set(mid, 18.5, depth / 2 - 4)
      roof.rotation.x = -0.05
      g.add(roof)
      const fascia = new Mesh(new BoxGeometry(w + 2, 0.18, 0.08), fasciaMat)
      fascia.position.set(mid, 18.1, -4.05)
      g.add(fascia)
      // Trusses.
      for (let x = a + 4; x < b; x += 9) {
        const truss = new Mesh(new BoxGeometry(0.25, 0.25, depth), roofMat)
        truss.position.set(x, 19, depth / 2 - 4)
        g.add(truss)
      }
    }
  }
  // Facing: rot = angle that turns local +z (rows going back) away from the pitch.
  stand(0, -9, 92, Math.PI) // north, rows go to -z
  stand(0, 114, 92, 0) // south
  stand(43, 52.5, 112, Math.PI / 2) // east
  stand(-43, 52.5, 112, -Math.PI / 2, [-3, 3]) // west, with the tunnel vomitory

  const fanGeo = new PlaneGeometry(0.5, 0.75)
  fanGeo.translate(0, 0.37, 0)
  const fanMat = new MeshBasicMaterial({ map: fanTexture(), alphaTest: 0.5, transparent: false, side: DoubleSide })
  const crowdTime = { value: 0 }
  fanMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = crowdTime
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float ph = float(gl_InstanceID) * 1.731;
       transformed.y += max(0.0, sin(uTime * (1.5 + mod(ph, 1.3)) + ph)) * 0.05;`,
    )
  }
  const crowd = new InstancedMesh(fanGeo, fanMat, fanMats.length)
  fanMats.forEach((mm, i) => {
    crowd.setMatrixAt(i, mm)
    crowd.setColorAt(i, fanCols[i]!)
  })
  scene.add(crowd)
  updates.push((t) => {
    crowdTime.value = t
  })

  // Camera flashes: a few points in the stands that blink.
  const flashN = low ? 24 : 60
  const fpos = new Float32Array(flashN * 3)
  const fcol = new Float32Array(flashN * 3)
  for (let i = 0; i < flashN; i++) {
    const m = fanMats[(Math.random() * fanMats.length) | 0]!
    const p = new Vector3().setFromMatrixPosition(m)
    fpos.set([p.x, p.y + 0.7, p.z], i * 3)
  }
  const fgeo = new BufferGeometry()
  fgeo.setAttribute('position', new BufferAttribute(fpos, 3))
  fgeo.setAttribute('color', new BufferAttribute(fcol, 3))
  const flashes = new Points(fgeo, new PointsMaterial({ size: 2.2, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true }))
  scene.add(flashes)
  const flashT = new Float32Array(flashN).map(() => Math.random() * 6)
  updates.push((_t, dt) => {
    for (let i = 0; i < flashN; i++) {
      flashT[i]! -= dt
      let v = 0
      if (flashT[i]! < 0.08 && flashT[i]! > 0) v = 1
      if (flashT[i]! <= 0) flashT[i] = 1.5 + Math.random() * 7
      fcol[i * 3] = fcol[i * 3 + 1] = fcol[i * 3 + 2] = v * 1.6
    }
    fgeo.getAttribute('color').needsUpdate = true
  })

  // ── Floodlight towers, light cones, glows, haze.
  const glow = glowTexture()
  const mast = new MeshLambertMaterial({ color: 0x24324f })
  const lampMat = new MeshBasicMaterial({ color: 0xfff6dc })
  for (const [x, z] of [[-52, -16], [52, -16], [-52, 121], [52, 121]] as const) {
    const tower = new Group()
    tower.position.set(x, 0, z)
    scene.add(tower)
    // Lattice: four legs and cross braces.
    for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
      const leg = new Mesh(new BoxGeometry(0.22, 38, 0.22), mast)
      leg.position.set(dx! * (1 - 0.3), 19, dz! * (1 - 0.3))
      tower.add(leg)
    }
    for (let y = 2; y < 37; y += 2.6) {
      for (const r of [0, Math.PI / 2]) {
        const brace = new Mesh(new BoxGeometry(1.6, 0.08, 0.08), mast)
        brace.position.y = y
        brace.rotation.set(0, r, (y / 2.6) % 2 ? 0.75 : -0.75)
        tower.add(brace)
      }
    }
    const head = new Group()
    head.position.y = 39
    tower.add(head)
    tower.updateMatrixWorld(true)
    head.lookAt(0, 0, 52.5)
    const frame = new Mesh(new BoxGeometry(5.6, 3.6, 0.3), mast)
    head.add(frame)
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
      const p = new Mesh(new PlaneGeometry(0.9, 0.85), lampMat)
      p.position.set(-2.2 + i * 1.1, -1.05 + j * 1.05, 0.17)
      head.add(p)
    }
    const s = new Sprite(new SpriteMaterial({ map: glow, color: 0xfff1cf, transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0.7 }))
    s.position.set(x, 39, z)
    s.scale.setScalar(11)
    scene.add(s)
    // Cone from the lamp towards its aim point on the pitch.
    const aim = new Vector3(x * 0.25, 0, z < 50 ? 30 : 75)
    const from = new Vector3(x, 39, z)
    const len = from.distanceTo(aim)
    const cone = new Mesh(new ConeGeometry(16, len, 32, 1, true), coneMaterial(low ? 0.06 : 0.09))
    cone.position.copy(from).lerp(aim, 0.5)
    cone.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), from.clone().sub(aim).normalize())
    scene.add(cone)
  }
  // Drifting lit haze over the pitch.
  const hz = hazeTexture()
  const hazeMats: ShaderMaterial[] = []
  for (const [y, o] of [[7, 0.5], [13, 0.4]] as const) {
    const m = hazeMaterial(hz, low ? o * 0.7 : o)
    hazeMats.push(m)
    const h = new Mesh(new PlaneGeometry(150, 170), m)
    h.rotation.x = -Math.PI / 2
    h.position.set(0, y, 52.5)
    scene.add(h)
  }
  let camY = 0
  updates.push((t) => {
    const fade = Math.max(0, Math.min(1, 1 - (camY - 16) / 30))
    for (const m of hazeMats) {
      m.uniforms.uTime!.value = t
      m.uniforms.uFade!.value = fade
    }
  })

  // ── LED boards around the pitch, the video board on the east stand.
  const ad = boardTexture(['LUMEN TV', 'GOAL+', 'PIXEL COLA', 'KICKBORN', 'ORBIT AIR', 'ARCADIA'])
  const adMat = new MeshBasicMaterial({ map: ad, color: 0xa8b0bd })
  const board = (x: number, z: number, len: number, rot: number) => {
    const b = new Mesh(new PlaneGeometry(len, 0.9), adMat)
    b.position.set(x, 0.45, z)
    b.rotation.y = rot
    scene.add(b)
  }
  board(0, -5.5, 70, 0)
  board(0, 110.5, 70, Math.PI)
  board(38.5, 52.5, 100, -Math.PI / 2)
  board(-38.5, 26, 46, Math.PI / 2)
  board(-38.5, 79, 46, Math.PI / 2)

  let score = { goals: 0, kicks: 0 }
  const vb = canvasTexture(1024, 448, () => {})
  const drawVB = () => {
    const c = vb.image as HTMLCanvasElement
    const g = c.getContext('2d')!
    g.fillStyle = '#070b14'
    g.fillRect(0, 0, 1024, 448)
    g.fillStyle = '#1fd47a'
    g.fillRect(0, 0, 1024, 16)
    g.font = `700 92px ${FONT}`
    g.textBaseline = 'middle'
    g.fillStyle = '#f2f5fa'
    g.textAlign = 'right'
    g.fillText('KICK', 512, 120)
    g.fillStyle = '#1fd47a'
    g.textAlign = 'left'
    g.fillText('BORN', 512, 120)
    g.font = `700 200px ${FONT}`
    g.fillStyle = '#ffc83d'
    g.textAlign = 'center'
    g.fillText(`${score.goals} / ${score.kicks}`, 512, 300)
    for (let i = 0; i < 5; i++) {
      g.beginPath()
      g.arc(372 + i * 70, 410, 18, 0, Math.PI * 2)
      g.fillStyle = i < score.goals ? '#1fd47a' : i < score.kicks ? '#b4c0d6' : '#1b2740'
      g.fill()
    }
    vb.needsUpdate = true
  }
  drawVB()
  const vbMesh = new Mesh(new PlaneGeometry(22, 9.6), new MeshBasicMaterial({ map: vb }))
  vbMesh.position.set(52, 26.5, 52.5)
  vbMesh.rotation.y = -Math.PI / 2
  scene.add(vbMesh)
  const vbFrame = new Mesh(new BoxGeometry(0.6, 10.6, 23), roofMat)
  vbFrame.position.set(52.4, 26.5, 52.5)
  scene.add(vbFrame)

  return {
    update(t, dt, cameraY) {
      camY = cameraY
      for (const u of updates) u(t, dt)
    },
    dentNet(x, y) {
      dent = { x, y, t: 0 }
    },
    setScore(goals, kicks) {
      score = { goals, kicks }
      drawVB()
    },
  }
}

