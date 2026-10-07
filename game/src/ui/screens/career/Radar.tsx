/** 6-axis radar chart (SVG). Values 0..100. */
export function Radar({ axes, size = 220, color = 'var(--brand-pitch)' }: { axes: { label: string; value: number }[]; size?: number; color?: string }) {
  const n = axes.length
  const c = size / 2
  const r = size / 2 - 34
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [c + Math.cos(a) * r * (v / 100), c + Math.sin(a) * r * (v / 100)] as const
  }
  const ring = (v: number) => axes.map((_, i) => pt(i, v).map((x) => x.toFixed(1)).join(',')).join(' ')
  const shape = axes.map((ax, i) => pt(i, Math.max(4, ax.value)).map((x) => x.toFixed(1)).join(',')).join(' ')
  return (
    <svg class="prof-radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={axes.map((a) => `${a.label} ${Math.round(a.value)}`).join(', ')}>
      {[25, 50, 75, 100].map((v) => (
        <polygon key={v} points={ring(v)} fill={v === 100 ? 'var(--surface-2)' : 'none'} stroke="var(--border)" stroke-width="1" />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, 100)
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--border)" stroke-width="1" />
      })}
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
