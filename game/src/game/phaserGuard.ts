/**
 * Every Phaser host (training drills, trials, the live-match moment, replays, scouting) starts
 * through {@link guardPhaser}, so no player is ever left on a black canvas:
 *
 * - WebGL first (unless Low graphics or a remembered WebGL failure), Canvas second;
 * - a start fails when no frame is presented within ~3 s, a scene throws (the game step and the
 *   scene launch are wrapped: one uncaught throw would otherwise stop Phaser's loop for good),
 *   the WebGL context is lost, or the first WebGL frames come out blank;
 * - a WebGL failure is remembered (renderGuard.ts) and the host restarts on Canvas;
 * - if Canvas fails too, a small TR/EN panel replaces the canvas with the error text, GPU,
 *   WebView version and an Exit button (also reachable with Android Back).
 *
 * A start sentinel (renderGuard.beginStart / endStart) covers the one case no in-page timer
 * can: a GPU driver that hangs the main thread. The next app start sees it and uses Canvas.
 */
import Phaser from 'phaser'
import { bindExitTap } from '../platform/exitTap'
import { pushError, recentErrors, describeError } from '../telemetry/errorRing'
import { beginRun, crumb, readCrumbs, startHeartbeat, stopHeartbeat, unfinishedRun } from '../telemetry/breadcrumbs'
import { beginStart, createWatchdog, endStart, FIRST_FRAME_MS, isBlankFrame, isReadbackSlow, markReadbackSlow, markWebglBroken, pickRenderer, PROBE_STALL_MS, type RendererChoice, type Watchdog } from './renderGuard'

export type PhaserHostKind = 'drill' | 'match' | 'replay' | 'scouting'

export type Safe = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => void

export interface GuardOptions {
  container: HTMLElement
  host: PhaserHostKind
  /** Player chose Settings › Graphics › Graphics quality › Low: Canvas from the start. */
  lowGraphics?: boolean
  /**
   * Creates the game with `renderer` and launches the scene. Wrap callbacks Phaser calls
   * outside its game step (the READY launch) with `safe` so a throw there is caught too.
   */
  build(renderer: RendererChoice, safe: Safe): Phaser.Game
  /** The panel's Exit button: leave the host as if the player quit. */
  onExit(): void
  /** Called before each restart on Canvas (the scene is launched again from scratch). */
  onRestart?(): void
}

export interface GuardHandle {
  readonly game: Phaser.Game | null
  readonly renderer: RendererChoice
  /** Tear the game down (the host is leaving). */
  stop(): void
}

/** Dev/e2e hooks: force failures without a broken GPU. */
interface DebugHooks {
  __spForceRenderFail?: 'webgl' | 'all' | 'throw-webgl' | 'throw-all'
}

const BLANK_PROBE_MS = [700, 1500, 2600, 3800]

/** RGBA samples of the canvas (downscaled to 8×8 through a 2D canvas, read in the same task). */
function sampleCanvas(src: HTMLCanvasElement): Uint8ClampedArray | null {
  try {
    const c = document.createElement('canvas')
    c.width = 8
    c.height = 8
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(src, 0, 0, 8, 8)
    return ctx.getImageData(0, 0, 8, 8).data
  } catch {
    return null
  }
}

/** GPU renderer string from a live WebGL game ('' when Canvas or unavailable). */
export function gpuOfGame(game: Phaser.Game | null): string {
  try {
    const gl = (game?.renderer as { gl?: WebGLRenderingContext } | undefined)?.gl
    if (!gl) return ''
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '')
  } catch {
    return ''
  }
}

export function webviewVersion(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
  const m = /Chrome\/([\d.]+)/.exec(ua)
  return m ? `Chrome ${m[1]}${/; wv\)/.test(ua) ? ' (WebView)' : ''}` : ua.slice(0, 80) || '?'
}

const isTr = (): boolean => typeof document === 'undefined' || (document.documentElement.lang || 'tr').startsWith('tr')

