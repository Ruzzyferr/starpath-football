import { useMemo, useRef } from 'preact/hooks'
import { Icon } from '../../icons'
import { exitTapProps } from '../../../platform/exitTap'
import { crumb } from '../../../telemetry/breadcrumbs'

/**
 * The DOM Quit button over a Phaser canvas (drill, trial, scouting). Render it as the overlay's
 * LAST child: with its high z-index nothing painted later can sit above it. It fires on the
 * first touch (touchstart / pointerdown) as well as click, and leaves a breadcrumb, so a remote
 * report can tell "the tap arrived" from "the page was hung".
 */
export function DrillQuit({ onQuit, label, title, testId = 'drill-quit' }: { onQuit: () => void; label: string; title?: string; testId?: string }) {
  const latest = useRef(onQuit)
  latest.current = onQuit
  const tap = useMemo(() => exitTapProps((via) => {
    crumb('quit-tap', via)
    latest.current()
  }), [])
  return (
    <button type="button" class="trn-drill-quit" {...tap} aria-label={label} title={title} data-back-exit data-testid={testId}>
      <Icon name="close" size={20} />
      <span>{label}</span>
    </button>
  )
}
