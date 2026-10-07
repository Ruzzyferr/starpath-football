import type { ComponentChildren } from 'preact'
import { t } from '../../i18n'
import { back, canGoBack, type ScreenId } from '../store'
import { IconButton } from './Button'

/**
 * Standard screen scaffold: skewed broadcast-style header with optional back
 * button + subtitle + trailing actions, then the scrollable body.
 */
export function Page({
  title, sub, actions, backTo, showBack, children, class: cls, wide, footer,
}: {
  title: ComponentChildren
  sub?: ComponentChildren
  actions?: ComponentChildren
  backTo?: ScreenId
  showBack?: boolean
  children: ComponentChildren
  class?: string
  /** Allow full content width on desktop (tables, grids). */
  wide?: boolean
  /** Sticky bottom bar (primary CTA in the thumb zone). */
  footer?: ComponentChildren
}) {
  const hasBack = showBack ?? (canGoBack() || !!backTo)
  return (
    <section class={`page ${wide ? 'page-wide' : ''} ${cls ?? ''}`}>
      <header class="page-head">
        {hasBack && <IconButton icon="arrow-left" label={t('common.back')} onClick={() => back(backTo)} class="page-back" />}
        <div class="page-titles grow">
          <h1 class="page-title">{title}</h1>
          {sub && <div class="page-sub">{sub}</div>}
        </div>
        {actions && <div class="page-actions">{actions}</div>}
      </header>
      <div class="page-body">{children}</div>
      {footer && <div class="page-footer">{footer}</div>}
    </section>
  )
}
