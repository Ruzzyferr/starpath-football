/** Visual QA + axe of the double-marked chip, the teammate baseline marker and the owner documentary/HoF, in both themes. */
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { test, expect, waitForApp, sp } from './fixtures'

async function serious(page: Page) {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
}

for (const theme of ['dark', 'light'] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((th) => localStorage.setItem('starpath.settings.v1', JSON.stringify({ lang: 'en', vibration: false, theme: th })), theme)
    })

    test('pre-match double-marked chip', async ({ page, shot }) => {
      await page.goto('/?autostart=1&seed=2720&dev=casino')
      await waitForApp(page)
      await sp(page, `(() => { sp.clearEvents(); const s = sp.state(); s.hero.seasonStats = { ...(s.hero.seasonStats ?? {}), apps: 10, goals: 14, assists: 2 }; })()`)
      const ready = await sp<boolean>(page, `(() => {
        for (let i = 0; i < 80; i++) {
          const fx = sp.data.nextFixture()
          if (fx && fx.daysUntil === 0 && sp.state().calendar.slot >= 1) return true
          sp.actions.advanceToMatch()
          sp.clearEvents()
        }
        return false
      })()`)
      expect(ready).toBe(true)
      await sp(page, `(() => { const s = sp.state(); s.hero.seasonStats = { ...(s.hero.seasonStats ?? {}), apps: 10, goals: 14, assists: 2 }; sp.clearEvents(); sp.actions.playMatch(); sp.navigate('preMatch') })()`)
      await expect(page.getByTestId('pm-marked')).toBeVisible()
      await page.getByTestId('pm-marked').scrollIntoViewIfNeeded()
      await page.waitForTimeout(5000)
      await shot(`qa-premarked-${theme}`)
      expect(await serious(page)).toEqual([])
    })

    test('relationships baseline marker', async ({ page, shot }) => {
      await page.goto('/?autostart=1&dev=casino&seed=31337')
      await waitForApp(page)
      await sp(page, 'sp.clearEvents()')
      await sp(page, `sp.navigate('life')`)
      await sp(page, `(() => { for (const r of Object.values(sp.state().life.relationships)) if (r.kind === 'teammate') r.baseline = 40 })()`)
      await page.getByTestId('phone-app-relations').click()
      await expect(page.locator('.ph-app-view')).toHaveAttribute('data-app', 'relations')
      await expect(page.getByTestId('rel-baseline').first()).toBeVisible()
      await page.getByTestId('rel-baseline').first().scrollIntoViewIfNeeded()
      await page.waitForTimeout(5000)
      await shot(`qa-baseline-${theme}`)
      expect(await serious(page)).toEqual([])
    })

    test('owner documentary and Hall of Fame badge', async ({ page, shot }) => {
      await page.goto('/?autostart=1&seed=2719')
      await waitForApp(page)
      await sp(page, `(() => { const s = sp.state(); s.hero.birthYear = s.calendar.season - 35; s.life.flags['proj:stake'] = 60; s.life.flags['proj:stakeClub'] = s.hero.contract.clubId; sp.actions.planSlot(0, null); sp.navigate('profile', undefined, { tab: true }) })()`)
      await page.getByTestId('profile-retire').click()
      await page.getByTestId('retire-go').click()
      await page.getByTestId('retire-confirm').click()
      await expect(page.getByTestId('doc-owner')).toBeVisible({ timeout: 20_000 })
      await page.getByTestId('doc-owner').scrollIntoViewIfNeeded()
      await page.waitForTimeout(5000)
      await shot(`qa-doc-owner-${theme}`)
      expect(await serious(page)).toEqual([])
      await page.getByRole('button', { name: 'Hall of Fame' }).click()
      await expect(page.getByTestId('hof-owner')).toBeVisible()
      await page.waitForTimeout(5000)
      await shot(`qa-hof-owner-${theme}`)
      expect(await serious(page)).toEqual([])
    })
  })
}
