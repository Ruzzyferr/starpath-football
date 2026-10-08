/**
 * Player animation set (GAP 2.2#24, #26), Phaser-free so it is unit tested.
 * The procedural figures (figures.ts) bake every pose below into the kit
 * atlas: 8 run frames, a 4-frame walk, a 3-frame idle (breathing), and a
 * contact + follow-through pair for each strike style.
 */

export const RUN_FRAMES = 8
/** Walk cycle and idle (breathing) frames. */
export const WALK_FRAMES = 4
export const IDLE_FRAMES = 3
/** Strike styles with their own contact + follow-through frames. */
export type KickStyle = 'power' | 'side' | 'chip' | 'outside'
export const KICK_STYLES: readonly KickStyle[] = ['power', 'side', 'chip', 'outside']

/** Every animation-cycle pose name baked into the atlas (on top of the action poses). */
export const ANIM_POSES: readonly string[] = [
  ...Array.from({ length: IDLE_FRAMES }, (_, i) => `idle${i}`),
  ...Array.from({ length: WALK_FRAMES }, (_, i) => `walk${i}`),
  ...Array.from({ length: RUN_FRAMES }, (_, i) => `run${i}`),
  ...KICK_STYLES.flatMap((s) => [`kick_${s}0`, `kick_${s}1`]),
]

/**
 * Strike style for a kick event: hard shots and long balls = power, chips =
 * chip, strongly curled balls = outside of the boot, everything else (passes,
 * placed finishes) = inside of the foot. `curl` is 0..1+.
 */
export function kickStyleFor(kind: string, power: number, curl = 0): KickStyle {
  if (kind === 'chip') return 'chip'
  if (Math.abs(curl) > 0.6 && kind !== 'header') return 'outside'
  if ((kind === 'shot' || kind === 'freekick' || kind === 'penalty' || kind === 'cross' || kind === 'lofted') && power >= 0.8) return 'power'
  return 'side'
}
