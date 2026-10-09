import { expect, test, type Locator, type Page } from '@playwright/test';
import { addBlock, openSection } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

/** Three shapes on a fresh slide, none touching another: a (200,200), b (800,200), c (1400,600) in stage pixels. */
async function openWithThree(page: Page): Promise<void> {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await page.getByTestId('add-slide').click();
    const places = [
        { x: 200, y: 200, width: 400, height: 200 },
        { x: 800, y: 200, width: 400, height: 200 },
        { x: 1400, y: 600, width: 300, height: 200 },
    ];
    for (const place of places) {
        await addBlock(page, 'shape');
        await openSection(page, 'measures');
        for (const [key, value] of Object.entries(place)) {
            await page.getByTestId(`inspector-${key}`).fill(String(value));
            await page.getByTestId(`inspector-${key}`).blur();
        }
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('.frame--selected')).toHaveCount(0);
}

const frames = (page: Page): Locator => page.getByTestId('frame-shape');
const selected = (page: Page): Locator => page.locator('.frame--selected');

/** A point of the stage (stage pixels) on the screen. */
async function onScreen(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
    const grid = (await page.getByTestId('grid').boundingBox())!;
    const scale = grid.width / 1920;
    return { x: grid.x + x * scale, y: grid.y + y * scale };
}

/** Draws the selection rectangle between two points of the stage. */
async function drawRect(page: Page, from: [number, number], to: [number, number], modifier?: 'Shift'): Promise<void> {
    const a = await onScreen(page, ...from);
    const b = await onScreen(page, ...to);
    if (modifier) await page.keyboard.down(modifier);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up();
    if (modifier) await page.keyboard.up(modifier);
}

async function lefts(page: Page): Promise<number[]> {
    return Promise.all([0, 1, 2].map(async (i) => (await frames(page).nth(i).boundingBox())!.x));
}

test('Shift-click adds a block to the choice and takes it out again; the head says "2 Bausteine" (Plan.md 79, D2, D5)', async ({ page }) => {
    await openWithThree(page);
    await frames(page).nth(0).click();
    await expect(page.locator('.handle')).toHaveCount(8);
    await frames(page).nth(1).click({ modifiers: ['Shift'] });
    await expect(selected(page)).toHaveCount(2);
    // A box around both, no handles; the inspector and the short menu name the number.
    await expect(page.getByTestId('selection-box')).toBeVisible();
    await expect(page.locator('.handle')).toHaveCount(0);
    await expect(page.getByTestId('multi-title')).toHaveText('2 Bausteine');
    await expect(page.getByTestId('quick-menu')).toHaveAttribute('aria-label', 'Kurzmenü: 2 Bausteine');
    await expect(page.getByTestId('section-measures')).toHaveCount(0);
    await expect(page.getByTestId('section-arrange')).toBeVisible();
    // A third one with Ctrl/⌘, and one out again.
    await frames(page).nth(2).click({ modifiers: ['ControlOrMeta'] });
    await expect(page.getByTestId('multi-title')).toHaveText('3 Bausteine');
    await frames(page).nth(0).click({ modifiers: ['Shift'] });
    await expect(selected(page)).toHaveCount(2);
    await frames(page).nth(1).click({ modifiers: ['Shift'] });
    await expect(selected(page)).toHaveCount(1);
    await expect(page.getByTestId('selection-box')).toHaveCount(0);
    await expect(page.locator('.handle')).toHaveCount(8);
});

test('the selection rectangle chooses what it touches; with Shift it adds; a click on the empty stage lets go (Plan.md 79, D2)', async ({ page }) => {
    await openWithThree(page);
    await drawRect(page, [20, 20], [1250, 450]);
    await expect(selected(page)).toHaveCount(2);
    await expect(page.getByTestId('select-area')).toHaveCount(0);
    await expect(frames(page).nth(2)).not.toHaveClass(/frame--selected/);

    // While it is drawn, the rectangle shows – and stays on the stage when the pointer leaves it.
    const a = await onScreen(page, 20, 1000);
    const b = await onScreen(page, 1500, 700);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 5 });
    await expect(page.getByTestId('select-area')).toBeVisible();
    await page.mouse.up();
    await expect(selected(page)).toHaveCount(1);
    await expect(frames(page).nth(2)).toHaveClass(/frame--selected/);

    await drawRect(page, [20, 20], [1250, 450], 'Shift');
    await expect(selected(page)).toHaveCount(3);

    const empty = await onScreen(page, 100, 900);
    await page.mouse.click(empty.x, empty.y);
    await expect(selected(page)).toHaveCount(0);
});

