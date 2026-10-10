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

/** Drags the rotate handle a quarter turn clockwise, at the same distance from the middle – wherever it stands. */
async function turnQuarter(page: Page): Promise<void> {
    const handle = (await page.getByTestId('handle-rotate').boundingBox())!;
    const frame = (await page.locator('.frame--selected').boundingBox())!;
    const from = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
    const middle = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
    const radius = middle.y - from.y;
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(middle.x + radius / 2, middle.y - radius / 2, { steps: 4 });
    await page.mouse.move(middle.x + radius, middle.y, { steps: 4 });
    await expect(page.getByTestId('frame-size')).toHaveText('90°');
    await page.mouse.up();
}

test('the rotate handle turns the block by 90°, one step undoes it, and "Drehen zurücksetzen" resets it', async ({ page }) => {
    await openEditor(page);
    await addBlock(page, 'shape');
    await expect(page.locator('.frame--selected .handle')).toHaveCount(8);
    await turnQuarter(page);
    await expect(page.locator('.frame--selected')).toHaveCSS('transform', /matrix\(/);

    await page.getByTestId('section-frame-look-toggle').click();
    await expect(page.getByTestId('inspector-rotation')).toHaveValue('90');

    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.getByTestId('inspector-rotation')).toHaveValue('0');

    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(page.getByTestId('inspector-rotation')).toHaveValue('90');
    await page.getByTestId('quick-more').click();
    await page.getByTestId('quick-reset-rotation').click();
    await expect(page.getByTestId('inspector-rotation')).toHaveValue('0');
    await page.getByTestId('quick-more').click();
    await expect(page.getByTestId('quick-reset-rotation')).toHaveCount(0);
});

test.describe('at a tablet', () => {
    test.use({ hasTouch: true, viewport: { width: 1366, height: 1024 } });

    test('the short menu keeps clear of the rotate handle of a flat block', async ({ page }) => {
        await openEditor(page);
        await addBlock(page, 'line');
        // Flat for a finger: the handles stand outside, the rotate handle higher up (user at the iPad, 2026-10-10).
        await expect(page.locator('.frame--selected')).toHaveClass(/frame--tight/);
        const handle = (await page.getByTestId('handle-rotate').boundingBox())!;
        const menu = (await page.getByTestId('quick-menu').boundingBox())!;
        const apart = menu.y + menu.height <= handle.y || handle.y + handle.height <= menu.y;
        expect(apart).toBe(true);
    });
});
