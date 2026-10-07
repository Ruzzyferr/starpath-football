/**
 * Fake but plausible Highlights for every HighlightKind. Used by the dev demo
 * page (match-demo.html) and by the headless smoke tests.
 */
import { Rng } from '../core/rng'
import { ATTRIBUTE_KEYS, type Attributes, type Formation, type Lang, type Position } from '../core/types'
import { assignSlots, buildScenario, type SlotPlayer } from '../sim/match/highlightGen'
import { makeTeam } from '../sim/match/testFixtures'
import type { Highlight, HighlightKind, ScenarioPlayer, Vec2 } from '../sim/match/types'
import { PITCH_LENGTH } from '../sim/match/types'

export const ALL_KINDS: readonly HighlightKind[] = [
  'build_up', 'counter', 'one_on_one', 'cross', 'edge_of_box', 'freekick', 'penalty', 'corner', 'defend', 'gk_save', 'gk_penalty',
  'counter_2v1', 'long_ball_control', 'rebound', 'interception', 'hold_up', 'defend_1v1', 'block', 'corner_kick', 'fk_wall',
]

/** Typical hero position for a kind (generated scenarios). */
export const KIND_HERO_POS: Record<HighlightKind, Position> = {
  build_up: 'CM', counter: 'AM', one_on_one: 'ST', cross: 'LW', edge_of_box: 'AM', freekick: 'AM', penalty: 'ST', corner: 'CB',
  defend: 'CB', gk_save: 'GK', gk_penalty: 'GK', counter_2v1: 'ST', long_ball_control: 'ST', rebound: 'ST', interception: 'CB',
  hold_up: 'ST', defend_1v1: 'RB', block: 'CB', corner_kick: 'LW', fk_wall: 'GK',
}

/**
 * A realistic Highlight from the real scenario generator (sim/match/highlightGen)
 * with synthetic teams (hero and both sides at `ovr`). Used by the feel
 * harness and the demo page for kinds without a hand-made layout.
 */
export function generatedHighlight(kind: HighlightKind, seed: number, opts: { ovr?: number; heroOvr?: number; lang?: Lang; heroPos?: Position } = {}): Highlight {
  const ovr = opts.ovr ?? 65
  const rng = new Rng(`feel:${kind}:${seed}`)
  const mf: Formation = '4-2-3-1'
  const of: Formation = '4-4-2'
  const home = makeTeam(rng, 'h', { heroPosition: opts.heroPos ?? KIND_HERO_POS[kind], formation: mf, ovr, heroOvr: opts.heroOvr ?? ovr })
  const away = makeTeam(rng, 'a', { formation: of, ovr })
  const toSlots = (players: typeof home.lineup, f: Formation): SlotPlayer[] => {
    const sl = assignSlots(players, f)
    return players.map((player, i) => ({ player, slot: sl[i] }))
  }
  const g = buildScenario({
    kind, heroSide: 'home', heroId: 'hero', mates: toSlots(home.lineup, mf), opps: toSlots(away.lineup, of), mateFormation: mf, oppFormation: of, lang: opts.lang ?? 'en', rng,
  })
  return { id: `feel_${kind}_${seed}`, minute: 30, side: 'home', kind, score: [0, 0], scenario: g.scenario }
}

type Slot = { role: Position; pos: Vec2 }

/** 4-4-2 shape attacking +x (ball near the halfway line). */
const ATTACK_SHAPE: Slot[] = [
  { role: 'GK', pos: { x: 10, y: 34 } },
  { role: 'LB', pos: { x: 45, y: 8 } },
  { role: 'CB', pos: { x: 38, y: 26 } },
  { role: 'CB', pos: { x: 38, y: 42 } },
  { role: 'RB', pos: { x: 45, y: 60 } },
  { role: 'LW', pos: { x: 66, y: 10 } },
  { role: 'CM', pos: { x: 56, y: 28 } },
  { role: 'CM', pos: { x: 58, y: 42 } },
  { role: 'RW', pos: { x: 66, y: 58 } },
  { role: 'ST', pos: { x: 76, y: 30 } },
  { role: 'ST', pos: { x: 74, y: 40 } },
]

/** 4-4-2 shape defending the +x goal. */
const DEFEND_SHAPE: Slot[] = [
  { role: 'GK', pos: { x: 103.5, y: 34 } },
  { role: 'RB', pos: { x: 86, y: 12 } },
  { role: 'CB', pos: { x: 85, y: 28 } },
  { role: 'CB', pos: { x: 85, y: 40 } },
  { role: 'LB', pos: { x: 86, y: 56 } },
  { role: 'RW', pos: { x: 74, y: 14 } },
  { role: 'CM', pos: { x: 72, y: 29 } },
  { role: 'CM', pos: { x: 72, y: 40 } },
  { role: 'LW', pos: { x: 74, y: 54 } },
  { role: 'ST', pos: { x: 62, y: 30 } },
  { role: 'ST', pos: { x: 62, y: 40 } },
]

