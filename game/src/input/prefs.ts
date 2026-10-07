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
}

const state: ControlPrefs = { leftHanded: false, oneHand: false, touchScale: 1 }

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
