/**
 * Country flags (viewBox 0 0 30 20). Known football nations get a simplified
 * but recognisable design (Türkiye's crescent & star, St George's cross,
 * Brazil's diamond, …); any other id falls back to a tri-colour layout picked
 * from the country's three colours.
 */
import { hashString, polyPoints, starPoints, svgWrap } from './svg'

type Colors = [string, string, string]

const W = 30
const H = 20

const rect = (x: number, y: number, w: number, h: number, fill: string): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`
const vTri = (a: string, b: string, c: string): string => rect(0, 0, 10, H, a) + rect(10, 0, 10, H, b) + rect(20, 0, 10, H, c)
const hTri = (a: string, b: string, c: string): string => rect(0, 0, W, 6.8, a) + rect(0, 6.6, W, 6.8, b) + rect(0, 13.3, W, 6.7, c)

/** Hand-drawn designs for the nations of the game world. */
const SPECIAL: Record<string, () => string> = {
  // Red field, white crescent opening to the fly, white five-pointed star.
  TR: () =>
    rect(0, 0, W, H, '#E30A17') +
    `<circle cx="11" cy="10" r="5" fill="#fff"/><circle cx="12.25" cy="10" r="4" fill="#E30A17"/>` +
    `<polygon points="${starPoints(17.3, 10, 2.5, 1, 5, Math.PI)}" fill="#fff"/>`,
  // St George's cross.
  EN: () => rect(0, 0, W, H, '#fff') + rect(12.5, 0, 5, H, '#CE1124') + rect(0, 7.5, W, 5, '#CE1124'),
  // Red-yellow-red with a 1:2:1 band ratio.
  ES: () => rect(0, 0, W, H, '#AA151B') + rect(0, 5, W, 10, '#F1BF00'),
  DE: () => hTri('#000', '#DD0000', '#FFCE00'),
  IT: () => vTri('#009246', '#fff', '#CE2B37'),
  FR: () => vTri('#0055A4', '#fff', '#EF4135'),
  NL: () => hTri('#AE1C28', '#fff', '#21468B'),
  // Green hoist (2/5), red fly, simplified yellow armillary disc on the seam.
  PT: () =>
    rect(0, 0, 12, H, '#006600') + rect(12, 0, 18, H, '#FF0000') +
    `<circle cx="12" cy="10" r="4" fill="#FFCC00"/><circle cx="12" cy="10" r="2.6" fill="#FF0000"/><rect x="10.8" y="8.2" width="2.4" height="3.4" rx=".6" fill="#fff"/>`,
  // Green field, yellow diamond, blue globe with a white band.
  BR: () =>
    rect(0, 0, W, H, '#009C3B') +
    `<polygon points="15,2.2 27.6,10 15,17.8 2.4,10" fill="#FFDF00"/>` +
    `<circle cx="15" cy="10" r="4.3" fill="#002776"/><path d="M10.9 9.1Q15 7.9 19.2 10.6" stroke="#fff" stroke-width=".8" fill="none"/>`,
  // Sky blue / white / sky blue with the Sun of May.
  AR: () =>
    hTri('#74ACDF', '#fff', '#74ACDF') +
    `<polygon points="${starPoints(15, 10, 2.6, 1.6, 12)}" fill="#F6B40E"/><circle cx="15" cy="10" r="1.3" fill="#F6B40E" stroke="#85340A" stroke-width=".2"/>`,
  // 7 stripes (simplified) + blue canton with a star grid.
  US: () => {
    let s = ''
    for (let i = 0; i < 7; i++) s += rect(0, (i * H) / 7, W, H / 7 + 0.05, i % 2 === 0 ? '#B22234' : '#fff')
    s += rect(0, 0, 12, (H / 7) * 4, '#3C3B6E')
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
      s += `<circle cx="${1.4 + c * 2.3 + (r % 2) * 1.1}" cy="${1.3 + r * 2.6}" r=".45" fill="#fff"/>`
    }
    return s
  },
  // White field, red disc slightly toward the hoist.
  JP: () => rect(0, 0, W, H, '#fff') + `<circle cx="15" cy="10" r="6" fill="#BC002D"/>`,
}

/** True when a country has a hand-drawn flag. */
export const hasSpecialFlag = (countryId: string): boolean => countryId.toUpperCase() in SPECIAL

function genericFlag(countryId: string, [a, b, c]: Colors): string {
  switch (hashString(countryId) % 5) {
    case 0:
      return vTri(a, b, c)
    case 1:
      return hTri(a, b, c)
    case 2: // nordic cross
      return rect(0, 0, W, H, a) + rect(8, 0, 5, H, b) + rect(0, 7.5, W, 5, b) + rect(9.25, 0, 2.5, H, c) + rect(0, 8.75, W, 2.5, c)
    case 3: // hoist triangle
      return rect(0, 0, W, 10, b) + rect(0, 10, W, 10, c) + `<path d="M0 0L13 10L0 20Z" fill="${a}"/><polygon points="${starPoints(4.5, 10, 2.4, 1, 5)}" fill="${b}"/>`
    default: // bicolour + emblem
      return rect(0, 0, W, 10, a) + rect(0, 10, W, 10, b) + `<polygon points="${polyPoints(15, 10, 4.2, 6)}" fill="${c}"/>`
  }
}

export function flagSvg(countryId: string, colors: Colors, title?: string): string {
  const special = SPECIAL[countryId.toUpperCase()]
  const gid = `fg${countryId.replace(/[^a-z0-9]/gi, '')}`
  let body = special ? special() : genericFlag(countryId, colors)
  body += `<rect width="30" height="20" fill="url(#${gid})"/>`
  const defs = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient></defs>`
  return svgWrap('0 0 30 20', defs + body, { title })
}
