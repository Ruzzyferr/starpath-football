import type { CDPSession, Page } from '@playwright/test'
import { test, expect, preferEnglish, assertCleanText, waitForApp, sp, dismissControlHint } from './fixtures'

interface Pt { x: number; y: number }
interface Dbg {
  phase: string
  finished: boolean
  mode: string
  kind: string
  heroOnBall: boolean
  heroIsKeeper: boolean
  timeLeft: number
  goal: Pt
  hero: Pt
  ball: Pt
  canvas: { left: number; top: number; width: number; height: number }
  fps: number
  result: string | null
}

const dbg = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __spScene?: { debugInfo(): unknown; sys?: { isActive(): boolean } } }).__spScene
    try {
      return (s?.debugInfo() ?? null) as Dbg | null
    } catch {
      return null
    }
  })

const momentActive = (page: Page) => sp<boolean>(page, '!!sp.match()?.momentActive')

/** WASD keys that move the hero along a screen direction. */
function keysFor(dx: number, dy: number): string[] {
  const k: string[] = []
  const l = Math.hypot(dx, dy) || 1
  if (dy / l < -0.38) k.push('KeyW')
  if (dy / l > 0.38) k.push('KeyS')
  if (dx / l < -0.38) k.push('KeyA')
  if (dx / l > 0.38) k.push('KeyD')
  return k
}

async function playDesktop(page: Page): Promise<number> {
  let shots = 0
  for (let i = 0; i < 400 && (await momentActive(page)); i++) {
    const d = await dbg(page)
    if (!d || d.phase !== 'live' || d.mode !== 'play') {
      await page.waitForTimeout(150)
      continue
    }
    if (d.heroOnBall && !d.heroIsKeeper) {
      // Dribble toward goal with WASD, then hold-release the mouse at the goal.
      const keys = keysFor(d.goal.x - d.hero.x, d.goal.y - d.hero.y)
      for (const k of keys) await page.keyboard.down(k)
      await page.waitForTimeout(350)
      const g = (await dbg(page)) ?? d
      await page.mouse.move(g.goal.x, g.goal.y)
      await page.mouse.down()
      await page.waitForTimeout(520)
      await page.mouse.move(g.goal.x + 4, g.goal.y - 2)
      await page.mouse.up()
      for (const k of keys) await page.keyboard.up(k)
      shots++
      await page.waitForTimeout(600)
    } else {
      // Off the ball: run at the ball (tackles / interceptions happen on contact).
      const keys = keysFor(d.ball.x - d.hero.x, d.ball.y - d.hero.y)
      for (const k of keys) await page.keyboard.down(k)
      if (Math.hypot(d.ball.x - d.hero.x, d.ball.y - d.hero.y) < 60) await page.keyboard.press('Space')
      await page.waitForTimeout(250)
      for (const k of keys) await page.keyboard.up(k)
    }
  }
  return shots
}

async function touch(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', pts: { x: number; y: number; id: number }[]) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : pts.map((p) => ({ x: p.x, y: p.y, id: p.id })) })
}

async function playTouch(page: Page): Promise<number> {
  const cdp = await page.context().newCDPSession(page)
  let swipes = 0
  for (let i = 0; i < 400 && (await momentActive(page)); i++) {
    const d = await dbg(page)
    if (!d || d.phase !== 'live' || d.mode !== 'play') {
      await page.waitForTimeout(150)
      continue
    }
    const c = d.canvas
    if (d.heroOnBall && !d.heroIsKeeper) {
      // Swipe on the right half toward the goal.
      const sx = c.left + c.width * 0.72
      const sy = c.top + c.height * 0.72
      const dx = d.goal.x - d.hero.x
      const dy = d.goal.y - d.hero.y
      const l = Math.hypot(dx, dy) || 1
      const len = Math.min(c.height * 0.35, 260)
      await touch(cdp, 'touchStart', [{ x: sx, y: sy, id: 1 }])
      for (let k = 1; k <= 6; k++) {
        await page.waitForTimeout(16)
        await touch(cdp, 'touchMove', [{ x: sx + (dx / l) * len * (k / 6), y: sy + (dy / l) * len * (k / 6), id: 1 }])
      }
      await touch(cdp, 'touchEnd', [])
      swipes++
      await page.waitForTimeout(700)
    } else {
      // Left-thumb joystick toward the ball.
      const bx = c.left + c.width * 0.18
      const by = c.top + c.height * 0.78
      const dx = d.ball.x - d.hero.x
      const dy = d.ball.y - d.hero.y
      const l = Math.hypot(dx, dy) || 1
      await touch(cdp, 'touchStart', [{ x: bx, y: by, id: 2 }])
      await touch(cdp, 'touchMove', [{ x: bx + (dx / l) * 50, y: by + (dy / l) * 50, id: 2 }])
      await page.waitForTimeout(300)
      await touch(cdp, 'touchEnd', [])
    }
  }
  return swipes
}

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

