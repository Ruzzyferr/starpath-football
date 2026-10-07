/** WCAG 2.x relative luminance / contrast helpers + design-token parser (used by tests). */
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** Parse `--name: value;` declarations out of every block whose selector matches `selector`. */
export function parseTokens(css: string, selector: RegExp): Record<string, string> {
  const out: Record<string, string> = {}
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const block of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selector.test(block[1]!.trim())) continue
    for (const d of block[2]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]!] = d[2]!.trim()
  }
  return out
}

/** Resolve `var(--x)` chains and return a #hex or undefined (gradients etc.). */
export function resolveColor(tokens: Record<string, string>, name: string, depth = 0): string | undefined {
  const v = tokens[name]
  if (!v || depth > 5) return undefined
  const ref = /^var\((--[\w-]+)\)$/.exec(v)
  if (ref) return resolveColor(tokens, ref[1]!, depth + 1)
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v) ? v : undefined
}
