import { KICKS_PER_ROUND, resolveShot, swipePower, GOAL_HALF_W, GOAL_H, type Outcome, type ShotResult } from './penalty'
import type { World } from './scene'

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T | null
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll(sel)) as T[]

const S: Record<string, string> = (() => {
  try {
    return JSON.parse($('#strings')?.textContent ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
})()
const lang = document.documentElement.lang === 'en' ? 'en' : 'tr'
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* private mode */
    }
  },
}

// ───────── Language switch: remember the choice ─────────
for (const a of $$<HTMLAnchorElement>('[data-lang-switch]')) {
  a.addEventListener('click', () => store.set('sp.lang', a.dataset.langSwitch ?? lang))
}

// ───────── Bar turns solid once the 3D world is behind us ─────────
const bar = $('.bar')
const hero = $('#top')!
const play = $('#penalti')!
const moments = $('#anlar')!

// ───────── Entrances: heading, then text, then picture, staggered ─────────
function setupReveals(): void {
  const items = $$('.reveal')
  if (!('IntersectionObserver' in window)) return
  document.documentElement.classList.add('reveal-on')
  // Stagger siblings inside each section.
  for (const sec of $$('section, footer')) $$('.reveal', sec).forEach((el, i) => el.style.setProperty('--d', `${i * 80}ms`))
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        e.target.classList.add('is-in')
        io.unobserve(e.target)
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.1 },
  )
  items.forEach((el) => io.observe(el))
  // Never leave content hidden: anything still waiting after 4 s appears.
  setTimeout(() => items.forEach((el) => el.classList.add('is-in')), 4000)
}
setupReveals()

// ───────── Key moments: the giant control switches attack / goal ─────────
function setupMoments(): void {
  const section = moments
  const big = $<HTMLButtonElement>('.big-control', section)!
  const img = $<HTMLImageElement>('.moment-img', section)!
  const buttons = $$<HTMLButtonElement>('[data-moment]', section)
  const factMobile = document.createElement('p')
  factMobile.className = 'moment-fact-mobile'
  factMobile.setAttribute('aria-live', 'polite')
  $('.moments-copy', section)!.appendChild(factMobile)
  let swapTimer = 0

  const select = (btn: HTMLButtonElement, focus = false) => {
    for (const b of buttons) {
      const on = b === btn
      b.setAttribute('aria-pressed', String(on))
      b.parentElement!.classList.toggle('is-on', on)
    }
    const id = btn.dataset.moment!
    const fact = btn.parentElement!.querySelector('.fact')?.textContent ?? ''
    factMobile.textContent = fact
    const src = `/media/moments/${id}-${lang}.webp`
    if (!img.src.endsWith(src)) {
      window.clearTimeout(swapTimer)
      img.alt = `${btn.textContent}: ${fact}`
      if (reduced.matches) img.src = src
      else {
        img.classList.add('is-shut')
        img.src = src
        const open = () => {
          void img.offsetWidth
          img.classList.remove('is-shut')
        }
        swapTimer = window.setTimeout(() => (img.complete ? open() : img.addEventListener('load', open, { once: true })), 30)
      }
    }
    if (focus) btn.focus()
  }
  buttons.forEach((b) => b.addEventListener('click', () => select(b)))
  big.addEventListener('click', () => {
    const keep = section.dataset.mode !== 'keep'
    section.dataset.mode = keep ? 'keep' : 'attack'
    big.setAttribute('aria-pressed', String(keep))
    const first = buttons.find((b) => b.closest('li')!.dataset.set === (keep ? 'keep' : 'attack'))
    if (first) select(first)
  })
  select(buttons[0]!)
  // The signature move plays once as the section arrives: the moment opens from the right edge.
  if (!reduced.matches && 'IntersectionObserver' in window) {
    img.classList.add('is-shut')
    const opener = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return
      opener.disconnect()
      void img.offsetWidth
      img.classList.remove('is-shut')
    }, { threshold: 0.35 })
    opener.observe(big)
  }
  // Preload the other frames once the section is near.
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return
    io.disconnect()
    for (const b of buttons) new Image().src = `/media/moments/${b.dataset.moment}-${lang}.webp`
  }, { rootMargin: '600px 0px' })
  io.observe(section)
}
setupMoments()

