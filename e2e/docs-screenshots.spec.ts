/**
 * The pictures of the documentation (docs/bilder), for people new to the
 * designer: `npm run docs:screenshots`. Everything ChurchTools would answer is
 * made up here – a "Gemeinde am Markt" with its calendars, appointments,
 * logo and pictures – so that no name, appointment or picture of a real
 * instance ends up in the repository. Every write is answered here too and
 * never reaches the instance. Skipped in the normal test run.
 */
import { expect, test, type Page, type Route } from '@playwright/test';

const OUT = 'docs/bilder';

test.skip(!process.env.DOCS_SCREENSHOTS, 'Nur mit npm run docs:screenshots.');
test.use({ viewport: { width: 1440, height: 900 } });

const CALENDARS = [
    { id: 1, name: 'Gottesdienste', color: '#2e7d8c' },
    { id: 2, name: 'Jugend', color: '#c0613f' },
    { id: 3, name: 'Gemeindeleben', color: '#4c9a5f' },
    { id: 4, name: 'Musik', color: '#5c6bc0' },
];

/** A picture as SVG: gradient and a word – enough to look like a poster, made of nothing real. */
function poster(title: string, from: string, to: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="1600" height="900" fill="url(#g)"/>
<circle cx="1260" cy="220" r="260" fill="#ffffff" opacity="0.12"/><circle cx="260" cy="760" r="340" fill="#000000" opacity="0.10"/>
<text x="120" y="520" font-family="Lato, sans-serif" font-size="150" font-weight="700" fill="#ffffff">${title}</text></svg>`;
}

const PICTURES: Record<number, string> = {
    77: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><circle cx="200" cy="200" r="190" fill="#ffffff"/><path d="M200 70v260M120 150h160" stroke="#2e7d8c" stroke-width="44" stroke-linecap="round"/></svg>`,
    901: poster('Gottesdienst', '#1d3557', '#2e7d8c'),
    902: poster('Jugendtreff', '#7c2d12', '#c0613f'),
    903: poster('Frühstück', '#14532d', '#4c9a5f'),
    904: poster('Konzert', '#312e81', '#5c6bc0'),
    905: poster('Sommerfest', '#9a3412', '#eab308'),
};

function appointments(): unknown[] {
    const items = [
        ['Gottesdienst', 'mit Kinderprogramm', 1, 0, 10, 901, 'Kirchsaal'],
        ['Jugendtreff', 'Spieleabend', 2, 1, 19, 902, 'Jugendraum'],
        ['Gemeindefrühstück', '', 3, 3, 9, 903, 'Foyer'],
        ['Chorprobe', '', 4, 4, 19, null, 'Kirchsaal'],
        ['Gottesdienst', 'Erntedank', 1, 7, 10, 901, 'Kirchsaal'],
        ['Konzertabend', 'Chor und Band', 4, 9, 19, 904, 'Kirchsaal'],
        ['Sommerfest', 'für die ganze Familie', 3, 12, 14, 905, 'Gemeindegarten'],
    ] as const;
    return items.map(([title, subtitle, calendar, inDays, hour, picture, place], i) => {
        const start = new Date();
        start.setDate(start.getDate() + 1 + inDays);
        start.setHours(hour, 0, 0, 0);
        const c = CALENDARS.find((x) => x.id === calendar)!;
        return {
            appointment: {
                base: {
                    id: i + 1,
                    title,
                    subtitle,
                    description: '<p>Herzliche Einladung – wir freuen uns auf dich. Für Kinder gibt es ein eigenes Programm.</p>',
                    allDay: false,
                    calendar: { id: c.id, name: c.name, color: c.color },
                    address: { name: place },
                    image: picture ? { imageUrl: `${origin}/images/${picture}/bild.svg` } : null,
                },
                calculated: { startDate: start.toISOString(), endDate: new Date(start.getTime() + 5_400_000).toISOString() },
            },
        };
    });
}

let origin = '';
const WIKI = 50;
const FILES = [
    [905, 'sommerfest-plakat.jpg'],
    [901, 'gottesdienst-einladung.jpg'],
    [902, 'jugendtreff.jpg'],
    [903, 'fruehstueck.jpg'],
    [904, 'konzertabend.jpg'],
] as const;

