import { expect, test, type Locator, type Page } from '@playwright/test';
import { addBlock, dragRow, nudgeRow, chooseFont, chosen, choose, customColor, openInspector, openSection, openSlides } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

test('edit a slide: add text, type, drag, undo, save', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await expect(page.getByTestId('save-status')).toHaveText('Alles veröffentlicht');
    await expect(page.getByTestId('unpublished-flag')).toHaveCount(0);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/editor-open.png' });

    await addBlock(page, 'text');
    await expect(page.getByTestId('block-inspector')).toBeVisible();
    await page.getByTestId('text-input').fill('Gemeindefest am Samstag');
    await page.getByTestId('text-input').blur();
    await expect(page.locator('.editor-stage').getByText('Gemeindefest am Samstag')).toBeVisible();
    await expect(page.getByTestId('save-status')).toHaveText(/Sichert …|Entwurf gesichert/);
    // Changed but not published says so, beside whatever the saving says (Plan.md 79, Paket E, Teil 3).
    await expect(page.getByTestId('unpublished-flag')).toHaveText('Entwurf');

    // Drag the new block 100 screen pixels to the right.
    const frame = page.getByTestId('frame-text').last();
    const box = (await frame.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    const moved = (await frame.boundingBox())!;
    expect(Math.round(moved.x - box.x)).toBeGreaterThan(90);
    await page.screenshot({ path: 'test-results/editor-edited.png' });

    // One undo reverts the whole drag, not one pixel of it.
    await page.keyboard.press('ControlOrMeta+z');
    expect(Math.round((await frame.boundingBox())!.x)).toBe(Math.round(box.x));

    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Veröffentlicht');
    await expect(page.getByTestId('unpublished-flag')).toHaveCount(0);
});

test('the bar says nothing about a running playlist without a sign of life (Plan.md 77)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('save-status')).toHaveText('Alles veröffentlicht');
    await expect(page.getByTestId('editor-live')).toHaveCount(0);
    await expect(page.getByTestId('save')).not.toHaveAttribute('title', /Läuft gerade/);
});

test('"?" opens the overview of the handles, Escape closes it, and the hints name their handle (Plan.md 79, B3)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    const mac = await page.evaluate(() => /^Mac|^iP(hone|ad|od)/.test(navigator.platform));
    const ctrl = mac ? '⌘' : 'Strg+';

    await page.getByTestId('shortcuts').click();
    const dialog = page.getByTestId('shortcuts-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Tastenkürzel' })).toBeVisible();
    for (const text of ['Entwurf sofort sichern', 'Rückgängig', 'Wiederholen', 'Kopieren', 'Ausschneiden', 'Einfügen', 'Duplizieren', 'Löschen', 'Pfeiltasten', 'Auswahl aufheben', 'frei platzieren', 'Abstände']) {
        await expect(dialog).toContainText(text);
    }
    await expect(dialog).toContainText(`${ctrl}S`);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // The key does the same, but not in a field.
    await page.keyboard.press('Shift+?');
    await expect(dialog).toBeVisible();
    await page.getByTestId('shortcuts-close').click();
    await expect(dialog).toHaveCount(0);
    await page.getByTestId('slide-name').focus();
    await page.keyboard.press('Shift+?');
    await expect(dialog).toHaveCount(0);

    await expect(page.getByTestId('save')).toHaveAttribute('title', 'Erst Veröffentlichen bringt die Änderungen auf die Fernseher');
    await page.getByTestId('frame-text').first().click();
    await expect(page.getByTestId('block-duplicate')).not.toHaveAttribute('title', /.+/);
    await expect(page.getByTestId('block-duplicate')).toHaveAccessibleName('Baustein duplizieren');
});

test('a symbol button names itself in a small face – at once for the keyboard, after a moment for the mouse, gone on Escape (Plan.md 79, B3)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    const mac = await page.evaluate(() => /^Mac|^iP(hone|ad|od)/.test(navigator.platform));
    const ctrl = mac ? '⌘' : 'Strg+';
    const tip = page.getByTestId('tip');

    await page.getByTestId('frame-text').first().click();
    // A focus the keyboard gave shows the hint without delay. (Safari's Tab skips buttons, so the key only marks the keyboard as the last input.)
    await page.getByTestId('lock-toggle').focus();
    await page.keyboard.press('Shift');
    await page.getByTestId('block-duplicate').focus();
    await expect(page.getByTestId('block-duplicate')).toBeFocused();
    await expect(tip).toHaveText(`Baustein duplizieren (${ctrl}D)`);
    // Under its button, and inside the window.
    const [face, button] = await Promise.all([tip.boundingBox(), page.getByTestId('block-duplicate').boundingBox()]);
    expect(face!.y).toBeGreaterThanOrEqual(button!.y + button!.height);
    expect(face!.x).toBeGreaterThanOrEqual(0);
    expect(face!.x + face!.width).toBeLessThanOrEqual(1440);
    await page.keyboard.press('Escape');
    await expect(tip).toHaveCount(0);
    // Escape closed the hint only; the block is still chosen.
    await expect(page.getByTestId('block-inspector')).toBeVisible();

    // The mouse sees it after a moment, and it goes with the pointer.
    await page.getByTestId('block-copy').hover();
    await expect(tip).toHaveText(`Baustein kopieren (${ctrl}C)`);
    await page.mouse.move(5, 5);
    await expect(tip).toHaveCount(0);
});

test('the inspector head says which slide this is, and the slide inspector has no heading of its own', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    const title = page.getByTestId('inspector-drawer-title');
    await expect(title).toHaveText('Folie 1 von 3');
    await expect(page.getByTestId('slide-inspector').getByRole('heading', { name: 'Folie', exact: true })).toHaveCount(0);
    await page.getByTestId('slide-item').nth(1).click();
    await expect(title).toHaveText('Folie 2 von 3');
    await addBlock(page, 'text');
    await expect(page.getByTestId('block-inspector')).toBeVisible();
    await expect(title).toHaveText('Folie 2 von 3');
});

test('create a new portrait screen', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('new-screen').click();
    await page.getByTestId('new-name').fill('Foyer Hochkant');
    await expect(page.getByTestId('new-slug')).toHaveValue('foyer-hochkant');
    await page.getByTestId('create-dialog').getByText('Hochkant').click();
    await expect(page.getByTestId('new-portrait')).toBeChecked();
    await page.getByTestId('create').click();
    await expect(page).toHaveURL(/playlists\/[\w-]+$/); // the new screen's own playlist
    await expect(page.getByTestId('playlist-info')).toContainText('Foyer Hochkant');
    await expect(page.getByTestId('playlist-info')).toContainText('Hochkant, 1080 × 1920');
    await expect(page.getByTestId('slide-item')).toHaveCount(1);
    await addBlock(page, 'clock');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/editor-portrait.png' });
});

test('blocks snap to the grid and to the stage centre with a guide line', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await page.getByTestId('grid-size').selectOption('20');
    await addBlock(page, 'shape'); // created centred, 600 × 300
    await openSection(page, 'measures');
    await page.getByTestId('inspector-x').fill('100');
    await page.getByTestId('inspector-x').blur();

    const frame = page.getByTestId('frame-shape').last();
    const stage = (await page.locator('.editor-stage .stage').boundingBox())!;
    const scale = stage.width / 1920;
    const box = (await frame.boundingBox())!;
    // Drag so that the block centre lands 5 stage px right of the stage centre.
    const targetCentre = stage.x + (960 + 5) * scale;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetCentre, box.y + box.height / 2, { steps: 8 });
    await expect(page.getByTestId('guide').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/editor-snap.png' });
    await page.mouse.up();
    await expect(page.getByTestId('guide')).toHaveCount(0);

    await expect(page.getByTestId('inspector-x')).toHaveValue('660'); // (1920 − 600) / 2
    const y = Number(await page.getByTestId('inspector-y').inputValue());
    expect(y % 20 === 0 || y === 390).toBe(true); // grid, or centred vertically
});

test('the header block shows the church logo in the size of the block (G29)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await page.getByTestId('frame-church-header').first().click();
    // The short menu above the block has this switch, too (Plan.md 79, C1); the inspector's is the one under test.
    await page.getByTestId('block-inspector').getByTestId('show-logo').check();
    const logo = page.locator('.editor-stage .block--church-header img');
    await expect(logo).toBeVisible();
    // Not the 150×150 of /logo: the image service answers in the height of the block.
    expect(await logo.getAttribute('src')).toMatch(/\/images\/\d+\/.+w=1300&h=90&fit=max/);
    await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalHeight)).toBe(90);
    await page.screenshot({ path: 'test-results/editor-logo.png' });
});

test('a chosen font comes from the own server, and nothing else is asked for (data protection)', async ({ page }) => {
    const foreign: string[] = [];
    const fonts: string[] = [];
    page.on('request', (request) => {
        const url = new URL(request.url());
        // The API answers with absolute image addresses on the instance's own host (the test
        // series' appointment image). In the dev server the browser fetches those past the
        // proxy, straight from the instance; in production the instance is the app's own
        // origin, so that is not a data-protection issue (Plan.md 42).
        const isInstanceImage = request.resourceType() === 'image' && url.pathname.startsWith('/images/');
        if (url.hostname !== 'localhost' && !isInstanceImage) foreign.push(url.hostname);
        if (url.pathname.endsWith('.woff2')) fonts.push(url.pathname);
    });
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await page.getByTestId('frame-text').first().click();
    await expect(page.getByTestId('text-input')).toHaveValue('Herzlich willkommen!');
    await openSection(page, 'font');
    await chooseFont(page, 'font-family', 'barlow-semi-condensed');
    const title = page.locator('.editor-stage .block--text').filter({ hasText: 'Herzlich willkommen!' });
    // WebKit reports the name without quotes.
    await expect(title.locator('.text')).toHaveCSS('font-family', /^"?ISD Barlow Semi Condensed"?, sans-serif$/);
    await expect.poll(() => page.evaluate(() => document.fonts.check('700 64px "ISD Barlow Semi Condensed"'))).toBe(true);
    expect(fonts.some((f) => f.includes('barlow-semi-condensed'))).toBe(true);
    expect(foreign).toEqual([]);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/editor-font.png' });
});

test('an administrator renames a screen in its settings; an empty name is refused (Plan.md 15)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('screen-menu').first().click();
    await page.getByTestId('screen-settings-open').click();
    const dialog = page.getByTestId('screen-settings');
    const name = page.getByTestId('settings-name');

    await name.fill('   ');
    await expect(dialog.getByText('Ohne Namen lässt sich nicht speichern.')).toBeVisible();
    await expect(page.getByTestId('settings-save')).toBeDisabled();

    await name.fill('Foyer rechts ');
    await page.getByTestId('settings-overscan').fill('3');
    await page.getByTestId('settings-save').click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('screen-card')).toContainText('Foyer rechts');
    await expect(page.getByTestId('screen-card')).not.toContainText('Demo – Foyer');
});

test('an administrator renames a screen from the tile menu (Plan.md 71)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('screen-menu').first().click();
    await page.getByTestId('screen-rename-open').click();
    const dialog = page.getByTestId('screen-rename');
    await expect(dialog.getByRole('heading', { name: 'Bildschirm umbenennen' })).toBeVisible();
    await expect(page.getByTestId('settings-overscan')).toHaveCount(0);
    const name = page.getByTestId('settings-name');
    await expect(name).toBeFocused();
    await name.fill('');
    await expect(page.getByTestId('settings-save')).toBeDisabled();
    await name.fill('Eingang');
    await page.getByTestId('settings-save').click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('screen-card')).toContainText('Eingang');
    await expect(page.getByTestId('screen-card')).not.toContainText('Demo – Foyer');
});

test('the editor saves content without touching the screen\'s settings', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await page.keyboard.press('Escape');
    // Name and overscan are no longer edited here.
    // The editor edits the playlist; the screen's name and overscan are the administrators' business.
    await expect(page.getByTestId('playlist-info')).toContainText('Demo – Foyer'); // where it runs
    await expect(page.getByTestId('playlist-name-input')).toHaveValue('Wochenüberblick');
    await expect(page.getByTestId('screen-name')).toHaveCount(0);
    await addBlock(page, 'clock');
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Veröffentlicht');
});

test('the editor carries no address for the TV – that is the administrators\' business', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await page.keyboard.press('Escape');
    await openSection(page, 'playlist');
    await expect(page.getByTestId('playlist-info')).toBeVisible();
    await expect(page.locator('.inspector')).not.toContainText('player?screen=');
});

test('colours take a hex value; a half-typed one is marked and not taken over (Plan.md 11)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await addBlock(page, 'text');
    await page.getByTestId('text-input').fill('Farbprobe');
    const text = page.locator('.editor-stage').getByText('Farbprobe');
    await openSection(page, 'font');
    const hex = await customColor(page, 'text-color');

    await hex.fill('#1E3A5F');
    await expect(text).toHaveCSS('color', 'rgb(30, 58, 95)');
    await expect(page.getByTestId('text-color-picker')).toHaveValue('#1e3a5f');

    await hex.fill('#12');
    await expect(hex).toHaveAttribute('aria-invalid', 'true');
    await expect(text).toHaveCSS('color', 'rgb(30, 58, 95)'); // unchanged
    await hex.blur();
    await expect(hex).toHaveValue('#1e3a5f'); // leaving shows the colour that counts

    await hex.fill('fa0');
    await expect(text).toHaveCSS('color', 'rgb(255, 170, 0)');
    await page.getByTestId('block-inspector').screenshot({ path: 'test-results/color-field.png' });
});

test('a new slide comes from the tile below the last one, blocks from the bar above the stage', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    const [last, add] = await Promise.all([
        page.getByTestId('slide-item').last().boundingBox(),
        page.getByTestId('add-slide').boundingBox(),
    ]);
    expect(add!.y).toBeGreaterThan(last!.y); // below the list, where one looks for it
    await page.getByTestId('add-slide').click();
    await expect(page.getByTestId('slide-item')).toHaveCount(4);

    const [palette, stage] = await Promise.all([
        page.getByTestId('add-block-menu').boundingBox(),
        page.locator('.editor-stage').boundingBox(),
    ]);
    expect(palette!.y + palette!.height).toBeLessThanOrEqual(stage!.y + 1); // right above the stage
    await expect(page.getByTestId('leave-editor')).toBeVisible();
    await page.screenshot({ path: 'test-results/editor-layout.png' });
});

