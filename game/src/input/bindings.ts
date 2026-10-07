/**
 * Keyboard bindings for the PC match / training controls (WP-9).
 *
 * Pure module (no DOM besides optional localStorage). One KeyboardEvent.code
 * per action; the arrow keys always mirror the four move actions unless the
 * player has bound that arrow to something else.
 */
import { signal } from '@preact/signals'

export const BIND_ACTIONS = ['up', 'down', 'left', 'right', 'sprint', 'pass', 'through', 'shoot', 'chip', 'skill', 'action', 'call', 'pause'] as const
export type BindAction = (typeof BIND_ACTIONS)[number]
export type Bindings = Record<BindAction, string>

export const DEFAULT_BINDINGS: Readonly<Bindings> = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  sprint: 'ShiftLeft',
  pass: 'KeyQ',
  through: 'KeyR',
  shoot: 'KeyC',
  chip: 'KeyE',
  skill: 'Space',
  action: 'KeyF',
  call: 'KeyG',
  pause: 'KeyP',
}

/** Codes that can never be bound (browser / OS / menu navigation). */
const RESERVED = new Set(['Tab', 'Enter', 'Escape', 'F5', 'F11', 'F12', 'MetaLeft', 'MetaRight', 'ContextMenu'])
const ARROWS: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }

const STORE_KEY = 'starpath.keybinds.v1'

function sanitize(raw: unknown): Bindings {
  const out: Bindings = { ...DEFAULT_BINDINGS }
  if (!raw || typeof raw !== 'object') return out
  const used = new Set<string>()
  for (const a of BIND_ACTIONS) {
    const v = (raw as Record<string, unknown>)[a]
    if (typeof v === 'string' && v && !RESERVED.has(v) && !used.has(v)) {
      out[a] = v
      used.add(v)
    }
  }
  // If a stored code collides with a default we kept for a later action, fall back to defaults for that one.
  const seen = new Set<string>()
  for (const a of BIND_ACTIONS) {
    if (seen.has(out[a])) return { ...DEFAULT_BINDINGS }
    seen.add(out[a])
  }
  return out
}

function load(): Bindings {
  try {
    const raw = globalThis.localStorage?.getItem(STORE_KEY)
    if (raw) return sanitize(JSON.parse(raw))
  } catch {
    /* storage unavailable */
  }
  return { ...DEFAULT_BINDINGS }
}

/** Reactive current bindings (UI subscribes; the input layer reads {@link getBindings}). */
export const bindingsSignal = signal<Bindings>(load())

function commit(b: Bindings): void {
  bindingsSignal.value = b
  try {
    globalThis.localStorage?.setItem(STORE_KEY, JSON.stringify(b))
  } catch {
    /* ignore */
  }
}

/** Accessor for the match / training input layer. */
export function getBindings(): Readonly<Bindings> {
  return bindingsSignal.peek()
}

/** The action bound to `code` (arrow keys resolve to their move action when free), or null. */
export function actionForCode(code: string, b: Readonly<Bindings> = getBindings()): BindAction | null {
  for (const a of BIND_ACTIONS) if (b[a] === code) return a
  const arrow = ARROWS[code]
  return arrow ?? null
}

/** True when `code` is one of the (possibly aliased) keys for `action`. */
export function isBound(code: string, action: BindAction, b: Readonly<Bindings> = getBindings()): boolean {
  return actionForCode(code, b) === action
}

export type BindResult = { ok: true } | { ok: false; reason: 'reserved' } | { ok: false; reason: 'conflict'; with: BindAction }

/** Another action already using `code`, if any. */
export function findConflict(action: BindAction, code: string, b: Readonly<Bindings> = getBindings()): BindAction | null {
  for (const a of BIND_ACTIONS) if (a !== action && b[a] === code) return a
  return null
}

/**
 * Bind `code` to `action`. Refuses reserved keys and conflicts unless `swap`
 * is set (then the two actions trade keys).
 */
export function setBinding(action: BindAction, code: string, swap = false): BindResult {
  if (RESERVED.has(code)) return { ok: false, reason: 'reserved' }
  const b = getBindings()
  const other = findConflict(action, code, b)
  if (other && !swap) return { ok: false, reason: 'conflict', with: other }
  const next: Bindings = { ...b }
  if (other) next[other] = b[action]
  next[action] = code
  commit(next)
  return { ok: true }
}

export function resetBindings(): void {
  commit({ ...DEFAULT_BINDINGS })
}

export function isDefaultBindings(b: Readonly<Bindings> = getBindings()): boolean {
  return BIND_ACTIONS.every((a) => b[a] === DEFAULT_BINDINGS[a])
}

/** Human label for a KeyboardEvent.code. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6)
  const map: Record<string, string> = {
    Space: 'Space',
    ShiftLeft: 'Shift ←',
    ShiftRight: 'Shift →',
    ControlLeft: 'Ctrl ←',
    ControlRight: 'Ctrl →',
    AltLeft: 'Alt ←',
    AltRight: 'Alt →',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    Comma: ',',
    Period: '.',
    Slash: '/',
    Semicolon: ';',
    Quote: "'",
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
  }
  return map[code] ?? code
}
