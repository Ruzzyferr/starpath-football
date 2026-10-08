/**
 * Audio director: binds the UI state (settings, current screen, live match,
 * career state) to the audio engine. This is the only audio module that
 * imports the UI store; install it once from main.tsx.
 *
 *  - settings  → mixer (all six channels, mute, reduced sound)
 *  - screen    → music track (menu / hub / tension / awards), crossfaded
 *  - live match→ crowd (stadium size from the home club's reputation,
 *                importance from the competition, reactions to ticker events,
 *                tension from minute and score, time-wasting whistles)
 *  - career    → UI cues (money in/out, perk points, new event cards)
 */
import { effect } from '@preact/signals'
import { activeEvent, gameState, match, screen, settings, type LiveMatchView, type MatchEventView } from '../ui/store'
import { capacityFromReputation, type Side } from './crowd'
import { engine, sfx } from './index'
import type { TrackId } from './music'
import { mixFromSettings } from './settings'
import { detectPlatform, isMobileNative } from '../platform/detect'

const MENU_SCREENS = new Set(['title', 'newCareer', 'saves', 'credits'])
const AWARD_SCREENS = new Set(['seasonEnd', 'trophies'])

/** Track for a screen; null = no music (the crowd owns the soundscape). */
export function trackForScreen(id: string, hasCareer: boolean): TrackId | null | 'keep' {
  if (MENU_SCREENS.has(id)) return 'menu'
  if (id === 'settings') return hasCareer ? 'keep' : 'menu'
  if (AWARD_SCREENS.has(id)) return 'awards'
  if (id === 'preMatch') return 'tension'
  if (id === 'liveMatch') return null
  return 'hub'
}

const IMPORTANCE: Record<string, number> = { friendly: 0.15, league: 0.45, cup: 0.6, continental: 0.8, international: 0.85 }

/** 0..1 tension from minute and score difference. */
export function matchTension(minute: number, score: readonly [number, number]): number {
  const m = Math.max(0, Math.min(1, minute / 90))
  const diff = Math.abs(score[0] - score[1])
  const close = diff === 0 ? 1 : diff === 1 ? 0.85 : diff === 2 ? 0.4 : 0.15
  return Math.max(0, Math.min(1, 0.12 + 0.75 * Math.pow(m, 2.2) * close))
}

const other = (s: Side): Side => (s === 'home' ? 'away' : 'home')

function react(e: MatchEventView): void {
  const side = e.side
  engine.withCrowd((c) => {
    switch (e.type) {
      case 'kickoff': return c.applaud(0.8)
      case 'goal': return side && c.goal(side)
      case 'shot': return side && c.chance(side, 0.5)
      case 'chance': return side && c.chance(side, 0.8)
      case 'penalty': return side && c.chance(side, 1)
      case 'corner':
      case 'freekick': return side && c.chance(side, 0.3)
      // The sim tags saves/misses with the attacking side.
      case 'save': return side && c.save(other(side))
      case 'miss': return side && c.nearMiss(side)
      case 'woodwork': return side && c.nearMiss(side)
      case 'yellow': return side && c.foul(side, 'yellow')
      case 'red': return side && c.foul(side, 'red')
      case 'offside': return side && c.groan(side)
      case 'halftime': return c.applaud(0.5)
      case 'sub': return c.applaud(0.35)
      case 'fulltime': return c.fullTime(e.score[0], e.score[1])
      default: return undefined
    }
  })
}

interface MatchMemo {
  fixtureId: string
  seen: number
  minute: number
  finished: boolean
  stung: boolean
}

let installed = false