test('live match: play a moment with real input, sim to the end, post-match rating', async ({ page, shot, isMobile, browserName }) => {
  await page.goto('/?autostart=1&seed=777')
  await waitForApp(page)
  await sp(page, 'sp.toMatchday()')
  // Make sure the hero starts (selection is a roll since trials/merit roles; this test needs minutes).
  await sp(page, "(() => { const s = sp.state(); s.hero.contract.role = 'captain'; s.hero.managerTrust = 100; s.hero.form = 90; s.hero.fatigue = 0; s.hero.sharpness = 100; s.life.flags.promised_start = true })()")
  await page.keyboard.press('Escape')
  const play = page.getByRole('button', { name: 'Play match' })
  await expect(play).toBeVisible()
  await shot('c1-matchday-home')
  await play.click()
  await expect(page.getByRole('button', { name: 'Kick off' })).toBeVisible()
  await assertCleanText(page)
  await shot('c2-prematch')
  await page.getByRole('button', { name: 'Kick off' }).click()
  await expect(page.locator('.lm-root')).toBeVisible()
  // Fast clock until the first moment.
  await page.locator('.lm-controls').getByText('4×').click()
  const card = page.locator('.lm-moment')
  await expect(card).toBeVisible({ timeout: 120_000 })
  await assertCleanText(page)
  await shot('c3-moment-card')
  const minuteBefore = await sp<number>(page, 'sp.match().minute')

  // Phaser must not be loaded before a moment is played (lazy chunk).
  const phaserBefore = await page.evaluate(() => performance.getEntriesByType('resource').some((r) => /phaser/i.test(r.name)))
  expect(phaserBefore, 'Phaser loaded before the first moment').toBe(false)

  await card.getByRole('button', { name: 'Play moment' }).click()
  await page.waitForFunction(() => !!(window as unknown as { __spScene?: unknown }).__spScene, undefined, { timeout: 30_000 })
  await dismissControlHint(page)
  await page.waitForFunction(() => (window as unknown as { __spScene: { debugInfo(): { phase: string } } }).__spScene.debugInfo().phase === 'live', undefined, { timeout: 20_000 })
  await page.waitForTimeout(400)
  await shot('c4-moment-live')
  const kind = (await dbg(page))?.kind
  // Touch swipes go through CDP (Chromium only); WebKit plays with the keyboard path.
  const inputs = isMobile && browserName === 'chromium' ? await playTouch(page) : await playDesktop(page)
  await expect.poll(() => momentActive(page), { timeout: 120_000 }).toBe(false)
  const res = await page.evaluate(() => (window as unknown as { __spLastHighlight?: { outcome: string } }).__spLastHighlight ?? null)
  const fallback = await page.evaluate(() => (window as unknown as { __spHighlightFallback?: string }).__spHighlightFallback ?? null)
  expect(fallback).toBeNull()
  expect(res?.outcome, `moment ${kind} produced a result (inputs: ${inputs})`).toBeTruthy()
  console.log(`[e2e] ${isMobile ? 'touch' : 'kb+mouse'} moment ${kind}: ${res?.outcome} after ${inputs} shot inputs`)
  await shot('c5-after-moment')

  // The match continues.
  await expect.poll(async () => (await sp<number>(page, 'sp.match().minute')) > minuteBefore || (await card.count()) > 0, { timeout: 60_000 }).toBe(true)

  // Sim to the end (resolve any pending moment by sim first).
  for (let i = 0; i < 10; i++) {
    if (await card.count()) await card.getByRole('button', { name: 'Sim moment' }).click()
    const simBtn = page.getByRole('button', { name: 'Sim to the end' })
    // A moment card can disable the button between the check and the click: retry the loop then.
    if (await simBtn.isEnabled().catch(() => false) && (await simBtn.click({ timeout: 3000 }).then(() => true, () => false))) break
    await page.waitForTimeout(200)
  }
  await expect(page.locator('.lm-fulltime')).toBeVisible({ timeout: 30_000 })
  await shot('c6-fulltime')
  await page.locator('.lm-fulltime').getByRole('button', { name: 'Continue' }).click()
  const rating = page.locator('.post-rating-num')
  await expect(rating).toBeVisible()
  await expect(rating).toHaveText(/^\d{1,2}(\.\d)?$/)
  await page.waitForTimeout(1200) // let the entrance animation settle before the screenshot
  await assertCleanText(page)
  await shot('c7-postmatch')
})

