/**
 * Viewport chrome that every screen adapts to automatically:
 *  - safe-area insets (status bar / notch / Dynamic Island, home indicator /
 *    gesture or nav bar, landscape cutouts) come from CSS (`--safe-*` tokens:
 *    env() plus Capacitor SystemBars' injected --safe-area-inset-* on Android);
 *    `readSafeInsets()` resolves them to px for JS-positioned overlays;
 *  - the on-screen keyboard: `html.kb-open` while it is up (hides the tab bar)
 *    and `--kb-h` = how much of the layout it still covers (0 when the native
 *    shell resizes the WebView). Native shells report through `setKeyboard`
 *    (Capacitor Keyboard plugin); browsers fall back to `visualViewport`;
 *  - focused fields are scrolled into view above the keyboard;
 *  - native shells: no pinch-zoom (viewport meta + WebKit gesture events);
 *    everywhere: no double-tap zoom (`touch-action: manipulation`) and no
 *    input-focus zoom (form fields >= 16px, --fs-input);
 *  - a dev-only safe-area debug overlay (`?safedebug=1`, or Ctrl+Shift+S;
 *    `?safe=top,right,bottom,left` simulates insets in a desktop browser).
 */

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

const KB_MIN = 120 // px of covered viewport before we call it a keyboard (not browser chrome)
let nativeKeyboard = false
let probe: HTMLDivElement | null = null

/** Current safe-area insets in CSS px (resolved from the --safe-* tokens). */
export function readSafeInsets(): Insets {
  if (typeof document === 'undefined' || !document.body) return { top: 0, right: 0, bottom: 0, left: 0 }
  if (!probe || !probe.isConnected) {
    probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left)'
    document.body.appendChild(probe)
  }
  const cs = getComputedStyle(probe)
  const px = (v: string) => Math.max(0, parseFloat(v) || 0)
  return { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) }
}

/**
 * Safe-area insets overlapping a canvas, in game pixels (CSS px x `scale()`),
 * cached for 500 ms: touch controls read it every frame.
 */
export function canvasSafeInsets(canvas: HTMLCanvasElement, scale: () => number): () => Insets {
  let at = -Infinity
  let cur: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
  return () => {
    const now = performance.now()
    if (now - at < 500) return cur
    at = now
    const i = readSafeInsets()
    const r = canvas.getBoundingClientRect()
    const k = scale()
    cur = {
      top: Math.max(0, i.top - Math.max(0, r.top)) * k,
      right: Math.max(0, i.right - Math.max(0, window.innerWidth - r.right)) * k,
      bottom: Math.max(0, i.bottom - Math.max(0, window.innerHeight - r.bottom)) * k,
      left: Math.max(0, i.left - Math.max(0, r.left)) * k,
    }
    return cur
  }
}

function isField(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true
  if (el instanceof HTMLInputElement) return !/^(checkbox|radio|range|button|submit|reset|file|color|image|hidden)$/.test(el.type)
  return false
}

function revealFocused(): void {
  const el = document.activeElement
  if (!isField(el)) return
  const vv = window.visualViewport
  const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight
  const r = el.getBoundingClientRect()
  const top = readSafeInsets().top
  if (r.top < top + 8 || r.bottom > bottom - 8) el.scrollIntoView({ block: 'center', inline: 'nearest' })
}

/**
 * Keyboard state. `overlap` is the part of the layout viewport the keyboard
 * still covers (0 when the WebView itself was resized natively).
 */
export function setKeyboard(open: boolean, overlap = 0): void {
  const root = document.documentElement
  root.classList.toggle('kb-open', open)
  root.style.setProperty('--kb-h', `${open ? Math.max(0, Math.round(overlap)) : 0}px`)
  if (open) {
    // After the resize/animation settles, keep the focused field visible.
    setTimeout(revealFocused, 60)
    setTimeout(revealFocused, 320)
  }
}

/** Native shells call this once their Keyboard plugin is listening. */
export function markNativeKeyboard(): void {
  nativeKeyboard = true
}

function watchVisualViewport(): void {
  const vv = window.visualViewport
  if (!vv) return
  let last = -1
  const update = () => {
    if (nativeKeyboard) return
    const covered = window.innerHeight - vv.height - vv.offsetTop
    const open = covered > KB_MIN && isField(document.activeElement)
    const h = open ? covered : 0
    if (h === last) return
    last = h
    setKeyboard(open, h)
  }
  vv.addEventListener('resize', update)
  vv.addEventListener('scroll', update)
  document.addEventListener('focusout', () => setTimeout(update, 50))
}

