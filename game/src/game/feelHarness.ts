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

export const FEEL_KINDS = [
  'one_on_one', 'penalty', 'freekick', 'edge_of_box', 'cross', 'corner', 'defend', 'gk_save',
  'counter_2v1', 'long_ball_control', 'rebound', 'interception', 'hold_up', 'defend_1v1', 'block',
] as const
export type FeelKind = (typeof FEEL_KINDS)[number]

const HERO_POS: Record<FeelKind, Position> = {
  one_on_one: 'ST', penalty: 'ST', freekick: 'AM', edge_of_box: 'AM', cross: 'LW', corner: 'CB', defend: 'CB', gk_save: 'GK',
  counter_2v1: 'ST', long_ball_control: 'ST', rebound: 'ST', interception: 'CB',
  hold_up: 'ST', defend_1v1: 'RB', block: 'CB',
}

/** What counts as a "success" for the hero in each kind. */
export function isSuccess(kind: HighlightKind, o: HighlightOutcome): boolean {
  switch (kind) {
    case 'cross':
    case 'corner':
      return o === 'goal' || o === 'assist'
    case 'counter_2v1':
      return o === 'goal' || o === 'assist'
    case 'long_ball_control':
    case 'hold_up':
      return o === 'goal' || o === 'assist' || o === 'pass_complete' || o === 'foul_won'
    case 'defend':
    case 'interception':
    case 'defend_1v1':
    case 'block':
      return o === 'defended' || o === 'foul_won'
    case 'gk_save':
    case 'gk_penalty':
      return o !== 'conceded'
    default:
      return o === 'goal'
  }
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