// ───────────────────────── Pause gate (TestFlight build 5) ─────────────────────────

interface Frozen { clock: number; timeLeft: number; phase: string; paused: boolean; ballWorld: { x: number; y: number; z: number } }
const frozenState = async (page: Page): Promise<Frozen | null> => {
  const d = (await dbg(page)) as unknown as Frozen | null
  return d ? { clock: d.clock, timeLeft: d.timeLeft, phase: d.phase, paused: d.paused, ballWorld: d.ballWorld } : null
}

/** Background the page the way the OS does (visibilitychange → platform/lifecycle → sp:app-pause). */
const setHidden = (page: Page, hidden: boolean) =>
  page.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') })
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)

test('pause gate: a moment stays frozen behind its hint card and on background, then runs after a 3-2-1', async ({ page, shot }) => {
  await page.goto('/?autostart=1&seed=777')
  await waitForApp(page)
  await sp(page, 'sp.toMatchday()')
  await sp(page, "(() => { const s = sp.state(); s.hero.contract.role = 'captain'; s.hero.managerTrust = 100; s.hero.form = 90; s.hero.fatigue = 0; s.hero.sharpness = 100; s.life.flags.promised_start = true })()")
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Play match' }).click()
  await page.getByRole('button', { name: 'Kick off' }).click()
  await expect(page.locator('.lm-root')).toBeVisible()
  await page.locator('.lm-controls').getByText('4×').click()
  const card = page.locator('.lm-moment')
  await expect(card).toBeVisible({ timeout: 120_000 })
  await card.getByRole('button', { name: 'Play moment' }).click()
  await page.waitForFunction(() => !!(window as unknown as { __spScene?: unknown }).__spScene, undefined, { timeout: 30_000 })

  // The hint card is up and the moment has not moved at all.
  const hint = page.locator('.control-hint')
  await expect(hint).toBeVisible({ timeout: 15_000 })
  const before = await frozenState(page)
  expect(before?.paused).toBe(true)
  await shot('pg1-hint-frozen')
  await page.waitForTimeout(10_000)
  const after = await frozenState(page)
  expect(after, 'moment state unchanged after 10 s behind the hint').toEqual(before)
  expect(await momentActive(page)).toBe(true)
  expect(await page.evaluate(() => (window as unknown as { __spLastHighlight?: unknown }).__spLastHighlight ?? null)).toBeNull()

  // Dismiss: a 3-2-1 beat, then the moment runs.
  await hint.locator('.control-hint-close').click()
  await expect(hint).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __spPauseGate: { beat(): string | null } }).__spPauseGate.beat())).toMatch(/^[123]$/)
  await expect.poll(async () => (await frozenState(page))?.clock ?? 0, { timeout: 20_000 }).toBeGreaterThan(before!.clock)

  // Backgrounding freezes it again; coming back resumes after the same beat.
  await setHidden(page, true)
  await page.waitForTimeout(200)
  const bg = await frozenState(page)
  expect(bg?.paused).toBe(true)
  await page.waitForTimeout(3000)
  expect(await frozenState(page)).toEqual(bg)
  await setHidden(page, false)
  await expect.poll(async () => (await frozenState(page))?.clock ?? 0, { timeout: 20_000 }).toBeGreaterThan(bg!.clock)
  await shot('pg2-resumed')
})

// ───────────────────────── Context buttons (TestFlight 6) ─────────────────────────

interface Btn { id: string; hold: boolean; key: string | null; down: boolean; x: number; y: number; r: number }
interface BtnDbg extends Dbg { heroState: string; heroWorld: Pt; stamina: number; buttons: Btn[]; pendingChoice: string | null; paused: boolean }

const btnDbg = (page: Page) => dbg(page) as Promise<BtnDbg | null>

/** Synthetic pointer on the canvas (works in Chromium and WebKit, touch or mouse). */
async function pointer(page: Page, type: 'pointerdown' | 'pointerup', x: number, y: number, id: number, touch: boolean) {
  await page.evaluate(
    ({ type, x, y, id, touch }) => {
      const c = document.querySelector('canvas')!
      c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: touch ? 'touch' : 'mouse', clientX: x, clientY: y, button: 0, bubbles: true, isPrimary: true }))
    },
    { type, x, y, id, touch },
  )
}

