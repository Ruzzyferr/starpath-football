/**
 * Set-piece picker (corner delivery / free-kick wall) shown over the match
 * canvas while the runtime waits for the hero's choice.
 *
 * Two layers:
 * - {@link PickerState}: pure state + input mapping (keys, pad, buttons) →
 *   the committing {@link HeroAction}. Unit-tested.
 * - {@link PickerDom}: a small DOM overlay (real buttons: touch, mouse and
 *   focusable for accessibility). The Phaser canvas has its own input stack,
 *   so DOM buttons never leak taps into the moment.
 *
 * The committed action goes through the normal input path (applyInput), so
 * input recordings replay the choice exactly.
 */
import type { Lang } from '../core/types'
import { CORNER_ZONES, DEFAULT_CORNER, DEFAULT_WALL_CHOICE, WALL_NUDGE_STEP, sanitizeWall, type CornerChoice, type CornerZone, type WallChoice } from './setPieceChoice'
import { WALL_MAX, WALL_MIN, WALL_NUDGE_MAX } from './setup'
import type { HeroAction } from './runtime'

export type PickerMode = 'corner' | 'wall'

export type PickerInput =
  | { kind: 'up' }
  | { kind: 'down' }
  | { kind: 'left' }
  | { kind: 'right' }
  | { kind: 'confirm' }
  | { kind: 'height' }
  | { kind: 'curl' }
  | { kind: 'zone'; zone: CornerZone }
  | { kind: 'count'; count: number }

/** Keyboard code → picker input (null = not a picker key). */
export function keyToPickerInput(code: string, mode: PickerMode): PickerInput | null {
  switch (code) {
    case 'ArrowUp':
    case 'KeyW':
      return { kind: 'up' }
    case 'ArrowDown':
    case 'KeyS':
      return { kind: 'down' }
    case 'ArrowLeft':
    case 'KeyA':
      return { kind: 'left' }
    case 'ArrowRight':
    case 'KeyD':
      return { kind: 'right' }
    case 'Space':
    case 'Enter':
    case 'NumpadEnter':
    case 'KeyF':
      return { kind: 'confirm' }
  }
  if (mode === 'corner') {
    if (code === 'KeyZ' || code === 'KeyH') return { kind: 'height' }
    if (code === 'KeyX') return { kind: 'curl' }
    const d = /^(?:Digit|Numpad)([1-4])$/.exec(code)
    if (d) return { kind: 'zone', zone: CORNER_ZONES[Number(d[1]) - 1]! }
  } else {
    const d = /^(?:Digit|Numpad)([2-5])$/.exec(code)
    if (d) return { kind: 'count', count: Number(d[1]) }
  }
  return null
}

/** Standard-mapping gamepad buttons used by the picker. */
export const PAD = { a: 0, x: 2, y: 3, up: 12, down: 13, left: 14, right: 15 } as const

/** Newly pressed pad buttons → picker inputs. */
export function padToPickerInputs(prev: readonly boolean[], now: readonly boolean[], mode: PickerMode): PickerInput[] {
  const out: PickerInput[] = []
  const hit = (i: number) => !!now[i] && !prev[i]
  if (hit(PAD.up)) out.push({ kind: 'up' })
  if (hit(PAD.down)) out.push({ kind: 'down' })
  if (hit(PAD.left)) out.push({ kind: 'left' })
  if (hit(PAD.right)) out.push({ kind: 'right' })
  if (mode === 'corner' && hit(PAD.x)) out.push({ kind: 'height' })
  if (mode === 'corner' && hit(PAD.y)) out.push({ kind: 'curl' })
  if (hit(PAD.a)) out.push({ kind: 'confirm' })
  return out
}

/** Picker state machine. `apply` returns the committing action once confirmed. */
export class PickerState {
  readonly mode: PickerMode
  corner: CornerChoice = { ...DEFAULT_CORNER }
  wall: WallChoice = { ...DEFAULT_WALL_CHOICE }
  done = false
  /** Screen direction of "+ nudge" (→ moves the wall toward the middle of the goal when true). */
  rightIsPlus: boolean

