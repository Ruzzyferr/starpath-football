/**
 * Level analysis + WAV encoding for offline renders (audio lab, CI checks).
 */

export interface LevelStats {
  seconds: number
  peakDb: number
  rmsDb: number
  /** Quietest / loudest 250 ms window RMS (dBFS). */
  minWindowDb: number
  maxWindowDb: number
  /** Fraction of 250 ms windows below -60 dBFS. */
  silentRatio: number
  nan: number
  dc: number
}

const toDb = (x: number): number => (x > 0 ? 20 * Math.log10(x) : -Infinity)

export function analyze(channels: readonly Float32Array[], sampleRate: number, skipSeconds = 0): LevelStats {
  const n = channels[0]?.length ?? 0
  const start = Math.min(n, Math.round(skipSeconds * sampleRate))
  const win = Math.max(1, Math.round(0.25 * sampleRate))
  let peak = 0
  let sum = 0
  let nan = 0
  let dcSum = 0
  let count = 0
  let minW = Infinity
  let maxW = -Infinity
  let silent = 0
  let windows = 0
  for (let w = start; w + win <= n; w += win) {
    let ws = 0
    for (let i = w; i < w + win; i++) {
      for (const ch of channels) {
        const v = ch[i]!
        if (!Number.isFinite(v)) {
          nan++
          continue
        }
        const a = Math.abs(v!)
        if (a > peak) peak = a
        ws += v * v
        dcSum += v
        count++
      }
    }
    sum += ws
    const wr = toDb(Math.sqrt(ws / (win * channels.length)))
    minW = Math.min(minW, wr)
    maxW = Math.max(maxW, wr)
    if (wr < -60) silent++
    windows++
  }
  return {
    seconds: n / sampleRate,
    peakDb: toDb(peak),
    rmsDb: toDb(Math.sqrt(sum / Math.max(1, count))),
    minWindowDb: windows ? minW : -Infinity,
    maxWindowDb: windows ? maxW : -Infinity,
    silentRatio: windows ? silent / windows : 1,
    nan,
    dc: dcSum / Math.max(1, count),
  }
}

/** 16-bit PCM WAV (interleaved). */
export function encodeWav(channels: readonly Float32Array[], sampleRate: number): Uint8Array {
  const chs = channels.length
  const n = channels[0]?.length ?? 0
  const dataLen = n * chs * 2
  const buf = new ArrayBuffer(44 + dataLen)
  const v = new DataView(buf)
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i))
  }
  str(0, 'RIFF')
  v.setUint32(4, 36 + dataLen, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, chs, true)
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * chs * 2, true)
  v.setUint16(32, chs * 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, dataLen, true)
  let o = 44
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < chs; c++) {
      const s = Math.max(-1, Math.min(1, channels[c]![i] || 0))
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      o += 2
    }
  }
  return new Uint8Array(buf)
}
