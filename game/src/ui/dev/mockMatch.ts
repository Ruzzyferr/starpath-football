/** Mock live-match engine: minute ticker, events, hero moments. Replaced by sim/match later. */
import { Rng, clamp, hashString } from '../../core/rng'
import type { Club, Formation, GameState, Lang, LText, Position } from '../../core/types'
import { lt } from '../../i18n'
import { generatedHighlight } from '../../game/demoHighlights'
import type { HighlightKind } from '../../sim/match/types'
import { matchupViewOf } from '../backend/matchupView'
import { match, settings } from '../store'
import type {
  FixtureView, HeroMatchStatsView, InterviewOption, LineupPlayer, LiveMatchView, MatchEventType, MatchEventView,
  PostMatchView, PreMatchView, Weather,
} from '../store'

type Slot = [Position, number, number]
const BACK4: Slot[] = [['LB', 0.2, 0.14], ['CB', 0.17, 0.38], ['CB', 0.17, 0.62], ['RB', 0.2, 0.86]]
const GK: Slot = ['GK', 0.05, 0.5]
export const FORMATION_SLOTS: Record<Formation, Slot[]> = {
  '4-4-2': [GK, ...BACK4, ['LW', 0.32, 0.14], ['CM', 0.3, 0.4], ['CM', 0.3, 0.6], ['RW', 0.32, 0.86], ['ST', 0.43, 0.4], ['ST', 0.43, 0.6]],
  '4-3-3': [GK, ...BACK4, ['DM', 0.26, 0.5], ['CM', 0.32, 0.3], ['CM', 0.32, 0.7], ['LW', 0.42, 0.15], ['ST', 0.45, 0.5], ['RW', 0.42, 0.85]],
  '4-2-3-1': [GK, ...BACK4, ['DM', 0.27, 0.38], ['DM', 0.27, 0.62], ['LW', 0.37, 0.15], ['AM', 0.37, 0.5], ['RW', 0.37, 0.85], ['ST', 0.45, 0.5]],
  '3-5-2': [GK, ['CB', 0.17, 0.25], ['CB', 0.16, 0.5], ['CB', 0.17, 0.75], ['LB', 0.3, 0.1], ['DM', 0.27, 0.5], ['CM', 0.33, 0.32], ['CM', 0.33, 0.68], ['RB', 0.3, 0.9], ['ST', 0.43, 0.38], ['ST', 0.43, 0.62]],
  '5-3-2': [GK, ['LB', 0.22, 0.1], ['CB', 0.17, 0.3], ['CB', 0.16, 0.5], ['CB', 0.17, 0.7], ['RB', 0.22, 0.9], ['CM', 0.3, 0.3], ['DM', 0.28, 0.5], ['CM', 0.3, 0.7], ['ST', 0.42, 0.4], ['ST', 0.42, 0.6]],
  '4-1-4-1': [GK, ...BACK4, ['DM', 0.25, 0.5], ['LW', 0.34, 0.15], ['CM', 0.33, 0.38], ['CM', 0.33, 0.62], ['RW', 0.34, 0.85], ['ST', 0.45, 0.5]],
  '3-4-3': [GK, ['CB', 0.17, 0.25], ['CB', 0.16, 0.5], ['CB', 0.17, 0.75], ['LB', 0.3, 0.12], ['CM', 0.3, 0.4], ['CM', 0.3, 0.6], ['RB', 0.3, 0.88], ['LW', 0.42, 0.18], ['ST', 0.45, 0.5], ['RW', 0.42, 0.82]],
}

const NEAR: Record<Position, Position[]> = {
  GK: ['GK'], CB: ['CB', 'DM', 'LB', 'RB'], LB: ['LB', 'RB', 'CB', 'LW'], RB: ['RB', 'LB', 'CB', 'RW'],
  DM: ['DM', 'CM', 'CB'], CM: ['CM', 'DM', 'AM'], AM: ['AM', 'CM', 'LW', 'RW'], LW: ['LW', 'RW', 'AM', 'ST'],
  RW: ['RW', 'LW', 'AM', 'ST'], ST: ['ST', 'AM', 'LW', 'RW'],
}

