import { expect, test, type Page, type Route } from '@playwright/test';
import { addBlock, choose, openSection } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * The look of a picture (Plan.md F2): crop, tone, corners and shadow. The media library is made up here as in
 * `slideshow.spec.ts`: pictures are answered by this file, and no write reaches the instance.
 */
const WIKI = 50;

function picture(): string {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="hsl(200 60% 45%)"/><circle cx="1200" cy="450" r="200" fill="white"/></svg>';
}

async function fakeLibrary(page: Page, baseURL: string | undefined): Promise<void> {
    const origin = new URL(baseURL!).origin;
    const file = { id: 500, name: 'bild-01.svg', imageUrl: `${origin}/images/500/bild-01.svg`, imageMetadata: { width: 1600, height: 900 }, meta: { createdDate: '2026-09-01T10:00:00Z' } };
    await page.route('**/images/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: picture() }));
    await page.route('**/api/**', (route: Route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname.replace(/^.*?\/api/, '');
        const json = (data: unknown) => route.fulfill({ json: { data } });
        if (request.method() !== 'GET') return json({});
        if (path === '/wiki/categories') return json([{ id: WIKI, name: 'Infoscreen', inMenu: false }]);
        if (path === `/wiki/categories/${WIKI}/pages`) return json([{ guid: 'p-media', title: 'mediathek' }]);
        if (path === `/wiki/categories/${WIKI}/pages/mediathek`) return json({ guid: 'p-media', title: 'mediathek' });
        if (path.startsWith(`/wiki/categories/${WIKI}/pages/`)) return json({ guid: 'p-main', title: 'main', text: '' });
        if (path === `/files/wiki_${WIKI}/p-media`) return json([file]);
        if (path === '/permissions/global') {
            return json({ churchcore: { 'administer persons': true }, churchwiki: { view: true, 'view category': [WIKI], 'edit category': [WIKI] } });
        }
        return route.continue();
    });
}

/** A new slide with an image block that holds the picture. */
async function imageWithPicture(page: Page, baseURL: string | undefined): Promise<void> {
    await fakeLibrary(page, baseURL);
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await page.getByTestId('add-slide').click();
    await addBlock(page, 'image');
    await page.getByTestId('block-inspector').getByTestId('pick-image').click();
    const library = page.getByTestId('media-library');
    await library.locator('button.pick').first().click();
    await expect(library).toBeHidden();
    await expect(page.locator('.editor-stage .block--image img')).toBeVisible();
}

test('a double click on a picture opens the crop; dragging, the zoom and "Fertig" work on it', async ({ page, baseURL }) => {
    await imageWithPicture(page, baseURL);
    const img = page.locator('.editor-stage .block--image img');
    await expect(img).toHaveCSS('object-fit', 'contain');
    await page.getByTestId('frame-image').dblclick();

    // It was shown whole: the crop sets "Füllen" first. No handles, no short menu while it runs.
    await expect(page.getByTestId('crop-bar')).toBeVisible();
    await expect(img).toHaveCSS('object-fit', 'cover');
    await expect(page.locator('.frame--selected .handle')).toHaveCount(0);
    await expect(page.getByTestId('handle-rotate')).toHaveCount(0);
    await expect(page.getByTestId('quick-menu')).toHaveCount(0);

    // Zoomed in, the picture can be moved: dragging right shows more of the left.
    await page.getByTestId('crop-zoom').fill('2');
    await expect(img).toHaveCSS('transform', /matrix\(2, 0, 0, 2/);
    const frame = (await page.getByTestId('frame-image').boundingBox())!;
    const middle = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
    await page.mouse.move(middle.x, middle.y);
    await page.mouse.down();
    await page.mouse.move(middle.x + 80, middle.y + 10, { steps: 5 });
    await page.mouse.up();
    const position = (await img.evaluate((el) => (el as HTMLElement).style.objectPosition)).split(' ');
    expect(parseFloat(position[0]!)).toBeLessThan(50);

    await page.getByTestId('crop-done').click();
    await expect(page.getByTestId('crop-bar')).toHaveCount(0);
    await expect(img).toHaveCSS('transform', /matrix\(2, 0, 0, 2/);

    // Reset takes the crop away.
    await page.getByTestId('quick-more').click();
    await page.getByTestId('quick-crop').click();
    await expect(page.getByTestId('crop-bar')).toBeVisible();
    await page.getByTestId('crop-reset').click();
    await expect(img).toHaveCSS('transform', 'none');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('crop-bar')).toHaveCount(0);
});

test('tone from the short menu darkens the picture; corners and shadow come with "Füllen"', async ({ page, baseURL }) => {
    await imageWithPicture(page, baseURL);
    const img = page.locator('.editor-stage .block--image img');
    await page.getByTestId('quick-menu').getByTestId('quick-chip').and(page.getByLabel(/^Ton/)).click();
    await choose(page.getByTestId('quick-popover'), 'image-tone', 'darken');
    await expect(img).toHaveCSS('filter', /brightness\(0\.55\)/);

    // At "Ganz zeigen" the frame is no picture: no corners, no shadow in the inspector.
    await expect(page.getByTestId('image-corners')).toHaveCount(0);
    await page.getByTestId('quick-menu').getByTestId('quick-chip').and(page.getByLabel(/^Einpassen/)).click();
    await choose(page.getByTestId('quick-popover'), 'image-fit', 'cover');
    await page.getByTestId('frame-image').click();
    await expect(page.getByTestId('quick-popover')).toHaveCount(0);
    await openSection(page, 'appearance');
    const inspector = page.getByTestId('block-inspector');
    await inspector.getByTestId('image-corners').fill('40');
    await inspector.getByTestId('image-corners').blur();
    await choose(inspector, 'image-shadow', 'soft');
    const block = page.locator('.editor-stage .block--image');
    await expect(block).toHaveCSS('border-radius', '40px');
    await expect(block).toHaveCSS('box-shadow', /rgba\(0, 0, 0, 0\.35\)/);
});
