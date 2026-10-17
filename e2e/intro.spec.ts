import { expect, test, type Page } from '@playwright/test';

// The other tests start with the card marked as seen (playwright.config.ts); these start fresh (Plan.md 81).
test.use({ viewport: { width: 1440, height: 900 }, storageState: { cookies: [], origins: [] } });

async function openEditor(page: Page): Promise<void> {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
}

test('the card shows on first opening, "Nicht jetzt" closes it and a reload keeps it away', async ({ page }) => {
    await openEditor(page);
    await expect(page.getByTestId('intro-card')).toBeVisible();
    await page.getByTestId('intro-later').click();
    await expect(page.getByTestId('intro-card')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await expect(page.getByTestId('intro-card')).toHaveCount(0);
});

test('the tour walks through the steps, back goes one, "Fertig" closes, Escape closes midway, nothing changes', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('intro-start').click();
    await expect(page.getByTestId('intro-card')).toHaveCount(0);
    const tour = page.getByTestId('intro-tour');
    await expect(tour).toBeVisible();
    await expect(page.getByTestId('intro-step')).toHaveText('Schritt 1 von 6');
    await expect(page.getByTestId('intro-back')).toBeDisabled();
    await page.getByTestId('intro-next').click();
    await page.getByTestId('intro-next').click();
    await expect(page.getByTestId('intro-step')).toHaveText('Schritt 3 von 6');
    await page.getByTestId('intro-back').click();
    await expect(page.getByTestId('intro-step')).toHaveText('Schritt 2 von 6');
    for (const n of [3, 4, 5, 6]) {
        await page.getByTestId('intro-next').click();
        await expect(page.getByTestId('intro-step')).toHaveText(`Schritt ${n} von 6`);
    }
    await expect(page.getByTestId('intro-next')).toHaveText('Fertig');
    await page.getByTestId('intro-next').click();
    await expect(tour).toHaveCount(0);

    await page.getByTestId('shortcuts').click();
    await page.getByTestId('help-intro').click();
    await expect(tour).toBeVisible();
    await page.getByTestId('intro-next').click();
    await page.keyboard.press('Escape');
    await expect(tour).toHaveCount(0);

    await page.getByTestId('shortcuts').click();
    await page.getByTestId('help-intro').click();
    await page.getByTestId('intro-close').click();
    await expect(tour).toHaveCount(0);

    await expect(page.getByTestId('save-status')).toHaveText('Alles veröffentlicht');
    await expect(page.getByTestId('unpublished-flag')).toHaveCount(0);
});

test('the "?" offers the shortcuts and the introduction', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('intro-card-close').click();
    await expect(page.getByTestId('intro-card')).toHaveCount(0);
    await page.getByTestId('shortcuts').click();
    await expect(page.getByTestId('help-shortcuts')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('help-shortcuts')).toHaveCount(0);
    await page.getByTestId('shortcuts').click();
    await page.getByTestId('help-intro').click();
    await expect(page.getByTestId('intro-tour')).toBeVisible();
    await expect(page.getByTestId('intro-step')).toHaveText('Schritt 1 von 6');
});

test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('there is no card and the "?" key opens the shortcuts directly', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('save-status')).toBeVisible();
        await expect(page.getByTestId('intro-card')).toHaveCount(0);
        // The "?" button is hidden below 48rem (PlaylistEditor.vue); its key still works.
        await page.keyboard.press('?');
        await expect(page.getByTestId('shortcuts-dialog')).toBeVisible();
        await expect(page.getByTestId('help-intro')).toHaveCount(0);
    });
});
