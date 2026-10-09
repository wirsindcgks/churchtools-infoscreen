import { expect, test, type Page } from '@playwright/test';
import { addBlock } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

/** The chip of a field in the short menu by its name for a screen reader: "Farbe", or "Ecken: Ecken 0 px" for the start of it. */
function chip(page: Page, name: string | RegExp) {
    return page.getByTestId('quick-menu').getByTestId('quick-chip').and(page.getByLabel(name));
}

/** The editor with the first demo screen's playlist open. */
async function openEditor(page: Page): Promise<void> {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    // A fresh slide, so nothing else stands on the stage.
    await page.getByTestId('add-slide').click();
}

test('the short menu stands above the chosen block and is gone while it is dragged (Plan.md 79, C1)', async ({ page }) => {
    await openEditor(page);
    await addBlock(page, 'shape');
    const menu = page.getByTestId('quick-menu');
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('role', 'toolbar');
    await expect(menu).toHaveAttribute('aria-label', 'Kurzmenü: Fläche');
    const frame = page.getByTestId('frame-shape');
    const block = (await frame.boundingBox())!;
    const bar = (await menu.boundingBox())!;
    expect(bar.y + bar.height).toBeLessThanOrEqual(block.y);
    // Centred over the block.
    expect(Math.abs(bar.x + bar.width / 2 - (block.x + block.width / 2))).toBeLessThan(2);

    await page.mouse.move(block.x + block.width / 2, block.y + block.height / 2);
    await page.mouse.down();
    await page.mouse.move(block.x + block.width / 2 + 60, block.y + block.height / 2 + 30, { steps: 5 });
    await expect(menu).toHaveCount(0);
    await page.mouse.up();
    await expect(menu).toBeVisible();
    const moved = (await frame.boundingBox())!;
    expect(moved.x).toBeGreaterThan(block.x + 40);
    const after = (await menu.boundingBox())!;
    expect(Math.abs(after.x + after.width / 2 - (moved.x + moved.width / 2))).toBeLessThan(2);
});

test('nothing is chosen, no menu; a click on the empty stage takes it away (Plan.md 79, C1)', async ({ page }) => {
    await openEditor(page);
    await expect(page.getByTestId('quick-menu')).toHaveCount(0);
    await addBlock(page, 'shape');
    await expect(page.getByTestId('quick-menu')).toBeVisible();
    await page.getByTestId('grid').click({ position: { x: 5, y: 5 } });
    await expect(page.getByTestId('quick-menu')).toHaveCount(0);
});