test.describe('with a finger', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('grips are big enough for a fingertip, and the empty stage lets the page scroll', async ({ page, browserName }) => {
        test.skip(browserName === 'webkit', 'Playwright emulates isMobile only in Chromium');
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await page.getByTestId('frame-text').first().tap();
        const grip = await page.locator('.handle').first().boundingBox();
        expect(grip!.width).toBeGreaterThanOrEqual(20);
        await expect(page.locator('.editor-stage')).toHaveCSS('touch-action', 'pan-x pan-y');
        await expect(page.getByTestId('frame-text').first()).toHaveCSS('touch-action', 'none');
    });
});

// `hasTouch` alone, without `isMobile`: this runs in both browsers (Plan.md 44, M2–M4), unlike the
// block above, which Playwright only emulates in Chromium.
test.describe('with a finger, in both browsers', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    /** Nothing sticks out sideways: a page that scrolls horizontally is broken on a phone. */
    async function expectNoSidewaysScroll(page: Page): Promise<void> {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    }

    test('the header fits in one line, and "…" replaces Vorschau/Player (Plan.md 44, M2)', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('phone-slides')).toContainText('von 3');
        const bar = (await page.locator('.d-appbar').boundingBox())!;
        expect(bar.height).toBeLessThanOrEqual(100);
        await expect(page.getByTestId('save')).toBeVisible();
        await expect(page.getByTestId('editor-more')).toBeVisible();
        await expect(page.getByTestId('open-preview')).not.toBeVisible();
        await expectNoSidewaysScroll(page);

        await page.getByTestId('editor-more').click();
        await page.getByTestId('more-preview').click();
        await expect(page.getByTestId('playlist-preview')).toBeVisible();
        // With a finger the controls never fade: a tap moves no pointer that could bring them back.
        await page.waitForTimeout(3000);
        await expect(page.getByTestId('playlist-preview')).toHaveClass(/idle/);
        await expect(page.getByTestId('preview-controls')).toHaveCSS('opacity', '1');
        await page.getByTestId('preview-controls').getByRole('button', { name: /Schließen/ }).tap();
        await expect(page.getByTestId('playlist-preview')).toHaveCount(0);
    });

    test('"+ Baustein" opens a sheet with every block, and the inspector is its own sheet on request (Plan.md 44, M3, M4; 79, C2)', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('phone-slides')).toContainText('von 3');

        await page.getByTestId('add-block-menu').click();
        const sheet = page.getByTestId('block-sheet');
        await expect(sheet).toBeVisible();
        await expect(sheet.locator('[data-testid^="sheet-add-"]')).toHaveCount(16);
        await sheet.getByTestId('sheet-add-qr').click();
        await expect(sheet).toHaveCount(0);

        // The new block is chosen and its menu stands in the bar; the big sheet stays shut until it is asked for.
        const inspectorSheet = page.getByTestId('inspector-sheet');
        await expect(page.getByTestId('phone-bar').getByTestId('quick-kind')).toHaveAttribute('aria-label', 'QR-Code');
        await expect(inspectorSheet).toBeHidden();
        await openInspector(page);

        await openSection(page, 'measures');
        await page.getByTestId('inspector-x').fill('100');
        await page.getByTestId('inspector-x').blur();
        await expect(page.getByTestId('inspector-x')).toHaveValue('100');
        // Below 16px iOS zooms in on a tapped field and the page pans sideways afterwards.
        await expect(page.getByTestId('inspector-x')).toHaveCSS('font-size', '16px');

        // The sheet covers at most half the window, and the stage moved up into the free part above it.
        const sheetBox = (await inspectorSheet.boundingBox())!;
        expect(sheetBox.height).toBeLessThanOrEqual(844 * 0.5 + 1);
        await expect
            .poll(async () => {
                const stage = (await page.locator('.editor-stage').boundingBox())!;
                return stage.y >= 0 && stage.y + stage.height <= sheetBox.y + 1;
            })
            .toBe(true);
        await expectNoSidewaysScroll(page);

        await page.getByTestId('inspector-sheet-close').click();
        await expect(inspectorSheet).toBeHidden();
        await expect(page.getByTestId('block-inspector')).toBeHidden();
        await expect(page.getByTestId('phone-bar')).toBeVisible();
    });

    test('Escape closes the "+ Baustein" sheet and leaves the bar as it was (Plan.md 44, M3)', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('phone-slides')).toContainText('von 3');
        await page.getByTestId('add-block-menu').click();
        await expect(page.getByTestId('block-sheet')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('block-sheet')).toHaveCount(0);
        await expect(page.getByTestId('phone-slides')).toBeVisible();

        // With a block chosen the bar is its menu; Escape ends the choice, and the slide's bar is back.
        await page.getByTestId('add-block-menu').click();
        await page.getByTestId('sheet-add-text').click();
        await expect(page.getByTestId('phone-bar').getByTestId('quick-menu')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('phone-slides')).toBeVisible();
    });

    test('the slides are a sheet from the bar, not a row above the stage (Plan.md 44; 79, C2)', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('phone-slides')).toContainText('Folie 1 von 3');
        await expect(page.getByTestId('slide-item')).toHaveCount(0);
        await expectNoSidewaysScroll(page);

        const sheet = await openSlides(page);
        await expect(sheet.getByTestId('slide-item')).toHaveCount(3);
        await expectNoSidewaysScroll(page);
        const grid = (await sheet.locator('ol').boundingBox())!;
        expect(grid.x + grid.width).toBeLessThanOrEqual(390);
        await page.keyboard.press('Escape');

        // The slides belong to the phone: a window pulled wide again shows its column, a narrow one the bar.
        await page.setViewportSize({ width: 1440, height: 900 });
        await expect(page.getByTestId('slide-item')).toHaveCount(3);
        await expect(page.getByTestId('slide-item').first()).toBeVisible();
        await expect(page.getByTestId('phone-bar')).toHaveCount(0);
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(page.getByTestId('slide-item')).toHaveCount(0);
        await expect(page.getByTestId('phone-bar')).toBeVisible();
    });

    test('duplicate and remove the current slide from the phone bar (Plan.md 44; 79, C2)', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('phone-slides')).toContainText('von 3');

        await page.getByTestId('phone-slide-more').click();
        await page.getByTestId('slide-duplicate-phone').click();
        await expect(page.getByTestId('phone-slides')).toContainText('von 4');

        await page.getByTestId('phone-slide-more').click();
        await page.getByTestId('slide-remove-phone').click();
        // Our own question with a red "Entfernen" (Plan.md 79, B3).
        await expect(page.getByTestId('confirm-dialog')).toContainText('aus dieser Präsentation entfernen?');
        await expect(page.getByTestId('confirm-ok')).toHaveText('Entfernen');
        await page.getByTestId('confirm-ok').click();
        await expect(page.getByTestId('phone-slides')).toContainText('von 3');
    });

    test('with the sheet open only the stage stands above it (Plan.md 44, second phone test)', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('phone-slides')).toContainText('von 3');

        await page.getByTestId('add-block-menu').click();
        await page.getByTestId('sheet-add-text').click();
        await openInspector(page);
        await expect(page.getByTestId('phone-bar')).toHaveCount(0);
        await expect(page.getByTestId('add-block-menu')).not.toBeVisible();
        await expect(page.locator('.editor-stage')).toBeVisible();
        const sheetBox = (await page.getByTestId('inspector-sheet').boundingBox())!;
        // `showStageAboveSheet` scrolls smoothly – give the animation time to land.
        await expect
            .poll(async () => {
                const stage = (await page.locator('.editor-stage').boundingBox())!;
                return stage.y >= 0 && stage.y + stage.height <= sheetBox.y + 1;
            })
            .toBe(true);

        // Its own button closes the sheet again – the bar comes back, with the menu of the chosen block.
        await page.getByTestId('inspector-sheet-close').click();
        await expect(page.getByTestId('phone-bar').getByTestId('quick-menu')).toBeVisible();
    });

    test('on a low window the sheet takes at most half, and the whole slide shrinks to fit above it (Plan.md 44, third phone test)', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 560 });
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('phone-slides')).toContainText('von 3');

        // Without a block: the slide's own settings.
        await openInspector(page);
        await expect(page.getByTestId('slide-inspector')).toBeVisible();
        const sheetBox = (await page.getByTestId('inspector-sheet').boundingBox())!;
        expect(sheetBox.height).toBeLessThanOrEqual(560 * 0.5 + 1);
        // The rendered slide, not just its frame: all of it above the sheet, scaled down to fit.
        await expect
            .poll(async () => {
                const slide = (await page.locator('.editor-stage .stage').first().boundingBox())!;
                return slide.y >= 0 && slide.y + slide.height <= sheetBox.y + 1 && slide.height > 100;
            })
            .toBe(true);
        await expectNoSidewaysScroll(page);
        await page.screenshot({ path: 'test-results/sheet-low-window.png' });
    });

    test('choosing a block and dragging it leaves the big sheet shut, and the block moves (Plan.md 44, second phone test; 79, C2)', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('phone-slides')).toContainText('von 3');

        const frame = page.getByTestId('frame-text').first();
        const box = (await frame.boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 5 });
        // Mid-drag the block is chosen and its menu stands in the bar; nothing moves the stage around.
        await expect(page.getByTestId('phone-bar').getByTestId('quick-menu')).toBeVisible();
        await expect(page.getByTestId('inspector-sheet')).toBeHidden();

        await page.mouse.up();
        await expect(page.getByTestId('inspector-sheet')).toBeHidden();
        await expect.poll(async () => (await frame.boundingBox())!.x).toBeGreaterThan(box.x + 40);
        expect(Math.abs((await frame.boundingBox())!.y - box.y)).toBeLessThanOrEqual(1);
    });
});

