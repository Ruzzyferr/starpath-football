/**
 * Grass palette of the match scene: [light stripe, dark stripe, apron] per
 * weather, day and night. Phaser-free so UI surfaces (live hub, radar, line-ups)
 * share the exact greens of the scene — `PITCH_COLORS.clear` is the default turf,
 * mirrored by `--pitch-a` / `--pitch-b` in styles/tokens.css (checked by a test).
 */
export type PitchWeather = 'clear' | 'rain' | 'snow' | 'hot' | 'wind' | 'night'

export const PITCH_COLORS: Readonly<Record<PitchWeather, readonly [string, string, string]>> = {
  clear: ['#3f9140', '#358236', '#2c6d2e'],
  wind: ['#3f9140', '#358236', '#2c6d2e'],
  hot: ['#5f9a3b', '#538b33', '#4a7d2e'],
  rain: ['#2f7a37', '#286c30', '#21592a'],
  snow: ['#86ab8f', '#7a9f84', '#6c917a'],
  night: ['#23602f', '#1d5229', '#163f20'],
}