/** The readable failure panel (plain DOM: it must work when Preact or Phaser is the thing that broke). */
export function showRenderErrorPanel(container: HTMLElement, info: { reason: string; gpu: string; tried: RendererChoice[] }, onExit: () => void): HTMLElement {
  const tr = isTr()
  const panel = document.createElement('div')
  panel.className = 'render-fail'
  panel.setAttribute('role', 'alertdialog')
  panel.setAttribute('data-testid', 'render-fail')
  const h = document.createElement('h2')
  h.textContent = tr ? 'Oyun ekranı açılamadı' : 'The game view could not start'
  const p = document.createElement('p')
  p.textContent = tr
    ? 'Cihazının grafik sürücüsü bu ekranı çizemedi. Çık ile devam edebilirsin. Bu ekranın görüntüsünü bize gönderirsen sorunu çözebiliriz.'
    : 'Your device’s graphics driver could not draw this screen. Use Exit to carry on. A screenshot of this panel helps us fix it.'
  const pre = document.createElement('pre')
  const errs = recentErrors().slice(-5).map((e) => `· [${e.kind}] ${e.message}`)
  pre.textContent = [
    `${tr ? 'Neden' : 'Reason'}: ${info.reason}`,
    `${tr ? 'Denenen' : 'Tried'}: ${info.tried.join(' → ')}`,
    `GPU: ${info.gpu || '?'}`,
    `WebView: ${webviewVersion()}`,
    ...errs,
  ].join('\n')
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'btn btn-primary'
  btn.setAttribute('data-back-exit', '')
  btn.setAttribute('data-testid', 'render-fail-exit')
  btn.textContent = tr ? 'Çık' : 'Exit'
  // Touch / pointer as well as click: the first tap must exit even on a struggling WebView.
  bindExitTap(btn, (via) => {
    crumb('exit-tap', via)
    onExit()
  })
  panel.append(h, p, pre, btn)
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative'
  container.appendChild(panel)
  return panel
}

