import { test, expect, preferEnglish, assertCleanText, waitForApp, sp } from './fixtures'

test.beforeEach(async ({ page }) => {
  await preferEnglish(page)
})

/** Fresh career on the Training tab, morning, full energy, no pending cards. */
async function openTraining(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/?autostart=1&seed=314')
  await waitForApp(page)
  await sp(page, 'sp.clearEvents()')
  await sp(page, `(() => { const s = sp.state(); s.calendar.slot = 0; s.life.energy = 100; s.hero.fatigue = 0; s.hero.injury = null; sp.navigate('training') })()`)
  await expect(page.locator('.trn-session').first()).toBeVisible()
}

test('auto training applies the session and shows XP', async ({ page, shot }) => {
  await openTraining(page)
  const card = page.locator('.trn-session', { hasText: 'Passing Drill' })
  await expect(card.getByRole('button', { name: 'Play drill' })).toBeVisible()
  await assertCleanText(page)
  await shot('t1-sessions')
  const xp0 = await sp<number>(page, 'Object.values(sp.state().hero.attrXp).reduce((a, b) => a + b, 0) + Object.values(sp.state().hero.attrs).reduce((a, b) => a + b, 0)')
  const e0 = await sp<number>(page, 'sp.state().life.energy')
  await card.getByRole('button', { name: 'Auto (60%)' }).click()
  await expect(page.locator('.toast').filter({ hasText: /XP/ }).first()).toBeVisible()
  expect(await sp<number>(page, 'sp.state().life.energy')).toBeLessThan(e0)
  const xp1 = await sp<number>(page, 'Object.values(sp.state().hero.attrXp).reduce((a, b) => a + b, 0) + Object.values(sp.state().hero.attrs).reduce((a, b) => a + b, 0)')
  expect(xp1).toBeGreaterThan(xp0)
})

test('play the finishing drill to the end and get a graded result', async ({ page, shot }, info) => {
  await openTraining(page)
  const card = page.locator('.trn-session', { hasText: 'Shooting Drill' })
  await card.getByRole('button', { name: 'Play drill' }).click()
  const overlay = page.locator('.trn-drill')
  await expect(overlay.locator('.trn-drill-card')).toBeVisible()
  await assertCleanText(page)
  await shot('t2-drill-intro')
  await overlay.getByRole('button', { name: 'Start' }).click()
  const canvas = overlay.locator('canvas')
  await expect(canvas).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(3200) // countdown
  const box = (await canvas.boundingBox())!
  const mobile = info.project.name === 'mobile'
  // Shoot repeatedly at the top of the screen (the goal is up the screen).
  for (let i = 0; i < 12; i++) {
    const gx = box.x + box.width * (0.35 + (i % 3) * 0.15)
    const gy = box.y + box.height * 0.22
    if (mobile) {
      const sx = box.x + box.width * 0.7
      const sy = box.y + box.height * 0.75
      await page.touchscreen.tap(sx, sy) // unlock audio
      await canvas.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: sx, clientY: sy, isPrimary: true })
      for (let k = 1; k <= 6; k++) {
        await canvas.dispatchEvent('pointermove', { pointerId: 7, pointerType: 'touch', clientX: sx + ((gx - sx) * k) / 6, clientY: sy + ((gy - sy) * k) / 6, isPrimary: true })
        await page.waitForTimeout(16)
      }
      await canvas.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: gx, clientY: gy, isPrimary: true })
    } else {
      await page.mouse.move(gx, gy)
      await page.mouse.down()
      await page.waitForTimeout(650)
      await page.mouse.up()
    }
    if (i === 2) await shot('t3-drill-live')
    await page.waitForTimeout(1500)
  }
  const result = overlay.locator('.trn-drill-result')
  await expect(result).toBeVisible({ timeout: 60_000 })
  await expect(result.locator('.trn-grade')).toHaveText(/^[SABCD]$/)
  await expect(result).toContainText(/\+\d+ XP/)
  await assertCleanText(page)
  await shot('t4-drill-result')
  const shots = await sp<number>(page, 'sp.state().life.energy')
  expect(shots).toBeLessThan(100)
  await result.getByRole('button', { name: 'Done' }).click()
  await expect(overlay).toHaveCount(0)
})

