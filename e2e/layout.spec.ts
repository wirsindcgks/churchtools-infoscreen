import { expect, test, type Page } from '@playwright/test';
import { addBlock, expectSlides, openInspector, openSection } from './helpers';

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

test('one quarter and three quarters: a narrow column for "Ablauf" beside the song sheet (schema 1.64)', async ({ page }) => {
    await emptySlide(page);
    await tile(page, 'narrow-wide:quarter').check({ force: true });
    await expect(page.getByTestId('layout-region')).toHaveCount(2);
    await page.getByTestId('section-layout-toggle').click();
    await expect(page.getByTestId('section-layout')).toContainText('Schmal und breit');
    await add(page, 'a').click();
    await page.getByTestId('sheet-add-shape').click();
    // 40 px margin and gap; the quarter of 1800 px on the 20 px grid.
    expect(await frameStyle(page)).toBe('40px 40px 460px 1000px');
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
    // 40 px margin and gap; two columns of 900 px (Plan.md 104).
    expect(await frameStyle(page)).toBe('40px 40px 900px 1000px');
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
    expect(start).toBe('40px 40px 900px 1000px');
    // A second block from the other area, freed by the switch.
    await add(page, 'b').click();
    await page.getByTestId('sheet-add-text').click();
    await openSection(page, 'arrange');
    await page.getByTestId('region-fixed').uncheck();
    const free = await frameStyle(page, 'text');
    await page.getByTestId('grid').click({ position: { x: 5, y: 5 } });
    await openSection(page, 'layout');
    await tile(page, 'wide-narrow').check({ force: true });
    // 2/3 of (1840 - 40) = 1200
    expect(await frameStyle(page)).toBe('40px 40px 1200px 1000px');
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
    // Moved within its own, otherwise empty area: it stays free there and does not snap back in.
    const box = (await page.getByTestId('frame-shape').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 + 40, { steps: 8 });
    await page.mouse.up();
    expect(await frameStyle(page)).not.toBe(before);
    await expect(page.getByTestId('region-fixed')).not.toBeChecked();
});