export function buildLineup(s: GameState, club: Club, _side: 'home' | 'away', withHero: boolean): LineupPlayer[] {
  const slots = FORMATION_SLOTS[club.formation]
  const used = new Set<string>()
  const squad = club.squad.map((id) => s.world.players[id]).filter((p) => p && p.injuredWeeks === 0)
  let heroSlot = -1
  if (withHero) {
    heroSlot = slots.findIndex((sl) => sl[0] === s.hero.position)
    if (heroSlot < 0) heroSlot = slots.findIndex((sl) => NEAR[s.hero.position].includes(sl[0]))
    if (heroSlot < 0) heroSlot = slots.length - 1
  }
  return slots.map(([pos, x, y], i) => {
    // Team-relative: x 0 = own goal line → 1 = halfway line; y 0 = left → 1 = right (attacking view).
    const fx = Math.min(1, x * 2)
    const fy = y
    if (i === heroSlot) {
      const h = s.hero
      return { id: 'hero', name: h.nickname || h.lastName, number: h.shirtNumber, position: pos, ovr: 0, isHero: true, x: fx, y: fy }
    }
    const cand = squad
      .filter((p) => !used.has(p!.id))
      .sort((a, b) => {
        const ra = NEAR[pos].indexOf(a!.position)
        const rb = NEAR[pos].indexOf(b!.position)
        return (ra < 0 ? 9 : ra) - (rb < 0 ? 9 : rb) || b!.ovr - a!.ovr
      })[0]
    if (cand) used.add(cand.id)
    const num = cand ? (hashString(cand.id) % 30) + 1 : i + 1
    return {
      id: cand?.id ?? `${club.id}-x${i}`,
      name: cand ? cand.lastName : '—',
      number: pos === 'GK' ? 1 : num === 1 ? 2 : num,
      position: pos,
      ovr: cand?.ovr ?? 50,
      isHero: false,
      x: fx,
      y: fy,
    }
  })
}

const TXT: Record<string, LText> = {
  kickoff: { tr: 'Hakem düdüğü çaldı, maç başladı!', en: 'The referee blows, we’re under way!' },
  goal: { tr: 'GOOOL! {name} ağları sarsıyor!', en: 'GOAL! {name} finds the net!' },
  heroGoal: { tr: 'GOOOL! {name} imzasını atıyor!', en: 'GOAL! {name} puts his name on it!' },
  save: { tr: '{name} vuruyor… kaleci uzanıp çeliyor!', en: '{name} strikes… the keeper stretches and saves!' },
  miss: { tr: '{name} şutunu çekiyor, top az farkla dışarıda.', en: '{name} lets fly, just wide.' },
  woodwork: { tr: 'Direkt! {name} şanssız.', en: 'Off the woodwork! Unlucky {name}.' },
  chance: { tr: '{team} tehlikeli geliyor, savunma son anda uzaklaştırıyor.', en: '{team} threaten, cleared at the last moment.' },
  yellow: { tr: '{name} sert girdi, sarı kart.', en: '{name} goes in hard, yellow card.' },
  corner: { tr: '{team} korner kazandı.', en: 'Corner to {team}.' },
  freekick: { tr: '{team} tehlikeli bölgede serbest vuruş kazandı.', en: 'Free kick to {team} in a dangerous area.' },
  offside: { tr: '{name} ofsayta yakalandı.', en: '{name} is caught offside.' },
  halftime: { tr: 'İlk yarı sona erdi.', en: 'Half-time.' },
  fulltime: { tr: 'Son düdük! Maç sona erdi.', en: 'Full time! It’s all over.' },
  commentary: { tr: 'Tribünler tek ses: oyun orta sahada sıkıştı.', en: 'The stands are rocking; the game is stuck in midfield.' },
  heroAssist: { tr: '{hero} harika bir pas bıraktı, {name} affetmiyor!', en: '{hero} with a sublime ball, {name} doesn’t miss!' },
  heroMiss: { tr: '{hero} pozisyonu değerlendiremedi.', en: '{hero} can’t convert the chance.' },
  heroSaved: { tr: '{hero} vurdu, kaleci kurtardı!', en: '{hero} shoots, the keeper saves!' },
  heroPass: { tr: '{hero} oyunu güzel yönlendirdi.', en: '{hero} keeps the move flowing nicely.' },
  heroLost: { tr: '{hero} topu kaptırdı.', en: '{hero} gives the ball away.' },
}
const MOMENT_PROMPTS: Record<string, LText> = {
  one_on_one: { tr: 'Kaleciyle karşı karşıyasın!', en: 'One on one with the keeper!' },
  edge_of_box: { tr: 'Ceza sahası dışında boş alan!', en: 'Space at the edge of the box!' },
  cross: { tr: 'Kanatta topla buluştun, ortala ya da kes!', en: 'Ball out wide: cross or cut inside!' },
  counter: { tr: 'Hızlı hücum! Önün açık.', en: 'Counter-attack! Space ahead.' },
  penalty: { tr: 'Penaltı! Topun başındasın.', en: 'Penalty! You step up.' },
  build_up: { tr: 'Orta sahada topu aldın.', en: 'You receive in midfield.' },
  freekick: { tr: 'Kaleye yakın serbest vuruş.', en: 'Free kick within range.' },
}

