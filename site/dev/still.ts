import { World } from '../src/world'
const q = new URLSearchParams(location.search)
const w = new World(document.getElementById('c') as HTMLCanvasElement, { lowPower: q.get('low') === '1', reducedMotion: q.get('rm') === '1' })
const [leg, t] = (q.get('leg') ?? '0,0').split(',').map(Number)
w.setLeg(leg!, t ?? 0)
// ?adv=seconds runs the world forward (the hero kick loop) before the still is taken.
w.advance(Number(q.get('adv') ?? 0.4))
if (q.get('aim')) { const [x, y] = q.get('aim')!.split(',').map(Number); w.showAim({ x: x!, y: y! }, 0.8, 0.3) }
let n = 0
const tick = () => { w.renderOnce(); if (++n < 6) requestAnimationFrame(tick); else (window as unknown as { __ready: boolean }).__ready = true }
tick()
addEventListener('resize', () => { w.resize(); w.renderOnce() })
