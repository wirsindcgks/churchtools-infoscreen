import { expect, test, type Page, type Route } from '@playwright/test';
import { addBlock } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * The block "Video" (Plan.md 52) in demo mode. ChurchTools' answers are made up here: a library with two pictures and
 * two videos, and the download address of a video answered by this file – held, so that the `<video>` stays in the
 * page, or refused with 403 like an instance that denies the right (G42). No video file is decoded; nothing of this
 * reaches the instance, and what the file does not answer gets a 404.
 */
const WIKI = 50;
const VIDEO_PATH = '/?q=public/filedownload&id=451&filename=abc';

interface Made {
    id: number;
    name: string;
    video?: boolean;
}

const LIBRARY: Made[] = [
    { id: 500, name: 'bild-01.svg' },
    { id: 501, name: 'bild-02.svg' },
    { id: 451, name: 'Predigtreihe.mp4', video: true },
    { id: 452, name: 'Gemeindefest.mp4', video: true },
];

function picture(id: number): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="hsl(${(id * 47) % 360} 60% 45%)"/></svg>`;
}

/** `answer`: what the download address says – held until the test is over, or `403`. */
async function fakeLibrary(page: Page, baseURL: string | undefined, answer: 'hold' | '403'): Promise<{ downloads: string[]; release: () => void }> {
    const origin = new URL(baseURL!).origin;
    const made = [...LIBRARY];
    const downloads: string[] = [];
    let release = () => {};
    const released = new Promise<void>((resolve) => (release = resolve));
    // The church logo is asked for at the dev proxy, which would pass it on to the instance.
    await page.route('**/logo**', (route) => route.fulfill({ status: 404 }));
    await page.route('**/images/**', (route) => {
        const id = Number(/\/images\/(\d+)\//.exec(route.request().url())?.[1]);
        return route.fulfill({ contentType: 'image/svg+xml', body: picture(id) });
    });
    await page.route(
        (url) => url.searchParams.get('q') === 'public/filedownload',
        async (route) => {
            downloads.push(route.request().url());
            if (answer === '403') return route.fulfill({ status: 403, contentType: 'text/plain', body: 'Forbidden' });
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
        if (request.method() === 'POST' && path === `/files/wiki_${WIKI}/p-media`) {
            const uploaded = { id: 900 + made.length, name: `hochgeladen-${made.length}.mp4`, video: true };
            made.push(uploaded);
            return json([file(uploaded)]);
        }
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
        if (path === `/files/wiki_${WIKI}/p-media`) return json(made.map(file));
        if (path === '/permissions/global') {
            return json({
                churchcore: { 'administer persons': true },
                churchwiki: { view: true, 'view category': [WIKI], 'edit category': [WIKI] },
            });
        }
        return route.fulfill({ status: 404, json: { message: 'nicht gemacht' } });
    });
    return { downloads, release };
}

/** A video block on the first slide of the demo screen, the video chosen in the library. */
async function slideWithVideo(page: Page, name = 'Predigtreihe'): Promise<void> {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await addBlock(page, 'video');
    await expect(page.getByTestId('block-inspector')).toBeVisible();
    await page.getByTestId('pick-video').click();
    const library = page.getByTestId('media-library');
    await library.getByTestId('media-item').filter({ hasText: name }).locator('button.pick').click();
    await expect(library).toBeHidden();
}

test('add a video: the library shows only videos, the inspector names the one chosen', async ({ page, baseURL }) => {
    test.setTimeout(60_000);
    const { release } = await fakeLibrary(page, baseURL, 'hold');
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await addBlock(page, 'video');
    const inspector = page.getByTestId('block-inspector');
    await expect(inspector.getByText('Noch kein Video gewählt.')).toBeVisible();
    await expect(page.getByTestId('pick-video')).toHaveText('Video wählen …');
    // The designer's stage says what is missing.
    await expect(page.locator('.editor-stage').getByTestId('video-placeholder')).toHaveText('Video wählen');

    await page.getByTestId('pick-video').click();
    const library = page.getByTestId('media-library');
    await expect(library.getByText('Lade Videos …')).toHaveCount(0);
    const items = library.getByTestId('media-item');
    await expect(items).toHaveCount(2);
    await expect(items.filter({ hasText: 'Predigtreihe.mp4' })).toHaveCount(1);
    await expect(items.filter({ hasText: 'Gemeindefest.mp4' })).toHaveCount(1);
    await expect(items.filter({ hasText: 'bild-01' })).toHaveCount(0);
    // A tile shows a still, never plays, and a play badge says it is a video.
    await expect(items.first().locator('video')).toHaveAttribute('preload', 'metadata');
    await expect(items.first().locator('video')).toHaveJSProperty('muted', true);
    await expect(library.getByTestId('media-upload')).toHaveAttribute('accept', 'video/mp4');
    await page.screenshot({ path: 'test-results/video/video-dialog.png' });

    // A file of another type is refused before anything is sent.
    await library.getByTestId('media-upload').setInputFiles({ name: 'film.mov', mimeType: 'video/quicktime', buffer: Buffer.from('x') });
    await expect(library.getByRole('alert')).toHaveText('Nur MP4-Videos (H.264) werden unterstützt.');

    await items.filter({ hasText: 'Predigtreihe.mp4' }).locator('button.pick').click();
    await expect(library).toBeHidden();
    await expect(page.getByTestId('video-name')).toContainText('Predigtreihe.mp4');
    await expect(page.getByTestId('pick-video')).toHaveText('Anderes Video …');
    await expect(page.getByTestId('video-sound')).not.toBeChecked();
    await expect(page.getByTestId('video-fit')).toHaveValue('contain');
    await inspector.getByRole('button', { name: 'Erklärung' }).last().click();
    await expect(inspector.getByText('Die Folie dauert mindestens so lange wie das Video.')).toBeVisible();
    // On the designer's stage only a still: no sound, no playing.
    const onStage = page.locator('.editor-stage').getByTestId('video');
    await expect(onStage).toHaveAttribute('preload', 'metadata');
    await expect(onStage).toHaveJSProperty('paused', true);
    await page.screenshot({ path: 'test-results/video/video-inspector.png' });
    release();
});

test('a picture block is offered pictures only, never a video', async ({ page, baseURL }) => {
    test.setTimeout(60_000);
    const { release } = await fakeLibrary(page, baseURL, 'hold');
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await addBlock(page, 'image');
    await page.getByTestId('pick-image').click();
    const library = page.getByTestId('media-library');
    const items = library.getByTestId('media-item');
    await expect(items).toHaveCount(2);
    await expect(items.filter({ hasText: '.mp4' })).toHaveCount(0);
    await expect(library.locator('video')).toHaveCount(0);
    await expect(library.getByTestId('media-upload')).toHaveAttribute('accept', /image\/png/);
    release();
});

test('the player loops the video from its download address, muted unless the block has sound', async ({ page, baseURL, context }) => {
    test.setTimeout(90_000);
    const { release } = await fakeLibrary(page, baseURL, 'hold');
    await slideWithVideo(page);
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Gespeichert');

    const playerPage = await context.newPage();
    const { downloads, release: releasePlayer } = await fakeLibrary(playerPage, baseURL, 'hold');
    await playerPage.goto('./player?screen=demo');
    const video = playerPage.getByTestId('video');
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute('src', VIDEO_PATH);
    await expect(video).toHaveJSProperty('loop', true);
    await expect(video).toHaveJSProperty('muted', true);
    await expect(video).toHaveAttribute('playsinline', '');
    await expect(video).toHaveAttribute('preload', 'auto');
    await expect.poll(() => downloads.length).toBeGreaterThan(0);

    // With sound on the block asks to start unmuted. Whether the browser lets it is its own business: without a
    // click it refuses, and the video then runs on muted – so what is looked at is how `play()` was called. Not
    // the first call: the player starts from its cached state – here still the video without sound – and only
    // then shows the fresh one; in WebKit the cached video sometimes starts first (Plan.md 60).
    await page.getByTestId('video-sound').check();
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Gespeichert');
    await playerPage.addInitScript(() => {
        const plays: boolean[] = [];
        (window as unknown as { plays: boolean[] }).plays = plays;
        const play = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
            plays.push(this.muted);
            return play.call(this);
        };
    });
    await playerPage.goto('./player?screen=demo');
    await expect(playerPage.getByTestId('video')).toBeVisible();
    await expect.poll(() => playerPage.evaluate(() => (window as unknown as { plays: boolean[] }).plays.includes(false))).toBe(true);
    release();
    releasePlayer();
});

test('when the file is refused with 403 the player shows a calm placeholder, and the rotation goes on', async ({ page, baseURL, context }) => {
    test.setTimeout(90_000);
    await fakeLibrary(page, baseURL, '403');
    await slideWithVideo(page);
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Gespeichert');

    const playerPage = await context.newPage();
    await fakeLibrary(playerPage, baseURL, '403');
    await playerPage.goto('./player?screen=demo');
    await expect(playerPage.getByText('Herzlich willkommen!')).toBeVisible();
    await expect(playerPage.getByTestId('video-placeholder')).toBeVisible();
    await expect(playerPage.getByTestId('video')).toHaveCount(0);
    // No words about formats on a TV.
    await expect(playerPage.getByTestId('video-placeholder')).toHaveText('');
    // The first slide runs 8 s; a failed video does not keep it.
    await expect(playerPage.getByText('Herzlich willkommen!')).toBeHidden({ timeout: 20_000 });
});

test('the preview plays videos muted and offers the sound on a button', async ({ page, baseURL }) => {
    test.setTimeout(60_000);
    const { release } = await fakeLibrary(page, baseURL, 'hold');
    await slideWithVideo(page);
    await page.getByTestId('video-sound').check();
    await page.getByTestId('open-preview').click();
    const preview = page.getByTestId('playlist-preview');
    const video = preview.getByTestId('video');
    await expect(video).toBeVisible();
    await expect(video).toHaveJSProperty('muted', true);
    await expect(video).toHaveAttribute('preload', 'auto');
    await preview.getByTestId('video-sound-on').click();
    await expect(video).toHaveJSProperty('muted', false);
    await expect(preview.getByTestId('video-sound-on')).toHaveCount(0);
    release();
});