const mirror = (p: Vec2): Vec2 => ({ x: PITCH_LENGTH - p.x, y: p.y })

function attrsFor(rng: Rng, ovr: number, role: Position): Attributes {
  const a = {} as Attributes
  for (const k of ATTRIBUTE_KEYS) a[k] = Math.round(Math.max(20, Math.min(97, rng.normal(ovr, 7))))
  if (role === 'GK') {
    a.reflexes = Math.round(Math.min(95, ovr + 8))
    a.handling = Math.round(Math.min(95, ovr + 5))
    a.positioning = Math.round(Math.min(95, ovr + 3))
  } else {
    a.reflexes = 25
    a.handling = 25
  }
  return a
}

interface KindLayout {
  /** Hero team uses the attacking shape (else mirrored defending shape). */
  heroAttacks: boolean
  heroRole: Position
  heroPos: Vec2
  ball: Vec2
  /** 'hero' | 'opp:<role>' | 'hero:<role>' | null */
  owner: string | null
  shift: number
  timeLimit: number
  prompt: Record<Lang, string>
}

const LAYOUTS: Partial<Record<HighlightKind, KindLayout>> = {
  build_up: { heroAttacks: true, heroRole: 'CM', heroPos: { x: 56, y: 34 }, ball: { x: 56.5, y: 34 }, owner: 'hero', shift: -2, timeLimit: 14, prompt: { en: 'Build the attack — find a pass or drive forward', tr: 'Atağı kur — pas bul ya da topu sür' } },
  counter: { heroAttacks: true, heroRole: 'AM', heroPos: { x: 58, y: 30 }, ball: { x: 58.5, y: 30 }, owner: 'hero', shift: 4, timeLimit: 12, prompt: { en: 'Counter-attack! Exploit the space', tr: 'Kontra atak! Boşluğu değerlendir' } },
  one_on_one: { heroAttacks: true, heroRole: 'ST', heroPos: { x: 80, y: 32 }, ball: { x: 80.5, y: 32 }, owner: 'hero', shift: 0, timeLimit: 8, prompt: { en: 'Through on goal — beat the keeper', tr: 'Kaleciyle karşı karşıya — bitir!' } },
  cross: { heroAttacks: true, heroRole: 'RW', heroPos: { x: 88, y: 60 }, ball: { x: 88.5, y: 60 }, owner: 'hero', shift: 8, timeLimit: 10, prompt: { en: 'Wide open — whip in a cross or cut inside', tr: 'Kanatta boştasın — orta aç ya da içeri kat et' } },
  edge_of_box: { heroAttacks: true, heroRole: 'AM', heroPos: { x: 82, y: 36 }, ball: { x: 82.5, y: 36 }, owner: 'hero', shift: 6, timeLimit: 9, prompt: { en: 'Space at the edge of the box — shoot!', tr: 'Ceza sahası önünde boşluk — vur!' } },
  freekick: { heroAttacks: true, heroRole: 'AM', heroPos: { x: 80, y: 40 }, ball: { x: 81, y: 40 }, owner: null, shift: 8, timeLimit: 15, prompt: { en: 'Free kick — bend it over the wall', tr: 'Serbest vuruş — barajın üstünden falso ver' } },
  penalty: { heroAttacks: true, heroRole: 'ST', heroPos: { x: 92, y: 34 }, ball: { x: 94, y: 34 }, owner: null, shift: 8, timeLimit: 12, prompt: { en: 'Penalty — pick your spot', tr: 'Penaltı — köşeni seç' } },
  corner: { heroAttacks: true, heroRole: 'ST', heroPos: { x: 94, y: 36 }, ball: { x: 104.5, y: 1 }, owner: null, shift: 10, timeLimit: 9, prompt: { en: 'Corner — time your header (tap when the ball arrives)', tr: 'Korner — kafa vuruşunu zamanla (top gelince dokun)' } },
  defend: { heroAttacks: false, heroRole: 'CB', heroPos: { x: 30, y: 36 }, ball: { x: 48.5, y: 30 }, owner: 'opp:ST', shift: 0, timeLimit: 10, prompt: { en: 'Stop the attacker — time your tackle', tr: 'Forveti durdur — müdahaleni zamanla' } },
  gk_save: { heroAttacks: false, heroRole: 'GK', heroPos: { x: 1.5, y: 34 }, ball: { x: 18, y: 26 }, owner: 'opp:ST', shift: -7, timeLimit: 8, prompt: { en: 'Shot incoming — drag to dive', tr: 'Şut geliyor — uzanmak için sürükle' } },
  gk_penalty: { heroAttacks: false, heroRole: 'GK', heroPos: { x: 0.3, y: 34 }, ball: { x: 11, y: 34 }, owner: 'opp:ST', shift: 0, timeLimit: 10, prompt: { en: 'Penalty against — read the taker and dive', tr: 'Aleyhte penaltı — atıcıyı oku ve uzan' } },
}