// ───────── Career: one slider drives both fields ─────────
function setupCareer(): void {
  const input = $<HTMLInputElement>('.career-range input')
  if (!input) return
  const names = (input.dataset.stageNames ?? '').split('|')
  const fill = $<HTMLElement>('.range-fill')!
  const go = (n: number) => {
    input.value = String(n)
    input.setAttribute('aria-valuetext', names[n - 1] ?? String(n))
    fill.style.transform = `scaleX(${(n - 1) / 3})`
    for (const el of $$('[data-stage]', $('#kariyer')!)) el.classList.toggle('is-on', el.dataset.stage === String(n))
    for (const b of $$<HTMLButtonElement>('[data-go]')) {
      if (b.dataset.go === String(n)) b.setAttribute('aria-current', 'step')
      else b.removeAttribute('aria-current')
    }
  }
  input.addEventListener('input', () => go(Number(input.value)))
  for (const b of $$<HTMLButtonElement>('[data-go]')) b.addEventListener('click', () => go(Number(b.dataset.go)))
  go(1)
}
setupCareer()

// ───────── The clip: plays only while on screen ─────────
function setupClip(): void {
  const v = $<HTMLVideoElement>('[data-clip]')
  const toggle = $<HTMLButtonElement>('[data-clip-toggle]')
  if (!v || !toggle) return
  // Reduced motion: the poster stays, and the visitor can still choose to play it.
  let paused = reduced.matches
  toggle.hidden = false
  toggle.setAttribute('aria-pressed', String(paused))
  let visible = false
  const sync = () => {
    if (visible && !paused) {
      v.preload = 'auto'
      void v.play().catch(() => {})
    } else v.pause()
  }
  toggle.addEventListener('click', () => {
    paused = !paused
    toggle.setAttribute('aria-pressed', String(paused))
    sync()
  })
  const io = new IntersectionObserver((es) => {
    visible = es.some((e) => e.isIntersecting)
    sync()
  }, { threshold: 0.25 })
  io.observe(v)
}
setupClip()

// ───────── Penalty: HUD and score (shared by the 3D game and the fallback) ─────────
const hud = {
  dots: $$<HTMLLIElement>('.kick-dots li'),
  goals: $('[data-goals]')!,
  best: $('[data-best]')!,
  bestWrap: $('[data-best-wrap]')!,
  result: $('.result')!,
  announce: $('[data-announce]')!,
  summary: $('.summary')!,
  summaryText: $('[data-summary]')!,
}
const round: Outcome[] = []
let best = Number(store.get('sp.penaltyBest') ?? '0') || 0
function paintHud(): void {
  const goals = round.filter((k) => k === 'goal').length
  hud.goals.textContent = String(goals)
  hud.dots.forEach((d, i) => {
    d.className = i < round.length ? (round[i] === 'goal' ? 'is-goal' : 'is-miss') : i === round.length ? 'is-next' : ''
  })
  hud.best.textContent = String(best)
  hud.bestWrap.hidden = best === 0
}
paintHud()
const RESULT_TEXT: Record<Outcome, string> = {
  goal: S.resGoal ?? 'Goal!',
  saved: S.resSaved ?? 'Saved',
  weak: S.resWeak ?? 'Saved',
  post: S.resPost ?? 'Post!',
  wide: S.resWide ?? 'Wide',
  over: S.resOver ?? 'Over',
}
let resultTimer = 0
function showResult(o: Outcome): void {
  hud.result.textContent = o === 'weak' ? RESULT_TEXT.saved : RESULT_TEXT[o]
  hud.result.classList.toggle('is-goal', o === 'goal')
  hud.result.classList.add('is-on')
  hud.announce.textContent = `${RESULT_TEXT[o]} ${round.filter((k) => k === 'goal').length}/${KICKS_PER_ROUND}`
  window.clearTimeout(resultTimer)
  resultTimer = window.setTimeout(() => hud.result.classList.remove('is-on'), 1300)
}
function recordKick(o: Outcome): void {
  round.push(o)
  paintHud()
  showResult(o)
  if (round.length >= KICKS_PER_ROUND) {
    const goals = round.filter((k) => k === 'goal').length
    if (goals > best) {
      best = goals
      store.set('sp.penaltyBest', String(best))
    }
    window.setTimeout(() => {
      paintHud()
      hud.summaryText.textContent = goals === KICKS_PER_ROUND ? (S.summaryPerfect ?? '5/5') : (S.summary ?? '{n}/5').replace('{n}', String(goals))
      hud.summary.hidden = false
      hud.announce.textContent = hud.summaryText.textContent
      $<HTMLButtonElement>('[data-again]')?.focus({ preventScroll: true })
    }, 1400)
  }
}
function newRound(): void {
  round.length = 0
  hud.summary.hidden = true
  play.classList.remove('has-shot')
  paintHud()
}
$('[data-again]')?.addEventListener('click', () => {
  newRound()
  $<HTMLElement>('.pitch')?.focus({ preventScroll: true })
})

