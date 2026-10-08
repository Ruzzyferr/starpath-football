import type { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { t, tx } from '../../../i18n'
import { Icon, type IconName } from '../../icons'
import { gameState, settings } from '../../store'

/** Procedural app-icon tile: a gradient squircle with a glyph on top (no raster assets). */
export function AppTile({ app, icon, size = 56 }: { app: string; icon: IconName; size?: number }) {
  const id = `ph-g-${app}`
  return (
    <span class={`ph-tile ph-hue-${app}`} style={{ width: `${size}px`, height: `${size}px` }} aria-hidden="true">
      <svg viewBox="0 0 56 56" width={size} height={size}>
        <defs>
          <linearGradient id={`${id}-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--h1)' }} />
            <stop offset="1" style={{ stopColor: 'var(--h2)' }} />
          </linearGradient>
          <radialGradient id={`${id}-${size}-s`} cx=".25" cy=".1" r=".9">
            <stop offset="0" stop-color="white" stop-opacity=".38" />
            <stop offset=".55" stop-color="white" stop-opacity="0" />
          </radialGradient>
        </defs>
        <rect width="56" height="56" rx="14" fill={`url(#${id}-${size})`} />
        <rect width="56" height="56" rx="14" fill={`url(#${id}-${size}-s)`} />
        <rect x=".75" y=".75" width="54.5" height="54.5" rx="13.5" fill="none" stroke="white" stroke-opacity=".18" stroke-width="1.5" />
      </svg>
      <span class="ph-glyph"><Icon name={icon} size={Math.round(size * 0.5)} weight={2} /></span>
    </span>
  )
}

const CLOCK = ['09:00', '14:30', '20:45'] as const

/** Status bar: in-game clock + date on the left, energy battery on the right. */
export function StatusBar() {
  const s = gameState.value
  if (!s) return null
  const { calendar: c, life } = s
  const e = Math.max(0, Math.min(100, Math.round(life.energy)))
  const level = e < 25 ? 'low' : e < 55 ? 'mid' : 'high'
  return (
    <div class="ph-status" data-testid="phone-status">
      <span class="ph-clock score-font">{CLOCK[c.slot] ?? CLOCK[0]}</span>
      <span class="ph-date">{t('common.weekShort', { n: c.week + 1 })} · {tx(`data.dayShort.${c.day}`)}</span>
      <span class="ph-grow" />
      <span class="ph-batt" data-level={level} role="img" aria-label={`${t('ui.topbar.energy')} ${e}%`}>
        <span class="ph-batt-body"><span class="ph-batt-fill" style={{ width: `${e}%` }} /></span>
        <span class="ph-batt-cap" />
        <span class="ph-batt-num">{e}</span>
      </span>
    </div>
  )
}

/**
 * The device. On desktop it is drawn as a framed handset; on mobile the same markup
 * becomes a plain full-width surface (CSS only, no fake bezel).
 */
export function PhoneShell({ children, onHome, open, leaving }: { children: ComponentChildren; onHome: () => void; open: boolean; leaving: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const edge = useRef<{ x: number; y: number } | null>(null)
  // Back gesture: Esc / gamepad B (dispatched as Escape) return to the phone home before the global handler leaves the screen.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('.modal-root')) return
      const a = document.activeElement as HTMLElement | null
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) return
      e.preventDefault()
      onHome()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onHome])
  return (
    <div class="ph-device" ref={ref} data-open={open ? 'true' : 'false'} data-motion={settings.value.reducedMotion ? 'reduced' : 'full'}>
      <div class="ph-notch" aria-hidden="true" />
      <div
        class="ph-screen"
        onPointerDown={(e) => {
          const r = ref.current?.getBoundingClientRect()
          edge.current = e.pointerType === 'touch' && r && e.clientX - r.left < 28 ? { x: e.clientX, y: e.clientY } : null
        }}
        onPointerUp={(e) => {
          const g = edge.current
          edge.current = null
          if (open && g && e.clientX - g.x > 70 && Math.abs(e.clientY - g.y) < 60) onHome()
        }}
      >
        <StatusBar />
        <div class={`ph-view ${leaving ? 'is-leaving' : ''}`}>{children}</div>
        {open && (
          <button type="button" class="ph-homebar" onClick={onHome} aria-label={t('life.phone.home')}>
            <span aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
