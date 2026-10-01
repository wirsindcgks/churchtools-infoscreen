import { expect, test, type Page, type Route } from '@playwright/test';
import { addBlock } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * The slideshow block (Plan.md 46). The media library is made up here, like in the documentation
 * pictures: pictures are answered by this file, and every write to the wiki stops here, so nothing
 * reaches the instance. The slideshow itself lives in the demo's memory.
 */
const WIKI = 50;

interface Made {
    id: number;
    name: string;
}

/** A plain coloured picture, easy to tell apart by its colour. */
function picture(id: number): string {
    const hue = (id * 47) % 360;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="hsl(${hue} 60% 45%)"/></svg>`;
}

async function fakeLibrary(page: Page, baseURL: string | undefined, count: number, longFirst = false): Promise<void> {
    const origin = new URL(baseURL!).origin;
    const made: Made[] = Array.from({ length: count }, (_, i) => ({
        id: 500 + i,
        // One file name as long as a camera or a test run makes them, to see that it fits the column.
        name: longFirst && i === 0 ? `e2e-chromium-1790340812345-bild-mit-einem-sehr-langen-namen-${i}.svg` : `bild-${String(i + 1).padStart(2, '0')}.svg`,
    }));
    await page.route('**/images/**', (route) => {
        const id = Number(/\/images\/(\d+)\//.exec(route.request().url())?.[1]);
        return route.fulfill({ contentType: 'image/svg+xml', body: picture(id) });
    });
    await page.route('**/api/**', (route: Route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname.replace(/^.*?\/api/, '');
        const json = (data: unknown) => route.fulfill({ json: { data } });
        const file = (m: Made) => ({
            id: m.id,
            name: m.name,
            imageUrl: `${origin}/images/${m.id}/${m.name}`,
            imageMetadata: { width: 1600, height: 900 },
            meta: { createdDate: `2026-09-01T10:00:${String(m.id % 60).padStart(2, '0')}Z` },
        });
        if (request.method() === 'POST' && path === `/files/wiki_${WIKI}/p-media`) {
            const uploaded = { id: 900 + made.length, name: `hochgeladen-${made.length}.svg` };
            made.push(uploaded);
            return json([file(uploaded)]);
        }
        if (request.method() !== 'GET') return json({});
        if (path === '/wiki/categories') return json([{ id: WIKI, name: 'Infoscreen', inMenu: false }]);
        if (path === `/wiki/categories/${WIKI}/pages`) return json([{ guid: 'p-media', title: 'mediathek' }]);
        if (path === `/wiki/categories/${WIKI}/pages/mediathek`) return json({ guid: 'p-media', title: 'mediathek' });
        if (path.startsWith(`/wiki/categories/${WIKI}/pages/`)) return json({ guid: 'p-main', title: 'main', text: '' });
        if (path === `/files/wiki_${WIKI}/p-media`) return json(made.map(file));
        if (path === '/permissions/global') {
            return json({
                churchcore: { 'administer persons': true },
                churchwiki: { view: true, 'view category': [WIKI], 'edit category': [WIKI] },
            });
        }
        return route.continue();
    });
}

/** `ownSlide`: on a slide of its own; not possible where the slide list is folded away (tablet, phone). */
async function newSlideWithSlideshow(page: Page, ownSlide = true): Promise<void> {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    if (ownSlide) await page.getByTestId('add-slide').click();
    await addBlock(page, 'slideshow');
    await expect(page.getByTestId('block-inspector')).toBeVisible();
}

test('build a slideshow with several pictures, keep it, and see it in the library', async ({ page, baseURL }) => {
    test.setTimeout(90_000);
    await fakeLibrary(page, baseURL, 4);
    const dialogs: string[] = [];
    page.on('dialog', (dialog) => {
        dialogs.push(dialog.message());
        // Agree to deleting, refuse the second question that names where it is still shown.
        if (dialog.message().includes('aus ChurchTools löschen')) void dialog.accept();
        else void dialog.dismiss();
    });
    await newSlideWithSlideshow(page);
    const inspector = page.getByTestId('block-inspector');
    await expect(inspector.getByText('Noch keine Bilder gewählt.')).toBeVisible();
    await expect(page.getByTestId('slideshow-count')).toHaveText('0 von 30');

    // Pick three in the order 3, 1, 2 – the running numbers show the order.
    await page.getByTestId('pick-slideshow').click();
    const library = page.getByTestId('media-library');
    await expect(library).toBeVisible();
    const pick = (name: string) => library.getByTestId('media-item').filter({ hasText: name }).locator('button.pick');
    await expect(library.getByTestId('media-add')).toBeDisabled();
    for (const name of ['bild-03', 'bild-01', 'bild-02']) await pick(name).click();
    await expect(pick('bild-03')).toHaveAttribute('aria-pressed', 'true');
    await expect(pick('bild-03').getByTestId('media-mark')).toHaveText('1');
    await expect(pick('bild-02').getByTestId('media-mark')).toHaveText('3');
    await expect(pick('bild-04')).toHaveAttribute('aria-pressed', 'false');
    await expect(library.getByTestId('media-add')).toHaveText('Hinzufügen (3)');
    await page.screenshot({ path: 'test-results/slideshow-library.png' });
    // A second click takes the mark back and the others move up; marked again it comes last.
    await pick('bild-01').click();
    await expect(library.getByTestId('media-add')).toHaveText('Hinzufügen (2)');
    await expect(pick('bild-02').getByTestId('media-mark')).toHaveText('2');
    await pick('bild-01').click();
    await library.getByTestId('media-add').click();
    await expect(library).toBeHidden();

    const rows = page.getByTestId('slideshow-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('bild-03');
    await expect(rows.nth(1)).toContainText('bild-02');
    await expect(rows.nth(2)).toContainText('bild-01');
    await expect(page.getByTestId('slideshow-count')).toHaveText('3 von 30');

    // Reorder, remove, set the time.
    await rows.nth(1).getByTestId('slideshow-up').click();
    await expect(rows.nth(0)).toContainText('bild-02');
    await rows.nth(2).getByTestId('slideshow-remove').click();
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(1)).toContainText('bild-03');
    await page.getByTestId('slideshow-seconds').fill('3');
    await page.getByTestId('slideshow-seconds').blur();
    await page.screenshot({ path: 'test-results/slideshow-inspector.png' });

    // The stage holds still on the first picture.
    const onStage = page.locator('.editor-stage').getByTestId('slideshow').locator('[data-active] img');
    await expect(onStage).toBeVisible();
    const first = await onStage.getAttribute('src');
    expect(first).toMatch(/\/images\/\d+\//);
    await page.waitForTimeout(4000);
    expect(await onStage.getAttribute('src')).toBe(first);

    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Gespeichert');

    // The preview runs it: the picture on show changes after the time set.
    await page.getByTestId('open-preview').click();
    const preview = page.getByTestId('playlist-preview');
    await expect(preview).toBeVisible();
    const shown = preview.getByTestId('slideshow').locator('[data-active] img');
    await expect(shown).toBeVisible({ timeout: 15_000 });
    const before = await shown.getAttribute('src');
    await page.screenshot({ path: 'test-results/slideshow-preview.png' });
    await expect(async () => {
        expect(await shown.getAttribute('src')).not.toBe(before);
    }).toPass({ timeout: 8_000 });
    await page.keyboard.press('Escape');
    await expect(preview).toBeHidden();

    // Reloaded, it is as left.
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await page.getByTestId('slide-item').nth(1).click();
    await page.getByTestId('frame-slideshow').first().click();
    await expect(page.getByTestId('slideshow-row')).toHaveCount(2);
    await expect(page.getByTestId('slideshow-row').nth(0)).toContainText('bild-02');
    await expect(page.getByTestId('slideshow-row').nth(1)).toContainText('bild-03');
    await expect(page.getByTestId('slideshow-seconds')).toHaveValue('3');

    // In the library it shows where it runs and is guarded against deleting, like the picture block.
    await page.goto('mediathek');
    const used = page.getByTestId('media-item').filter({ hasText: 'bild-02' });
    await expect(used.getByTestId('media-uses')).not.toHaveText('Unbenutzt');
    await expect(page.getByTestId('media-item').filter({ hasText: 'bild-01' }).getByTestId('media-uses')).toHaveText('Unbenutzt');
    await used.getByRole('button', { name: 'Löschen' }).click();
    await expect.poll(() => dialogs.length).toBeGreaterThan(1);
    expect(dialogs.some((message) => message.includes('wird noch gezeigt'))).toBe(true);
    await expect(used).toHaveCount(1);
});

test('a slideshow takes at most 30 pictures, and an upload is marked instead of chosen', async ({ page, baseURL }) => {
    test.setTimeout(90_000);
    await fakeLibrary(page, baseURL, 31);
    await newSlideWithSlideshow(page);
    await page.getByTestId('pick-slideshow').click();
    const library = page.getByTestId('media-library');
    await expect(library.getByTestId('media-item')).toHaveCount(31);
    const buttons = library.locator('button.pick');
    for (let i = 0; i < 30; i++) await buttons.nth(i).click();
    await expect(library.getByTestId('media-add')).toHaveText('Hinzufügen (30)');
    await buttons.nth(30).click();
    await expect(library.getByTestId('media-limit')).toHaveText('Höchstens 30 Bilder je Galerie');
    await expect(library.getByTestId('media-add')).toHaveText('Hinzufügen (30)');

    // An unmarked picture makes room; a fresh upload is marked, not chosen right away.
    await buttons.nth(0).click();
    await library.getByTestId('media-upload').setInputFiles({
        name: 'neu.svg',
        mimeType: 'image/svg+xml',
        buffer: Buffer.from(picture(1)),
    });
    await expect(library.getByTestId('media-item')).toHaveCount(32, { timeout: 20_000 });
    await expect(library).toBeVisible();
    await expect(library.getByTestId('media-add')).toHaveText('Hinzufügen (30)');
    await library.getByTestId('media-add').click();
    await expect(page.getByTestId('slideshow-count')).toHaveText('30 von 30');
    await expect(page.getByTestId('pick-slideshow')).toBeDisabled();
});

test('the preview of a 31st picture says that a gallery takes at most 30', async ({ page, baseURL }) => {
    test.setTimeout(90_000);
    await fakeLibrary(page, baseURL, 31);
    await newSlideWithSlideshow(page);
    await page.getByTestId('pick-slideshow').click();
    const library = page.getByTestId('media-library');
    await expect(library.getByTestId('media-item')).toHaveCount(31);
    const buttons = library.locator('button.pick');
    for (let i = 0; i < 30; i++) await buttons.nth(i).click();
    await expect(library.getByTestId('media-add')).toHaveText('Hinzufügen (30)');

    await library.getByTestId('media-item').nth(30).getByTestId('media-preview-open').click();
    const preview = page.getByTestId('media-preview');
    await expect(preview).toBeVisible();
    await expect(preview.getByTestId('preview-notice')).toHaveCount(0);
    await preview.getByTestId('preview-action').click();
    await expect(preview.getByTestId('preview-notice')).toHaveText('Höchstens 30 Bilder je Galerie');
    await page.screenshot({ path: 'test-results/notice-in-preview.png' });
    await preview.getByTestId('preview-close').click();
    await expect(library.getByTestId('media-add')).toHaveText('Hinzufügen (30)');
});

const TRANSITIONS = [
    ['fade', 'Überblenden'],
    ['slide', 'Schieben'],
    ['wipe', 'Aufdecken'],
    ['none', 'Ohne'],
] as const;

for (const [transition] of TRANSITIONS) {
    test(`the preview changes the picture with the transition "${transition}"`, async ({ page, baseURL }) => {
        test.setTimeout(60_000);
        await fakeLibrary(page, baseURL, 3);
        await newSlideWithSlideshow(page);
        await page.getByTestId('pick-slideshow').click();
        const library = page.getByTestId('media-library');
        for (const name of ['bild-01', 'bild-02']) await library.getByTestId('media-item').filter({ hasText: name }).locator('button.pick').click();
        await library.getByTestId('media-add').click();
        await expect(page.getByTestId('slideshow-row')).toHaveCount(2);
        await page.getByTestId('slideshow-seconds').fill('3');
        await page.getByTestId('slideshow-seconds').blur();
        const select = page.getByTestId('slideshow-transition');
        expect(await select.locator('option').allTextContents()).toEqual(TRANSITIONS.map(([, label]) => label));
        await select.selectOption(transition);
        if (transition === 'fade') await page.screenshot({ path: 'test-results/galerie-transitions.png' });

        await page.getByTestId('open-preview').click();
        const preview = page.getByTestId('playlist-preview');
        const layer = preview.getByTestId('slideshow').locator('[data-active]');
        await expect(layer).toBeVisible({ timeout: 15_000 });
        // What moves: opacity for the fade, transform for the push, clip-path for the wipe.
        const moves = await layer.evaluate((el) => ({
            transition: getComputedStyle(el).transitionProperty,
            animation: getComputedStyle(el.querySelector('img')!).animationName,
        }));
        if (transition === 'fade') expect(moves.transition).toContain('opacity');
        if (transition === 'slide') expect(moves.transition).toContain('transform');
        if (transition === 'wipe') expect(moves.transition).toContain('clip-path');
        // No motion chosen: the picture stands still.
        expect(moves.animation).toBe('none');

        const before = await layer.locator('img').getAttribute('src');
        await expect(async () => {
            expect(await layer.locator('img').getAttribute('src')).not.toBe(before);
        }).toPass({ timeout: 8_000, intervals: [50] });
        if (transition === 'slide' || transition === 'wipe') await page.screenshot({ path: `test-results/galerie-${transition}.png` });
    });
}

/** A slideshow of two pictures on its own slide, 3 seconds each, the preview not yet open. */
async function twoPictures(page: Page, baseURL: string | undefined): Promise<void> {
    await fakeLibrary(page, baseURL, 3);
    await newSlideWithSlideshow(page);
    await page.getByTestId('pick-slideshow').click();
    const library = page.getByTestId('media-library');
    for (const name of ['bild-01', 'bild-02']) await library.getByTestId('media-item').filter({ hasText: name }).locator('button.pick').click();
    await library.getByTestId('media-add').click();
    await expect(page.getByTestId('slideshow-row')).toHaveCount(2);
    await page.getByTestId('slideshow-seconds').fill('3');
    await page.getByTestId('slideshow-seconds').blur();
}

test('the motion "Abwechselnd" zooms the first picture in and the next one out in the preview (schema 1.19)', async ({ page, baseURL }) => {
    test.setTimeout(60_000);
    await twoPictures(page, baseURL);
    const motion = page.getByTestId('slideshow-motion');
    expect(await motion.locator('option').allTextContents()).toEqual(['Keine', 'Langsam hineinzoomen', 'Langsam herauszoomen', 'Abwechselnd']);
    await expect(motion).toHaveValue('none');
    await motion.selectOption('alternate');
    await page.screenshot({ path: 'test-results/slideshow-motion.png' });

    // The stage of the editor stands still.
    const onStage = page.locator('.editor-stage').getByTestId('slideshow').locator('[data-active] img');
    await expect(onStage).toHaveCSS('animation-name', 'none');

    await page.getByTestId('open-preview').click();
    const layer = page.getByTestId('playlist-preview').getByTestId('slideshow').locator('[data-active]');
    await expect(layer).toHaveClass(/layer--motion-in/, { timeout: 15_000 });
    expect(await layer.locator('img').evaluate((el) => getComputedStyle(el).animationName)).toContain('slideshow-zoom-in');
    await expect(layer).toHaveClass(/layer--motion-out/, { timeout: 8_000 });
    expect(await layer.locator('img').evaluate((el) => getComputedStyle(el).animationName)).toContain('slideshow-zoom-out');
});

test('a motion goes with a push: the transition moves the layer, the zoom the picture (schema 1.19)', async ({ page, baseURL }) => {
    test.setTimeout(60_000);
    await twoPictures(page, baseURL);
    await page.getByTestId('slideshow-transition').selectOption('slide');
    await page.getByTestId('slideshow-motion').selectOption('out');
    await page.getByTestId('open-preview').click();
    const layer = page.getByTestId('playlist-preview').getByTestId('slideshow').locator('[data-active]');
    await expect(layer).toBeVisible({ timeout: 15_000 });
    const styles = await layer.evaluate((el) => ({
        transition: getComputedStyle(el).transitionProperty,
        animation: getComputedStyle(el.querySelector('img')!).animationName,
    }));
    expect(styles.transition).toContain('transform');
    expect(styles.animation).toContain('slideshow-zoom-out');
});

test('a saved block with the old transition "zoom" shows as fade with zooming in, and is rewritten on change (schema 1.19)', async ({ page, baseURL }) => {
    test.setTimeout(60_000);
    await twoPictures(page, baseURL);
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Gespeichert');
    // Turn what was saved into what 1.18 wrote.
    const turned = await page.evaluate(() => {
        const key = 'infoscreen-designer.demo-store';
        const raw = localStorage.getItem(key) ?? '';
        const changed = raw.replace(/\\"transition\\":\\"fade\\"/g, '\\"transition\\":\\"zoom\\"');
        localStorage.setItem(key, changed);
        return changed !== raw;
    });
    expect(turned).toBe(true);

    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await page.getByTestId('slide-item').nth(1).click();
    await page.getByTestId('frame-slideshow').first().click();
    await expect(page.getByTestId('slideshow-transition')).toHaveValue('fade');
    await expect(page.getByTestId('slideshow-motion')).toHaveValue('in');
    await expect(page.getByTestId('slideshow-transition').locator('option')).toHaveCount(4);

    await page.getByTestId('slideshow-transition').selectOption('slide');
    await expect(page.getByTestId('slideshow-motion')).toHaveValue('in');
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Gespeichert');
    expect(await page.evaluate(() => (localStorage.getItem('infoscreen-designer.demo-store') ?? '').includes('zoom\\"'))).toBe(false);
});

// Wide column, tablet sheet, tablet lying down, phone sheet: the buttons of a row stay inside the inspector.
for (const size of [
    { width: 1440, height: 900 },
    { width: 820, height: 1180 },
    { width: 1180, height: 820 },
    { width: 390, height: 844 },
]) {
    test(`a long file name does not push the row's buttons out of the inspector at ${size.width} x ${size.height}`, async ({ page, baseURL }) => {
        test.setTimeout(60_000);
        await page.setViewportSize(size);
        await fakeLibrary(page, baseURL, 3, true);
        await newSlideWithSlideshow(page, size.width >= 1440);
        await page.getByTestId('pick-slideshow').click();
        const library = page.getByTestId('media-library');
        for (const name of ['e2e-chromium', 'bild-02']) await library.getByTestId('media-item').filter({ hasText: name }).locator('button.pick').click();
        await library.getByTestId('media-add').click();
        await expect(page.getByTestId('slideshow-row')).toHaveCount(2);
        const inspector = page.locator('aside.inspector');
        const remove = page.getByTestId('slideshow-remove').first();
        await remove.scrollIntoViewIfNeeded();
        const box = (await remove.boundingBox())!;
        const frame = (await inspector.boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(Math.min(frame.x + frame.width, size.width) + 0.5);
        expect(box.x).toBeGreaterThanOrEqual(frame.x);
        await page.screenshot({ path: `test-results/galerie-long-name-${size.width}.png` });
    });
}
