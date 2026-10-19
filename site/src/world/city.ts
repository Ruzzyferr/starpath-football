/**
 * The city at night, west of the stadium: blocks of towers with lit windows, a street grid with
 * streetlights and moving car lights, and rooftop billboards that carry real screens from the game
 * (life events, the season report).
 */
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Scene,
} from 'three'
import { canvasTexture, glowTexture } from './textures'

export const CITY = { xNear: -110, xFar: -520, zMin: -220, zMax: 320 }

function windowTexture() {
  const t = canvasTexture(128, 256, (g) => {
    g.fillStyle = '#05070c'
    g.fillRect(0, 0, 128, 256)
    const lit = ['#ffd27a', '#ffe7b0', '#fff4dc', '#9fd0ff', '#ffb35c']
    for (let y = 0; y < 32; y++) for (let x = 0; x < 8; x++) {
      if (Math.random() < 0.26) {
        g.fillStyle = lit[(Math.random() * lit.length) | 0]!
        g.globalAlpha = 0.35 + Math.random() * 0.45
      } else {
        g.fillStyle = '#121a2a'
        g.globalAlpha = 1
      }
      g.fillRect(x * 16 + 4, y * 8 + 2, 9, 5)
    }
    g.globalAlpha = 1
  })
  t.wrapS = t.wrapT = RepeatWrapping
  return t
}

export interface City {
  update(t: number, dt: number): void
  /** Load the billboard pictures (once, when the camera gets near). */
  loadBillboards(urls: string[]): void
}

