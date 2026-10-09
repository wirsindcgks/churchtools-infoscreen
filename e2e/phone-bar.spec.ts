import { expect, test, type Page } from '@playwright/test';
import { openInspector, openSlides } from './helpers';

// The bar at the bottom of a phone (Plan.md 79, C2): the slide or the chosen block, in one place.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

async function openEditor(page: Page): Promise<void> {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('save-status')).toHaveText('Alles gespeichert');
}

/** The stage lies whole in the window and no bar covers any of it. */
async function expectStageClear(page: Page): Promise<void> {
    const [stage, bar] = await Promise.all([page.locator('.editor-stage .stage').first().boundingBox(), page.getByTestId('phone-bar').boundingBox()]);
    expect(stage!.y).toBeGreaterThanOrEqual(0);
    expect(stage!.y + stage!.height).toBeLessThanOrEqual(bar!.y + 1);
}

test('without a block the bar shows the slide; nothing stands above the stage any more', async ({ page }) => {
    await openEditor(page);
    const bar = page.getByTestId('phone-bar');
    await expect(bar).toBeVisible();
    await expect(page.getByTestId('phone-slides')).toContainText('Folie 1 von 3');
    await expect(bar.getByTestId('add-block-menu')).toBeVisible();
    await expect(bar.getByTestId('phone-slide-more')).toBeVisible();
    // The row of slides, "+ Baustein" and the guides above the stage are gone.
    await expect(page.getByTestId('slide-item')).toHaveCount(0);
    await expect(page.getByTestId('slides-toggle')).toHaveCount(0);
    await expect(page.getByTestId('add-block-menu')).toHaveCount(1);
    await page.screenshot({ path: 'test-results/c2-phone-slide.png' });
    await expect(page.getByTestId('grid-size')).toHaveCount(0);
    const [notice, stage] = await Promise.all([page.getByTestId('demo-notice-editor').boundingBox(), page.locator('.editor-stage').boundingBox()]);
    expect(stage!.y - (notice!.y + notice!.height)).toBeLessThanOrEqual(12); // the stage follows right on
    // The bar is 56 px (plus the safe area), white, at the bottom edge.
    const box = (await bar.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(56);
    expect(Math.round(box.y + box.height)).toBe(844);
    await expectStageClear(page);
});

test('choosing a block shows its menu in the bar; the big sheet stays shut and the stage whole', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('frame-text').first().tap();
    const bar = page.getByTestId('phone-bar');
    const menu = bar.getByTestId('quick-menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByTestId('quick-kind')).toHaveAttribute('aria-label', 'Text');
    await expect(menu.getByTestId('quick-chip').first()).toBeVisible();
    await expect(page.getByTestId('inspector-sheet')).toBeHidden();
    await expect(page.getByTestId('inspector-sheet-toggle')).toBeHidden();
    await expectStageClear(page);
    // Every button of the bar is at least a fingertip.
    for (const id of ['quick-duplicate', 'quick-delete', 'quick-more']) {
        const b = (await menu.getByTestId(id).boundingBox())!;
        expect(b.width).toBeGreaterThanOrEqual(44);
        expect(b.height).toBeGreaterThanOrEqual(44);
    }
    for (const chip of await menu.getByTestId('quick-chip').all()) expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const full = (await bar.boundingBox())!;
    expect(full.x + full.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: 'test-results/c2-phone-block.png' });
});

test('the left button of the bar lets go of the block and shows the slide again', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('frame-text').first().tap();
    const bar = page.getByTestId('phone-bar');
    const back = bar.getByTestId('phone-back-to-slide');
    await expect(back).toHaveAttribute('aria-label', 'Zurück zur Folie');
    await expect(back).toContainText('Folie 1 von 3');
    expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(bar.getByTestId('phone-slides')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/c3-phone-back.png' });
    await back.tap();
    await expect(bar.getByTestId('phone-slides')).toBeVisible();
    await expect(bar.getByTestId('quick-menu')).toHaveCount(0);
});

test('a field opens as a sheet from below over the bar; a tap beside, a swipe down or Escape closes it', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('frame-text').first().tap();
    const menu = page.getByTestId('phone-bar').getByTestId('quick-menu');
    const chip = menu.getByTestId('quick-chip').first();
    const popover = page.getByTestId('quick-popover');

    await chip.tap();
    await expect(popover).toBeVisible();
    const box = (await popover.boundingBox())!;
    const bar = (await page.getByTestId('phone-bar').boundingBox())!;
    expect(box.x).toBe(0);
    expect(box.width).toBe(390);
    expect(Math.round(box.y + box.height)).toBe(Math.round(bar.y));
    expect(box.height).toBeLessThanOrEqual(844 * 0.6 + 1);
    await expect(popover).toHaveAttribute('aria-label', /.+/);
    const grip = (await page.locator('.quick-sheet-grip').boundingBox())!;
    expect(Math.round(grip.width)).toBe(36);
    expect(Math.round(grip.height)).toBe(4);
    await page.screenshot({ path: 'test-results/c2-phone-field.png' });
    // The block stays chosen and the big sheet shut.
    await expect(page.getByTestId('inspector-sheet')).toBeHidden();

    // A tap beside closes it – and only that.
    await page.mouse.click(195, 150);
    await expect(popover).toHaveCount(0);
    await expect(menu).toBeVisible();

    // Swipe down on the head.
    await chip.tap();
    await expect(popover).toBeVisible();
    const head = (await page.getByTestId('quick-sheet-grip').boundingBox())!;
    await page.mouse.move(head.x + head.width / 2, head.y + 10);
    await page.mouse.down();
    await page.mouse.move(head.x + head.width / 2, head.y + 40, { steps: 4 });
    await page.mouse.up();
    await expect(popover).toBeVisible(); // 30 px are not enough
    await page.mouse.move(head.x + head.width / 2, head.y + 10);
    await page.mouse.down();
    await page.mouse.move(head.x + head.width / 2, head.y + 90, { steps: 6 });
    await page.mouse.up();
    await expect(popover).toHaveCount(0);

    // Escape; and only one field at a time.
    await chip.tap();
    await expect(popover).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popover).toHaveCount(0);
    await expect(menu).toBeVisible();
    await chip.tap();
    await menu.getByTestId('quick-chip').nth(1).tap();
    await expect(popover).toHaveCount(1);
});