// A tablet between 48rem and 75rem: the slides are a drawer over the stage; the inspector is a sheet at the
// bottom upright and a column beside the stage lying down (Plan.md 45).
test.describe('on a tablet (Plan.md 45)', () => {
    test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true });

    async function openEditor(page: Page): Promise<void> {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('leave-editor')).toBeVisible();
    }
    async function stageWidth(page: Page): Promise<number> {
        return Math.round((await page.locator('.editor-stage').boundingBox())!.width);
    }
    async function expectNoSidewaysScroll(page: Page): Promise<void> {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    }
    /** The slides drawer shut with its rail there, "+ Baustein" instead of the row of blocks. */
    async function expectRestingLayout(page: Page, minStage: number): Promise<void> {
        expect(await stageWidth(page)).toBeGreaterThanOrEqual(minStage);
        await expectNoSidewaysScroll(page);
        await expect(page.getByTestId('slide-item').first()).not.toBeVisible();
        await expect(page.getByTestId('tablet-slides-toggle')).toBeVisible();
        await expect(page.getByTestId('add-block-menu')).toBeVisible();
        await expect(page.getByTestId('add-clock')).toHaveCount(0); // the row of blocks is gone everywhere (Plan.md 47)
    }

    /** The slide stands in the middle of the room between "+ Baustein" and what lies below it (user, 2026-10-09). */
    async function expectStageCentered(page: Page, bottom: number): Promise<void> {
        const [head, stage] = await Promise.all([page.getByTestId('add-block-menu').boundingBox(), page.locator('.editor-stage .stage').first().boundingBox()]);
        const above = stage!.y - (head!.y + head!.height);
        const below = bottom - (stage!.y + stage!.height);
        expect(above).toBeGreaterThan(20);
        expect(Math.abs(above - below)).toBeLessThanOrEqual(30);
    }

    test('upright: the stage takes the width, the inspector is a bar at the bottom, and there is no rail for it', async ({ page }) => {
        await openEditor(page);
        await expectRestingLayout(page, 700);
        // In the middle above the sheet's bar, and the page does not scroll.
        await expectStageCentered(page, (await page.getByTestId('inspector-sheet').boundingBox())!.y);
        expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(8);
        await expect(page.getByTestId('tablet-slides-toggle')).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByTestId('tablet-inspector-toggle')).not.toBeVisible();
        await expect(page.getByTestId('inspector-sheet-toggle')).toBeVisible();
        await expect(page.getByTestId('inspector-sheet')).not.toHaveClass(/open/);
    });

    test('upright: a block on the stage opens the sheet below the slide, and the stage stays as it is', async ({ page }) => {
        await openEditor(page);
        const before = await stageWidth(page);

        await page.getByTestId('frame-text').first().tap();
        const sheet = page.getByTestId('inspector-sheet');
        await expect(sheet).toHaveClass(/open/);
        await expect(page.getByTestId('block-inspector')).toBeVisible();
        await expect(page.getByTestId('inspector-sheet-toggle')).toContainText('Baustein: Text');
        await expect(page.getByTestId('tablet-inspector-close')).not.toBeVisible();
        expect(await stageWidth(page)).toBe(before);
        expect(await stageWidth(page)).toBeGreaterThanOrEqual(700);
        await expectNoSidewaysScroll(page);

        const [stage, sheetBox] = await Promise.all([page.locator('.editor-stage').boundingBox(), sheet.boundingBox()]);
        // The whole slide stays above the sheet, lower handles included: upright on a tablet it takes 45 %, not half.
        expect(sheetBox!.y).toBeGreaterThanOrEqual(stage!.y + stage!.height);
        expect(sheetBox!.height).toBeLessThanOrEqual(1180 * 0.45 + 1);
        await expectStageCentered(page, sheetBox!.y);

        // The slides and the block row stay: there is room for them upright.
        await expect(page.getByTestId('add-block-menu')).toBeVisible();

        await page.getByTestId('inspector-sheet-toggle').tap();
        await expect(sheet).not.toHaveClass(/open/);
        await page.getByTestId('inspector-sheet-toggle').tap();
        await expect(sheet).toHaveClass(/open/);
    });

    test('the slides drawer opens over the stage, and a tap on a slide chooses it and shuts the drawer', async ({ page }) => {
        await openEditor(page);
        const before = await stageWidth(page);

        await page.getByTestId('tablet-slides-toggle').tap();
        await expect(page.getByTestId('tablet-slides-toggle')).toHaveAttribute('aria-expanded', 'true');
        await expect(page.getByTestId('slide-item')).toHaveCount(3);
        await expect(page.getByTestId('slide-item').first()).toBeVisible();
        await expect(page.getByTestId('slides-collapse')).toBeVisible();
        expect(await stageWidth(page)).toBe(before);
        await expectNoSidewaysScroll(page);

        await page.getByTestId('slide-item').nth(1).tap();
        await expect(page.getByTestId('slide-item').nth(1)).not.toBeVisible();
        await expect(page.getByTestId('tablet-slides-toggle')).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByTestId('tablet-slides-toggle')).toContainText('2');

        // The button opens and shuts it, and neither the phone's remembered row nor a desktop column is touched.
        await page.getByTestId('tablet-slides-toggle').tap();
        await expect(page.getByTestId('slide-item').first()).toBeVisible();
        await page.getByTestId('tablet-slides-toggle').tap();
        await expect(page.getByTestId('slide-item').first()).not.toBeVisible();
        expect(await page.evaluate(() => window.localStorage.getItem('infoscreen-designer:slides-open'))).toBeNull();
        expect(await page.evaluate(() => window.localStorage.getItem('infoscreen-designer:desktop-slides-open'))).toBeNull();
    });

    test('"+ Baustein" opens its sheet in the middle of the window', async ({ page }) => {
        await openEditor(page);
        await page.getByTestId('add-block-menu').tap();
        const panel = page.locator('.block-sheet-panel');
        await expect(panel).toBeVisible();
        const box = (await panel.boundingBox())!;
        expect(Math.abs(box.x + box.width / 2 - 410)).toBeLessThanOrEqual(2);
        expect(box.y + box.height).toBeLessThan(1180 - 100);
    });

    test.describe('lying down, at 1180 px', () => {
        test.use({ viewport: { width: 1180, height: 820 } });

        test('the stage takes the width, the inspector is a rail', async ({ page }) => {
            await openEditor(page);
            await expectRestingLayout(page, 1000);
            await expectStageCentered(page, (await page.locator('.stage-column').boundingBox())!.y + (await page.locator('.stage-column').boundingBox())!.height);
            await expect(page.getByTestId('inspector-sheet')).not.toBeVisible();
            await expect(page.getByTestId('tablet-inspector-toggle')).toBeVisible();
            await expect(page.getByTestId('inspector-sheet-toggle')).not.toBeVisible();
        });

        test('a block opens the inspector as a column, the stage gives way, "Einklappen" shuts it', async ({ page }) => {
            await openEditor(page);
            const before = await stageWidth(page);

            await page.getByTestId('frame-text').first().tap();
            await expect(page.getByTestId('inspector-sheet')).toBeVisible();
            await expect(page.getByTestId('block-inspector')).toBeVisible();
            await expect(page.getByTestId('tablet-inspector-toggle')).toHaveAttribute('aria-label', /Baustein: Text/);
            await expect(page.getByTestId('tablet-inspector-toggle')).not.toBeVisible();
            await expect(page.getByTestId('tablet-inspector-close')).toHaveAttribute('aria-label', 'Einklappen');
            await expect.poll(() => stageWidth(page)).toBeLessThan(before);
            const [stage, sheet] = await Promise.all([page.locator('.editor-stage').boundingBox(), page.getByTestId('inspector-sheet').boundingBox()]);
            expect(stage!.x + stage!.width).toBeLessThanOrEqual(sheet!.x + 1);
            await expectNoSidewaysScroll(page);

            await page.getByTestId('tablet-inspector-close').tap();
            await expect(page.getByTestId('inspector-sheet')).not.toBeVisible();
            await expect.poll(() => stageWidth(page)).toBeGreaterThanOrEqual(1000);

            // The rail's button opens it again, without a block chosen anew.
            await page.getByTestId('tablet-inspector-toggle').tap();
            await expect(page.getByTestId('inspector-sheet')).toBeVisible();
            expect(await page.evaluate(() => window.localStorage.getItem('infoscreen-designer:desktop-inspector-open'))).toBeNull();
        });
    });

    test('at 1280 px the three columns are open, and the rails are gone', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await openEditor(page);
        await expect(page.getByTestId('slide-item')).toHaveCount(3);
        await expect(page.getByTestId('slide-item').first()).toBeVisible();
        await page.getByTestId('frame-text').first().click();
        await expect(page.getByTestId('block-inspector')).toBeVisible();
        await expect(page.getByTestId('tablet-slides-toggle')).not.toBeVisible();
        await expect(page.getByTestId('tablet-inspector-toggle')).not.toBeVisible();
        await expect(page.getByTestId('tablet-inspector-close')).not.toBeVisible();
        await expect(page.getByTestId('slides-collapse')).toBeVisible();
        await expect(page.getByTestId('desktop-inspector-collapse')).toBeVisible();
        await expect(page.getByTestId('add-block-menu')).toBeVisible();
        const inspector = (await page.getByTestId('block-inspector').boundingBox())!;
        const stage = (await page.locator('.editor-stage').boundingBox())!;
        expect(inspector.x).toBeGreaterThanOrEqual(stage.x + stage.width - 1);
        await expectNoSidewaysScroll(page);
    });
});

// Over 75rem both side columns fold into a 44 px rail, and stay so (Plan.md 45).
test.describe('at a desktop the two columns fold (Plan.md 45)', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    async function stageWidth(page: Page): Promise<number> {
        return Math.round((await page.locator('.editor-stage').boundingBox())!.width);
    }

    test('fold, remembered across a reload, unfold from the rails; a chosen block does not unfold the inspector', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('slide-item')).toHaveCount(3);
        await expect(page.getByTestId('block-inspector').or(page.getByTestId('inspector-sheet'))).toBeVisible();
        await expect(page.getByTestId('tablet-slides-toggle')).not.toBeVisible();
        await expect(page.getByTestId('tablet-inspector-toggle')).not.toBeVisible();
        const open = await stageWidth(page);

        await page.getByTestId('slides-collapse').click();
        await expect(page.getByTestId('slide-item').first()).not.toBeVisible();
        await expect(page.getByTestId('tablet-slides-toggle')).toBeVisible();
        await expect(page.getByTestId('tablet-slides-toggle')).toHaveAttribute('aria-expanded', 'false');
        await expect.poll(() => stageWidth(page)).toBeGreaterThan(open);
        const slidesFolded = await stageWidth(page);

        await page.getByTestId('desktop-inspector-collapse').click();
        await expect(page.getByTestId('inspector-sheet')).not.toBeVisible();
        await expect(page.getByTestId('tablet-inspector-toggle')).toBeVisible();
        await expect.poll(() => stageWidth(page)).toBeGreaterThan(slidesFolded);

        // Choosing a block does not unfold what the viewer folded.
        await page.getByTestId('frame-text').first().click();
        await expect(page.getByTestId('inspector-sheet')).not.toBeVisible();
        await expect(page.getByTestId('tablet-inspector-toggle')).toHaveAttribute('aria-label', /Baustein: Text/);

        await page.reload();
        await expect(page.getByTestId('leave-editor')).toBeVisible();
        await expect(page.getByTestId('tablet-slides-toggle')).toBeVisible();
        await expect(page.getByTestId('tablet-inspector-toggle')).toBeVisible();
        await expect(page.getByTestId('slide-item').first()).not.toBeVisible();
        await expect(page.getByTestId('inspector-sheet')).not.toBeVisible();

        await page.getByTestId('tablet-slides-toggle').click();
        await expect(page.getByTestId('slide-item').first()).toBeVisible();
        await expect(page.getByTestId('tablet-slides-toggle')).not.toBeVisible();
        await page.getByTestId('tablet-inspector-toggle').click();
        await expect(page.getByTestId('inspector-sheet')).toBeVisible();
        await expect(page.getByTestId('tablet-inspector-toggle')).not.toBeVisible();
        expect(await page.evaluate(() => window.localStorage.getItem('infoscreen-designer:desktop-slides-open'))).toBe('1');
        expect(await page.evaluate(() => window.localStorage.getItem('infoscreen-designer:desktop-inspector-open'))).toBe('1');
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });
});

test('at a desktop the preview controls fade while untouched and come back with the mouse', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await page.getByTestId('open-preview').click();
    const controls = page.getByTestId('preview-controls');
    await expect(controls).toHaveCSS('opacity', '1');
    await page.waitForTimeout(3000);
    await expect(controls).toHaveCSS('opacity', '0');
    await page.mouse.move(200, 200);
    await page.mouse.move(220, 220);
    await expect(controls).toHaveCSS('opacity', '1');
});

test('at 1440px the phone sheets are gone, the inspector stands beside the stage (Plan.md 44)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await expect(page.getByTestId('inspector-sheet-toggle')).not.toBeVisible();
    await expect(page.getByTestId('editor-more')).toBeVisible(); // "Entwurf verwerfen" lives there on every width (Plan.md 79, E)
    await expect(page.getByTestId('add-block-menu')).toBeVisible(); // "+ Baustein" on every width (Plan.md 47)
    await expect(page.getByTestId('open-preview')).toBeVisible();
    // The phone-only slide row header and its actions are gone; the selected tile keeps its own (Plan.md 44).
    await expect(page.getByTestId('slides-toggle')).not.toBeVisible();
    await expect(page.getByTestId('slide-duplicate-phone')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Duplizieren', exact: true })).toBeVisible();

    await addBlock(page, 'clock');
    const [stage, inspector] = await Promise.all([
        page.locator('.editor-stage').boundingBox(),
        page.getByTestId('block-inspector').boundingBox(),
    ]);
    expect(inspector!.x).toBeGreaterThan(stage!.x + stage!.width - 1);
});

test('the media library in the editor lists pictures to choose from and closes again (reads only)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await addBlock(page, 'image');
    await page.getByTestId('block-inspector').getByTestId('pick-image').click();
    const library = page.getByTestId('media-library');
    await expect(library).toBeVisible();
    await expect(library.getByText('Lade Bilder …')).toHaveCount(0);
    await expect(library).toContainText('Seite');
    const items = await library.getByTestId('media-item').count();
    // In the editor a picture is chosen by clicking it.
    await expect(library.locator('button.pick')).toHaveCount(items);
    await library.getByRole('button', { name: 'Schließen' }).click();
    await expect(library).toBeHidden();
});

test('a rule without a second playlist asks for one on the spot, and the new one is chosen (Plan.md 17)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('screen-card').first().getByTestId('open-schedule').click();
    const dialog = page.getByTestId('schedule-dialog');
    await expect(dialog).toContainText('Normalerweise zeigt dieser Bildschirm');
    await expect(dialog).toContainText('Noch keine Regel');

    await dialog.getByTestId('add-time-rule').click();
    const rule = dialog.getByTestId('schedule-rule');
    await expect(rule.getByTestId('inline-create')).toBeVisible(); // only one playlist so far
    await expect(rule.getByTestId('inline-create-name')).toBeFocused();
    await rule.getByTestId('inline-create-name').fill('Sonntag');
    await rule.getByTestId('inline-create-save').click();
    await expect(rule.getByTestId('inline-create')).toHaveCount(0);
    await expect(rule.getByTestId('rule-playlist').locator('option:checked')).toHaveText('Sonntag');
    await expect(dialog.getByTestId('schedule-playlist')).toHaveCount(2); // the legend below the day

    // The default can take a new one the same way: the last entry of the list.
    await dialog.getByTestId('default-playlist').selectOption({ label: '＋ Neue Präsentation anlegen …' });
    await expect(dialog.getByTestId('default-playlist')).toHaveValue(/.+/);
    await expect(dialog.getByTestId('inline-create')).toHaveCount(1);
    await page.screenshot({ path: 'test-results/schedule-inline.png' });

    await dialog.getByTestId('schedule-save').click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('screen-card').first().getByTestId('open-schedule')).toHaveText('1 Regel');
});

test('greeting before the service: a window from 30 min before to 10 min after the start (Plan.md 22)', async ({ page }) => {
    // ChurchTools' answers are simulated: one calendar, one service next Sunday 10:00–11:30 local time.
    const sunday = new Date();
    sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7 || 7));
    sunday.setHours(10, 0, 0, 0);
    const end = new Date(sunday.getTime() + 90 * 60_000);
    await page.route(/\/api\/calendars(\?|$)/, (route) =>
        route.fulfill({ json: { data: [{ id: 901, name: 'Gottesdienste' }] } }),
    );
    await page.route(/\/api\/calendars\/appointments/, (route) =>
        route.fulfill({
            json: {
                data: [
                    {
                        appointment: {
                            base: { id: 1, title: 'Gottesdienst', allDay: false, calendar: { id: 901, name: 'Gottesdienste' } },
                            calculated: { startDate: sunday.toISOString(), endDate: end.toISOString() },
                        },
                    },
                ],
            },
        }),
    );

    await page.goto('./');
    await page.getByTestId('screen-card').first().getByTestId('open-schedule').click();
    const dialog = page.getByTestId('schedule-dialog');
    await dialog.getByTestId('add-appointment-rule').click();
    const rule = dialog.getByTestId('schedule-rule');
    await rule.getByTestId('inline-create-name').fill('Begrüßung');
    await rule.getByTestId('inline-create-save').click();
    await expect(rule.getByTestId('rule-preset-around')).toHaveAttribute('aria-pressed', 'true'); // as before 1.5

    await rule.getByTestId('rule-preset-before').click();
    const to = rule.getByTestId('rule-window-to');
    await to.getByTestId('point-minutes').fill('10');
    await to.getByTestId('point-direction').selectOption('after');
    await expect(to.getByTestId('point-anchor')).toHaveValue('start');
    await expect(rule.getByTestId('rule-preset-before')).toHaveAttribute('aria-pressed', 'false');
    await expect(dialog.getByTestId('schedule-problems')).toHaveCount(0);

    const key = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
    await dialog.getByTestId('preview-date').fill(key);
    await dialog.getByTestId('preview-time').fill('585'); // 09:45
    await expect(dialog.getByTestId('preview-result')).toContainText('„Begrüßung"');
    await dialog.getByTestId('preview-time').fill('600'); // 10:00, the service begins
    await expect(dialog.getByTestId('preview-result')).toContainText('„Begrüßung"');
    await dialog.getByTestId('preview-time').fill('615'); // 10:15
    await expect(dialog.getByTestId('preview-result')).toContainText('Standard');
    await page.screenshot({ path: 'test-results/schedule-appointment.png' });

    // "bis" before "von" is named, not saved.
    await to.getByTestId('point-direction').selectOption('before');
    await to.getByTestId('point-minutes').fill('45');
    await expect(dialog.getByTestId('schedule-problems')).toContainText('„bis" muss nach „von" liegen');
    await to.getByTestId('point-direction').selectOption('after');
    await to.getByTestId('point-minutes').fill('10');

    await dialog.getByTestId('schedule-save').click();
    await expect(dialog).toBeHidden();
    await page.getByTestId('sidebar-schedules').click();
    await expect(page.getByTestId('schedule-rule-line').first()).toContainText(
        '30 Min. vor Beginn bis 10 Min. nach Beginn von Terminen in Gottesdienste',
    );
});

