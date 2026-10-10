import { expect, test, type Page } from '@playwright/test';
import { addBlock } from './helpers';

// Operating with a finger (Plan.md 79, C3, C4): choose first, then drag; two fingers zoom; a long press opens "⋯".

type Point = { x: number; y: number };

async function openEditor(page: Page): Promise<void> {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('save-status')).toHaveText('Alles veröffentlicht');
}

/** A fresh, empty slide so nothing else stands on the stage. On a phone it is added from the sheet of slides. */
async function openFreshSlide(page: Page): Promise<void> {
    if (await page.getByTestId('quick-deselect').count()) await page.getByTestId('quick-deselect').tap();
    if (await page.getByTestId('phone-bar').count()) {
        await page.getByTestId('phone-slides').tap();
        await page.getByTestId('add-slide').tap();
        if (await page.getByTestId('slides-sheet').count()) await page.getByTestId('slides-sheet-close').tap();
    } else {
        await page.getByTestId('add-slide').click();
    }
}

/** A finger as the browser's input pipeline gets it: one or more touch points through the DevTools protocol. */
async function fingers(page: Page) {
    const cdp = await page.context().newCDPSession(page);
    const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: Point[]) =>
        cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, id) => ({ x: p.x, y: p.y, id })) });
    return {
        down: (...points: Point[]) => send('touchStart', points),
        move: (...points: Point[]) => send('touchMove', points),
        up: () => send('touchEnd', []),
    };
}