// ───────── Fallback: pick a corner (no WebGL) ─────────
for (const b of $$<HTMLButtonElement>('[data-zone]')) {
  b.addEventListener('click', () => {
    if (round.length >= KICKS_PER_ROUND) newRound()
    const [x, y] = (b.dataset.zone ?? '0,1').split(',').map(Number)
    const r = resolveShot({ x: x!, y: y!, power: 0.86, curl: 0 })
    recordKick(r.outcome)
  })
}

// ───────── The 3D world ─────────
function webgl(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const lowPower = (() => {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  const coarse = matchMedia('(pointer: coarse)').matches
  return coarse || (nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4 || !!nav.connection?.saveData
})()

let world: World | null = null

function scrollProgress(): number {
  // 0 at the top, 1 when the play section fills the screen.
  const top = play.offsetTop - (bar?.offsetHeight ?? 0)
  return Math.max(0, Math.min(1, window.scrollY / Math.max(1, top)))
}

function onScroll(): void {
  const y = window.scrollY
  bar?.classList.toggle('is-solid', y > hero.offsetHeight * 0.5)
  if (!world) return
  if (reduced.matches) world.setProgress(scrollProgress() > 0.5 ? 1 : 0, true)
  else world.setProgress(scrollProgress())
}
addEventListener('scroll', onScroll, { passive: true })
onScroll()

async function bootWorld(): Promise<void> {
  if (!webgl()) {
    document.documentElement.classList.add('no-webgl')
    return
  }
  const { World: W } = await import('./scene')
  const canvas = $<HTMLCanvasElement>('.world-canvas')!
  try {
    world = new W(canvas, { lowPower, reducedMotion: reduced.matches })
  } catch {
    document.documentElement.classList.add('no-webgl')
    return
  }
  const w = world
  w.setProgress(reduced.matches ? (scrollProgress() > 0.5 ? 1 : 0) : scrollProgress(), true)
  w.renderOnce()
  $('.world')!.classList.add('is-live')
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    w.stop()
    $('.world')!.classList.remove('is-live')
  })
  addEventListener('resize', () => w.resize(), { passive: true })
  // Render only while the first two screens are on screen and the tab is visible.
  let onScreen = true
  const sync = () => (onScreen && document.visibilityState === 'visible' ? w.start() : w.stop())
  const io = new IntersectionObserver((es) => {
    onScreen = es.some((e) => e.isIntersecting) || hero.getBoundingClientRect().bottom > 0 || play.getBoundingClientRect().bottom > 0
    sync()
  }, { threshold: 0 })
  io.observe(hero)
  io.observe(play)
  document.addEventListener('visibilitychange', sync)
  sync()
  setupPenalty(w)
}