test('playlists stand on their own: create one, choose it in a screen\'s schedule, see where it runs (Plan.md 17, 19)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('sidebar-playlists').click();
    await expect(page.getByTestId('playlists-heading')).toBeVisible();
    await expect(page.getByTestId('playlist-card')).toHaveCount(1);
    await expect(page.getByTestId('playlist-card')).toContainText('Wochenüberblick');
    await expect(page.getByTestId('playlist-card').getByTestId('playlist-screens')).toHaveText('Demo – Foyer');
    // When and by whom it was last edited, each on a line of its own (Plan.md 66).
    const demoCard = page.getByTestId('playlist-card');
    await expect(demoCard.getByTestId('playlist-edited-at')).toHaveText(/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/);
    await expect(demoCard.getByTestId('playlist-edited')).toHaveAttribute('title', /^Zuletzt geändert am .+ um \d{2}:\d{2}$/);

    // A new playlist runs nowhere yet; it opens straight in the editor.
    await page.getByTestId('new-playlist').click();
    await page.getByTestId('create-playlist-dialog').getByTestId('new-playlist-name').fill('Gottesdienst');
    await page.getByTestId('create-playlist').click();
    await expect(page).toHaveURL(/playlists\/[\w-]+$/);
    await expect(page.getByTestId('slide-item')).toHaveCount(1);
    await expect(page.getByTestId('playlist-screens')).toHaveText('noch keinem Bildschirm');
    await page.getByTestId('leave-editor').click();
    await expect(page.getByTestId('playlist-card')).toHaveCount(2);

    // The screen chooses it on Sundays 9–12.
    await page.getByTestId('sidebar-screens').click();
    const card = page.getByTestId('screen-card').first();
    await expect(card.getByTestId('screen-playlist')).toHaveText('Wochenüberblick');
    await expect(card.getByTestId('open-schedule')).toHaveText('Zeitplan');
    await card.getByTestId('open-schedule').click();
    const dialog = page.getByTestId('schedule-dialog');
    await expect(dialog.getByTestId('default-playlist').locator('option:checked')).toHaveText('Wochenüberblick');
    await expect(dialog.getByTestId('schedule-save')).toBeDisabled(); // nothing changed yet
    await dialog.getByTestId('add-time-rule').click();
    const rule = dialog.getByTestId('schedule-rule');
    await expect(rule.getByTestId('rule-playlist').locator('option:checked')).toHaveText('Gottesdienst');

    // An impossible time is named and keeps the schedule from being saved.
    await rule.getByTestId('rule-to').fill('08:00');
    await rule.getByTestId('rule-to').dispatchEvent('change');
    await expect(dialog.getByTestId('schedule-problems')).toContainText('Regel 1');
    await expect(dialog.getByTestId('schedule-save')).toBeDisabled();
    await rule.getByTestId('rule-to').fill('12:00');
    await rule.getByTestId('rule-to').dispatchEvent('change');
    await expect(dialog.getByTestId('schedule-problems')).toHaveCount(0);

    // Preview: next Sunday at 10:30 runs "Gottesdienst", at 13:00 the default.
    const sunday = new Date();
    sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7));
    const key = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
    await dialog.getByTestId('preview-date').fill(key);
    await dialog.getByTestId('preview-time').fill('630');
    await expect(dialog.getByTestId('preview-result')).toContainText('„Gottesdienst"');
    await expect(dialog.getByTestId('preview-result')).toContainText('Regel 1');
    await dialog.getByTestId('preview-time').fill('780');
    await expect(dialog.getByTestId('preview-result')).toContainText('Standard');
    await expect(dialog.getByTestId('preview-timeline').locator('.segment')).toHaveCount(3);
    await expect(dialog.getByTestId('schedule-playlist')).toHaveCount(2);
    await page.screenshot({ path: 'test-results/home-schedule.png' });

    await dialog.getByTestId('schedule-save').click();
    await expect(dialog).toBeHidden();
    await expect(card.getByTestId('open-schedule')).toHaveText('1 Regel');

    // Now it runs on the screen, and a playlist still shown cannot be deleted.
    await page.getByTestId('sidebar-playlists').click();
    const worship = page.getByTestId('playlist-card').filter({ hasText: 'Gottesdienst' });
    await expect(worship.getByTestId('playlist-screens')).toHaveText('Demo – Foyer');
    // Created just now by the test user: the name is there, on the line below the date.
    await expect(worship.getByTestId('playlist-edited-by')).toHaveText(/\S/);
    const editedAt = (await worship.getByTestId('playlist-edited').boundingBox())!;
    const editedBy = (await worship.getByTestId('playlist-edited-by').boundingBox())!;
    expect(editedBy.y).toBeGreaterThanOrEqual(editedAt.y + editedAt.height - 1);
    await worship.getByTestId('playlist-menu').click();
    await expect(worship.getByTestId('delete-playlist')).toBeDisabled();

    // All schedules at a glance in the sidebar: the rule in words, the default below it.
    await page.getByTestId('sidebar-schedules').click();
    await expect(page.getByTestId('schedules-heading')).toBeVisible();
    const row = page.getByTestId('schedule-row').filter({ hasText: 'Demo – Foyer' });
    await expect(row.getByTestId('schedule-rule-line')).toHaveText(/So 09:00–12:00\s*→\s*Gottesdienst/);
    await expect(row.getByTestId('schedule-default-line')).toContainText('sonst');
    await expect(row.getByTestId('schedule-default-line')).toContainText('Wochenüberblick');
    await expect(row.getByTestId('schedule-now')).toContainText(/Gottesdienst|Wochenüberblick/);
    await expect(page.getByTestId('sidebar-schedules')).toHaveAttribute('aria-current', 'page');
    // When and by whom the schedule was last saved, below the rules, each on a line of its own (Plan.md 66).
    await expect(row.getByTestId('schedule-edited-at')).toHaveText(/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/);
    await expect(row.getByTestId('schedule-edited-by')).toHaveText(/\S/);
    const scheduleAt = (await row.getByTestId('schedule-edited-at').boundingBox())!;
    const scheduleBy = (await row.getByTestId('schedule-edited-by').boundingBox())!;
    expect(scheduleBy.y).toBeGreaterThanOrEqual(scheduleAt.y + scheduleAt.height - 1);
    await page.screenshot({ path: 'test-results/schedules.png' });

    // The week strip (Plan.md 68): seven days, joined to the rule lines in both directions.
    await expect(row.getByTestId('week-day')).toHaveCount(7);
    await expect(row.getByTestId('week-needle')).toHaveCount(1);
    const ruleSegments = row.locator('[data-testid="week-segment"][data-key="0"]');
    await expect(ruleSegments).toHaveCount(1); // Sundays only: once in seven days
    await expect(ruleSegments.first()).toHaveAttribute('aria-label', /^So 09:00–12:00: Gottesdienst – Regel 1$/);
    await row.getByTestId('schedule-rule-line').hover();
    await expect(ruleSegments.first()).toHaveAttribute('data-dim', 'false');
    await expect(row.locator('[data-testid="week-segment"][data-key="default"]').first()).toHaveAttribute('data-dim', 'true');
    await row.getByTestId('schedule-menu').hover();
    await expect(row.locator('[data-testid="week-segment"][data-key="default"]').first()).toHaveAttribute('data-dim', 'false');
    await ruleSegments.first().hover();
    await expect(row.getByTestId('schedule-rule-line')).toHaveClass(/linked/);
    await ruleSegments.first().click(); // chooses the preview like a click on the line
    await expect(row.getByTestId('schedule-rule-line').getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    await expect(row.getByTestId('schedule-mark')).toHaveText(/^(Läuft jetzt|Vorschau: Regel 1)$/);
    await row.locator('[data-testid="week-segment"][data-key="default"]').first().click();
    await expect(row.getByTestId('schedule-mark')).toHaveText(/^(Läuft jetzt|Vorschau: Standard)$/);
    await expect(row.getByTestId('schedule-playlist')).toHaveText(/Gottesdienst|Wochenüberblick/);

    await row.getByTestId('schedule-menu').click();
    await row.getByTestId('schedule-edit').click();
    await expect(page.getByTestId('schedule-dialog').getByTestId('schedule-rule')).toHaveCount(1);
    await page.getByTestId('schedule-cancel').click();

    // "Slides bearbeiten" in the schedule opens the playlist's editor.
    await page.getByTestId('sidebar-screens').click();
    await card.getByTestId('open-schedule').click();
    await dialog.getByTestId('playlist-edit').last().click();
    await expect(page.getByTestId('playlist-name-input')).toHaveValue('Gottesdienst');
    await expect(page.getByTestId('open-schedule')).toHaveCount(0); // the editor is for slides only
});

test('an appointment list shows every appointment page by page; the inspector says how it will run (Plan.md 23)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await page.getByTestId('slide-item').nth(2).click();
    await page.getByTestId('frame-appointment-list').first().click();
    await expect(page.getByTestId('page-seconds')).toHaveCount(0);
    await page.getByTestId('show-all').check();
    await expect(page.getByTestId('page-seconds')).toHaveValue('10');
    await expect(page.getByTestId('page-hint')).toContainText(/Alle Termine passen auf eine Seite|Ergibt \d+ Seiten/);
    await page.getByTestId('page-seconds').fill('12');
    await page.getByTestId('page-seconds').blur();
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Veröffentlicht');
    await page.screenshot({ path: 'test-results/editor-paged-list.png' });
});

test('the preview plays the unsaved draft like the TV, and saves nothing', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await addBlock(page, 'text');
    await page.getByTestId('text-input').fill('Nur in der Vorschau');
    await page.getByTestId('text-input').blur();
    await expect(page.getByTestId('save-status')).toHaveText(/Sichert …|Entwurf gesichert/);

    await page.getByTestId('open-preview').click();
    const preview = page.getByTestId('playlist-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('Vorschau – nicht gespeichert');
    await expect(preview.locator('.slide')).toContainText('Nur in der Vorschau'); // the selected slide, as edited
    await expect(page.getByTestId('preview-where')).toContainText('1/3 · Willkommen');
    await page.screenshot({ path: 'test-results/editor-preview.png' });

    // Step on by button and by key; hold with the space bar – the editor's keys do not fire behind it.
    await page.getByTestId('preview-next').click();
    await expect(page.getByTestId('preview-where')).toContainText('2/3');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('preview-where')).toContainText('3/3');
    await page.keyboard.press(' ');
    await expect(page.getByTestId('preview-where')).toContainText('angehalten');
    await page.keyboard.press('Backspace'); // would delete a selected block in the editor
    await page.keyboard.press('Escape');
    await expect(preview).toHaveCount(0);

    await expect(page.getByTestId('save-status')).toHaveText(/Sichert …|Entwurf gesichert/);
    await expect(page.locator('.editor-stage')).toContainText('Nur in der Vorschau'); // the block is still there
});