async function center(page: Page, testid: string): Promise<Point> {
    const box = (await page.getByTestId(testid).first().boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Where the block lies on the stage, independent of how far the page is scrolled. */
async function placeOnStage(page: Page, testid: string): Promise<Point> {
    const [block, stage] = await Promise.all([page.getByTestId(testid).first().boundingBox(), page.locator('.editor-stage .stage').first().boundingBox()]);
    return { x: Math.round(block!.x - stage!.x), y: Math.round(block!.y - stage!.y) };
}

test.describe('on a phone', () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
    test.skip(({ browserName }) => browserName === 'webkit', 'Playwright emulates isMobile only in Chromium');

    test('a swipe over an unchosen block scrolls the page; a tap chooses, then a finger moves it', async ({ page }) => {
        await openEditor(page);
        await openFreshSlide(page);
        await addBlock(page, 'shape');
        await page.getByTestId('quick-deselect').tap();
        await expect(page.getByTestId('phone-slides')).toBeVisible();
        const frame = page.getByTestId('frame-shape');
        await expect(frame).toHaveCSS('touch-action', 'pan-x pan-y');
        const home = await placeOnStage(page, 'frame-shape');
        const at = await center(page, 'frame-shape');
        const finger = await fingers(page);

        // Swipe: the block stays, and nothing was dragged.
        await finger.down(at);
        await finger.move({ x: at.x, y: at.y - 20 });
        await finger.move({ x: at.x, y: at.y - 60 });
        await finger.up();
        expect(await placeOnStage(page, 'frame-shape')).toEqual(home);
        expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
        await page.evaluate(() => scrollTo(0, 0));

        // Tap: chosen; its name shows for a moment.
        await page.touchscreen.tap(at.x, at.y);
        await expect(page.getByTestId('phone-bar').getByTestId('quick-menu')).toBeVisible();
        await expect(frame).toHaveCSS('touch-action', 'none');
        await expect(frame.locator('.frame-name')).toBeVisible();

        // Now a finger drags it.
        await finger.down(at);
        await finger.move({ x: at.x + 20, y: at.y + 10 });
        await finger.move({ x: at.x + 60, y: at.y + 30 });
        await finger.up();
        const moved = await placeOnStage(page, 'frame-shape');
        expect(moved.x - home.x).toBeGreaterThan(30);
        expect(moved.y - home.y).toBeGreaterThan(10);
    });

    test('a double tap on an empty image opens the library', async ({ page }) => {
        await openEditor(page);
        await openFreshSlide(page);
        await addBlock(page, 'image');
        await page.getByTestId('quick-deselect').tap();
        const box = (await page.getByTestId('frame-image').boundingBox())!;
        const x = box.x + 10;
        const y = box.y + 10;
        await page.touchscreen.tap(x, y);
        await page.touchscreen.tap(x, y);
        await expect(page.getByTestId('media-library')).toBeVisible();
    });

    test('two fingers zoom the stage; "Ganze Folie" and a double tap on the empty stage bring it back', async ({ page }) => {
        await openEditor(page);
        const stage = page.locator('.editor-stage .stage').first();
        const whole = (await stage.boundingBox())!;
        await expect(page.getByTestId('zoom-reset')).toHaveCount(0);
        const mid = { x: whole.x + whole.width / 2, y: whole.y + whole.height / 2 };
        const finger = await fingers(page);
        await finger.down({ x: mid.x - 40, y: mid.y }, { x: mid.x + 40, y: mid.y });
        await finger.move({ x: mid.x - 70, y: mid.y }, { x: mid.x + 70, y: mid.y });
        await finger.move({ x: mid.x - 100, y: mid.y }, { x: mid.x + 100, y: mid.y });
        await finger.up();
        const reset = page.getByTestId('zoom-reset');
        await expect(reset).toBeVisible();
        await expect(reset).toHaveText(/Ganze Folie/);
        expect((await stage.boundingBox())!.width).toBeGreaterThan(whole.width * 1.2);
        await reset.tap();
        await expect(reset).toHaveCount(0);
        expect((await stage.boundingBox())!.width).toBeCloseTo(whole.width, 0);

        // And the double tap on the empty stage, on a slide with nothing on it.
        await openFreshSlide(page);
        await finger.down({ x: mid.x - 40, y: mid.y }, { x: mid.x + 40, y: mid.y });
        await finger.move({ x: mid.x - 100, y: mid.y }, { x: mid.x + 100, y: mid.y });
        await finger.up();
        await expect(reset).toBeVisible();
        const empty = (await page.locator('.editor-stage').boundingBox())!;
        await page.touchscreen.tap(empty.x + 20, empty.y + 20);
        await page.touchscreen.tap(empty.x + 20, empty.y + 20);
        await expect(reset).toHaveCount(0);
    });

    test('zoomed in, one finger on the empty stage moves the stage and no block', async ({ page }) => {
        await openEditor(page);
        const stage = page.locator('.editor-stage .stage').first();
        const whole = (await stage.boundingBox())!;
        const mid = { x: whole.x + whole.width / 2, y: whole.y + whole.height / 2 };
        const finger = await fingers(page);
        await finger.down({ x: mid.x - 40, y: mid.y }, { x: mid.x + 40, y: mid.y });
        await finger.move({ x: mid.x - 100, y: mid.y }, { x: mid.x + 100, y: mid.y });
        await finger.up();
        await expect(page.getByTestId('zoom-reset')).toBeVisible();
        // The first finger of the zoom may have chosen a block; let it go.
        if (await page.getByTestId('quick-deselect').count()) await page.getByTestId('quick-deselect').tap();
        const before = (await stage.boundingBox())!;
        const blocks = await page.getByTestId('frame-text').first().evaluate((el) => (el as HTMLElement).style.left);
        // Over the middle of the host, wherever the zoom has put the blocks: an unchosen one or the empty stage – the stage moves.
        await finger.down({ x: mid.x, y: mid.y });
        await finger.move({ x: mid.x - 20, y: mid.y - 14 });
        await finger.move({ x: mid.x - 60, y: mid.y - 30 });
        await finger.up();
        const after = (await stage.boundingBox())!;
        expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(20);
        expect(await page.getByTestId('frame-text').first().evaluate((el) => (el as HTMLElement).style.left)).toBe(blocks);
    });

    test('zoomed in, a swipe over the chosen block moves the stage; held a moment, the block lifts and follows', async ({ page }) => {
        await openEditor(page);
        await openFreshSlide(page);
        await addBlock(page, 'shape');
        const stage = page.locator('.editor-stage .stage').first();
        const whole = (await stage.boundingBox())!;
        const mid = { x: whole.x + whole.width / 2, y: whole.y + whole.height / 2 };
        const finger = await fingers(page);
        await finger.down({ x: mid.x - 40, y: mid.y }, { x: mid.x + 40, y: mid.y });
        await finger.move({ x: mid.x - 100, y: mid.y }, { x: mid.x + 100, y: mid.y });
        await finger.up();
        await expect(page.getByTestId('zoom-reset')).toBeVisible();
        await expect(page.getByTestId('frame-shape')).toHaveClass(/frame--selected/);

        // A swipe at once: the stage moves, the block stays where it is on the slide (user at the phone, 2026-10-09).
        const home = await placeOnStage(page, 'frame-shape');
        let at = await center(page, 'frame-shape');
        const before = (await stage.boundingBox())!;
        await finger.down(at);
        await finger.move({ x: at.x - 20, y: at.y - 10 });
        await finger.move({ x: at.x - 50, y: at.y - 25 });
        await finger.up();
        const after = (await stage.boundingBox())!;
        expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(20);
        expect(await placeOnStage(page, 'frame-shape')).toEqual(home);

        // Held still for a moment first: the block lifts and moves with the finger; the stage stays.
        at = await center(page, 'frame-shape');
        const still = (await stage.boundingBox())!;
        await finger.down(at);
        await page.waitForTimeout(350);
        await expect(page.getByTestId('frame-shape')).toHaveClass(/frame--lifted/);
        await finger.move({ x: at.x + 20, y: at.y + 10 });
        await finger.move({ x: at.x + 50, y: at.y + 25 });
        await finger.up();
        await expect(page.getByTestId('frame-shape')).not.toHaveClass(/frame--lifted/);
        const moved = await placeOnStage(page, 'frame-shape');
        expect(moved.x - home.x).toBeGreaterThan(20);
        const unmoved = (await stage.boundingBox())!;
        expect(Math.abs(unmoved.x - still.x) + Math.abs(unmoved.y - still.y)).toBeLessThanOrEqual(1);
    });

    test('a long press on a block chooses it and opens "⋯"; on the empty stage it offers to paste', async ({ page }) => {
        await openEditor(page);
        await openFreshSlide(page);
        await addBlock(page, 'shape');
        await page.getByTestId('quick-deselect').tap();
        const at = await center(page, 'frame-shape');
        const finger = await fingers(page);
        await finger.down(at);
        await page.waitForTimeout(700);
        // The list of the bar opens over the finger; it lifts beside it, as a click on the list is no part of this gesture.
        await finger.move({ x: 4, y: at.y });
        await finger.up();
        await expect(page.getByTestId('phone-bar').getByTestId('quick-more-list')).toBeVisible();

        // Copy it, then press on the empty stage: "Einfügen" appears and pastes there.
        await page.getByTestId('quick-copy').tap();
        await page.getByTestId('quick-deselect').tap();
        const stage = (await page.locator('.editor-stage .stage').first().boundingBox())!;
        const spot = { x: stage.x + stage.width - 30, y: stage.y + stage.height - 20 };
        await finger.down(spot);
        await page.waitForTimeout(700);
        await finger.up();
        await expect(page.getByTestId('paste-here')).toBeVisible();
        await page.getByTestId('paste-here').tap();
        await expect(page.getByTestId('frame-shape')).toHaveCount(2);
        await expect(page.getByTestId('paste-here')).toHaveCount(0);
    });

    test('writing zooms only as far as the letters need: a heading not, body text yes; Escape brings the zoom back', async ({ page }) => {
        await openEditor(page);
        await openFreshSlide(page);
        await addBlock(page, 'text');
        const stage = page.locator('.editor-stage .stage').first();
        const whole = (await stage.boundingBox())!;
        const bar = page.getByTestId('phone-bar');
        // A heading is readable on the phone already: no zoom (user at the phone, 2026-10-09: "ein wilder Zoom").
        await bar.getByTestId('quick-more').tap();
        await bar.getByTestId('quick-edit-text').tap();
        await expect(page.getByTestId('text-edit')).toBeVisible();
        await expect(page.getByTestId('zoom-reset')).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('text-edit')).toHaveCount(0);
        // Body text is not: the stage grows until it is.
        await bar.getByTestId('quick-chip').and(page.getByLabel(/Textstufe/)).tap();
        await page.getByTestId('quick-popover').getByTestId('text-level').locator('input[value="body"]').check({ force: true });
        await page.keyboard.press('Escape');
        await bar.getByTestId('quick-more').tap();
        await bar.getByTestId('quick-edit-text').tap();
        await expect(page.getByTestId('text-edit')).toBeVisible();
        await expect.poll(async () => (await stage.boundingBox())!.width).toBeGreaterThan(whole.width * 1.2);
        await expect(page.getByTestId('zoom-reset')).toBeVisible();
        await page.screenshot({ path: 'test-results/c3-phone-writing.png' });
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('text-edit')).toHaveCount(0);
        await expect(page.getByTestId('zoom-reset')).toHaveCount(0);
        expect((await stage.boundingBox())!.width).toBeCloseTo(whole.width, 0);
    });
});

