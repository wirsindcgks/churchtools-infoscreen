import { devices, expect, test, type Page, type Route } from '@playwright/test';
import { addBlock } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * The preview of the media library (Plan.md 53) in demo mode. ChurchTools' answers are made up here, as in
 * `video.spec.ts`: a library of three pictures (one with a see-through background) and a video whose download
 * is held, so the `<video>` stays in the page. Every write to the wiki stops here; nothing reaches the instance.
 */
const WIKI = 50;

interface Made {
    id: number;
    name: string;
    video?: boolean;
}

const LIBRARY: Made[] = [
    { id: 500, name: 'bild-01.svg' },
    { id: 501, name: 'bild-02.svg' },
    { id: 502, name: 'freigestellt.svg' },
    { id: 451, name: 'Predigtreihe.mp4', video: true },
];

/** A coloured picture; 502 is a disc on a transparent ground, to see the checkerboard work. */
function picture(id: number): string {
    if (id === 502) {
        return '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><circle cx="800" cy="450" r="380" fill="hsl(12 80% 50%)"/></svg>';
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="hsl(${(id * 47) % 360} 60% 45%)"/></svg>`;
}

async function fakeLibrary(page: Page, baseURL: string | undefined): Promise<() => void> {
    const origin = new URL(baseURL!).origin;
    let release = () => {};
    const released = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/logo**', (route) => route.fulfill({ status: 404 }));
    await page.route('**/images/**', (route) => {
        const id = Number(/\/images\/(\d+)\//.exec(route.request().url())?.[1]);
        return route.fulfill({ contentType: 'image/svg+xml', body: picture(id) });
    });
    await page.route(
        (url) => url.searchParams.get('q') === 'public/filedownload',
        async (route) => {
            await released;
            await route.abort().catch(() => undefined);
        },
    );
    await page.route('**/api/**', (route: Route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname.replace(/^.*?\/api/, '');
        const json = (data: unknown) => route.fulfill({ json: { data } });
        const file = (m: Made) => ({
            id: m.id,
            name: m.name,
            imageUrl: m.video ? null : `${origin}/images/${m.id}/${m.name}`,
            imageMetadata: m.video ? null : { width: 1600, height: 900 },
            ...(m.video ? { fileUrl: `${origin}/?q=public/filedownload&id=${m.id}&filename=abc` } : {}),
            meta: { createdDate: `2026-09-01T10:00:${String(m.id % 60).padStart(2, '0')}Z` },
        });
        if (request.method() !== 'GET') return json({});
        if (path === '/config') return json({ timezone: 'Europe/Berlin' });
        if (path === '/whoami') return json({ id: 1, firstName: 'Anna', lastName: 'Beispiel' });
        if (path === '/info') return json({ siteName: 'Gemeinde am Markt' });
        if (path === '/calendars') return json([{ id: 1, name: 'Gottesdienste', color: '#2e7d8c' }]);
        if (path === '/calendars/appointments') return json([]);
        if (path === '/wiki/categories') return json([{ id: WIKI, name: 'Infoscreen', inMenu: false }]);
        if (path === `/wiki/categories/${WIKI}/pages`) return json([{ guid: 'p-media', title: 'mediathek' }]);
        if (path === `/wiki/categories/${WIKI}/pages/mediathek`) return json({ guid: 'p-media', title: 'mediathek' });
        if (path.startsWith(`/wiki/categories/${WIKI}/pages/`)) return json({ guid: 'p-main', title: 'main', text: '' });
        if (path === `/files/wiki_${WIKI}/p-media`) return json(LIBRARY.map(file));
        if (path === '/permissions/global') {
            return json({
                churchcore: { 'administer persons': true },
                churchwiki: { view: true, 'view category': [WIKI], 'edit category': [WIKI] },
            });
        }
        return route.fulfill({ status: 404, json: { message: 'nicht gemacht' } });
    });
    return release;
}

test('a tile opens the preview; page through the files, switch the background, close with Escape', async ({ page, baseURL }) => {
    test.setTimeout(60_000);
    const release = await fakeLibrary(page, baseURL);
    await page.goto('./');
    await page.getByTestId('sidebar-media').click();
    const items = page.getByTestId('media-item');
    await expect(items).toHaveCount(4);
    // Newest first: the video, the disc, bild-02, bild-01.
    await expect(items.locator('.name')).toHaveText(['Predigtreihe.mp4', 'freigestellt.svg', 'bild-02.svg', 'bild-01.svg']);

    await items.filter({ hasText: 'bild-01' }).locator('button.pick').click();
    const preview = page.getByTestId('media-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute('aria-label', 'Vorschau');
    await expect(page.getByTestId('preview-name')).toHaveText('bild-01.svg');
    await expect(page.getByTestId('preview-position')).toHaveText('4 von 4');
    await expect(page.getByTestId('preview-size')).toHaveText('1600 × 900 px');
    await expect(page.getByTestId('preview-uploaded')).toHaveText(/\d{4}$/);
    await expect(page.getByTestId('preview-uses')).toHaveText('Unbenutzt');
    await expect(page.getByTestId('preview-next')).toBeDisabled();
    await expect(page.getByTestId('preview-action')).toHaveCount(0);
    await expect(page.getByTestId('preview-image')).toHaveAttribute('src', /w=1920&h=1080&fit=max/);
    const stage = page.getByTestId('preview-stage');
    await expect(stage).toHaveAttribute('data-background', 'dark');
    await expect(page.getByTestId('preview-image')).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/preview-dark.png' });

    await page.getByTestId('preview-prev').click();
    await expect(page.getByTestId('preview-position')).toHaveText('3 von 4');
    await expect(page.getByTestId('preview-name')).toHaveText('bild-02.svg');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('preview-position')).toHaveText('4 von 4');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('preview-position')).toHaveText('4 von 4');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('preview-position')).toHaveText('2 von 4');
    await expect(page.getByTestId('preview-name')).toHaveText('freigestellt.svg');

    // The disc without a ground, on all three backgrounds.
    await page.getByTestId('preview-background-light').click();
    await expect(stage).toHaveAttribute('data-background', 'light');
    await expect(page.getByTestId('preview-image')).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/preview-light.png' });
    await page.getByTestId('preview-background-checker').click();
    await expect(stage).toHaveAttribute('data-background', 'checker');
    await page.screenshot({ path: 'test-results/preview-checker.png' });

    // The video: controls, muted, looping. The background holds while paging.
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('preview-position')).toHaveText('1 von 4');
    await expect(stage).toHaveAttribute('data-background', 'checker');
    const video = page.getByTestId('preview-video');
    await expect(video).toBeVisible();
    await expect(video).toHaveJSProperty('muted', true);
    await expect(video).toHaveJSProperty('loop', true);
    await expect(video).toHaveJSProperty('controls', true);
    await expect(page.getByTestId('preview-prev')).toBeDisabled();
    await page.screenshot({ path: 'test-results/preview-video.png' });

    // Escape closes; the choice outlives closing; so do the close button and a click beside the preview.
    await page.keyboard.press('Escape');
    await expect(preview).toBeHidden();
    await items.first().locator('button.pick').click();
    await expect(stage).toHaveAttribute('data-background', 'checker');
    await page.getByTestId('preview-close').click();
    await expect(preview).toBeHidden();
    await items.first().locator('button.pick').click();
    await page.mouse.click(5, 450);
    await expect(preview).toBeHidden();
    release();
});

test('in the editor the eye opens the preview; Escape closes only it; "Verwenden" chooses the picture', async ({ page, baseURL }) => {
    test.setTimeout(60_000);
    const release = await fakeLibrary(page, baseURL);
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await addBlock(page, 'image');
    await page.getByTestId('pick-image').click();
    const library = page.getByTestId('media-library');
    const items = library.getByTestId('media-item');
    await expect(items).toHaveCount(3);
    await items.first().hover();
    await expect(items.first().getByTestId('media-preview-open')).toBeVisible();
    await page.screenshot({ path: 'test-results/preview-dialog.png' });

    await items.first().getByTestId('media-preview-open').click();
    const preview = page.getByTestId('media-preview');
    await expect(preview).toBeVisible();
    await expect(page.getByTestId('preview-position')).toHaveText('1 von 3');
    await expect(page.getByTestId('preview-action')).toHaveText('Verwenden');
    await page.keyboard.press('Escape');
    await expect(preview).toBeHidden();
    await expect(library).toBeVisible();

    await items.nth(1).getByTestId('media-preview-open').click();
    await expect(preview).toBeVisible();
    await expect(page.getByTestId('preview-position')).toHaveText('2 von 3');
    await page.getByTestId('preview-action').click();
    await expect(library).toBeHidden();
    await expect(preview).toBeHidden();
    await expect(page.locator('.editor-stage img').first()).toBeVisible();
    release();
});

test.describe('on a phone', () => {
    // The profile names WebKit as its browser, which a describe may not change; the project decides.
    const iPhone: Record<string, unknown> = { ...devices['iPhone 13'] };
    delete iPhone.defaultBrowserType;
    test.use(iPhone);

    test('the preview fills the screen, the details under the picture', async ({ page, baseURL, browserName }) => {
        test.skip(browserName === 'webkit', 'Playwright emulates isMobile only in Chromium');
        test.setTimeout(60_000);
        const release = await fakeLibrary(page, baseURL);
        await page.goto('./mediathek');
        const items = page.getByTestId('media-item');
        await expect(items).toHaveCount(4);
        await items.first().locator('button.pick').click();
        const preview = page.getByTestId('media-preview');
        await expect(preview).toBeVisible();
        const box = (await preview.boundingBox())!;
        const viewport = page.viewportSize()!;
        expect(box.width).toBe(viewport.width);
        expect(box.height).toBe(viewport.height);
        const stageBox = (await page.getByTestId('preview-stage').boundingBox())!;
        const factsBox = (await page.getByTestId('preview-name').boundingBox())!;
        expect(factsBox.y).toBeGreaterThan(stageBox.y + stageBox.height - 1);
        await page.waitForTimeout(300);
        await page.screenshot({ path: 'test-results/preview-phone.png' });
        release();
    });
});
