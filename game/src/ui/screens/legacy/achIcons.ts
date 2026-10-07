/**
 * Achievement glyphs for the UI. The catalogue keeps an emoji per entry for
 * platform stores (Steam etc.); in-game we draw a consistent stroke icon on a
 * procedural medal so weights and colours match the rest of the interface.
 */
import type { IconName } from '../../icons'
import type { AchCategory } from '../../../sim/game/achievements'

export const ACH_CAT_ICON: Record<AchCategory, IconName> = {
  career: 'career',
  match: 'ball',
  goalkeeping: 'shield',
  life: 'heart',
  responsible: 'shield-check',
  training: 'barbell',
  legacy: 'crown',
}

const BY_ID: Record<string, IconName> = {
  first_contract: 'handshake', debut: 'boot', first_goal: 'ball', goals_50: 'target', goals_100: 'goal', goals_250: 'fire', goals_500: 'crown',
  assists_50: 'users', assists_150: 'sparkle', apps_100: 'calendar', apps_300: 'pitch', apps_500: 'building', motm_10: 'star-fill',
  ovr_70: 'trend-up', ovr_80: 'rocket', ovr_90: 'verified', young_star: 'sparkle', first_trophy: 'trophy', trophies_10: 'trophy',
  first_award: 'medal', golden_star: 'star', golden_boot: 'boot', national_call: 'flag', caps_50: 'medal', int_goals_20: 'flag',
  star_role: 'star', captain: 'shield-check', big_club: 'building', abroad: 'airplane', journeyman: 'map-pin', seasons_10: 'calendar',
  perks_5: 'brain', perk_capstone: 'sparkle', hat_trick: 'ball', hat_tricks_5: 'ball', four_goals: 'fire', free_kick_goal: 'crosshair',
  free_kicks_10: 'crosshair', penalty_goal: 'target', header_goal: 'user', perfect_game: 'star-fill', three_assists: 'gift',
  final_goal: 'trophy', giant_killer: 'shield', win_streak_5: 'chart-bar', veteran: 'hourglass', gk_clean_sheet: 'shield-check',
  gk_clean_sheets_25: 'shield', gk_wall: 'shield', gk_goal: 'goal', millionaire: 'coins', multi_millionaire: 'wallet',
  followers_100k: 'instagram', followers_1m: 'megaphone', first_home: 'house', car_collector: 'car', sponsor: 'handshake',
  super_agent: 'scales', happy_life: 'smile', saver: 'piggy', walk_away: 'sign-out', in_control: 'heartbeat', never_gambled: 'shield-check',
  professional: 'verified', drill_s: 'barbell', drill_s_10: 'barbell', drill_all_s: 'list', drills_100: 'stopwatch', trial_star: 'spotlight',
  record_breaker: 'chart-line', retired: 'hand-heart', testimonial: 'party', one_club: 'heart-fill', hall_of_fame: 'crown',
  legacy_start: 'history', dynasty: 'users', three_careers: 'shuffle', collector_30: 'medal', completionist: 'trophy',
}

export function achIcon(id: string, cat: AchCategory): IconName {
  return BY_ID[id] ?? ACH_CAT_ICON[cat]
}
