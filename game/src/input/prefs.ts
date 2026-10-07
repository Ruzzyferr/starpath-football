/**
 * Control / content preferences that the game layers (Phaser scenes, sim
 * event roll) need without importing the UI store. The store pushes its
 * settings here (one direction), the game reads via the getters.
 */
export interface ControlPrefs {
  /** Mirror mobile match controls: joystick right, actions left. */
  leftHanded: boolean
  /** Tap-based single-thumb controls with stronger aim assist. */
  oneHand: boolean
  /** Touch button scale (1 = default). */
  touchScale: number
  /** Colour-blind palette in effect (for in-match kit contrast). */
  cbMode: 'off' | 'protanopia' | 'deuteranopia' | 'tritanopia'
  /** Touch shooting scheme (WP-13): free swipe, pull-back sling-shot, or tap + oscillating meter. */
  touchShot: 'swipe' | 'slingshot' | 'meter'
  /** Mouse/keyboard power: charge while held, or oscillating bar locked on release. */
  pcPower: 'hold' | 'oscillate'
  /** Gamepad power: hold-charge, oscillating bar, or analog (LT depth + analog aim). */
  padPower: 'hold' | 'oscillate' | 'analog'
  /** Gamepad stick dead zone 0.05..0.4. */
  padDeadzone: number
  /** Highlight the best pass options (count/range scale with the hero's Vision). */
  visionHints: boolean
  /** No screen flashes in the match (Disable flashes setting or OS reduced motion). */
  noFlash: boolean
  /** Accessibility: wider timing windows (slow-mo, one-two, slower power meter). */
  timingAssist: boolean
}

/** Timing-assist multiplier on timing windows (slow-mo, one-two) and the meter period. */
export const TIMING_ASSIST_MULT = 1.5

const state: ControlPrefs = {
  leftHanded: false,
  oneHand: false,
  touchScale: 1,
  cbMode: 'off',
  touchShot: 'swipe',
  pcPower: 'hold',
  padPower: 'hold',
  padDeadzone: 0.18,
  visionHints: true,
  noFlash: false,
  timingAssist: false,
}

export function getControlPrefs(): Readonly<ControlPrefs> {
  return state
}

export function setControlPrefs(p: Partial<ControlPrefs>): void {
  Object.assign(state, p)
}

/** Aim assist after accessibility overrides (one-hand mode forces full). */
export function effectiveAimAssist<T extends string>(base: T): T | 'full' {
  return state.oneHand ? 'full' : base
}
