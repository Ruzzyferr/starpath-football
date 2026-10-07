/** Lightweight DOM confetti burst: ≤ 80 pieces, transform/opacity only. */
import { prefersReducedMotion } from '../../hooks/motion'

const COLORS = ['var(--accent-gold)', 'var(--brand-pitch)', 'var(--accent-blue)', 'var(--accent-violet)', 'var(--text-hi)', 'var(--state-danger)']

export function Confetti({ count = 70, seed = 1 }: { count?: number; seed?: number }) {
  if (prefersReducedMotion()) return null
  const n = Math.min(80, count)
  const pieces = []
  for (let i = 0; i < n; i++) {
    // Cheap deterministic pseudo-random per piece.
    const r = (k: number) => {
      const x = Math.sin((i + 1) * 12.9898 * k + seed * 78.233) * 43758.5453
      return x - Math.floor(x)
    }
    pieces.push(
      <span
        key={i}
        class={`se-confetti-piece${i % 3 === 0 ? ' is-round' : ''}`}
        style={{
          left: `${r(1) * 100}%`,
          background: COLORS[i % COLORS.length],
          animationDelay: `${Math.round(r(2) * 900)}ms`,
          animationDuration: `${2200 + Math.round(r(3) * 1600)}ms`,
          ['--drift' as string]: `${Math.round((r(4) - 0.5) * 160)}px`,
          ['--spin' as string]: `${Math.round(360 + r(5) * 720)}deg`,
          ['--scale' as string]: (0.7 + r(6) * 0.6).toFixed(2),
        }}
      />,
    )
  }
  return <div class="se-confetti" aria-hidden="true">{pieces}</div>
}
