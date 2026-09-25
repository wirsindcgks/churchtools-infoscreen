import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

test('a new notice: empty text blocks saving, the preview shows it once typed, playlists are preselected (Plan.md 34)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('sidebar-notices').click();
    await expect(page.getByTestId('notices-heading')).toBeVisible();
    await expect(page.getByText('Gerade läuft kein Hinweis.')).toBeVisible();
    await page.screenshot({ path: 'test-results/notices-page.png' });

    await page.getByTestId('new-notice').click();
    const dialog = page.getByTestId('notice-dialog');
    await expect(dialog).toBeVisible();

    // Nothing typed yet – there is nothing to show on the TVs.
    await expect(dialog.getByTestId('notice-save')).toBeDisabled();

    await dialog.getByTestId('banner-text').fill('Heute Parkplatz gesperrt – bitte in der Schulstraße parken');
    await expect(dialog.getByTestId('notice-preview').getByTestId('banner')).toContainText('Parkplatz gesperrt');
    // The demo screen shows the demo playlist – it starts checked.
    await expect(dialog.getByTestId('notice-playlist-demo-playlist')).toBeChecked();
    await expect(dialog.getByTestId('notice-save')).toBeEnabled();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/notices-dialog.png' });

    // Close without saving: nothing is written.
    page.once('dialog', (d) => d.accept());
    await dialog.getByTestId('notice-cancel').click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Gerade läuft kein Hinweis.')).toBeVisible();
});
