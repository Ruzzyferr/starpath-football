/** Local attribute helpers for career screens (grouping, key stats, radar axes). */
import { ATTRIBUTE_KEYS, type Appearance, type AttributeGroup, type AttributeKey, type Attributes, type Position } from '../../../core/types'
import { hashString } from '../../../core/rng'

export const ATTR_GROUP: Record<AttributeKey, AttributeGroup> = {
  pace: 'physical', stamina: 'physical', strength: 'physical', agility: 'physical', jumping: 'physical',
  passing: 'technical', shooting: 'technical', finishing: 'technical', dribbling: 'technical', firstTouch: 'technical',
  crossing: 'technical', heading: 'technical', tackling: 'technical', setPieces: 'technical',
  vision: 'mental', composure: 'mental', positioning: 'mental', leadership: 'mental', workRate: 'mental',
  reflexes: 'goalkeeping', handling: 'goalkeeping',
}

export const GROUPS: AttributeGroup[] = ['physical', 'technical', 'mental', 'goalkeeping']

export function keysOf(group: AttributeGroup): AttributeKey[] {
  return ATTRIBUTE_KEYS.filter((k) => ATTR_GROUP[k] === group)
}

export function groupAvg(attrs: Attributes, group: AttributeGroup): number {
  const ks = keysOf(group)
  return Math.round(ks.reduce((s, k) => s + attrs[k], 0) / ks.length)
}

/** Goalkeeper specialism groups (GDD 2.1): the profile shows these instead of the 2-attribute goalkeeping block. */
export type GkGroup = 'shotStopping' | 'commandArea' | 'distribution'
export const GK_GROUPS: Record<GkGroup, AttributeKey[]> = {
  shotStopping: ['reflexes', 'handling', 'agility'],
  commandArea: ['positioning', 'jumping', 'leadership'],
  distribution: ['passing', 'firstTouch', 'vision'],
}
export const GK_GROUP_IDS = Object.keys(GK_GROUPS) as GkGroup[]

/** Profile attribute cards for a position: plain groups for outfielders, specialisms + physical/mental for keepers. */
export function attrCardsFor(pos: Position): { id: GkGroup | AttributeGroup; gk: boolean; keys: AttributeKey[] }[] {
  if (pos !== 'GK') return groupsFor(pos).map((g) => ({ id: g, gk: false, keys: keysOf(g) }))
  return [
    ...GK_GROUP_IDS.map((g) => ({ id: g, gk: true, keys: GK_GROUPS[g] })),
    { id: 'physical', gk: false, keys: keysOf('physical') },
    { id: 'mental', gk: false, keys: keysOf('mental') },
  ]
}
export const keysAvg = (attrs: Attributes, ks: AttributeKey[]): number => Math.round(ks.reduce((s, k) => s + attrs[k], 0) / ks.length)

/** Groups worth showing for a position (outfielders hide goalkeeping). */
export function groupsFor(pos: Position): AttributeGroup[] {
  return pos === 'GK' ? ['goalkeeping', 'physical', 'mental', 'technical'] : ['physical', 'technical', 'mental']
}

const KEY_STATS: Record<Position, AttributeKey[]> = {
  GK: ['reflexes', 'handling', 'positioning', 'jumping', 'passing', 'composure'],
  CB: ['pace', 'tackling', 'strength', 'heading', 'positioning', 'passing'],
  LB: ['pace', 'tackling', 'crossing', 'stamina', 'positioning', 'passing'],
  RB: ['pace', 'tackling', 'crossing', 'stamina', 'positioning', 'passing'],
  DM: ['tackling', 'passing', 'positioning', 'stamina', 'strength', 'vision'],
  CM: ['passing', 'vision', 'stamina', 'tackling', 'dribbling', 'shooting'],
  AM: ['vision', 'passing', 'dribbling', 'shooting', 'firstTouch', 'agility'],
  LW: ['pace', 'dribbling', 'crossing', 'shooting', 'agility', 'passing'],
  RW: ['pace', 'dribbling', 'crossing', 'shooting', 'agility', 'passing'],
  ST: ['pace', 'finishing', 'shooting', 'heading', 'dribbling', 'composure'],
}
export const keyStatsFor = (pos: Position) => KEY_STATS[pos]

export type RadarAxis = 'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'physical'
export const RADAR_AXES: RadarAxis[] = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical']
const avg = (a: Attributes, ks: AttributeKey[]) => ks.reduce((s, k) => s + a[k], 0) / ks.length
export function radarValues(a: Attributes): Record<RadarAxis, number> {
  return {
    pace: avg(a, ['pace', 'agility']),
    shooting: avg(a, ['shooting', 'finishing', 'composure']),
    passing: avg(a, ['passing', 'vision', 'crossing']),
    dribbling: avg(a, ['dribbling', 'firstTouch', 'agility']),
    defending: avg(a, ['tackling', 'positioning', 'heading']),
    physical: avg(a, ['strength', 'stamina', 'jumping']),
  }
}

export type Line = 'GK' | 'DEF' | 'MID' | 'FWD'
export const LINES: Line[] = ['GK', 'DEF', 'MID', 'FWD']
export function lineOf(p: Position): Line {
  if (p === 'GK') return 'GK'
  if (p === 'CB' || p === 'LB' || p === 'RB') return 'DEF'
  if (p === 'DM' || p === 'CM' || p === 'AM') return 'MID'
  return 'FWD'
}

/** Deterministic face for people without an Appearance (agents, managers). */
export function faceFor(name: string): Appearance {
  const h = hashString(name)
  return {
    skin: h % 10,
    hairStyle: (h >>> 4) % 15,
    hairColor: (h >>> 8) % 10,
    beard: (h >>> 12) % 8,
    eyeColor: (h >>> 16) % 6,
    face: (h >>> 20) % 6,
    accessory: (h >>> 24) % 4 === 0 ? 5 : 0,
  }
}
