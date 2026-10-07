/**
 * Dev-only audio lab (audio-lab.html): play every track, sting, crowd state,
 * UI sound and match SFX on the live engine, and render scenarios offline
 * with level statistics. Exposes `window.__renderAudio(id)` for scripts.
 */
import { audio, engine, sfx } from '../index'
import { CHANTS } from '../crowd'
import { STINGS, TRACKS } from '../music'
import { UI_SOUNDS } from '../uiSfx'
import { Sfx, type KickSound, type WhistlePattern } from '../../game/audio'
import { SCENARIOS, renderScenario } from './render'

engine.install()
const root = document.getElementById('lab')!
const stateEl = document.getElementById('state')!
const statsEl = document.getElementById('stats')!

function section(title: string): HTMLElement {
  const s = document.createElement('section')
  const h = document.createElement('h2')
  h.textContent = title
  const row = document.createElement('div')
  row.className = 'row'
  s.append(h, row)
  root.append(s)
  return row
}

function button(row: HTMLElement, label: string, fn: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.textContent = label
  b.addEventListener('click', () => {
    engine.unlock()
    fn()
  })
  row.append(b)
  return b
}

function slider(row: HTMLElement, label: string, min: number, max: number, value: number, step: number, fn: (v: number) => void): void {
  const l = document.createElement('label')
  const i = document.createElement('input')
  i.type = 'range'
  i.min = String(min)
  i.max = String(max)
  i.step = String(step)
  i.value = String(value)
  const out = document.createElement('span')
  out.textContent = String(value)
  i.addEventListener('input', () => {
    out.textContent = i.value
    fn(Number(i.value))
  })
  l.append(label, i, out)
  row.append(l)
}

// Music
const m = section('Music')
for (const id of TRACKS) button(m, `▶ ${id}`, () => audio.playMusic(id))
button(m, '■ stop', () => audio.stopMusic())
slider(m, 'intensity', 0, 1, 0.3, 0.05, (v) => audio.setMusicIntensity(v))
const st = section('Stings')
for (const id of STINGS) button(st, id, () => audio.sting(id))

// Crowd
const c = section('Crowd')
let capacity = 30000
let importance = 0.5
button(c, 'crowd ON', () => {
  audio.setCrowdSize(capacity, importance)
  audio.holdCrowd('lab')
})
button(c, 'crowd OFF', () => audio.releaseCrowd('lab'))
slider(c, 'capacity', 200, 80000, capacity, 100, (v) => {
  capacity = v
  audio.setCrowdSize(capacity, importance)
})
slider(c, 'importance', 0, 1, importance, 0.05, (v) => {
  importance = v
  audio.setCrowdSize(capacity, importance)
})
slider(c, 'tension', 0, 1, 0, 0.05, (v) => audio.setTension(v))
const ce = section('Crowd events')
button(ce, 'goal (home)', () => audio.crowdEvent('goal', 'home'))
button(ce, 'goal (away)', () => audio.crowdEvent('goal', 'away'))
button(ce, 'chance (home)', () => audio.crowdEvent('chance', 'home', 0.8))
button(ce, 'chance (away)', () => audio.crowdEvent('chance', 'away', 0.8))
button(ce, 'ooh (home)', () => audio.crowdEvent('nearMiss', 'home'))
button(ce, 'ooh (away)', () => audio.crowdEvent('nearMiss', 'away'))
button(ce, 'groan', () => audio.crowdEvent('groan', 'home'))
button(ce, 'save (home GK)', () => audio.crowdEvent('save', 'home'))
button(ce, 'foul by away', () => audio.crowdEvent('foul', 'away'))
button(ce, 'yellow for away', () => audio.crowdEvent('yellow', 'away'))
button(ce, 'red for home', () => audio.crowdEvent('red', 'home'))
button(ce, 'time wasting', () => audio.crowdEvent('timeWasting'))
button(ce, 'applause', () => audio.crowdEvent('applause', 'home', 0.8))
CHANTS.forEach((def, i) => button(ce, `chant ${i + 1}`, () => engine.withCrowd((cr) => cr.chant(def, 2, cr.ctx.currentTime + 0.1))))

// UI
const u = section('UI sounds')
for (const name of UI_SOUNDS) button(u, name, () => sfx(name))

// Game SFX
const g = section('Match SFX')
const game = new Sfx(1)
const kinds: KickSound[] = ['pass', 'through', 'cross', 'chip', 'shot', 'volley', 'penalty', 'header']
for (const k of kinds) button(g, `kick ${k}`, () => {
  game.unlock()
  game.kick(k === 'pass' ? 0.5 : 0.95, k)
})
const pats: WhistlePattern[] = ['start', 'foul', 'end', 'half', 'full']
for (const p of pats) button(g, `whistle ${p}`, () => {
  game.unlock()
  game.whistlePattern(p)
})
button(g, 'post (glance)', () => {
  game.unlock()
  game.clang(10)
})
button(g, 'post (full)', () => {
  game.unlock()
  game.clang(28)
})
for (const [label, fn] of [['net', () => game.net(20)], ['glove', () => game.glove()], ['scuff', () => game.scuff()], ['whoosh', () => game.whoosh(true)], ['tap', () => game.tap(0.6)], ['beep', () => game.beep(3)]] as const) {
  button(g, label, () => {
    game.unlock()
    fn()
  })
}

// Mixer
const mx = section('Mixer')
for (const k of ['master', 'music', 'sfx', 'crowd', 'ui'] as const) slider(mx, k, 0, 1, engine.settings[k], 0.05, (v) => audio.setMix({ [k]: v }))
button(mx, 'mute', () => audio.setMix({ muted: !engine.settings.muted }))
button(mx, 'reduced', () => audio.setMix({ reduced: !engine.settings.reduced }))

// Offline renders
const r = section('Offline render (level check)')
for (const sc of SCENARIOS) {
  button(r, sc.id, () => {
    statsEl.textContent = `rendering ${sc.id}…`
    void renderScenario(sc.id).then((res) => {
      const s = res.stats
      statsEl.textContent = `${res.id}: peak ${s.peakDb.toFixed(1)} dBFS · rms ${s.rmsDb.toFixed(1)} · windows ${s.minWindowDb.toFixed(1)}..${s.maxWindowDb.toFixed(1)} · silent ${(s.silentRatio * 100).toFixed(0)}% · NaN ${s.nan}`
    })
  })
}

setInterval(() => {
  stateEl.textContent = JSON.stringify(engine.debug(), null, 0)
}, 500)

declare global {
  interface Window {
    __renderAudio?: typeof renderScenario
    __audioScenarios?: string[]
  }
}
window.__renderAudio = renderScenario
window.__audioScenarios = SCENARIOS.map((s) => s.id)
