/**
 * Deterministic input recording and replay for the highlight player (WP-13).
 *
 * The runtime is deterministic for a given seed and sequence of
 * `setControl` / `queueAction` / `aim` / `update(dt)` calls. {@link applyInput}
 * is the single place the live scene feeds input into the runtime, and the
 * recorder stores exactly what it applied, so {@link replayInputs} reproduces
 * the same moment bit for bit (debugging, bug reports, regression tests).
 *
 * Continuous input is delta-compressed: move/sprint are stored only when they
 * change, and frames are grouped into 80 ms input samples for compact logs
 * (the per-frame dt is kept, so the replay is exact).
 */
import type { Highlight } from '../sim/match/types'
import type { Vec2 } from './model'
import { HighlightRuntime, type AimState, type HeroAction, type RuntimeOptions } from './runtime'

/** Input sample bucket length (seconds) for log grouping. */
export const INPUT_SAMPLE = 0.08

/** One applied frame. `move`/`sprint` omitted = unchanged from the previous frame. */
export interface InputFrame {
  dt: number
  move?: Vec2
  sprint?: boolean
  actions?: HeroAction[]
  aim?: AimState | null
}

/** A full recording: runtime options (incl. seed) plus the frames. */
export interface InputRecording {
  version: 1
  highlightId: string
  opts: RuntimeOptions
  frames: InputFrame[]
}

/** What the scene applies to the runtime this frame. */
export interface FrameInput {
  move: Vec2
  sprint: boolean
  actions: readonly HeroAction[]
  aim: AimState | null
}

/** Records applied input frames (delta-compressed). */
export class InputRecorder {
  readonly frames: InputFrame[] = []
  private last: { mx: number; my: number; sprint: boolean } | null = null
  private lastAim = 'null'

  /** Appends one applied frame. */
  record(input: FrameInput, dt: number): void {
    const f: InputFrame = { dt }
    const l = this.last
    if (!l || l.mx !== input.move.x || l.my !== input.move.y) f.move = { x: input.move.x, y: input.move.y }
    if (!l || l.sprint !== input.sprint) f.sprint = input.sprint
    this.last = { mx: input.move.x, my: input.move.y, sprint: input.sprint }
    if (input.actions.length) f.actions = input.actions.map((a) => structuredCloneSafe(a))
    // Cheap path for the common no-aim frame; serialise only while aiming.
    const aimKey = input.aim ? JSON.stringify(input.aim) : 'null'
    if (aimKey !== this.lastAim) {
      f.aim = input.aim ? structuredCloneSafe(input.aim) : null
      this.lastAim = aimKey
    }
    this.frames.push(f)
  }

  /** Number of 80 ms input samples covered (for log summaries). */
  samples(): number {
    let t = 0
    for (const f of this.frames) t += f.dt
    return Math.ceil(t / INPUT_SAMPLE)
  }

  /** Builds a serialisable recording. */
  toRecording(highlightId: string, opts: RuntimeOptions): InputRecording {
    return { version: 1, highlightId, opts: { ...opts }, frames: this.frames.slice() }
  }

  /** The kicks of this recording as compact `{t, dx, dy, curve, lift}` events (plan 2.1#34). */
  kicks(): KickEvent[] {
    return kickEvents(this.frames)
  }
}

/**
 * One hero kick input (plan 2.1#34). `t` is seconds from the moment start;
 * `dx/dy` the drag vector (swipe) or the aim target (button/mouse shots and
 * passes) in pitch metres; `curve` −1..1; `lift` 1 = chip/lofted, 0 = driven;
 * `power` 0..1.15 when the input carried one.
 */
export interface KickEvent {
  t: number
  kind: 'swipe' | 'shoot' | 'pass'
  dx: number
  dy: number
  curve: number
  lift: number
  power?: number
}

const r3 = (v: number) => Math.round(v * 1000) / 1000

/** Extracts the kick events from applied frames (pure; used for bug reports and tests). */
export function kickEvents(frames: readonly InputFrame[]): KickEvent[] {
  const out: KickEvent[] = []
  let t = 0
  for (const f of frames) {
    for (const a of f.actions ?? []) {
      if (a.kind === 'swipe' && !a.swipe.isTap) {
        const sw = a.swipe
        out.push({ t: r3(t), kind: 'swipe', dx: r3(sw.dir.x * sw.length), dy: r3(sw.dir.y * sw.length), curve: r3(sw.curl), lift: sw.chip ? 1 : 0, power: r3(sw.power) })
      } else if (a.kind === 'shoot') {
        out.push({ t: r3(t), kind: 'shoot', dx: r3(a.target.x), dy: r3(a.target.y), curve: r3(a.curl), lift: a.chip ? 1 : 0, power: r3(a.power) })
      } else if (a.kind === 'pass' && a.target) {
        out.push({ t: r3(t), kind: 'pass', dx: r3(a.target.x), dy: r3(a.target.y), curve: 0, lift: a.lofted ? 1 : 0 })
      }
    }
    t += f.dt
  }
  return out
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

/**
 * Feeds one frame of input into the runtime and advances it. The live scene
 * and the replayer both go through here, so they cannot drift apart.
 */
export function applyInput(rt: HighlightRuntime, input: FrameInput, dt: number, rec?: InputRecorder | null): void {
  rt.setControl({ move: input.move, sprint: input.sprint })
  for (const a of input.actions) rt.queueAction(a)
  rt.aim = input.aim && rt.heroOnBall ? input.aim : null
  rec?.record(input, dt)
  rt.update(dt)
}

/**
 * Replays a recording into a fresh runtime. Returns the runtime after the last
 * frame (`rt.result` holds the outcome if the moment finished).
 * @param onFrame optional per-frame hook (e.g. draining events)
 */
export function replayInputs(highlight: Highlight, rec: InputRecording, onFrame?: (rt: HighlightRuntime) => void): HighlightRuntime {
  const rt = new HighlightRuntime(highlight, rec.opts)
  let move: Vec2 = { x: 0, y: 0 }
  let sprint = false
  let aim: AimState | null = null
  for (const f of rec.frames) {
    if (f.move) move = f.move
    if (f.sprint !== undefined) sprint = f.sprint
    if (f.aim !== undefined) aim = f.aim
    applyInput(rt, { move, sprint, actions: f.actions ?? [], aim }, f.dt)
    onFrame?.(rt)
  }
  return rt
}
