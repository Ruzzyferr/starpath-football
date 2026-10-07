import { currentLang } from '../../i18n'
import { formatCompact, formatMoney, formatNumber } from '../format'
import { useCountUp } from '../hooks/motion'

/** Animated count-up number with a green/red flash on change. */
export function NumberTicker({ value, format, duration = 650, class: cls }: { value: number; format?: (n: number) => string; duration?: number; class?: string }) {
  const [v, dir] = useCountUp(value, duration)
  void currentLang.value // re-render on language change
  const text = format ? format(v) : formatNumber(Math.round(v))
  return (
    <span class={`ticker num ${dir > 0 ? 'flash-pos' : dir < 0 ? 'flash-neg' : ''} ${cls ?? ''}`} key={dir === 0 ? 'n' : `${dir}${Math.round(value)}`}>
      {text}
    </span>
  )
}

export function Money({ value, compact, animate = true, sign, class: cls }: { value: number; compact?: boolean; animate?: boolean; sign?: boolean; class?: string }) {
  const fmt = (n: number) => formatMoney(Math.round(n), { compact, sign })
  if (!animate) return <span class={`money num ${cls ?? ''}`}>{fmt(value)}</span>
  return <NumberTicker value={value} format={fmt} class={`money ${cls ?? ''}`} />
}

export function Compact({ value }: { value: number }) {
  return <span class="num">{formatCompact(value)}</span>
}
