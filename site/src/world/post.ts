/**
 * Post-processing, tiered by device:
 *   high  (desktop): bloom on the lights, a gentle depth of field, vignette and film grain
 *   mid   (phones, small GPUs): half-strength bloom at low resolution, vignette and grain
 *   low   (reduced motion, or the frame rate could not hold): no composer, direct render
 * Tone mapping is ACES throughout (OutputPass, or the renderer itself in the low tier).
 */
import { HalfFloatType, Vector2, type PerspectiveCamera, type Scene, type WebGLRenderer } from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'

export type Tier = 'high' | 'mid' | 'low'

const FilmShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.045 }, uVignette: { value: 0.32 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uGrain; uniform float uVignette; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float v = 1.0 - uVignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      float n = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 100.0) - 0.5;
      c.rgb = c.rgb * v + n * uGrain;
      gl_FragColor = c;
    }`,
}

export class Post {
  tier: Tier
  private composer: EffectComposer | null = null
  private film: ShaderPass | null = null
  private bokeh: BokehPass | null = null
  private bloom: UnrealBloomPass | null = null

  constructor(
    private renderer: WebGLRenderer,
    private scene: Scene,
    private camera: PerspectiveCamera,
    tier: Tier,
  ) {
    this.tier = tier
    this.build()
  }

  private build(): void {
    this.composer?.dispose()
    this.composer = null
    this.film = this.bokeh = this.bloom = null
    if (this.tier === 'low') return
    const size = this.renderer.getSize(new Vector2())
    const composer = new EffectComposer(this.renderer)
    composer.renderTarget1.texture.type = HalfFloatType
    composer.renderTarget2.texture.type = HalfFloatType
    composer.addPass(new RenderPass(this.scene, this.camera))
    if (this.tier === 'high') {
      this.bokeh = new BokehPass(this.scene, this.camera, { focus: 40, aperture: 0.00011, maxblur: 0.006 })
      composer.addPass(this.bokeh)
    }
    const scale = this.tier === 'high' ? 0.5 : 0.35
    this.bloom = new UnrealBloomPass(new Vector2(size.x * scale, size.y * scale), this.tier === 'high' ? 0.75 : 0.5, 0.55, 0.78)
    composer.addPass(this.bloom)
    composer.addPass(new OutputPass())
    this.film = new ShaderPass(FilmShader)
    if (this.tier === 'mid') this.film.uniforms.uGrain!.value = 0.03
    composer.addPass(this.film)
    this.composer = composer
  }

  setTier(t: Tier): void {
    if (t === this.tier) return
    this.tier = t
    this.build()
  }

  setSize(w: number, h: number): void {
    this.composer?.setSize(w, h)
  }

  setFocus(distance: number): void {
    if (this.bokeh) (this.bokeh.uniforms as Record<string, { value: number }>).focus!.value = distance
  }

  render(time: number): void {
    if (!this.composer) {
      this.renderer.render(this.scene, this.camera)
      return
    }
    if (this.film) this.film.uniforms.uTime!.value = time
    this.composer.render()
  }
}