/** Opens one demo moment and waits until it is live with its buttons up. */
async function openMoment(page: Page, kind: string, seed: number): Promise<BtnDbg> {
  await page.goto(`/match-demo.html?kind=${kind}&seed=${seed}&assist=half&lang=en`)
  await page.waitForFunction(() => !!(globalThis as unknown as { __spScene?: unknown }).__spScene, undefined, { timeout: 30_000 })
  await dismissControlHint(page, 1500)
  await expect.poll(async () => {
    const d = await btnDbg(page)
    return !!d && d.mode === 'play' && d.phase === 'live' && !d.paused && d.buttons.length > 0
  }, { timeout: 20_000 }).toBe(true)
  return (await btnDbg(page))!
}

const SETS: Record<string, string[]> = {
  defend: ['tackle', 'slide', 'jockey', 'sprint'],
  defend_1v1: ['jockey', 'tackle', 'slide', 'sprint'],
  gk_save: ['dive', 'stay'],
  gk_claim: ['claim', 'punch', 'dive'],
  gk_distribution: ['throw', 'kick'],
  hold_up: ['shield', 'pass', 'skill'],
}

for (const kind of Object.keys(SETS)) {
  test(`context buttons: ${kind} shows its own buttons and each one does something sensible`, async ({ page, isMobile }) => {
    test.setTimeout(240_000)
    const first = await openMoment(page, kind, 3)
    // The right buttons for the moment, never SPRINT + SKILL by default.
    expect(first.buttons.map((b) => b.id)).toEqual(SETS[kind])
    if (first.heroIsKeeper) expect(first.buttons.map((b) => b.id)).not.toContain('skill')
    // Inside the canvas, not overlapping.
    for (const b of first.buttons) {
      expect(b.x - b.r).toBeGreaterThanOrEqual(first.canvas.left - 1)
      expect(b.x + b.r).toBeLessThanOrEqual(first.canvas.left + first.canvas.width + 1)
      expect(b.y + b.r).toBeLessThanOrEqual(first.canvas.top + first.canvas.height + 1)
      if (!isMobile) expect(b.key, `${b.id} shows its key on desktop`).toBeTruthy()
    }
    for (const id of SETS[kind]!) {
      const d0 = await openMoment(page, kind, 3)
      const b = d0.buttons.find((q) => q.id === id)!
      await pointer(page, 'pointerdown', b.x, b.y, 11, isMobile)
      const states = new Set<string>()
      let maxJump = 0
      let prev = d0.heroWorld
      let wasDown = false
      // A challenge pressed out of range closes the man down first: watch it longer.
      const n = id === 'slide' || id === 'tackle' ? 22 : 10
      for (let i = 0; i < n; i++) {
        await page.waitForTimeout(90)
        const d = await btnDbg(page)
        if (!d || d.mode !== 'play') break
        states.add(d.heroState)
        maxJump = Math.max(maxJump, Math.hypot(d.heroWorld.x - prev.x, d.heroWorld.y - prev.y))
        prev = d.heroWorld
        if (d.buttons.find((q) => q.id === id)?.down) wasDown = true
      }
      await pointer(page, 'pointerup', b.x, b.y, 11, isMobile)
      const tag = `${kind}/${id}`
      // The press registered (hold buttons light up while held).
      if (b.hold) expect(wasDown, tag).toBe(true)
      // No teleports: under 4 m between ~90 ms samples (≈ 40 m/s).
      expect(maxJump, tag).toBeLessThan(4)
      // Nobody throws himself down: only SLIDE slides, only keepers dive.
      if (id !== 'slide') expect(states.has('slide'), tag).toBe(false)
      if (!d0.heroIsKeeper) expect(states.has('dive'), tag).toBe(false)
      if (id === 'sprint' || id === 'jockey' || id === 'shield') expect(states.has('down'), tag).toBe(false)
      if (id === 'dive') expect(states.has('dive'), tag).toBe(true)
      if (id === 'slide') expect(states.has('slide') || states.has('down') || Math.hypot(prev.x - d0.heroWorld.x, prev.y - d0.heroWorld.y) > 1, tag).toBe(true)
    }
  })
}

test('context buttons: screenshots of a defensive and a keeper moment (390x844)', async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile, 'phone layout')
  const out = process.env.E2E_SHOTS || testInfo.outputPath('')
  for (const [kind, seed] of [['defend', 3], ['gk_claim', 3], ['hold_up', 3]] as const) {
    await openMoment(page, kind, seed)
    await page.waitForTimeout(250)
    await page.screenshot({ path: `${out}/buttons-${kind}-${testInfo.project.name}.png` })
  }
})
