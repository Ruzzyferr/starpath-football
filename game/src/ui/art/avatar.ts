/**
 * Procedural portrait (bust) from an Appearance. Stylized, flat-shaded vector
 * with a soft key light — aims for "premium sports-game card", not cartoon.
 *
 * Returns an SVG string (viewBox 0 0 120 120). Deterministic: same input →
 * byte-identical output, so it can be cached / rasterised for Phaser.
 */
import type { Appearance, Gender } from '../../core/types'
import { mix, shade, svgWrap, uid } from './svg'

export const SKIN_TONES = [
  '#f7dcc8', '#f0c8a8', '#e6b48e', '#d9a077', '#c68a62', '#ae744e', '#93603e', '#7a4c30', '#5f3a24', '#47291a',
] as const
export const HAIR_COLORS = [
  '#16110e', '#2c1d14', '#4a2f1d', '#6e4628', '#9a6a3a', '#c99a5b', '#e3c78a', '#a3471e', '#6e2a1a', '#8a8f99',
] as const
export const EYE_COLORS = ['#3b2414', '#5a3820', '#7a5a2e', '#4f7a3a', '#3f6fa8', '#6b7d8c'] as const
export const HAIR_STYLE_COUNT = 15
/** Female hair styles (a separate index space, used when `appearance.gender === 'female'`). */
export const FEMALE_HAIR_STYLE_COUNT = 12
export const BEARD_COUNT = 8
export const FACE_COUNT = 6
export const ACCESSORY_COUNT = 6

export interface AvatarOpts {
  /** Shirt colours (defaults to slate). */
  shirt?: string
  shirtTrim?: string
  /** Circular background colour; null = transparent. */
  background?: string | null
  /** −1 (sad) .. 1 (happy). */
  mood?: number
  age?: number
  title?: string
  /** Overrides `appearance.gender` (missing on both = male). */
  gender?: Gender
}

/** Hair style count for a gender (the wizard's option list). */
export const hairStyleCount = (g: Gender | undefined): number => (g === 'female' ? FEMALE_HAIR_STYLE_COUNT : HAIR_STYLE_COUNT)

interface FaceGeo {
  hw: number // half width at cheekbones
  jw: number // half width at jaw corner
  cw: number // chin half width
  cy: number // chin y
}
const FACES: FaceGeo[] = [
  { hw: 29, jw: 22, cw: 8, cy: 95 }, // oval
  { hw: 31, jw: 25, cw: 12, cy: 93 }, // round
  { hw: 30, jw: 27, cw: 15, cy: 94 }, // square
  { hw: 27.5, jw: 21, cw: 9, cy: 98 }, // long
  { hw: 31, jw: 19, cw: 6, cy: 95 }, // heart
  { hw: 31.5, jw: 22, cw: 9, cy: 96 }, // diamond / high cheekbones
]

const mod = (v: number, n: number) => ((Math.trunc(v) % n) + n) % n
const f = (n: number) => n.toFixed(1)

function headPath(g: FaceGeo): string {
  const { hw, jw, cw, cy } = g
  return [
    `M60 24`,
    `C${f(60 + hw * 0.66)} 24 ${f(60 + hw)} 36 ${f(60 + hw)} 55`,
    `C${f(60 + hw)} 68 ${f(60 + jw + 4)} 77 ${f(60 + jw)} 84`,
    `C${f(60 + jw - 4)} 91 ${f(60 + cw + 5)} ${f(cy)} 60 ${f(cy)}`,
    `C${f(60 - cw - 5)} ${f(cy)} ${f(60 - jw + 4)} 91 ${f(60 - jw)} 84`,
    `C${f(60 - jw - 4)} 77 ${f(60 - hw)} 68 ${f(60 - hw)} 55`,
    `C${f(60 - hw)} 36 ${f(60 - hw * 0.66)} 24 60 24Z`,
  ].join('')
}

/** Lower-face region used for beards (follows jaw, opens at the cheeks). */
function beardRegion(g: FaceGeo, extend = 0, cheekY = 64): string {
  const { hw, jw, cw, cy } = g
  const by = cy + extend
  return [
    `M${f(60 - hw + 0.5)} ${cheekY}`,
    `C${f(60 - hw)} 70 ${f(60 - jw - 4)} 77 ${f(60 - jw)} 84`,
    `C${f(60 - jw + 4)} ${f(91 + extend * 0.6)} ${f(60 - cw - 5)} ${f(by)} 60 ${f(by)}`,
    `C${f(60 + cw + 5)} ${f(by)} ${f(60 + jw - 4)} ${f(91 + extend * 0.6)} ${f(60 + jw)} 84`,
    `C${f(60 + jw + 4)} 77 ${f(60 + hw)} 70 ${f(60 + hw - 0.5)} ${cheekY}`,
    `C${f(60 + hw - 6)} 72 ${f(60 + 14)} 76 ${f(60 + 8)} 78`,
    `C64 76.5 62 76 60 76.2`,
    `C58 76 56 76.5 52 78`,
    `C${f(60 - 14)} 76 ${f(60 - hw + 6)} 72 ${f(60 - hw + 0.5)} ${cheekY}Z`,
  ].join('')
}

