import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  draw(g)
  const t = new CanvasTexture(c)
  if (srgb) t.colorSpace = SRGBColorSpace
  return t
}

export const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`
export const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif'

/** Soft round glow (lights, flashes, haze puffs). */
export function glowTexture(): CanvasTexture {
  return canvasTexture(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    r.addColorStop(0, 'rgba(255,255,255,1)')
    r.addColorStop(0.22, 'rgba(255,248,230,0.5)')
    r.addColorStop(1, 'rgba(255,248,230,0)')
    g.fillStyle = r
    g.fillRect(0, 0, 128, 128)
  })
}

/** Low-frequency noise for drifting haze sheets (greyscale, tileable enough at low contrast). */
export function hazeTexture(): CanvasTexture {
  const t = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#000'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * 256
      const y = Math.random() * 256
      const r = 30 + Math.random() * 70
      const gr = g.createRadialGradient(x, y, 0, x, y, r)
      gr.addColorStop(0, `rgba(255,255,255,${0.05 + Math.random() * 0.08})`)
      gr.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = gr
      for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) {
        g.save()
        g.translate(dx, dy)
        g.fillRect(x - r, y - r, r * 2, r * 2)
        g.restore()
      }
    }
  }, false)
  t.wrapS = t.wrapT = RepeatWrapping
  return t
}

/** A fan in the stand: head and shoulders, white so the instance colour tints it. */
export function fanTexture(): CanvasTexture {
  return canvasTexture(64, 96, (g) => {
    g.fillStyle = '#fff'
    g.beginPath()
    g.arc(32, 26, 15, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.moveTo(6, 96)
    g.quadraticCurveTo(8, 48, 32, 46)
    g.quadraticCurveTo(56, 48, 58, 96)
    g.closePath()
    g.fill()
  })
}
