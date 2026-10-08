/**
 * WebGL context loss handling (2.9#17). Context events do not bubble, so one capture
 * listener on `document` sees every canvas (Phaser's match canvas included) without touching
 * game code. `preventDefault()` on `webglcontextlost` is what allows the browser to restore the
 * context later; both transitions are logged (opt-in) and broadcast as window events.
 */
import { recordError } from '../telemetry/errorLog'

export const GL_LOST_EVENT = 'sp:gl-lost'
export const GL_RESTORED_EVENT = 'sp:gl-restored'

let installed = false
let lostCount = 0

export function glLostCount(): number {
  return lostCount
}

export function installGlRecovery(target: Pick<Document, 'addEventListener'> | null = typeof document === 'undefined' ? null : document): void {
  if (installed || !target) return
  installed = true
  target.addEventListener(
    'webglcontextlost',
    (ev) => {
      ev.preventDefault()
      lostCount++
      recordError('WebGL context lost', 'webgl-lost')
      if (typeof window !== 'undefined') window.dispatchEvent(new Event(GL_LOST_EVENT))
    },
    true,
  )
  target.addEventListener(
    'webglcontextrestored',
    () => {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event(GL_RESTORED_EVENT))
    },
    true,
  )
}

/** Tests only. */
export function _resetGlRecovery(): void {
  installed = false
  lostCount = 0
}