const L = (): Lang => settings.value.lang
function txt(key: string, vars: Record<string, string> = {}): string {
  const pair = TXT[key]
  return pair ? lt(pair, vars) : ''
}

export interface FinishedMatch {
  fixture: FixtureView
  score: [number, number]
  heroSide: 'home' | 'away'
  stats: HeroMatchStatsView
  heroGoalMinutes: number[]
  scorers: { minute: number; name: string; side: 'home' | 'away'; playerId: string }[]
  team: PostMatchView['team']
  interviewAnswered: boolean
}

interface Runtime {
  rng: Rng
  view: LiveMatchView
  pre: PreMatchView
  strength: [number, number]
  timer: ReturnType<typeof setInterval> | null
  nextMoment: number
  stoppage: number
  corners: [number, number]
  fouls: [number, number]
  possSum: [number, number]
  scorers: FinishedMatch['scorers']
  heroGoalMinutes: number[]
  momentTimer: ReturnType<typeof setTimeout> | null
}

export function emptyHeroStats(): HeroMatchStatsView {
  return { minutes: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, passes: 0, passesCompleted: 0, tackles: 0, dribbles: 0, saves: 0, rating: 6.0 }
}

export function weatherFor(seed: number, week: number): Weather {
  const ws: Weather[] = ['clear', 'clear', 'rain', 'wind', 'clear', week > 14 && week < 26 ? 'snow' : 'hot']
  return ws[seed % ws.length]!
}

