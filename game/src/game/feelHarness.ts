/**
 * Match-feel measurement harness: plays real, generated highlight scenarios
 * (sim/match/highlightGen + synthetic teams) through the headless runtime with
 * the human-like bot, and reports success rates per kind × difficulty × bot.
 * Used by feel.test.ts (bands) and its env-gated full report.
 */
import { Rng } from '../core/rng'
import type { Difficulty, Formation, Position } from '../core/types'
import { assignSlots, buildScenario, type SlotPlayer } from '../sim/match/highlightGen'
import { makeTeam } from '../sim/match/testFixtures'
import type { Highlight, HighlightKind, HighlightOutcome } from '../sim/match/types'
import { createHumanBot, humanBotStep, type BotLevel } from './humanBot'
import { HighlightRuntime } from './runtime'

export const FEEL_KINDS = ['one_on_one', 'penalty', 'freekick', 'edge_of_box', 'cross', 'corner', 'defend', 'gk_save'] as const
export type FeelKind = (typeof FEEL_KINDS)[number]

const HERO_POS: Record<FeelKind, Position> = {
  one_on_one: 'ST', penalty: 'ST', freekick: 'AM', edge_of_box: 'AM', cross: 'LW', corner: 'CB', defend: 'CB', gk_save: 'GK',
}

/** What counts as a "success" for the hero in each kind. */
export function isSuccess(kind: HighlightKind, o: HighlightOutcome): boolean {
  switch (kind) {
    case 'cross':
    case 'corner':
      return o === 'goal' || o === 'assist'
    case 'defend':
      return o === 'defended' || o === 'foul_won'
    case 'gk_save':
    case 'gk_penalty':
      return o !== 'conceded'
    default:
      return o === 'goal'
  }
}

/** A realistic generated highlight (hero and both teams at `ovr`). */
export function feelHighlight(kind: FeelKind, seed: number, ovr = 65): Highlight {
  const rng = new Rng(`feel:${kind}:${seed}`)
  const mf: Formation = '4-2-3-1'
  const of: Formation = '4-4-2'
  const home = makeTeam(rng, 'h', { heroPosition: HERO_POS[kind], formation: mf, ovr, heroOvr: ovr })
  const away = makeTeam(rng, 'a', { formation: of, ovr })
  const toSlots = (players: typeof home.lineup, f: Formation): SlotPlayer[] => {
    const s = assignSlots(players, f)
    return players.map((player, i) => ({ player, slot: s[i] }))
  }
  const g = buildScenario({
    kind, heroSide: 'home', heroId: 'hero', mates: toSlots(home.lineup, mf), opps: toSlots(away.lineup, of), mateFormation: mf, oppFormation: of, lang: 'en', rng,
  })
  return { id: `feel_${kind}_${seed}`, minute: 30, side: 'home', kind, score: [0, 0], scenario: g.scenario }
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
