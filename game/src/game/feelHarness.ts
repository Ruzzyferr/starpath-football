/**
 * Match-feel measurement harness: plays real, generated highlight scenarios
 * (sim/match/highlightGen + synthetic teams) through the headless runtime with
 * the human-like bot, and reports success rates per kind × difficulty × bot.
 * Used by feel.test.ts (bands) and its env-gated full report.
 */
import type { Difficulty, Position } from '../core/types'
import { generatedHighlight } from './demoHighlights'
import type { Highlight, HighlightKind, HighlightOutcome } from '../sim/match/types'
import { createHumanBot, humanBotStep, type BotLevel } from './humanBot'
import { HighlightRuntime } from './runtime'
import { isFullSuccess } from '../sim/match/tier'

export const FEEL_KINDS = [
  'one_on_one', 'penalty', 'freekick', 'edge_of_box', 'cross', 'corner', 'defend', 'gk_save',
  'counter_2v1', 'long_ball_control', 'rebound', 'interception', 'hold_up', 'defend_1v1', 'block', 'corner_kick', 'fk_wall',
  'dribble', 'header', 'gk_1v1', 'gk_sweep', 'back_post',
  'long_shot', 'switch_play', 'recovery_run', 'shoulder_duel', 'timed_run', 'press_trap', 'gk_claim', 'gk_distribution',
] as const
export type FeelKind = (typeof FEEL_KINDS)[number]

const HERO_POS: Record<FeelKind, Position> = {
  one_on_one: 'ST', penalty: 'ST', freekick: 'AM', edge_of_box: 'AM', cross: 'LW', corner: 'CB', defend: 'CB', gk_save: 'GK',
  counter_2v1: 'ST', long_ball_control: 'ST', rebound: 'ST', interception: 'CB',
  hold_up: 'ST', defend_1v1: 'RB', block: 'CB', corner_kick: 'LW', fk_wall: 'GK',
  dribble: 'LW', header: 'ST', gk_1v1: 'GK', gk_sweep: 'GK', back_post: 'RB',
  long_shot: 'CM', switch_play: 'CM', recovery_run: 'CM', shoulder_duel: 'ST', timed_run: 'ST', press_trap: 'ST', gk_claim: 'GK', gk_distribution: 'GK',
}

/** What counts as a (full) "success" for the hero in each kind (sim/match/tier isFullSuccess). */
export function isSuccess(kind: HighlightKind, o: HighlightOutcome): boolean {
  return isFullSuccess(kind, o)
}

/** A realistic generated highlight (hero and both teams at `ovr`). */
export function feelHighlight(kind: HighlightKind, seed: number, ovr = 65): Highlight {
  return generatedHighlight(kind, seed, { ovr, heroPos: HERO_POS[kind as FeelKind] })
}

/** Plays one moment with the bot; returns the outcome. */
export function playFeel(kind: FeelKind, seed: number, level: BotLevel, difficulty: Difficulty, ovr = 65): HighlightOutcome {
  const rt = new HighlightRuntime(feelHighlight(kind, seed, ovr), { aimAssist: 'full', slowMoAim: true, difficulty, seed: seed * 7919 + 13 })
  const bot = createHumanBot(level, seed)
  const dt = 1 / 60
  for (let f = 0; f < 60 * 90 && !rt.finished; f++) {
    humanBotStep(rt, bot, dt)
    rt.update(dt)
    rt.drainEvents()
  }
  return rt.result?.outcome ?? 'timeout'
}

/** Success rate over `n` seeds. */
export function feelRate(kind: FeelKind, level: BotLevel, difficulty: Difficulty, n: number, ovr = 65): number {
  let ok = 0
  for (let s = 1; s <= n; s++) if (isSuccess(kind, playFeel(kind, s, level, difficulty, ovr))) ok++
  return ok / n
}