  constructor(mode: PickerMode, rightIsPlus = true) {
    this.mode = mode
    this.rightIsPlus = rightIsPlus
  }

  apply(input: PickerInput): HeroAction | null {
    if (this.done) return null
    if (this.mode === 'corner') {
      const i = CORNER_ZONES.indexOf(this.corner.zone)
      switch (input.kind) {
        case 'up':
          this.corner.zone = CORNER_ZONES[(i + CORNER_ZONES.length - 1) % CORNER_ZONES.length]!
          return null
        case 'down':
          this.corner.zone = CORNER_ZONES[(i + 1) % CORNER_ZONES.length]!
          return null
        case 'left':
        case 'right':
        case 'curl':
          this.corner.curl = this.corner.curl === 'in' ? 'out' : 'in'
          return null
        case 'height':
          this.corner.height = this.corner.height === 'driven' ? 'floated' : 'driven'
          return null
        case 'zone':
          this.corner.zone = input.zone
          return this.commit()
        case 'confirm':
          return this.commit()
        default:
          return null
      }
    }
    switch (input.kind) {
      case 'up':
        this.wall = sanitizeWall({ ...this.wall, count: Math.min(WALL_MAX, this.wall.count + 1) })
        return null
      case 'down':
        this.wall = sanitizeWall({ ...this.wall, count: Math.max(WALL_MIN, this.wall.count - 1) })
        return null
      case 'left':
      case 'right': {
        const sign = (input.kind === 'right') === this.rightIsPlus ? 1 : -1
        this.wall = sanitizeWall({ ...this.wall, nudge: Math.max(-WALL_NUDGE_MAX, Math.min(WALL_NUDGE_MAX, this.wall.nudge + sign * WALL_NUDGE_STEP)) })
        return null
      }
      case 'count':
        this.wall = sanitizeWall({ ...this.wall, count: input.count })
        return null
      case 'confirm':
        return this.commit()
      default:
        return null
    }
  }

  private commit(): HeroAction {
    this.done = true
    return this.mode === 'corner' ? { kind: 'corner', ...this.corner } : { kind: 'wall', ...this.wall }
  }
}

// ───────────────────────── DOM overlay ─────────────────────────

const STR = {
  en: {
    cornerTitle: 'YOUR CORNER', wallTitle: 'SET THE WALL',
    near: 'Near post', far: 'Far post', spot: 'Penalty spot', short: 'Short',
    driven: 'Driven', floated: 'Floated', in: 'Inswinger', out: 'Outswinger',
    players: 'players', shiftL: 'Shift wall', shiftR: 'Shift wall', more: 'One more', fewer: 'One fewer', ok: 'Set wall',
    keysCorner: '1–4 zone · Z height · X curl · Space take', keysWall: '↑↓ players · ←→ shift · Space set',
    padCorner: 'D-pad zone · X height · Y curl · A take', padWall: 'D-pad ↑↓ players · ←→ shift · A set',
    take: 'Take',
  },
  tr: {
    cornerTitle: 'KORNER SENDE', wallTitle: 'BARAJI KUR',
    near: 'Yakın direk', far: 'Arka direk', spot: 'Penaltı noktası', short: 'Kısa',
    driven: 'Sert', floated: 'Havalı', in: 'İçe kavis', out: 'Dışa kavis',
    players: 'oyuncu', shiftL: 'Barajı kaydır', shiftR: 'Barajı kaydır', more: 'Bir kişi ekle', fewer: 'Bir kişi çıkar', ok: 'Barajı onayla',
    keysCorner: '1–4 bölge · Z yükseklik · X kavis · Boşluk kullan', keysWall: '↑↓ oyuncu · ←→ kaydır · Boşluk onayla',
    padCorner: 'Yön tuşu bölge · X yükseklik · Y kavis · A kullan', padWall: 'Yön ↑↓ oyuncu · ←→ kaydır · A onayla',
    take: 'Kullan',
  },
} as const

