import type { ComponentChildren, JSX } from 'preact'
import { Icon, type IconName } from '../icons'

export interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'raised' | 'inset' | 'glass' | 'accent' | 'gold'
  pad?: 'none' | 'sm' | 'md' | 'lg'
  interactive?: boolean
  children?: ComponentChildren
}

export function Card({ variant = 'default', pad = 'md', interactive, class: cls, children, ...rest }: CardProps) {
  return (
    <div class={`card card-${variant} pad-${pad}${interactive ? ' card-interactive' : ''} ${cls ?? ''}`} {...rest}>
      {children}
    </div>
  )
}

/** Card header row: icon + title + optional trailing action. */
export function CardHeader({ title, icon, sub, action }: { title: ComponentChildren; icon?: IconName; sub?: ComponentChildren; action?: ComponentChildren }) {
  return (
    <div class="card-header">
      {icon && <span class="card-header-icon"><Icon name={icon} size={18} /></span>}
      <div class="grow">
        <h3 class="h3">{title}</h3>
        {sub && <div class="t-sm t-lo">{sub}</div>}
      </div>
      {action}
    </div>
  )
}

/**
 * TV-broadcast style section strip: skewed slab with a pitch-green edge.
 * The only place skew is used (titles & score bug), per the identity doc.
 */
export function SectionTitle({ children, action, id }: { children: ComponentChildren; action?: ComponentChildren; id?: string }) {
  return (
    <div class="section-title">
      <h2 class="section-title-text" id={id}><span>{children}</span></h2>
      {action}
    </div>
  )
}

/** Clickable whole-card button (keyboard accessible). */
export function CardButton({ class: cls, children, ...rest }: JSX.HTMLAttributes<HTMLButtonElement> & { children?: ComponentChildren; disabled?: boolean }) {
  return (
    <button type="button" class={`card card-default card-interactive pad-md card-button ${cls ?? ''}`} {...rest}>
      {children}
    </button>
  )
}
