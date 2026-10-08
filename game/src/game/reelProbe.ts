/**
 * Dev / e2e probe for the goal reel (WP-V acceptance): a scripted input recording and its headless
 * outcome, to compare with the same recording played back through the Phaser scene.
 */
import type { HighlightKind } from '../sim/match/types'
import { PITCH_LENGTH } from '../sim/match/types'
import { makeDemoHighlight } from './demoHighlights'
import { replayInputs, type InputFrame, type InputRecording } from './inputReplay'
import { GOAL_CENTER_Y } from './physics'

/** A hero that sprints forward and shoots at frame 100, truncated where the moment ends. */
export function scriptedRecording(kind: HighlightKind, seed: number): InputRecording {
  const hl = makeDemoHighlight(kind, seed, 'en', 72)
  const opts = { aimAssist: 'half' as const, slowMoAim: false, difficulty: 'normal' as const, weather: 'clear' as const, importance: 0.6, timingMult: 1 }
  const frames: InputFrame[] = Array.from({ length: 60 * 40 }, () => ({ dt: 1 / 60 }) as InputFrame)
  frames[0] = { dt: 1 / 60, move: { x: 1, y: 0 }, sprint: true }
  frames[100] = { dt: 1 / 60, actions: [{ kind: 'shoot', target: { x: PITCH_LENGTH, y: GOAL_CENTER_Y - 1 }, power: 1, curl: 0, chip: false }] }
  let n = 0
  replayInputs(hl, { version: 1, highlightId: hl.id, opts, frames }, (r) => { if (!r.finished) n++ })
  return { version: 1, highlightId: hl.id, opts, frames: frames.slice(0, Math.min(frames.length, n + 1)) }
}

/** Outcome of a recording replayed without any rendering. */
export function headlessOutcome(kind: HighlightKind, seed: number, rec: InputRecording) {
  const rt = replayInputs(makeDemoHighlight(kind, seed, 'en', 72), rec)
  return rt.result ?? rt.buildResult('timeout')
}
