import { expect, test, type Page } from '@playwright/test';
import { expectSlides, openSection } from './helpers';

// The division of a slide (Plan.md 87 B): dashed areas as a guide, a "+" in an empty one – in demo mode.
test.use({ viewport: { width: 1440, height: 900 } });

/** A new, empty slide of the first playlist, with the inspector of the slide and its section "Aufteilung" open. */
async function emptySlide(page: Page): Promise<void> {
    await page.goto('playlists');
    await page.getByTestId('playlist-card').first().getByTestId('open-playlist').click();
    await expectSlides(page);
    await page.getByTestId('add-slide').click();
    await expect(page.getByTestId('slide-item')).toHaveCount(4);
    await expect(page.getByTestId('slide-inspector')).toBeVisible();
    await openSection(page, 'layout');
}

const tile = (page: Page, value: string) => page.getByTestId('layout-split').locator(`input[value="${value}"]`);
const region = (page: Page, id: string) => page.locator(`[data-testid="layout-region"][data-region="${id}"]`);
const add = (page: Page, id: string) => region(page, id).getByTestId('layout-region-add');
const frameStyle = (page: Page, type = 'shape') =>
    page.getByTestId(`frame-${type}`).evaluate((el) => {
        const { left, top, width, height } = (el as HTMLElement).style;
        return `${left} ${top} ${width} ${height}`;
    });

test('halves with a header draw three dashed areas and name the division', async ({ page }) => {
    await emptySlide(page);
    await expect(page.getByTestId('layout-region')).toHaveCount(0);
    await tile(page, 'halves').check({ force: true });
    await page.getByTestId('layout-header').check();
    await expect(page.getByTestId('layout-region')).toHaveCount(3);
    for (const id of ['header', 'a', 'b']) await expect(region(page, id)).toHaveCount(1);
    await page.getByTestId('section-layout-toggle').click();
    await expect(page.getByTestId('section-layout')).toContainText('Zwei Spalten, mit Kopfzeile');
});

test('the "+" of an empty area fills it with the chosen block', async ({ page }) => {
    await emptySlide(page);
    await tile(page, 'halves').check({ force: true });
    await expect(add(page, 'a')).toBeVisible();
    await expect(add(page, 'b')).toBeVisible();
    await add(page, 'a').click();
    await expect(page.getByTestId('block-sheet')).toBeVisible();
    await page.getByTestId('sheet-add-shape').click();
    await expect(page.getByTestId('block-sheet')).toHaveCount(0);
    // 4 % of 1080 = 43 px margin; two columns of 896 and 895 px.
    expect(await frameStyle(page)).toBe('43px 43px 896px 994px');
    await expect(add(page, 'a')).toHaveCount(0);
    await expect(add(page, 'b')).toBeVisible();
});

test('changing the division moves a free block no more', async ({ page }) => {
    await emptySlide(page);
    await tile(page, 'halves').check({ force: true });
    await add(page, 'b').click();
    await page.getByTestId('sheet-add-shape').click();
    await openSection(page, 'arrange');
    await page.getByTestId('region-fixed').uncheck();
    const before = await frameStyle(page);
    // Choosing a tile of the slide's inspector needs no block chosen: click the empty stage.
    await page.getByTestId('grid').click({ position: { x: 5, y: 5 } });
    await openSection(page, 'layout');
    await tile(page, 'wide-narrow').check({ force: true });
    await page.getByTestId('layout-footer').check();
    await expect(region(page, 'footer')).toHaveCount(1);
    expect(await frameStyle(page)).toBe(before);
});

/** Drags the block's frame by a good distance on the stage. */
async function dragFrame(page: Page, type: string): Promise<void> {
    const box = (await page.getByTestId(`frame-${type}`).boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 40, y + 30, { steps: 5 });
    await page.mouse.up();
}

test('a block put in by the "+" is fixed in its area, but its content stays editable', async ({ page }) => {
    await emptySlide(page);
    await tile(page, 'halves').check({ force: true });
    await add(page, 'a').click();
    await page.getByTestId('sheet-add-text').click();
    const before = await frameStyle(page, 'text');
    await dragFrame(page, 'text');
    expect(await frameStyle(page, 'text')).toBe(before);
    await expect(page.locator('.frame--selected [data-handle], .frame--selected .handle')).toHaveCount(0);
    await page.getByTestId('text-input').fill('Im Bereich');
    await expect(page.getByTestId('text-input')).toHaveValue('Im Bereich');
});

test('switching to two thirds takes the fixed block along and leaves the free one', async ({ page }) => {
    await emptySlide(page);
    await tile(page, 'halves').check({ force: true });
    await add(page, 'a').click();
    await page.getByTestId('sheet-add-shape').click();
    const start = await frameStyle(page);
    expect(start).toBe('43px 43px 896px 994px');
    // A second block from the other area, freed by the switch.
    await add(page, 'b').click();
    await page.getByTestId('sheet-add-text').click();
    await openSection(page, 'arrange');
    await page.getByTestId('region-fixed').uncheck();
    const free = await frameStyle(page, 'text');
    await page.getByTestId('grid').click({ position: { x: 5, y: 5 } });
    await openSection(page, 'layout');
    await tile(page, 'wide-narrow').check({ force: true });
    // 2/3 of (1834 - 43) = 1194
    expect(await frameStyle(page)).toBe('43px 43px 1194px 994px');
    expect(await frameStyle(page, 'text')).toBe(free);
});

test('"Im Bereich fest" off lets the block be dragged again', async ({ page }) => {
    await emptySlide(page);
    await tile(page, 'halves').check({ force: true });
    await add(page, 'a').click();
    await page.getByTestId('sheet-add-shape').click();
    await openSection(page, 'arrange');
    await expect(page.getByTestId('region-fixed')).toBeChecked();
    await page.getByTestId('region-fixed').uncheck();
    const before = await frameStyle(page);
    await dragFrame(page, 'shape');
    expect(await frameStyle(page)).not.toBe(before);
});