const MUSTACHE = 'M51.5 80.5C53 77 57 76.2 60 77.4C63 76.2 67 77 68.5 80.5C66 79.4 63 79.3 60 80C57 79.3 54 79.4 51.5 80.5Z'

function hairBack(style: number, g: FaceGeo, c: string): string {
  const { hw } = g
  switch (style) {
    case 5: // afro
      return `<circle cx="60" cy="46" r="${f(hw + 15)}" fill="${c}"/>`
    case 6: // long flow
      return `<path d="M${f(60 - hw - 6)} 46C${f(60 - hw - 10)} 70 ${f(60 - hw - 8)} 96 ${f(60 - hw + 2)} 106L${f(60 + hw - 2)} 106C${f(60 + hw + 8)} 96 ${f(60 + hw + 10)} 70 ${f(60 + hw + 6)} 46Z" fill="${c}"/>`
    case 7: // man bun
      return `<circle cx="60" cy="14" r="9" fill="${c}"/><circle cx="57" cy="11" r="3" fill="#fff" opacity=".08"/>`
    case 10: { // twists
      let s = ''
      for (let i = 0; i < 7; i++) {
        const x = 60 - hw - 3 + i * 3.2
        const x2 = 60 + hw + 3 - i * 3.2
        const len = 82 - i * 3
        s += `<path d="M${f(x)} 40L${f(x - 1)} ${len}" stroke="${c}" stroke-width="4.2" stroke-linecap="round"/>`
        s += `<path d="M${f(x2)} 40L${f(x2 + 1)} ${len}" stroke="${c}" stroke-width="4.2" stroke-linecap="round"/>`
      }
      return s
    }
    default:
      return ''
  }
}

