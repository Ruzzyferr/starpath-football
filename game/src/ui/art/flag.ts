/** Simple fictional tri-colour flag (viewBox 0 0 30 20). Layout picked from the country id. */
import { hashString, polyPoints, starPoints, svgWrap } from './svg'

export function flagSvg(countryId: string, colors: [string, string, string], title?: string): string {
  const [a, b, c] = colors
  const h = hashString(countryId)
  const layout = h % 6
  let body = ''
  switch (layout) {
    case 0: // vertical tricolour
      body = `<rect width="10" height="20" fill="${a}"/><rect x="10" width="10" height="20" fill="${b}"/><rect x="20" width="10" height="20" fill="${c}"/>`
      break
    case 1: // horizontal tricolour
      body = `<rect width="30" height="7" fill="${a}"/><rect y="6.6" width="30" height="6.8" fill="${b}"/><rect y="13.3" width="30" height="6.7" fill="${c}"/>`
      break
    case 2: // field + crescent-star style emblem
      body = `<rect width="30" height="20" fill="${a}"/><circle cx="12" cy="10" r="5" fill="${b}"/><circle cx="13.4" cy="10" r="4" fill="${a}"/><polygon points="${starPoints(18.5, 10, 2.4, 1, 5, Math.PI)}" fill="${b}"/>`
      break
    case 3: // nordic cross
      body = `<rect width="30" height="20" fill="${a}"/><rect x="8" width="5" height="20" fill="${b}"/><rect y="7.5" width="30" height="5" fill="${b}"/><rect x="9.25" width="2.5" height="20" fill="${c}"/><rect y="8.75" width="30" height="2.5" fill="${c}"/>`
      break
    case 4: // hoist triangle
      body = `<rect width="30" height="10" fill="${b}"/><rect y="10" width="30" height="10" fill="${c}"/><path d="M0 0L13 10L0 20Z" fill="${a}"/><polygon points="${starPoints(4.5, 10, 2.4, 1, 5)}" fill="${b}"/>`
      break
    default: // bicolour + disc
      body = `<rect width="30" height="10" fill="${a}"/><rect y="10" width="30" height="10" fill="${b}"/><polygon points="${polyPoints(15, 10, 4.2, 6)}" fill="${c}"/>`
  }
  body += `<rect width="30" height="20" fill="url(#fg)" />`
  const defs = `<defs><linearGradient id="fg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient></defs>`
  return svgWrap('0 0 30 20', defs + body, { title })
}
