/**
 * Content filters that sim code may read (set by the UI store, never persisted in saves).
 * Keep this tiny and dependency free.
 *
 * `CASINO_BUILD` is the compile-time store/regional switch (2.12#42): build with
 * `VITE_FEATURE_CASINO=0` for storefronts or regions where simulated gambling is not allowed. The casino
 * is then permanently hidden and the player toggle disappears. Default builds keep it, behind the
 * player's own "Hide casino" setting.
 */
export const CASINO_BUILD: boolean = import.meta.env?.VITE_FEATURE_CASINO !== '0'

export const contentFlags = { hideCasino: !CASINO_BUILD }