function hairFront(style: number, g: FaceGeo, c: string, dark: string): string {
  const { hw } = g
  const L = 60 - hw - 1.5
  const R = 60 + hw + 1.5
  /** Generic cap: crown height `top`, hairline height `hl`, side drop `sd`. */
  const cap = (top: number, hl: number, sd: number, extra = '') =>
    `<path d="M${f(L)} ${sd}C${f(L - 1)} ${top + 14} ${f(60 - hw * 0.55)} ${top} 60 ${top}C${f(60 + hw * 0.55)} ${top} ${f(R + 1)} ${top + 14} ${f(R)} ${sd}L${f(R - 3)} ${sd - 2}C${f(R - 4)} ${hl - 2} ${f(60 + hw * 0.5)} ${hl - 3} 60 ${hl}C${f(60 - hw * 0.5)} ${hl - 3} ${f(L + 4)} ${hl - 2} ${f(L + 3)} ${sd - 2}Z" fill="${c}"${extra}/>`
  switch (style) {
    case 0: // buzz
      return cap(21, 39, 50, ' opacity=".9"')
    case 1: // short crop
      return cap(17, 40, 54)
    case 2: // side part
      return cap(15, 42, 55) +
        `<path d="M${f(L + 2)} 47C${f(L + 6)} 34 ${f(60 - 6)} 30 ${f(R - 4)} 36C${f(60 + 4)} 31 ${f(60 - 8)} 30 ${f(L + 5)} 42Z" fill="${c}"/>` +
        `<path d="M${f(60 - hw * 0.45)} 19L${f(60 - hw * 0.5)} 33" stroke="${dark}" stroke-width="1.2" opacity=".6"/>`
    case 3: // quiff
      return cap(18, 40, 54) +
        `<path d="M${f(60 - hw * 0.8)} 34C${f(60 - hw * 0.7)} 12 ${f(60 + hw * 0.2)} 2 ${f(60 + hw * 0.9)} 12C${f(60 + hw * 0.5)} 12 ${f(60 + hw * 0.3)} 18 ${f(60 + hw * 0.6)} 30Z" fill="${c}"/>` +
        `<path d="M${f(60 - hw * 0.4)} 22C${f(60)} 10 ${f(60 + hw * 0.5)} 10 ${f(60 + hw * 0.7)} 14" stroke="#fff" stroke-opacity=".12" stroke-width="2" fill="none"/>`
    case 4: { // curly top
      let s = cap(18, 40, 52)
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI
        const x = 60 + Math.cos(a) * (hw - 1)
        const y = 36 + Math.sin(a) * 20
        s += `<circle cx="${f(x)}" cy="${f(y)}" r="5.6" fill="${c}"/>`
      }
      for (let i = 0; i < 6; i++) s += `<circle cx="${f(60 - hw * 0.6 + i * hw * 0.24)}" cy="${f(18 + (i % 2) * 3)}" r="1.4" fill="#fff" opacity=".08"/>`
      return s
    }
    case 5: // afro front hairline
      return cap(14, 40, 56)
    case 6: // long flow, centre part
      return cap(16, 41, 64) + `<path d="M60 17L60 36" stroke="${dark}" stroke-width="1.2" opacity=".55"/>` +
        `<path d="M60 36C${f(60 - 8)} 38 ${f(L + 3)} 46 ${f(L + 1)} 64L${f(L - 3)} 64L${f(L - 2)} 44Z" fill="${c}"/><path d="M60 36C${f(60 + 8)} 38 ${f(R - 3)} 46 ${f(R - 1)} 64L${f(R + 3)} 64L${f(R + 2)} 44Z" fill="${c}"/>`
    case 7: // bun, slicked
      return cap(18, 38, 50) + `<path d="M${f(60 - hw * 0.6)} 26Q60 18 ${f(60 + hw * 0.6)} 26" stroke="${dark}" stroke-width="1" fill="none" opacity=".5"/>`
    case 8: // faux-hawk
      return cap(22, 40, 50, ' opacity=".55"') +
        `<path d="M${f(60 - 9)} 40C${f(60 - 10)} 22 ${f(60 - 6)} 8 60 4C${f(60 + 6)} 8 ${f(60 + 10)} 22 ${f(60 + 9)} 40Z" fill="${c}"/>`
    case 9: // bald
      return `<ellipse cx="${f(60 - hw * 0.35)}" cy="32" rx="9" ry="5" fill="#fff" opacity=".12" transform="rotate(-20 ${f(60 - hw * 0.35)} 32)"/>`
    case 10: // twists front
      return cap(16, 40, 54) + Array.from({ length: 7 }, (_, i) => {
        const x = 60 - hw * 0.75 + i * hw * 0.25
        return `<path d="M${f(x)} 20L${f(x + 1)} ${38 + (i % 2) * 4}" stroke="${dark}" stroke-width="1" opacity=".5"/>`
      }).join('')
    case 11: // slick back
      return cap(16, 34, 50) + [0, 1, 2].map((i) =>
        `<path d="M${f(60 - hw * 0.6 + i * hw * 0.55)} 34Q${f(60 - hw * 0.5 + i * hw * 0.5)} 22 ${f(60 - hw * 0.3 + i * hw * 0.45)} 16" stroke="${dark}" stroke-width="1" fill="none" opacity=".45"/>`).join('')
    case 12: { // textured fringe
      let zig = ''
      const n = 8
      for (let i = 0; i <= n; i++) {
        const x = L + 3 + ((R - L - 6) * i) / n
        zig += `L${f(x)} ${i % 2 ? 46 : 41}`
      }
      return cap(16, 38, 52) + `<path d="M${f(L + 2)} 40${zig}L${f(R - 2)} 38L${f(R - 6)} 30L${f(L + 6)} 30Z" fill="${c}"/>`
    }
    case 13: // cornrows
      return cap(18, 39, 50) + [-3, -1.5, 0, 1.5, 3].map((k) =>
        `<path d="M${f(60 + k * hw * 0.2)} 39Q${f(60 + k * hw * 0.24)} 26 ${f(60 + k * hw * 0.16)} 18" stroke="${dark}" stroke-width="1.3" fill="none" opacity=".7"/>`).join('')
    case 14: // curtains
      return cap(16, 40, 56) +
        `<path d="M59 19C52 26 ${f(L + 6)} 36 ${f(L + 2)} 52L${f(L + 7)} 50C${f(L + 9)} 40 54 34 59 31Z" fill="${c}"/><path d="M61 19C68 26 ${f(R - 6)} 36 ${f(R - 2)} 52L${f(R - 7)} 50C${f(R - 9)} 40 66 34 61 31Z" fill="${c}"/>`
    default:
      return cap(17, 40, 54)
  }
}

/** Generic hair cap: crown height `top`, hairline height `hl`, side drop `sd`. */
function capPath(g: FaceGeo, top: number, hl: number, sd: number, c: string, extra = ''): string {
  const { hw } = g
  const L = 60 - hw - 1.5
  const R = 60 + hw + 1.5
  return `<path d="M${f(L)} ${sd}C${f(L - 1)} ${top + 14} ${f(60 - hw * 0.55)} ${top} 60 ${top}C${f(60 + hw * 0.55)} ${top} ${f(R + 1)} ${top + 14} ${f(R)} ${sd}L${f(R - 3)} ${sd - 2}C${f(R - 4)} ${hl - 2} ${f(60 + hw * 0.5)} ${hl - 3} 60 ${hl}C${f(60 - hw * 0.5)} ${hl - 3} ${f(L + 4)} ${hl - 2} ${f(L + 3)} ${sd - 2}Z" fill="${c}"${extra}/>`
}

