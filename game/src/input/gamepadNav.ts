/**
 * Gamepad navigation for DOM menus (WP-9): D-pad / left stick moves focus
 * spatially, A confirms, B goes back (Escape), LB/RB switch tabs. Inactive
 * while a full-screen game canvas (match / drill) owns the gamepad.
 */

export type Dir = 'up' | 'down' | 'left' | 'right'
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Index of the best neighbour of `boxes[from]` in direction `dir` (spatial navigation), or -1. */
export function pickNeighbour(boxes: readonly Box[], from: number, dir: Dir): number {
  const a = boxes[from]
  if (!a) return -1
  const ax = a.x + a.w / 2
  const ay = a.y + a.h / 2
  let best = -1
  let bestScore = Infinity
  for (let i = 0; i < boxes.length; i++) {
    if (i === from) continue
    const b = boxes[i]
    const dx = b.x + b.w / 2 - ax
    const dy = b.y + b.h / 2 - ay
    const along = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx
    const across = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy)
    if (along <= 1) continue
    // Must lie roughly inside a 90 degree cone.
    if (across > along * 1.6 + Math.max(a.w, a.h) / 2) continue
    const score = along + across * 2
    if (score < bestScore) {
      bestScore = score
      best = i
    }
  }
  return best
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [role=tab], [tabindex]:not([tabindex="-1"])'

function visible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  if (r.width < 2 || r.height < 2) return false
  const st = getComputedStyle(el)
  return st.visibility !== 'hidden' && st.display !== 'none' && el.getAttribute('aria-hidden') !== 'true' && !el.closest('[inert]')
}

function scopeRoot(): ParentNode {
  const modals = document.querySelectorAll<HTMLElement>('.modal-root, [role=dialog][aria-modal=true]')
  return modals.length ? modals[modals.length - 1] : document
}

function focusables(): HTMLElement[] {
  return Array.from(scopeRoot().querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible)
}

/** A big visible canvas means a game scene owns the gamepad. */
function canvasOwnsPad(): boolean {
  for (const c of Array.from(document.querySelectorAll('canvas'))) {
    const r = c.getBoundingClientRect()
    if (r.width * r.height > innerWidth * innerHeight * 0.4) return true
  }
  return false
}

function setMode(mode: 'pad' | 'kb' | 'pointer'): void {
  document.documentElement.dataset.input = mode
}

function move(dir: Dir): void {
  const cur = document.activeElement as HTMLElement | null
  if (cur && cur.tagName === 'INPUT' && (cur as HTMLInputElement).type === 'range' && (dir === 'left' || dir === 'right')) {
    const r = cur as HTMLInputElement
    const step = Number(r.step) || 1
    r.value = String(Number(r.value) + (dir === 'right' ? step : -step))
    r.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }
  const list = focusables()
  if (!list.length) return
  const idx = cur ? list.indexOf(cur) : -1
  let target: HTMLElement | undefined
  if (idx < 0) {
    const main = document.getElementById('main')
    target = list.find((e) => main?.contains(e)) ?? list[0]
  } else {
    const boxes = list.map((e) => {
      const r = e.getBoundingClientRect()
      return { x: r.left, y: r.top, w: r.width, h: r.height }
    })
    const n = pickNeighbour(boxes, idx, dir)
    target = n >= 0 ? list[n] : undefined
  }
  if (target) {
    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
}

function switchTab(delta: 1 | -1): void {
  const lists = Array.from(scopeRoot().querySelectorAll<HTMLElement>('[role=tablist]')).filter(visible)
  const list = lists.find((l) => l.contains(document.activeElement)) ?? lists[0]
  if (!list) return
  const tabs = Array.from(list.querySelectorAll<HTMLElement>('[role=tab]:not([disabled])'))
  if (!tabs.length) return
  let i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true')
  if (i < 0) i = 0
  const next = tabs[(i + delta + tabs.length) % tabs.length]
  next.click()
  next.focus({ preventScroll: true })
}

function back(): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }))
}

function confirm(): void {
  const cur = document.activeElement as HTMLElement | null
  if (!cur || cur === document.body || cur.id === 'main') return
  if (cur.tagName === 'INPUT' && (cur as HTMLInputElement).type === 'range') return
  cur.click()
}

/** Start polling gamepads; returns a stop function. Safe to call in non-browser envs. */
export function startGamepadNav(): () => void {
  if (typeof window === 'undefined' || !navigator.getGamepads) return () => {}
  let raf = 0
  let prev: boolean[] = []
  let dirHeld: Dir | null = null
  let dirNext = 0

  const onPointer = () => setMode('pointer')
  const onKey = () => setMode('kb')
  window.addEventListener('pointerdown', onPointer, true)
  window.addEventListener('keydown', onKey, true)

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick)
    const pad = Array.from(navigator.getGamepads()).find((p) => p && p.connected)
    if (!pad) {
      prev = []
      dirHeld = null
      return
    }
    const btn = pad.buttons.map((b) => b.pressed || b.value > 0.6)
    const owned = canvasOwnsPad()
    const edge = (i: number) => btn[i] && !prev[i]
    if (!owned) {
      const ax = pad.axes[0] ?? 0
      const ay = pad.axes[1] ?? 0
      let dir: Dir | null = btn[12] ? 'up' : btn[13] ? 'down' : btn[14] ? 'left' : btn[15] ? 'right' : null
      if (!dir && Math.hypot(ax, ay) > 0.55) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : ay > 0 ? 'down' : 'up'
      if (dir) {
        if (dir !== dirHeld || now >= dirNext) {
          setMode('pad')
          move(dir)
          dirNext = now + (dir === dirHeld ? 140 : 380)
          dirHeld = dir
        }
      } else dirHeld = null
      if (edge(0)) {
        setMode('pad')
        confirm()
      }
      if (edge(1)) {
        setMode('pad')
        back()
      }
      if (edge(4)) {
        setMode('pad')
        switchTab(-1)
      }
      if (edge(5)) {
        setMode('pad')
        switchTab(1)
      }
    }
    prev = btn
  }
  const start = () => {
    if (!raf) raf = requestAnimationFrame(tick)
  }
  window.addEventListener('gamepadconnected', start)
  if (Array.from(navigator.getGamepads()).some((p) => p?.connected)) start()
  return () => {
    cancelAnimationFrame(raf)
    raf = 0
    window.removeEventListener('gamepadconnected', start)
    window.removeEventListener('pointerdown', onPointer, true)
    window.removeEventListener('keydown', onKey, true)
  }
}
