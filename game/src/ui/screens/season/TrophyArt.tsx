/** Procedural trophy & medal SVGs for the cabinet and the season ceremony. */
import { hashString } from '../../../core/rng'

export type Metal = 'gold' | 'silver' | 'bronze'

const METAL: Record<Metal, [string, string, string]> = {
  gold: ['#8a6408', '#ffe38a', '#d99a0b'],
  silver: ['#6d7891', '#f2f5fa', '#a9b5c9'],
  bronze: ['#6e3a14', '#f0b07a', '#b06a30'],
}

export function metalFor(name: string, season: number): Metal {
  const h = hashString(name + season)
  return h % 5 === 0 ? 'silver' : 'gold'
}

/** Cup (0), plate/shield (1) or tall star trophy (2), picked from the name. */
export function Trophy({ name, season, size = 72, metal }: { name: string; season: number; size?: number; metal?: Metal }) {
  const h = hashString(name)
  const kind = h % 3
  const m = metal ?? metalFor(name, season)
  const [dark, light, mid] = METAL[m]
  const id = `tr${h.toString(36)}${m}`
  const handles = (h >> 3) % 2 === 0
  return (
    <svg class="trophy-svg" width={size} height={size * 1.25} viewBox="0 0 80 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color={dark} />
          <stop offset=".42" stop-color={light} />
          <stop offset=".6" stop-color={mid} />
          <stop offset="1" stop-color={dark} />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2a1d14" />
          <stop offset="1" stop-color="#140d08" />
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="96" rx="26" ry="3.5" fill="#000" opacity=".45" />
      <rect x="20" y="80" width="40" height="14" rx="2" fill={`url(#${id}b)`} />
      <rect x="24" y="84" width="32" height="5" rx="1" fill={`url(#${id}g)`} opacity=".85" />
      {kind === 0 && (
        <g>
          <path d="M34 66h12l3 14H31z" fill={`url(#${id}g)`} />
          <path d="M18 10h44v12c0 18-10 30-22 30S18 40 18 22z" fill={`url(#${id}g)`} />
          {handles && <path d="M18 16H9c0 12 5 18 12 20M62 16h9c0 12-5 18-12 20" fill="none" stroke={mid} stroke-width="4" stroke-linecap="round" />}
          <path d="M37 52h6v14h-6z" fill={mid} />
          <ellipse cx="40" cy="10" rx="22" ry="3.5" fill={light} opacity=".9" />
          <path d="M26 18c1 10 4 18 9 24" stroke="#fff" stroke-opacity=".45" stroke-width="2.5" fill="none" stroke-linecap="round" />
        </g>
      )}
      {kind === 1 && (
        <g>
          <path d="M36 62h8v18h-8z" fill={mid} />
          <circle cx="40" cy="36" r="27" fill={`url(#${id}g)`} />
          <circle cx="40" cy="36" r="20" fill="none" stroke={dark} stroke-width="1.5" opacity=".6" />
          <path d="M40 22l4 8.2 9 1.3-6.5 6.3 1.5 9-8-4.2-8 4.2 1.5-9-6.5-6.3 9-1.3z" fill={dark} opacity=".55" />
          <path d="M22 26a20 20 0 0 1 12-10" stroke="#fff" stroke-opacity=".5" stroke-width="2.5" fill="none" stroke-linecap="round" />
        </g>
      )}
      {kind === 2 && (
        <g>
          <path d="M33 80l3-36h8l3 36z" fill={`url(#${id}g)`} />
          <path d="M40 4l7 14.5 16 2.3-11.5 11.2 2.7 15.8L40 40.4l-14.2 7.4 2.7-15.8L17 20.8l16-2.3z" fill={`url(#${id}g)`} />
          <path d="M40 10l3 7" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round" />
        </g>
      )}
    </svg>
  )
}

export type AwardTier = 'bronze' | 'silver' | 'gold' | 'elite' | 'legend'
export function awardTier(key: string): AwardTier {
  if (key.includes('golden')) return 'legend'
  if (key.includes('season') || key.includes('top_scorer')) return 'gold'
  if (key.includes('young') || key.includes('goal_of')) return 'elite'
  if (key.includes('month')) return 'silver'
  return 'bronze'
}

/** Ribboned medal badge. */
export function Medal({ tier, size = 56 }: { tier: AwardTier; size?: number }) {
  const m: Metal = tier === 'bronze' ? 'bronze' : tier === 'silver' ? 'silver' : 'gold'
  const [dark, light, mid] = METAL[m]
  const ribbon = tier === 'legend' ? '#8e5cff' : tier === 'elite' ? '#3da5ff' : '#1fd47a'
  const id = `md${tier}`
  return (
    <svg class="medal-svg" width={size} height={size * 1.2} viewBox="0 0 60 72" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}g`} cx="35%" cy="30%" r="80%">
          <stop offset="0" stop-color={light} />
          <stop offset=".6" stop-color={mid} />
          <stop offset="1" stop-color={dark} />
        </radialGradient>
      </defs>
      <path d="M14 0h12l8 26H22zM46 0H34l-8 26h12z" fill={ribbon} />
      <path d="M20 0h3l8 26h-3zM40 0h-3l-8 26h3z" fill="#fff" opacity=".35" />
      <circle cx="30" cy="46" r="21" fill={`url(#${id}g)`} stroke={dark} stroke-width="1.5" />
      <circle cx="30" cy="46" r="15" fill="none" stroke={dark} stroke-opacity=".5" />
      <path d="M30 35l3.4 6.9 7.6 1.1-5.5 5.4 1.3 7.5L30 52.3l-6.8 3.6 1.3-7.5-5.5-5.4 7.6-1.1z" fill={dark} opacity=".6" />
    </svg>
  )
}