/** Drags the block's middle to a point of the stage, given as a share of its width and height. */
async function dragTo(page: Page, type: string, share: { x: number; y: number }): Promise<void> {
    const box = (await page.getByTestId(`frame-${type}`).boundingBox())!;
    const stage = (await page.getByTestId('grid').boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(stage.x + stage.width * share.x, stage.y + stage.height * share.y, { steps: 8 });
    await expect(page.locator('[data-region][data-drop="true"]')).toHaveCount(1);
    await page.mouse.up();
}

test('an existing block dragged into an empty area takes its frame and is fixed', async ({ page }) => {
    await emptySlide(page);
    await addBlock(page, 'shape');
    await page.getByTestId('grid').click({ position: { x: 5, y: 5 } });
    await openSection(page, 'layout');
    await tile(page, 'halves').check({ force: true });
    await dragTo(page, 'shape', { x: 0.75, y: 0.5 });
    expect(await frameStyle(page)).toBe('980px 40px 900px 1000px');
    await openSection(page, 'arrange');
    await expect(page.getByTestId('region-fixed')).toBeChecked();
});

test('a new block snaps into the wide area it starts in, at the middle of the stage (2026-10-21)', async ({ page }) => {
    await emptySlide(page);
    await addBlock(page, 'shape');
    await page.getByTestId('grid').click({ position: { x: 5, y: 5 } });
    await openSection(page, 'layout');
    await tile(page, 'wide-narrow').check({ force: true });
    await dragTo(page, 'shape', { x: 0.25, y: 0.5 });
    expect(await frameStyle(page)).toBe('40px 40px 1200px 1000px');
});

test('dragged into an occupied area, a block stays free and keeps its size', async ({ page }) => {
    await emptySlide(page);
    await openSection(page, 'layout');
    await tile(page, 'halves').check({ force: true });
    await add(page, 'b').click();
    await page.getByTestId('sheet-add-text').click();
    await page.getByTestId('grid').click({ position: { x: 5, y: 5 } });
    await addBlock(page, 'shape');
    const before = await frameStyle(page);
    const size = before.split(' ').slice(2).join(' ');
    const box = (await page.getByTestId('frame-shape').boundingBox())!;
    const stage = (await page.getByTestId('grid').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(stage.x + stage.width * 0.75, stage.y + stage.height * 0.5, { steps: 8 });
    await expect(page.locator('[data-drop="true"]')).toHaveCount(0);
    await page.mouse.up();
    expect((await frameStyle(page)).split(' ').slice(2).join(' ')).toBe(size);
    await openSection(page, 'arrange');
    await expect(page.getByTestId('region-fixed')).not.toBeChecked();
});

test('opening one section of the inspector folds the other; "Bausteine" stays open (Plan.md 91, 133)', async ({ page }) => {
    await emptySlide(page);
    await addBlock(page, 'shape');
    await openSection(page, 'arrange');
    await openSection(page, 'measures');
    await expect(page.getByTestId('section-arrange')).not.toHaveAttribute('open', '');
    await expect(page.getByTestId('section-measures')).toHaveAttribute('open', '');

    // Without a block: the list of the slide's blocks is no setting, it stays beside any open section.
    await page.getByTestId('grid').click({ position: { x: 5, y: 5 } });
    await expect(page.getByTestId('slide-inspector')).toBeVisible();
    await openSection(page, 'layout');
    await expect(page.getByTestId('slide-blocks')).toHaveAttribute('open', '');
    await expect(page.getByTestId('section-layout')).toHaveAttribute('open', '');
    // "Folie" stands in the group, too: opening it folds "Aufteilung".
    await openSection(page, 'slide');
    await expect(page.getByTestId('section-layout')).not.toHaveAttribute('open', '');
    await expect(page.getByTestId('slide-blocks')).toHaveAttribute('open', '');
});

// The sections "Folie" to "Präsentation" stand at the bottom of the inspector where it is a column; on a phone they follow the list (Plan.md 133).
test('the slide and the playlist stay at the bottom of the inspector with many blocks; on a phone they follow the list', async ({ page }) => {
    await emptySlide(page);
    for (let i = 0; i < 30; i += 1) await addBlock(page, 'shape');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('level-playlist')).toBeVisible();
    const inspector = page.locator('aside.inspector');
    const head = page.getByTestId('section-playlist-toggle');
    const bottomGap = async () => (await inspector.boundingBox())!.y + (await inspector.boundingBox())!.height - ((await head.boundingBox())!.y + (await head.boundingBox())!.height);
    expect(await bottomGap()).toBeLessThan(40);
    // Open, "Hintergrund" takes the height it needs and the list gives way; the name "Auf der Folie" stays in sight.
    await openSection(page, 'background');
    const pinned = (await page.locator('.inspector-pinned').boundingBox())!;
    const level = (await page.getByTestId('level-on-slide').boundingBox())!;
    expect(level.y + level.height).toBeLessThanOrEqual(pinned.y + 1);
    expect(level.y).toBeGreaterThanOrEqual((await inspector.boundingBox())!.y - 1);
    // The head of "Präsentation" stays inside the inspector.
    expect((await head.boundingBox())!.y).toBeGreaterThan((await inspector.boundingBox())!.y);

    // A phone: one column, the playlist below the list.
    await page.setViewportSize({ width: 390, height: 844 });
    await openInspector(page);
    const list = (await page.getByTestId('slide-blocks').boundingBox())!;
    await expect(page.getByTestId('level-playlist')).toBeAttached();
    expect((await page.getByTestId('level-playlist').boundingBox())!.y).toBeGreaterThan(list.y + list.height - 1);
});

test('a wider or no gap takes the fixed block along (Plan.md 92)', async ({ page }) => {
    await emptySlide(page);
    await tile(page, 'halves').check({ force: true });
    await add(page, 'a').click();
    await page.getByTestId('sheet-add-shape').click();
    expect(await frameStyle(page)).toBe('40px 40px 900px 1000px');
    await page.getByTestId('grid').click({ position: { x: 5, y: 5 } });
    await openSection(page, 'layout');
    const gap = (value: string) => page.getByTestId('layout-gap').locator(`input[value="${value}"]`);
    // 60 px as margin and gap: (1920 - 3 · 60) / 2 = 870.
    await gap('wide').check({ force: true });
    expect(await frameStyle(page)).toBe('60px 60px 870px 960px');
    await gap('none').check({ force: true });
    expect(await frameStyle(page)).toBe('0px 0px 960px 1080px');
});
