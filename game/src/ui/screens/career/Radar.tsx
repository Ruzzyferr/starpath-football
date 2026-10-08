/** 6-axis radar chart (SVG). Values 0..100. */
export function Radar({ axes, size = 220, color = 'var(--brand-pitch)', compare, compareLabel }: { axes: { label: string; value: number }[]; size?: number; color?: string; /** Earlier values (same axis order), drawn as a dashed outline. */ compare?: number[]; compareLabel?: string }) {
  const n = axes.length
  const c = size / 2
  const r = size / 2 - 34
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [c + Math.cos(a) * r * (v / 100), c + Math.sin(a) * r * (v / 100)] as const
  }
  const ring = (v: number) => axes.map((_, i) => pt(i, v).map((x) => x.toFixed(1)).join(',')).join(' ')
  const shape = axes.map((ax, i) => pt(i, Math.max(4, ax.value)).map((x) => x.toFixed(1)).join(',')).join(' ')
  const past = compare && compare.length === n ? compare.map((v, i) => pt(i, Math.max(4, v)).map((x) => x.toFixed(1)).join(',')).join(' ') : null
  const aria = axes.map((a, i) => `${a.label} ${Math.round(a.value)}${past && compare ? ` (${compareLabel ?? ''} ${Math.round(compare[i]!)})` : ''}`).join(', ')
  return (
    <svg class="prof-radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={aria}>
      {[25, 50, 75, 100].map((v) => (
        <polygon key={v} points={ring(v)} fill={v === 100 ? 'var(--surface-2)' : 'none'} stroke="var(--border)" stroke-width="1" />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, 100)
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--border)" stroke-width="1" />
      })}
      {past && <polygon class="prof-radar-past" points={past} fill="none" stroke="var(--text-mid)" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round" />}
      <polygon class="prof-radar-shape" points={shape} fill={color} fill-opacity=".28" stroke={color} stroke-width="2" stroke-linejoin="round" />
      {axes.map((ax, i) => {
        const [x, y] = pt(i, 122)
        return (
          <g key={ax.label}>
            <text x={x} y={y - 4} text-anchor="middle" class="prof-radar-label">{ax.label}</text>
            <text x={x} y={y + 11} text-anchor="middle" class="prof-radar-value">{Math.round(ax.value)}</text>
          </g>
        )
      })}
    </svg>
  )
}
