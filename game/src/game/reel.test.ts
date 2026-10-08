/** Goal reel (WP-V): the same stored input + seed reproduces the same outcome, headless and packed. */
import { describe, expect, it } from 'vitest'
import { makeDemoHighlight } from './demoHighlights'
import { replayInputs, type InputFrame, type InputRecording } from './inputReplay'
import { GOAL_CENTER_Y } from './physics'
import { PITCH_LENGTH } from '../sim/match/types'
import { drainGoalReplays, packRecording, queueGoalReplay, unpackRecording } from '../sim/game/saveHistory'
import { makeGame } from '../sim/game/testHelpers'

const hl = makeDemoHighlight('edge_of_box', 3, 'en', 72)
const opts = { aimAssist: 'half' as const, slowMoAim: false, difficulty: 'normal' as const, weather: 'clear' as const, importance: 0.6, timingMult: 1 }
const frames: InputFrame[] = Array.from({ length: 60 * 30 }, () => ({ dt: 1 / 60 }) as InputFrame)
frames[0] = { dt: 1 / 60, move: { x: 1, y: 0 }, sprint: true }
frames[100] = { dt: 1 / 60, actions: [{ kind: 'shoot', target: { x: PITCH_LENGTH, y: GOAL_CENTER_Y - 1 }, power: 1, curl: 0, chip: false }] }
const rec: InputRecording = { version: 1, highlightId: hl.id, opts, frames }

const outcome = (r: InputRecording) => {
  const rt = replayInputs(hl, r)
  const res = rt.result ?? rt.buildResult('timeout')
  return JSON.stringify({ res, ball: [rt.ball.x.toFixed(4), rt.ball.y.toFixed(4)], t: rt.time.toFixed(4) })
}

describe('goal reel determinism', () => {
  it('replaying the same recording twice gives the identical outcome', () => {
    expect(outcome(rec)).toBe(outcome(rec))
  })
  it('survives the save round trip (pack, JSON, unpack)', () => {
    const back = unpackRecording(JSON.parse(JSON.stringify(packRecording(rec))))
    expect(outcome(back)).toBe(outcome(rec))
  })
  it('stores the scored moment with the queued recording', () => {
    const s = makeGame(31)
    queueGoalReplay(61, rec, hl)
    expect(drainGoalReplays(s)).toBe(1)
    const g = s.replays!.at(-1)!
    expect(g.hl?.id).toBe(hl.id)
    expect(outcome(unpackRecording(JSON.parse(JSON.stringify(g)).rec))).toBe(outcome(rec))
  })
})