function blockPinchZoom(): void {
  // WebKit gesture events (iOS Safari / WKWebView pinch). Android honours the
  // viewport meta (user-scalable=no). Canvases handle their own pointers
  // (touch-action: none) and never use pinch.
  const stop = (e: Event) => e.preventDefault()
  document.addEventListener('gesturestart', stop, { passive: false })
  document.addEventListener('gesturechange', stop, { passive: false })
}

// ───────────── dev: safe-area debug overlay ─────────────

let overlay: HTMLDivElement | null = null

function renderOverlay(): void {
  if (!overlay) return
  const i = readSafeInsets()
  const kb = getComputedStyle(document.documentElement).getPropertyValue('--kb-h').trim() || '0px'
  const vv = window.visualViewport
  const label = overlay.querySelector('[data-sa-label]') as HTMLElement
  label.textContent =
    `safe T${i.top} R${i.right} B${i.bottom} L${i.left} · kb ${kb} · ` +
    `${window.innerWidth}×${window.innerHeight}` + (vv ? ` · vv ${Math.round(vv.width)}×${Math.round(vv.height)} @${vv.scale.toFixed(2)}` : '')
}

export function setSafeAreaDebug(on: boolean): void {
  if (!on) {
    overlay?.remove()
    overlay = null
    return
  }
  if (overlay) return renderOverlay()
  overlay = document.createElement('div')
  overlay.className = 'sa-debug'
  overlay.setAttribute('aria-hidden', 'true')
  overlay.setAttribute('data-testid', 'safe-area-debug')
  overlay.innerHTML =
    '<i class="sa-debug-t"></i><i class="sa-debug-r"></i><i class="sa-debug-b"></i><i class="sa-debug-l"></i>' +
    '<i class="sa-debug-kb"></i><span data-sa-label></span>'
  document.body.appendChild(overlay)
  renderOverlay()
}

function installDebug(): void {
  const q = new URLSearchParams(location.search)
  const sim = q.get('safe')
  if (sim) {
    const [t = 0, r = 0, b = 0, l = 0] = sim.split(',').map((n) => Math.max(0, Number(n) || 0))
    const s = document.documentElement.style
    s.setProperty('--safe-area-inset-top', `${t}px`)
    s.setProperty('--safe-area-inset-right', `${r}px`)
    s.setProperty('--safe-area-inset-bottom', `${b}px`)
    s.setProperty('--safe-area-inset-left', `${l}px`)
  }
  let on = q.get('safedebug') === '1'
  try {
    on ||= localStorage.getItem('sp.safeDebug') === '1'
  } catch { /* storage blocked */ }
  const toggle = (v: boolean) => {
    on = v
    try {
      localStorage.setItem('sp.safeDebug', v ? '1' : '0')
    } catch { /* storage blocked */ }
    setSafeAreaDebug(v)
  }
  ;(window as unknown as { __safeAreaDebug?: (v?: boolean) => void }).__safeAreaDebug = (v) => toggle(v ?? !on)
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
      e.preventDefault()
      toggle(!on)
    }
  })
  const refresh = () => overlay && renderOverlay()
  window.addEventListener('resize', refresh)
  window.visualViewport?.addEventListener('resize', refresh)
  new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] })
  if (on) setSafeAreaDebug(true)
}

const LOCKED = 'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no'
const ZOOMABLE = 'width=device-width, initial-scale=1, viewport-fit=cover'

/**
 * index.html ships the locked viewport so the native shells never zoom, from the
 * first frame. In a plain browser / PWA we hand pinch-zoom back (WCAG 1.4.4
 * resize text): double-tap zoom stays off via touch-action and fields are 16px+,
 * so the accidental zooms the lock exists for still cannot happen there.
 */
export function applyViewportMeta(lockZoom: boolean): void {
  const meta = document.querySelector('meta[name="viewport"]')
  if (meta) meta.setAttribute('content', lockZoom ? LOCKED : ZOOMABLE)
}

let installed = false
export function installViewport(lockZoom: boolean): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  applyViewportMeta(lockZoom)
  watchVisualViewport()
  if (lockZoom) blockPinchZoom()
  document.addEventListener('focusin', (e) => {
    if (isField(e.target as Element) && document.documentElement.classList.contains('kb-open')) setTimeout(revealFocused, 60)
  })
  if (import.meta.env.DEV) installDebug()
}