const CSS = `
.sp-pick{position:absolute;left:50%;bottom:max(14px,var(--safe-bottom,env(safe-area-inset-bottom)));transform:translateX(-50%);z-index:5;
  display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 12px;border-radius:14px;
  background:rgba(6,12,20,.78);border:1px solid rgba(255,255,255,.18);color:#fff;
  font:700 13px system-ui,'Segoe UI',Roboto,Arial,sans-serif;max-width:calc(100% - 24px);box-sizing:border-box;touch-action:manipulation;user-select:none}
.sp-pick h3{margin:0;font-size:13px;letter-spacing:.08em;color:#ffd23f}
.sp-radial{display:grid;grid-template-columns:repeat(3,auto);grid-template-rows:repeat(3,auto);gap:6px;align-items:center;justify-items:center}
.sp-pick button{min-width:44px;min-height:44px;padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.25);
  background:rgba(255,255,255,.08);color:#fff;font:inherit;cursor:pointer}
.sp-pick button[aria-pressed=true],.sp-pick button.is-sel{background:#ffd23f;color:#111;border-color:#ffd23f}
.sp-pick button:focus-visible{outline:3px solid #9fe8ff;outline-offset:2px}
.sp-row{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center}
.sp-count{min-width:84px;text-align:center;font-size:15px}
.sp-keys{font-size:11px;font-weight:600;opacity:.75;text-align:center}
`

let cssDone = false
function ensureCss(): void {
  if (cssDone || typeof document === 'undefined') return
  cssDone = true
  const el = document.createElement('style')
  el.textContent = CSS
  document.head.appendChild(el)
}

/** DOM view of a {@link PickerState}; `onAction` receives the committing action. */
export class PickerDom {
  readonly root: HTMLDivElement
  private readonly st: PickerState
  private readonly s: (typeof STR)[Lang]
  private readonly onAction: (a: HeroAction) => void
  private readonly onChange: () => void
  private readonly btns = new Map<string, HTMLButtonElement>()
  private countEl: HTMLSpanElement | null = null

