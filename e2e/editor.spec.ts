import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

test('edit a slide: add text, type, drag, undo, save', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await expect(page.getByTestId('save-status')).toHaveText('Alles gespeichert');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/editor-open.png' });

    await page.getByTestId('add-text').click();
    await expect(page.getByTestId('block-inspector')).toBeVisible();
    await page.getByTestId('text-input').fill('Gemeindefest am Samstag');
    await page.getByTestId('text-input').blur();
    await expect(page.locator('.editor-stage').getByText('Gemeindefest am Samstag')).toBeVisible();
    await expect(page.getByTestId('save-status')).toHaveText('Ungespeicherte Änderungen');

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
    await expect(page.getByTestId('save-status')).toHaveText('Gespeichert');
});

test('create a new portrait screen', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('new-screen').click();
    await page.getByTestId('new-name').fill('Foyer Hochkant');
    await expect(page.getByTestId('new-slug')).toHaveValue('foyer-hochkant');
    await page.getByTestId('create-dialog').getByText('Hochkant').click();
    await expect(page.getByTestId('new-portrait')).toBeChecked();
    await page.getByTestId('create').click();
    await expect(page).toHaveURL(/screens\/foyer-hochkant/);
    await expect(page.getByTestId('slide-item')).toHaveCount(1);
    await page.getByTestId('add-clock').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/editor-portrait.png' });
});

test('blocks snap to the grid and to the stage centre with a guide line', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await page.getByTestId('grid-size').selectOption('20');
    await page.getByTestId('add-shape').click(); // created centred, 600 × 300
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
    await page.getByTestId('show-logo').check();
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
        if (url.hostname !== 'localhost') foreign.push(url.hostname);
        if (url.pathname.endsWith('.woff2')) fonts.push(url.pathname);
    });
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await page.getByTestId('frame-text').first().click();
    await expect(page.getByTestId('text-input')).toHaveValue('Herzlich willkommen!');
    await page.getByTestId('font-family').selectOption('barlow-semi-condensed');
    const title = page.locator('.editor-stage .block--text').filter({ hasText: 'Herzlich willkommen!' });
    // WebKit reports the name without quotes.
    await expect(title.locator('.text')).toHaveCSS('font-family', /^"?ISD Barlow Semi Condensed"?, sans-serif$/);
    await expect.poll(() => page.evaluate(() => document.fonts.check('700 64px "ISD Barlow Semi Condensed"'))).toBe(true);
    expect(fonts.some((f) => f.includes('barlow-semi-condensed'))).toBe(true);
    expect(foreign).toEqual([]);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/editor-font.png' });
});

test('rename a screen: the new name shows in the list, an empty one is refused', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await page.keyboard.press('Escape');
    const name = page.getByTestId('screen-name');

    await name.fill('   ');
    await expect(page.getByText('Ohne Namen lässt sich nicht speichern.')).toBeVisible();
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Nicht gespeichert');
    await expect(page.getByRole('alert')).toContainText('braucht einen Namen');

    await name.fill('Foyer rechts ');
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Gespeichert');
    await page.getByRole('link', { name: 'Screens', exact: true }).click();
    await expect(page.getByTestId('screen-card')).toContainText('Foyer rechts');
    await expect(page.getByTestId('screen-card')).not.toContainText('Demo – Foyer');
});

test('the screen settings carry the address for the TV, without a secret (way A)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await page.keyboard.press('Escape');
    const address = page.getByTestId('player-address');
    await expect(address).toContainText('/ccm/infoscreen-designer/player?screen=demo');
    await expect(address).toContainText('Angemeldet bleiben');
    await expect(address).not.toContainText('login_token');
});

test('colours take a hex value; a half-typed one is marked and not taken over (Plan.md 11)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await page.getByTestId('add-text').click();
    await page.getByTestId('text-input').fill('Farbprobe');
    const text = page.locator('.editor-stage').getByText('Farbprobe');
    const hex = page.getByTestId('text-color');

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
        page.getByTestId('add-clock').boundingBox(),
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