/**
 * Builds a demo Highlight for `kind`.
 * @param seed RNG seed (attributes vary)
 * @param lang prompt language
 * @param heroOvr hero rating
 * @param heroPos hero position override (generated scenario), e.g. a captain CB for fk_wall
 */
export function makeDemoHighlight(kind: HighlightKind, seed = 1, lang: Lang = 'en', heroOvr = 72, heroPos?: Position): Highlight {
  const L = LAYOUTS[kind]
  if (!L || heroPos) return { ...generatedHighlight(kind, seed, { heroOvr, lang, ...(heroPos ? { heroPos } : {}) }), id: `demo_${kind}_${seed}` }
  const rng = new Rng(`${kind}:${seed}`)
  const players: ScenarioPlayer[] = []
  const heroShape = L.heroAttacks ? ATTACK_SHAPE : DEFEND_SHAPE.map((s) => ({ role: s.role, pos: mirror(s.pos) }))
  const oppShape = L.heroAttacks ? DEFEND_SHAPE : ATTACK_SHAPE.map((s) => ({ role: s.role, pos: mirror(s.pos) }))
  const shiftX = (p: Vec2, s: number): Vec2 => ({ x: Math.max(1, Math.min(PITCH_LENGTH - 1, p.x + s)), y: p.y })

  // Hero team: replace the slot that matches the hero role (or the closest one).
  let heroSlot = heroShape.findIndex((s) => s.role === L.heroRole)
  if (heroSlot < 0) {
    let bd = Infinity
    heroShape.forEach((s, i) => {
      const d = Math.hypot(s.pos.x - L.heroPos.x, s.pos.y - L.heroPos.y)
      if (s.role !== 'GK' && d < bd) {
        bd = d
        heroSlot = i
      }
    })
  }
  heroShape.forEach((s, i) => {
    const isHero = i === heroSlot
    const pos = isHero ? L.heroPos : shiftX(s.pos, L.heroAttacks ? L.shift : -L.shift)
    players.push({
      id: isHero ? 'hero' : `h${i}`,
      side: 'home',
      pos,
      role: isHero ? L.heroRole : s.role,
      number: isHero ? 10 : i + 1 === 10 ? 11 : i + 1,
      isHero,
      attrs: attrsFor(rng, isHero ? heroOvr : 66, isHero ? L.heroRole : s.role),
      relationToHero: isHero ? 0 : Math.round(rng.range(-40, 80)),
    })
  })
  oppShape.forEach((s, i) => {
    let pos = shiftX(s.pos, L.heroAttacks ? L.shift : -L.shift)
    if (kind === 'counter' && s.role !== 'GK' && i >= 5) pos = { x: Math.max(20, pos.x - 22), y: pos.y } // caught upfield
    if (kind === 'one_on_one' && s.role !== 'GK') pos = { x: Math.min(pos.x, 76 - (i % 3)), y: pos.y }
    players.push({
      id: `o${i}`,
      side: 'away',
      pos,
      role: s.role,
      number: i + 1,
      isHero: false,
      attrs: attrsFor(rng, 66, s.role),
      relationToHero: 0,
    })
  })

  // Resolve owner.
  let ownerId: string | null = null
  if (L.owner === 'hero') ownerId = 'hero'
  else if (L.owner?.startsWith('opp:')) {
    const role = L.owner.slice(4)
    const p = players.filter((q) => q.side === 'away' && q.role === role).sort((a, b) => dist(a.pos, L.ball) - dist(b.pos, L.ball))[0]
    if (p) {
      p.pos = { x: L.ball.x + (L.heroAttacks ? -0.5 : 0.5), y: L.ball.y }
      ownerId = p.id
    }
  }
  return {
    id: `demo_${kind}_${seed}`,
    minute: 10 + Math.floor(rng.range(0, 80)),
    side: 'home',
    kind,
    score: [Math.floor(rng.range(0, 3)), Math.floor(rng.range(0, 3))],
    scenario: {
      kind,
      players,
      ball: { pos: { ...L.ball }, z: 0, ownerId },
      timeLimit: L.timeLimit,
      prompt: L.prompt[lang],
    },
  }
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y)
