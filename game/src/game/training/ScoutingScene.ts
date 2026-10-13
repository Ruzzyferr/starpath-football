/**
 * Phaser renderer of the opponent video-scouting mini-game ("analysis
 * tablet"): a top-down tactical cam of the procedurally generated clips, kit
 * colours of the real opponent, ball with height and trail, a REC / timecode
 * HUD and telestrator annotations (dashed arrows, rings) once a clip is
 * answered. The rules live in ./scouting (headless); the three answer buttons
 * are DOM (ui/screens/training/ScoutingOverlay) so they are real, accessible
 * buttons for touch, mouse and keys.
 */
import Phaser from 'phaser'
import type { KitColors } from '../../core/types'
import { colorNum, luminance, mixHex } from '../art'
import { createMatchGame } from '../MatchScene'
import { guardPhaser, type GuardHandle } from '../phaserGuard'
import type { QualityProfile } from '../quality'
import { pauseGate, wireAppPause } from '../pauseGate'
import { PITCH_L, PITCH_W, actorAt, ballAt, type Clip, type ScoutFrame, type ScoutingGame, type ScoutingResult } from './scouting'
import { crumb } from '../../telemetry/breadcrumbs'

export interface ScoutingSceneOptions {
  /** Localised canvas labels. */
  labels: { rec: string; clip: string; vs: string }
  reducedMotion: boolean
  /** CSS px reserved at the top (quit button) and bottom (question panel). */
  insets: () => { top: number; bottom: number }
  /** Called whenever the phase / clip changes (the overlay re-renders its question). */
  onFrame: (f: ScoutFrame) => void
  /** Graphics quality profile (render scale cap). */
  quality?: QualityProfile
  /** The player chose Low graphics: Canvas renderer from the start. */
  canvasRenderer?: boolean
  /** Exit pressed on the render-failure panel. */
  onExit?: () => void
}

export interface ScoutingHandle {
  stop(): void
}

interface SceneData {
  game: ScoutingGame
  opts: ScoutingSceneOptions
  onDone: (r: ScoutingResult) => void
}

const SCENE_KEY = 'starpath-scouting'
const FONT = "system-ui, 'Segoe UI', Roboto, Arial, sans-serif"
const TELE = 0xffd23f
const GOOD = 0x3ddc84
const BAD = 0xff5a5a
const US_KIT: KitColors = { primary: '#d8dee8', secondary: '#1d2a3a', pattern: 'plain' }

interface View { x: number; y: number; w: number; h: number }

class ScoutingScene extends Phaser.Scene {
  private sg!: ScoutingGame
  private opts!: ScoutingSceneOptions
  private onDone!: (r: ScoutingResult) => void
  private ui = 1
  private g!: Phaser.GameObjects.Graphics
  private fx!: Phaser.GameObjects.Graphics
  private nums = new Map<string, Phaser.GameObjects.Text>()
  private rec!: Phaser.GameObjects.Text
  private clipTxt!: Phaser.GameObjects.Text
  private vsTxt!: Phaser.GameObjects.Text
  private title!: Phaser.GameObjects.Text
  private titleSub!: Phaser.GameObjects.Text
  private scan!: Phaser.GameObjects.TileSprite
  private vignette!: Phaser.GameObjects.Image
  private cam: View = { x: 0, y: 0, w: PITCH_W, h: PITCH_L }
  private lastKey = ''
  private endT = -1
  private clock = 0
  private oppKit!: KitColors
  private oppGk!: string

  constructor() {
    super(SCENE_KEY)
  }

  init(d: SceneData): void {
    this.sg = d.game
    this.opts = d.opts
    this.onDone = d.onDone
    this.ui = (this.registry.get('dpr') as number | undefined) ?? 1
    this.oppKit = d.game.colors
    this.oppGk = luminance(this.oppKit.primary) > 0.5 ? '#2a2f3a' : '#f5c84c'
  }