/** Starts a Phaser host under the render guard. */
export function guardPhaser(o: GuardOptions): GuardHandle {
  const dbg = (typeof globalThis !== 'undefined' ? globalThis : {}) as DebugHooks
  let game: Phaser.Game | null = null
  let renderer: RendererChoice = pickRenderer({ lowGraphics: o.lowGraphics })
  let wd: Watchdog | null = null
  let stopped = false
  let gpu = ''
  let attemptNo = 0
  const tried: RendererChoice[] = []
  let panel: HTMLElement | null = null
  const offs: (() => void)[] = []

  const teardown = () => {
    wd?.dispose()
    wd = null
    for (const f of offs.splice(0)) f()
    const g = game
    game = null
    if (!g) return
    try {
      g.canvas?.remove()
    } catch { /* already gone */ }
    try {
      g.destroy(true)
    } catch (e) {
      pushError('phaser', e)
    }
  }

  const fail = (attempt: number, reason: string) => {
    if (stopped || attempt !== attemptNo) return
    // This attempt is over: its game's later frames (until the pending destroy runs) are ignored.
    attemptNo++
    pushError('render', `${renderer}: ${reason}`)
    crumb('render-fail', `${o.host} ${renderer}: ${reason}`)
    console.warn(`[StarPath] ${o.host} ${renderer} renderer failed: ${reason}`)
    if (renderer === 'webgl') gpu = gpuOfGame(game) || gpu
    teardown()
    if (renderer === 'webgl') {
      markWebglBroken(`${o.host}: ${reason}`)
      renderer = 'canvas'
      o.onRestart?.()
      start()
      return
    }
    endStart()
    crumb('fail-panel', `${o.host}: ${reason}`.slice(0, 160))
    stopHeartbeat()
    panel = showRenderErrorPanel(o.container, { reason, gpu, tried }, () => o.onExit())
  }

  function start(): void {
    const attempt = ++attemptNo
    const r = renderer
    tried.push(r)
    beginStart(r, o.host)
    // Breadcrumbs (telemetry/breadcrumbs): written before each step that could hang the thread.
    if (attempt === 1) {
      // The UI may have opened the run already (trial: intro → start tap → chunk → drill).
      if (!unfinishedRun(readCrumbs())) beginRun(o.host)
      startHeartbeat()
    }
    crumb('phaser-build', `${o.host} ${r}`)
    const safe: Safe = (fn) => (...a) => {
      if (stopped || attempt !== attemptNo) return
      try {
        fn(...a)
      } catch (e) {
        pushError('phaser', e)
        fail(attempt, `scene error: ${describeError(e)}`)
      }
    }
    // No frame in time: a backgrounded app (no rAF) re-arms; otherwise one short second chance
    // covers a slow scene create that ran past the timer, then the start counts as failed.
    let secondChance = false
    const onTimeout = () => {
      if (stopped || attempt !== attemptNo) return
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        wd = createWatchdog(onTimeout)
        return
      }
      if (!secondChance) {
        secondChance = true
        wd = createWatchdog(onTimeout, 1500)
        return
      }
      fail(attempt, `no frame within ${(FIRST_FRAME_MS + 1500) / 1000} s`)
    }
    wd = createWatchdog(onTimeout)
    let g: Phaser.Game
    try {
      const forced = dbg.__spForceRenderFail
      if (forced === 'all' || (forced === 'webgl' && r === 'webgl')) throw new Error(`forced ${r} failure (debug)`)
      g = o.build(r, safe)
    } catch (e) {
      pushError('phaser', e)
      fail(attempt, `create failed: ${describeError(e)}`)
      return
    }
    game = g
    crumb('phaser-built', `${r === 'webgl' && (g.renderer as { gl?: unknown } | null)?.gl ? 'webgl' : g.renderer ? 'canvas' : 'booting'}${r === 'webgl' ? ` · ${gpuOfGame(g) || '?'}` : ''}`)
    // The step is called by Phaser's rAF loop; one throw there ends the loop forever (black, and
    // destroy() never runs). Wrapped, the failure is reported and the loop keeps going so the
    // pending destroy can complete.
    const host = g as unknown as { step: (t: number, d: number) => void }
    const step = host.step.bind(g)
    let broken = false
    host.step = (t, d) => {
      if (broken) return
      try {
        const forced = dbg.__spForceRenderFail
        if ((forced === 'throw-all' || (forced === 'throw-webgl' && r === 'webgl')) && attempt === attemptNo && !stopped) throw new Error(`forced ${r} scene throw (debug)`)
        step(t, d)
      } catch (e) {
        if (attempt === attemptNo && !stopped) {
          pushError('phaser', e)
          fail(attempt, `scene error: ${describeError(e)}`)
        } else {
          // Throwing while being torn down: stop the loop instead of throwing every frame.
          broken = true
          try { g.loop.stop() } catch { /* ignore */ }
        }
      }
    }
    const canvas = g.canvas
    if (canvas) {
      const onLost = (ev: Event) => {
        ev.preventDefault()
        fail(attempt, 'WebGL context lost')
      }
      canvas.addEventListener('webglcontextlost', onLost)
      offs.push(() => canvas.removeEventListener('webglcontextlost', onLost))
    }
    // Frames: the first one settles the watchdog; WebGL is then checked for blank output a few
    // times (fades / dark intros never last the whole window) before the start counts as good.
    let firstAt = -1
    let probe = 0
    const onFrame = () => {
      if (attempt !== attemptNo || stopped) return
      const now = performance.now()
      if (firstAt < 0) {
        firstAt = now
        wd?.ok()
        crumb('first-frame', r)
        // Canvas has no blank-shader failure mode; a device whose GPU readback stalls skips the check.
        const skipProbe = r === 'webgl' && isReadbackSlow()
        if (r === 'canvas' || skipProbe) {
          crumb('render-ok', skipProbe ? `${r} · no probe` : r)
          endStart()
          g.events.off(Phaser.Core.Events.POST_RENDER, onFrame)
        }
        return
      }
      if (probe >= BLANK_PROBE_MS.length || now - firstAt < BLANK_PROBE_MS[probe]!) return
      probe++
      crumb('probe', String(probe))
      const t0 = performance.now()
      const px = g.canvas ? sampleCanvas(g.canvas) : null
      const took = performance.now() - t0
      // A readback that stalls the thread is worse than the failure it looks for: frames are being
      // presented, so count the start as good and never probe on this device again.
      const stalled = took > PROBE_STALL_MS
      if (stalled) markReadbackSlow(took)
      if (stalled || !px || !isBlankFrame(px, [0x0b, 0x14, 0x10])) {
        if (!gpu) gpu = gpuOfGame(g)
        crumb('render-ok', `${r} · probe ${probe} · ${Math.round(took)} ms`)
        endStart()
        g.events.off(Phaser.Core.Events.POST_RENDER, onFrame)
        return
      }
      if (probe >= BLANK_PROBE_MS.length) fail(attempt, 'WebGL frames are blank')
    }
    g.events.on(Phaser.Core.Events.POST_RENDER, onFrame)
  }

  start()

  return {
    get game() {
      return game
    },
    get renderer() {
      return renderer
    },
    stop() {
      if (stopped) return
      stopped = true
      crumb('exit', o.host)
      stopHeartbeat()
      // A clean exit is not a hang: the next start must not be pushed to Canvas.
      endStart()
      teardown()
      panel?.remove()
      panel = null
    },
  }
}
