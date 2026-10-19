/**
 * Night sky: a dome of stars, a low moon glow, and the StarPath mark (ball, five green dots, a gold
 * star) drawn as a constellation high over the north stand. The first and last stops of the camera
 * look at it.
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, Points, PointsMaterial, Shape, SphereGeometry, Sprite, SpriteMaterial, Vector3, type Scene } from 'three'
import { glowTexture } from './textures'

export function starShape(outer: number, inner: number): Shape {
  const s = new Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer
    const a = Math.PI / 2 + (i * Math.PI) / 5
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  s.closePath()
  return s
}

export interface Sky {
  update(t: number, reduced: boolean): void
  /** The constellation's star, for the camera to look at. */
  star: Vector3
}

export function buildSky(scene: Scene, lowPower: boolean): Sky {
  const n = lowPower ? 900 : 2200
  const pos = new Float32Array(n * 3)
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const th = Math.random() * Math.PI * 2
    const ph = Math.asin(0.05 + Math.random() * 0.95)
    const r = 900
    pos.set([Math.cos(th) * Math.cos(ph) * r, Math.sin(ph) * r, Math.sin(th) * Math.cos(ph) * r + 50], i * 3)
    const b = 0.35 + Math.random() * 0.65
    col.set([b * 0.85, b * 0.9, b], i * 3)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('color', new BufferAttribute(col, 3))
  scene.add(new Points(g, new PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false })))

  const moon = new Sprite(new SpriteMaterial({ map: glowTexture(), color: 0xc9d6ff, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false, fog: false }))
  moon.position.set(-640, 300, -380)
  moon.scale.setScalar(70)
  scene.add(moon)

  // The constellation: ball, five dots on an arc, the star. Big, high above the north stand.
  const mark = new Group()
  scene.add(mark)
  const at = (x: number, y: number) => new Vector3(x, y, -150)
  const ball = new Mesh(new SphereGeometry(3.6, 24, 16), new MeshBasicMaterial({ color: 0xf2f5fa, fog: false }))
  ball.position.copy(at(146, 80))
  mark.add(ball)
  const dotMat = new MeshBasicMaterial({ color: 0x1fd47a, fog: false })
  const dots: Mesh[] = []
  const p0 = at(154, 86)
  const p1 = at(172, 110)
  const p2 = at(202, 116)
  for (let i = 0; i < 5; i++) {
    const s = (i + 0.4) / 5.6
    const p = p0.clone().lerp(p1, s).lerp(p1.clone().lerp(p2, s), s)
    const d = new Mesh(new SphereGeometry(1.9, 18, 12), dotMat)
    d.position.copy(p)
    mark.add(d)
    dots.push(d)
  }
  const starGeo = new ExtrudeGeometry(starShape(1, 0.46), { depth: 0.3, bevelEnabled: false })
  starGeo.center()
  const star = new Mesh(starGeo, new MeshBasicMaterial({ color: 0xffc83d, fog: false }))
  star.position.copy(at(214, 120))
  star.scale.setScalar(8.5)
  mark.add(star)
  const halo = new Sprite(new SpriteMaterial({ map: glowTexture(), color: 0xffd76a, transparent: true, opacity: 0.45, blending: AdditiveBlending, depthWrite: false, fog: false }))
  halo.position.copy(star.position)
  halo.scale.setScalar(44)
  mark.add(halo)

  return {
    star: star.position.clone(),
    update(t, reduced) {
      if (reduced) return
      star.rotation.y = Math.sin(t * 0.5) * 0.35
      dots.forEach((d, i) => d.scale.setScalar(1 + 0.1 * Math.sin(t * 2.2 - i * 0.8)))
      halo.material.opacity = 0.4 + 0.08 * Math.sin(t * 1.3)
    },
  }
}
