/**
 * "ⓘ" info tooltip for a glossary term.
 *  - Desktop: hover or keyboard focus shows the definition (role=tooltip).
 *  - Touch: long-press (or tap) pins it open with an "Open in glossary" link.
 *  - Esc / outside tap closes. Rendered in a portal so cards never clip it.
 */
import '../../styles/screens/help.css'
import { createPortal } from 'preact/compat'
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { t } from '../../i18n'
import { navigate } from '../store'
import type { GlossaryTerm } from './glossary'

let uid = 0
const LONG_PRESS_MS = 420

export function InfoTip({ term, class: cls }: { term: GlossaryTerm; class?: string }) {
  const [open, setOpen] = useState<'hover' | 'pinned' | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const id = useRef(`infotip-${++uid}`)
  const press = useRef<{ timer: ReturnType<typeof setTimeout> | null; long: boolean }>({ timer: null, long: false })
  const hoverOff = useRef<ReturnType<typeof setTimeout> | null>(null)
  const name = t(`help.glossary.terms.${term}.name`)
  const def = t(`help.glossary.terms.${term}.def`)

  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const place = () => {
      const r = btn.current!.getBoundingClientRect()
      const vw = window.innerWidth
      const w = Math.min(280, vw - 24)
      const left = Math.max(12, Math.min(vw - w - 12, r.left + r.width / 2 - w / 2))
      const below = r.top < 170
      setPos({ left, top: below ? r.bottom + 8 : r.top - 8, below })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(null)
        btn.current?.focus()
      }
    }
    const onDown = (e: PointerEvent) => {
      const n = e.target as Node
      if (btn.current?.contains(n) || pop.current?.contains(n)) return
      setOpen(null)
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [open])

  const cancelHoverOff = () => {
    if (hoverOff.current) clearTimeout(hoverOff.current)
    hoverOff.current = null
  }
  const scheduleHoverOff = () => {
    cancelHoverOff()
    hoverOff.current = setTimeout(() => setOpen((o) => (o === 'hover' ? null : o)), 160)
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        class={`infotip-btn ${cls ?? ''}`}
        aria-label={t('help.glossary.info', { term: name })}
        aria-describedby={open ? id.current : undefined}
        aria-expanded={open === 'pinned'}
        data-term={term}
        onPointerEnter={(e) => {
          if (e.pointerType !== 'mouse') return
          cancelHoverOff()
          setOpen((o) => o ?? 'hover')
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') scheduleHoverOff()
        }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') return
          press.current.long = false
          press.current.timer = setTimeout(() => {
            press.current.long = true
            setOpen('pinned')
          }, LONG_PRESS_MS)
        }}
        onPointerUp={() => {
          if (press.current.timer) clearTimeout(press.current.timer)
          press.current.timer = null
        }}
        onPointerCancel={() => {
          if (press.current.timer) clearTimeout(press.current.timer)
          press.current.timer = null
        }}
        onContextMenu={(e) => e.preventDefault()}
        onFocus={() => setOpen((o) => o ?? 'hover')}
        onBlur={(e) => {
          const to = e.relatedTarget as Node | null
          if (to && pop.current?.contains(to)) return
          setOpen((o) => (o === 'hover' ? null : o))
        }}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          if (press.current.long) {
            press.current.long = false
            return
          }
          setOpen((o) => (o === 'pinned' ? null : 'pinned'))
        }}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.6" />
          <path d="M8 7v4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <circle cx="8" cy="4.6" r="1.05" fill="currentColor" />
        </svg>
      </button>
      {open && pos &&
        createPortal(
          <div
            ref={pop}
            id={id.current}
            role={open === 'pinned' ? 'dialog' : 'tooltip'}
            aria-label={open === 'pinned' ? name : undefined}
            class={`infotip-pop${pos.below ? ' is-below' : ''}${open === 'pinned' ? ' is-pinned' : ''}`}
            style={{ left: `${pos.left}px`, top: `${pos.top}px` }}
            onPointerEnter={cancelHoverOff}
            onPointerLeave={(e) => {
              if (e.pointerType === 'mouse') scheduleHoverOff()
            }}
          >
            <strong class="infotip-name">{name}</strong>
            <span class="infotip-def">{def}</span>
            {open === 'pinned' && (
              <button
                type="button"
                class="infotip-link"
                onClick={() => {
                  setOpen(null)
                  navigate('glossary', { term })
                }}
              >
                {t('help.glossary.open')} →
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
