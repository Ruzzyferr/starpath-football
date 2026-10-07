/**
 * Birth city (wizard) effects: a small local fan base from day one, a big
 * welcome when the hero signs for the hometown club, and the `{hometown}`
 * variable for hometown events.
 */
import type { Calendar, Hero, Life } from '../../core/types'
import { changeRelation } from '../life/relationships'
import { fill, fmtNum, lt, meter, pushLog, type Lines } from './common'

const norm = (s: string): string => s.trim().toLocaleLowerCase('en')

/** Local pride: followers from the neighbourhood (applied once, at creation). */
export const HOMETOWN_BASE_FOLLOWERS = 250
/** Signing for the club of your birth city. */
export const HOMETOWN_CLUB_FOLLOWERS = 1500
export const HOMETOWN_JOINED_FLAG = 'c:hometownJoined'

export const hasBirthCity = (hero: Pick<Hero, 'birthCity'>): boolean => !!hero.birthCity && hero.birthCity.trim().length > 0

export function applyBirthCity(hero: Hero, life: Life): void {
  if (!hasBirthCity(hero)) return
  life.followers += HOMETOWN_BASE_FOLLOWERS
  life.flags.hometown = hero.birthCity as string
}

export const isHometownClub = (hero: Pick<Hero, 'birthCity'>, clubCity: string): boolean =>
  hasBirthCity(hero) && norm(hero.birthCity as string) === norm(clubCity)

/** Call when the hero joins a club (first club and transfers). Pays the welcome once per career. */
export function hometownClubWelcome(hero: Hero, life: Life, clubCity: string, clubName: string, cal: Calendar): Lines {
  if (!isHometownClub(hero, clubCity) || life.flags[HOMETOWN_JOINED_FLAG] === true) return []
  life.flags[HOMETOWN_JOINED_FLAG] = true
  life.followers += HOMETOWN_CLUB_FOLLOWERS
  hero.reputation = meter(hero.reputation + 1)
  changeRelation(life, 'fans', 10, { hero })
  return [pushLog(life, cal, fill(lt('🏠 Memleketin {c} takımına katıldın: tribünler seni evlat gibi karşıladı (+{f} takipçi).', '🏠 You joined your hometown club {c}: the stands welcome one of their own (+{f} followers).'), { c: clubName, f: fmtNum(HOMETOWN_CLUB_FOLLOWERS).en }), 'career', '🏠')]
}

