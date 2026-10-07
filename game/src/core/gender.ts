/**
 * Gender helpers. Older saves have no gender fields; everything treats a
 * missing value as 'male' so those careers continue unchanged.
 */
import type { Appearance, Gender, Hero, World } from './types'

export const GENDERS: readonly Gender[] = ['male', 'female']

export const heroGender = (hero: Pick<Hero, 'gender'> | null | undefined): Gender => (hero?.gender === 'female' ? 'female' : 'male')
export const worldGender = (world: Pick<World, 'gender'> | null | undefined): Gender => (world?.gender === 'female' ? 'female' : 'male')
export const appearanceGender = (a: Pick<Appearance, 'gender'> | null | undefined): Gender => (a?.gender === 'female' ? 'female' : 'male')
/** Pick the male or female variant. */
export const byGender = <T>(g: Gender | undefined, male: T, female: T): T => (g === 'female' ? female : male)