test.describe('at a desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('Strg and the wheel zoom around the pointer; "Ganze Folie" brings the slide back', async ({ page }) => {
        await openEditor(page);
        const stage = page.locator('.editor-stage .stage').first();
        const whole = (await stage.boundingBox())!;
        const pointer = { x: whole.x + whole.width * 0.3, y: whole.y + whole.height * 0.4 };
        await page.mouse.move(pointer.x, pointer.y);
        await page.keyboard.down('Control');
        await page.mouse.wheel(0, -300);
        await page.keyboard.up('Control');
        const reset = page.getByTestId('zoom-reset');
        await expect(reset).toBeVisible();
        const zoomed = (await stage.boundingBox())!;
        expect(zoomed.width).toBeGreaterThan(whole.width * 1.2);
        // The spot under the pointer stayed under it.
        expect((pointer.x - zoomed.x) / zoomed.width).toBeCloseTo((pointer.x - whole.x) / whole.width, 1);
        expect((pointer.y - zoomed.y) / zoomed.height).toBeCloseTo((pointer.y - whole.y) / whole.height, 1);
        await reset.click();
        await expect(reset).toHaveCount(0);
        expect((await stage.boundingBox())!.width).toBeCloseTo(whole.width, 0);
    });

    test('the mouse still drags an unchosen block at once', async ({ page }) => {
        await openEditor(page);
        await openFreshSlide(page);
        await addBlock(page, 'shape');
        const host = (await page.locator('.editor-stage').boundingBox())!;
        await page.mouse.click(host.x + 3, host.y + 3);
        await expect(page.getByTestId('quick-menu')).toHaveCount(0);
        const home = await placeOnStage(page, 'frame-shape');
        const at = await center(page, 'frame-shape');
        await page.mouse.move(at.x, at.y);
        await page.mouse.down();
        await page.mouse.move(at.x + 40, at.y + 20, { steps: 5 });
        await page.mouse.up();
        const moved = await placeOnStage(page, 'frame-shape');
        expect(moved.x - home.x).toBeGreaterThan(20);
    });
});
