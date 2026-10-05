import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * One grid and one tile for screens, playlists, media and schedules (Plan.md 67, 68), in demo mode: the same width in
 * every area, one column on a narrow phone, two on a wide one, and nothing on a tile cut off.
 */

const AREAS = [
    { name: 'Screens', menu: 'sidebar-screens', tile: 'screen-card' },
    { name: 'Playlists', menu: 'sidebar-playlists', tile: 'playlist-card' },
    { name: 'Mediathek', menu: 'sidebar-media', tile: 'media-item' },
    { name: 'Zeitpläne', menu: 'sidebar-schedules', tile: 'schedule-row' },
] as const;

/** Small marks that may stay one line with an ellipsis: the video length, the "Hinweis" flag, the number of a choice. */
const ALLOWED = '.badge, .banner-flag, .mark';

async function open(page: Page, menu: string, tile: string): Promise<Locator> {
    await page.goto('./');
    if (menu !== 'sidebar-screens') {
        // Below 48rem the sections hide in the page menu.
        if (!(await page.getByTestId(menu).isVisible())) await page.getByTestId('page-menu').click();
        await page.getByTestId(menu).click();
    }
    const tiles = page.getByTestId(tile);
    await expect(tiles.first()).toBeVisible({ timeout: 15_000 });
    return tiles;
}

async function columns(tiles: Locator): Promise<number> {
    const lefts = await tiles.evaluateAll((all) => all.map((tile) => Math.round(tile.getBoundingClientRect().left)));
    return new Set(lefts).size;
}

test.describe('tiles of equal width', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('the first tile of screens, playlists and media is as wide as the others', async ({ page }) => {
        const widths: number[] = [];
        for (const area of AREAS) {
            const tiles = await open(page, area.menu, area.tile);
            widths.push((await tiles.first().boundingBox())!.width);
        }
        const [screens, playlists, media, schedules] = widths as [number, number, number, number];
        expect(Math.abs(screens - playlists)).toBeLessThanOrEqual(1);
        expect(Math.abs(screens - media)).toBeLessThanOrEqual(1);
        expect(Math.abs(screens - schedules)).toBeLessThanOrEqual(1);
    });

    for (const area of AREAS) {
        test(`${area.name}: no element on a tile ends in an ellipsis`, async ({ page }) => {
            const tiles = await open(page, area.menu, area.tile);
            const cut = await tiles.evaluateAll(
                (all, allowed) =>
                    all.flatMap((tile) =>
                        [...tile.querySelectorAll('*')]
                            .filter((el) => !el.closest(allowed))
                            .filter((el) => getComputedStyle(el).textOverflow === 'ellipsis')
                            .map((el) => el.className || el.tagName),
                    ),
                ALLOWED,
            );
            expect(cut).toEqual([]);
        });
    }
});

/** The demo has one screen and one playlist; a second screen (with its playlist) makes two tiles in a row possible. */
async function addScreen(page: Page): Promise<void> {
    await page.goto('./');
    await page.getByTestId('new-screen').click();
    await page.getByTestId('new-name').fill('Foyer');
    await page.getByTestId('create').click();
    await expect(page).toHaveURL(/playlists\//);
}

test.describe('columns on a phone', () => {
    for (const area of AREAS) {
        test(`${area.name}: one column at 390 px, two at 600 px`, async ({ page }) => {
            await addScreen(page);
            await page.setViewportSize({ width: 390, height: 844 });
            const tiles = await open(page, area.menu, area.tile);
            expect(await tiles.count()).toBeGreaterThan(1);
            expect(await columns(tiles)).toBe(1);
            await page.setViewportSize({ width: 600, height: 844 });
            await expect.poll(() => columns(tiles)).toBe(2);
        });
    }
});
