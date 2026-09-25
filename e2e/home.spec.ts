import { expect, test, type Page } from '@playwright/test';

/** Nothing sticks out sideways: a page that scrolls horizontally is broken on a phone. */
async function expectNoSidewaysScroll(page: Page): Promise<void> {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
}

async function createScreen(page: Page, name: string, format: 'Quer' | 'Hochkant'): Promise<void> {
    await page.getByTestId('new-screen').click();
    await page.getByTestId('new-name').fill(name);
    await page.getByTestId('create-dialog').getByText(format).click();
    await page.getByTestId('create').click();
    await expect(page).toHaveURL(/playlists\//);
    await page.getByRole('link', { name: 'Screens', exact: true }).click();
    await expect(page.getByTestId('screens-heading')).toBeVisible();
}

test.describe('start page on a desktop', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('shows each screen as a tile with its first slide, and filters by format and search', async ({ page }) => {
        await page.goto('./');
        const tile = page.getByTestId('screen-card').first();
        // The picture is the player's own slide: the demo screen greets.
        await expect(tile.getByText('Herzlich willkommen!')).toBeVisible();
        await expect(tile).toContainText('Quer');
        await expect(tile).toContainText('demo');

        await createScreen(page, 'Eingang hochkant', 'Hochkant');
        await expect(page.getByTestId('screen-card')).toHaveCount(2);
        await expect(page.getByTestId('filter-portrait')).toContainText('1');

        await page.getByTestId('filter-portrait').click();
        await expect(page).toHaveURL(/\?format=portrait$/);
        await expect(page.getByTestId('screen-card')).toHaveCount(1);
        await expect(page.getByTestId('screen-card')).toContainText('Eingang hochkant');

        await page.getByTestId('filter-all').click();
        await page.getByTestId('search').fill('foyer');
        await expect(page.getByTestId('screen-card')).toHaveCount(1);
        await expect(page.getByTestId('screen-card')).toContainText('Demo – Foyer');
        await page.getByTestId('search').fill('gibt es nicht');
        await expect(page.getByText('Kein Screen passt zu diesem Filter.')).toBeVisible();
        await page.getByTestId('search').fill('');
        await page.screenshot({ path: 'test-results/home.png' });
    });

    test('the tile menu copies the player address and deletes after asking', async ({ page, context, browserName }) => {
        test.skip(browserName === 'webkit', 'Clipboard permissions exist only in Chromium');
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await page.goto('./');
        await createScreen(page, 'Wegwerf', 'Quer');

        const tile = page.getByTestId('screen-card').filter({ hasText: 'Wegwerf' });
        await tile.getByTestId('screen-menu').click();
        await tile.getByTestId('copy-address').click();
        await expect(tile.getByTestId('copy-address')).toHaveText(/Adresse kopiert/);
        expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/player\?screen=wegwerf$/);
        await expect(tile.getByTestId('copy-address')).toHaveCount(0); // the menu closes by itself

        await tile.getByTestId('screen-menu').click();
        page.once('dialog', (d) => void d.accept());
        await tile.getByTestId('delete-screen').click();
        await expect(page.getByTestId('screen-card')).toHaveCount(1);
    });
});

test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('the start page fits, with filters as a row and the create dialog inside the screen', async ({ page }) => {
        await page.goto('./');
        await expect(page.getByTestId('screen-card').first()).toBeVisible();
        await expect(page.getByTestId('filter-portrait')).toBeVisible();
        await expectNoSidewaysScroll(page);
        await page.screenshot({ path: 'test-results/home-phone.png', fullPage: true });

        await page.getByTestId('new-screen').click();
        const box = await page.getByTestId('create-dialog').boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(390);
        await page.screenshot({ path: 'test-results/create-phone.png' });
    });

    test('the editor stacks slides, stage and inspector', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('slide-item')).toHaveCount(3);
        const [slides, stage] = await Promise.all([
            page.getByTestId('slide-item').first().boundingBox(),
            page.locator('.editor-stage').boundingBox(),
        ]);
        expect(stage!.y).toBeGreaterThan(slides!.y); // stage below the slides, not beside them
        expect(stage!.width).toBeGreaterThan(300);
        expect(stage!.height).toBeGreaterThan(150);
        await expectNoSidewaysScroll(page);
        await page.screenshot({ path: 'test-results/editor-phone.png', fullPage: true });
    });
});

test.describe('media library as a section of its own (Plan.md 16)', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('opens from the sidebar, lists the pictures and offers upload – without a screen', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('sidebar-media').click();
        await expect(page).toHaveURL(/\/mediathek$/);
        await expect(page.getByTestId('media-heading')).toHaveText('Mediathek');
        const library = page.getByTestId('media-library');
        // Upload sits where "Screen erstellen" and "Playlist erstellen" sit: top right in the bar.
        await expect(page.locator('.d-appbar').getByTestId('media-upload-button')).toBeEnabled();
        await expect(library.getByText('Lade Bilder …')).toHaveCount(0);
        // Pictures here are managed, not chosen: no "verwenden" button.
        await expect(library.getByTestId('media-item').first()).toBeVisible();
        await expect(library.locator('button.pick')).toHaveCount(0);
        // Each picture says where it is shown, or that it is unused (Plan.md 18).
        const items = await library.getByTestId('media-item').count();
        await expect(library.getByTestId('media-uses')).toHaveCount(items);
        await page.getByTestId('media-filter-unused').click();
        await expect(library.getByTestId('media-uses').filter({ hasNotText: 'Unbenutzt' })).toHaveCount(0);
        await expect(page.getByTestId('sidebar-media')).toHaveAttribute('aria-current', 'page');
        await expect(library.locator('img').first()).toHaveJSProperty('complete', true);
        await page.screenshot({ path: 'test-results/media-page.png' });
    });
});

test.describe('sections on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('schedules, playlists and media library stay reachable from every section', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('sidebar-playlists').click();
        await expect(page.getByTestId('playlists-heading')).toBeVisible();
        await page.getByTestId('sidebar-schedules').click();
        await expect(page.getByTestId('schedules-heading')).toBeVisible();
        await expect(page.getByTestId('schedule-row')).toHaveCount(1);
        // The first slide of what runs now, beside the rules.
        await expect(page.getByTestId('schedule-preview')).toBeVisible();
        await page.getByTestId('sidebar-media').click();
        await expect(page.getByTestId('media-heading')).toBeVisible();
        await expectNoSidewaysScroll(page);
    });
});
