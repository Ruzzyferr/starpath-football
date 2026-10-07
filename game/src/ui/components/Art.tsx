/**
 * DOM wrappers for the procedural SVG generators in ui/art. The SVG string is
 * memoised per props, so lists of 20 crests don't regenerate on re-render.
 */
import { memo } from 'preact/compat'
import { useMemo } from 'preact/hooks'
import type { Appearance, CrestSpec, KitColors } from '../../core/types'
import { avatarSvg, type AvatarOpts } from '../art/avatar'
import { crestSvg } from '../art/crest'
import { flagSvg } from '../art/flag'
import { kitSvg } from '../art/kit'

function SvgBox({ html, size, class: cls, label, ratio = 1 }: { html: string; size: number | string; class: string; label?: string; ratio?: number }) {
  const w = typeof size === 'number' ? `${size}px` : size
  const h = typeof size === 'number' ? `${size * ratio}px` : undefined
  return (
    <span
      class={`art ${cls}`}
      style={{ width: w, height: h }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export interface AvatarProps extends AvatarOpts {
  appearance: Appearance
  size?: number | string
  label?: string
  ring?: string
}
export const Avatar = memo(function Avatar({ appearance, size = 48, label, ring, ...opts }: AvatarProps) {
  const html = useMemo(
    () => avatarSvg(appearance, opts),
    [appearance.skin, appearance.hairStyle, appearance.hairColor, appearance.beard, appearance.eyeColor, appearance.face, appearance.accessory, opts.shirt, opts.shirtTrim, opts.background, opts.mood, opts.age],
  )
  return (
    <span class={`avatar-wrap${ring ? ' has-ring' : ''}`} style={ring ? { ['--ring' as string]: ring } : undefined}>
      <SvgBox html={html} size={size} class="avatar" label={label} />
    </span>
  )
})

export const Crest = memo(function Crest({ crest, size = 40, label, stars, compact }: { crest: CrestSpec; size?: number | string; label?: string; stars?: number; compact?: boolean }) {
  const small = compact ?? (typeof size === 'number' && size < 30)
  const html = useMemo(() => crestSvg(crest, { stars, compact: small }), [crest.shape, crest.symbol, crest.initials, crest.colors.join(), stars, small])
  return <SvgBox html={html} size={size} class="crest" label={label} ratio={1.2} />
})

export const Kit = memo(function Kit({ kit, size = 64, number, name, label }: { kit: KitColors; size?: number | string; number?: number | string; name?: string; label?: string }) {
  const html = useMemo(() => kitSvg(kit, { number, name }), [kit.primary, kit.secondary, kit.pattern, number, name])
  return <SvgBox html={html} size={size} class="kit" label={label} />
})

export const Flag = memo(function Flag({ id, colors, size = 24, label }: { id: string; colors: [string, string, string]; size?: number | string; label?: string }) {
  const html = useMemo(() => flagSvg(id, colors), [id, colors.join()])
  return <SvgBox html={html} size={size} class="flag" label={label} ratio={2 / 3} />
})
