import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });

test('"Über & Neuigkeiten" shows the version and the changelog, and clears its dot once opened', async ({ page }) => {
    await page.goto('./');
    await page.evaluate(() => window.localStorage.removeItem('infoscreen-designer:seen-release'));
    await page.reload();
    await expect(page.getByTestId('about-new')).toBeVisible();

    await page.getByTestId('sidebar-about').click();
    await expect(page).toHaveURL(/\/ueber$/);
    await expect(page.getByTestId('about-heading')).toHaveText('Über & Neuigkeiten');
    await expect(page.getByTestId('about-version')).toHaveText(/^\d+\.\d+\.\d+/);
    const first = page.getByTestId('about-release').first();
    await expect(first.locator('li').first()).toBeVisible();
    // Bold stays bold, links open on GitHub – no markdown shows through.
    await expect(first.locator('strong').first()).toBeVisible();
    await expect(first).not.toContainText('**');
    await expect(page.getByTestId('about-new')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/about.png', fullPage: true });

    // It stays cleared on the next visit.
    await page.reload();
    await expect(page.getByTestId('about-heading')).toBeVisible();
    await expect(page.getByTestId('about-new')).toHaveCount(0);
});