export function installAudioDirector(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  // Phones and "low effects" get shorter reverbs and fewer voices.
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  engine.setQuality(settings.peek().lowFx || coarse || isMobileNative(detectPlatform()) ? 'low' : 'high')
  engine.install()

  // Settings → mixer.
  effect(() => {
    engine.setMix(mixFromSettings(settings.value))
  })

  // Screen → music + crowd hold.
  effect(() => {
    const id = screen.value.id
    const hasCareer = !!gameState.peek()
    const track = trackForScreen(id, hasCareer)
    if (track === 'keep') return
    if (track && !(track === 'tension' && id === 'liveMatch' && settings.peek().matchMusic === false)) engine.playMusic(track, { fade: track === 'tension' ? 1.2 : 2 })
    else engine.stopMusic(2)
    if (id === 'preMatch' || id === 'liveMatch') engine.holdCrowd('match')
    else engine.releaseCrowd('match')
    if (id === 'seasonEnd') engine.sting('fanfare')
  })

  // Live match → crowd.
  let memo: MatchMemo | null = null
  effect(() => {
    const m: LiveMatchView | null = match.value
    if (!m) {
      memo = null
      return
    }
    const f = m.fixture
    if (!memo || memo.fixtureId !== f.fixtureId) {
      // New match (or loaded mid-match): set the stadium, don't replay history.
      memo = { fixtureId: f.fixtureId, seen: m.events.length, minute: m.minute, finished: m.finished, stung: m.finished }
      const cap = capacityFromReputation(f.home.reputation ?? 50)
      const imp = IMPORTANCE[f.compType] ?? 0.45
      engine.setStadium(cap, imp)
      engine.setAllegiance(m.heroSide, f.compType === 'friendly' ? 0.75 : f.compType === 'continental' ? 0.9 : 0.85)
    }
    const fresh = m.events.slice(memo.seen)
    memo.seen = m.events.length
    // A sim-to-end burst: only the last goal and the final whistle matter.
    const burst = fresh.length > 6
    const list = burst ? fresh.filter((e, i) => e.type === 'fulltime' || (e.type === 'goal' && i === fresh.map((x) => x.type).lastIndexOf('goal'))) : fresh
    for (const e of list) react(e)

    engine.withCrowd((c) => c.setMood(m.score[0] - m.score[1]))
    const t = matchTension(m.minute, m.score)
    engine.setTension(m.momentActive ? Math.max(t, 0.6) : t)
    if (m.minute !== memo.minute) {
      memo.minute = m.minute
      // Visitors protecting a late lead: whistles from the home end.
      const awayLeads = m.score[1] > m.score[0]
      if (m.minute >= 78 && awayLeads && !m.finished && Math.random() < 0.12) engine.withCrowd((c) => c.timeWasting())
    }

    // Music in the live match: tension loop while a moment waits, silence while it plays.
    if (screen.peek().id === 'liveMatch') {
      if (m.finished) {
        if (!memo.stung) {
          memo.stung = true
          const hero = m.heroSide === 'home' ? 0 : 1
          const [h, a] = [m.score[hero], m.score[1 - hero]]
          engine.stopMusic(0.5)
          engine.sting(h > a! ? 'victory' : h < a! ? 'defeat' : 'draw')
        }
      } else if (m.pendingMoment && !m.momentActive && settings.peek().matchMusic !== false) {
        engine.setMusicIntensity(t)
        engine.playMusic('tension', { fade: 1, intensity: t })
      } else engine.stopMusic(m.momentActive ? 0.6 : 2.5)
    }
  })

  // Career → UI cues.
  let last: { id: string; money: number; perkPoints: number; perks: number; events: number } | null = null
  effect(() => {
    const s = gameState.value
    if (!s) {
      last = null
      return
    }
    const cur = { id: s.meta.id, money: s.life.money, perkPoints: s.hero.perkPoints, perks: s.hero.perks.length, events: s.pendingEvents.length }
    if (last && last.id === cur.id) {
      if (cur.perks > last.perks) sfx('perk')
      else if (cur.perkPoints > last.perkPoints) sfx('levelUp')
      else if (cur.money - last.money >= 1) sfx('moneyIn')
      else if (last.money - cur.money >= 1) sfx('moneyOut')
      if (cur.events > last.events) sfx('notify')
    }
    last = cur
  })

  effect(() => {
    if (activeEvent.value !== null) sfx('card')
  })
}