/** Long hair curtain behind the head, ending at `bottom`. */
function curtain(g: FaceGeo, c: string, bottom: number, flare = 8): string {
  const { hw } = g
  return `<path d="M${f(60 - hw - 5)} 42C${f(60 - hw - flare)} 62 ${f(60 - hw - flare + 1)} ${f(bottom - 12)} ${f(60 - hw + 1)} ${f(bottom)}L${f(60 + hw - 1)} ${f(bottom)}C${f(60 + hw + flare - 1)} ${f(bottom - 12)} ${f(60 + hw + flare)} 62 ${f(60 + hw + 5)} 42Z" fill="${c}"/>`
}

/** Hair drawn behind the head for the female style set. */
function femaleHairBack(style: number, g: FaceGeo, c: string, dark: string): string {
  const { hw } = g
  switch (style) {
    case 0: // long straight
      return curtain(g, c, 112)
    case 1: { // ponytail (swings to the right of the head)
      const x = 60 + hw + 2
      return `<path d="M${f(x - 6)} 30C${f(x + 8)} 30 ${f(x + 12)} 52 ${f(x + 8)} 78C${f(x + 6)} 90 ${f(x)} 96 ${f(x - 2)} 100C${f(x + 1)} 86 ${f(x - 1)} 60 ${f(x - 8)} 40Z" fill="${c}"/>` +
        `<path d="M${f(x + 4)} 50C${f(x + 6)} 64 ${f(x + 4)} 80 ${f(x)} 92" stroke="${dark}" stroke-width="1" fill="none" opacity=".45"/>`
    }
    case 2: // top bun
      return `<circle cx="60" cy="13" r="10.5" fill="${c}"/><path d="M53 13Q60 6 67 13" stroke="${dark}" stroke-width="1" fill="none" opacity=".5"/>`
    case 3: // bob to the jaw
      return curtain(g, c, 86, 6)
    case 4: { // two long braids
      let s = ''
      for (const side of [-1, 1]) {
        const x = 60 + side * (hw + 2)
        for (let i = 0; i < 6; i++) {
          s += `<ellipse cx="${f(x + side * 1.5)}" cy="${f(62 + i * 8)}" rx="4.2" ry="5" fill="${c}"/>`
          s += `<path d="M${f(x - 3)} ${f(60 + i * 8)}q3 3 6 0" stroke="${dark}" stroke-width=".9" fill="none" opacity=".5"/>`
        }
      }
      return s
    }
    case 6: { // long curls
      let s = curtain(g, c, 108, 12)
      for (let i = 0; i < 6; i++) {
        s += `<circle cx="${f(60 - hw - 7 + (i % 2) * 3)}" cy="${f(56 + i * 9)}" r="5.5" fill="${c}"/>`
        s += `<circle cx="${f(60 + hw + 7 - (i % 2) * 3)}" cy="${f(56 + i * 9)}" r="5.5" fill="${c}"/>`
      }
      return s
    }
    case 7: // afro puffs
      return `<circle cx="${f(60 - hw - 4)}" cy="24" r="12" fill="${c}"/><circle cx="${f(60 + hw + 4)}" cy="24" r="12" fill="${c}"/>`
    case 8: // cornrows into a long plait
      return `<path d="M54 36C50 70 54 96 60 112C66 96 70 70 66 36Z" fill="${c}"/>` +
        Array.from({ length: 8 }, (_, i) => `<path d="M55 ${44 + i * 8}q5 4 10 0" stroke="${dark}" stroke-width="1" fill="none" opacity=".5"/>`).join('')
    case 9: // side-swept long
      return curtain(g, c, 110, 9)
    case 10: // low bun
      return `<ellipse cx="60" cy="90" rx="12" ry="8" fill="${c}"/><path d="M52 90Q60 84 68 90" stroke="${dark}" stroke-width="1" fill="none" opacity=".45"/>`
    case 11: // wavy shoulder length
      return curtain(g, c, 98, 10) +
        `<path d="M${f(60 - hw - 8)} 70q4 5 0 10q-4 5 0 10M${f(60 + hw + 8)} 70q-4 5 0 10q4 5 0 10" stroke="${dark}" stroke-width="1" fill="none" opacity=".4"/>`
    default: // 5 pixie: nothing behind
      return ''
  }
}

