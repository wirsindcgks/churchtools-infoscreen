import { readFileSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';
import { openSection } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Eigene Schriften (Plan.md 103) in demo mode. ChurchTools' answers are made up here: an empty wiki area, an upload
 * that numbers the files from 901 on, a download address answered with a real font file (Lato, from the bundled
 * package), and the deletion of a file. Nothing of this reaches the instance; what the file does not answer gets a 404.
 */
const WIKI = 50;
const LATO_400 = readFileSync('node_modules/@fontsource/lato/files/lato-latin-400-normal.woff2');
const LATO_700 = readFileSync('node_modules/@fontsource/lato/files/lato-latin-700-normal.woff2');

async function fakeWiki(page: Page, baseURL: string | undefined): Promise<{ uploads: string[]; deleted: number[] }> {
    const origin = new URL(baseURL!).origin;
    const uploads: string[] = [];
    const deleted: number[] = [];
    await page.route('**/logo**', (route) => route.fulfill({ status: 404 }));
    await page.route(
        (url) => url.searchParams.get('q') === 'public/filedownload',
        // Like the instance: the wrong type and `nosniff` (G64) – the module reads the bytes itself.
        (route) => route.fulfill({ status: 200, contentType: 'application/unknown', body: route.request().url().includes('id=902') ? LATO_700 : LATO_400 }),
    );
    await page.route('**/api/**', (route: Route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname.replace(/^.*?\/api/, '');
        const json = (data: unknown) => route.fulfill({ json: { data } });
        if (request.method() === 'POST' && path === `/files/wiki_${WIKI}/p-media`) {
            const name = /filename="([^"]+)"/.exec(request.postData() ?? '')?.[1] ?? 'schrift.woff2';
            uploads.push(name);
            const id = 900 + uploads.length;
            return json([{ id, name, imageUrl: null, fileUrl: `${origin}/?q=public/filedownload&id=${id}&filename=abc` }]);
        }
        if (request.method() === 'DELETE' && path.startsWith('/files/')) {
            deleted.push(Number(path.slice('/files/'.length)));
            return json({});
        }
        if (request.method() !== 'GET') return json({});
        if (path === '/csrftoken') return json('test-token');
        if (path === '/config') return json({ timezone: 'Europe/Berlin' });
        if (path === '/whoami') return json({ id: 1, firstName: 'Anna', lastName: 'Beispiel' });
        if (path === '/info') return json({ siteName: 'Gemeinde am Markt' });
        if (path === '/calendars') return json([{ id: 1, name: 'Gottesdienste', color: '#2e7d8c' }]);
        if (path === '/calendars/appointments') return json([]);
        if (path === '/wiki/categories') return json([{ id: WIKI, name: 'Infoscreen', inMenu: false }]);
        if (path === `/wiki/categories/${WIKI}/pages`) return json([{ guid: 'p-media', title: 'mediathek' }]);
        if (path === `/wiki/categories/${WIKI}/pages/mediathek`) return json({ guid: 'p-media', title: 'mediathek' });
        if (path.startsWith(`/wiki/categories/${WIKI}/pages/`)) return json({ guid: 'p-main', title: 'main', text: '' });
        if (path === `/files/wiki_${WIKI}/p-media`) return json([]);
        if (path === '/permissions/global') {
            return json({
                churchcore: { 'administer persons': true },
                churchwiki: { view: true, 'view category': [WIKI], 'edit category': [WIKI] },
            });
        }
        return route.fulfill({ status: 404, json: { message: 'nicht gemacht' } });
    });
    return { uploads, deleted };
}

