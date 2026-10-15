/** Top-bar bell: a red dot for unread headlines, cleared by opening the inbox (playtest request). */
import { test, expect, preferEnglish, waitForApp, sp } from './fixtures'

test('unread headlines show a dot on the bell until the inbox is opened', async ({ page }) => {
  await preferEnglish(page)
  await page.goto('/?autostart=1&seed=99&storage=memory')
  await waitForApp(page)
  await sp(page, 'sp.clearEvents()')
  await sp(page, 'sp.navigate("inbox")')
  await expect(page.getByTestId('bell-unread')).toHaveCount(0)
  await sp(page, `sp.navigate('home', undefined, { tab: true })`)
  await sp(page, `(() => {
    const s = sp.state(), c = s.calendar
    s.life.news.push({ id: 'e2e-news', season: c.season, week: c.week, headline: { tr: 'Haber', en: 'Headline' }, source: 'e2e', sentiment: 0 })
    sp.touch()
  })()`)
  const bell = page.locator('.topbar-bell')
  await expect(page.getByTestId('bell-unread')).toBeVisible()
  await expect(bell).toHaveAttribute('aria-label', 'News: 1 unread')
  await bell.click()
  await expect(page.locator('#main')).toContainText('Headline')
  await expect(page.getByTestId('bell-unread')).toHaveCount(0)
})
