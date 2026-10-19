import { World } from '../src/world'
const q = new URLSearchParams(location.search)
const w = new World(document.getElementById('c') as HTMLCanvasElement, { lowPower: q.get('low') === '1', reducedMotion: q.get('rm') === '1' })
const [leg, t] = (q.get('leg') ?? '0,0').split(',').map(Number)
w.setLeg(leg!, t ?? 0)
if (q.get('aim')) { const [x, y] = q.get('aim')!.split(',').map(Number); w.showAim({ x: x!, y: y! }, 0.8, 0.3) }
// Let the haze and crowd settle for a few frames, then hold.
let n = 0
const tick = () => { w.renderOnce(); if (++n < 20) requestAnimationFrame(tick); else (window as unknown as { __ready: boolean }).__ready = true }
tick()
addEventListener('resize', () => { w.resize(); w.renderOnce() })
