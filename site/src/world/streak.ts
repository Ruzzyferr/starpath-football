/**
 * The strike streak: a ribbon of light that follows the ball from the boot. It is the Kickborn
 * identity in the world ("born to kick"): every shot, the hero loop and the player's own penalties,
 * draws one. Bright and narrow at the ball, fading and widening towards the boot, and fading out
 * after the ball lands.
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, ShaderMaterial, Vector3, type Camera, type Scene } from 'three'

const N = 48

export class Streak {
  private readonly pts: Vector3[] = []
  private readonly geo = new BufferGeometry()
  private readonly mesh: Mesh
  private readonly mat: ShaderMaterial
  private fade = 0
  private live = false
  private hold = false

  constructor(scene: Scene, color = 0x1fd47a) {
    const pos = new Float32Array(N * 2 * 3)
    const along = new Float32Array(N * 2)
    const side = new Float32Array(N * 2)
    const idx: number[] = []
    for (let i = 0; i < N; i++) {
      along[i * 2] = along[i * 2 + 1] = i / (N - 1)
      side[i * 2] = -1
      side[i * 2 + 1] = 1
      if (i < N - 1) {
        const a = i * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    this.geo.setAttribute('position', new BufferAttribute(pos, 3))
    this.geo.setAttribute('aAlong', new BufferAttribute(along, 1))
    this.geo.setAttribute('aSide', new BufferAttribute(side, 1))
    this.geo.setIndex(idx)
    this.mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      uniforms: { uColor: { value: new Color(color) }, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aAlong; attribute float aSide; varying float vA; varying float vS;
        void main() { vA = aAlong; vS = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uOpacity; varying float vA; varying float vS;
        void main() {
          float core = 1.0 - smoothstep(0.0, 1.0, abs(vS));
          float a = uOpacity * pow(vA, 1.4) * core;
          vec3 c = mix(uColor, vec3(1.0), pow(vA, 6.0) * core * 0.8);
          gl_FragColor = vec4(c * a * 1.6, a);
        }`,
    })
    this.mesh = new Mesh(this.geo, this.mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 5
    scene.add(this.mesh)
  }

  /** Start a new streak at the boot. */
  start(p: Vector3): void {
    this.pts.length = 0
    this.pts.push(p.clone())
    this.live = true
    this.hold = false
    this.fade = 1
  }

  /** Add the ball's current position. */
  push(p: Vector3): void {
    if (!this.live) return
    const last = this.pts[this.pts.length - 1]
    if (last && last.distanceToSquared(p) < 0.0004) return
    this.pts.push(p.clone())
    if (this.pts.length > N) this.pts.shift()
  }

  /** The ball has landed: let the streak fade. */
  end(): void {
    this.live = false
  }

  /** Draw a whole path at once (reduced motion: a still of the strike). */
  setPath(points: Vector3[]): void {
    this.pts.length = 0
    const step = Math.max(1, Math.floor(points.length / N))
    for (let i = 0; i < points.length; i += step) this.pts.push(points[i]!.clone())
    this.live = false
    this.hold = true
    this.fade = 1
  }

  clear(): void {
    this.pts.length = 0
    this.hold = false
    this.fade = 0
    this.mat.uniforms.uOpacity!.value = 0
  }

  update(dt: number, camera: Camera): void {
    if (!this.live && !this.hold) this.fade = Math.max(0, this.fade - dt * 0.9)
    this.mat.uniforms.uOpacity!.value = this.fade
    const pos = this.geo.getAttribute('position') as BufferAttribute
    const arr = pos.array as Float32Array
    const n = this.pts.length
    if (n < 2) {
      arr.fill(0)
      pos.needsUpdate = true
      return
    }
    const camPos = camera.position
    const side = new Vector3()
    const view = new Vector3()
    for (let i = 0; i < N; i++) {
      // Spread the stored points over the N ribbon segments (oldest first).
      const f = (i / (N - 1)) * (n - 1)
      const i0 = Math.floor(f)
      const i1 = Math.min(n - 1, i0 + 1)
      const p = this.pts[i0]!.clone().lerp(this.pts[i1]!, f - i0)
      const q = this.pts[Math.min(n - 1, i1 + 1)]!.clone().sub(this.pts[Math.max(0, i0 - 1)]!)
      view.copy(camPos).sub(p)
      side.crossVectors(q, view).normalize()
      const a = i / (N - 1)
      const w = 0.06 + (1 - a) * 0.12
      arr[i * 6] = p.x - side.x * w
      arr[i * 6 + 1] = p.y - side.y * w
      arr[i * 6 + 2] = p.z - side.z * w
      arr[i * 6 + 3] = p.x + side.x * w
      arr[i * 6 + 4] = p.y + side.y * w
      arr[i * 6 + 5] = p.z + side.z * w
    }
    pos.needsUpdate = true
  }
}
