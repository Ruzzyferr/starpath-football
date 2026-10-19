import { World } from '../src/scene'
const q = new URLSearchParams(location.search)
const w = new World(document.getElementById('c') as HTMLCanvasElement, { lowPower: q.get('low') === '1', reducedMotion: true })
w.setProgress(Number(q.get('p') ?? 0), true)
if (q.get('aim')) { const [x, y] = q.get('aim')!.split(',').map(Number); w.showAim({ x: x!, y: y! }, 0.8, 0.3) }
w.renderOnce()
;(window as unknown as { __ready: boolean }).__ready = true
addEventListener('resize', () => { w.resize(); w.renderOnce() })
