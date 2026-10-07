/**
 * Procedural art for the match scene: canvas-generated textures (kits, heads,
 * ball, particles, crowd, vignette) and vector pitch / goal drawing.
 * No external assets are used.
 */
import Phaser from 'phaser'
import type { KitColors } from '../core/types'
import type { Weather } from '../sim/match/types'
import { GOAL_HEIGHT, GOAL_WIDTH, PITCH_LENGTH, PITCH_WIDTH } from '../sim/match/types'
import { NET_DEPTH } from './physics'
import { PPM, TILT, ZS, project } from './view'

/** '#rrggbb' → 0xrrggbb. */
export function colorNum(hex: string): number {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return Number.isFinite(n) ? n : 0xffffff
}

/** Relative luminance 0..1 of a hex colour. */
export function luminance(hex: string): number {
  const n = colorNum(hex)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Mixes two hex colours. */
export function mixHex(a: string, b: string, t: number): string {
  const x = colorNum(a)
  const y = colorNum(b)
  const ch = (s: number) => Math.round((((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t)) & 255
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')
}

const colorDistance = (a: string, b: string) => {
  const x = colorNum(a)
  const y = colorNum(b)
  return Math.hypot(((x >> 16) & 255) - ((y >> 16) & 255), ((x >> 8) & 255) - ((y >> 8) & 255), (x & 255) - (y & 255))
}

/** Picks a keeper kit that contrasts with both outfield kits. */
export function keeperKit(avoid: KitColors[], prefer: number): KitColors {
  const options: KitColors[] = [
    { primary: '#f5c400', secondary: '#1a1a1a', pattern: 'plain' },
    { primary: '#2ee87a', secondary: '#0b3d1f', pattern: 'plain' },
    { primary: '#ff4fa3', secondary: '#2a0a1a', pattern: 'plain' },
    { primary: '#20d4e8', secondary: '#062b30', pattern: 'plain' },
    { primary: '#ff8a1f', secondary: '#2b1300', pattern: 'plain' },
    { primary: '#9b5cff', secondary: '#1b0d33', pattern: 'plain' },
  ]
  let best = options[prefer % options.length]
  let bestD = -1
  for (let i = 0; i < options.length; i++) {
    const o = options[(i + prefer) % options.length]
    const d = Math.min(...avoid.map((k) => colorDistance(o.primary, k.primary)))
    if (d > bestD + 40) {
      bestD = d
      best = o
    }
  }
  return best
}

/** Creates (or replaces) a canvas texture. */
export function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void): string {
  if (scene.textures.exists(key)) scene.textures.remove(key)
  const cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.ceil(w))
  cv.height = Math.max(1, Math.ceil(h))
  const c = cv.getContext('2d')
  if (c) draw(c, cv.width, cv.height)
  scene.textures.addCanvas(key, cv)
  return key
}

/** Body disc with kit pattern and shirt number. */
export function kitTexture(scene: Phaser.Scene, key: string, kit: KitColors, num: number, size = 112): string {
  return canvasTexture(scene, key, size, size, (c, w) => {
    const r = w / 2 - 3
    const cx = w / 2
    const cy = w / 2
    c.save()
    c.beginPath()
    c.arc(cx, cy, r, 0, Math.PI * 2)
    c.closePath()
    c.fillStyle = kit.primary
    c.fill()
    c.clip()
    c.fillStyle = kit.secondary
    const band = w / 7
    switch (kit.pattern) {
      case 'stripes':
        for (let x = -1; x < 8; x += 2) c.fillRect(x * band + band * 0.5, 0, band, w)
        break
      case 'hoops':
        for (let y = -1; y < 8; y += 2) c.fillRect(0, y * band + band * 0.5, w, band)
        break
      case 'halves':
        c.fillRect(cx, 0, w / 2, w)
        break
      case 'sash':
        c.translate(cx, cy)
        c.rotate(-Math.PI / 4)
        c.fillRect(-w, -band * 0.8, w * 2, band * 1.6)
        c.setTransform(1, 0, 0, 1, 0, 0)
        break
      case 'chevron':
        c.beginPath()
        c.moveTo(0, w * 0.25)
        c.lineTo(cx, w * 0.55)
        c.lineTo(w, w * 0.25)
        c.lineTo(w, w * 0.42)
        c.lineTo(cx, w * 0.72)
        c.lineTo(0, w * 0.42)
        c.closePath()
        c.fill()
        break
      case 'plain':
        // Collar trim.
        c.fillRect(cx - band, 0, band * 2, band * 0.7)
        break
    }
    // Soft top-left light for volume.
    const g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.1, cx, cy, r)
    g.addColorStop(0, 'rgba(255,255,255,0.32)')
    g.addColorStop(0.55, 'rgba(255,255,255,0.0)')
    g.addColorStop(1, 'rgba(0,0,0,0.38)')
    c.fillStyle = g
    c.fillRect(0, 0, w, w)
    c.restore()
    // Outline.
    c.beginPath()
    c.arc(cx, cy, r, 0, Math.PI * 2)
    c.lineWidth = Math.max(2, w * 0.035)
    c.strokeStyle = 'rgba(0,0,0,0.65)'
    c.stroke()
    // Number with contrasting fill + outline (none for 0, e.g. training mannequins).
    if (num <= 0) return
    const light = luminance(kit.primary) > 0.55
    c.font = `900 ${Math.round(w * 0.46)}px system-ui, 'Segoe UI', Roboto, Arial, sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.lineWidth = w * 0.06
    c.strokeStyle = light ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.75)'
    c.strokeText(String(num), cx, cy + w * 0.03)
    c.fillStyle = light ? '#111' : '#fff'
    c.fillText(String(num), cx, cy + w * 0.03)
  })
}

const SKINS = ['#f1c9a5', '#e0ac7e', '#c68c5c', '#a86b3f', '#7a4a2a', '#56331c']
const HAIRS = ['#1b1209', '#3b2412', '#6b4423', '#a8763e', '#d9b36c', '#222222', '#8c2f12']

/**
 * Head (skin + hair cap) texture variant chosen by an index. Female heads add
 * a ponytail (or a bun for every third variant) in a wider margin: the canvas
 * grows but the head keeps the same radius, so callers scale by `size` alike.
 */
export function headTexture(scene: Phaser.Scene, idx: number, size = 56, female = false): string {
  const v = idx % 42
  const key = female ? `headf_${v}` : `head_${v}`
  if (scene.textures.exists(key)) return key
  const skin = SKINS[idx % SKINS.length]
  const hair = HAIRS[Math.floor(idx / SKINS.length) % HAIRS.length]
  const pad = female ? Math.round(size * 0.2) : 0
  const W = size + pad * 2
  return canvasTexture(scene, key, W, W, (c, w) => {
    const r = size / 2 - 2
    if (female) {
      // Tail/bun sits behind the head, drawn first; dark rim for readability.
      c.fillStyle = hair
      c.strokeStyle = 'rgba(0,0,0,0.55)'
      c.lineWidth = 2
      c.beginPath()
      if (v % 3 === 2) c.arc(w / 2, w / 2 - r * 0.95, r * 0.42, 0, Math.PI * 2)
      else c.ellipse(w / 2 + r * 0.82, w / 2 + r * 0.78, r * 0.32, r * 0.66, -0.6, 0, Math.PI * 2)
      c.fill()
      c.stroke()
    }
    c.beginPath()
    c.arc(w / 2, w / 2, r, 0, Math.PI * 2)
    c.fillStyle = skin
    c.fill()
    c.save()
    c.clip()
    c.fillStyle = hair
    c.beginPath()
    c.ellipse(w / 2, w / 2 - r * 0.6, r * 1.05, r * 0.72, 0, 0, Math.PI * 2)
    c.fill()
    if (female) {
      // Longer sides framing the face + a light hair band.
      c.beginPath()
      c.ellipse(w / 2 - r * 0.92, w / 2 + r * 0.05, r * 0.3, r * 0.75, 0, 0, Math.PI * 2)
      c.ellipse(w / 2 + r * 0.92, w / 2 + r * 0.05, r * 0.3, r * 0.75, 0, 0, Math.PI * 2)
      c.fill()
      c.strokeStyle = 'rgba(255,255,255,0.55)'
      c.lineWidth = Math.max(1.5, r * 0.09)
      c.beginPath()
      c.arc(w / 2, w / 2 + r * 0.25, r * 0.98, Math.PI * 1.2, Math.PI * 1.8)
      c.stroke()
    }
    const g = c.createRadialGradient(w / 2 - r * 0.3, w / 2 - r * 0.4, 1, w / 2, w / 2, r)
    g.addColorStop(0, 'rgba(255,255,255,0.25)')
    g.addColorStop(1, 'rgba(0,0,0,0.3)')
    c.fillStyle = g
    c.fillRect(0, 0, w, w)
    c.restore()
    c.lineWidth = 2
    c.strokeStyle = 'rgba(0,0,0,0.55)'
    c.beginPath()
    c.arc(w / 2, w / 2, r, 0, Math.PI * 2)
    c.stroke()
  })
}

/** Classic black/white ball. */
export function ballTexture(scene: Phaser.Scene, weather: Weather, size = 64): string {
  const key = `ball_${weather}`
  return canvasTexture(scene, key, size, size, (c, w) => {
    const r = w / 2 - 2
    const cx = w / 2
    c.beginPath()
    c.arc(cx, cx, r, 0, Math.PI * 2)
    c.fillStyle = weather === 'snow' ? '#ff7a1a' : '#fbfbf7'
    c.fill()
    c.save()
    c.clip()
    c.fillStyle = weather === 'snow' ? '#3a1600' : '#1b1b1b'
    const patch = (x: number, y: number, s: number) => {
      c.beginPath()
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5
        c.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s)
      }
      c.closePath()
      c.fill()
    }
    patch(cx, cx, r * 0.3)
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5 + Math.PI / 5
      patch(cx + Math.cos(a) * r * 0.86, cx + Math.sin(a) * r * 0.86, r * 0.26)
    }
    const g = c.createRadialGradient(cx - r * 0.35, cx - r * 0.4, r * 0.05, cx, cx, r)
    g.addColorStop(0, 'rgba(255,255,255,0.6)')
    g.addColorStop(0.5, 'rgba(255,255,255,0)')
    g.addColorStop(1, 'rgba(0,0,0,0.45)')
    c.fillStyle = g
    c.fillRect(0, 0, w, w)
    c.restore()
    c.lineWidth = 1.5
    c.strokeStyle = 'rgba(0,0,0,0.6)'
    c.beginPath()
    c.arc(cx, cx, r, 0, Math.PI * 2)
    c.stroke()
  })
}

/** Small utility textures: soft dot, square, glow ring, soft shadow, vignette. */
export function utilTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, 'fx_dot', 16, 16, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.6, 'rgba(255,255,255,0.8)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = g
    c.fillRect(0, 0, w, w)
  })
  canvasTexture(scene, 'fx_sq', 8, 8, (c, w) => {
    c.fillStyle = '#fff'
    c.fillRect(0, 0, w, w)
  })
  canvasTexture(scene, 'fx_streak', 4, 32, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(1, 'rgba(255,255,255,0.9)')
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
  })
  canvasTexture(scene, 'fx_shadow', 64, 32, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(0,0,0,0.55)')
    g.addColorStop(0.7, 'rgba(0,0,0,0.25)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    c.fillStyle = g
    c.save()
    c.scale(1, h / w)
    c.beginPath()
    c.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2)
    c.fill()
    c.restore()
  })
  canvasTexture(scene, 'fx_glow', 128, 128, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, w * 0.18, w / 2, w / 2, w / 2)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.55, 'rgba(255,255,255,0.85)')
    g.addColorStop(0.7, 'rgba(255,255,255,0.35)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = g
    c.fillRect(0, 0, w, w)
  })
  canvasTexture(scene, 'fx_vignette', 256, 256, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, w * 0.28, w / 2, w / 2, w * 0.72)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,1)')
    c.fillStyle = g
    c.fillRect(0, 0, w, w)
  })
}

/** Grass palette per weather. */
function grass(weather: Weather): [string, string, string] {
  switch (weather) {
    case 'rain':
      return ['#2f7a37', '#3a8a40', '#24602b']
    case 'snow':
      return ['#7fa58a', '#8db395', '#6c917a']
    case 'hot':
      return ['#5f9a3b', '#6da844', '#4f8432']
    default:
      return ['#3d8c3a', '#49993f', '#2f7330']
  }
}

/** Draws the static pitch (stripes, apron, lines, arcs, spots) into a Graphics. */
export function drawPitch(g: Phaser.GameObjects.Graphics, weather: Weather): void {
  const [c1, c2, apron] = grass(weather)
  const P = (x: number, y: number) => project(x, y)
  const rect = (x0: number, y0: number, x1: number, y1: number) => {
    const a = P(x0, y0)
    const b = P(x1, y1)
    g.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y))
  }
  // Apron (beyond the lines).
  // Only up to the stands (behind the far goal and along both touchlines) so the crowd stays visible.
  g.fillStyle(colorNum(apron), 1)
  rect(-16, -5.5, PITCH_LENGTH + 6.2, PITCH_WIDTH + 5.5)
  // Mowing stripes (along the length) with a faint cross-hatch.
  const n = 18
  const sw = (PITCH_LENGTH + 6) / n
  for (let i = 0; i < n; i++) {
    g.fillStyle(colorNum(i % 2 ? c1 : c2), 1)
    rect(-3 + i * sw, -3, -3 + (i + 1) * sw, PITCH_WIDTH + 3)
  }
  g.fillStyle(0xffffff, 0.035)
  for (let j = 0; j < 10; j += 2) rect(-3, -3 + (j * (PITCH_WIDTH + 6)) / 10, PITCH_LENGTH + 3, -3 + ((j + 1) * (PITCH_WIDTH + 6)) / 10)
  // Edge darkening toward the stands.
  g.fillStyle(0x000000, 0.12)
  rect(-16, -5.5, PITCH_LENGTH + 6.2, -4)
  rect(-16, PITCH_WIDTH + 4, PITCH_LENGTH + 6.2, PITCH_WIDTH + 5.5)

  if (weather === 'snow') {
    g.fillStyle(0xffffff, 0.12)
    rect(-9, -6, PITCH_LENGTH + 9, PITCH_WIDTH + 6)
  }

  // Lines.
  const lw = 0.12 * PPM
  g.lineStyle(lw, 0xffffff, weather === 'snow' ? 0.6 : 0.88)
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const a = P(x0, y0)
    const b = P(x1, y1)
    g.lineBetween(a.x, a.y, b.x, b.y)
  }
  const box = (x0: number, y0: number, x1: number, y1: number) => {
    line(x0, y0, x1, y0)
    line(x1, y0, x1, y1)
    line(x1, y1, x0, y1)
    line(x0, y1, x0, y0)
  }
  box(0, 0, PITCH_LENGTH, PITCH_WIDTH)
  line(PITCH_LENGTH / 2, 0, PITCH_LENGTH / 2, PITCH_WIDTH)
  const cy = PITCH_WIDTH / 2
  const pa = 40.32 / 2
  const ga = 18.32 / 2
  box(0, cy - pa, 16.5, cy + pa)
  box(PITCH_LENGTH - 16.5, cy - pa, PITCH_LENGTH, cy + pa)
  box(0, cy - ga, 5.5, cy + ga)
  box(PITCH_LENGTH - 5.5, cy - ga, PITCH_LENGTH, cy + ga)

  const arc = (cx: number, cyy: number, r: number, a0: number, a1: number, keep: (x: number, y: number) => boolean = () => true) => {
    let pen = false
    const steps = 72
    g.beginPath()
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps
      const x = cx + Math.cos(a) * r
      const y = cyy + Math.sin(a) * r
      const p = P(x, y)
      if (!keep(x, y)) {
        pen = false
        continue
      }
      if (!pen) g.moveTo(p.x, p.y)
      else g.lineTo(p.x, p.y)
      pen = true
    }
    g.strokePath()
  }
  arc(PITCH_LENGTH / 2, cy, 9.15, 0, Math.PI * 2)
  arc(11, cy, 9.15, -Math.PI / 2, Math.PI / 2, (x) => x > 16.5)
  arc(PITCH_LENGTH - 11, cy, 9.15, Math.PI / 2, Math.PI * 1.5, (x) => x < PITCH_LENGTH - 16.5)
  arc(0, 0, 1, 0, Math.PI / 2)
  arc(PITCH_LENGTH, 0, 1, Math.PI / 2, Math.PI)
  arc(0, PITCH_WIDTH, 1, -Math.PI / 2, 0)
  arc(PITCH_LENGTH, PITCH_WIDTH, 1, Math.PI, Math.PI * 1.5)
  // Spots.
  g.fillStyle(0xffffff, 0.9)
  for (const [x, y] of [[11, cy], [PITCH_LENGTH - 11, cy], [PITCH_LENGTH / 2, cy]] as const) {
    const p = P(x, y)
    g.fillEllipse(p.x, p.y, 0.2 * PPM, 0.2 * PPM * TILT)
  }
}

/** Net ripple state for one goal. */
export interface NetRipple {
  t: number
  y: number
  z: number
  strength: number
}

/**
 * Draws a goal (net + frame). `ripple` displaces the net outward around the impact.
 * @param end 'east' (x = 105) or 'west' (x = 0)
 * @param part 'net' draws the mesh, 'frame' the posts and bar (drawn in front)
 */
export function drawGoal(g: Phaser.GameObjects.Graphics, end: 'east' | 'west', part: 'net' | 'frame', ripple: NetRipple | null): void {
  const gx = end === 'east' ? PITCH_LENGTH : 0
  const out = end === 'east' ? 1 : -1
  const y0 = PITCH_WIDTH / 2 - GOAL_WIDTH / 2
  const y1 = PITCH_WIDTH / 2 + GOAL_WIDTH / 2
  const H = GOAL_HEIGHT
  const backTop = 1.6
  const disp = (y: number, z: number) => {
    if (!ripple) return 0
    const d2 = (y - ripple.y) ** 2 + (z - ripple.z) ** 2
    return ripple.strength * Math.exp(-d2 / 1.4) * Math.sin(ripple.t * 18) * Math.exp(-ripple.t * 3.2)
  }
  if (part === 'net') {
    // Back panel and roof mesh.
    g.lineStyle(1.2, 0xffffff, 0.38)
    const backX = (y: number, z: number) => gx + out * (NET_DEPTH + disp(y, z))
    const steps = 14
    for (let i = 0; i <= steps; i++) {
      const y = y0 + ((y1 - y0) * i) / steps
      // Vertical strand on the back panel from ground to back-top, then roof to the crossbar.
      const a = project(backX(y, 0), y, 0)
      const b = project(backX(y, backTop), y, backTop)
      const c = project(gx, y, H)
      g.lineBetween(a.x, a.y, b.x, b.y)
      g.lineBetween(b.x, b.y, c.x, c.y)
    }
    for (let k = 0; k <= 6; k++) {
      const z = (backTop * k) / 6
      g.beginPath()
      for (let i = 0; i <= steps; i++) {
        const y = y0 + ((y1 - y0) * i) / steps
        const p = project(backX(y, z), y, z)
        if (i === 0) g.moveTo(p.x, p.y)
        else g.lineTo(p.x, p.y)
      }
      g.strokePath()
    }
    // Roof cross-lines.
    for (let k = 1; k < 4; k++) {
      const f = k / 4
      g.beginPath()
      for (let i = 0; i <= steps; i++) {
        const y = y0 + ((y1 - y0) * i) / steps
        const z = H + (backTop - H) * f
        const p = project(gx + out * (NET_DEPTH + disp(y, z)) * f, y, z)
        if (i === 0) g.moveTo(p.x, p.y)
        else g.lineTo(p.x, p.y)
      }
      g.strokePath()
    }
    // Side panels.
    for (const y of [y0, y1]) {
      for (let k = 0; k <= 4; k++) {
        const f = k / 4
        const a = project(gx + out * NET_DEPTH * f, y, 0)
        const b = project(gx + out * NET_DEPTH * f, y, H + (backTop - H) * f)
        g.lineBetween(a.x, a.y, b.x, b.y)
      }
    }
    // Shadow under the goal.
    g.fillStyle(0x000000, 0.18)
    const s0 = project(gx, y0)
    const s1 = project(gx + out * NET_DEPTH, y1)
    g.fillRect(Math.min(s0.x, s1.x), Math.min(s0.y, s1.y), Math.abs(s1.x - s0.x), Math.abs(s1.y - s0.y))
    return
  }
  // Frame: posts + crossbar, white with a dark edge.
  const postW = 0.14 * PPM
  for (const [w, col, a] of [[postW + 3, 0x222222, 0.6], [postW, 0xffffff, 1]] as const) {
    g.lineStyle(w, col, a)
    const p0 = project(gx, y0, 0)
    const p0t = project(gx, y0, H)
    const p1 = project(gx, y1, 0)
    const p1t = project(gx, y1, H)
    g.lineBetween(p0.x, p0.y, p0t.x, p0t.y)
    g.lineBetween(p1.x, p1.y, p1t.x, p1t.y)
    g.lineBetween(p0t.x, p0t.y, p1t.x, p1t.y)
  }
}

const BRANDS = ['STARPATH', 'NOVA BANK', 'PIXEL COLA', 'ORBIT AIR', 'YILDIZ YOLU', 'KICKR', 'LUMEN TV', 'NORTH GEAR', 'VOLTA', 'GOAL+']
const LOCAL_BRANDS = ['OTO TAMİR', 'FIRIN', 'KASAP', 'NALBUR', 'ECZANE', 'KUAFÖR']

/** Like {@link canvasTexture} but reuses an existing texture under the same key (keys must encode every parameter). */
export function cachedTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void): string {
  if (scene.textures.exists(key)) return key
  return canvasTexture(scene, key, w, h, draw)
}

export type AdStyle = 'painted' | 'boards' | 'led' | 'led-glow'

/** Ad-board strip texture (one long canvas, tiled brands). Cached per key + style. */
export function adBoardTexture(scene: Phaser.Scene, key: string, lengthM: number, seed: number, style: AdStyle = 'boards'): string {
  const pxPerM = PPM * 1.5
  const w = Math.ceil(lengthM * pxPerM)
  const h = Math.ceil(0.9 * pxPerM * ZS)
  return cachedTexture(scene, `${key}_${style}_${seed}_${Math.round(lengthM)}`, w, h, (c) => {
    const led = style === 'led' || style === 'led-glow'
    const palette = style === 'painted'
      ? ['#e9e4d6', '#2f4f6b', '#7a2c22', '#dcd2b0', '#3e5a35']
      : led ? ['#0016ff', '#ff1f4b', '#00c2ff', '#ffd400', '#00e07a', '#b100ff', '#ffffff'] : ['#0b1f4a', '#c4122f', '#111111', '#f2b705', '#0f6b3a', '#5a1f8f', '#e8e8e8']
    const brands = style === 'painted' ? LOCAL_BRANDS : BRANDS
    const seg = (style === 'painted' ? 9 : 14) * pxPerM
    for (let i = 0, x = 0; x < w; i++, x += seg) {
      const bg = palette[(i + seed) % palette.length]
      c.fillStyle = led ? '#05070c' : bg
      c.fillRect(x, 0, seg, h)
      if (led) {
        // LED panel: dark matrix, glowing brand.
        const g = c.createLinearGradient(x, 0, x, h)
        g.addColorStop(0, bg)
        g.addColorStop(1, mixHex(bg, '#000000', 0.55))
        c.fillStyle = g
        c.globalAlpha = 0.85
        c.fillRect(x + 1, 1, seg - 2, h - 2)
        c.globalAlpha = 1
      }
      c.fillStyle = led ? '#ffffff' : luminance(bg) > 0.5 ? '#111' : '#fff'
      if (led) {
        c.shadowColor = '#ffffff'
        c.shadowBlur = style === 'led-glow' ? h * 0.35 : h * 0.15
      }
      c.font = `${style === 'painted' ? 700 : 900} ${Math.round(h * (style === 'painted' ? 0.48 : 0.62))}px system-ui, 'Segoe UI', Arial, sans-serif`
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(brands[(i * 3 + seed) % brands.length], x + seg / 2, h * 0.54)
      c.shadowBlur = 0
      if (style === 'painted') {
        c.fillStyle = 'rgba(0,0,0,0.25)'
        c.fillRect(x + seg - 2, 0, 2, h)
      }
    }
    if (led) {
      // Pixel grid.
      c.fillStyle = 'rgba(0,0,0,0.22)'
      for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1)
    }
    c.fillStyle = `rgba(255,255,255,${style === 'painted' ? 0.08 : 0.18})`
    c.fillRect(0, 0, w, h * 0.12)
    c.fillStyle = 'rgba(0,0,0,0.35)'
    c.fillRect(0, h * 0.9, w, h * 0.1)
  })
}

export interface CrowdOptions {
  /** Share of filled seats 0..1 (default 0.9). */
  density?: number
  upperTier?: boolean
  roof?: boolean
  tifo?: boolean
  /** Lamps along the roof edge. */
  roofLights?: boolean
  night?: boolean
  snow?: boolean
}

/**
 * Crowd band texture: tiers of coloured heads in team colours. Cached: the key
 * encodes size, palette and options so a rebuilt scene reuses the canvas.
 */
export function crowdTexture(scene: Phaser.Scene, key: string, lengthM: number, depthM: number, colors: string[], seed: number, o: CrowdOptions = {}): string {
  const pxPerM = PPM
  const w = Math.ceil(lengthM * pxPerM)
  const h = Math.ceil(depthM * pxPerM)
  const density = o.density ?? 0.9
  const flags = `${o.upperTier ? 'u' : ''}${o.roof ? 'r' : ''}${o.tifo ? 't' : ''}${o.roofLights ? 'l' : ''}${o.night ? 'n' : ''}${o.snow ? 's' : ''}`
  const ck = `${key}_${Math.round(lengthM)}x${Math.round(depthM)}_${colors.join('')}_${seed}_${Math.round(density * 100)}${flags}`
  let s = seed >>> 0 || 1
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  return cachedTexture(scene, ck, w, h, (c) => {
    const g = c.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, o.night ? '#020309' : '#05080d')
    g.addColorStop(1, o.night ? '#121826' : '#1a2230')
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
    const roofH = o.roof ? Math.min(h * 0.14, 3.2 * pxPerM) : 0
    const balcony = o.upperTier ? { y: h * 0.48, h: Math.max(8, h * 0.06) } : null
    const rows = Math.floor((h - roofH) / 9)
    const tifoBand = (x: number) => Math.floor(x / (6 * pxPerM)) % 2
    for (let r = 0; r < rows; r++) {
      const y = h - 6 - r * 9
      if (balcony && y > balcony.y - 4 && y < balcony.y + balcony.h + 4) continue
      // Tier step shading.
      c.fillStyle = r % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.12)'
      c.fillRect(0, y - 4, w, 9)
      for (let x = 2 + (r % 2) * 3; x < w; x += 6 + rnd() * 2) {
        if (rnd() > density) {
          // Empty seat.
          c.globalAlpha = 0.5
          c.fillStyle = '#3a4a63'
          c.fillRect(x, y - 1, 3.2, 2.2)
          continue
        }
        const roll = rnd()
        const tifo = o.tifo && y > h * 0.55 && rnd() < 0.85
        c.fillStyle = tifo ? colors[tifoBand(x)] : roll < 0.45 ? colors[0] : roll < 0.6 ? colors[1] : roll < 0.8 ? '#d8d2c8' : roll < 0.9 ? '#2a2a2a' : colors[2] ?? '#888'
        c.globalAlpha = tifo ? 0.95 : 0.55 + rnd() * 0.45
        c.fillRect(x, y - 2 + rnd() * 2, 3.2, 3.6)
      }
    }
    c.globalAlpha = 1
    if (balcony) {
      c.fillStyle = '#0a0d14'
      c.fillRect(0, balcony.y, w, balcony.h)
      c.fillStyle = 'rgba(255,255,255,0.18)'
      c.fillRect(0, balcony.y, w, 1.5)
    }
    if (roofH > 0) {
      c.fillStyle = o.snow ? '#dfe7ef' : '#1d232e'
      c.fillRect(0, 0, w, roofH)
      c.fillStyle = 'rgba(0,0,0,0.5)'
      c.fillRect(0, roofH - 3, w, 3)
      if (o.roofLights) {
        for (let x = 10; x < w; x += 22) {
          c.fillStyle = o.night ? '#fffbe8' : '#c9d3e6'
          c.fillRect(x, roofH - 7, 12, 4)
        }
      }
    }
    // Haze toward the top (floodlight glare).
    const haze = c.createLinearGradient(0, 0, 0, h * 0.5)
    haze.addColorStop(0, o.night ? 'rgba(255,245,210,0.16)' : 'rgba(180,200,255,0.10)')
    haze.addColorStop(1, 'rgba(180,200,255,0)')
    c.fillStyle = haze
    c.fillRect(0, 0, w, h)
  })
}

/** Weather ground layer: rain puddle sheen or snow dusting (one static draw). */
export function drawWeatherGround(g: Phaser.GameObjects.Graphics, weather: Weather, seed: number, lowFx = false): void {
  let s = seed >>> 0 || 7
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  if (weather === 'rain') {
    const n = lowFx ? 10 : 22
    for (let i = 0; i < n; i++) {
      const p = project(4 + rnd() * (PITCH_LENGTH - 8), 3 + rnd() * (PITCH_WIDTH - 6))
      const rw = (2.5 + rnd() * 5) * PPM
      const rh = rw * TILT * (0.35 + rnd() * 0.3)
      g.fillStyle(0xcfe3ff, 0.06 + rnd() * 0.05)
      g.fillEllipse(p.x, p.y, rw, rh)
      g.fillStyle(0xffffff, 0.05)
      g.fillEllipse(p.x - rw * 0.12, p.y - rh * 0.15, rw * 0.45, rh * 0.3)
    }
    // Overall wet sheen.
    const a = project(PITCH_LENGTH + 6, -5)
    const b = project(-16, PITCH_WIDTH + 5)
    g.fillStyle(0x8fb4d9, 0.06)
    g.fillRect(a.x, a.y, b.x - a.x, b.y - a.y)
  } else if (weather === 'snow') {
    const n = lowFx ? 500 : 1400
    for (let i = 0; i < n; i++) {
      const p = project(-4 + rnd() * (PITCH_LENGTH + 9), -5 + rnd() * (PITCH_WIDTH + 10))
      g.fillStyle(0xffffff, 0.18 + rnd() * 0.3)
      g.fillCircle(p.x, p.y, (0.06 + rnd() * 0.12) * PPM)
    }
    // Drifts along the touchlines.
    for (const yy of [-4.5, PITCH_WIDTH + 4.5]) {
      for (let x = -4; x < PITCH_LENGTH + 5; x += 3) {
        const p = project(x, yy)
        g.fillStyle(0xf4f8ff, 0.55)
        g.fillEllipse(p.x, p.y, (1.6 + rnd()) * PPM, 2.4 * PPM * TILT)
      }
    }
  }
}