test('Ctrl+A chooses every block of the slide, Escape lets go (Plan.md 79, D2)', async ({ page }) => {
    await openWithThree(page);
    await page.keyboard.press('ControlOrMeta+a');
    await expect(selected(page)).toHaveCount(3);
    await expect(page.getByTestId('multi-title')).toHaveText('3 Bausteine');
    await page.keyboard.press('Escape');
    await expect(selected(page)).toHaveCount(0);
});

test('dragging one of several moves all of them together, the locked one stays; one undo takes it back (Plan.md 79, D3)', async ({ page }) => {
    await openWithThree(page);
    // Lock c, then choose all.
    await frames(page).nth(2).click();
    await page.getByTestId('lock-toggle').click();
    await page.keyboard.press('ControlOrMeta+a');
    await expect(selected(page)).toHaveCount(3);
    const before = await lefts(page);
    const grab = (await frames(page).nth(0).boundingBox())!;
    await page.mouse.move(grab.x + grab.width / 2, grab.y + grab.height / 2);
    await page.mouse.down();
    await page.mouse.move(grab.x + grab.width / 2 + 90, grab.y + grab.height / 2 + 40, { steps: 6 });
    // The size label belongs to the box around the two that move.
    await expect(page.getByTestId('frame-size')).toContainText('1000 × 200');
    await page.mouse.up();
    const after = await lefts(page);
    expect(after[0]! - before[0]!).toBeGreaterThan(60);
    expect(Math.abs(after[0]! - before[0]! - (after[1]! - before[1]!))).toBeLessThanOrEqual(1);
    expect(after[2]).toBe(before[2]);
    await expect(selected(page)).toHaveCount(3);
    await page.keyboard.press('ControlOrMeta+z');
    expect(await lefts(page)).toEqual(before);
});

test('a press on one of several keeps the choice, unmoved it picks that block alone (Plan.md 79, D2)', async ({ page }) => {
    await openWithThree(page);
    await page.keyboard.press('ControlOrMeta+a');
    await frames(page).nth(1).click();
    await expect(selected(page)).toHaveCount(1);
    await expect(frames(page).nth(1)).toHaveClass(/frame--selected/);
});

test('arrow keys, delete, copy, paste and duplicate act on all chosen, each one step (Plan.md 79, D1, D3)', async ({ page }) => {
    await openWithThree(page);
    await drawRect(page, [20, 20], [1250, 450]);
    await expect(selected(page)).toHaveCount(2);

    // Arrows: both move; Shift makes it ten.
    const before = await lefts(page);
    await page.keyboard.press('Shift+ArrowRight');
    const moved = await lefts(page);
    expect(moved[0]! - before[0]!).toBeGreaterThan(2);
    expect(Math.abs(moved[0]! - before[0]! - (moved[1]! - before[1]!))).toBeLessThanOrEqual(0.5);
    expect(moved[2]).toBe(before[2]);
    await page.keyboard.press('ControlOrMeta+z');
    expect(await lefts(page)).toEqual(before);

    // Copy and paste: the pair lands as a pair, both chosen; one undo takes both away.
    await page.keyboard.press('ControlOrMeta+c');
    await page.keyboard.press('ControlOrMeta+v');
    await expect(frames(page)).toHaveCount(5);
    await expect(selected(page)).toHaveCount(2);
    const gap = async (i: number, j: number) => (await frames(page).nth(j).boundingBox())!.x - (await frames(page).nth(i).boundingBox())!.x;
    expect(Math.abs((await gap(3, 4)) - (await gap(0, 1)))).toBeLessThanOrEqual(1);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(frames(page)).toHaveCount(3);

    // Duplicate with the button of the inspector head, then cut with the key.
    await drawRect(page, [20, 20], [1250, 450]);
    await page.getByTestId('block-duplicate').click();
    await expect(frames(page)).toHaveCount(5);
    await expect(selected(page)).toHaveCount(2);
    await page.keyboard.press('ControlOrMeta+x');
    await expect(frames(page)).toHaveCount(3);
    await page.keyboard.press('ControlOrMeta+v');
    await expect(frames(page)).toHaveCount(5);

    // Delete: both go in one step.
    await page.keyboard.press('Delete');
    await expect(frames(page)).toHaveCount(3);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(frames(page)).toHaveCount(5);
});