/** Every answer of the made-up church; writes stop here, reads the pictures do not need go to the instance. */
async function fakeChurch(page: Page): Promise<void> {
    await page.route('**/images/**', (route) => {
        const id = Number(/\/images\/(\d+)\//.exec(route.request().url())?.[1]);
        return route.fulfill({ contentType: 'image/svg+xml', body: PICTURES[id] ?? poster('Bild', '#334155', '#64748b') });
    });
    await page.route('**/logo', (route) => route.fulfill({ status: 302, headers: { location: `${origin}/images/77/logo.svg` } }));
    await page.route('**/api/**', (route: Route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname.replace(/^.*?\/api/, '');
        const json = (data: unknown) => route.fulfill({ json: { data } });
        if (request.method() !== 'GET') return json({});
        if (path === '/whoami') return json({ id: 1, firstName: 'Anna', lastName: 'Beispiel' });
        if (path === '/info') return json({ siteName: 'Gemeinde am Markt' });
        if (path === '/calendars') return json(CALENDARS);
        if (path === '/calendars/appointments') return json(appointments());
        if (path === '/wiki/categories') return json([{ id: WIKI, name: 'Infoscreen', inMenu: false }]);
        if (path === `/wiki/categories/${WIKI}/pages`) return json([{ guid: 'p-media', title: 'mediathek' }]);
        if (path.startsWith(`/wiki/categories/${WIKI}/pages/`)) return json({ guid: 'p-main', title: 'main', text: '' });
        if (path === `/files/wiki_${WIKI}/p-media`) {
            return json(
                FILES.map(([id, name], i) => ({
                    id,
                    name,
                    imageUrl: `${origin}/images/${id}/${name}`,
                    imageMetadata: { width: 1600, height: 900 },
                    meta: { createdDate: `2026-09-${20 - i}T10:00:00Z` },
                })),
            );
        }
        // The rights of a designer of the made-up church: the media library's wiki area may be seen and edited.
        if (path === '/permissions/global') {
            return json({
                churchcore: { 'administer persons': true },
                churchwiki: { view: true, 'view category': [WIKI], 'edit category': [WIKI] },
            });
        }
        // Reading the rest is free (/config …): it shows nothing of the instance.
        return route.continue();
    });
}

/** Place the chosen block by the inspector's fields. */
async function frame(page: Page, box: { x: number; y: number; width: number; height: number }): Promise<void> {
    for (const [key, value] of Object.entries(box)) {
        const field = page.getByTestId(`inspector-${key}`);
        await field.fill(String(value));
        await field.blur();
    }
}

async function shoot(page: Page, name: string): Promise<void> {
    await page.addStyleTag({ content: '[data-testid^="demo-notice"] { display: none !important; }' });
    await page.waitForTimeout(1200); // pictures and fonts
    await page.screenshot({ path: `${OUT}/${name}.png` });
}

test('pictures for the documentation', async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    origin = new URL(baseURL!).origin;
    await fakeChurch(page);

    // The look first: large appointments, so that the pictures show the cards.
    await page.goto('design');
    await page.getByTestId('appointments-large').check();
    await page.getByTestId('theme-save').click();
    await expect(page.getByTestId('theme-saved')).toBeVisible();
    await shoot(page, 'design');

    // A second screen, upright, with a countdown and a picture from the media library.
    await page.goto('./');
    await page.getByTestId('new-screen').click();
    await page.getByTestId('new-name').fill('Eingang');
    await page.getByTestId('create-dialog').getByText('Hochkant').click();
    await page.getByTestId('create').click();
    await expect(page.getByTestId('slide-item')).toHaveCount(1);
    await page.getByTestId('add-image').click();
    await page.getByTestId('pick-image').click();
    await page.getByTestId('media-library').locator('button.pick').first().click();
    await expect(page.getByTestId('media-library')).toBeHidden();
    await frame(page, { x: 0, y: 160, width: 1080, height: 608 });
    await page.getByTestId('grid').click({ position: { x: 5, y: 5 } });
    await page.getByTestId('add-countdown').click();
    await frame(page, { x: 60, y: 900, width: 960, height: 520 });
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Gespeichert');

    // The first screen's playlist, with a band over every slide.
    await page.goto('./');
    await page.getByTestId('screen-card').filter({ hasText: 'Foyer' }).getByTestId('open-editor').click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await page.getByTestId('banner-toggle').check();
    await page.getByTestId('banner-text').fill('Nach dem Gottesdienst: Kirchencafé im Foyer – herzlich willkommen!');
    // Standing for the picture: running text would be caught halfway in the frame.
    await page.getByTestId('banner-mode').selectOption('static');
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Gespeichert');
    await page.getByTestId('slide-item').nth(2).click();
    await page.getByTestId('frame-appointment-list').first().click();
    await shoot(page, 'editor');

    // A rule for Sunday morning.
    await page.goto('./');
    await page.getByTestId('screen-card').filter({ hasText: 'Foyer' }).getByTestId('open-schedule').click();
    const dialog = page.getByTestId('schedule-dialog');
    await dialog.getByTestId('add-time-rule').click();
    const rule = dialog.getByTestId('schedule-rule');
    if (await rule.getByTestId('inline-create').count()) {
        await rule.getByTestId('inline-create-name').fill('Sonntag');
        await rule.getByTestId('inline-create-save').click();
    } else {
        await rule.getByTestId('rule-playlist').selectOption({ index: 0 });
    }
    await dialog.getByTestId('schedule-save').click();
    await expect(dialog).toBeHidden();
    await shoot(page, 'startseite');

    await page.getByTestId('sidebar-schedules').click();
    await expect(page.getByTestId('schedule-row').first()).toBeVisible();
    await shoot(page, 'zeitplaene');

    await page.getByTestId('sidebar-playlists').click();
    await expect(page.getByTestId('playlist-card').first()).toBeVisible();
    await shoot(page, 'playlists');

    await page.getByTestId('sidebar-media').click();
    await expect(page.getByTestId('media-uses').first()).toBeVisible();
    await shoot(page, 'mediathek');
});
