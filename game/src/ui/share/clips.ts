import { downloadBlob, type ShareOutcome } from './cards'

/** Share a recorded clip through the OS sheet when it accepts files, else download it. */
export async function shareClip(blob: Blob, filename: string, title: string): Promise<ShareOutcome> {
  if (!blob.size) return 'failed'
  try {
    const file = new File([blob], filename, { type: blob.type || 'video/webm' })
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title })
      return 'shared'
    }
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return 'shared'
  }
  downloadBlob(blob, filename)
  return 'downloaded'
}