test('crossing, heading and tackling sessions are listed with their drills', async ({ page }) => {
  await openTraining(page)
  for (const [session, drill] of [['Cross Station', 'Cross Station'], ['Header Machine', 'Header Machine'], ['Tackle Duel', 'Tackle Duel']]) {
    const card = page.locator('.trn-session', { hasText: session })
    await card.getByRole('button', { name: 'Play drill' }).click()
    const overlay = page.locator('.trn-drill')
    await expect(overlay.locator('.trn-drill-card h2')).toHaveText(drill)
    await assertCleanText(page)
    await overlay.getByRole('button', { name: 'Cancel' }).click()
    await expect(overlay).toHaveCount(0)
  }
})

test('play the cross station with the keyboard and get a graded result', async ({ page }) => {
  await openTraining(page)
  await page.locator('.trn-session', { hasText: 'Cross Station' }).getByRole('button', { name: 'Play drill' }).click()
  const overlay = page.locator('.trn-drill')
  await overlay.getByRole('button', { name: 'Start' }).click()
  await expect(overlay.locator('canvas')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(3000) // countdown
  const result = overlay.locator('.trn-drill-result')
  // Space crosses to the lit zone; keep delivering until the session ends.
  for (let i = 0; i < 40 && !(await result.isVisible()); i++) {
    await page.keyboard.press('Space')
    await page.waitForTimeout(1200)
  }
  await expect(result).toBeVisible({ timeout: 30_000 })
  await expect(result.locator('.trn-grade')).toHaveText(/^[SABCD]$/)
  await expect(result).toContainText(/\+\d+ XP/)
  await result.getByRole('button', { name: 'Done' }).click()
  await expect(overlay).toHaveCount(0)
})

test('goalkeeper distribution & claiming drill is listed for keepers and plays to a graded result', async ({ page, shot }) => {
  await openTraining(page)
  await expect(page.locator('.trn-session', { hasText: 'Distribution & Claiming' })).toHaveCount(0)
  await sp(page, `(() => { sp.actions.newGame({ firstName: 'Eli', lastName: 'Kaya', nickname: 'Eli', nationality: 'TR', birthYear: 2009, position: 'GK', foot: 'R', role: 'shotStopper', background: 'academy', appearance: { skin: 2, hairStyle: 3, hairColor: 1, beard: 0, eyeColor: 1, face: 1, accessory: 0 }, difficulty: 'normal', seed: 314 }); sp.clearEvents(); const s = sp.state(); s.calendar.slot = 0; s.life.energy = 100; s.hero.fatigue = 0; s.hero.injury = null; sp.navigate('training') })()`)
  const card = page.locator('.trn-session', { hasText: 'Distribution & Claiming' })
  await card.getByRole('button', { name: 'Play drill' }).click()
  const overlay = page.locator('.trn-drill')
  await expect(overlay.locator('.trn-drill-card h2')).toHaveText('Distribution & Claiming')
  await assertCleanText(page)
  await shot('t6-distribution-intro')
  await overlay.getByRole('button', { name: 'Start' }).click()
  await expect(overlay.locator('canvas')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(6500)
  await shot('t6-distribution-play')
  const result = overlay.locator('.trn-drill-result')
  for (let i = 0; i < 40 && !(await result.isVisible()); i++) {
    await page.keyboard.press('Space')
    await page.waitForTimeout(900)
  }
  await expect(result).toBeVisible({ timeout: 30_000 })
  await expect(result.locator('.trn-grade')).toHaveText(/^[SABCD]$/)
  await result.getByRole('button', { name: 'Done' }).click()
  await expect(overlay).toHaveCount(0)
})

test('quitting a drill cancels the session', async ({ page }) => {
  await openTraining(page)
  await page.locator('.trn-session', { hasText: 'Dribbling Course' }).getByRole('button', { name: 'Play drill' }).click()
  await page.locator('.trn-drill').getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.trn-drill canvas')).toBeVisible({ timeout: 20_000 })
  await page.locator('.trn-drill-quit').click()
  await expect(page.locator('.trn-drill')).toHaveCount(0)
  expect(await sp<number>(page, 'sp.state().life.energy')).toBe(100)
})

test('trainer tab hires the offered trainer by name', async ({ page, shot }) => {
  await openTraining(page)
  await sp(page, `(() => { sp.state().life.money = 500000 })()`)
  await page.getByRole('tab', { name: /Trainer/ }).click()
  const offer = page.locator('.trn-offer').first()
  const name = (await offer.locator('h3').innerText()).trim()
  await offer.getByRole('button', { name: 'Hire' }).click()
  await expect(page.locator('.trn-trainer-current')).toContainText(name)
  expect(await sp<string>(page, 'sp.state().life.trainer.name')).toBe(name)
  await assertCleanText(page)
  await shot('t5-trainer')
})

/** A session card by its exact title (descriptions mention other sessions' names). */
const sessionCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.trn-session').filter({ has: page.getByRole('heading', { name, exact: true }) })

test('every attribute has a session: the new sessions list numbered XP per attribute and the role’s development areas', async ({ page, shot }) => {
  await openTraining(page)
  for (const name of ['Explosive Starts', 'Core & Contact', 'Switch of Play', 'Reading the Game', 'Pressing Drill', 'Captaincy & Team Talk']) {
    await expect(sessionCard(page, name)).toHaveCount(1)
  }
  await expect(page.getByTestId('dev-focus')).toBeVisible()
  const gains = sessionCard(page, 'Explosive Starts').locator('.trn-gain')
  await expect(gains.first()).toContainText(/Acceleration/)
  await expect(gains.first()).toContainText(/\+\d+\.\d XP/)
  expect(await page.locator('.trn-gain.is-weak').count()).toBeGreaterThan(0)
  // Captaincy is a talk, not a ball drill: auto only.
  await expect(sessionCard(page, 'Captaincy & Team Talk').getByRole('button', { name: 'Do session' })).toBeVisible()
  await assertCleanText(page)
  await shot('t5-attr-sessions')
  for (const [session, drill] of [['Reading the Game', 'Piggy in the Middle'], ['Pressing Drill', 'Pressing Square'], ['Switch of Play', 'Switch of Play'], ['Core & Contact', 'Shoulder Charge']]) {
    await sessionCard(page, session).getByRole('button', { name: 'Play drill' }).click()
    const overlay = page.locator('.trn-drill')
    await expect(overlay.locator('.trn-drill-card h2')).toHaveText(drill)
    await assertCleanText(page)
    await overlay.getByRole('button', { name: 'Cancel' }).click()
    await expect(overlay).toHaveCount(0)
  }
})

test('play explosive starts with the keyboard: go on the light, graded result, acceleration XP', async ({ page, shot }) => {
  await openTraining(page)
  const xp0 = await sp<number>(page, 'sp.state().hero.attrs.acceleration + (sp.state().hero.attrXp.acceleration ?? 0)')
  await sessionCard(page, 'Explosive Starts').getByRole('button', { name: 'Play drill' }).click()
  const overlay = page.locator('.trn-drill')
  await expect(overlay.locator('.trn-drill-card h2')).toHaveText('Off the Light')
  await overlay.getByRole('button', { name: 'Start' }).click()
  await expect(overlay.locator('canvas')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(3000) // countdown
  const result = overlay.locator('.trn-drill-result')
  // Tap Space every 0.4 s while holding Shift (drive): some false starts, many starts, dips at the line.
  await page.keyboard.down('Shift')
  for (let i = 0; i < 120 && !(await result.isVisible()); i++) {
    await page.keyboard.press('Space')
    if (i === 12) await shot('t6-sprint-live')
    await page.waitForTimeout(400)
  }
  await page.keyboard.up('Shift')
  await expect(result).toBeVisible({ timeout: 30_000 })
  await expect(result.locator('.trn-grade')).toHaveText(/^[SABCD]$/)
  await expect(result).toContainText(/\+\d+ XP/)
  await result.getByRole('button', { name: 'Done' }).click()
  await expect(overlay).toHaveCount(0)
  expect(await sp<number>(page, 'sp.state().hero.attrs.acceleration + (sp.state().hero.attrXp.acceleration ?? 0)')).toBeGreaterThan(xp0)
})
