import { expect, test, type Page } from '@playwright/test';
import { addBlock, choose } from './helpers';

// Line and shape (Plan.md F1): a new line, its thickness in the short menu, and a shape turned into an ellipse.

test.use({ viewport: { width: 1440, height: 900 } });

async function openEditor(page: Page): Promise<void> {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    // A fresh slide, so nothing else stands on the stage.
    await page.getByTestId('add-slide').click();
}

function chip(page: Page, name: string | RegExp) {
    return page.getByTestId('quick-menu').getByTestId('quick-chip').and(page.getByLabel(name));
}

test('a line comes in with two handles and gets thicker from the short menu', async ({ page }) => {
    await openEditor(page);
    await addBlock(page, 'line');
    await expect(page.getByTestId('frame-line')).toBeVisible();
    await expect(page.locator('.frame--selected .handle')).toHaveCount(2);

    const stroke = page.locator('.editor-stage .block--line .line');
    const before = (await stroke.boundingBox())!.height;
    await chip(page, /^Stärke/).click();
    const field = page.getByTestId('quick-popover').getByTestId('line-thickness');
    await field.fill('24');
    await field.blur();
    await expect.poll(async () => (await stroke.boundingBox())!.height).toBeGreaterThan(before * 2);
});

test('a shape turned into an ellipse is drawn with 50 % rounding', async ({ page }) => {
    await openEditor(page);
    await addBlock(page, 'shape');
    await chip(page, /^Form/).click();
    await choose(page.getByTestId('quick-popover'), 'shape-form', 'ellipse');
    await expect(page.locator('.editor-stage .block--shape .fill')).toHaveCSS('border-radius', '50%');
    // The corners make no sense on an ellipse.
    await expect(chip(page, /^Ecken/)).toHaveCount(0);
});