test('the short menu of several: lock for all, delete for all, and "⋯" lets go (Plan.md 79, D5)', async ({ page }) => {
    await openWithThree(page);
    await page.keyboard.press('ControlOrMeta+a');
    const menu = page.getByTestId('quick-menu');
    await expect(menu.getByTestId('quick-count')).toHaveText('3 Bausteine');
    await menu.getByTestId('quick-lock').click();
    await expect(page.locator('.frame--locked')).toHaveCount(3);
    await expect(page.getByTestId('lock-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('block-delete')).toBeDisabled();
    await menu.getByTestId('quick-lock').click();
    await expect(page.locator('.frame--locked')).toHaveCount(0);

    await menu.getByTestId('quick-more').click();
    await menu.getByTestId('quick-deselect').click();
    await expect(selected(page)).toHaveCount(0);

    await page.keyboard.press('ControlOrMeta+a');
    await menu.getByTestId('quick-delete').click();
    await expect(frames(page)).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(frames(page)).toHaveCount(3);
});

async function tops(page: Page): Promise<number[]> {
    return Promise.all([0, 1, 2].map(async (i) => (await frames(page).nth(i).boundingBox())!.y));
}

test('"Ausrichten" in the inspector lines three blocks up on the left, "Senkrecht verteilen" evens the gaps (Plan.md 79, D4)', async ({ page }) => {
    await openWithThree(page);
    await page.keyboard.press('ControlOrMeta+a');
    await openSection(page, 'arrange');
    const inspector = page.locator('[data-testid="section-arrange"]');
    await inspector.getByTestId('distribute-y').click();
    // a 200..400 and c 600..800 stay, b (200..400) moves between them: free 200 - 200 = 0, so no gap at all.
    const [a, b, c] = await frames(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect()));
    expect(Math.abs(b!.top - a!.bottom)).toBeLessThan(2);
    expect(Math.abs(c!.top - b!.bottom)).toBeLessThan(2);
    await inspector.getByTestId('arrange-left').click();
    const xs = await lefts(page);
    expect(Math.abs(xs[1]! - xs[0]!)).toBeLessThan(1);
    expect(Math.abs(xs[2]! - xs[0]!)).toBeLessThan(1);
    await page.keyboard.press('ControlOrMeta+z');
    expect((await lefts(page))[2]! - (await lefts(page))[0]!).toBeGreaterThan(100);
});

test('"Verteilen" is off below three blocks and says why (Plan.md 79, D4)', async ({ page }) => {
    await openWithThree(page);
    await frames(page).nth(0).click();
    await frames(page).nth(1).click({ modifiers: ['Shift'] });
    await openSection(page, 'arrange');
    const button = page.locator('[data-testid="section-arrange"]').getByTestId('distribute-x');
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await button.hover();
    await expect(page.getByTestId('tip')).toHaveText('Verteilen ab drei Bausteinen');
});

test('the chip "Ausrichten" of the short menu lines two blocks up at the top (Plan.md 79, D4)', async ({ page }) => {
    await openWithThree(page);
    await frames(page).nth(0).click();
    await frames(page).nth(2).click({ modifiers: ['Shift'] });
    const menu = page.getByTestId('quick-menu');
    await menu.getByTestId('quick-chip').click();
    await menu.getByTestId('arrange-top').click();
    const ys = await tops(page);
    expect(Math.abs(ys[2]! - ys[0]!)).toBeLessThan(1);
    expect(ys[1]! - ys[0]!).toBeLessThan(1);
});

test('"?" names Ctrl+A and the Shift-click (Plan.md 79, D2)', async ({ page }) => {
    await openWithThree(page);
    await page.keyboard.press('Shift+?');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Alle Bausteine wählen');
    await expect(dialog).toContainText('Baustein zur Auswahl hinzufügen oder wegnehmen');
});