/** Hair drawn over the head for the female style set. */
function femaleHairFront(style: number, g: FaceGeo, c: string, dark: string): string {
  const { hw } = g
  const L = 60 - hw - 1.5
  const R = 60 + hw + 1.5
  const part = `<path d="M60 17L60 34" stroke="${dark}" stroke-width="1.1" opacity=".5"/>`
  const sideLocks = (y: number) =>
    `<path d="M60 34C${f(60 - 9)} 36 ${f(L + 3)} 46 ${f(L + 1)} ${y}L${f(L - 3)} ${y}L${f(L - 2)} 44Z" fill="${c}"/>` +
    `<path d="M60 34C${f(60 + 9)} 36 ${f(R - 3)} 46 ${f(R - 1)} ${y}L${f(R + 3)} ${y}L${f(R + 2)} 44Z" fill="${c}"/>`
  switch (style) {
    case 0: // long straight, centre part
      return capPath(g, 16, 40, 62, c) + part + sideLocks(78)
    case 1: // ponytail: slicked back with a hair tie
      return capPath(g, 16, 36, 50, c) + `<path d="M${f(60 - hw * 0.6)} 26Q60 19 ${f(60 + hw * 0.6)} 26" stroke="${dark}" stroke-width="1" fill="none" opacity=".45"/>` +
        `<circle cx="${f(60 + hw - 1)}" cy="33" r="2.2" fill="${dark}"/>`
    case 2: // top bun, smooth
      return capPath(g, 17, 37, 50, c) + `<path d="M${f(60 - hw * 0.5)} 28Q60 22 ${f(60 + hw * 0.5)} 28" stroke="${dark}" stroke-width="1" fill="none" opacity=".4"/>`
    case 3: { // bob with a straight fringe
      let fr = ''
      for (let i = 0; i < 7; i++) {
        const x = L + 6 + i * ((R - L - 12) / 6)
        fr += `<path d="M${f(x)} 32L${f(x)} 44" stroke="${dark}" stroke-width=".8" opacity=".35"/>`
      }
      return capPath(g, 15, 44, 66, c) + `<path d="M${f(L + 3)} 30L${f(R - 3)} 30L${f(R - 2)} 45L${f(L + 2)} 45Z" fill="${c}"/>` + fr + sideLocks(84)
    }
    case 4: // braids: centre part, tight
      return capPath(g, 17, 39, 56, c) + part
    case 5: // pixie with a side fringe
      return capPath(g, 17, 39, 52, c) +
        `<path d="M${f(L + 2)} 44C${f(L + 4)} 30 60 26 ${f(R - 3)} 34C62 34 52 38 ${f(L + 6)} 48Z" fill="${c}"/>`
    case 6: { // long curls, curly hairline
      let s = capPath(g, 15, 40, 60, c)
      for (let i = 0; i < 8; i++) {
        const a = Math.PI + (i / 7) * Math.PI
        s += `<circle cx="${f(60 + Math.cos(a) * (hw - 1))}" cy="${f(36 + Math.sin(a) * 19)}" r="5" fill="${c}"/>`
      }
      return s + sideLocks(74)
    }
    case 7: // afro puffs: centre part
      return capPath(g, 16, 39, 52, c) + part
    case 8: // cornrows
      return capPath(g, 18, 38, 50, c) + [-3, -1.5, 0, 1.5, 3].map((k) =>
        `<path d="M${f(60 + k * hw * 0.2)} 38Q${f(60 + k * hw * 0.22)} 26 ${f(60 + k * hw * 0.1)} 18" stroke="${dark}" stroke-width="1.3" fill="none" opacity=".7"/>`).join('')
    case 9: // side-swept long
      return capPath(g, 15, 40, 64, c) +
        `<path d="M${f(L + 1)} 52C${f(L + 2)} 30 64 22 ${f(R - 2)} 40C68 32 54 34 ${f(L + 4)} 58Z" fill="${c}"/>` +
        `<path d="M${f(R - 1)} 40C${f(R + 1)} 56 ${f(R + 3)} 70 ${f(R + 1)} 82L${f(R + 4)} 82L${f(R + 3)} 44Z" fill="${c}"/>`
    case 10: // low bun, centre part
      return capPath(g, 16, 39, 58, c) + part + `<path d="M${f(L + 2)} 50Q${f(L + 4)} 60 ${f(L + 8)} 64" stroke="${dark}" stroke-width="1" fill="none" opacity=".35"/>`
    case 11: // wavy shoulder length with curtain fringe
      return capPath(g, 16, 40, 60, c) +
        `<path d="M59 19C52 26 ${f(L + 6)} 36 ${f(L + 2)} 54L${f(L + 7)} 52C${f(L + 9)} 40 54 34 59 31Z" fill="${c}"/>` +
        `<path d="M61 19C68 26 ${f(R - 6)} 36 ${f(R - 2)} 54L${f(R - 7)} 52C${f(R - 9)} 40 66 34 61 31Z" fill="${c}"/>`
    default:
      return capPath(g, 16, 40, 60, c)
  }
}

