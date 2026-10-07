/**
 * Procedural banner scenes for the wizard's "where do you come from" cards.
 * Flat vector, no ids, ~1 KB each: a back-street wall goal, an academy
 * training ground, a family stand with a framed shirt, a night-sky late bloom.
 */
import type { Background } from '../../../core/types'

const W = 320
const H = 96

function Street() {
  const bricks = []
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 12; c++) {
      const x = c * 30 + (r % 2 ? 15 : 0) - 15
      bricks.push(<rect key={`${r}-${c}`} x={x} y={r * 13} width="28" height="11" rx="1.5" fill={(r * 7 + c * 3) % 5 === 0 ? '#5a3a28' : '#4a2f22'} />)
    }
  }
  return (
    <>
      <rect width={W} height={H} fill="#2a1c16" />
      {bricks}
      <rect y="76" width={W} height="20" fill="#24262e" />
      <path d="M110 22h100v54" fill="none" stroke="#f2f5fa" stroke-width="2.5" stroke-dasharray="6 3" opacity=".8" />
      <path d="M110 22v54" fill="none" stroke="#f2f5fa" stroke-width="2.5" stroke-dasharray="6 3" opacity=".8" />
      <path d="M262 8v68M262 10h14" stroke="#11141c" stroke-width="3" />
      <circle cx="276" cy="14" r="5" fill="#ffd27a" />
      <path d="M276 18L246 76h60Z" fill="#ffd27a" opacity=".12" />
      <circle cx="168" cy="84" r="6" fill="#f2f5fa" stroke="#0b1220" stroke-width="1.2" />
      <path d="M165 81l3 2 3-2-1 4h-4Z" fill="#0b1220" />
    </>
  )
}

function Academy() {
  return (
    <>
      <rect width={W} height={H} fill="#0c2a1c" />
      <rect y="0" width={W} height="40" fill="#0b1a22" />
      <path d="M20 40V20h70v20M30 26h10v8H30ZM50 26h10v8H50ZM70 26h10v8H70Z" fill="#163a52" />
      <path d="M18 20l37-10 37 10Z" fill="#1d4d6a" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x="0" y={40 + i * 8} width={W} height="4" fill="#12402a" />)}
      <path d="M0 40h320" stroke="rgba(234,245,234,.5)" />
      <path d="M180 96V60h140" fill="none" stroke="rgba(234,245,234,.6)" stroke-width="1.5" />
      {[140, 170, 200, 230, 260].map((x, i) => <path key={x} d={`M${x} ${70 + (i % 2) * 8}l4 8h-8Z`} fill="#ff8a3d" />)}
      <path d="M300 4v36M292 4h16v6h-16Z" stroke="#273041" stroke-width="2" fill="#f2f5fa" />
      <path d="M300 10L250 60h100Z" fill="#fff" opacity=".07" />
      <circle cx="120" cy="80" r="5" fill="#f2f5fa" />
    </>
  )
}

function Family() {
  return (
    <>
      <rect width={W} height={H} fill="#0d1d3a" />
      {[0, 1, 2, 3].map((r) => <rect key={r} x="0" y={50 + r * 12} width={W} height="8" fill="#13284f" />)}
      {Array.from({ length: 26 }, (_, i) => (
        <circle key={i} cx={8 + i * 12.4} cy={46 + (i % 3) * 2} r="4" fill={i % 4 === 0 ? '#3da5ff' : '#1f3a6c'} />
      ))}
      <rect x="196" y="8" width="56" height="38" rx="3" fill="#2a1d10" stroke="#d99a0b" stroke-width="2" />
      <path d="M210 16l8-4h12l8 4 4 8-6 2v14h-24V26l-6-2Z" fill="#c8102e" />
      <text x="224" y="36" text-anchor="middle" font-family="Teko, sans-serif" font-size="12" fill="#fff">10</text>
      <circle cx="82" cy="40" r="9" fill="#0a1222" />
      <path d="M66 96c0-24 6-42 16-42s16 18 16 42Z" fill="#0a1222" />
      <circle cx="110" cy="56" r="6.5" fill="#0a1222" />
      <path d="M100 96c0-16 4-30 10-30s10 14 10 30Z" fill="#0a1222" />
      <path d="M97 62l7 6" stroke="#0a1222" stroke-width="4" stroke-linecap="round" />
    </>
  )
}

function LateBloomer() {
  const stars = [[30, 14], [70, 30], [120, 10], [160, 26], [210, 12], [250, 34], [290, 18], [96, 50], [276, 52]]
  return (
    <>
      <rect width={W} height={H} fill="#170f36" />
      {stars.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.6 : 1} fill="#fff" opacity=".8" />)}
      <path d="M150 22L232 50" stroke="#ffe38a" stroke-width="2" stroke-linecap="round" opacity=".5" />
      <path d="M232 50l3.2 6.6 7.2 1-5.2 5 1.2 7.2-6.4-3.4-6.4 3.4 1.2-7.2-5.2-5 7.2-1Z" fill="#ffc83d" />
      <path d="M0 82C60 64 120 70 170 78S270 70 320 76V96H0Z" fill="#0f2a1e" />
      <path d="M0 88C80 80 200 84 320 86V96H0Z" fill="#14402a" />
    </>
  )
}

export function StoryArt({ kind }: { kind: Background }) {
  return (
    <svg class="wiz-story-scene" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {kind === 'street' ? <Street /> : kind === 'academy' ? <Academy /> : kind === 'footballFamily' ? <Family /> : <LateBloomer />}
    </svg>
  )
}
