/**
 * Minimal fake BaseAudioContext for unit tests (node has no WebAudio).
 * Every `createX()` returns a node whose AudioParams record automation calls;
 * the context counts created nodes per kind so tests can assert voice caps.
 */

export class FakeParam {
  value: number
  events: { kind: string; value: number; time: number }[] = []

  constructor(v = 1) {
    this.value = v
  }

  setValueAtTime(v: number, t: number): this {
    this.events.push({ kind: 'set', value: v, time: t })
    return this
  }

  linearRampToValueAtTime(v: number, t: number): this {
    this.events.push({ kind: 'linear', value: v, time: t })
    return this
  }

  exponentialRampToValueAtTime(v: number, t: number): this {
    if (!(v > 0)) throw new RangeError('exponential ramp to non-positive value')
    this.events.push({ kind: 'exp', value: v, time: t })
    return this
  }

  setTargetAtTime(v: number, t: number, tc: number): this {
    if (!(tc >= 0)) throw new RangeError('bad time constant')
    this.events.push({ kind: 'target', value: v, time: t })
    return this
  }

  cancelScheduledValues(t: number): this {
    this.events = this.events.filter((e) => e.time < t)
    return this
  }

  /** Last scheduled target value (or the static value). */
  get last(): number {
    return this.events.length ? this.events[this.events.length - 1]!.value : this.value
  }
}

const PARAMS = ['gain', 'frequency', 'detune', 'Q', 'threshold', 'knee', 'ratio', 'attack', 'release', 'pan', 'delayTime', 'playbackRate']

export class FakeNode {
  readonly kind: string
  started: number | null = null
  stopped: number | null = null
  connections: unknown[] = []
  onended: (() => void) | null = null;
  [k: string]: unknown

  constructor(kind: string) {
    this.kind = kind
    for (const p of PARAMS) this[p] = new FakeParam(p === 'gain' || p === 'playbackRate' ? 1 : 0)
  }

  connect<T>(n: T): T {
    this.connections.push(n)
    return n
  }

  disconnect(): void {
    this.connections = []
  }

  start(t = 0): void {
    if (this.started !== null) throw new Error('start() called twice')
    this.started = t
  }

  stop(t = 0): void {
    this.stopped = t
  }
}

export class FakeBuffer {
  readonly numberOfChannels: number
  readonly length: number
  readonly sampleRate: number
  private data: Float32Array[]

  constructor(ch: number, len: number, sr: number) {
    this.numberOfChannels = ch
    this.length = len
    this.sampleRate = sr
    this.data = Array.from({ length: ch }, () => new Float32Array(len))
  }

  get duration(): number {
    return this.length / this.sampleRate
  }

  getChannelData(c: number): Float32Array {
    return this.data[c]!
  }
}

export class FakeAudioContext {
  currentTime = 0
  sampleRate: number
  state: 'suspended' | 'running' | 'closed' = 'suspended'
  readonly destination = new FakeNode('destination')
  created: Record<string, number> = {}
  resumes = 0

  constructor(opts?: { sampleRate?: number }) {
    this.sampleRate = opts?.sampleRate ?? 48000
  }

  private make(kind: string): FakeNode {
    this.created[kind] = (this.created[kind] ?? 0) + 1
    return new FakeNode(kind)
  }

  createGain() { return this.make('gain') }
  createOscillator() { return this.make('oscillator') }
  createBiquadFilter() { return this.make('biquad') }
  createDynamicsCompressor() { return this.make('compressor') }
  createWaveShaper() { return this.make('shaper') }
  createConvolver() { return this.make('convolver') }
  createDelay() { return this.make('delay') }
  createStereoPanner() { return this.make('panner') }
  createBufferSource() { return this.make('bufferSource') }
  createBuffer(ch: number, len: number, sr: number) {
    this.created.buffer = (this.created.buffer ?? 0) + 1
    return new FakeBuffer(ch, len, sr)
  }

  resume(): Promise<void> {
    this.resumes++
    this.state = 'running'
    return Promise.resolve()
  }

  suspend(): Promise<void> {
    this.state = 'suspended'
    return Promise.resolve()
  }

  close(): Promise<void> {
    this.state = 'closed'
    return Promise.resolve()
  }
}

/** Cast helper: tests pass the fake where a BaseAudioContext is expected. */
export function fakeCtx(): BaseAudioContext & Pick<FakeAudioContext, 'created' | 'resumes'> {
  return new FakeAudioContext() as unknown as BaseAudioContext & Pick<FakeAudioContext, 'created' | 'resumes'>
}