function beard(style: number, g: FaceGeo, c: string): string {
  switch (style) {
    case 1:
      return `<path d="${beardRegion(g, 0, 66)}" fill="${c}" opacity=".24"/><path d="${MUSTACHE}" fill="${c}" opacity=".3"/>`
    case 2:
      return `<path d="${beardRegion(g, 1, 67)}" fill="${c}"/><path d="${MUSTACHE}" fill="${c}"/>`
    case 3: // goatee
      return `<path d="M52 86C52 92 55 ${f(g.cy + 1)} 60 ${f(g.cy + 1)}C65 ${f(g.cy + 1)} 68 92 68 86C65 88.5 55 88.5 52 86Z" fill="${c}"/><path d="${MUSTACHE}" fill="${c}"/>`
    case 4: // mustache
      return `<path d="${MUSTACHE}" fill="${c}"/>`
    case 5: // full long
      return `<path d="${beardRegion(g, 9, 65)}" fill="${c}"/><path d="${MUSTACHE}" fill="${c}"/><path d="M56 ${f(g.cy + 2)}Q60 ${f(g.cy + 6)} 64 ${f(g.cy + 2)}" stroke="#000" stroke-opacity=".18" fill="none"/>`
    case 6: { // chin strap
      const { hw, jw, cw, cy } = g
      return `<path d="M${f(60 - hw + 0.5)} 62C${f(60 - hw)} 70 ${f(60 - jw - 4)} 77 ${f(60 - jw)} 84C${f(60 - jw + 4)} 91 ${f(60 - cw - 5)} ${f(cy)} 60 ${f(cy)}C${f(60 + cw + 5)} ${f(cy)} ${f(60 + jw - 4)} 91 ${f(60 + jw)} 84C${f(60 + jw + 4)} 77 ${f(60 + hw)} 70 ${f(60 + hw - 0.5)} 62" stroke="${c}" stroke-width="4" fill="none" stroke-linejoin="round"/>`
    }
    case 7: // van dyke
      return `<path d="${MUSTACHE}" fill="${c}"/><path d="M55 88C55 93 57 ${f(g.cy + 2)} 60 ${f(g.cy + 3)}C63 ${f(g.cy + 2)} 65 93 65 88C62.5 89.5 57.5 89.5 55 88Z" fill="${c}"/>`
    default:
      return ''
  }
}

