import type { Page } from '@playwright/test'
import { test, expect, dismissControlHint } from './fixtures'

/**
 * Playtester build 9 (real iPhone): "I run straight at the man holding / pressing PRESS and pass THROUGH him and the
 * ball". Drives the real touch path in the match demo — a thumb on the joystick steering at the carrier, the red
 * context button (PRESS / TACKLE) tapped every ~300 ms — and checks the hero never overlaps the man on the ball.
 * PW_SHOT_DIR=… keeps a screenshot sequence of the press → challenge (and the video is saved next to it).
 */
const ENV = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
// A video of the press → challenge for the owner when shots are asked for.
test.use({ video: ENV.PW_SHOT_DIR ? 'on' : 'off' })

interface Pt { x: number; y: number }
interface Btn { id: string; x: number; y: number; r: number }
interface Dbg {
  mode: string
  phase: string
  paused: boolean
  result: string | null
  canvas: { left: number; top: number; width: number; height: number }
  hero: Pt
  heroWorld: Pt
  heroState: string
  buttons: Btn[]
  carrier: { team: string; keeper: boolean; world: Pt; screen: Pt } | null
}

const dbg = (page: Page) => page.evaluate(() => (globalThis as unknown as { __spScene?: { debugInfo(): unknown } }).__spScene?.debugInfo() ?? null) as Promise<Dbg | null>

async function pointer(page: Page, type: 'pointerdown' | 'pointermove' | 'pointerup', x: number, y: number, id: number, touch: boolean) {
  await page.evaluate(
    ({ type, x, y, id, touch }) => {
      const c = document.querySelector('canvas')!
      c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: touch ? 'touch' : 'mouse', clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, isPrimary: id === 1 }))
    },
    { type, x, y, id, touch },
  )
}

const CASES: { kind: string; button: string }[] = [
  { kind: 'press_trap', button: 'press' },
  { kind: 'defend', button: 'tackle' },
]

for (const c of CASES) {
  test(`press on a phone: ${c.kind} — straight at the carrier with ${c.button.toUpperCase()}, never through him`, async ({ page, isMobile }, info) => {
    test.skip(!isMobile, 'touch path (phone projects)')
    test.setTimeout(240_000)
    const out = ENV.PW_SHOT_DIR
    let shots = 0
    let overlaps = 0
    let minD = 99
    const outcomes: string[] = []
    let played = 0
    for (let seed = 1; seed <= 3; seed++) {
      await page.goto(`/match-demo.html?kind=${c.kind}&seed=${seed}&assist=half&lang=en`)
      await page.waitForFunction(() => !!(globalThis as unknown as { __spScene?: unknown }).__spScene, undefined, { timeout: 30_000 })
      await dismissControlHint(page, 1500)
      let last: Dbg | null = null
      try {
        await expect.poll(async () => {
          // A control hint can come up a little later (it pauses the moment): close it like a player would.
          const hint = page.locator('.control-hint .control-hint-close')
          if (await hint.isVisible().catch(() => false)) await hint.click().catch(() => undefined)
          const d = (last = await dbg(page))
          // (A moment the team-mates settle before he can act — fast on a loaded machine — counts as ended.)
          return !!d && ((d.mode === 'play' && d.phase === 'live' && !d.paused && d.buttons.length > 0) || d.phase === 'post' || d.phase === 'done')
        }, { timeout: 30_000 }).toBe(true)
      } catch (e) {
        const l = last as Dbg | null
        throw new Error(`seed ${seed} never live: ${JSON.stringify({ mode: l?.mode, phase: l?.phase, paused: l?.paused, buttons: l?.buttons.length, result: l?.result })}`, { cause: e })
      }
      const d0 = (await dbg(page))!
      if (d0.phase !== 'live') {
        outcomes.push(`${seed}:ended-before-input`)
        continue
      }
      played++
      // Left thumb: the joystick, low on the left half.
      const base = { x: d0.canvas.left + d0.canvas.width * 0.22, y: d0.canvas.top + d0.canvas.height * 0.78 }
      await pointer(page, 'pointerdown', base.x, base.y, 1, true)
      let lastTap = 0
      for (let i = 0; i < 90; i++) {
        const d = await dbg(page)
        if (!d || d.phase !== 'live') break
        const k = d.carrier
        if (k && k.team === 'opp' && !k.keeper) {
          const dx = k.screen.x - d.hero.x
          const dy = k.screen.y - d.hero.y
          const l = Math.hypot(dx, dy) || 1
          await pointer(page, 'pointermove', base.x + (dx / l) * 48, base.y + (dy / l) * 48, 1, true)
          const wd = Math.hypot(k.world.x - d.heroWorld.x, k.world.y - d.heroWorld.y)
          minD = Math.min(minD, wd)
          if (wd < 0.6 && d.heroState === 'run') overlaps++
          const b = d.buttons.find((q) => q.id === c.button)
          if (b && Date.now() - lastTap > 300) {
            await pointer(page, 'pointerdown', b.x, b.y, 7, true)
            await pointer(page, 'pointerup', b.x, b.y, 7, true)
            lastTap = Date.now()
          }
          if (out && wd < 3.5 && shots < 40 && seed === 1) await page.screenshot({ path: `${out}/${info.project.name}-${c.kind}-s${seed}-${String(shots++).padStart(2, '0')}.png` })
        }
        await page.waitForTimeout(80)
      }
      await pointer(page, 'pointerup', base.x, base.y, 1, true)
      const end = await dbg(page)
      outcomes.push(`${seed}:${end?.result ?? end?.phase}`)
      if (out && seed === 1) await page.screenshot({ path: `${out}/${info.project.name}-${c.kind}-s${seed}-end.png` })
    }
    info.annotations.push({ type: 'press', description: `minD ${minD.toFixed(2)} outcomes ${outcomes.join(' ')}` })
    expect(played, outcomes.join(' ')).toBeGreaterThan(0)
    expect(overlaps, `hero overlapped the carrier (min ${minD.toFixed(2)} m)`).toBe(0)
  })
}