test('in the preview a long appointment list turns its pages, with a bar filling up per page (Plan.md 23)', async ({ page }) => {
    test.setTimeout(60_000);
    // ChurchTools' answer is simulated: 20 appointments, one a day from tomorrow.
    await page.route(/\/api\/calendars\/appointments/, (route) => {
        const data = Array.from({ length: 20 }, (_, i) => {
            const start = new Date();
            start.setDate(start.getDate() + 1 + i);
            start.setHours(10, 0, 0, 0);
            return {
                appointment: {
                    base: { id: i + 1, title: `Termin ${i + 1}`, allDay: false, calendar: { id: 1, name: 'Gemeinde' } },
                    calculated: { startDate: start.toISOString(), endDate: new Date(start.getTime() + 3_600_000).toISOString() },
                },
            };
        });
        return route.fulfill({ json: { data } });
    });
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await page.getByTestId('slide-item').nth(2).click();
    await page.getByTestId('frame-appointment-list').first().click();
    await page.getByTestId('show-all').check();
    // 3 pages × 10 s outlast the slide's 12 s: the slide list and the duration field say so.
    await expect(page.getByTestId('page-hint')).toContainText('Ergibt 3 Seiten à 10 s – die Folie läuft dafür 30 s statt 12 s');
    await expect(page.getByTestId('slide-duration').nth(2)).toHaveText('12 → 30 s');
    await page.getByTestId('show-all').blur(); // Esc is the editor's only outside a field
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('duration-hint')).toContainText('Läuft 30 s');
    await page.screenshot({ path: 'test-results/editor-longer-slide.png' });
    await page.getByTestId('frame-appointment-list').first().click();
    await page.getByTestId('page-seconds').fill('4');
    await page.getByTestId('page-seconds').blur();
    await expect(page.getByTestId('page-hint')).toContainText(/Ergibt \d+ Seiten/);
    await expect(page.getByTestId('slide-duration').nth(2)).toHaveText('12 s'); // 3 × 4 s fit into 12 s
    // While designing the list holds page 1, without a bar.
    await expect(page.locator('.editor-stage [data-testid="list-page"]')).toHaveText(/^1\//);
    await expect(page.locator('.editor-stage [data-testid="list-progress"]')).toHaveCount(0);

    await page.getByTestId('open-preview').click();
    const preview = page.getByTestId('playlist-preview');
    await expect(preview.getByTestId('list-progress')).toBeVisible();
    await expect(preview.getByTestId('list-page')).toHaveText(/^1\//);
    await page.waitForTimeout(2000);
    await preview.screenshot({ path: 'test-results/preview-paged-list.png' });
    await expect(preview.getByTestId('list-page')).toHaveText(/^2\//, { timeout: 6_000 });
    await expect(preview.getByTestId('preview-where')).toContainText('3/3 · Termine');
});

test('a locked block stays put: no drag, no keys, no fields, no delete – until unlocked (Plan.md 25)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await addBlock(page, 'text');
    const frames = page.getByTestId('frame-text');
    const count = await frames.count();
    const frame = frames.last();
    await page.getByTestId('lock-toggle').click();
    await expect(page.getByTestId('lock-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('frame-lock')).toBeVisible();
    await expect(page.getByTestId('text-input')).toBeDisabled();
    await page.screenshot({ path: 'test-results/editor-locked.png' });

    // Dragging and the arrow and delete keys change nothing. With Alt the pointer takes the locked
    // block itself – a plain click would reach through to one below it (Plan.md 25).
    const box = (await frame.boundingBox())!;
    await page.keyboard.down('Alt');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up('Alt');
    await expect(frame).toHaveClass(/frame--selected/);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Delete');
    expect(Math.round((await frame.boundingBox())!.x)).toBe(Math.round(box.x));
    await expect(frames).toHaveCount(count);

    await page.getByTestId('lock-toggle').click();
    await expect(page.getByTestId('text-input')).toBeEnabled();
    await page.keyboard.press('Delete');
    await expect(frames).toHaveCount(count - 1);
});

test('a click on a locked block reaches the one below; Alt-click takes the locked one (Plan.md 25)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    // Two texts in the same place: the second lies on top and gets locked.
    await addBlock(page, 'text');
    await addBlock(page, 'text');
    const frames = page.getByTestId('frame-text');
    const below = frames.nth((await frames.count()) - 2);
    const top = frames.last();
    await page.getByTestId('lock-toggle').click();
    await expect(top).toHaveClass(/frame--locked/);

    await page.getByTestId('grid').click({ position: { x: 5, y: 5 } }); // choose nothing
    const box = (await top.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(below).toHaveClass(/frame--selected/);
    await expect(page.getByTestId('lock-toggle')).toHaveAttribute('aria-pressed', 'false');

    await page.keyboard.down('Alt');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.up('Alt');
    await expect(top).toHaveClass(/frame--selected/);
    await expect(page.getByTestId('frame-lock')).toBeVisible();
});

test('duplicate a playlist and take slides over from another one, as copies (Plan.md 31)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('sidebar-playlists').click();
    const cards = page.getByTestId('playlist-card');
    await expect(cards.first()).toBeVisible();
    const before = await cards.count();
    await cards.first().getByTestId('playlist-menu').click();
    await page.getByTestId('duplicate-playlist').click();
    // Copy is the default of the dialog that asks (Plan.md 49).
    await expect(page.getByTestId('duplicate-copy')).toBeChecked();
    await page.getByTestId('duplicate-confirm').click();
    // The copy opens in the editor, with copies of all slides.
    await expect(page).toHaveURL(/playlists\/[\w-]+$/);
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await expect(page.getByTestId('playlist-name-input')).toHaveValue(/\(Kopie\)$/);

    // Take one slide over from the original.
    await page.getByTestId('import-slides').click();
    const dialog = page.getByTestId('slide-import');
    await expect(dialog.getByTestId('slide-import-item')).toHaveCount(3);
    await dialog.getByTestId('slide-import-item').first().click();
    await dialog.getByTestId('slide-import-take').click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('slide-item')).toHaveCount(4);
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Veröffentlicht');

    await page.goto('playlists');
    await expect(page.getByTestId('playlist-card')).toHaveCount(before + 1);
});

test('a countdown to the next appointment, and the band moved to "Hinweise" (Plan.md 32, 34)', async ({ page }) => {
    await mockAppointments(page);
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    const stage = page.locator('.editor-stage');

    await addBlock(page, 'countdown');
    // The mocked appointments start tomorrow at the earliest: days and hours.
    await expect(stage.getByTestId('countdown-time')).toHaveText(/^\d+ Tag(e)? \d+ Std\.$|^\d+:\d{2}:\d{2}$/);
    await expect(stage.getByTestId('countdown')).toContainText('beginnt in');
    await page.getByTestId('block-inspector').getByTestId('countdown-title').uncheck();
    await expect(stage.getByTestId('countdown')).toContainText('Beginnt in');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/editor-countdown.png' });

    // The band moved out of the inspector (Plan.md 34): it only links to "Hinweise" now.
    await page.getByTestId('grid').click({ position: { x: 5, y: 5 } }); // choose no block
    await openSection(page, 'playlist');
    await expect(page.getByTestId('banner-status')).toContainText('Kein Hinweisband');
    await expect(page.getByTestId('banner-status').getByRole('link', { name: 'Hinweise' })).toHaveAttribute('href', /\/hinweise$/);

    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Veröffentlicht');
});

/** At least one card on the stage, and every one inside the frame of its list. */
async function expectWholeCards(stage: Locator): Promise<void> {
    const cards = stage.getByTestId('list-card');
    await expect(cards.first()).toBeVisible();
    const frame = (await stage.getByTestId('frame-appointment-list').first().boundingBox())!;
    for (const card of await cards.all()) {
        const box = (await card.boundingBox())!;
        expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
    }
}

/** Four appointments in three calendars, with place and description – for the card layouts. */
async function mockAppointments(page: Page): Promise<void> {
    const services = [
        ['Gottesdienst', 'mit Kinderprogramm', 2, '#2e7d8c', 'Gemeindezentrum', 'Saal'],
        ['Jugendtreff', '', 1, '#c0613f', 'Jugendraum', null],
        ['Gemeindefrühstück', '', 3, '#4c9a5f', 'Foyer', null],
        ['Konzertabend', 'Chor und Band', 1, '#5c6bc0', 'Kirchsaal', null],
    ] as const;
    await page.route(/\/api\/calendars\/appointments/, (route) => {
        const data = services.map(([title, subtitle, calendar, color, name, addition], i) => {
            const start = new Date();
            start.setDate(start.getDate() + 1 + i * 3);
            start.setHours(10 + i, 0, 0, 0);
            return {
                appointment: {
                    base: {
                        id: i + 1,
                        title,
                        subtitle,
                        description: '<p>Der Gottesdienst am Sonntagmorgen mit Musik, Predigt und anschließendem Kirchencafé.</p>',
                        allDay: false,
                        calendar: { id: calendar, name: ['', 'Jugend', 'Gottesdienst', 'Gemeindeleben'][calendar], color },
                        address: { name, addition },
                    },
                    calculated: { startDate: start.toISOString(), endDate: new Date(start.getTime() + 5_400_000).toISOString() },
                },
            };
        });
        return route.fulfill({ json: { data } });
    });
}

test('list and next appointment in the look of the WordPress plugin: tile, label, day, time and place below each other (Plan.md 20)', async ({ page }) => {
    await mockAppointments(page);
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();

    await page.getByTestId('slide-item').nth(2).click();
    await page.getByTestId('frame-appointment-list').first().click();
    await choose(page, 'list-layout', 'cards');
    const stage = page.locator('.editor-stage');
    // Rows as tall as the plugin's: only those that fit whole – none cut off at the bottom.
    await expectWholeCards(stage);
    await expect(stage.getByTestId('list-card').first()).toContainText('Gemeindezentrum, Saal');
    await expect(stage.getByTestId('list-card').first()).toContainText(/Uhr/);
    await page.waitForTimeout(500);
    await stage.screenshot({ path: 'test-results/list-cards.png' });

    await page.getByTestId('slide-item').nth(1).click();
    await page.getByTestId('frame-next-appointment').first().click();
    await choose(page, 'next-layout', 'card');
    await expect(stage.getByTestId('next-card')).toContainText('Gottesdienst');
    await expect(stage.getByTestId('next-card')).toContainText('Gemeindezentrum, Saal');
    await expect(stage.getByTestId('next-card')).toContainText('anschließendem Kirchencafé');
    await page.waitForTimeout(500);
    await stage.screenshot({ path: 'test-results/next-card.png' });
});

test('the design page sets the look of all screens: corners, large appointments, image shape (Plan.md 27)', async ({ page }) => {
    await mockAppointments(page);
    await page.goto('./');
    await page.getByTestId('sidebar-design').click();
    await expect(page.getByTestId('design-heading')).toBeVisible();
    const preview = page.getByTestId('theme-preview');
    await expect(preview.getByTestId('list-card')).toHaveCount(0); // native: plain rows
    await expect(page.getByTestId('theme-save')).toBeDisabled();

    await page.getByTestId('appointments-large').check();
    await page.getByTestId('corners-square').check();
    // The preview shows the first calendars of the instance: which of the four appointments that is, is theirs to say.
    await expect(preview.getByTestId('list-card').first()).toBeVisible();
    await expect(preview.getByTestId('next-card')).toBeVisible();
    await expect(preview.locator('.slide')).toHaveAttribute('style', /--isd-radius: 0/);
    await page.getByTestId('theme-image-ratio').selectOption('1:1');
    await page.getByTestId('theme-accent').fill('#e11d48');
    await page.getByTestId('theme-accent').blur();
    await page.getByTestId('theme-save').click();
    await expect(page.getByTestId('theme-saved')).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/design-page.png' });

    // In the editor a list without a layout of its own follows the theme; one that chose keeps its choice.
    await page.getByTestId('sidebar-playlists').click();
    await page.getByTestId('playlist-card').first().getByTestId('open-playlist').click();
    await page.getByTestId('slide-item').nth(2).click();
    const stage = page.locator('.editor-stage');
    // Rows as tall as the plugin's: only those that fit whole – none cut off at the bottom.
    await expectWholeCards(stage);
    await page.getByTestId('frame-appointment-list').first().click();
    await expect.poll(() => chosen(page, 'list-layout')).toBe('');
    await choose(page, 'list-layout', 'rows');
    await expect(stage.getByTestId('list-card')).toHaveCount(0);

    // The preview plays in the theme too – its page bar in the accent colour (seen missing, 2026-09-25).
    await page.getByTestId('open-preview').click();
    await expect(page.getByTestId('playlist-preview').locator('.slide').first()).toHaveAttribute('style', /--isd-accent: #e11d48/);
});

test('the design page sets the card surface (Plan.md 74)', async ({ page, browserName }) => {
    await mockAppointments(page);
    await page.goto('./');
    await page.getByTestId('sidebar-design').click();
    await expect(page.getByTestId('design-heading')).toBeVisible();
    await page.getByTestId('appointments-large').check();
    const card = page.getByTestId('theme-preview').getByTestId('next-card');
    await expect(card).toBeVisible();
    const surface = () => card.evaluate((el) => getComputedStyle(el).backgroundColor);

    await page.getByTestId('cards-color').check();
    // The card colour offers the palette – at least accent, text and background of the design –, the other fields of the page none.
    expect(await page.getByTestId('theme-card-color-swatch').count()).toBeGreaterThanOrEqual(3);
    await expect(page.getByTestId('theme-accent-swatch')).toHaveCount(0);
    const cardColor = await customColor(page, 'theme-card-color');
    await cardColor.fill('#ff0000');
    await cardColor.blur();
    await page.getByTestId('theme-card-opacity').fill('50');
    await expect(page.getByTestId('theme-card-opacity')).toHaveValue('50');
    // `color-mix` comes back as `color(srgb 1 0 0 / 0.5)` or `rgba(255, 0, 0, 0.5)`, depending on the browser.
    await expect.poll(async () => {
        const numbers = (await surface()).match(/[\d.]+/g)?.map(Number) ?? [];
        const [r = 0, g = 1, b = 1, alpha = 1] = numbers.slice(-4);
        return r > 0.9 && g < 0.1 && b < 0.1 && Math.abs(alpha - 0.5) < 0.05;
    }).toBe(true);
    if (browserName === 'chromium') {
        await page.locator('#box-cards').evaluate((el) => el.scrollIntoView({ block: 'start' }));
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-results/design-cards.png' });
    }

    await page.getByTestId('cards-none').check();
    await expect.poll(surface).toBe('rgba(0, 0, 0, 0)');
});

test('the design page sets the font new blocks start with; blocks that exist keep theirs (Plan.md 40)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('sidebar-design').click();
    await chooseFont(page, 'theme-font', 'oswald');
    await page.getByTestId('theme-save').click();
    await expect(page.getByTestId('theme-saved')).toBeVisible();

    await page.getByTestId('sidebar-playlists').click();
    await page.getByTestId('playlist-card').first().getByTestId('open-playlist').click();
    const stage = page.locator('.editor-stage');
    // WebKit reports the name without quotes.
    const welcome = stage.locator('.block--text').filter({ hasText: 'Herzlich willkommen!' });
    await expect(welcome.locator('.text')).toHaveCSS('font-family', /^"?ISD Lato"?, sans-serif$/);
    await addBlock(page, 'text');
    await expect(page.getByTestId('font-family')).toHaveAttribute('data-value', 'oswald');
    await expect(stage.locator('.block--text').last().locator('.text')).toHaveCSS('font-family', /^"?ISD Oswald"?, sans-serif$/);
});

test('a website and a QR code (Plan.md 28)', async ({ page }) => {
    // No network in the test: the foreign page is answered here.
    await page.route('https://www.gemeinde.example/**', (route) =>
        route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Wochenblatt</title><h1>Wochenblatt</h1>' }),
    );
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    const stage = page.locator('.editor-stage');

    await addBlock(page, 'web');
    await expect(page.getByTestId('web-problem')).toContainText('Noch keine Adresse');
    // Typed without https://, as people do: the designer adds it.
    await page.getByTestId('web-url').fill('www.gemeinde.example/wochenblatt/');
    await page.getByTestId('web-url').press('Enter');
    await page.getByTestId('web-url').blur();
    await expect(page.getByTestId('web-url')).toHaveValue('https://www.gemeinde.example/wochenblatt/');
    const frame = stage.getByTestId('web-frame');
    await expect(frame).toHaveAttribute('src', 'https://www.gemeinde.example/wochenblatt/');
    await expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin');
    await expect(page.frameLocator('.editor-stage [data-testid="web-frame"]').locator('h1')).toHaveText('Wochenblatt');
    await page.getByTestId('web-zoom').selectOption('2');
    await expect(frame).toHaveAttribute('style', /scale\(2\)/);

    await addBlock(page, 'qr');
    await page.getByTestId('qr-data').fill('https://www.gemeinde.example/anmeldung/');
    await expect(stage.getByTestId('qr-code')).toBeVisible();
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Veröffentlicht');
    await page.waitForTimeout(500);
    await stage.screenshot({ path: 'test-results/web-and-qr.png' });
});

test('an embed code in the website block gives its address (Plan.md 55 C)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await addBlock(page, 'web');
    const field = page.getByTestId('web-url');
    await expect(page.locator('label[for="web-url-input"]')).toHaveText('Adresse oder Einbettungscode');

    await field.fill('<iframe src="//www.gemeinde.example/umfrage" width="600" height="400" allow="fullscreen"></iframe>');
    await field.press('Enter');
    await expect(field).toHaveValue('https://www.gemeinde.example/umfrage');
    await expect(page.locator('.editor-stage').getByTestId('web-frame')).toHaveAttribute('src', 'https://www.gemeinde.example/umfrage');
    await page.screenshot({ path: 'test-results/web-embed.png' });

    // A code without an address changes nothing and says why.
    await field.fill('<iframe width="600"></iframe>');
    await field.press('Enter');
    await expect(page.getByTestId('web-problem')).toHaveText('Im Einbettungscode steht keine Adresse.');
    await expect(field).toHaveValue('https://www.gemeinde.example/umfrage');
});

