/**
 * Weekly history ring buffer kept in `life.flags['g:hist']` (JSON) for the
 * charts the sim does not track itself: OVR, followers, net worth and each
 * investment's value. Also remembers the season-start numbers used by the
 * season review.
 */
import type { GameState } from '../../core/types'
import { absWeek } from '../../sim/career/common'
import { heroOvr } from '../../sim/career/progression'
import { netWorth } from '../../sim/life/economy'
import { readJson, writeJson } from '../../sim/game/internal'

export const HIST_FLAG = 'g:hist'
const MAX = 52

export interface SeasonStart {
  season: number
  ovr: number
  netWorth: number
  followers: number
  money: number
}

export interface History {
  w: number[]
  ovr: number[]
  fol: number[]
  nw: number[]
  inv: Record<string, number[]>
  start: SeasonStart | null
}

const empty = (): History => ({ w: [], ovr: [], fol: [], nw: [], inv: {}, start: null })

export function readHistory(s: GameState): History {
  const h = readJson<History>(s.life, HIST_FLAG, empty())
  return { ...empty(), ...h }
}

const push = (arr: number[], v: number): number[] => [...arr, Math.round(v)].slice(-MAX)

/** Record this week's numbers once (idempotent within a week). Returns true when written. */
export function recordWeek(s: GameState): boolean {
  const h = readHistory(s)
  const wk = absWeek(s.calendar)
  if (!h.start || h.start.season !== s.calendar.season) {
    h.start = { season: s.calendar.season, ovr: heroOvr(s.hero), netWorth: Math.round(netWorth(s.life, s.calendar)), followers: s.life.followers, money: Math.round(s.life.money) }
  }
  if (h.w[h.w.length - 1] === wk) {
    writeJson(s.life, HIST_FLAG, h)
    return false
  }
  h.w = push(h.w, wk)
  h.ovr = push(h.ovr, heroOvr(s.hero))
  h.fol = push(h.fol, s.life.followers)
  h.nw = push(h.nw, netWorth(s.life, s.calendar))
  const inv: History['inv'] = {}
  for (const i of s.life.bank.investments) inv[i.id] = push(h.inv[i.id] ?? [], i.value)
  h.inv = inv
  writeJson(s.life, HIST_FLAG, h)
  return true
}
