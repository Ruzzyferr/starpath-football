import type { CDPSession, Page } from '@playwright/test'
import { test, expect, preferEnglish, waitForApp, sp, dismissControlHint } from './fixtures'

/**
 * Touch shooting (owner feedback from the Android build): every deliberate
 * swipe toward goal must shoot on the first try, and the swipe's length/speed
 * must span the power range. Real CDP touch sequences (touchStart → many
 * touchMove → touchEnd) with human-like, seeded randomness: slow drags, fast
 * flicks, short swipes, starts near the on-screen buttons or in the joystick
 * half, sometimes with the joystick thumb already down.
 */
test.skip(({ isMobile }) => !isMobile, 'touch only')
test.setTimeout(420_000)

interface Probe {
  gestures: { outcome: string; power: number; length: number; speed: number; duration: number }[]
  kicks: { power: number; kick: string }[]
}
interface Pt {
  x: number
  y: number
}
interface Info {
  heroOnBall: boolean
  live?: boolean
  phase?: string
  mode?: string
  finished?: boolean
  ball: Pt | null
  goal: Pt
  canvas: { left: number; top: number; width: number; height: number }
}

/** Small seeded PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const probe = (page: Page) => page.evaluate(() => (globalThis as unknown as { __spProbe?: Probe }).__spProbe ?? { gestures: [], kicks: [] })

async function touch(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', pts: { x: number; y: number; id: number }[]) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 6, radiusY: 6, force: 1 })) })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * One human-like swipe: minimum-jerk path along a slight arc, sampled at the
 * screen's touch rate; flicks lift the finger while still moving.
 */
async function humanSwipe(cdp: CDPSession, info: Info, r: () => number, joystickDown: boolean): Promise<{ len: number; dur: number }> {
  const c = info.canvas
  const short = Math.min(c.width, c.height)
  const ball = info.ball ?? info.goal
  // Aim somewhere in the goal mouth (±3 m ≈ a slice of the goal width on screen).
  const aim = { x: info.goal.x + (r() - 0.5) * short * 0.12, y: info.goal.y }
  const dx = aim.x - ball.x
  const dy = aim.y - ball.y
  const dl = Math.hypot(dx, dy) || 1
  const ux = dx / dl
  const uy = dy / dl
  // Thumb starts in the lower part of the screen: near the ball, or wherever the thumb rests.
  const sx = c.left + c.width * (0.28 + r() * 0.64)
  const sy = c.top + c.height * (0.5 + r() * 0.42)
  // The player means a strength (soft … full): length and speed follow it loosely, like a thumb does.
  const intent = r()
  const loose = () => Math.min(1, Math.max(0, intent + (r() - 0.5) * 0.35))
  const len = short * (0.06 + 0.58 * loose())
  // Average finger speed 0.25–3.3 short sides per second: slow pushes up to sharp flicks.
  const avg = short * (0.25 + 3.05 * loose())
  const dur = Math.min(900, Math.max(40, (1000 * len) / avg))
  const lift = intent > 0.55 && r() < 0.5 ? 0.65 + r() * 0.25 : 1 // flicks release mid-motion
  const bend = (r() - 0.5) * 0.25
  const id = 11
  const jid = 12
  const joy = { x: c.left + c.width * 0.14, y: c.top + c.height * 0.86 }
  const pts = (q: Pt) => (joystickDown ? [{ ...joy, id: jid }, { ...q, id }] : [{ ...q, id }])
  if (joystickDown) await touch(cdp, 'touchStart', [{ ...joy, id: jid }])
  const t0 = Date.now()
  await touch(cdp, 'touchStart', pts({ x: sx, y: sy }))
  const hz = 1000 / (8 + r() * 9)
  const n = Math.max(3, Math.round((dur / 1000) * hz))
  for (let k = 1; k <= n; k++) {
    const tau = (k / n) * lift
    const s = (10 * tau ** 3 - 15 * tau ** 4 + 6 * tau ** 5) / (lift < 1 ? 10 * lift ** 3 - 15 * lift ** 4 + 6 * lift ** 5 : 1)
    const off = Math.sin(Math.PI * tau) * bend * len
    const q = { x: sx + ux * len * s - uy * off, y: sy + uy * len * s + ux * off }
    const due = t0 + (dur * k) / n
    const wait = due - Date.now()
    if (wait > 1) await sleep(wait)
    await touch(cdp, 'touchMove', pts(q))
  }
  await touch(cdp, 'touchEnd', joystickDown ? [{ ...joy, id: jid }] : [])
  if (joystickDown) await touch(cdp, 'touchEnd', [])
  return { len: len / short, dur }
}

interface Tally {
  tries: number
  ok: number
  powers: number[]
  misses: string[]
}

function report(name: string, t: Tally) {
  const ps = [...t.powers].sort((a, b) => a - b)
  const q = (f: number) => ps[Math.min(ps.length - 1, Math.floor(f * ps.length))] ?? 0
  console.log(`[touch-shoot] ${name}: first-swipe ${t.ok}/${t.tries} = ${((100 * t.ok) / Math.max(1, t.tries)).toFixed(1)}%  power min ${q(0).toFixed(2)} p10 ${q(0.1).toFixed(2)} p50 ${q(0.5).toFixed(2)} p90 ${q(0.9).toFixed(2)} max ${q(1).toFixed(2)}`)
  if (t.misses.length) console.log(`[touch-shoot] ${name} misses: ${t.misses.slice(0, 12).join(' | ')}`)
}

