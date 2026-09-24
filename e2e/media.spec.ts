import fs from 'node:fs';
import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

// Writes to the wiki category "Infoscreen" of the test instance and cleans up after itself.
test('upload an image, place it, and get warned before deleting it', async ({ page }, info) => {
    // A unique name per run: browsers run in parallel against the same wiki page.
    const name = `e2e-${info.project.name}-${Date.now()}.png`;
    page.on('dialog', (dialog) => void dialog.accept());
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);

    await page.getByTestId('add-image').click();
    await page.getByTestId('pick-image').click();
    await expect(page.getByTestId('media-library')).toBeVisible();
    await page.getByTestId('media-upload').setInputFiles({
        name,
        mimeType: 'image/png',
        buffer: fs.readFileSync('e2e/assets/testbild.png'),
    });

    // A single upload is chosen right away and shows on the stage.
    await expect(page.getByTestId('media-library')).toBeHidden({ timeout: 20_000 });
    const onStage = page.locator('.editor-stage img').first();
    await expect(onStage).toBeVisible();
    expect(await onStage.getAttribute('src')).toMatch(/\/images\/\d+\/.+w=\d+&h=\d+/);
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'test-results/media-placed.png' });

    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Gespeichert');

    // Delete it again: the usage warning appears (accepted above), then the image is gone.
    await page.getByTestId('pick-image').click();
    const mine = page.getByTestId('media-item').filter({ hasText: name });
    await expect(mine).toHaveCount(1);
    await page.screenshot({ path: 'test-results/media-library.png' });
    await mine.getByRole('button', { name: 'Löschen' }).click();
    await expect(mine).toHaveCount(0, { timeout: 20_000 });
});
