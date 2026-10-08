import { afterEach, describe, expect, it, vi } from 'vitest'
import { CLIP_MAX_MS, canRecordClip, pickClipMime, startClip } from './clipExport'

class FakeRecorder {
  static types = ['video/webm']
  static isTypeSupported(m: string) { return FakeRecorder.types.includes(m) }
  state: 'inactive' | 'recording' = 'inactive'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(_stream: unknown, _o?: { mimeType?: string }) { void _stream; void _o }
  start() { this.state = 'recording'; this.ondataavailable?.({ data: new Blob(['x']) }) }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['yz']) }); this.onstop?.() }
}
const env = { MediaRecorder: FakeRecorder as unknown as never }
const canvas = () => ({ captureStream: () => ({ getTracks: () => [{ stop() {} }] }) }) as unknown as HTMLCanvasElement

afterEach(() => vi.useRealTimers())

describe('clip export', () => {
  it('feature-detects: no MediaRecorder / no webm support / no captureStream means unsupported', () => {
    expect(pickClipMime({})).toBeNull()
    FakeRecorder.types = []
    expect(pickClipMime(env)).toBeNull()
    FakeRecorder.types = ['video/webm']
    expect(pickClipMime(env)).toBe('video/webm')
    expect(canRecordClip(canvas(), env)).toBe(true)
    expect(canRecordClip({} as HTMLCanvasElement, env)).toBe(false)
    expect(startClip({} as HTMLCanvasElement, { env })).toBeNull()
  })
  it('caps the recording at 15 s and resolves a webm blob', async () => {
    vi.useFakeTimers()
    const r = startClip(canvas(), { env, maxMs: 60_000 })!
    expect(r).not.toBeNull()
    vi.advanceTimersByTime(CLIP_MAX_MS - 1)
    expect(r.capped).toBe(false)
    vi.advanceTimersByTime(2)
    expect(r.capped).toBe(true)
    const blob = await r.done
    expect(blob.type).toBe('video/webm')
    expect(blob.size).toBe(3)
  })
  it('stop() ends early without the cap', async () => {
    vi.useFakeTimers()
    const r = startClip(canvas(), { env })!
    r.stop()
    await r.done
    expect(r.capped).toBe(false)
  })
})