test('own fonts: upload, add a cut, save, choose in a block, delete with the places it is used (Plan.md 103)', async ({ page, baseURL }) => {
    test.setTimeout(90_000);
    const { uploads, deleted } = await fakeWiki(page, baseURL);
    await page.goto('design');
    await openSection(page, 'design-font');
    const fonts = page.getByTestId('custom-fonts');
    await expect(fonts.getByTestId('custom-fonts-empty')).toBeVisible();
    await expect(fonts).toContainText('Die Lizenz der Schrift entscheidet.');

    // Refused before anything is sent: wrong ending, and a file that is no font.
    await fonts.getByTestId('custom-font-file').setInputFiles({ name: 'plan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') });
    await expect(fonts.getByTestId('custom-font-problem')).toHaveText('Nur Schriften als WOFF2, WOFF, TTF oder OTF werden unterstützt.');
    await fonts.getByTestId('custom-font-file').setInputFiles({ name: 'kaputt.woff2', mimeType: 'font/woff2', buffer: Buffer.from('keine Schrift') });
    await expect(fonts.getByTestId('custom-font-problem')).toContainText('lässt sich nicht als Schrift laden');
    expect(uploads).toEqual([]);

    // The name comes from the file and can be changed; the font shows in itself.
    await fonts.getByTestId('custom-font-file').setInputFiles({ name: 'Hausschrift-Regular.woff2', mimeType: 'font/woff2', buffer: LATO_400 });
    const entry = fonts.getByTestId('custom-font');
    await expect(entry).toHaveCount(1);
    await expect(fonts.getByTestId('custom-font-problem')).toHaveCount(0);
    await expect(entry.getByTestId('custom-font-name')).toHaveValue('Hausschrift Regular');
    await expect(entry.getByTestId('custom-font-cut-400')).toContainText('Hausschrift-Regular.woff2');
    await expect(entry.getByTestId('custom-font-upload-400')).toHaveText('Ersetzen');
    await expect(entry.getByTestId('custom-font-upload-600')).toHaveText('Hochladen');
    const key = (await entry.getAttribute('data-font-key'))!;
    await expect(entry.getByTestId('custom-font-name')).toHaveCSS('font-family', new RegExp(`ISD ${key}`));
    await expect.poll(() => page.evaluate((k) => document.fonts.check(`400 20px "ISD ${k}"`), key)).toBe(true);

    await entry.getByTestId('custom-font-name').fill('Haus');
    await entry.getByTestId('custom-font-name').blur();
    await entry.getByTestId('custom-font-upload-700').click();
    await fonts.getByTestId('custom-font-file').setInputFiles({ name: 'Hausschrift-Bold.woff2', mimeType: 'font/woff2', buffer: LATO_700 });
    await expect(entry.getByTestId('custom-font-cut-700')).toContainText('Hausschrift-Bold.woff2');
    await expect.poll(() => page.evaluate((k) => [...document.fonts].filter((f) => f.family.includes(k)).map((f) => f.weight).sort(), key)).toEqual(['400', '700']);
    expect(uploads).toEqual(['Hausschrift-Regular.woff2', 'Hausschrift-Bold.woff2']);

    // The list counts with "Speichern"; the font is the design's font, too.
    await expect(page.getByTestId('theme-save')).toBeEnabled();
    await page.getByTestId('theme-font').click();
    await expect(page.getByTestId('theme-font').locator('xpath=following::*[@role="listbox"][1]').getByText('Eigene Schriften', { exact: true })).toBeVisible();
    await page.getByTestId(`theme-font-${key}`).click();
    await expect(page.getByTestId('theme-font')).toHaveAttribute('data-value', key);
    await expect(page.getByTestId('theme-font')).toContainText('Haus');
    await page.getByTestId('theme-save').click();
    await expect(page.getByTestId('theme-saved')).toBeVisible();
    expect(deleted).toEqual([]);
    await page.screenshot({ path: 'test-results/custom-fonts-design.png' });

    // A block takes it from its font list; the stage draws in it, with Lato behind it.
    await page.getByTestId('sidebar-playlists').click();
    await page.getByTestId('playlist-card').first().getByTestId('open-playlist').click();
    await page.getByTestId('frame-text').first().click();
    await openSection(page, 'font');
    await page.getByTestId('font-family').click();
    await page.getByTestId(`font-family-${key}`).click();
    const title = page.locator('.editor-stage .block--text').filter({ hasText: 'Herzlich willkommen!' }).locator('.text');
    await expect(title).toHaveCSS('font-family', new RegExp(`ISD ${key}.*ISD Lato`));
    await expect(page.getByTestId('font-family')).toHaveAttribute('data-value', key);
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Veröffentlicht');

    // Deleting names the places; the files go after "Speichern".
    await page.goto('design');
    await openSection(page, 'design-font');
    await expect(page.getByTestId('custom-font')).toHaveCount(1);
    await page.getByTestId('custom-font-remove').click();
    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toContainText('Die Schrift „Haus“ löschen?');
    await expect(dialog).toContainText('Design-Schrift');
    await expect(dialog).toContainText('Willkommen (1 Baustein)');
    await page.getByTestId('confirm-ok').click();
    await expect(page.getByTestId('custom-fonts-empty')).toBeVisible();
    expect(deleted).toEqual([]);
    await page.getByTestId('theme-save').click();
    await expect(page.getByTestId('theme-saved')).toBeVisible();
    await expect.poll(() => deleted.sort()).toEqual([901, 902]);
});