// Needs data of the own test instance (E2E_INSTANCE_DATA) and reads it (nur lesend, Plan.md 33): the group "ISD-Beitragstest" is public,
// posts are switched on, and it has posts – among them "Biete Akkuschrauber" with an image (Befunde G37).
// A fresh, empty slide keeps the card free of anything from the demo slides underneath it.
test('a posts block shows a public group\'s posts, as a card and as a list (Plan.md 33)', async ({ page }) => {
    test.skip(!process.env.E2E_INSTANCE_DATA, 'Setzt Daten der eigenen Testinstanz voraus (öffentliche Gruppe „ISD-Beitragstest“ mit Beiträgen) – nur mit E2E_INSTANCE_DATA=1.');
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await page.getByTestId('add-slide').click();
    await expect(page.getByTestId('slide-item')).toHaveCount(4);

    await addBlock(page, 'posts');
    const inspector = page.getByTestId('block-inspector');
    await openSection(page, 'post-groups');
    const group = inspector.getByRole('switch', { name: /ISD-Beitragstest/ });
    await expect(group).toBeVisible({ timeout: 15_000 }); // the group list comes from ChurchTools
    await group.check();

    const stage = page.locator('.editor-stage');
    const card = stage.getByTestId('posts-card');
    await expect(card).toBeVisible({ timeout: 15_000 }); // the posts themselves too
    await expect(card).not.toContainText('Keine aktuellen Beiträge');
    await page.waitForTimeout(300);
    await stage.screenshot({ path: 'test-results/editor-posts-card.png' });
    await expect(card).toHaveClass(/hero--landscape/); // default size, 1400 × 700
    await card.screenshot({ path: `test-results/posts-card-landscape.png` });

    // Hochkant: the same post, now with its image above the text instead of beside it.
    await openSection(page, 'measures');
    await inspector.getByTestId('inspector-width').fill('700');
    await inspector.getByTestId('inspector-height').fill('1000');
    await inspector.getByTestId('inspector-height').blur();
    await expect(card).toHaveClass(/hero--portrait/);
    await page.waitForTimeout(300);
    await card.screenshot({ path: `test-results/posts-card-portrait.png` });

    // Ohne Bild: back to the default size, with "Bild zeigen" switched off.
    await inspector.getByTestId('inspector-width').fill('1400');
    await inspector.getByTestId('inspector-height').fill('700');
    await inspector.getByTestId('inspector-height').blur();
    const showImage = inspector.getByTestId('posts-image');
    await showImage.uncheck();
    await expect(card.getByTestId('post-image')).toHaveCount(0);
    await page.waitForTimeout(300);
    await card.screenshot({ path: `test-results/posts-card-text.png` });
    await showImage.check();

    await choose(inspector, 'posts-layout', 'list');
    await expect(stage.getByTestId('posts-list')).toBeVisible();
    await expect(stage.getByTestId('post-row').first()).toBeVisible();
    await page.waitForTimeout(300);
    await stage.screenshot({ path: 'test-results/editor-posts-list.png' });
});

// Needs data of the own test instance (E2E_INSTANCE_DATA) and reads it (nur lesend, Plan.md 43): the homepage at group 10, titled "Gottesdienst |
// Gottesdienste", holds group 8 "Kinderkirche" among its groups, with a leader entered (Befunde G40).
test('a groups block shows a group homepage\'s groups, as a card and as a list (Plan.md 43)', async ({ page }) => {
    test.skip(!process.env.E2E_INSTANCE_DATA, 'Setzt Daten der eigenen Testinstanz voraus (Gruppen-Homepage „Gottesdienst | Gottesdienste“ mit der Gruppe „Kinderkirche“) – nur mit E2E_INSTANCE_DATA=1.');
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await page.getByTestId('add-slide').click();
    await expect(page.getByTestId('slide-item')).toHaveCount(4);

    await addBlock(page, 'groups');
    const inspector = page.getByTestId('block-inspector');
    const homepageSelect = inspector.getByTestId('groups-homepage');
    // The title carries a non-breaking space ("Gottesdienst | Gottesdienste") – matched by value, not by label.
    const homepageOption = homepageSelect.locator('option', { hasText: 'Gottesdienst' });
    await expect(homepageOption).toHaveCount(1, { timeout: 15_000 }); // the homepage list comes from ChurchTools
    await homepageSelect.selectOption((await homepageOption.getAttribute('value'))!);

    const stage = page.locator('.editor-stage');
    const card = stage.getByTestId('groups-card');
    await expect(card).toBeVisible({ timeout: 15_000 }); // the homepage's groups themselves too
    await expect(card).toContainText('Kinderkirche');
    await expect(card.getByTestId('group-qr')).toBeVisible();
    await page.waitForTimeout(300);
    await stage.screenshot({ path: 'test-results/editor-groups-card.png' });
    const groupCard = card.getByTestId('group-card');
    await expect(groupCard).toHaveClass(/hero--landscape/); // default size, 1400 × 700
    await card.screenshot({ path: `test-results/groups-card-landscape.png` });

    // Hochkant: the same group, now with its image above the text instead of beside it.
    await openSection(page, 'measures');
    await inspector.getByTestId('inspector-width').fill('700');
    await inspector.getByTestId('inspector-height').fill('1000');
    await inspector.getByTestId('inspector-height').blur();
    await expect(groupCard).toHaveClass(/hero--portrait/);
    await page.waitForTimeout(300);
    await card.screenshot({ path: `test-results/groups-card-portrait.png` });

    // Back to the default size before switching to the list.
    await inspector.getByTestId('inspector-width').fill('1400');
    await inspector.getByTestId('inspector-height').fill('700');
    await inspector.getByTestId('inspector-height').blur();

    // Two a page: in a 16:9 block side by side, each a portrait card. How many groups the homepage
    // holds is up to whoever tends the test instance – one page without a bar, or more with one.
    await inspector.getByTestId('inspector-width').fill('1600');
    await inspector.getByTestId('inspector-height').fill('900');
    await inspector.getByTestId('inspector-height').blur();
    await choose(inspector, 'groups-per-page', '2');
    await expect(groupCard.first()).toHaveClass(/hero--portrait/);
    const shownCards = await groupCard.count();
    expect(shownCards).toBeGreaterThanOrEqual(1);
    expect(shownCards).toBeLessThanOrEqual(2);
    if (shownCards === 2) await expect(card.getByTestId('groups-pager')).toContainText('1/');
    await page.waitForTimeout(300);
    await card.screenshot({ path: `test-results/groups-card-two-a-page.png` });

    await openSection(page, 'fields');
    await inspector.getByTestId('group-show-leaders').check();
    await expect(card.getByTestId('group-leaders').first()).toBeVisible();

    // Four a page with the leaders' pictures, as the user tried it on the test instance.
    await expect(inspector.getByTestId('group-show-leaderImages')).toBeEnabled();
    await inspector.getByTestId('group-show-leaderImages').check();
    // One to four a page, for comparing them side by side (third test, 2026-09-29).
    for (const perPage of ['1', '2', '3', '4']) {
        await choose(inspector, 'groups-per-page', perPage);
        await page.waitForTimeout(600);
        await card.screenshot({ path: `test-results/groups-card-${perPage}-a-page.png` });
    }

    await choose(inspector, 'groups-layout', 'list');
    const list = stage.getByTestId('groups-list');
    await expect(list).toBeVisible();
    await expect(stage.getByTestId('group-row').filter({ hasText: 'Kinderkirche' })).toBeVisible();
    await page.waitForTimeout(300);
    await stage.screenshot({ path: 'test-results/editor-groups-list.png' });
    await list.screenshot({ path: `test-results/groups-list.png` });
});

test('the blocks stand in German alphabetical order in the "+ Baustein" sheet; the old row is gone (Plan.md 47)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await expect(page.getByTestId('add-text')).toHaveCount(0);

    await page.getByTestId('add-block-menu').click();
    const sheet = page.getByTestId('block-sheet');
    await expect(sheet).toBeVisible();
    const types = await sheet.locator('[data-testid^="sheet-add-"]').evaluateAll((buttons) =>
        buttons.map((b) => b.getAttribute('data-testid')!.replace('sheet-add-', '')),
    );
    // Beiträge, Bild, Countdown, Fläche, Galerie, Gemeindekopf, Gruppen, Nächster Termin, QR-Code, Raumbelegung, Terminliste, Text, Uhr, Video, Webseite
    expect(types).toEqual([
        'posts',
        'image',
        'countdown',
        'shape',
        'slideshow',
        'church-header',
        'groups',
        'next-appointment',
        'qr',
        'rooms',
        'appointment-list',
        'text',
        'clock',
        'video',
        'web',
    ]);
});

test('"Genaue Maße" starts folded and stays open for the next block and after a reload (Plan.md 47)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await addBlock(page, 'text');
    await expect(page.getByTestId('section-measures')).not.toHaveAttribute('open', '');
    await expect(page.getByTestId('inspector-x')).toBeHidden();

    await openSection(page, 'measures');
    await expect(page.getByTestId('inspector-x')).toBeVisible();
    await addBlock(page, 'clock');
    await expect(page.getByTestId('section-measures')).toHaveAttribute('open', '');
    await expect(page.getByTestId('inspector-x')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('leave-editor')).toBeVisible();
    await page.getByTestId('frame-text').last().click({ position: { x: 12, y: 12 } });
    await expect(page.getByTestId('section-measures')).toHaveAttribute('open', '');
});

test('a locked block: delete is off, sections still fold, fields stay locked (Plan.md 47)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await addBlock(page, 'text');
    await expect(page.getByTestId('block-delete')).toBeEnabled();
    await page.getByTestId('lock-toggle').click();
    await expect(page.getByTestId('block-delete')).toBeDisabled();

    await page.getByTestId('section-measures-toggle').click();
    await expect(page.getByTestId('section-measures')).toHaveAttribute('open', '');
    await expect(page.getByTestId('inspector-x')).toBeDisabled();
    await page.getByTestId('section-measures-toggle').click();
    await expect(page.getByTestId('section-measures')).not.toHaveAttribute('open', '');
});

test('an explanation stays behind its (i) until asked for (Plan.md 47)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await addBlock(page, 'qr');
    await openSection(page, 'appearance');
    const inspector = page.getByTestId('block-inspector');
    const hint = inspector.getByText('Dunkel auf hell lesen alle Handykameras am sichersten.');
    await expect(hint).toHaveCount(0);
    const info = inspector.getByRole('button', { name: 'Erklärung' });
    await expect(info).toHaveAttribute('aria-expanded', 'false');
    await info.click();
    await expect(info).toHaveAttribute('aria-expanded', 'true');
    await expect(hint).toBeVisible();
    await info.click();
    await expect(hint).toHaveCount(0);
});

test('the block is layered from the "Anordnen" section and deleted from its header (Plan.md 47, 79)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await addBlock(page, 'shape');
    const frames = page.getByTestId('frame-shape');
    const count = await frames.count();
    await openSection(page, 'arrange');
    await page.getByTestId('layer-back').click();
    await page.getByTestId('block-delete').click();
    await expect(frames).toHaveCount(count - 1);
});

/** The centre of a button, and how far it stands from the top-left corner of the rail around it. */
async function railButton(page: Page, testid: string, rail: string): Promise<{ centerY: number; left: number; top: number; width: number; height: number }> {
    const [button, around] = await Promise.all([page.getByTestId(testid).boundingBox(), page.locator(rail).boundingBox()]);
    return { centerY: button!.y + button!.height / 2, left: button!.x - around!.x, top: button!.y - around!.y, width: button!.width, height: button!.height };
}

