/** Helpers shared by the match-flow screens (pre / live / post). */
import type { IconName } from '../../icons'
import type { MatchEventType, Weather } from '../../store'

export const WEATHER_ICON: Record<Weather, IconName> = {
  clear: 'sun',
  rain: 'cloud-rain',
  snow: 'snowflake',
  wind: 'wind',
  hot: 'thermometer',
}

export const EVENT_ICON: Record<MatchEventType, IconName> = {
  kickoff: 'whistle',
  goal: 'ball',
  shot: 'target',
  save: 'shield',
  miss: 'crosshair',
  woodwork: 'goal',
  chance: 'sparkle',
  yellow: 'yellow-card',
  red: 'yellow-card',
  injury: 'first-aid',
  sub: 'shuffle',
  halftime: 'clock',
  fulltime: 'whistle',
  corner: 'flag',
  freekick: 'boot',
  penalty: 'target',
  offside: 'flag',
  commentary: 'chat',
  highlight: 'star',
  extratime: 'stopwatch',
  shootout: 'target',
}

export const MOMENT_ICON: Record<string, IconName> = {
  build_up: 'tactics',
  counter: 'run',
  one_on_one: 'target',
  cross: 'boot',
  edge_of_box: 'crosshair',
  freekick: 'boot',
  penalty: 'target',
  corner: 'flag',
  defend: 'shield',
  gk_save: 'shield-check',
  gk_penalty: 'shield-check',
}

/** Decorative pitch markings for a vertical pitch (viewBox 0 0 68 105). */
export function PitchLinesVertical() {
  return (
    <svg class="pitch-svg" viewBox="0 0 68 105" preserveAspectRatio="none" aria-hidden="true">
      <g fill="none" stroke="var(--pitch-line)" stroke-width=".5">
        <rect x="1.5" y="1.5" width="65" height="102" />
        <path d="M1.5 52.5h65" />
        <circle cx="34" cy="52.5" r="9.15" />
        <rect x="13.85" y="1.5" width="40.3" height="16.5" />
        <rect x="24.84" y="1.5" width="18.32" height="5.5" />
        <rect x="13.85" y="87" width="40.3" height="16.5" />
        <rect x="24.84" y="98" width="18.32" height="5.5" />
        <path d="M26.7 18a9.15 9.15 0 0 0 14.6 0M26.7 87a9.15 9.15 0 0 1 14.6 0" />
      </g>
      <circle cx="34" cy="52.5" r=".8" fill="var(--pitch-line)" />
    </svg>
  )
}

/** Horizontal pitch markings (viewBox 0 0 105 68) for the radar. */
export function PitchLinesHorizontal() {
  return (
    <g fill="none" stroke="var(--pitch-line)" stroke-width=".6" opacity=".8">
      <rect x="1" y="1" width="103" height="66" rx="1" />
      <path d="M52.5 1v66" />
      <circle cx="52.5" cy="34" r="9.15" />
      <rect x="1" y="13.85" width="16.5" height="40.3" />
      <rect x="87.5" y="13.85" width="16.5" height="40.3" />
      <rect x="1" y="24.84" width="5.5" height="18.32" />
      <rect x="98.5" y="24.84" width="5.5" height="18.32" />
    </g>
  )
}

/** Two-sided comparison bar (home left, away right). */
export function CompareBar({ label, home, away, suffix = '' }: { label: string; home: number; away: number; suffix?: string }) {
  const total = home + away || 1
  const hp = (home / total) * 100
  return (
    <div class="cmp-bar">
      <div class="cmp-bar-top">
        <span class="num cmp-v">{Math.round(home)}{suffix}</span>
        <span class="cmp-label">{label}</span>
        <span class="num cmp-v">{Math.round(away)}{suffix}</span>
      </div>
      <div class="cmp-track" aria-hidden="true">
        <span class={`cmp-home${home >= away ? ' is-lead' : ''}`} style={{ transform: `scaleX(${hp / 100})` }} />
        <span class={`cmp-away${away >= home ? ' is-lead' : ''}`} style={{ transform: `scaleX(${(100 - hp) / 100})` }} />
      </div>
    </div>
  )
}