  create(): void {
    // Breadcrumbs (telemetry/breadcrumbs): a hang inside create leaves the last stage behind.
    crumb('scene-create', 'scouting')
    this.events.once(Phaser.Scenes.Events.CREATE, () => crumb('scene-ready', 'scouting'))
    const u = this.ui
    this.cameras.main.setBackgroundColor('#081210')
    this.makeTextures()
    this.g = this.add.graphics()
    this.fx = this.add.graphics().setDepth(5)
    this.scan = this.add.tileSprite(0, 0, 10, 10, 'sc-scan').setOrigin(0).setAlpha(0.22).setDepth(8)
    this.vignette = this.add.image(0, 0, 'sc-vig').setOrigin(0).setDepth(9)
    const txt = (size: number, color: string, weight = '800') => this.add.text(0, 0, '', { fontFamily: FONT, fontSize: `${Math.round(size * u)}px`, color, fontStyle: weight }).setDepth(10)
    this.rec = txt(12, '#ffffff', '700')
    this.clipTxt = txt(12, '#ffffff', '800').setOrigin(1, 0)
    this.vsTxt = txt(12, '#ffd23f', '800').setOrigin(0.5, 0)
    this.title = txt(34, '#ffffff', '900').setOrigin(0.5).setShadow(0, 2 * u, '#000000', 8 * u, true, true)
    this.titleSub = txt(14, '#ffd23f', '800').setOrigin(0.5)
    this.cam = { ...this.sg.clip.focus }
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this))
    // Shared pause source (game/pauseGate): backgrounding the app freezes the clip and its clock.
    wireAppPause()
    const gateTok = pauseGate.attach()
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => pauseGate.detach(gateTok))
    this.events.once(Phaser.Scenes.Events.DESTROY, () => pauseGate.detach(gateTok))
    this.layout()
    this.emit()
    if (import.meta.env.DEV) (globalThis as { __spScouting?: ScoutingScene }).__spScouting = this
  }

  private makeTextures(): void {
    const u = this.ui
    if (!this.textures.exists('sc-scan')) {
      const t = this.textures.createCanvas('sc-scan', 4, Math.max(3, Math.round(3 * u)))!
      const c = t.getContext()
      c.fillStyle = 'rgba(0,0,0,0.55)'
      c.fillRect(0, 0, 4, Math.max(1, Math.round(u)))
      t.refresh()
    }
    if (this.textures.exists('sc-vig')) this.textures.remove('sc-vig')
    const w = Math.max(2, this.scale.width)
    const h = Math.max(2, this.scale.height)
    const t = this.textures.createCanvas('sc-vig', w, h)!
    const c = t.getContext()
    const gr = c.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.3, w / 2, h * 0.42, Math.max(w, h) * 0.75)
    gr.addColorStop(0, 'rgba(0,0,0,0)')
    gr.addColorStop(1, 'rgba(0,0,0,0.55)')
    c.fillStyle = gr
    c.fillRect(0, 0, w, h)
    t.refresh()
  }

  private layout(): void {
    const w = this.scale.width
    const h = this.scale.height
    this.makeTextures()
    this.vignette.setTexture('sc-vig')
    this.scan.setSize(w, h)
  }

  /** The screen rectangle the pitch view may use (inside the insets). */
  private area(): View {
    const u = this.ui
    const ins = this.opts.insets()
    const pad = 12 * u
    const top = ins.top * u + 54 * u
    const bottom = ins.bottom * u + pad
    return { x: pad, y: top, w: this.scale.width - pad * 2, h: Math.max(80 * u, this.scale.height - top - bottom) }
  }

  /** Pitch → screen mapping for the current camera window (y = 105 at the top). */
  private mapper(): { sx: (x: number) => number; sy: (y: number) => number; s: number; box: View } {
    const a = this.area()
    const m = 3 // metres of margin around the focus window
    const vw = this.cam.w + m * 2
    const vh = this.cam.h + m * 2
    const s = Math.min(a.w / vw, a.h / vh)
    const bw = vw * s
    const bh = vh * s
    const ox = a.x + (a.w - bw) / 2
    const oy = a.y + (a.h - bh) / 2
    const x0 = this.cam.x - m
    const yTop = this.cam.y + this.cam.h + m
    return { sx: (x) => ox + (x - x0) * s, sy: (y) => oy + (yTop - y) * s, s, box: { x: ox, y: oy, w: bw, h: bh } }
  }

  private emit(): void {
    const f = this.sg.frame()
    const key = `${f.phase}:${f.index}`
    if (key !== this.lastKey) {
      this.lastKey = key
      this.opts.onFrame(f)
    }
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.1, deltaMs / 1000)
    if (!this.sg.finished && !pauseGate.tick(Math.min(0.25, Math.max(0, deltaMs / 1000)))) {
      this.draw(this.sg.frame())
      return
    }
    this.clock += dt
    this.sg.update(dt)
    this.emit()
    if (this.sg.finished) {
      if (this.endT < 0) this.endT = 0
      this.endT += dt
      if (this.endT > 0.5) {
        this.onDone(this.sg.result())
        this.scene.pause()
        return
      }
    }
    const target = this.sg.clip.focus
    const k = this.opts.reducedMotion ? 1 : 1 - Math.exp(-dt * 5)
    this.cam = { x: this.cam.x + (target.x - this.cam.x) * k, y: this.cam.y + (target.y - this.cam.y) * k, w: this.cam.w + (target.w - this.cam.w) * k, h: this.cam.h + (target.h - this.cam.h) * k }
    this.draw(this.sg.frame())
  }

  // ───────────────────────── Drawing ─────────────────────────

  private draw(f: ScoutFrame): void {
    const g = this.g
    const fx = this.fx
    const u = this.ui
    g.clear()
    fx.clear()
    const M = this.mapper()
    const { sx, sy, s, box } = M
    const clip = f.clip
    // Monitor frame.
    const fr = 8 * u
    g.fillStyle(0x0f1d18, 1).fillRoundedRect(box.x - fr, box.y - fr, box.w + fr * 2, box.h + fr * 2, 14 * u)
    g.lineStyle(1.5 * u, 0x2c4a3e, 1).strokeRoundedRect(box.x - fr, box.y - fr, box.w + fr * 2, box.h + fr * 2, 14 * u)
    this.drawPitch(M)
    // Trails and actors.
    const t = f.animT
    const reveal = f.phase === 'feedback' || f.phase === 'done'
    for (const a of clip.actors) {
      const p = actorAt(a, t)
      const back = actorAt(a, Math.max(0, t - 0.55))
      if (Math.hypot(p.x - back.x, p.y - back.y) > 0.8) {
        // Fading motion streak (5 steps, thin to thick) in a light tint of the kit.
        const col = a.side === 'opp' ? colorNum(mixHex(this.oppKit.primary, '#ffffff', 0.45)) : 0xe6ebf2
        for (let i = 0; i < 5; i++) {
          const q0 = actorAt(a, Math.max(0, t - 0.55 + i * 0.11))
          const q1 = actorAt(a, Math.max(0, t - 0.55 + (i + 1) * 0.11))
          g.lineStyle(Math.max(1.5 * u, (0.25 + i * 0.12) * s), col, 0.06 + i * 0.05)
          g.lineBetween(sx(q0.x), sy(q0.y), sx(q1.x), sy(q1.y))
        }
      }
    }
    for (const a of clip.actors) this.drawActor(a, actorAt(a, t), M, reveal && !!a.key)
    // Ball: shadow on the ground, ball lifted by its height.
    const b = ballAt(clip.ball, t)
    const trail: { x: number; y: number }[] = []
    for (let i = 6; i >= 1; i--) trail.push(ballAt(clip.ball, Math.max(0, t - i * 0.07)))
    for (let i = 1; i < trail.length; i++) {
      const p0 = trail[i - 1]!
      const p1 = trail[i]!
      if (Math.hypot(p1.x - p0.x, p1.y - p0.y) < 0.05) continue
      g.lineStyle(Math.max(1.5 * u, 0.5 * s), 0xffffff, 0.08 + i * 0.05)
      g.lineBetween(sx(p0.x), sy(p0.y), sx(p1.x), sy(p1.y))
    }
    const br = Math.max(4 * u, 0.62 * s) * (1 + b.z * 0.06)
    g.fillStyle(0x000000, 0.35).fillEllipse(sx(b.x) + b.z * 0.35 * s, sy(b.y) + b.z * 0.25 * s, br * 2, br * 1.3)
    g.fillStyle(0xffffff, 1).fillCircle(sx(b.x), sy(b.y) - b.z * 0.5 * s, br)
    g.lineStyle(1 * u, 0x1b1b1b, 0.8).strokeCircle(sx(b.x), sy(b.y) - b.z * 0.5 * s, br)
    // Telestrator once answered.
    if (reveal) this.drawAnnotations(clip, f, M)
    // Feedback frame tint.
    if (f.phase === 'feedback' && f.answer) {
      const col = f.answer.correct ? GOOD : BAD
      const a = this.opts.reducedMotion ? 0.9 : 0.5 + 0.5 * Math.cos(f.feedback * Math.PI * 3)
      fx.lineStyle(3 * u, col, a).strokeRoundedRect(box.x - fr, box.y - fr, box.w + fr * 2, box.h + fr * 2, 14 * u)
    }
    this.drawHud(f, box)
  }

  private drawPitch(M: ReturnType<ScoutingScene['mapper']>): void {
    const g = this.g
    const { sx, sy, s } = M
    const u = this.ui
    // Grass with mown bands along the length (clipped to the visible window by drawing everything; cheap).
    const bands = 14
    for (let i = 0; i < bands; i++) {
      const y0 = (PITCH_L / bands) * i
      const y1 = (PITCH_L / bands) * (i + 1)
      g.fillStyle(i % 2 ? 0x2f7d46 : 0x2a7340, 1)
      g.fillRect(sx(-2), sy(y1), sx(PITCH_W + 2) - sx(-2), sy(y0) - sy(y1))
    }
    // Run-off beyond the lines.
    g.fillStyle(0x24663a, 1)
    g.fillRect(sx(-3), sy(PITCH_L + 3), sx(0) - sx(-3), sy(-3) - sy(PITCH_L + 3))
    g.fillRect(sx(PITCH_W), sy(PITCH_L + 3), sx(PITCH_W + 3) - sx(PITCH_W), sy(-3) - sy(PITCH_L + 3))
    g.fillRect(sx(0), sy(PITCH_L + 3), sx(PITCH_W) - sx(0), sy(PITCH_L) - sy(PITCH_L + 3))
    g.fillRect(sx(0), sy(0), sx(PITCH_W) - sx(0), sy(-3) - sy(0))
    const lw = Math.max(1.2 * u, 0.13 * s)
    g.lineStyle(lw, 0xf4f8f2, 0.85)
    g.strokeRect(sx(0), sy(PITCH_L), sx(PITCH_W) - sx(0), sy(0) - sy(PITCH_L))
    g.lineBetween(sx(0), sy(PITCH_L / 2), sx(PITCH_W), sy(PITCH_L / 2))
    g.strokeCircle(sx(PITCH_W / 2), sy(PITCH_L / 2), 9.15 * s)
    g.fillStyle(0xf4f8f2, 0.9).fillCircle(sx(PITCH_W / 2), sy(PITCH_L / 2), Math.max(1.5 * u, 0.25 * s))
    for (const end of [0, PITCH_L]) {
      const dir = end === 0 ? 1 : -1
      const box = (wd: number, dp: number) => {
        const x0 = PITCH_W / 2 - wd / 2
        const yA = end
        const yB = end + dir * dp
        g.strokeRect(sx(x0), sy(Math.max(yA, yB)), wd * s, dp * s)
      }
      box(40.32, 16.5)
      box(18.32, 5.5)
      g.fillCircle(sx(PITCH_W / 2), sy(end + dir * 11), Math.max(1.5 * u, 0.22 * s))
      // Penalty arc.
      const cy = sy(end + dir * 11)
      g.beginPath()
      g.arc(sx(PITCH_W / 2), cy, 9.15 * s, dir === 1 ? -Math.PI + 0.927 : 0.927, dir === 1 ? -0.927 : Math.PI - 0.927, false)
      g.strokePath()
      // Goal.
      g.lineStyle(Math.max(2 * u, 0.22 * s), 0xffffff, 1)
      g.strokeRect(sx(PITCH_W / 2 - 3.66), end === 0 ? sy(end) : sy(end + 2), 7.32 * s, 2 * s)
      g.lineStyle(lw, 0xf4f8f2, 0.85)
    }
  }

  private drawActor(a: Clip['actors'][number], p: { x: number; y: number; moving: boolean }, M: ReturnType<ScoutingScene['mapper']>, halo: boolean): void {
    const g = this.g
    const u = this.ui
    const { sx, sy, s } = M
    const r = Math.max(8.5 * u, 1.45 * s)
    const x = sx(p.x)
    const y = sy(p.y)
    const kit = a.side === 'opp' ? (a.gk ? { primary: this.oppGk, secondary: '#111111' } : this.oppKit) : a.gk ? { primary: '#3cc7b5', secondary: '#0d2b27' } : US_KIT
    if (halo) {
      const pulse = this.opts.reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(this.clock * 8)
      g.fillStyle(TELE, 0.22 * pulse).fillCircle(x, y, r * 2.1)
      g.lineStyle(2.5 * u, TELE, 0.95).strokeCircle(x, y, r * 1.55)
    }
    g.fillStyle(0x000000, 0.3).fillEllipse(x + 1.5 * u, y + 2.5 * u, r * 2.1, r * 1.7)
    g.fillStyle(colorNum(kit.primary), 1).fillCircle(x, y, r)
    const sec = luminance(kit.primary) > 0.75 && luminance(kit.secondary) > 0.75 ? '#1d2a3a' : kit.secondary
    g.lineStyle(Math.max(2 * u, 0.28 * s), colorNum(sec), 1).strokeCircle(x, y, r)
    if (a.side === 'us') g.lineStyle(1 * u, 0x0b1410, 0.6).strokeCircle(x, y, r + 1.5 * u)
    let n = this.nums.get(a.id)
    if (!n) {
      n = this.add.text(0, 0, '', { fontFamily: FONT, fontStyle: '900', color: '#fff' }).setOrigin(0.5).setDepth(3)
      this.nums.set(a.id, n)
    }
    const ink = luminance(kit.primary) > 0.55 ? '#111827' : '#ffffff'
    n.setText(String(a.number)).setColor(ink).setFontSize(Math.round(r * 1.02)).setPosition(x, y + 0.5 * u).setVisible(true)
  }

  private drawAnnotations(clip: Clip, f: ScoutFrame, M: ReturnType<ScoutingScene['mapper']>): void {
    const g = this.fx
    const u = this.ui
    const { sx, sy, s } = M
    const prog = this.opts.reducedMotion ? 1 : f.feedback
    for (const an of clip.annotations) {
      if (an.kind === 'ring') {
        const p = an.pts[0]!
        const rr = (an.r ?? 4) * s * (this.opts.reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(this.clock * 6))
        g.fillStyle(TELE, 0.13 * prog).fillCircle(sx(p[0]), sy(p[1]), rr)
        this.dashedCircle(sx(p[0]), sy(p[1]), rr, 3 * u, prog)
        continue
      }
      // Arrow / path drawn progressively.
      const pts = an.pts.map(([x, y]) => ({ x: sx(x), y: sy(y) }))
      let total = 0
      for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y)
      let left = total * prog
      g.lineStyle(Math.max(3 * u, 0.4 * s), TELE, 0.95)
      let tip = pts[0]!
      let dir = { x: 0, y: -1 }
      for (let i = 1; i < pts.length && left > 0; i++) {
        const a = pts[i - 1]!
        const b = pts[i]!
        const len = Math.hypot(b.x - a.x, b.y - a.y)
        const use = Math.min(len, left)
        const e = { x: a.x + ((b.x - a.x) * use) / Math.max(1e-6, len), y: a.y + ((b.y - a.y) * use) / Math.max(1e-6, len) }
        this.dashed(a, e, 9 * u, 6 * u)
        dir = { x: (b.x - a.x) / Math.max(1e-6, len), y: (b.y - a.y) / Math.max(1e-6, len) }
        tip = e
        left -= use
      }
      if (an.kind === 'arrow' && prog > 0.15) {
        const h = 12 * u
        const nx = -dir.y
        const ny = dir.x
        g.fillStyle(TELE, 1).fillTriangle(tip.x + dir.x * h * 0.4, tip.y + dir.y * h * 0.4, tip.x - dir.x * h + nx * h * 0.6, tip.y - dir.y * h + ny * h * 0.6, tip.x - dir.x * h - nx * h * 0.6, tip.y - dir.y * h - ny * h * 0.6)
      }
    }
  }

  private dashed(a: { x: number; y: number }, b: { x: number; y: number }, dash: number, gap: number): void {
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len < 0.5) return
    const ux = (b.x - a.x) / len
    const uy = (b.y - a.y) / len
    for (let d = 0; d < len; d += dash + gap) {
      const e = Math.min(len, d + dash)
      this.fx.lineBetween(a.x + ux * d, a.y + uy * d, a.x + ux * e, a.y + uy * e)
    }
  }

  private dashedCircle(x: number, y: number, r: number, w: number, prog: number): void {
    const g = this.fx
    g.lineStyle(w, TELE, 0.95)
    const n = 28
    for (let i = 0; i < n * prog; i += 1) {
      if (i % 2) continue
      const a0 = (i / n) * Math.PI * 2 - Math.PI / 2
      const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2
      g.beginPath()
      g.arc(x, y, r, a0, a1, false)
      g.strokePath()
    }
  }

  private drawHud(f: ScoutFrame, box: View): void {
    const u = this.ui
    const L = this.opts.labels
    const top = box.y - 50 * u
    const blink = this.opts.reducedMotion || Math.floor(this.clock * 2) % 2 === 0
    const tc = f.animT
    const sec = Math.floor(tc)
    const tenth = Math.floor((tc - sec) * 10)
    this.rec.setText(`${blink ? '●' : '○'} ${L.rec}  00:0${Math.min(9, sec)}.${tenth}`).setPosition(box.x, top).setColor(blink ? '#ff6b6b' : '#ffb3b3')
    this.clipTxt.setText(`${L.clip} ${f.index + 1}/${this.sg.clips.length}`).setPosition(box.x + box.w, top)
    this.vsTxt.setText(L.vs).setPosition(box.x + box.w / 2, top + 21 * u)
    const showTitle = f.phase === 'title'
    this.title.setVisible(showTitle).setText(`${L.clip} ${f.index + 1}`).setPosition(box.x + box.w / 2, box.y + box.h / 2 - 12 * u)
    this.titleSub.setVisible(showTitle).setText(L.vs).setPosition(box.x + box.w / 2, box.y + box.h / 2 + 22 * u)
    if (showTitle) {
      const g = this.fx
      g.fillStyle(0x000000, 0.45).fillRect(box.x, box.y, box.w, box.h)
    }
    // Hide number texts of actors not in this clip.
    const ids = new Set(f.clip.actors.map((a) => a.id))
    for (const [id, t] of this.nums) if (!ids.has(id)) t.setVisible(false)
  }
}

