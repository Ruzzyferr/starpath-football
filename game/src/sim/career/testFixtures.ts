/**
 * Test-only fixtures (not imported by game code): build heroes, lives and a
 * minimal GameState without the world generator.
 */
import type { Appearance, Background, GameState, Hero, Life, Position, Role } from '../../core/types'
import { Rng } from '../../core/rng'
import { START_YEAR } from '../../core/config'
import { createHero, createLife } from './createHero'

export const TEST_APPEARANCE: Appearance = { skin: 0, hairStyle: 0, hairColor: 0, beard: 0, eyeColor: 0, face: 0, accessory: 0 }

export interface FixtureOpts {
  seed?: number
  position?: Position
  role?: Role
  background?: Background
  age?: number
  season?: number
}

/** Hero + life for tests (default: 17-year-old academy poacher, season 2026). */
export function makeHeroLife(o: FixtureOpts = {}): { rng: Rng; hero: Hero; life: Life } {
  const rng = new Rng(o.seed ?? 1)
  const season = o.season ?? START_YEAR
  const background = o.background ?? 'academy'
  const hero = createHero(rng, {
    firstName: 'Deniz', lastName: 'Kaya', nickname: '', nationality: 'TR',
    position: o.position ?? 'ST', foot: 'R', appearance: TEST_APPEARANCE,
    role: o.role ?? 'runner', background, birthYear: season - (o.age ?? 17),
  })
  const life = createLife(rng, hero, background)
  return { rng, hero, life }
}

/** Minimal GameState around a hero (empty world). */
export function makeState(o: FixtureOpts = {}): GameState {
  const { rng, hero, life } = makeHeroLife(o)
  return {
    version: 1,
    meta: { id: 'test', slot: 0, createdAt: 0, updatedAt: 0, playTimeSec: 0, seed: o.seed ?? 1, difficulty: 'normal' },
    rng: rng.state,
    calendar: { season: o.season ?? START_YEAR, week: 5, day: 5, slot: 2 },
    world: { countries: {}, leagues: {}, clubs: {}, players: {}, competitions: {}, honours: [] },
    hero,
    life,
    pendingEvents: [],
    activeMatchId: null,
  }
}

/** Recursively assert no NaN/Infinity in a plain object (returns offending paths). */
export function findNonFinite(obj: unknown, path = '$', out: string[] = []): string[] {
  if (typeof obj === 'number') {
    if (!Number.isFinite(obj)) out.push(path)
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => findNonFinite(v, `${path}[${i}]`, out))
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) findNonFinite(v, `${path}.${k}`, out)
  }
  return out
}