test('"⋯ → Alle Einstellungen" opens the big sheet, which closes with its own button', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('frame-text').first().tap();
    const bar = page.getByTestId('phone-bar');
    await bar.getByTestId('quick-more').tap();
    await expect(bar.getByTestId('quick-lock')).toBeVisible();
    await bar.getByTestId('quick-all-settings').tap();
    const sheet = page.getByTestId('inspector-sheet');
    await expect(sheet).toHaveClass(/open/);
    await expect(page.getByTestId('block-inspector')).toBeVisible();
    await expect(page.getByTestId('inspector-sheet-toggle')).toBeHidden();
    await expect(page.getByTestId('phone-bar')).toHaveCount(0);
    await page.getByTestId('inspector-sheet-close').tap();
    await expect(sheet).toBeHidden();
    await expect(page.getByTestId('phone-bar').getByTestId('quick-menu')).toBeVisible();
});

test('a locked block shows only its symbol and "⋯", with Entsperren inside', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('frame-text').first().tap();
    const bar = page.getByTestId('phone-bar');
    await bar.getByTestId('quick-more').tap();
    await bar.getByTestId('quick-lock').tap();
    await expect(bar.getByTestId('quick-chip')).toHaveCount(0);
    await expect(bar.getByTestId('quick-duplicate')).toHaveCount(0);
    await expect(bar.getByTestId('quick-kind')).toBeVisible();
    await bar.getByTestId('quick-more').tap();
    await expect(bar.getByTestId('quick-lock')).toHaveText('Entsperren');
    await expect(bar.getByTestId('quick-copy')).toBeVisible();
    await expect(bar.getByTestId('quick-all-settings')).toBeVisible();
    await bar.getByTestId('quick-lock').tap();
    await expect(bar.getByTestId('quick-chip').first()).toBeVisible();
});

test('the slide\'s "⋯" holds its settings, duplicate, remove and the guides', async ({ page }) => {
    await openEditor(page);
    const bar = page.getByTestId('phone-bar');
    await bar.getByTestId('phone-slide-more').tap();
    await expect(page.getByTestId('paste-block')).toHaveCount(0); // nothing copied yet
    await expect(page.getByTestId('grid-size')).toBeVisible();
    await page.getByTestId('slide-duplicate-phone').tap();
    await expect(page.getByTestId('phone-slides')).toContainText('von 4');
    await bar.getByTestId('phone-slide-more').tap();
    await page.getByTestId('slide-remove-phone').tap();
    await expect(page.getByTestId('confirm-dialog')).toContainText('aus dieser Präsentation entfernen?');
    await page.getByTestId('confirm-ok').tap();
    await expect(page.getByTestId('phone-slides')).toContainText('von 3');
    await openInspector(page);
    await expect(page.getByTestId('slide-inspector')).toBeVisible();
});

test('"Folie 1 von 3" opens the sheet of slides; a tap on a slide chooses it and closes the sheet', async ({ page }) => {
    await openEditor(page);
    const sheet = await openSlides(page);
    await expect(sheet.getByTestId('slide-item')).toHaveCount(3);
    await expect(sheet.getByTestId('slide-duration').first()).toBeVisible();
    const first = (await sheet.getByTestId('slide-item').nth(0).boundingBox())!;
    const second = (await sheet.getByTestId('slide-item').nth(1).boundingBox())!;
    expect(second.x).toBeGreaterThan(first.x + first.width - 1); // two columns
    expect(Math.abs(second.y - first.y)).toBeLessThanOrEqual(1);
    await expect(sheet.getByTestId('add-slide')).toBeVisible();
    await expect(sheet.getByTestId('import-slides')).toBeVisible();
    await sheet.getByTestId('slide-item').nth(1).tap();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId('phone-slides')).toContainText('Folie 2 von 3');
    // The sheet closes with its button and with Escape, too.
    await openSlides(page);
    await page.getByTestId('slides-sheet-close').tap();
    await expect(page.getByTestId('slides-sheet')).toHaveCount(0);
    await openSlides(page);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('slides-sheet')).toHaveCount(0);
    // A new slide is added from the sheet.
    const again = await openSlides(page);
    await again.getByTestId('add-slide').tap();
    await expect(page.getByTestId('phone-slides')).toContainText('von 4');
});