test.describe('the heads of the editor stand on one line (Plan.md 47)', () => {
    async function openEditor(page: Page): Promise<void> {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('add-block-menu')).toBeVisible();
    }

    test('at a desktop the slides head, "+ Baustein" and the inspector head are equally tall and flush; the columns are cards with air around them', async ({ page }) => {
        await openEditor(page);
        await page.getByTestId('frame-text').first().click();
        await expect(page.getByTestId('block-inspector')).toBeVisible();
        const [slides, palette, inspector] = await Promise.all([
            page.locator('.header-desktop').boundingBox(),
            page.locator('.block-palette').boundingBox(),
            page.locator('.drawer-head').boundingBox(),
        ]);
        expect(Math.abs(slides!.height - palette!.height)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(inspector!.height - palette!.height)).toBeLessThanOrEqual(0.5);
        const bottom = (b: { y: number; height: number }) => b.y + b.height;
        expect(Math.abs(slides!.y - palette!.y)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(inspector!.y - palette!.y)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(bottom(slides!) - bottom(palette!))).toBeLessThanOrEqual(0.5);
        expect(Math.abs(bottom(inspector!) - bottom(palette!))).toBeLessThanOrEqual(0.5);

        // Plan.md 79, B3: no rules between the columns, but two cards on the workspace, 12 px from it and from the stage column.
        const cards = await Promise.all([page.locator('.slide-list'), page.locator('.inspector-sheet'), page.locator('.editor')].map((l) => l.evaluate((el) => {
            const style = getComputedStyle(el);
            return { shadow: style.boxShadow, radius: style.borderTopLeftRadius, borderLeft: style.borderLeftWidth, borderRight: style.borderRightWidth, background: style.backgroundColor };
        })));
        for (const card of cards.slice(0, 2)) {
            expect(card.shadow).not.toBe('none');
            expect(parseFloat(card.radius)).toBeGreaterThan(0);
            expect(card.borderLeft).toBe('0px');
            expect(card.borderRight).toBe('0px');
            expect(card.background).not.toBe(cards[2]!.background);
        }
        const [list, column, panel, root] = await Promise.all([
            page.locator('.slide-list').boundingBox(),
            page.locator('.stage-column').boundingBox(),
            page.locator('.inspector-sheet').boundingBox(),
            page.locator('.editor').boundingBox(),
        ]);
        expect(Math.abs(list!.x - root!.x - 12)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(column!.x - (list!.x + list!.width) - 12)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(panel!.x - (column!.x + column!.width) - 12)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(root!.x + root!.width - (panel!.x + panel!.width) - 12)).toBeLessThanOrEqual(0.5);
    });

    test('"Einklappen" is a button with a name and no words', async ({ page }) => {
        await openEditor(page);
        const button = page.getByTestId('desktop-inspector-collapse');
        await expect(button).toHaveText('');
        await expect(button).toHaveAccessibleName('Einklappen');
    });

    test('folded at a desktop, the rails carry their buttons in the head zone with air around them', async ({ page }) => {
        await openEditor(page);
        await page.getByTestId('slides-collapse').click();
        await page.getByTestId('desktop-inspector-collapse').click();
        const palette = (await page.getByTestId('add-block-menu').boundingBox())!;
        for (const [testid, rail] of [
            ['tablet-slides-toggle', '.tablet-rail--slides'],
            ['tablet-inspector-toggle', '.tablet-rail--inspector'],
        ] as const) {
            const b = await railButton(page, testid, rail);
            expect(Math.abs(b.centerY - (palette.y + palette.height / 2))).toBeLessThanOrEqual(1);
            expect(b.left).toBeGreaterThanOrEqual(8);
            expect(b.top).toBeGreaterThanOrEqual(8);
            expect(b.width).toBe(36);
            expect(b.height).toBe(36);
        }
        const railBox = (await page.locator('.tablet-rail--slides').boundingBox())!;
        expect(railBox.width).toBe(53); // 8.5 + 36 + 8.5: a card as wide as the rail was
    });

    for (const [name, viewport] of [
        ['lying', { width: 1180, height: 820 }],
        ['upright', { width: 820, height: 1180 }],
    ] as const) {
        test(`on a tablet ${name}, the slides button stands level with "+ Baustein" and clear of the edge`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await openEditor(page);
            const palette = (await page.getByTestId('add-block-menu').boundingBox())!;
            const b = await railButton(page, 'tablet-slides-toggle', '.tablet-rail--slides');
            expect(Math.abs(b.centerY - (palette.y + palette.height / 2))).toBeLessThanOrEqual(1);
            expect(b.left).toBeGreaterThanOrEqual(8);
            expect(b.top).toBeGreaterThanOrEqual(8);
        });
    }

    test('on a tablet lying down, the inspector rail button stands level too', async ({ page }) => {
        await page.setViewportSize({ width: 1180, height: 820 });
        await openEditor(page);
        const palette = (await page.getByTestId('add-block-menu').boundingBox())!;
        const b = await railButton(page, 'tablet-inspector-toggle', '.tablet-rail--inspector');
        expect(Math.abs(b.centerY - (palette.y + palette.height / 2))).toBeLessThanOrEqual(1);
        expect(b.left).toBeGreaterThanOrEqual(8);
        expect(b.top).toBeGreaterThanOrEqual(8);
    });
});

async function copyButtonColor(page: Page): Promise<string> {
    return page.getByTestId('block-copy').evaluate((el) => getComputedStyle(el).color);
}

test.describe('the slides "<" and the two-line block head (Plan.md 47)', () => {
    async function openEditor(page: Page): Promise<void> {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('add-block-menu')).toBeVisible();
    }

    for (const [name, viewport] of [
        ['lying', { width: 1180, height: 820 }],
        ['upright', { width: 820, height: 1180 }],
    ] as const) {
        test(`on a tablet ${name}, "<" in the drawer shuts it and the focus goes back to the slides button`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await openEditor(page);
            await page.getByTestId('tablet-slides-toggle').click();
            await expect(page.getByTestId('slide-item').first()).toBeVisible();
            await expect(page.getByTestId('slides-collapse')).toBeVisible();
            await page.getByTestId('slides-collapse').click();
            await expect(page.getByTestId('slide-item').first()).not.toBeVisible();
            await expect(page.getByTestId('tablet-slides-toggle')).toBeFocused();
        });
    }

    test('at a desktop, lock, duplicate and copy are 40 px symbol buttons on the left, the wastebasket alone on the right, below the name (Plan.md 79, B3)', async ({ page }) => {
        await openEditor(page);
        await page.getByTestId('add-block-menu').click();
        await page.getByTestId('sheet-add-next-appointment').click();
        await expect(page.getByTestId('block-inspector')).toBeVisible();
        for (const type of ['next-appointment', 'text']) {
            if (type === 'text') {
                await page.getByTestId('add-block-menu').click();
                await page.getByTestId('sheet-add-text').click();
            }
            const [h3, lock, duplicate, copy, remove, head] = await Promise.all([
                page.locator('.block-head h3').boundingBox(),
                ...['lock-toggle', 'block-duplicate', 'block-copy', 'block-delete'].map((id) => page.getByTestId(id).boundingBox()),
                page.locator('.head-actions').boundingBox(),
            ]);
            for (const box of [lock, duplicate, copy, remove]) {
                expect(Math.round(box!.width)).toBe(40);
                expect(Math.round(box!.height)).toBe(40);
                expect(Math.abs(box!.y - lock!.y)).toBeLessThanOrEqual(1);
                expect(box!.y).toBeGreaterThan(h3!.y + h3!.height);
            }
            expect(duplicate!.x).toBeGreaterThan(lock!.x);
            expect(copy!.x).toBeGreaterThan(duplicate!.x);
            expect(remove!.x).toBeGreaterThan(copy!.x + copy!.width);
            expect(Math.abs(remove!.x + remove!.width - (head!.x + head!.width))).toBeLessThanOrEqual(1);
            // Red only on the wastebasket.
            expect(await page.getByTestId('block-delete').evaluate((el) => getComputedStyle(el).color)).not.toBe(await copyButtonColor(page));
        }
    });
});

// A scrollbar that takes space (a mouse on a Mac, most of Windows) narrows the list once the slides no longer fit:
// the thumbnail must follow, or it sticks out of its tile's frame (seen on a playlist of nine slides, 2026-10-02).
test('with a scrollbar that takes space, every thumbnail stays inside its tile', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Only Chromium lets a test force a classic scrollbar');
    await page.setViewportSize({ width: 1400, height: 520 });
    await page.goto('./');
    await page.addStyleTag({ content: '#slide-list-ol::-webkit-scrollbar { width: 15px; }' });
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    const list = page.locator('#slide-list-ol');
    await expect.poll(() => list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await expect
        .poll(() =>
            page.getByTestId('slide-item').evaluateAll((items) =>
                items.every((item) => {
                    const thumb = item.querySelector('.thumb')!.getBoundingClientRect();
                    const tile = item.getBoundingClientRect();
                    return thumb.right <= tile.right - 8 && thumb.left >= tile.left + 8;
                }),
            ),
        )
        .toBe(true);
    await page.locator('.slide-list').screenshot({ path: 'test-results/slide-list-scrollbar.png' });
});

test('capitals show on the stage while the stored text stays as typed (Plan.md 65)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await addBlock(page, 'text');
    await page.getByTestId('text-input').fill('Gemeindefest am Samstag');
    const shown = page.locator('.editor-stage').getByText('Gemeindefest am Samstag');
    await expect(shown).toHaveCSS('text-transform', 'none');

    await openSection(page, 'font');
    await page.getByTestId('text-uppercase').check();
    await expect(shown).toHaveCSS('text-transform', 'uppercase');
    await expect(page.getByTestId('text-input')).toHaveValue('Gemeindefest am Samstag');

    await page.getByTestId('text-uppercase').uncheck();
    await expect(shown).toHaveCSS('text-transform', 'none');
});

// A made-up homepage, so that it runs without the test instance: three groups, weekdays against names.
test('a groups block sorts every group by weekday, name A–Z or Z–A, until a choice is made (Plan.md 72)', async ({ page }) => {
    const group = (id: number, name: string, weekday: { id: number; name: string; sortKey: number }) => ({
        id,
        name,
        maxMemberCount: null,
        currentMemberCount: 0,
        requestedSeatsCount: 0,
        allowWaitinglist: false,
        information: {
            note: '',
            imageUrl: null,
            meetingTime: '19:00',
            weekday: { ...weekday, nameTranslated: weekday.name },
            leader: [],
        },
    });
    await page.route('**/api/**', (route) => {
        const path = new URL(route.request().url()).pathname.replace(/^.*?\/api/, '');
        const json = (data: unknown) => route.fulfill({ json: { data } });
        if (route.request().method() !== 'GET') return json({});
        if (path === '/grouphomepages') {
            return json([
                {
                    domainType: 'grouphomepage',
                    domainIdentifier: '1',
                    title: 'Kleingruppen',
                    apiUrl: 'http://localhost/api/grouphomepages/kleingruppen',
                    domainAttributes: { parentGroupId: 40, childGroupIds: [41, 42, 43] },
                },
            ]);
        }
        if (path === '/grouphomepages/kleingruppen') {
            return json({
                showLeaders: false,
                showGroupImages: false,
                groups: [
                    group(41, 'Chor', { id: 4, name: 'Donnerstag', sortKey: 3 }),
                    group(42, 'Bibelkreis', { id: 1, name: 'Montag', sortKey: 0 }),
                    group(43, 'Zeltlager', { id: 3, name: 'Mittwoch', sortKey: 2 }),
                ],
            });
        }
        return route.continue();
    });
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await page.getByTestId('add-slide').click();
    await addBlock(page, 'groups');
    const inspector = page.getByTestId('block-inspector');
    await inspector.getByTestId('groups-homepage').selectOption('40');
    await choose(inspector, 'groups-layout', 'list');

    const rows = page.locator('.editor-stage').getByTestId('group-row');
    const sort = inspector.getByTestId('groups-sort');
    await expect.poll(() => chosen(inspector, 'groups-sort')).toBe('weekday');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Bibelkreis');
    await expect(rows.nth(2)).toContainText('Chor');

    await choose(inspector, 'groups-sort', 'name-asc');
    await expect(rows.nth(0)).toContainText('Bibelkreis');
    await expect(rows.nth(1)).toContainText('Chor');
    await expect(rows.nth(2)).toContainText('Zeltlager');

    await choose(inspector, 'groups-sort', 'name-desc');
    await expect(rows.nth(0)).toContainText('Zeltlager');
    await expect(rows.nth(1)).toContainText('Chor');
    await expect(rows.nth(2)).toContainText('Bibelkreis');

    // Choosing one by one starts in the order just seen; the order control has no place there.
    await inspector.getByTestId('groups-all').uncheck();
    await openSection(page, 'group-list');
    await expect(sort).toHaveCount(0);
    const picks = inspector.getByTestId('group-row');
    await expect(picks).toHaveCount(3);
    await expect(picks.nth(0)).toContainText('Zeltlager');
    await expect(picks.nth(1)).toContainText('Chor');
    await expect(picks.nth(2)).toContainText('Bibelkreis');
});

test('Ctrl+D lays a copy beside the block; Ctrl+C on one slide and Ctrl+V on another put it on the same spot (Plan.md 79, A5)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await addBlock(page, 'shape');
    const frames = page.getByTestId('frame-shape');
    const before = await frames.count();
    const first = (await frames.last().boundingBox())!;

    await page.keyboard.press('ControlOrMeta+d');
    await expect(frames).toHaveCount(before + 1);
    const copy = (await frames.last().boundingBox())!;
    expect(copy.x).toBeGreaterThan(first.x + 5);
    expect(copy.y).toBeGreaterThan(first.y + 5);
    await expect(frames.last()).toHaveClass(/frame--selected/);

    // The first copy is gone from the slide by an undo; copy the original and paste on another slide.
    await page.keyboard.press('ControlOrMeta+z');
    await expect(frames).toHaveCount(before);
    await frames.last().click();
    await page.keyboard.press('ControlOrMeta+c');
    await expect(page.getByTestId('paste-block')).toBeVisible();
    await page.getByTestId('slide-item').nth(1).click();
    const onSecond = await page.getByTestId('frame-shape').count();
    await page.keyboard.press('ControlOrMeta+v');
    await expect(page.getByTestId('frame-shape')).toHaveCount(onSecond + 1);
    const pasted = (await page.getByTestId('frame-shape').last().boundingBox())!;
    expect(Math.abs(pasted.x - first.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(pasted.y - first.y)).toBeLessThanOrEqual(1);

    // The same with the buttons: "Einfügen" above the stage, "Duplizieren" in the inspector.
    await page.getByTestId('paste-block').click();
    await expect(page.getByTestId('frame-shape')).toHaveCount(onSecond + 2);
    await page.getByTestId('block-duplicate').click();
    await expect(page.getByTestId('frame-shape')).toHaveCount(onSecond + 3);
});

test('a second "+ Text" does not land on the first (Plan.md 79, A6)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await page.getByTestId('add-slide').click();
    await addBlock(page, 'text');
    await addBlock(page, 'text');
    const frames = page.getByTestId('frame-text');
    await expect(frames).toHaveCount(2);
    const [a, b] = [(await frames.first().boundingBox())!, (await frames.last().boundingBox())!];
    expect(b.x - a.x).toBeGreaterThan(5);
    expect(b.y - a.y).toBeGreaterThan(5);
});

test('the distances show while a block is dragged and are gone afterwards, the same size at any zoom (Plan.md 79, A1)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await page.getByTestId('add-slide').click();
    await addBlock(page, 'text');
    await expect(page.getByTestId('measure')).toHaveCount(0);
    const heights: number[] = [];
    for (const width of [1440, 1100]) {
        await page.setViewportSize({ width, height: 900 });
        // The stage refits a moment after the window changes (ResizeObserver); under load reading the box at once
        // found the old place, the press missed the block and nothing was dragged. Wait until it stands still.
        await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
        let box = (await page.getByTestId('frame-text').boundingBox())!;
        await expect
            .poll(async () => {
                const next = (await page.getByTestId('frame-text').boundingBox())!;
                const still = next.x === box.x && next.y === box.y && next.width === box.width;
                box = next;
                return still;
            })
            .toBe(true);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20, { steps: 4 });
        await expect(page.getByTestId('measure').first()).toBeVisible();
        await expect(page.getByTestId('frame-size')).toContainText(' × ');
        heights.push((await page.getByTestId('frame-size').boundingBox())!.height);
        await page.mouse.up();
        await expect(page.getByTestId('measure')).toHaveCount(0);
        await expect(page.getByTestId('frame-size')).toHaveCount(0);
    }
    expect(Math.abs(heights[0]! - heights[1]!)).toBeLessThanOrEqual(1.5);
});

