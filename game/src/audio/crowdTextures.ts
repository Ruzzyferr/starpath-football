/**
 * Builds every crowd texture buffer (src/audio/voices.ts). This takes a few
 * hundred ms of pure DSP, so it runs in a Web Worker when one is available
 * (no main-thread jank on phones) and falls back to chunked main-thread
 * rendering (tests, old WebViews). Results are cached for the session.
 */
import {
  TEXTURE_RATE, renderApplause, renderBabble, renderBoo, renderChantSyllable, renderCheer, renderClapHit, renderGoalYell, renderGroan,
  renderOoh, renderPinkNoise, renderShout, renderWhistles,
} from './voices'

export type ChantSyl = 'o' | 'e' | 'a' | 'hey' | 'ole'

export interface CrowdTextures {
  babble: [Float32Array, Float32Array]
  cheer: [Float32Array, Float32Array]
  roar: Float32Array
  goalYell: Float32Array
  ooh: Float32Array
  groan: Float32Array
  boo: Float32Array
  whistles: Float32Array
  applause: Float32Array
  clapHit: Float32Array
  chant: Record<ChantSyl, Float32Array>
  shouts: Float32Array[]
}

/** Base pitch of the rendered chant syllables (G3). */
export const CHANT_BASE_HZ = 196

type Partialish = Omit<Partial<CrowdTextures>, 'chant'> & { chant: Partial<Record<ChantSyl, Float32Array>> }

/** The render jobs, in priority order (bed first). */
export function textureJobs(t: Partialish): (() => void)[] {
  return [
    () => (t.babble = [renderBabble(8, 14, 101), renderBabble(8, 14, 202)]),
    () => (t.roar = renderPinkNoise(4, 303, TEXTURE_RATE)),
    () => (t.cheer = [renderCheer(6, 14, 404), renderCheer(6, 14, 505)]),
    () => (t.goalYell = renderGoalYell(32, 606)),
    () => (t.ooh = renderOoh(28, 707)),
    () => (t.groan = renderGroan(24, 808)),
    () => (t.boo = renderBoo(5, 16, 909)),
    () => (t.whistles = renderWhistles(5, 14, 1010)),
    () => (t.applause = renderApplause(5, 110, 1111)),
    () => (t.clapHit = renderClapHit(70, 0.035, 1212)),
    () => {
      t.chant.o = renderChantSyllable('o', undefined, CHANT_BASE_HZ, 0.5, 26, 1313)
      t.chant.e = renderChantSyllable('e', 'eh', CHANT_BASE_HZ, 0.5, 26, 1414)
    },
    () => {
      t.chant.a = renderChantSyllable('a', undefined, CHANT_BASE_HZ, 0.9, 26, 1515)
      t.chant.hey = renderChantSyllable('eh', 'i', CHANT_BASE_HZ * 1.5, 0.3, 26, 1616)
      t.chant.ole = renderChantSyllable('o', 'e', CHANT_BASE_HZ, 0.7, 26, 1717)
    },
    () => (t.shouts = [renderShout(1818), renderShout(1919), renderShout(2020), renderShout(2121)]),
  ]
}

/** Synchronous build (worker side). */
export function buildCrowdTexturesSync(): CrowdTextures {
  const t: Partialish = { chant: {} }
  for (const job of textureJobs(t)) job()
  return t as unknown as CrowdTextures
}

/** Every Float32Array inside (for transfer lists). */
export function textureBuffers(t: CrowdTextures): ArrayBuffer[] {
  const out: ArrayBuffer[] = []
  const add = (a: Float32Array) => out.push(a.buffer as ArrayBuffer)
  t.babble.forEach(add)
  t.cheer.forEach(add)
  ;[t.roar, t.goalYell, t.ooh, t.groan, t.boo, t.whistles, t.applause, t.clapHit].forEach(add)
  Object.values(t.chant).forEach(add)
  t.shouts.forEach(add)
  return out
}

const yieldNow = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

async function buildOnMainThread(): Promise<CrowdTextures> {
  const t: Partialish = { chant: {} }
  for (const job of textureJobs(t)) {
    job()
    await yieldNow()
  }
  return t as unknown as CrowdTextures
}

function buildInWorker(): Promise<CrowdTextures> | null {
  if (typeof Worker === 'undefined' || typeof window === 'undefined') return null
  let w: Worker
  try {
    w = new Worker(new URL('./textureWorker.ts', import.meta.url), { type: 'module' })
  } catch {
    return null
  }
  return new Promise<CrowdTextures>((resolve, reject) => {
    const timer = setTimeout(() => {
      w.terminate()
      reject(new Error('texture worker timeout'))
    }, 20000)
    w.onmessage = (e: MessageEvent<CrowdTextures>) => {
      clearTimeout(timer)
      w.terminate()
      resolve(e.data)
    }
    w.onerror = (e) => {
      clearTimeout(timer)
      w.terminate()
      e.preventDefault()
      reject(new Error('texture worker failed'))
    }
  })
}

let texturesPromise: Promise<CrowdTextures> | null = null

/** Renders (once, cached) every crowd texture. */
export function loadCrowdTextures(): Promise<CrowdTextures> {
  if (!texturesPromise) {
    const viaWorker = buildInWorker()
    texturesPromise = viaWorker ? viaWorker.catch(() => buildOnMainThread()) : buildOnMainThread()
  }
  return texturesPromise
}
