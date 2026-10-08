/** Glossary term catalogue (texts live in i18n `help.glossary.terms.*`). */
import type { Dict } from '../../i18n'

export type GlossaryTerm = keyof Dict['help']['glossary']['terms']
export type GlossaryCat = 'player' | 'condition' | 'match' | 'career' | 'life'

export const GLOSSARY: { id: GlossaryTerm; cat: GlossaryCat }[] = [
  { id: 'ovr', cat: 'player' },
  { id: 'potential', cat: 'player' },
  { id: 'attributes', cat: 'player' },
  { id: 'xp', cat: 'player' },
  { id: 'perkPoints', cat: 'player' },
  { id: 'form', cat: 'condition' },
  { id: 'sharpness', cat: 'condition' },
  { id: 'fatigue', cat: 'condition' },
  { id: 'morale', cat: 'condition' },
  { id: 'energy', cat: 'condition' },
  { id: 'happiness', cat: 'condition' },
  { id: 'health', cat: 'condition' },
  { id: 'stress', cat: 'condition' },
  { id: 'injury', cat: 'condition' },
  { id: 'rating', cat: 'match' },
  { id: 'chanceQuality', cat: 'match' },
  { id: 'moment', cat: 'match' },
  { id: 'aimAssist', cat: 'match' },
  { id: 'bulletTime', cat: 'match' },
  { id: 'curl', cat: 'match' },
  { id: 'chip', cat: 'match' },
  { id: 'suspension', cat: 'match' },
  { id: 'managerTrust', cat: 'career' },
  { id: 'discipline', cat: 'career' },
  { id: 'reputation', cat: 'career' },
  { id: 'squadRole', cat: 'career' },
  { id: 'wage', cat: 'career' },
  { id: 'releaseClause', cat: 'career' },
  { id: 'signingBonus', cat: 'career' },
  { id: 'goalBonus', cat: 'career' },
  { id: 'agent', cat: 'career' },
  { id: 'slot', cat: 'career' },
  { id: 'followers', cat: 'life' },
  { id: 'relation', cat: 'life' },
  { id: 'netWorth', cat: 'life' },
  { id: 'sponsor', cat: 'life' },
  { id: 'investment', cat: 'life' },
  { id: 'addiction', cat: 'life' },
  { id: 'seasonForm', cat: 'career' },
]

export const GLOSSARY_CATS: GlossaryCat[] = ['player', 'condition', 'match', 'career', 'life']

/** Case- and diacritic-insensitive match on name + definition. */
export function matchesQuery(q: string, name: string, def: string, lang: 'tr' | 'en'): boolean {
  const norm = (s: string) =>
    s
      .toLocaleLowerCase(lang === 'tr' ? 'tr-TR' : 'en-GB')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ı/g, 'i')
  const needle = norm(q.trim())
  if (!needle) return true
  return norm(name).includes(needle) || norm(def).includes(needle)
}
