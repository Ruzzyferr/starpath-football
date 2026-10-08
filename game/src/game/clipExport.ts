/**
 * Clip export (GAP 2.12#73 / 2.10#40): records the match canvas to WebM through
 * `canvas.captureStream` + `MediaRecorder`. Everything is feature-detected: where the
 * browser cannot record, {@link canRecordClip} is false and the UI hides the button.
 */

/** Longest clip (ms). */
export const CLIP_MAX_MS = 15_000
const MIMES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'] as const

interface RecorderEnv {
  MediaRecorder?: { new (s: MediaStream, o?: MediaRecorderOptions): MediaRecorder; isTypeSupported?: (m: string) => boolean }
}

/** First WebM mime type this browser can encode, or null. */
export function pickClipMime(env: RecorderEnv = globalThis as unknown as RecorderEnv): string | null {
  const MR = env.MediaRecorder
  if (typeof MR !== 'function') return null
  const ok = MR.isTypeSupported
  if (typeof ok !== 'function') return null
  return MIMES.find((m) => ok.call(MR, m)) ?? null
}

/** True when `canvas` can be recorded to a WebM clip here. */
export function canRecordClip(canvas?: HTMLCanvasElement | null, env?: RecorderEnv): boolean {
  if (canvas && typeof (canvas as HTMLCanvasElement & { captureStream?: unknown }).captureStream !== 'function') return false
  if (!canvas && typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream !== 'function') return false
  return pickClipMime(env) !== null
}

export interface ClipRecorder {
  /** Resolves with the finished clip (after `stop()` or when the cap is reached). */
  done: Promise<Blob>
  /** Ends the recording early. */
  stop(): void
  /** True once the 15 s cap fired. */
  readonly capped: boolean
}

/** Starts recording `canvas`; auto-stops at `maxMs` (default {@link CLIP_MAX_MS}). Null when unsupported. */
export function startClip(canvas: HTMLCanvasElement, opts: { maxMs?: number; fps?: number; env?: RecorderEnv } = {}): ClipRecorder | null {
  const mime = pickClipMime(opts.env)
  if (!mime || typeof canvas.captureStream !== 'function') return null
  const MR = (opts.env ?? (globalThis as unknown as RecorderEnv)).MediaRecorder!
  let stream: MediaStream
  let rec: MediaRecorder
  try {
    stream = canvas.captureStream(opts.fps ?? 30)
    rec = new MR(stream, { mimeType: mime, videoBitsPerSecond: 3_500_000 })
  } catch {
    return null
  }
  const chunks: Blob[] = []
  let capped = false
  let ended = false
  const maxMs = Math.min(CLIP_MAX_MS, Math.max(500, opts.maxMs ?? CLIP_MAX_MS))
  const done = new Promise<Blob>((resolve, reject) => {
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
    rec.onerror = () => reject(new Error('record-failed'))
    rec.onstop = () => {
      for (const tr of stream.getTracks()) tr.stop()
      resolve(new Blob(chunks, { type: mime.split(';')[0] }))
    }
  })
  const stop = () => {
    if (ended) return
    ended = true
    clearTimeout(timer)
    try {
      if (rec.state !== 'inactive') rec.stop()
    } catch {
      /* already stopped */
    }
  }
  const timer = setTimeout(() => { capped = true; stop() }, maxMs)
  rec.start(500)
  return { done, stop, get capped() { return capped } }
}
