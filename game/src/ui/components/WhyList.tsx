import { useState } from 'preact/hooks'
import { lt, t } from '../../i18n'
import type { Why } from '../../sim/game/whyMore'
import { Button } from './Button'

/** "Why?" toggle + the top three factors with their percentage share (2.7#83). */
export function WhyList({ why, id, testId = 'why-more' }: { why: Why | null; id: string; testId?: string }) {
  const [open, setOpen] = useState(false)
  if (!why || why.rows.length === 0) return null
  return (
    <div class="why-more" data-testid={testId}>
      <Button size="sm" variant="ghost" icon="question" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} data-testid={`${testId}-toggle`}>
        {open ? t('board.why.close') : t('board.why.button')}
      </Button>
      {open && (
        <div id={id}>
          <p class="micro t-mid">{lt(why.title)}</p>
          <ul class="why-more-list">
            {why.rows.map((r) => (
              <li key={r.key} class={`is-${r.tone}`}>
                <span class="why-more-label">{lt(r.label)}<span class="t-xs t-lo"> · {r.actionable ? t('board.why.actionable') : t('board.why.fixed')}</span></span>
                <b class={`num ${r.tone === 'pos' ? 't-pos' : 't-neg'}`}>{r.tone === 'pos' ? '+' : '−'}{r.share}%</b>
                <span class="why-more-bar" aria-hidden="true"><span style={{ width: `${r.share}%` }} /></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
