/**
 * Offline renders of music tracks, stings, crowd states and UI sounds through
 * the real mixer (OfflineAudioContext), for level checks and listening tests.
 * Used by the audio lab page and by scripts/render-audio.mjs (Playwright).
 */
import { analyze, encodeWav, type LevelStats } from '../analysis'
import { CHANTS, loadCrowdTextures } from '../crowd'
import { buildRig } from '../engine'
import { DEFAULT_MIX, type MixSettings } from '../mixer'
import type { StingId, TrackId } from '../music'
import { UI_SOUNDS, playUiSound } from '../uiSfx'

export interface Scenario {
  id: string
  seconds: number
  run(r: ReturnType<typeof buildRig>): void | Promise<void>
}

const music = (id: TrackId, seconds: number, intensity = 0.3): Scenario => ({
  id: `music-${id}${id === 'tension' ? `-i${Math.round(intensity * 100)}` : ''}`,
  seconds,
  run: (r) => {
    r.music.play(id, { now: true, intensity })
  },
})

const sting = (id: StingId): Scenario => ({
  id: `sting-${id}`,
  seconds: 5,
  run: (r) => {
    r.music.sting(id, 0.05)
  },
})

const crowd = (id: string, capacity: number, importance: number, seconds: number, events: (c: ReturnType<typeof buildRig>['crowd']) => void, withMusic?: TrackId): Scenario => ({
  id: `crowd-${id}`,
  seconds,
  run: async (r) => {
    await r.crowd.init(await loadCrowdTextures())
    r.crowd.setAllegiance('home', 0.85)
    r.crowd.setStadium(capacity, importance, 0)
    r.crowd.setActive(true, 0, 0.3)
    if (withMusic) r.music.play(withMusic, { now: true })
    events(r.crowd)
  },
})

export const SCENARIOS: Scenario[] = [
  music('menu', 34),
  music('hub', 22),
  music('tension', 12, 0.15),
  music('tension', 12, 0.9),
  music('awards', 20),
  sting('victory'),
  sting('defeat'),
  sting('draw'),
  sting('fanfare'),
  crowd('small-ground', 600, 0.2, 14, (c) => {
    c.chance('home', 0.6, 4)
    c.goal('home', 8)
  }),
  crowd('big-bed', 60000, 0.6, 10, () => undefined),
  crowd('goal-home', 60000, 0.8, 14, (c) => {
    c.chance('home', 0.8, 1)
    c.goal('home', 2.5)
  }),
  crowd('goal-away', 60000, 0.8, 12, (c) => c.goal('away', 2)),
  crowd('ooh-foul-card', 35000, 0.5, 14, (c) => {
    c.nearMiss('home', 1)
    c.foul('away', null, 5)
    c.foul('away', 'yellow', 8)
    c.foul('home', 'yellow', 11)
  }),
  crowd('chants', 45000, 0.7, 26, (c) => {
    c.chant(CHANTS[0]!, 2, 0.5)
    c.chant(CHANTS[1]!, 2, 9.5)
    c.chant(CHANTS[2]!, 2, 16)
  }),
  crowd('time-wasting', 30000, 0.6, 10, (c) => c.timeWasting(1)),
  crowd('goal-duck-music', 50000, 0.7, 14, (c) => c.goal('home', 4), 'hub'),
  {
    id: 'ui-all',
    seconds: UI_SOUNDS.length * 0.7 + 1,
    run: (r) => {
      UI_SOUNDS.forEach((name, i) => playUiSound(r.ctx, r.mixer.input.ui, name, 0.2 + i * 0.7))
    },
  },
]

export interface RenderResult {
  id: string
  sampleRate: number
  stats: LevelStats
  /** Render time / audio time (rough CPU share of one core). */
  cpu: number
  wav?: string
}

function base64(u8: Uint8Array): string {
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < u8.length; i += chunk) s += String.fromCharCode(...u8.subarray(i, i + chunk))
  return btoa(s)
}

/** Worst case: every slider at 100 %. */
export const LOUD_MIX: MixSettings = { ...DEFAULT_MIX, master: 1, music: 1, sfx: 1, crowd: 1, ui: 1, voice: 1 }

/**
 * `raw`: renders with master 40 dB down so the compressor/limiter stay idle and
 * reports levels +40 dB, i.e. what the mix feeds into the limiter.
 */
export async function renderScenario(id: string, opts: { wav?: boolean; sampleRate?: number; mix?: MixSettings; raw?: boolean } = {}): Promise<RenderResult> {
  const sc = SCENARIOS.find((s) => s.id === id)
  if (!sc) throw new Error(`unknown scenario ${id}`)
  const sr = opts.sampleRate ?? 44100
  const ctx = new OfflineAudioContext(2, Math.round(sc.seconds * sr), sr)
  // Timers are never needed offline: everything is pumped up front.
  const mix = opts.raw ? { ...(opts.mix ?? LOUD_MIX), master: 0.1 } : (opts.mix ?? LOUD_MIX)
  const rig = buildRig(ctx, mix, { timers: { timers: { setInterval: () => 0, clearInterval: () => undefined } } })
  await sc.run(rig)
  // Pump the scheduler in slices like the live 25 ms timer would (via
  // suspend/resume), so the graph holds a realistic number of live nodes.
  const slice = 0.25
  for (let t = slice; t < sc.seconds; t += slice) {
    void ctx.suspend(t).then(() => {
      rig.scheduler.pump(t + slice + 0.15, t)
      void ctx.resume()
    })
  }
  rig.scheduler.pump(slice + 0.15, 0)
  const t0 = performance.now()
  const buf = await ctx.startRendering()
  const renderMs = performance.now() - t0
  const chans = [buf.getChannelData(0), buf.getChannelData(1)]
  // Skip the first 0.3 s (fade-ins) for the window statistics.
  const stats = analyze(chans, sr, 0.3)
  if (opts.raw) {
    // master 0.1 → gain 0.01 (-40 dB); the -1.5 dB output trim stays.
    for (const k of ['peakDb', 'rmsDb', 'minWindowDb', 'maxWindowDb'] as const) stats[k] += 40 + 1.5
  }
  return { id, sampleRate: sr, stats, cpu: renderMs / 1000 / sc.seconds, wav: opts.wav ? base64(encodeWav(chans, sr)) : undefined }
}