test('duplicate and lock from the short menu; locked, only unlock and "⋯" are left (Plan.md 79, C1)', async ({ page }) => {
    await openEditor(page);
    await addBlock(page, 'shape');
    await expect(page.getByTestId('frame-shape')).toHaveCount(1);
    await page.getByTestId('quick-duplicate').click();
    await expect(page.getByTestId('frame-shape')).toHaveCount(2);

    const menu = page.getByTestId('quick-menu');
    await expect(menu.getByTestId('quick-lock')).toHaveAttribute('aria-pressed', 'false');
    await menu.getByTestId('quick-lock').click();
    await expect(menu.getByTestId('quick-lock')).toHaveAttribute('aria-pressed', 'true');
    await expect(menu.getByTestId('quick-more')).toBeVisible();
    await expect(menu.getByTestId('quick-duplicate')).toHaveCount(0);
    await expect(menu.getByTestId('quick-delete')).toHaveCount(0);
    await expect(menu.getByTestId('quick-chip')).toHaveCount(0);
    await menu.getByTestId('quick-more').click();
    const list = page.getByTestId('quick-more-list');
    await expect(list.getByRole('menuitem')).toHaveCount(2);
    await expect(list.getByTestId('quick-copy')).toBeVisible();
    await expect(list.getByTestId('quick-all-settings')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    // Escape closed the list only: the block is still chosen.
    await expect(menu).toBeVisible();

    await menu.getByTestId('quick-lock').click();
    await expect(menu.getByTestId('quick-delete')).toBeVisible();
    await menu.getByTestId('quick-delete').click();
    await expect(page.getByTestId('frame-shape')).toHaveCount(1);
});

test('the list behind "⋯" copies, pastes and layers (Plan.md 79, C1)', async ({ page }) => {
    await openEditor(page);
    await addBlock(page, 'shape');
    await addBlock(page, 'clock');
    const menu = page.getByTestId('quick-menu');
    await menu.getByTestId('quick-more').click();
    await expect(page.getByTestId('quick-paste')).toBeDisabled();
    await page.getByTestId('quick-copy').click();
    await expect(page.getByTestId('quick-more-list')).toHaveCount(0);
    await menu.getByTestId('quick-more').click();
    await expect(page.getByTestId('quick-paste')).toBeEnabled();
    await page.getByTestId('quick-paste').click();
    await expect(page.getByTestId('frame-clock')).toHaveCount(2);

    // The pasted clock is on top; "Ganz nach hinten" puts it below the shape.
    const order = () => page.getByTestId('grid').locator('[data-testid^="frame-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
    expect(await order()).toEqual(['frame-shape', 'frame-clock', 'frame-clock']);
    await menu.getByTestId('quick-more').click();
    await page.getByTestId('quick-layer-back').click();
    expect(await order()).toEqual(['frame-clock', 'frame-shape', 'frame-clock']);
});

test('the colour of a shape changes through its swatch, and one undo takes it back (Plan.md 79, C1)', async ({ page }) => {
    await openEditor(page);
    await addBlock(page, 'shape');
    const colour = chip(page, 'Farbe');
    const swatch = colour.locator('.quick-swatch');
    const before = await swatch.evaluate((el) => getComputedStyle(el).backgroundColor);
    await colour.click();
    const field = page.getByTestId('quick-popover');
    await expect(field).toBeVisible();
    await expect(colour).toHaveAttribute('aria-expanded', 'true');
    // Under the chip, in the host.
    const chipBox = (await colour.boundingBox())!;
    const fieldBox = (await field.boundingBox())!;
    expect(fieldBox.y).toBeGreaterThan(chipBox.y + chipBox.height);

    const hex = field.getByTestId('fill-color');
    await hex.fill('#112233');
    await expect(swatch).toHaveCSS('background-color', 'rgb(17, 34, 51)');
    // Escape closes the field and hands the focus back to the chip – the block stays chosen.
    await page.keyboard.press('Escape');
    await expect(field).toHaveCount(0);
    await expect(colour).toBeFocused();
    await expect(page.getByTestId('quick-menu')).toBeVisible();

    await page.keyboard.press('ControlOrMeta+z');
    await expect(swatch).toHaveCSS('background-color', before);
});

test('only one field is open, and a click beside it closes it (Plan.md 79, C1)', async ({ page }) => {
    await openEditor(page);
    await addBlock(page, 'shape');
    await chip(page, 'Farbe').click();
    await expect(page.getByTestId('quick-popover')).toHaveCount(1);
    await chip(page, /^Ecken/).click();
    await expect(page.getByTestId('quick-popover')).toHaveCount(1);
    await expect(page.getByTestId('quick-popover')).toHaveAttribute('aria-label', 'Ecken');
    // The first control has the focus.
    await expect(page.getByTestId('quick-popover').getByTestId('shape-corners')).toBeFocused();
    await page.getByTestId('grid').click({ position: { x: 5, y: 5 } });
    await expect(page.getByTestId('quick-popover')).toHaveCount(0);
});

test('"Alle Einstellungen" opens the folded inspector column and rolls to the block (Plan.md 79, C1)', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('desktop-inspector-collapse').click();
    await addBlock(page, 'shape');
    // A chosen block does not unfold the column at a desktop (Plan.md 45).
    await expect(page.getByTestId('block-inspector')).toBeHidden();
    await page.getByTestId('quick-more').click();
    await page.getByTestId('quick-all-settings').click();
    await expect(page.getByTestId('block-inspector')).toBeVisible();
    await expect(page.getByTestId('quick-more-list')).toHaveCount(0);
});

test('a double click on an empty image opens the library; so does the button on it (Plan.md 79, C5, C6)', async ({ page }) => {
    await openEditor(page);
    await addBlock(page, 'image');
    const button = page.getByTestId('empty-block-action');
    await expect(button).toHaveText('Bild wählen');
    await expect(button).toHaveAttribute('data-block-type', 'image');

    await page.getByTestId('frame-image').dblclick({ position: { x: 12, y: 12 } });
    await expect(page.getByTestId('media-library')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('media-library')).toHaveCount(0);

    await button.click();
    await expect(page.getByTestId('media-library')).toBeVisible();
});

test('a double click on the button of an empty image keeps the library open (Plan.md 79, C6)', async ({ page }) => {
    await openEditor(page);
    await addBlock(page, 'image');
    await page.getByTestId('empty-block-action').dblclick();
    await expect(page.getByTestId('media-library')).toBeVisible();
    // A single click beside the library still closes it.
    await page.getByTestId('media-library').evaluate((el) => (el.parentElement as HTMLElement).click());
    await expect(page.getByTestId('media-library')).toHaveCount(0);
});

test('a block covered in the middle has no button on it (Plan.md 79, C6)', async ({ page }) => {
    await openEditor(page);
    await addBlock(page, 'qr');
    await expect(page.getByTestId('empty-block-action')).toHaveCount(1);
    await addBlock(page, 'clock');
    await expect(page.getByTestId('empty-block-action')).toHaveCount(0);
});

test('Delete on a focused button of the menu does not remove the block (Plan.md 79, C1)', async ({ page }) => {
    await openEditor(page);
    await addBlock(page, 'shape');
    await page.getByTestId('quick-duplicate').focus();
    await page.keyboard.press('Delete');
    await page.keyboard.press('Backspace');
    await expect(page.getByTestId('frame-shape')).toHaveCount(1);
});

test('the button on an empty block leads to its first field; a double click does the same (Plan.md 79, C5, C6)', async ({ page }) => {
    await openEditor(page);
    await addBlock(page, 'web');
    await expect(page.getByTestId('empty-block-action')).toHaveText('Adresse eingeben');
    await page.getByTestId('empty-block-action').click();
    const field = page.getByTestId('quick-popover');
    await expect(field).toBeVisible();
    await expect(field.getByTestId('web-url')).toBeFocused();
    await field.getByTestId('web-url').fill('https://example.org');
    await field.getByTestId('web-url').press('Enter');
    await page.keyboard.press('Escape');
    // With an address the block is not empty any more: no button.
    await expect(page.getByTestId('empty-block-action')).toHaveCount(0);

    // A double click on the block opens the address again.
    await page.getByTestId('grid').click({ position: { x: 5, y: 5 } });
    await page.getByTestId('frame-web').dblclick({ position: { x: 12, y: 12 } });
    await expect(page.getByTestId('quick-popover').getByTestId('web-url')).toBeFocused();
});

test('a locked block has no button and does not react to a double click (Plan.md 79, C5, C6)', async ({ page }) => {
    await openEditor(page);
    await addBlock(page, 'image');
    await page.getByTestId('quick-lock').click();
    await expect(page.getByTestId('empty-block-action')).toHaveCount(0);
    await page.getByTestId('frame-image').dblclick({ position: { x: 12, y: 12 } });
    await expect(page.getByTestId('media-library')).toHaveCount(0);
    await expect(page.getByTestId('quick-popover')).toHaveCount(0);
});

test('the arrows hop between the buttons of the menu and do not move the block (Plan.md 79, C1)', async ({ page }) => {
    await openEditor(page);
    await addBlock(page, 'shape');
    const frame = page.getByTestId('frame-shape');
    const before = await frame.boundingBox();
    await page.getByTestId('quick-duplicate').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('quick-delete')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('quick-duplicate')).toBeFocused();
    expect(await frame.boundingBox()).toEqual(before);
});

test('a window narrower than 48rem has no short menu yet (Plan.md 79, C1; the phone bar comes with C2)', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 });
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await page.getByTestId('add-slide').click();
    await addBlock(page, 'shape');
    await expect(page.getByTestId('block-inspector')).toBeAttached();
    await expect(page.getByTestId('quick-menu')).toHaveCount(0);
});
