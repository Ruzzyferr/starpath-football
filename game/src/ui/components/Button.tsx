import type { ComponentChildren, JSX } from 'preact'
import { Icon, type IconName } from '../icons'
import { haptic, type HapticKind } from '../haptics'
import { sfx, type UiSound } from '../../audio'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'size' | 'icon'> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  iconRight?: IconName
  block?: boolean
  loading?: boolean
  haptic?: HapticKind | false
  /** UI sound on press (default: confirm for primary/gold, tap otherwise). */
  sound?: UiSound | false
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  children?: ComponentChildren
}

/**
 * Chunky bevelled CTA (Golf Clash style). One primary per screen.
 * Presses translate 3px down and the bevel shrinks (transform only).
 */
export function Button({
  variant = 'secondary', size = 'md', icon, iconRight, block, loading, haptic: hk = 'tap', sound,
  class: cls, children, onClick, type = 'button', disabled, ...rest
}: ButtonProps) {
  const classes = ['btn', `btn-${variant}`, `btn-${size}`, block ? 'btn-block' : '', loading ? 'is-loading' : '', cls ?? '']
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type={type}
      class={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (hk) haptic(hk)
        const snd = sound ?? (variant === 'primary' || variant === 'gold' ? 'confirm' : 'tap')
        if (snd) sfx(snd)
        onClick?.(e)
      }}
      {...rest}
    >
      {loading ? <span class="btn-spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={size === 'sm' ? 16 : 20} /> : null}
      {children != null && <span class="btn-label">{children}</span>}
      {iconRight && !loading && <Icon name={iconRight} size={size === 'sm' ? 16 : 20} />}
    </button>
  )
}

export interface IconButtonProps extends Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'icon' | 'size'> {
  icon: IconName
  label: string
  variant?: 'ghost' | 'solid'
  badge?: number
  size?: number
  disabled?: boolean
}

export function IconButton({ icon, label, variant = 'ghost', badge, size = 22, class: cls, onClick, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      class={`icon-btn icon-btn-${variant} ${cls ?? ''}`}
      aria-label={label}
      title={label}
      onClick={(e) => {
        haptic('tap')
        sfx(icon === 'arrow-left' || icon === 'close' ? 'back' : 'tap')
        onClick?.(e)
      }}
      {...rest}
    >
      <Icon name={icon} size={size} />
      {badge ? <span class="badge-dot" aria-hidden="true">{badge > 9 ? '9+' : badge}</span> : null}
    </button>
  )
}