export function createMatchEngine(hooks: { onFinished(m: FinishedMatch): void }) {
  let rt: Runtime | null = null
  let finished: FinishedMatch | null = null

  const publish = () => {
    if (!rt) return
    const v = rt.view
    const total = rt.possSum[0] + rt.possSum[1] || 1
    v.possession = [Math.round((rt.possSum[0] / total) * 100), 100 - Math.round((rt.possSum[0] / total) * 100)]
    match.value = { ...v, events: [...v.events], heroStats: { ...v.heroStats } }
  }

  const name = (side: 'home' | 'away', excludeHero = true): string => {
    const r = rt as Runtime
    const lineup = side === 'home' ? r.pre.homeLineup : r.pre.awayLineup
    const pool = lineup.filter((p) => p.position !== 'GK' && !(excludeHero && p.isHero))
    return r.rng.weighted(pool, (p) => (p.position === 'ST' ? 4 : p.position === 'LW' || p.position === 'RW' || p.position === 'AM' ? 2.5 : 1)).name
  }
  const teamName = (side: 'home' | 'away') => (side === 'home' ? (rt as Runtime).view.fixture.home.shortName : (rt as Runtime).view.fixture.away.shortName)
  const heroName = () => (rt as Runtime).pre[(rt as Runtime).view.heroSide === 'home' ? 'homeLineup' : 'awayLineup'].find((p) => p.isHero)?.name ?? '—'

  const push = (type: MatchEventType, side: 'home' | 'away' | null, text: string, isHero?: boolean) => {
    const v = (rt as Runtime).view
    const e: MatchEventView = { minute: v.minute, type, side, text, score: [v.score[0], v.score[1]], isHero }
    v.events.push(e)
  }

  const goal = (side: 'home' | 'away', scorer: string, isHero: boolean, playerId: string) => {
    const r = rt as Runtime
    if (side === 'home') r.view.score[0]++
    else r.view.score[1]++
    r.view.shots[side === 'home' ? 0 : 1]++
    r.view.shotsOnTarget[side === 'home' ? 0 : 1]++
    r.scorers.push({ minute: r.view.minute, name: scorer, side, playerId })
    push('goal', side, isHero ? txt('heroGoal', { name: scorer }) : txt('goal', { name: scorer }), isHero)
    if (side !== r.view.heroSide && r.view.heroOnPitch) r.view.heroStats.rating = clamp(r.view.heroStats.rating - 0.15, 3, 10)
  }

  const stop = () => {
    if (rt?.timer) clearInterval(rt.timer)
    if (rt) rt.timer = null
  }

  const endMatch = () => {
    const r = rt as Runtime
    r.view.phase = 'done'
    r.view.finished = true
    r.view.minute = Math.max(r.view.minute, 90)
    push('fulltime', null, txt('fulltime'))
    stop()
    const hs = r.view.heroSide
    finished = {
      fixture: r.view.fixture,
      score: [r.view.score[0], r.view.score[1]],
      heroSide: hs,
      stats: { ...r.view.heroStats, rating: Math.round(r.view.heroStats.rating * 10) / 10 },
      heroGoalMinutes: r.heroGoalMinutes,
      scorers: r.scorers,
      team: {
        possession: [r.view.possession[0], r.view.possession[1]],
        shots: [r.view.shots[0], r.view.shots[1]],
        shotsOnTarget: [r.view.shotsOnTarget[0], r.view.shotsOnTarget[1]],
        corners: r.corners,
        fouls: r.fouls,
      },
      interviewAnswered: false,
    }
    hooks.onFinished(finished)
  }

  const tick = () => {
    const r = rt
    if (!r || r.view.paused || r.view.pendingMoment || r.view.finished) return
    const v = r.view
    v.minute++
    const rng = r.rng
    if (v.minute === 46 && v.phase === 'first') {
      v.minute = 45
      push('halftime', null, txt('halftime'))
      v.phase = 'second'
      v.minute = 46
    }
    if (v.heroOnPitch) {
      v.heroStats.minutes++
      if (rng.chance(0.45)) {
        v.heroStats.passes++
        if (rng.chance(0.8)) v.heroStats.passesCompleted++
      }
      if (rng.chance(0.03)) v.heroStats.dribbles++
      if (rng.chance(0.02)) v.heroStats.tackles++
      v.heroStats.rating = clamp(v.heroStats.rating + (rng.next() - 0.47) * 0.04, 3, 10)
    }
    const [sh, sa] = r.strength
    const side: 'home' | 'away' = rng.next() < sh / (sh + sa) ? 'home' : 'away'
    r.possSum[side === 'home' ? 0 : 1]++
    const target = side === 'home' ? 0.72 : 0.28
    v.ballX = clamp(v.ballX + (target - v.ballX) * 0.35 + (rng.next() - 0.5) * 0.25, 0.03, 0.97)
    v.ballY = clamp(v.ballY + (rng.next() - 0.5) * 0.35, 0.06, 0.94)
    const si = side === 'home' ? 0 : 1
    const roll = rng.next()
    if (roll < 0.1) {
      v.shots[si]++
      const n = name(side)
      const q = rng.next()
      if (q < 0.13) {
        v.shots[si]--
        const lineup = side === 'home' ? r.pre.homeLineup : r.pre.awayLineup
        const pid = lineup.find((p) => p.name === n)?.id ?? n
        goal(side, n, false, pid)
      } else if (q < 0.45) {
        v.shotsOnTarget[si]++
        push('save', side, txt('save', { name: n }))
      } else if (q < 0.5) push('woodwork', side, txt('woodwork', { name: n }))
      else push('miss', side, txt('miss', { name: n }))
    } else if (roll < 0.15) {
      r.corners[si]++
      push('corner', side, txt('corner', { team: teamName(side) }))
    } else if (roll < 0.175) {
      r.fouls[1 - si]!++
      push('freekick', side, txt('freekick', { team: teamName(side) }))
    } else if (roll < 0.19) {
      const other = side === 'home' ? 'away' : 'home'
      r.fouls[1 - si]!++
      push('yellow', other, txt('yellow', { name: name(other) }))
    } else if (roll < 0.205) push('offside', side, txt('offside', { name: name(side) }))
    else if (roll < 0.24) push('chance', side, txt('chance', { team: teamName(side) }))
    else if (roll < 0.255) push('commentary', null, txt('commentary'))
    else if (rng.chance(0.08)) r.fouls[si]++

    if (v.heroOnPitch && v.minute >= r.nextMoment && v.minute < 89) {
      const kinds = ['one_on_one', 'edge_of_box', 'cross', 'counter', 'build_up', rng.chance(0.15) ? 'penalty' : 'freekick']
      const kind = rng.pick(kinds)
      const pr = MOMENT_PROMPTS[kind]!
      let matchup
      try { matchup = matchupViewOf(generatedHighlight(kind as HighlightKind, v.minute, { lang: L() }), {}, heroName()) } catch { matchup = undefined }
      v.pendingMoment = { id: `m${v.minute}`, minute: v.minute, kind, prompt: lt(pr), matchup }
      push('highlight', v.heroSide, v.pendingMoment.prompt, true)
      r.nextMoment = v.minute + rng.int(15, 25)
    }
    if (v.minute >= 90 + r.stoppage) endMatch()
    publish()
  }

  const startTimer = () => {
    stop()
    if (!rt || rt.view.finished) return
    rt.timer = setInterval(tick, 250 / rt.view.speed)
  }

  const resolveMoment = () => {
    const r = rt
    if (!r || !r.view.pendingMoment) return
    const v = r.view
    const hs = v.heroSide
    const outcome = r.rng.weighted(['goal', 'assist', 'saved', 'missed', 'pass', 'lost'] as const, (o) =>
      ({ goal: 0.3, assist: 0.15, saved: 0.15, missed: 0.15, pass: 0.15, lost: 0.1 })[o])
    const hero = heroName()
    v.heroStats.passes++
    switch (outcome) {
      case 'goal':
        v.heroStats.goals++
        v.heroStats.shots++
        v.heroStats.shotsOnTarget++
        v.heroStats.rating = clamp(v.heroStats.rating + 1.1, 3, 10)
        r.heroGoalMinutes.push(v.minute)
        goal(hs, hero, true, 'hero')
        break
      case 'assist': {
        v.heroStats.assists++
        v.heroStats.passesCompleted++
        v.heroStats.rating = clamp(v.heroStats.rating + 0.75, 3, 10)
        const n = name(hs)
        push('chance', hs, txt('heroAssist', { hero, name: n }), true)
        const lineup = hs === 'home' ? r.pre.homeLineup : r.pre.awayLineup
        goal(hs, n, false, lineup.find((p) => p.name === n)?.id ?? n)
        break
      }
      case 'saved':
        v.heroStats.shots++
        v.heroStats.shotsOnTarget++
        v.shots[hs === 'home' ? 0 : 1]++
        v.shotsOnTarget[hs === 'home' ? 0 : 1]++
        v.heroStats.rating = clamp(v.heroStats.rating + 0.15, 3, 10)
        push('save', hs, txt('heroSaved', { hero }), true)
        break
      case 'missed':
        v.heroStats.shots++
        v.shots[hs === 'home' ? 0 : 1]++
        v.heroStats.rating = clamp(v.heroStats.rating - 0.2, 3, 10)
        push('miss', hs, txt('heroMiss', { hero }), true)
        break
      case 'pass':
        v.heroStats.passesCompleted++
        v.heroStats.rating = clamp(v.heroStats.rating + 0.2, 3, 10)
        push('commentary', hs, txt('heroPass', { hero }), true)
        break
      default:
        v.heroStats.rating = clamp(v.heroStats.rating - 0.3, 3, 10)
        push('commentary', hs, txt('heroLost', { hero }), true)
    }
    v.pendingMoment = null
    v.momentActive = false
    publish()
  }

  return {
    start(pre: PreMatchView, seed: number) {
      stop()
      finished = null
      const fx = pre.fixture
      const heroSide: 'home' | 'away' = fx.isHome ? 'home' : 'away'
      const rng = new Rng(seed)
      const hr = fx.home.reputation ?? 60
      const ar = fx.away.reputation ?? 60
      rt = {
        rng,
        pre,
        strength: [hr + 6, ar],
        timer: null,
        nextMoment: rng.int(6, 16),
        stoppage: rng.int(2, 5),
        corners: [0, 0],
        fouls: [0, 0],
        possSum: [1, 1],
        scorers: [],
        heroGoalMinutes: [],
        momentTimer: null,
        view: {
          fixture: fx,
          minute: 0,
          score: [0, 0],
          possession: [50, 50],
          shots: [0, 0],
          shotsOnTarget: [0, 0],
          events: [],
          ballX: 0.5,
          ballY: 0.5,
          phase: 'first',
          heroOnPitch: pre.heroStarting,
          heroSide,
          heroStats: emptyHeroStats(),
          pendingMoment: null,
          momentActive: false,
          decision: null,
          speed: settings.value.matchSpeed,
          paused: true,
          finished: false,
        },
      }
      push('kickoff', null, txt('kickoff'))
      publish()
    },
    pause(p: boolean) {
      if (!rt) return
      rt.view.paused = p
      if (p) stop()
      else startTimer()
      publish()
    },
    setSpeed(s: 0.5 | 1 | 2 | 4) {
      if (!rt) return
      rt.view.speed = s
      if (!rt.view.paused) startTimer()
      publish()
    },
    simMoment() {
      resolveMoment()
    },
    playMoment() {
      if (!rt || !rt.view.pendingMoment) return
      rt.view.momentActive = true
      publish()
      const r = rt
      r.momentTimer = setTimeout(() => {
        if (rt === r) resolveMoment()
      }, 2500)
    },
    skipToMoment() {
      if (!rt || rt.view.pendingMoment || rt.view.momentActive) return
      stop()
      const wasPaused = rt.view.paused
      rt.view.paused = false
      let guard = 0
      while (rt && !rt.view.finished && !rt.view.pendingMoment && guard++ < 400) tick()
      if (rt) rt.view.paused = wasPaused
      publish()
    },
    simToEnd() {
      if (!rt) return
      rt.view.paused = false
      let guard = 0
      while (rt && !rt.view.finished && guard++ < 400) {
        if (rt.view.pendingMoment) resolveMoment()
        tick()
      }
    },
    finished(): FinishedMatch | null {
      return finished
    },
    markInterview() {
      if (finished) finished.interviewAnswered = true
    },
    clear() {
      stop()
      if (rt?.momentTimer) clearTimeout(rt.momentTimer)
      rt = null
      finished = null
      match.value = null
    },
  }
}