/** Plays the scouting session in `container` (render-guarded, see startDrill); `onDone` gets the result. */
export function startScouting(container: HTMLElement, sg: ScoutingGame, opts: ScoutingSceneOptions, onDone: (r: ScoutingResult) => void): ScoutingHandle & { readonly game: Phaser.Game } {
  let stopped = false
  let guard: GuardHandle | null = null
  const finish = (r: ScoutingResult) => {
    if (stopped) return
    stopped = true
    onDone(r)
    setTimeout(() => guard?.stop(), 0)
  }
  guard = guardPhaser({
    container,
    host: 'scouting',
    lowGraphics: opts.canvasRenderer,
    build: (renderer, safe) => {
      const game = createMatchGame(container, opts.quality, renderer)
      const launch = safe(() => {
        if (stopped) return
        game.scene.add(SCENE_KEY, ScoutingScene, true, { game: sg, opts, onDone: finish } satisfies SceneData)
      })
      if (game.isBooted) launch()
      else game.events.once(Phaser.Core.Events.READY, launch)
      return game
    },
    onExit: () => opts.onExit?.(),
  })
  const g = guard
  return {
    get game() {
      return g.game as Phaser.Game
    },
    stop() {
      if (stopped) return
      stopped = true
      g.stop()
    },
  }
}