/** Swipes once and waits for the hero kick; returns the kick power or null. */
async function swipeAndCheck(page: Page, cdp: CDPSession, info: Info, r: () => number, t: Tally): Promise<void> {
  const before = await probe(page)
  const nk = before.kicks.length
  const ng = before.gestures.length
  const joystickDown = r() < 0.2
  const sw = await humanSwipe(cdp, info, r, joystickDown)
  t.tries++
  let after = await probe(page)
  for (let i = 0; i < 12 && after.kicks.length === nk; i++) {
    await page.waitForTimeout(50)
    after = await probe(page)
  }
  if (after.kicks.length > nk) {
    t.ok++
    t.powers.push(after.kicks[nk]!.power)
    if (process.env.TOUCH_DEBUG) {
      const g = after.gestures.slice(ng).find((x) => x.outcome === 'swipe')
      console.log(`[touch-shoot] sent len ${sw.len.toFixed(2)} dur ${sw.dur.toFixed(0)} → measured len ${g?.length.toFixed(2)} dur ${((g?.duration ?? 0) * 1000).toFixed(0)} peak ${g?.speed.toFixed(2)} power ${after.kicks[nk]!.power.toFixed(2)}`)
    }
  } else {
    const g = after.gestures.slice(ng).map((x) => `${x.outcome}(p${x.power.toFixed(2)} l${x.length.toFixed(2)})`).join(',')
    t.misses.push(`len ${sw.len.toFixed(2)} dur ${sw.dur.toFixed(0)}${joystickDown ? ' +joy' : ''} → ${g || 'no gesture'}`)
  }
}

async function openShootingDrill(page: Page): Promise<void> {
  await sp(page, `(() => { const s = sp.state(); s.calendar.slot = 0; s.life.energy = 100; s.hero.fatigue = 0; s.hero.injury = null; sp.navigate('training') })()`)
  const card = page.locator('.trn-session', { hasText: 'Shooting Drill' })
  await card.getByRole('button', { name: 'Play drill' }).click()
  const overlay = page.locator('.trn-drill')
  await overlay.getByRole('button', { name: 'Start' }).click()
  await expect(overlay.locator('canvas')).toBeVisible({ timeout: 20_000 })
  await dismissControlHint(page, 3000)
}

const trainingInfo = (page: Page) => page.evaluate(() => (globalThis as unknown as { __spTraining?: { debugInfo(): Info } }).__spTraining?.debugInfo() ?? null)

async function runTraining(page: Page, seed: number, swipes: number): Promise<Tally> {
  const r = rng(seed)
  const cdp = await page.context().newCDPSession(page)
  const t: Tally = { tries: 0, ok: 0, powers: [], misses: [] }
  await page.goto('/?autostart=1&seed=314')
  await waitForApp(page)
  await sp(page, 'sp.clearEvents()')
  while (t.tries < swipes) {
    await openShootingDrill(page)
    for (let guard = 0; guard < 400 && t.tries < swipes; guard++) {
      const info = await trainingInfo(page)
      if (!info || info.finished) break
      if (!info.live || !info.heroOnBall) {
        await page.waitForTimeout(60)
        continue
      }
      // A human reacts a beat after the ball is set.
      await page.waitForTimeout(80 + r() * 250)
      await swipeAndCheck(page, cdp, info, r, t)
      await page.waitForTimeout(150)
    }
    const overlay = page.locator('.trn-drill')
    const result = overlay.locator('.trn-drill-result')
    await expect(result).toBeVisible({ timeout: 60_000 })
    await result.getByRole('button', { name: 'Done' }).click()
    await expect(overlay).toHaveCount(0)
  }
  return t
}

const matchInfo = (page: Page) => page.evaluate(() => (globalThis as unknown as { __spScene?: { debugInfo(): Info } }).__spScene?.debugInfo() ?? null)

async function runMatch(page: Page, seed: number, moments: number): Promise<Tally> {
  const r = rng(seed)
  const t: Tally = { tries: 0, ok: 0, powers: [], misses: [] }
  const kinds = ['one_on_one', 'edge_of_box', 'counter']
  for (let m = 0; m < moments; m++) {
    const kind = kinds[m % kinds.length]!
    await page.goto(`/match-demo.html?kind=${kind}&seed=${100 + m}&assist=half`)
    await page.waitForFunction(() => !!(globalThis as unknown as { __spScene?: unknown }).__spScene, undefined, { timeout: 30_000 })
    const cdp = await page.context().newCDPSession(page)
    for (let guard = 0; guard < 300; guard++) {
      const info = await matchInfo(page)
      if (!info || info.finished || info.mode !== 'play') break
      if (info.phase !== 'live' || !info.heroOnBall) {
        await page.waitForTimeout(50)
        continue
      }
      await page.waitForTimeout(60 + r() * 200)
      const fresh = (await matchInfo(page)) ?? info
      if (!fresh.heroOnBall) continue
      await swipeAndCheck(page, cdp, fresh, r, t)
      break
    }
  }
  return t
}

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

test('training finishing drill: human-like swipes shoot first time across the power range', async ({ page }) => {
  const t = await runTraining(page, 20261008, Number(process.env.TOUCH_SWIPES ?? 60))
  report('training', t)
  expect(t.ok / t.tries).toBeGreaterThanOrEqual(0.98)
  expect(Math.max(...t.powers) - Math.min(...t.powers)).toBeGreaterThanOrEqual(0.85)
})

test('match highlights: first swipe on the ball shoots', async ({ page }) => {
  const t = await runMatch(page, 777, Number(process.env.TOUCH_MOMENTS ?? 24))
  report('match', t)
  expect(t.ok / t.tries).toBeGreaterThanOrEqual(0.98)
})
