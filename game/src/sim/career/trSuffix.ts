/**
 * Turkish case suffixes after template placeholders.
 *
 * Content is written with a suffix that fits the *example* name
 * (`{city}'de`, `{agentName}'ın`), but the real value differs ("İstanbul",
 * "Rui Costa Neto"). {@link replaceWithSuffix} re-inflects the suffix that
 * follows a placeholder with vowel harmony and buffer consonants, so
 * "İstanbul'da", "Neto'nun", "Efe'nin", "Ayşe'ye" come out right.
 */
import { trSuffixOnly, type TrCase } from '../match/turkish'

/** Written suffix → grammatical case (+ trailing text kept as is, e.g. -ki). */
const FORMS: readonly [RegExp, TrCase, string][] = [
  [/^n?[ıiuü]n$/, 'gen', ''],
  [/^[dt][ae]ki$/, 'loc', 'ki'],
  [/^[dt][ae]n$/, 'abl', ''],
  [/^[dt][ae]$/, 'loc', ''],
  [/^y?l[ae]$/, 'ins', ''],
  [/^y?[ae]$/, 'dat', ''],
  [/^y?[ıiuü]$/, 'acc', ''],
]

/** The correct suffix for `value` given the suffix the author wrote, or null if not a simple case suffix. */
export function reinflect(value: string, written: string): string | null {
  if (!/[A-Za-zÀ-ÿĞğİıŞşÇçÖöÜü]/.test(value)) return null
  for (const [re, kind, rest] of FORMS) if (re.test(written)) return trSuffixOnly(value, kind) + rest
  return null
}

const PH_SUFFIX = /\{(\w+)(?::(\w+))?\}(?:'([a-zçğıöşü]+))?/g

/**
 * Replace `{key}` / `{key:spec}` placeholders in a Turkish string; a case
 * suffix right after a string placeholder (`{name}'ın`) is re-inflected for
 * the substituted value. `resolve` returns the replacement or undefined to
 * keep the placeholder.
 */
export function replaceWithSuffix(text: string, resolve: (key: string, spec: string | undefined) => { text: string; isName: boolean } | undefined): string {
  return text.replace(PH_SUFFIX, (whole, key: string, spec: string | undefined, suffix: string | undefined) => {
    const r = resolve(key, spec)
    if (!r) return whole
    if (!suffix) return r.text
    const fixed = r.isName ? reinflect(r.text, suffix) : null
    return `${r.text}'${fixed ?? suffix}`
  })
}
