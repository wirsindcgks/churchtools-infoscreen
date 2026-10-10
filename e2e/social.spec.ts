import { expect, test } from '@playwright/test';
import { addBlock } from './helpers';

// The social media block (Plan.md 80): a link from the short menu gives its mark and its name on the stage.

test.use({ viewport: { width: 1440, height: 900 } });

test('an Instagram link gives the mark and the name on the stage', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    // A fresh slide, so nothing else stands on the stage.
    await page.getByTestId('add-slide').click();

    await addBlock(page, 'social');
    await page.getByTestId('quick-menu').getByTestId('quick-chip').and(page.getByLabel(/^Profile/)).click();
    const field = page.getByTestId('quick-popover').getByTestId('social-add');
    await field.fill('https://www.instagram.com/wirsindcgks/');
    await field.press('Enter');

    const block = page.locator('.editor-stage .block--social');
    await expect(block.getByTestId('social-mark-instagram')).toBeVisible();
    await expect(block.getByTestId('social-name')).toHaveText('wirsindcgks');
});
