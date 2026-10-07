/**
 * Turkish grammatical helpers for commentary.
 *
 * Turkish attaches case suffixes to proper nouns with an apostrophe
 * ("Arda'nın", "Kerem'e", "Mauro'yu"). The suffix vowel follows vowel harmony
 * with the LAST vowel of the name, a buffer consonant (n / y) is inserted after
 * a final vowel, and locative/ablative suffixes harden (d → t) after a
 * voiceless consonant ("Mehmet'te", "Fenerbahçe'den").
 */

/** Grammatical case for {@link trSuffix}. */
export type TrCase =
  | 'gen' // possessive / genitive: -(n)ın, -(n)in, -(n)un, -(n)ün
  | 'dat' // dative: -(y)a, -(y)e
  | 'acc' // accusative: -(y)ı, -(y)i, -(y)u, -(y)ü
  | 'loc' // locative: -da, -de, -ta, -te
  | 'abl' // ablative: -dan, -den, -tan, -ten
  | 'ins' // instrumental: -(y)la, -(y)le

const BACK_UNROUNDED = 'aı'
const FRONT_UNROUNDED = 'ei'
const BACK_ROUNDED = 'ou'
const FRONT_ROUNDED = 'öü'
const VOWELS = 'aeıioöuü'
/** Voiceless consonants (fıstıkçı şahap) that harden a following d → t. */
const VOICELESS = 'fstkçşhp'

/** Lower-cases with Turkish rules (I → ı, İ → i) and folds common foreign vowels. */
function normalize(s: string): string {
  return s
    .replace(/I/g, 'ı')
    .replace(/İ/g, 'i')
    .toLowerCase()
    .replace(/[àáâãå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõ]/g, 'o')
    .replace(/[ùúû]/g, 'u')
    // English "-ey"/consonant+"y" endings read as /i/ ("Rooney'nin", "Kelly'nin"),
    // while Turkish "-ay/-oy/-uy" keep y as a consonant ("Koray'ın", "Altay'a").
    .replace(/([^aıoöuüiy])y$/, '$1i')
}

/** How a trailing digit is read aloud (sıfır, bir, iki, üç, dört, beş, altı, yedi, sekiz, dokuz). */
const DIGIT_READING = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz']

/** Last alphabetic word of a (possibly multi-word) name. */
function lastWord(name: string): string {
  const words = name.trim().split(/\s+/)
  return words[words.length - 1] ?? ''
}

interface Harmony {
  /** Last vowel, or 'e' when the word has none (abbreviations: "PSV" → "Pe Se Ve"). */
  vowel: string
  endsInVowel: boolean
  endsVoiceless: boolean
}

function analyze(name: string): Harmony {
  const raw = normalize(lastWord(name))
  const lastDigit = /([0-9])$/.exec(raw)
  const w = lastDigit ? DIGIT_READING[Number(lastDigit[1])] : raw.replace(/[^a-zçğıöşü]/g, '')
  let vowel = ''
  for (let i = w.length - 1; i >= 0; i--) {
    if (VOWELS.includes(w[i])) {
      vowel = w[i]
      break
    }
  }
  const last = w[w.length - 1] ?? ''
  if (!vowel) return { vowel: 'e', endsInVowel: true, endsVoiceless: false }
  return {
    vowel,
    endsInVowel: VOWELS.includes(last),
    endsVoiceless: VOICELESS.includes(last),
  }
}

/** Four-way harmony vowel (ı, i, u, ü). */
function fourWay(v: string): string {
  if (BACK_UNROUNDED.includes(v)) return 'ı'
  if (FRONT_UNROUNDED.includes(v)) return 'i'
  if (BACK_ROUNDED.includes(v)) return 'u'
  if (FRONT_ROUNDED.includes(v)) return 'ü'
  return 'i'
}

/** Two-way harmony vowel (a, e). */
function twoWay(v: string): string {
  return BACK_UNROUNDED.includes(v) || BACK_ROUNDED.includes(v) ? 'a' : 'e'
}

/** Returns only the suffix (without apostrophe) for the given name and case. */
export function trSuffixOnly(name: string, kind: TrCase): string {
  const h = analyze(name)
  const i4 = fourWay(h.vowel)
  const a2 = twoWay(h.vowel)
  const d = h.endsVoiceless ? 't' : 'd'
  switch (kind) {
    case 'gen':
      return (h.endsInVowel ? 'n' : '') + i4 + 'n'
    case 'dat':
      return (h.endsInVowel ? 'y' : '') + a2
    case 'acc':
      return (h.endsInVowel ? 'y' : '') + i4
    case 'loc':
      return d + a2
    case 'abl':
      return d + a2 + 'n'
    case 'ins':
      return (h.endsInVowel ? 'y' : '') + 'l' + a2
  }
}

/**
 * Attaches a Turkish case suffix to a proper noun using vowel harmony.
 *
 * @example trSuffix('Arda', 'gen') // "Arda'nın"
 * @example trSuffix('Mehmet', 'dat') // "Mehmet'e"
 * @example trSuffix('Burak', 'loc') // "Burak'ta"
 */
export function trSuffix(name: string, kind: TrCase): string {
  if (!name) return name
  return `${name}'${trSuffixOnly(name, kind)}`
}