  constructor(host: HTMLElement, st: PickerState, lang: Lang, pad: boolean, onAction: (a: HeroAction) => void, onChange: () => void) {
    ensureCss()
    this.st = st
    this.s = STR[lang] ?? STR.en
    this.onAction = onAction
    this.onChange = onChange
    const root = document.createElement('div')
    root.className = 'sp-pick'
    root.dataset.testid = st.mode === 'corner' ? 'corner-picker' : 'wall-picker'
    root.setAttribute('role', 'dialog')
    root.setAttribute('aria-label', st.mode === 'corner' ? this.s.cornerTitle : this.s.wallTitle)
    const h = document.createElement('h3')
    h.textContent = st.mode === 'corner' ? this.s.cornerTitle : this.s.wallTitle
    root.appendChild(h)
    if (st.mode === 'corner') this.buildCorner(root)
    else this.buildWall(root)
    const keys = document.createElement('div')
    keys.className = 'sp-keys'
    keys.textContent = pad ? (st.mode === 'corner' ? this.s.padCorner : this.s.padWall) : st.mode === 'corner' ? this.s.keysCorner : this.s.keysWall
    // Key legend only where there are keys (a phone shows just the buttons).
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
    if (!coarse || pad) root.appendChild(keys)
    // Keep pointer input on the overlay (never a tap on the pitch).
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'wheel']) root.addEventListener(ev, (e) => e.stopPropagation())
    host.appendChild(root)
    this.root = root
    this.refresh()
  }

  private button(parent: HTMLElement, key: string, label: string, input: PickerInput, aria?: string): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = label
    b.dataset.pick = key
    if (aria) b.setAttribute('aria-label', aria)
    b.addEventListener('click', (e) => {
      e.preventDefault()
      this.feed(input)
    })
    parent.appendChild(b)
    this.btns.set(key, b)
    return b
  }

  private buildCorner(root: HTMLElement): void {
    // Radial: far post on top, near post below, spot left, short right; "take" in the middle.
    const radial = document.createElement('div')
    radial.className = 'sp-radial'
    const cell = (r: number, c: number) => {
      const d = document.createElement('div')
      d.style.gridRow = String(r)
      d.style.gridColumn = String(c)
      radial.appendChild(d)
      return d
    }
    this.button(cell(1, 2), 'zone:far', this.s.far, { kind: 'zone', zone: 'far' })
    this.button(cell(2, 1), 'zone:spot', this.s.spot, { kind: 'zone', zone: 'spot' })
    this.button(cell(2, 2), 'take', this.s.take, { kind: 'confirm' })
    this.button(cell(2, 3), 'zone:short', this.s.short, { kind: 'zone', zone: 'short' })
    this.button(cell(3, 2), 'zone:near', this.s.near, { kind: 'zone', zone: 'near' })
    // Height and curl toggles in the free corners keep the picker compact on phones.
    this.button(cell(1, 1), 'height', '', { kind: 'height' })
    this.button(cell(1, 3), 'curl', '', { kind: 'curl' })
    root.appendChild(radial)
  }

  private buildWall(root: HTMLElement): void {
    const row = document.createElement('div')
    row.className = 'sp-row'
    this.button(row, 'fewer', '−', { kind: 'down' }, this.s.fewer)
    this.countEl = document.createElement('span')
    this.countEl.className = 'sp-count'
    this.countEl.setAttribute('aria-live', 'polite')
    row.appendChild(this.countEl)
    this.button(row, 'more', '+', { kind: 'up' }, this.s.more)
    root.appendChild(row)
    const row2 = document.createElement('div')
    row2.className = 'sp-row'
    this.button(row2, 'left', '◀', { kind: 'left' }, this.s.shiftL)
    this.button(row2, 'ok', this.s.ok, { kind: 'confirm' })
    this.button(row2, 'right', '▶', { kind: 'right' }, this.s.shiftR)
    root.appendChild(row2)
  }

  /** Feeds one input (buttons, keys, pad). */
  feed(input: PickerInput): void {
    const act = this.st.apply(input)
    this.refresh()
    this.onChange()
    if (act) this.onAction(act)
  }

  private refresh(): void {
    const st = this.st
    if (st.mode === 'corner') {
      for (const z of CORNER_ZONES) {
        const b = this.btns.get(`zone:${z}`)
        if (b) b.classList.toggle('is-sel', st.corner.zone === z)
      }
      const hb = this.btns.get('height')
      if (hb) {
        hb.textContent = st.corner.height === 'driven' ? this.s.driven : this.s.floated
        hb.setAttribute('aria-pressed', String(st.corner.height === 'driven'))
      }
      const cb = this.btns.get('curl')
      if (cb) {
        cb.textContent = st.corner.curl === 'in' ? this.s.in : this.s.out
        cb.setAttribute('aria-pressed', String(st.corner.curl === 'in'))
      }
    } else if (this.countEl) {
      const n = st.wall.nudge
      this.countEl.textContent = `${st.wall.count} ${this.s.players}${n ? ` · ${n > 0 ? '+' : ''}${n.toFixed(1)} m` : ''}`
      this.root?.setAttribute('data-count', String(st.wall.count))
    }
  }

  private placedTop: number | null | undefined
  /** Pins the overlay `top` px from the stage top, or to the bottom (null). */
  place(top: number | null): void {
    const t = top === null ? null : Math.round(top)
    if (t === this.placedTop) return
    this.placedTop = t
    this.root.style.top = t === null ? '' : `${t}px`
    this.root.style.bottom = t === null ? '' : 'auto'
  }

  dispose(): void {
    this.root.remove()
  }
}
