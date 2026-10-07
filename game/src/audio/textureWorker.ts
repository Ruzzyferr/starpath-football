/// <reference lib="webworker" />
/** Renders the crowd textures off the main thread (see crowdTextures.ts). */
import { buildCrowdTexturesSync, textureBuffers } from './crowdTextures'

const t = buildCrowdTexturesSync()
;(self as unknown as DedicatedWorkerGlobalScope).postMessage(t, textureBuffers(t))