export function avatarSvg(a: Appearance, opts: AvatarOpts = {}): string {
  const skin = SKIN_TONES[mod(a.skin, SKIN_TONES.length)]
  let hair: string = HAIR_COLORS[mod(a.hairColor, HAIR_COLORS.length)]
  const age = opts.age ?? 24
  if (age >= 34) hair = mix(hair, '#c9ccd2', Math.min(0.7, (age - 33) * 0.12))
  const eye = EYE_COLORS[mod(a.eyeColor, EYE_COLORS.length)]
  const female = (opts.gender ?? a.gender) === 'female'
  const g0 = FACES[mod(a.face, FACES.length)]
  // Female faces: slightly narrower jaw and finer chin.
  const g: FaceGeo = female ? { ...g0, jw: g0.jw - 1.8, cw: Math.max(5, g0.cw - 2) } : g0
  const style = mod(a.hairStyle, female ? FEMALE_HAIR_STYLE_COUNT : HAIR_STYLE_COUNT)
  const beardStyle = female ? 0 : mod(a.beard, BEARD_COUNT)
  const acc = mod(a.accessory, ACCESSORY_COUNT)
  const mood = Math.max(-1, Math.min(1, opts.mood ?? 0.35))
  const shirt = opts.shirt ?? '#2a3a5c'
  const trim = opts.shirtTrim ?? shade(shirt, 0.35)
  const id = female
    ? uid('avf', a.skin, a.hairStyle, a.hairColor, a.eyeColor, a.face, a.accessory, shirt, trim, age, mood, opts.background ?? '')
    : uid('av', a.skin, a.hairStyle, a.hairColor, a.beard, a.eyeColor, a.face, a.accessory, shirt, trim, age, mood, opts.background ?? '')

  const skinHi = shade(skin, 0.1)
  const skinLo = shade(skin, -0.16)
  const skinLine = shade(skin, -0.42)
  const hairDark = shade(hair, -0.35)
  const brow = shade(hair, -0.15)
  const lip = female ? mix(shade(skin, -0.2), '#b4505e', 0.45) : mix(shade(skin, -0.28), '#b4565a', 0.28)

  const defs =
    `<defs>` +
    `<radialGradient id="${id}f" cx="40%" cy="34%" r="75%"><stop offset="0" stop-color="${skinHi}"/><stop offset=".62" stop-color="${skin}"/><stop offset="1" stop-color="${skinLo}"/></radialGradient>` +
    `<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(shirt, 0.12)}"/><stop offset="1" stop-color="${shade(shirt, -0.25)}"/></linearGradient>` +
    `<clipPath id="${id}c"><circle cx="60" cy="60" r="60"/></clipPath>` +
    (opts.background
      ? `<radialGradient id="${id}b" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="${shade(opts.background, 0.18)}"/><stop offset="1" stop-color="${shade(opts.background, -0.35)}"/></radialGradient>`
      : '') +
    `</defs>`

  const bg = opts.background ? `<circle cx="60" cy="60" r="60" fill="url(#${id}b)"/>` : ''

  // Body: shoulders + neck
  const body =
    `<path d="M8 124C10 108 22 100 40 97L50 94L70 94L80 97C98 100 110 108 112 124Z" fill="url(#${id}s)"/>` +
    `<path d="M48 94L60 108L72 94" fill="none" stroke="${trim}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="M49 80L49 96C53 101 67 101 71 96L71 80Z" fill="${skinLo}"/>` +
    `<path d="M49 88C54 93 66 93 71 88L71 84L49 84Z" fill="#000" opacity=".12"/>`

  const ears =
    `<ellipse cx="${f(60 - g.hw + 0.5)}" cy="62" rx="4.6" ry="7" fill="${skinLo}"/>` +
    `<ellipse cx="${f(60 + g.hw - 0.5)}" cy="62" rx="4.6" ry="7" fill="${skinLo}"/>` +
    `<path d="M${f(60 - g.hw)} 58q-2 4 0 8" stroke="${skinLine}" stroke-width=".9" fill="none" opacity=".5"/>` +
    `<path d="M${f(60 + g.hw)} 58q2 4 0 8" stroke="${skinLine}" stroke-width=".9" fill="none" opacity=".5"/>`

  const head = `<path d="${headPath(g)}" fill="url(#${id}f)"/>` +
    // soft side shadow for volume
    `<path d="M${f(60 + g.hw * 0.55)} 30C${f(60 + g.hw)} 40 ${f(60 + g.hw)} 66 ${f(60 + g.jw)} 84C${f(60 + g.jw - 6)} 92 ${f(60 + g.cw)} ${f(g.cy - 1)} 64 ${f(g.cy - 1)}C${f(60 + g.hw * 0.7)} 80 ${f(60 + g.hw * 0.85)} 50 ${f(60 + g.hw * 0.55)} 30Z" fill="${skinLo}" opacity=".35"/>`

  // Eyes
  const browTilt = mood < -0.3 ? -2 : mood > 0.6 ? 0.6 : 0
  const eyeY = 61
  const eyeFn = (cx: number, dir: number) =>
    `<ellipse cx="${cx}" cy="${eyeY}" rx="5" ry="3.1" fill="#f6f3ef"/>` +
    `<circle cx="${cx + dir * 0.3}" cy="${eyeY}" r="2.55" fill="${eye}"/>` +
    `<circle cx="${cx + dir * 0.3}" cy="${eyeY}" r="1.15" fill="#0d0a08"/>` +
    `<circle cx="${cx + dir * 0.3 - 0.9}" cy="${eyeY - 0.9}" r=".7" fill="#fff"/>` +
    `<path d="M${cx - 5.4} ${eyeY + 0.2}C${cx - 3} ${eyeY - 4} ${cx + 3} ${eyeY - 4} ${cx + 5.4} ${eyeY - 0.4}" stroke="${shade(skin, -0.6)}" stroke-width="1.5" fill="none" stroke-linecap="round"/>` +
    `<path d="M${cx - 4} ${eyeY + 3.4}Q${cx} ${eyeY + 4.6} ${cx + 4} ${eyeY + 3.2}" stroke="${skinLine}" stroke-width=".6" fill="none" opacity=".45"/>`
  const lash = (cx: number, dir: number) =>
    `<path d="M${cx + dir * 5.2} ${eyeY - 0.6}l${dir * 1.8} -1.6M${cx + dir * 3.6} ${eyeY - 2.4}l${dir * 1.2} -1.8" stroke="${shade(skin, -0.65)}" stroke-width="1" stroke-linecap="round"/>`
  const eyes = eyeFn(47.5, 1) + eyeFn(72.5, -1) + (female ? lash(47.5, -1) + lash(72.5, 1) : '')
  const brows = female
    ? `<path d="M42 ${53.5 - browTilt}Q47.5 48.6 54 ${52 + browTilt * 0.4}" stroke="${brow}" stroke-width="1.7" fill="none" stroke-linecap="round"/>` +
      `<path d="M78 ${53.5 - browTilt}Q72.5 48.6 66 ${52 + browTilt * 0.4}" stroke="${brow}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`
    :
    `<path d="M41 ${53 - browTilt}Q47 ${49.5} 54 ${52.5 + browTilt * 0.4}" stroke="${brow}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
    `<path d="M79 ${53 - browTilt}Q73 ${49.5} 66 ${52.5 + browTilt * 0.4}" stroke="${brow}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`

  const nose =
    `<path d="M58.5 63C58 68 55.5 71 56.5 73.5C58 75.2 62 75.2 63.5 73.5" stroke="${skinLine}" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".75"/>` +
    `<path d="M60.5 64C61.5 68 62 70 62.3 71.5" stroke="${skinHi}" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".6"/>`

  const smile = mood * 3
  const lips = female
    ? `<path d="M54.5 ${f(84.4 - smile * 0.25)}Q60 ${f(88.6 + smile * 0.8)} 65.5 ${f(84.4 - smile * 0.25)}Q60 ${f(85.6 + smile * 0.6)} 54.5 ${f(84.4 - smile * 0.25)}Z" fill="${lip}" opacity=".75"/>`
    : ''
  const mouth = lips +
    `<path d="M53 ${f(83.5 - smile * 0.3)}Q60 ${f(84 + smile)} 67 ${f(83.5 - smile * 0.3)}" stroke="${lip}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<path d="M56 ${f(86.6 + Math.max(0, smile) * 0.3)}Q60 ${f(88 + Math.max(0, smile) * 0.4)} 64 ${f(86.6 + Math.max(0, smile) * 0.3)}" stroke="${shade(lip, 0.25)}" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".55"/>`

  const wrinkles = age >= 32
    ? `<path d="M48 41Q60 38 72 41M50 45Q60 43 70 45" stroke="${skinLine}" stroke-width=".7" fill="none" opacity="${Math.min(0.5, (age - 31) * 0.08).toFixed(2)}"/>`
    : ''

  let accessory = ''
  if (acc === 1) accessory = `<path d="M${f(60 - g.hw - 1)} 40C${f(60 - g.hw)} 34 ${f(60 + g.hw)} 34 ${f(60 + g.hw + 1)} 40L${f(60 + g.hw + 1)} 46C${f(60 + g.hw)} 40 ${f(60 - g.hw)} 40 ${f(60 - g.hw - 1)} 46Z" fill="${trim}"/>`
  else if (acc === 2 && female) accessory = [60 - g.hw + 0.5, 60 + g.hw - 0.5].map((x) => `<circle cx="${f(x)}" cy="71" r="2.6" fill="none" stroke="#ffd56b" stroke-width="1.1"/>`).join('')
  else if (acc === 2) accessory = `<circle cx="${f(60 - g.hw + 0.5)}" cy="68.5" r="1.7" fill="#ffd56b"/><circle cx="${f(60 - g.hw)}" cy="68" r=".6" fill="#fff"/>`
  else if (acc === 3) accessory = `<path d="M50 95Q60 106 70 95" stroke="#f2c14e" stroke-width="1.6" fill="none" stroke-dasharray="1.6 1"/>`
  else if (acc === 4) accessory = `<path d="M${f(60 - g.hw)} 37Q60 31 ${f(60 + g.hw)} 37" stroke="${trim}" stroke-width="2.4" fill="none"/>`
  else if (acc === 5) accessory = `<g fill="none" stroke="#1b2233" stroke-width="1.6"><rect x="40" y="56" width="15" height="10" rx="4"/><rect x="65" y="56" width="15" height="10" rx="4"/><path d="M55 60h10"/></g><rect x="40" y="56" width="15" height="10" rx="4" fill="#9cc8ff" opacity=".12"/><rect x="65" y="56" width="15" height="10" rx="4" fill="#9cc8ff" opacity=".12"/>`

  const inner =
    (female ? femaleHairBack(style, g, hair, hairDark) : hairBack(style, g, hair)) +
    body + ears + head + wrinkles + eyes + brows + nose +
    beard(beardStyle, g, hair) + mouth +
    (female ? femaleHairFront(style, g, hair, hairDark) : hairFront(style, g, hair, hairDark)) + accessory

  const content = opts.background ? `${bg}<g clip-path="url(#${id}c)">${inner}</g>` : inner
  return svgWrap('0 0 120 120', defs + content, { title: opts.title })
}