export function buildCity(scene: Scene, lowPower: boolean): City {
  const updates: ((t: number, dt: number) => void)[] = []
  const ground = new Mesh(new PlaneGeometry(700, 700), new MeshLambertMaterial({ color: 0x080c14 }))
  ground.rotation.x = -Math.PI / 2
  ground.position.set(-330, -0.05, 50)
  scene.add(ground)

  // Street grid: blocks 60 m apart; towers inside each block.
  const win = windowTexture()
  const types = [
    { w: 18, h: 26, d: 18 },
    { w: 14, h: 44, d: 14 },
    { w: 22, h: 18, d: 30 },
    { w: 12, h: 70, d: 12 },
    { w: 16, h: 96, d: 16 },
  ]
  const placements: Vector3[][] = types.map(() => [])
  const step = 60
  const rnd = () => Math.random()
  for (let x = CITY.xNear - 20; x > CITY.xFar; x -= step) {
    for (let z = CITY.zMin; z < CITY.zMax; z += step) {
      const per = lowPower ? 2 : 4
      for (let k = 0; k < per; k++) {
        // Taller towers further away, so the skyline rises behind the low blocks near the stadium.
        const far = (CITY.xNear - x) / (CITY.xNear - CITY.xFar)
        let ti = Math.floor(rnd() * (far < 0.25 ? 3 : types.length))
        if (far > 0.5 && rnd() < 0.4) ti = 3 + Math.floor(rnd() * 2)
        placements[ti]!.push(new Vector3(x - 8 - rnd() * 34, 0, z + 8 + rnd() * 34))
      }
    }
  }
  const tmp = new Matrix4()
  types.forEach((ty, i) => {
    const geo = new BoxGeometry(ty.w, ty.h, ty.d)
    geo.translate(0, ty.h / 2, 0)
    const tex = win.clone()
    tex.needsUpdate = true
    tex.repeat.set(ty.w / 11, ty.h / 16)
    const mat = new MeshLambertMaterial({ color: 0x0b1120, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55 })
    const list = placements[i]!
    const im = new InstancedMesh(geo, mat, list.length)
    list.forEach((p, k) => {
      const sy = 0.75 + Math.random() * 0.6
      tmp.makeScale(1, sy, 1).setPosition(p)
      im.setMatrixAt(k, tmp)
    })
    scene.add(im)
  })

  // Streetlights along the grid and car lights moving on the avenues.
  const glow = glowTexture()
  const lights: number[] = []
  for (let x = CITY.xNear; x > CITY.xFar; x -= step) for (let z = CITY.zMin; z < CITY.zMax; z += 15) lights.push(x, 6, z)
  for (let z = CITY.zMin; z < CITY.zMax; z += step) for (let x = CITY.xNear; x > CITY.xFar; x -= 15) lights.push(x, 6, z)
  const lg = new BufferGeometry()
  lg.setAttribute('position', new BufferAttribute(new Float32Array(lights), 3))
  scene.add(new Points(lg, new PointsMaterial({ color: 0xffb768, size: 3.2, map: glow, transparent: true, depthWrite: false, blending: AdditiveBlending })))

  const carN = lowPower ? 60 : 160
  const cars = new Float32Array(carN * 3)
  const carCol = new Float32Array(carN * 3)
  const carState = Array.from({ length: carN }, (_, i) => {
    const alongX = i % 2 === 0
    const lane = alongX ? CITY.zMin + Math.floor(Math.random() * 9) * step + 3 : CITY.xNear - Math.floor(Math.random() * 7) * step - 3
    const dir = Math.random() < 0.5 ? -1 : 1
    const c = new Color(dir > 0 ? 0xfff2d8 : 0xff3a3a)
    carCol.set([c.r * 1.4, c.g * 1.4, c.b * 1.4], i * 3)
    return { alongX, lane, dir, s: Math.random(), v: 0.012 + Math.random() * 0.02 }
  })
  const cg = new BufferGeometry()
  cg.setAttribute('position', new BufferAttribute(cars, 3))
  cg.setAttribute('color', new BufferAttribute(carCol, 3))
  scene.add(new Points(cg, new PointsMaterial({ size: 2.2, map: glow, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending })))
  updates.push((_t, dt) => {
    carState.forEach((c, i) => {
      c.s = (c.s + c.dir * c.v * dt * 4 + 1) % 1
      if (c.alongX) cars.set([CITY.xNear + (CITY.xFar - CITY.xNear) * c.s, 1, c.lane], i * 3)
      else cars.set([c.lane, 1, CITY.zMin + (CITY.zMax - CITY.zMin) * c.s], i * 3)
    })
    cg.getAttribute('position').needsUpdate = true
  })

  // Rooftop billboards (filled with real game screens when the camera approaches).
  const boards: { mesh: Mesh; mat: MeshBasicMaterial }[] = []
  const frameMat = new MeshLambertMaterial({ color: 0x1b2740 })
  for (const [x, y, z, ry] of [[-150, 34, 18, Math.PI / 2 - 0.25], [-178, 58, 92, Math.PI / 2 + 0.2]] as const) {
    const mat = new MeshBasicMaterial({ color: 0x131c2e })
    const mesh = new Mesh(new PlaneGeometry(9.5, 18.6), mat)
    mesh.position.set(x, y, z)
    mesh.rotation.y = ry
    scene.add(mesh)
    const frame = new Mesh(new BoxGeometry(10.4, 19.6, 0.4), frameMat)
    frame.position.copy(mesh.position).add(new Vector3(-Math.sin(ry) * 0.25, 0, -Math.cos(ry) * 0.25))
    frame.rotation.y = ry
    scene.add(frame)
    const pole = new Mesh(new BoxGeometry(0.6, y - 9, 0.6), frameMat)
    pole.position.set(x - Math.sin(ry) * 0.5, (y - 9) / 2, z - Math.cos(ry) * 0.5)
    scene.add(pole)
    boards.push({ mesh, mat })
  }
  let loaded = false
  return {
    update(t, dt) {
      for (const u of updates) u(t, dt)
    },
    loadBillboards(urls) {
      if (loaded) return
      loaded = true
      const loader = new TextureLoader()
      urls.forEach((u, i) => {
        const b = boards[i]
        if (!b) return
        loader.load(u, (tex) => {
          tex.colorSpace = SRGBColorSpace
          b.mat.map = tex
          b.mat.color.set(0xd8d8d8)
          b.mat.needsUpdate = true
        })
      })
    },
  }
}