test('with Alt held over another block, the distances between it and the chosen one show (Plan.md 79, A2)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await page.getByTestId('add-slide').click();
    await addBlock(page, 'qr');
    const qr = (await page.getByTestId('frame-qr').boundingBox())!;
    await addBlock(page, 'clock');
    await expect(page.getByTestId('measure')).toHaveCount(0);
    // Both lie around the middle; move the clock to the right edge so they stand beside each other.
    const clock = page.getByTestId('frame-clock');
    const cbox = (await clock.boundingBox())!;
    await page.mouse.move(cbox.x + cbox.width / 2, cbox.y + cbox.height / 2);
    await page.mouse.down();
    await page.mouse.move(cbox.x + cbox.width / 2 + qr.width + 120, cbox.y + cbox.height / 2 + 60, { steps: 5 });
    await page.mouse.up();
    // The clock's short menu would cover the corner of the code: choose no block first.
    await page.getByTestId('grid').click({ position: { x: 5, y: 5 } });
    await page.getByTestId('frame-qr').click({ position: { x: 4, y: 4 } });
    await page.getByTestId('frame-clock').hover();
    await page.keyboard.down('Alt');
    await expect(page.getByTestId('measure').first()).toBeVisible();
    await page.keyboard.up('Alt');
    await expect(page.getByTestId('measure')).toHaveCount(0);
});

test('an empty slide says so, and its button opens the same sheet as "+ Baustein" (Plan.md 79, A7)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('empty-slide')).toHaveCount(0);
    await page.getByTestId('add-slide').click();
    const empty = page.getByTestId('empty-slide');
    await expect(empty).toContainText('Diese Folie ist noch leer.');
    await page.getByTestId('empty-slide-add').click();
    await expect(page.getByTestId('block-sheet')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('block-sheet')).toHaveCount(0);
    await expect(empty).toBeVisible();
    await page.getByTestId('empty-slide-add').click();
    await page.getByTestId('sheet-add-text').click();
    await expect(page.getByTestId('empty-slide')).toHaveCount(0);
});

test('the "+ Baustein" sheet describes each block and searches name and sentence (Plan.md 79, C7)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await page.getByTestId('add-block-menu').click();
    const sheet = page.getByTestId('block-sheet');
    const search = page.getByTestId('block-search');
    await expect(search).toBeFocused();
    await expect(search).toHaveValue('');
    await expect(sheet.getByTestId('sheet-add-rooms')).toContainText('Wer heute welchen Raum belegt');

    // "ae" finds the "ä" of "Nächster Termin" and of "Fläche".
    await search.fill('naechster');
    await expect(sheet.locator('[data-testid^="sheet-add-"]')).toHaveCount(1);
    await expect(sheet.getByTestId('sheet-add-next-appointment')).toBeVisible();
    await search.fill('FLAECHE');
    await expect(sheet.getByTestId('sheet-add-shape')).toBeVisible();
    // The sentence is searched, too.
    await search.fill('kalender');
    await expect(sheet.getByTestId('sheet-add-appointment-list')).toBeVisible();

    await search.fill('xyzzy');
    await expect(sheet.locator('[data-testid^="sheet-add-"]')).toHaveCount(0);
    await expect(page.getByTestId('block-search-empty')).toHaveText('Kein Baustein gefunden');

    // Escape in the field closes the sheet; the next opening starts with an empty search.
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await page.getByTestId('add-block-menu').click();
    await expect(page.getByTestId('block-search')).toHaveValue('');
    await expect(page.getByTestId('block-sheet').locator('[data-testid^="sheet-add-"]')).toHaveCount(16);
});

test('a new text begins as a heading; the text level sets size and weight in one step (Plan.md 79, C8)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await addBlock(page, 'text');
    const level = page.getByTestId('text-level');
    await expect(level.locator('input[value="heading"]')).toBeChecked();
    await openSection(page, 'font');
    await expect(page.getByTestId('font-size').locator('input').or(page.getByTestId('font-size'))).toHaveValue('96');

    await choose(page, 'text-level', 'body');
    await expect(level.locator('input[value="body"]')).toBeChecked();
    await expect(page.getByTestId('font-size').locator('input').or(page.getByTestId('font-size'))).toHaveValue('44');
    await expect(page.getByTestId('font-weight').locator('input[value="400"]')).toBeChecked();

    await page.keyboard.press('ControlOrMeta+z');
    await expect(level.locator('input[value="heading"]')).toBeChecked();
});

test.describe('on a phone (Plan.md 79)', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('the empty slide fits the stage, and the inspector head has the four buttons as symbols with names', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await (await openSlides(page)).getByTestId('add-slide').click();
        const [stage, empty] = await Promise.all([page.locator('.editor-stage').boundingBox(), page.getByTestId('empty-slide').boundingBox()]);
        expect(empty!.x).toBeGreaterThanOrEqual(stage!.x - 1);
        expect(empty!.x + empty!.width).toBeLessThanOrEqual(stage!.x + stage!.width + 1);
        expect(empty!.y + empty!.height).toBeLessThanOrEqual(stage!.y + stage!.height + 1);
        await page.getByTestId('empty-slide-add').click();
        await page.getByTestId('sheet-add-text').click();
        await openInspector(page);
        await expect(page.getByTestId('block-inspector')).toBeVisible();
        for (const [id, name] of [
            ['lock-toggle', 'Sperren'],
            ['block-duplicate', 'Baustein duplizieren'],
            ['block-copy', 'Baustein kopieren'],
            ['block-delete', 'Baustein löschen'],
        ]) {
            await expect(page.getByTestId(id!)).toHaveAccessibleName(name!);
            await expect(page.getByTestId(id!)).toBeVisible();
        }
    });
});

/** The names of the slides in the list, in order – the phone's tiles show no name, but carry it in their label. */
async function slideNames(page: Page): Promise<string[]> {
    const labels = await page.getByTestId('slide-item').evaluateAll((items) => items.map((item) => item.getAttribute('aria-label') ?? ''));
    return labels.map((label) => label.replace(/^\d+\. /, ''));
}

test.describe('sorting by dragging (Plan.md 79, D7)', () => {
    test('slides: dragged by the handle or moved with the arrow keys, each move one step to undo', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('slide-item')).toHaveCount(3);
        const [a, b, c] = await slideNames(page);
        await expect(page.getByTestId('slide-handle').first()).toHaveAccessibleName('Ziehen zum Sortieren');

        await dragRow(page, page.getByTestId('slide-handle').first(), page.getByTestId('slide-item').nth(2));
        await expect.poll(() => slideNames(page)).toEqual([b, c, a]);
        await expect(page.getByTestId('save-status')).toHaveText(/Sichert …|Entwurf gesichert/);
        await page.keyboard.press('ControlOrMeta+z');
        await expect.poll(() => slideNames(page)).toEqual([a, b, c]);

        await nudgeRow(page.getByTestId('slide-handle').nth(1), 'ArrowUp');
        await expect.poll(() => slideNames(page)).toEqual([b, a, c]);
        // The handle keeps the focus, so the next press moves the same slide on.
        await page.keyboard.press('ArrowDown');
        await expect.poll(() => slideNames(page)).toEqual([a, b, c]);
        await page.keyboard.press('ArrowDown');
        await expect.poll(() => slideNames(page)).toEqual([a, c, b]);
    });

    test('layers in "Anordnen": top first, dragged to a new place, and a locked block stays where it is', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('slide-item')).toHaveCount(3);
        await page.getByTestId('slide-item').nth(2).click();
        for (const type of ['text', 'shape', 'clock']) await addBlock(page, type);
        const rows = page.getByTestId('layer-row');
        const names = () => page.locator('[data-testid="layer-row"] .layer-name').allTextContents();
        const before = await names();
        expect(before.slice(0, 3)).toEqual(['Uhr', 'Fläche', 'Text']);
        const count = before.length;
        await expect(page.getByTestId('layer-position')).toHaveText(`Ebene ${count} von ${count}`);

        // The top layer goes down to the third place; the stage follows.
        await dragRow(page, rows.nth(0).getByTestId('layer-handle'), rows.nth(2));
        await expect.poll(names).toEqual([...before.slice(1, 3), before[0]!, ...before.slice(3)]);
        await expect(page.getByTestId('layer-position')).toHaveText(`Ebene ${count - 2} von ${count}`);
        await page.keyboard.press('ControlOrMeta+z');
        await expect.poll(names).toEqual(before);

        // A row is chosen by a click, and a locked one cannot be dragged – the others pass it by.
        await rows.nth(1).click();
        await expect(rows.nth(1)).toHaveClass(/layer-item--on/);
        await page.getByTestId('lock-toggle').click();
        await expect(rows.nth(1).getByTestId('layer-lock')).toHaveAttribute('aria-pressed', 'true');
        await expect(rows.nth(1).getByTestId('layer-handle')).toBeDisabled();
        await rows.nth(0).click();
        await dragRow(page, rows.nth(0).getByTestId('layer-handle'), rows.nth(2));
        await expect.poll(names).toEqual([before[2]!, before[1]!, before[0]!, ...before.slice(3)]);
    });
});

test.describe('the bar of the editor stands flush with the cards (third round of looks)', () => {
    test('desktop: back, save and title line up with the columns below', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('slide-item')).toHaveCount(3);
        const back = (await page.getByTestId('leave-editor').boundingBox())!;
        const slides = (await page.locator('.slide-list').boundingBox())!;
        const save = (await page.getByTestId('save').boundingBox())!;
        const inspector = (await page.getByTestId('inspector-sheet').boundingBox())!;
        expect(Math.abs(back.x - slides.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(save.x + save.width - (inspector.x + inspector.width))).toBeLessThanOrEqual(1);
        // The title and the state of the save stand in the middle of the window.
        const title = (await page.locator('.d-appbar .heading').boundingBox())!;
        expect(Math.abs(title.x + title.width / 2 - 1440 / 2)).toBeLessThanOrEqual(2);
        // Nothing overlaps: back, title, actions in a row.
        expect(back.x + back.width).toBeLessThanOrEqual(title.x);
        expect(title.x + title.width).toBeLessThanOrEqual((await page.getByTestId('save').boundingBox())!.x);
        await page.screenshot({ path: 'test-results/look3-editor-desktop.png' });
    });

    test('phone: the grey ground reaches the lower edge of the window', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
        const page = await context.newPage();
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('phone-slides')).toContainText('von 3');
        const reach = await page.evaluate(() => ({
            bottom: document.querySelector('.editor')!.getBoundingClientRect().bottom + window.scrollY,
            inner: window.innerHeight,
            scroll: document.documentElement.scrollHeight,
            // The demo page has the browser's 8 px margin around its body, as the desktop height does.
            margin: parseFloat(getComputedStyle(document.body).marginBottom),
        }));
        expect(reach.bottom).toBeGreaterThanOrEqual(reach.inner - 1);
        // Not a pixel more than needed: the page does not scroll for it, beyond what lies below the editor anyway.
        expect(reach.scroll).toBeLessThanOrEqual(reach.bottom + reach.margin + 1);
        await page.screenshot({ path: 'test-results/look3-editor-phone.png' });
        await context.close();
    });
});

test.describe('drafts (Plan.md 79, Paket E)', () => {
    test('a change is saved as a draft by itself, comes back after a reload and is published by the button', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('slide-item')).toHaveCount(3);
        await addBlock(page, 'clock');
        await expect(page.getByTestId('save-status')).toHaveText(/^Entwurf gesichert · \d\d:\d\d$/, { timeout: 10_000 });
        const blocks = await page.getByTestId('frame-clock').count();

        await page.reload();
        await expect(page.getByTestId('slide-item')).toHaveCount(3);
        await expect(page.getByTestId('save-status')).toHaveText(/^Entwurf von .+, heute \d\d:\d\d – noch nicht veröffentlicht$/);
        await expect(page.getByTestId('frame-clock')).toHaveCount(blocks);
        await expect(page.getByTestId('save')).toBeEnabled();

        await page.getByTestId('save').click();
        await expect(page.getByTestId('save-status')).toHaveText('Veröffentlicht');
        await page.reload();
        await expect(page.getByTestId('save-status')).toHaveText('Alles veröffentlicht');
        await expect(page.getByTestId('frame-clock')).toHaveCount(blocks);
    });

    test('"Entwurf verwerfen" in the menu brings the published state back', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('slide-item')).toHaveCount(3);
        await page.getByTestId('editor-more').click();
        await expect(page.getByTestId('more-discard-draft')).toBeDisabled();
        await page.keyboard.press('Escape');

        const before = await page.getByTestId('frame-clock').count();
        await addBlock(page, 'clock');
        await expect(page.getByTestId('frame-clock')).toHaveCount(before + 1);
        await expect(page.getByTestId('save-status')).toHaveText(/^Entwurf gesichert/, { timeout: 10_000 });
        await page.getByTestId('editor-more').click();
        await page.getByTestId('more-discard-draft').click();
        await expect(page.getByTestId('confirm-dialog')).toContainText('Alle Änderungen seit dem letzten Veröffentlichen gehen verloren.');
        await page.getByTestId('confirm-ok').click();
        await expect(page.getByTestId('save-status')).toHaveText('Alles veröffentlicht');
        await expect(page.getByTestId('frame-clock')).toHaveCount(before);
        await page.reload();
        await expect(page.getByTestId('save-status')).toHaveText('Alles veröffentlicht');
    });

    test('the playlists page marks a playlist with a draft', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('slide-item')).toHaveCount(3);
        await page.goto('playlists');
        await expect(page.getByTestId('playlist-card')).toHaveCount(1);
        await expect(page.getByTestId('draft-flag')).toHaveCount(0);

        await page.getByTestId('open-playlist').click();
        await expect(page.getByTestId('slide-item')).toHaveCount(3);
        await addBlock(page, 'clock');
        await expect(page.getByTestId('save-status')).toHaveText(/^Entwurf gesichert/, { timeout: 10_000 });
        await page.getByTestId('leave-editor').click();
        const flag = page.getByTestId('draft-flag');
        await expect(flag).toHaveText('Entwurf');
        await expect(flag).toHaveAttribute('title', /^Entwurf von .+, heute \d\d:\d\d – noch nicht veröffentlicht$/);
    });
});