export function interviewOptions(won: boolean): { question: { tr: string; en: string }; options: InterviewOption[] } {
  return {
    question: won
      ? { tr: 'Harika bir galibiyet! Bu performansın sırrı ne?', en: 'A great win! What was the secret tonight?' }
      : { tr: 'Zor bir akşam oldu. Neler eksikti?', en: 'A tough night. What was missing?' },
    options: [
      { id: 'humble', tone: 'humble', label: { tr: '"Takım arkadaşlarım olmadan imkânsızdı."', en: '"Impossible without my teammates."' }, preview: [{ key: 'relation', value: 4, label: { tr: 'Takım', en: 'Squad' } }, { key: 'reputation', value: 1 }] },
      { id: 'bold', tone: 'bold', label: { tr: '"Bu ligin en iyisi olacağım."', en: '"I’ll be the best in this league."' }, preview: [{ key: 'followers', value: 6000 }, { key: 'managerTrust', value: -2, uncertain: true }] },
      { id: 'critical', tone: 'critical', label: { tr: '"Hocanın planı bize uymadı."', en: '"The manager’s plan didn’t suit us."' }, preview: [{ key: 'managerTrust', value: -8 }, { key: 'reputation', value: 2, uncertain: true }] },
      { id: 'deflect', tone: 'deflect', label: { tr: '"Sıradaki maça odaklanıyoruz."', en: '"We’re focused on the next game."' }, preview: [{ key: 'discipline', value: 1 }] },
    ],
  }
}

