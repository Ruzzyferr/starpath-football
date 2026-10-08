/**
 * Standalone dev page for the highlight player (match-demo.html).
 * Lets you play a fake Highlight of every kind and tweak settings.
 * Run `npx vite` and open /match-demo.html.
 */
import '../styles/fonts.css'
import type { Difficulty, KitColors, Lang, Position } from '../core/types'
import type { HighlightKind, Weather } from '../sim/match/types'
import type { AimAssist } from './kick'
import { ALL_KINDS, makeDemoHighlight } from './demoHighlights'
import { createMatchGame, replayMoment, startHighlight, type HighlightHandle } from './MatchScene'
import { listMoments } from './moments'
import type { CelebrationChoice, CelebrationId, ReplayAngleChoice } from './presentation'
import { isQualityChoice } from './quality'
import { startClip } from './clipExport'
import type { InputRecording } from './inputReplay'
import { headlessOutcome, scriptedRecording } from './reelProbe'

const HERO: KitColors = { primary: '#c8102e', secondary: '#ffffff', pattern: 'stripes' }
const OPP: KitColors = { primary: '#1d4ed8', secondary: '#0b1b44', pattern: 'hoops' }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const stage = $<HTMLDivElement>('stage')
const kindsEl = $<HTMLDivElement>('kinds')
const resultEl = $<HTMLSpanElement>('result')

const params = new URLSearchParams(location.search)
const qParam = params.get('q')
const quality = isQualityChoice(qParam) && qParam !== 'auto' ? qParam : undefined
const game = createMatchGame(stage, quality)
let current: HighlightKind = (ALL_KINDS as readonly string[]).includes(params.get('kind') ?? '') ? (params.get('kind') as HighlightKind) : 'edge_of_box'
let seed = Number(params.get('seed') ?? 1) || 1
const auto = params.get('auto') === '1'
if (params.get('weather')) $<HTMLSelectElement>('weather').value = params.get('weather')!
if (params.get('lang')) $<HTMLSelectElement>('lang').value = params.get('lang')!
if (params.get('cap')) $<HTMLSelectElement>('stadium').value = params.get('cap')!
if (params.get('night') === '1') $<HTMLInputElement>('night').checked = true
if (params.get('angle')) $<HTMLSelectElement>('angle').value = params.get('angle')!
const celebration = (params.get('celeb') ?? 'auto') as CelebrationChoice
const ALL_CELEBS: CelebrationId[] = ['knee_slide', 'airplane', 'point_sky', 'badge_kiss', 'team_huddle', 'shush', 'corner_flag', 'backflip', 'robot', 'heart_hands', 'ice_cold', 'cartwheel']
const reducedMotion = params.get('rm') === '1'
const lowFx = params.get('lowfx') === '1'
let handle: HighlightHandle | null = null
/** ?hero=CB: play the moment as another position (fk_wall as the captain in the wall). */
const HERO_POSITIONS: readonly Position[] = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST']
const heroPosParam = HERO_POSITIONS.find((p) => p === params.get('hero'))

const buttons = new Map<HighlightKind, HTMLButtonElement>()
for (const k of ALL_KINDS) {
  const b = document.createElement('button')
  b.textContent = k.replace(/_/g, ' ')
  b.onclick = () => {
    current = k
    seed++
    play()
  }
  kindsEl.appendChild(b)
  buttons.set(k, b)
}
$<HTMLButtonElement>('again').onclick = () => {
  seed++
  play()
}
for (const id of ['assist', 'diff', 'weather', 'lang', 'slowmo', 'sound', 'stadium', 'night']) $<HTMLElement>(id).addEventListener('change', () => play())
$<HTMLButtonElement>('rewatch').onclick = () => rewatch()

/** Rewatch the latest recorded moment (Moments list in the real game). */
function rewatch(): void {
  const all = listMoments('demo')
  const m = all[all.length - 1]
  if (!m) return
  handle?.stop()
  resultEl.textContent = 'replay…'
  handle = replayMoment(game, m, { settings: { aimAssist: 'half', slowMoAim: true, vibration: false, sound: 0.8, reducedMotion, lowFx, quality }, angle: $<HTMLSelectElement>('angle').value as ReplayAngleChoice }, () => {
    resultEl.textContent = 'replay done'
    handle = null
  })
}
;(window as unknown as { __spRewatch?: () => void }).__spRewatch = rewatch

function play(): void {
  handle?.stop()
  for (const [k, b] of buttons) b.classList.toggle('on', k === current)
  const lang = $<HTMLSelectElement>('lang').value as Lang
  const hl = makeDemoHighlight(current, seed, lang, 72, heroPosParam)
  resultEl.textContent = '…'
  // Blur selects so keyboard controls reach the game.
  ;(document.activeElement as HTMLElement | null)?.blur?.()
  handle = startHighlight(
    game,
    hl,
    {
      heroTeamColors: HERO,
      oppColors: OPP,
      settings: {
        aimAssist: $<HTMLSelectElement>('assist').value as AimAssist,
        slowMoAim: $<HTMLInputElement>('slowmo').checked,
        vibration: true,
        sound: $<HTMLInputElement>('sound').checked ? 0.8 : 0,
        reducedMotion,
        lowFx,
        quality,
      },
      stadium: { capacity: Number($<HTMLSelectElement>('stadium').value), night: $<HTMLInputElement>('night').checked },
      celebration: { choice: celebration, unlocked: ALL_CELEBS },
      replayAngle: $<HTMLSelectElement>('angle').value as ReplayAngleChoice,
      matchKey: 'demo',
      lang,
      difficulty: $<HTMLSelectElement>('diff').value as Difficulty,
      weather: $<HTMLSelectElement>('weather').value as Weather,
      heroName: 'ARDA',
      teamNames: { hero: 'STARPATH FC', opp: 'NORTH CITY' },
      importance: 0.6,
      autopilot: auto,
    },
    (r) => {
      const stats = `sh ${r.shots}/${r.shotsOnTarget} · pass ${r.passesCompleted}/${r.passes} · drb ${r.dribbles} · tkl ${r.tackles}${r.card ? ' · ' + r.card : ''}`
      resultEl.textContent = `${current}: ${r.outcome.toUpperCase()} (${stats})`
      // eslint-disable-next-line no-console
      console.info('[highlight]', current, r)
      handle = null
    },
  )
}

/** Dev / e2e goal-reel probe: see reelProbe.ts. */
;(window as unknown as { __spReel?: unknown }).__spReel = {
  scripted: scriptedRecording,
  headless: headlessOutcome,
  play(kind: HighlightKind, sd: number, rec: InputRecording) {
    handle?.stop()
    return new Promise((resolve) => {
      handle = startHighlight(
        game,
        makeDemoHighlight(kind, sd, 'en', 72),
        {
          heroTeamColors: HERO, oppColors: OPP, settings: { aimAssist: 'full', slowMoAim: true, vibration: false, sound: 0, reducedMotion, lowFx, quality },
          lang: 'en', difficulty: 'hard', weather: 'rain', replay: false, matchKey: 'goal-reel', inputReplay: rec,
        },
        (r) => { handle = null; resolve(r) },
      )
    })
  },
  /** Records the canvas for `ms` (clip export capability probe). */
  async clip(ms: number) {
    const r = startClip(game.canvas, { maxMs: ms })
    if (!r) return null
    const blob = await r.done
    return { size: blob.size, type: blob.type, capped: r.capped }
  },
}

play()
