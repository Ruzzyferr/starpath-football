/**
 * Pseudo-locale (QA): accents every letter and pads strings ~35% longer so
 * truncation / overflow shows up without waiting for a long translation.
 * Placeholders ({name}) and plural groups ({n|one|many}, ICU blocks) are left
 * intact so interpolation still works.
 */
const MAP: Record<string, string> = {
  a: 'á', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ',
  n: 'ñ', o: 'ö', p: 'þ', q: 'ɋ', r: 'ŕ', s: 'š', t: 'ţ', u: 'ü', v: 'ṽ', w: 'ŵ', x: 'ẍ', y: 'ý', z: 'ž',
  A: 'Á', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Í', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ',
  N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ɋ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Ü', V: 'Ṽ', W: 'Ŵ', X: 'Ẍ', Y: 'Ý', Z: 'Ž',
}
const FILLER = 'ŀöŕéɱ íþšüɱ ðöļöŕ šíţ ámeţ '

/** Depth-aware: text inside any {...} group is kept verbatim. */
export function pseudoize(s: string): string {
  let out = ''
  let depth = 0
  let letters = 0
  for (const ch of s) {
    if (ch === '{') depth++
    if (depth > 0) out += ch
    else {
      const m = MAP[ch]
      if (m) letters++
      out += m ?? ch
    }
    if (ch === '}' && depth > 0) depth--
  }
  const extra = Math.ceil(letters * 0.35)
  if (extra < 2) return out
  // Pad with a space-separated filler so the text can still wrap like a real translation.
  let pad = ''
  while (pad.length < extra) pad += FILLER
  return `${out} ${pad.slice(0, extra).trimEnd()}`
}