// ───────────────────────── Post-match details (mock) ─────────────────────────

const MOCK_KINDS: Record<string, string[]> = {
  ST: ['one_on_one', 'cross', 'edge_of_box', 'counter', 'hold_up'],
  W: ['cross', 'counter', 'one_on_one', 'edge_of_box', 'corner_kick'],
  M: ['build_up', 'edge_of_box', 'counter', 'defend', 'cross'],
  D: ['defend', 'interception', 'defend_1v1', 'block', 'corner'],
  GK: ['gk_save', 'fk_wall'],
}
const kindPool = (p: Position): string[] =>
  p === 'GK' ? MOCK_KINDS.GK! : p === 'ST' ? MOCK_KINDS.ST! : p === 'LW' || p === 'RW' ? MOCK_KINDS.W! : p === 'CB' || p === 'LB' || p === 'RB' ? MOCK_KINDS.D! : MOCK_KINDS.M!

/** Mock "expected moments" preview. */
export function mockExpectedMoments(position: Position, starting: boolean): NonNullable<PreMatchView['expectedMoments']> {
  const pool = kindPool(position)
  const w = pool.map((_, i) => 1 / (i + 1.2))
  const tot = w.reduce((a, b) => a + b, 0)
  return { min: starting ? 4 : 1, max: starting ? 7 : 3, kinds: pool.map((kind, i) => ({ kind, share: w[i]! / tot })) }
}

