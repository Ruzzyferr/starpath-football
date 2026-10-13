/**
 * Exit / Quit buttons over a Phaser canvas must work on the first touch even when the page is
 * struggling (old Android WebViews, a stalled GPU): they fire on touchstart / pen-or-touch
 * pointerdown as well as click, once per tap. touchstart's preventDefault stops the synthetic
 * click so the tap cannot fall through onto whatever is under the closing overlay.
 */

type Fire = (via: string) => void

/** One tap fires touchstart, pointerdown and (unless prevented) click: only the first counts. */
export const EXIT_TAP_DEDUPE_MS = 700

function once(fn: (via: string) => void, now: () => number = () => Date.now()): Fire {
  let last = -Infinity
  return (via) => {
    const t = now()
    if (t - last < EXIT_TAP_DEDUPE_MS) return
    last = t
    fn(via)
  }
}

/** Plain DOM: wires `el` (a button) to `fn`. Returns a remover. */
export function bindExitTap(el: HTMLElement, fn: (via: string) => void): () => void {
  const fire = once(fn)
  const onTouch = (e: Event) => {
    if (e.cancelable) e.preventDefault()
    fire('touchstart')
  }
  const onPointer = (e: Event) => {
    const pt = (e as PointerEvent).pointerType
    if (pt === 'touch' || pt === 'pen') fire('pointerdown')
  }
  const onClick = () => fire('click')
  el.addEventListener('touchstart', onTouch, { passive: false })
  el.addEventListener('pointerdown', onPointer)
  el.addEventListener('click', onClick)
  return () => {
    el.removeEventListener('touchstart', onTouch)
    el.removeEventListener('pointerdown', onPointer)
    el.removeEventListener('click', onClick)
  }
}

/** Preact props for the same behaviour (spread onto a <button>; keep one object per mount). */
export function exitTapProps(fn: (via: string) => void): {
  onClick: () => void
  onTouchStart: (e: TouchEvent) => void
  onPointerDown: (e: PointerEvent) => void
} {
  const fire = once(fn)
  return {
    onClick: () => fire('click'),
    onTouchStart: (e) => {
      if (e.cancelable) e.preventDefault()
      fire('touchstart')
    },
    onPointerDown: (e) => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') fire('pointerdown')
    },
  }
}
