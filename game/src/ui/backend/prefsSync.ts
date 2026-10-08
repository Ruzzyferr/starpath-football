/**
 * Mirrors player preferences that the sim must know about (never reading UI
 * settings itself) onto the career. Partner preference (2.4#24) lives in
 * `life.flags`; this effect keeps it equal to the Settings choice for the
 * loaded career, and a new career picks the stored choice up immediately.
 */
import { effect } from '@preact/signals'
import { setPartnerPref } from '../../sim/game/partnerPref'
import { gameState, settings } from '../store'

export function installPrefsSync(): void {
  effect(() => {
    const pref = settings.value.partnerPref
    const s = gameState.value
    if (s) setPartnerPref(s, pref)
  })
}