const L2 = (tr: string, en: string) => ({ tr, en })
const MOCK_DELTA = { saved: 0.12, missed: -0.15, lost_ball: -0.25, pass_complete: 0.08, defended: 0.25 } as const

/** Mock rating breakdown, heat/shot map, trust and relationship rows for a finished mock match. */
export function mockPostDetails(m: FinishedMatch, s: GameState): Pick<PostMatchView, 'ratingBase' | 'ratingLog' | 'heroMap' | 'trust' | 'relations'> {
  const rng = new Rng(hashString(`post:${m.fixture.home.name}:${m.fixture.away.name}:${m.score.join("-")}`))
  const st = m.stats
  if (st.minutes <= 0) return {}
  const pool = kindPool(s.hero.position)
  const log: NonNullable<PostMatchView['ratingLog']> = []
  for (const minute of m.heroGoalMinutes) log.push({ minute, source: 'moment', key: 'goal', kind: pool[0], outcome: 'goal', delta: 1.0 })
  for (let i = 0; i < st.assists; i++) log.push({ minute: rng.int(5, 88), source: 'moment', key: 'assist', kind: 'cross', outcome: 'assist', delta: 0.7 })
  const extra = ['saved', 'missed', 'lost_ball', 'pass_complete', 'defended'] as const
  for (let i = 0; i < 3; i++) {
    const outcome = extra[rng.int(0, extra.length - 1)]
    log.push({ minute: rng.int(3, 89), source: 'moment', key: outcome!, kind: pool[rng.int(0, pool.length - 1)], outcome, delta: MOCK_DELTA[outcome!], ...(i === 2 ? { auto: true } : {}) })
  }
  const my = m.heroSide === 'home' ? 0 : 1
  for (const g of m.scorers) log.push({ minute: g.minute, source: 'team', key: g.side === m.heroSide ? 'goalFor' : 'goalAgainst', delta: g.side === m.heroSide ? 0.1 : -0.05 })
  const gf = m.score[my]
  const ga = m.score[1 - my]!
  if (gf !== ga) log.push({ minute: 90, source: 'final', key: 'result', delta: gf > ga ? 0.3 : -0.3 })
  if (st.passes >= 8) log.push({ minute: 90, source: 'final', key: 'passing', delta: Math.round((st.passesCompleted / st.passes - 0.78) * 1.5 * 100) / 100 })
  log.sort((a, b) => a.minute - b.minute)

  // Heat: a blob around the position's zone plus noise; shots near the box.
  const cols = 12
  const rows = 8
  const pos = s.hero.position
  const cx = pos === 'GK' ? 0.5 : pos === 'ST' ? 9.5 : pos === 'CB' || pos === 'LB' || pos === 'RB' ? 3 : 6.5
  const cy = pos === 'LW' || pos === 'LB' ? 1.5 : pos === 'RW' || pos === 'RB' ? 6.5 : 3.5
  const heat: number[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) heat.push(Math.max(0, Math.round((Math.exp(-((c - cx) ** 2) / 8 - (r - cy) ** 2 / 4) * 10 + rng.range(-0.5, 1)) * 10) / 10))
  }
  const shots: NonNullable<PostMatchView['heroMap']>['shots'] = []
  let goals = st.goals
  const misses = ['missed', 'blocked', 'woodwork'] as const
  for (let i = 0; i < st.shots; i++) {
    const outcome = goals > 0 ? 'goal' : i < st.shotsOnTarget ? 'saved' : misses[rng.int(0, 2)]!
    if (outcome === 'goal') goals--
    const x = clamp(rng.range(0.74, 0.95), 0, 1)
    const y = clamp(rng.range(0.3, 0.7), 0, 1)
    shots.push({ minute: rng.int(3, 89), x, y, outcome, xg: Math.round(clamp((x - 0.7) * 2, 0.03, 0.6) * 100) / 100, source: i % 3 === 2 ? 'auto' : 'moment', ...(rng.chance(0.2) ? { header: true } : {}) })
  }

  const before = Math.round(s.hero.managerTrust)
  const w = clamp(st.minutes / 90, 0.3, 1.2)
  const change = Math.round((st.rating - 6.3) * 3 * w * 10) / 10
  const reasons: NonNullable<PostMatchView['trust']>['reasons'] = []
  const perf = Math.round(change * 7) / 10
  const res = Math.round(change * 3) / 10
  if (perf) reasons.push({ key: 'rating', value: perf, label: L2(`Maç notun ${st.rating.toFixed(1)} (beklenen 6.3)`, `Your rating ${st.rating.toFixed(1)} (expected 6.3)`) })
  if (res) reasons.push({ key: 'result', value: res, label: gf > ga ? L2('Galibiyet', 'Win') : gf === ga ? L2('Beraberlik', 'Draw') : L2('Mağlubiyet', 'Defeat') })
  const shownChange = Math.round((perf + res) * 10) / 10
  const rels = Object.values(s.life.relationships)
  const fans = rels.find((r) => r.kind === 'fans')
  const mgr = rels.find((r) => r.kind === 'manager')
  const relations: NonNullable<PostMatchView['relations']> = []
  const d = Math.round((st.rating - 6.5) * 4)
  if (fans && d) relations.push({ id: fans.id, name: fans.name, kind: 'fans', before: Math.round(fans.value), after: Math.round(fans.value + d), why: L2('Maç performansın', 'Your match performance') })
  if (mgr && d) relations.push({ id: mgr.id, name: mgr.name, kind: 'manager', before: Math.round(mgr.value), after: Math.round(mgr.value + Math.sign(d)), why: L2('Maç notun', 'Your rating') })
  if (gf > ga) relations.push({ id: 'squad', name: '6', kind: 'squad', before: 20, after: 22, why: L2('Galibiyet sevinci', 'Shared joy of a win') })
  return {
    ratingBase: 6,
    ratingLog: log,
    heroMap: { cols, rows, heat, shots },
    trust: { before, after: Math.round((before + shownChange) * 10) / 10, reasons },
    relations,
  }
}
