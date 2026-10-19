/**
 * Night sky: a dome of stars and a low moon glow. (The Kickborn identity is the strike, carried by
 * the streak in streak.ts, not by anything in the sky.)
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, PointsMaterial, Sprite, SpriteMaterial, type Scene } from 'three'
import { glowTexture } from './textures'

export interface Sky {
  update(t: number, reduced: boolean): void
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
    const b = 0.3 + Math.random() * 0.6
    col.set([b * 0.85, b * 0.9, b], i * 3)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('color', new BufferAttribute(col, 3))
  scene.add(new Points(g, new PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false })))

  const moon = new Sprite(new SpriteMaterial({ map: glowTexture(), color: 0xc9d6ff, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false, fog: false }))
  moon.position.set(-640, 300, -380)
  moon.scale.setScalar(70)
  scene.add(moon)

  return {
    update() {},
  }
}