function setupPenalty(w: World): void {
  const pitch = $<HTMLElement>('.pitch')!
  const power = $<HTMLElement>('.power')!
  const powerFill = $<HTMLElement>('.power-fill')!
  let pointer: { id: number; pts: { x: number; y: number; t: number }[] } | null = null
  let aim = { x: 0, y: 1.2 }
  let charge: { t0: number; raf: number } | null = null

  const unit = () => Math.min(Math.min(innerWidth, innerHeight), 480)
  const busy = () => w.busy || round.length >= KICKS_PER_ROUND

  w.onKickEnd = () => {
    w.resetKick()
  }

  const shoot = (x: number, y: number, p: number, curl: number) => {
    if (busy()) return
    play.classList.add('has-shot')
    const r: ShotResult = resolveShot({ x, y, power: p, curl })
    if (import.meta.env.DEV) console.info('shot', JSON.stringify({ x: +x.toFixed(2), y: +y.toFixed(2), p: +p.toFixed(2), o: r.outcome, side: r.keeperSide }))
    w.kick(r, curl)
    window.setTimeout(() => recordKick(r.outcome), r.t * 1000 + 250)
  }

  /** Aim from a swipe: into the goal if the finger ended over it, otherwise along the swipe's line. */
  const aimFromSwipe = (s: { x: number; y: number }, e: { x: number; y: number }) => {
    const direct = w.screenToGoal(e.x, e.y)
    const goalY = w.goalMidScreenY()
    if (direct && direct.y >= 0 && e.y <= w.ballScreen().y - 40 && direct.y <= GOAL_H + 1.5 && Math.abs(direct.x) <= GOAL_HALF_W + 2) return { x: direct.x, y: Math.min(direct.y, GOAL_H - 0.22) }
    const dy = e.y - s.y
    if (dy >= -4) return null
    const k = (goalY - s.y) / dy
    const sx = s.x + (e.x - s.x) * k
    const g = w.screenToGoal(sx, goalY)
    return g ? { x: g.x, y: 0.4 + Math.min(1.9, Math.max(0, -dy / unit()) * 2.4) } : null
  }

  const features = (pts: { x: number; y: number; t: number }[]) => {
    const a = pts[0]!
    const b = pts[pts.length - 1]!
    const u = unit()
    const len = Math.hypot(b.x - a.x, b.y - a.y) / u
    // Peak speed over windows of at least 40 ms (kick.ts peakSpeed).
    let peak = 0
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dt = (pts[j]!.t - pts[i]!.t) / 1000
        if (dt < 0.04) continue
        peak = Math.max(peak, Math.hypot(pts[j]!.x - pts[i]!.x, pts[j]!.y - pts[i]!.y) / u / dt)
        break
      }
    }
    // Curl: how far the path bows from its chord, signed.
    let curl = 0
    if (pts.length > 2) {
      const m = pts[Math.floor(pts.length / 2)]!
      const cx = b.x - a.x
      const cy = b.y - a.y
      const cross = (cx * (m.y - a.y) - cy * (m.x - a.x)) / Math.max(1, Math.hypot(cx, cy))
      curl = Math.max(-1, Math.min(1, -cross / (u * 0.12)))
    }
    return { len, peak, curl }
  }

  pitch.addEventListener('pointerdown', (e) => {
    if (busy() || pointer) return
    pitch.setPointerCapture(e.pointerId)
    pointer = { id: e.pointerId, pts: [{ x: e.clientX, y: e.clientY, t: performance.now() }] }
  })
  pitch.addEventListener('pointermove', (e) => {
    if (!pointer || e.pointerId !== pointer.id) return
    pointer.pts.push({ x: e.clientX, y: e.clientY, t: performance.now() })
    const a = aimFromSwipe(pointer.pts[0]!, { x: e.clientX, y: e.clientY })
    const f = features(pointer.pts)
    w.showAim(a, swipePower(f.len, f.peak), f.curl)
  })
  const end = (e: PointerEvent) => {
    if (!pointer || e.pointerId !== pointer.id) return
    pointer.pts.push({ x: e.clientX, y: e.clientY, t: performance.now() })
    const pts = pointer.pts
    pointer = null
    const f = features(pts)
    const a = aimFromSwipe(pts[0]!, pts[pts.length - 1]!)
    w.showAim(null)
    if (f.len < 0.045) {
      // A tap: shoot toward the tapped point with a clean strike (the touch alternative to a swipe).
      const end = pts[pts.length - 1]!
      const t = aimFromSwipe(w.ballScreen(), end)
      if (t) shoot(t.x, t.y, 0.86, 0)
      return
    }
    if (!a) return
    shoot(a.x, a.y, swipePower(f.len, f.peak), f.curl)
  }
  pitch.addEventListener('pointerup', end)
  pitch.addEventListener('pointercancel', () => {
    pointer = null
    w.showAim(null)
  })

  // Keyboard: arrows aim, Space (or Enter) held charges, release shoots.
  const showKeyAim = () => w.showAim(busy() ? null : aim, 0.85, 0)
  pitch.addEventListener('focus', () => {
    showKeyAim()
    // Arriving by keyboard: line the play screen up under the bar so the HUD is readable.
    if (pitch.matches(':focus-visible')) {
      const top = play.getBoundingClientRect().top
      const barH = bar?.offsetHeight ?? 0
      if (Math.abs(top - barH) > 4) play.scrollIntoView({ block: 'start', behavior: reduced.matches ? 'auto' : 'smooth' })
    }
  })
  pitch.addEventListener('blur', () => w.showAim(null))
  pitch.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.15 : 0.45
    if (e.key === 'ArrowLeft') aim.x = Math.max(-GOAL_HALF_W - 0.6, aim.x - step)
    else if (e.key === 'ArrowRight') aim.x = Math.min(GOAL_HALF_W + 0.6, aim.x + step)
    else if (e.key === 'ArrowUp') aim.y = Math.min(GOAL_H + 0.4, aim.y + step * 0.7)
    else if (e.key === 'ArrowDown') aim.y = Math.max(0.2, aim.y - step * 0.7)
    else if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault()
      if (busy() || charge) return
      const t0 = performance.now()
      power.classList.add('is-on')
      const tick = () => {
        const p = Math.min(1.15, ((performance.now() - t0) / 1100) * 1.15)
        powerFill.style.transform = `scaleX(${Math.min(1, p / 1.15)})`
        power.classList.toggle('is-over', p > 1)
        if (charge) charge.raf = requestAnimationFrame(tick)
      }
      charge = { t0, raf: requestAnimationFrame(tick) }
      return
    } else return
    e.preventDefault()
    showKeyAim()
  })
  pitch.addEventListener('keyup', (e) => {
    if ((e.key !== ' ' && e.key !== 'Enter') || !charge) return
    e.preventDefault()
    cancelAnimationFrame(charge.raf)
    const p = Math.min(1.15, ((performance.now() - charge.t0) / 1100) * 1.15)
    charge = null
    power.classList.remove('is-on', 'is-over')
    powerFill.style.transform = 'scaleX(0)'
    shoot(aim.x, aim.y, Math.max(0.12, p), 0)
    aim = { x: aim.x, y: aim.y }
  })
}

// "Take a penalty" buttons: bring the camera down and hand focus to the pitch.
for (const a of $$<HTMLAnchorElement>('[data-to-play]')) {
  a.addEventListener('click', (e) => {
    e.preventDefault()
    play.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' })
    window.setTimeout(() => $<HTMLElement>('.pitch')?.focus({ preventScroll: true }), reduced.matches ? 0 : 700)
    history.replaceState(null, '', '#penalti')
  })
}

// Boot the world after first paint so the poster and text show first.
const idle = (cb: () => void) => ((window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 60)))(cb, { timeout: 1200 })
if (document.readyState === 'complete') idle(() => void bootWorld())
else addEventListener('load', () => idle(() => void bootWorld()), { once: true })
