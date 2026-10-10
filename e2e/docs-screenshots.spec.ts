/**
 * The pictures of the documentation (docs/bilder), for people new to the
 * designer: `npm run docs:screenshots`. Everything ChurchTools would answer is
 * made up here – a "Gemeinde am Markt" with its calendars, appointments,
 * logo and pictures – so that no name, appointment or picture of a real
 * instance ends up in the repository. Every write is answered here too and
 * never reaches the instance. Skipped in the normal test run.
 */
import { expect, test, type Page, type Route } from '@playwright/test';
import { addBlock, choose, openSection, openSlides } from './helpers';

const OUT = 'docs/bilder';

test.skip(!process.env.DOCS_SCREENSHOTS, 'Nur mit npm run docs:screenshots.');
test.use({ viewport: { width: 1440, height: 900 } });

// The pictures show the editor without guides – with the grid the stage looks busy (user, 2026-10-09).
// The grid is a choice of the browser (`infoscreen-designer.grid`), so it is set off before each page loads.
test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        try {
            localStorage.setItem('infoscreen-designer.grid', '0');
        } catch {
            // No storage: the default grid shows.
        }
    });
});

const CALENDARS = [
    { id: 1, name: 'Gottesdienste', color: '#2e7d8c' },
    { id: 2, name: 'Jugend', color: '#c0613f' },
    { id: 3, name: 'Gemeindeleben', color: '#4c9a5f' },
    { id: 4, name: 'Musik', color: '#5c6bc0' },
];

/**
 * A picture as SVG: a gradient and shapes – enough to look like a photo's colours, made of nothing
 * real and without text (wish of the user, 2026-09-29). `_title` only names the picture in this file.
 */
function poster(_title: string, from: string, to: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="1600" height="900" fill="url(#g)"/>
<circle cx="1260" cy="220" r="260" fill="#ffffff" opacity="0.12"/><circle cx="260" cy="760" r="340" fill="#000000" opacity="0.10"/>
<path d="M0 900L520 470L860 720L1150 520L1600 860V900Z" fill="#000000" opacity="0.14"/></svg>`;
}

/** A person's picture: a plain silhouette on a colour – no face of anyone real, no text. */
function avatar(colour: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="${colour}"/>
<circle cx="100" cy="78" r="38" fill="#ffffff" opacity="0.85"/><path d="M30 200c0-44 31-72 70-72s70 28 70 72z" fill="#ffffff" opacity="0.85"/></svg>`;
}

const PICTURES: Record<number, string> = {
    77: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><circle cx="200" cy="200" r="190" fill="#ffffff"/><path d="M200 70v260M120 150h160" stroke="#2e7d8c" stroke-width="44" stroke-linecap="round"/></svg>`,
    901: poster('Gottesdienst', '#1d3557', '#2e7d8c'),
    902: poster('Jugendtreff', '#7c2d12', '#c0613f'),
    903: poster('Frühstück', '#14532d', '#4c9a5f'),
    904: poster('Konzert', '#312e81', '#5c6bc0'),
    905: poster('Sommerfest', '#9a3412', '#eab308'),
    911: poster('Hauskreis', '#1e3a8a', '#0ea5e9'),
    912: poster('Jugend', '#7c2d12', '#f97316'),
    913: poster('Kinder', '#14532d', '#84cc16'),
    914: poster('Chor', '#4c1d95', '#a855f7'),
    921: avatar('#0f766e'),
    922: avatar('#b45309'),
    923: avatar('#7c3aed'),
    924: avatar('#be123c'),
    932: poster('Freizeit', '#9a3412', '#f97316'),
};

/** Master data as a group homepage names it (G40): weekdays with ChurchTools' order, Monday first. */
const WEEKDAY = {
    wednesday: { id: 3, name: 'wednesday', nameTranslated: 'Mittwoch', sortKey: 2 },
    thursday: { id: 4, name: 'thursday', nameTranslated: 'Donnerstag', sortKey: 3 },
    friday: { id: 5, name: 'friday', nameTranslated: 'Freitag', sortKey: 4 },
    saturday: { id: 6, name: 'saturday', nameTranslated: 'Samstag', sortKey: 5 },
    sunday: { id: 0, name: 'sunday', nameTranslated: 'Sonntag', sortKey: 6 },
};

function leader(first: string, last: string, picture: number | null): unknown {
    return {
        domainType: 'person',
        title: `${first} ${last}`,
        imageUrl: picture ? `${origin}/images/${picture}/person.svg` : null,
        domainAttributes: { firstName: first, lastName: last, isArchived: false, dateOfDeath: null },
    };
}

/** The homepage "Kleingruppen" of the made-up church, with what ChurchTools shows the public. */
function homepage(): unknown {
    const group = (
        id: number,
        name: string,
        weekday: keyof typeof WEEKDAY,
        time: string,
        target: string,
        category: string,
        color: string,
        note: string,
        picture: number | null,
        leaders: unknown[],
        places: [number | null, number] = [null, 0],
    ) => ({
        id,
        name,
        maxMemberCount: places[0],
        currentMemberCount: places[1],
        requestedSeatsCount: 0,
        allowWaitinglist: false,
        information: {
            note,
            imageUrl: picture ? `${origin}/images/${picture}/gruppe.svg` : null,
            meetingTime: time,
            weekday: WEEKDAY[weekday],
            targetGroup: { name: target, nameTranslated: target, sortKey: 1 },
            groupCategory: { name: category, sortKey: 10 },
            color,
            leader: leaders,
        },
    });
    return {
        showLeaders: true,
        showGroupImages: true,
        groups: [
            group(41, 'Hauskreis Mitte', 'wednesday', '19:30', 'Erwachsene', 'Hauskreise', 'sky',
                'Wir lesen gemeinsam in der Bibel, beten füreinander und teilen den Alltag. Neue sind jederzeit willkommen – **einfach vorbeikommen**.',
                911, [leader('Anna', 'Beispiel', 921), leader('Jonas', 'Muster', 922)], [12, 9]),
            group(42, 'Jugendkreis', 'friday', '19:00', 'Jugendliche', 'Jugend', 'orange',
                'Spiele, Gespräche und Andacht für alle zwischen 13 und 19 Jahren. Einmal im Monat kochen wir zusammen.',
                912, [leader('Lea', 'Sommer', 923)]),
            group(43, 'Kinderkirche', 'sunday', '10:00', 'Kinder', 'Kinder', 'lime',
                'Parallel zum Gottesdienst: Geschichten aus der Bibel, Lieder und Basteln für Kinder von 3 bis 11 Jahren.',
                913, [leader('Tim', 'Kaiser', 924)]),
            group(44, 'Gemeindechor', 'thursday', '20:00', 'Jeder', 'Musik', 'purple',
                'Vierstimmig, von Gospel bis Choral. Notenkenntnisse helfen, sind aber keine Bedingung.',
                914, [leader('Jonas', 'Muster', 922)], [30, 28]),
            group(45, 'Werkstatt-Team', 'saturday', '10:00', 'Erwachsene', 'Dienste', 'teal',
                'Wir reparieren, was im Gemeindehaus anfällt, und bauen für Feste auf.',
                null, [leader('Anna', 'Beispiel', 921)]),
        ],
    };
}

/** Groups with posts switched on, and two posts – for the posts block. */
const POST_GROUPS = [
    { id: 42, name: 'Jugendkreis', settings: { postsEnabled: true, visibility: 'public' } },
    { id: 44, name: 'Gemeindechor', settings: { postsEnabled: true, visibility: 'public' } },
];

function posts(): unknown[] {
    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
    return [
        {
            id: 2,
            title: 'Sommerfreizeit: Anmeldung offen',
            content: 'Vom 3. bis 10. August fahren wir an die Ostsee. **Anmeldeschluss ist der 30. Juni.**\n\nFragen? Sprich uns nach dem Jugendkreis an.',
            publishedDate: daysAgo(1),
            group: { domainIdentifier: '42', title: 'Jugendkreis', color: { key: 'orange' }, initials: 'JK' },
            imagesMeta: [{ imageUrl: `${origin}/images/932/freizeit.svg`, aspectRatio: 16 / 9 }],
        },
        {
            id: 1,
            title: 'Neue Stimmen gesucht',
            content: 'Für das Konzert im Herbst suchen wir Verstärkung im Tenor und Bass.',
            publishedDate: daysAgo(4),
            group: { domainIdentifier: '44', title: 'Gemeindechor', color: { key: 'purple' }, initials: 'GC' },
            imagesMeta: [],
        },
    ];
}

/** The rooms booked for an appointment (by its number), as `include[]=bookings` sends them – Saal and Jugendkeller of `RESOURCES`. */
const APPOINTMENT_ROOMS: Record<number, number> = { 1: 1, 5: 1, 2: 3 };

function appointments(withBookings: boolean): unknown[] {
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
            ...(withBookings
                ? {
                      bookings: APPOINTMENT_ROOMS[i + 1]
                          ? [{ base: { id: 100 + i, title: 'Buchung', resourceId: APPOINTMENT_ROOMS[i + 1], statusId: 2 } }]
                          : [],
                  }
                : {}),
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

/** The rooms of the made-up church – and a projector, which the block does not offer. */
const RESOURCE_TYPES = [
    { id: 1, name: 'resource.type.room', nameTranslated: 'Raum', sortKey: 10 },
    { id: 2, name: 'resource.type.item', nameTranslated: 'Gegenstand', sortKey: 20 },
];
const RESOURCES = [
    { id: 1, name: 'Saal', nameTranslated: 'Saal', sortKey: 10, resourceTypeId: 1 },
    { id: 2, name: 'Gruppenraum 1', nameTranslated: 'Gruppenraum 1', sortKey: 20, resourceTypeId: 1 },
    { id: 3, name: 'Jugendkeller', nameTranslated: 'Jugendkeller', sortKey: 30, resourceTypeId: 1 },
    { id: 4, name: 'Beamer', nameTranslated: 'Beamer', sortKey: 40, resourceTypeId: 2 },
];

/**
 * The pictures are taken on an ordinary morning, today at 10:30 – the browser's clock is fixed to it
 * (`fakeChurch`), so that the rooms show a Sunday-like morning whenever the pictures are made. Appointments
 * start tomorrow at the earliest and posts lie days back, so they do not mind.
 */
const DOC_NOW = (() => {
    const now = new Date();
    now.setHours(10, 30, 0, 0);
    return now;
})();

/** Bookings around `DOC_NOW`: one running, the others to come today. */
function bookings(resourceId: number): unknown[] {
    const at = (minutes: number) => new Date(DOC_NOW.getTime() + minutes * 60_000).toISOString().replace(/\.\d+Z$/, 'Z');
    const make = (id: number, title: string, from: number, to: number) => {
        const base = { id, title, resourceId, statusId: 2, allDay: false, startDate: at(from), endDate: at(to) };
        return { booking: { base, calculated: { startDate: base.startDate, endDate: base.endDate } } };
    };
    if (resourceId === 1) return [make(1, 'Gottesdienst', -30, 60), make(2, 'Chorprobe', 450, 540)];
    if (resourceId === 2) return [make(3, 'Kindergottesdienst', -30, 60), make(4, 'Bibelgespräch', 510, 600)];
    if (resourceId === 3) return [make(5, 'Jugendtreff', 450, 600)];
    return [];
}

/** Every answer of the made-up church; writes stop here, reads the pictures do not need go to the instance. */
async function fakeChurch(page: Page): Promise<void> {
    // From this moment on the clock runs: a frozen one makes Vue drop every handler after the first of an event
    // (its time stamp is never later than the handler's), and a press on a block would not choose it.
    await page.clock.setSystemTime(DOC_NOW);
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
        if (path === '/config') return json({ timezone: 'Europe/Berlin' });
        if (path === '/info') return json({ siteName: 'Gemeinde am Markt' });
        if (path === '/calendars') return json(CALENDARS);
        if (path === '/calendars/appointments') {
            return json(appointments(new URL(request.url()).searchParams.has('include[]')));
        }
        if (path === '/groups') return route.fulfill({ json: { data: POST_GROUPS, meta: { pagination: { lastPage: 1 } } } });
        if (path === '/posts') return json(posts());
        if (path === '/grouphomepages') {
            return json([
                {
                    domainType: 'grouphomepage',
                    domainIdentifier: '1',
                    title: 'Kleingruppen',
                    apiUrl: `${origin}/api/grouphomepages/kleingruppen`,
                    domainAttributes: { parentGroupId: 40, childGroupIds: [41, 42, 43, 44, 45] },
                },
            ]);
        }
        if (path === '/grouphomepages/kleingruppen') return json(homepage());
        if (path === '/services') {
            return json([
                { id: 1, name: 'Predigt', serviceGroupId: 1, hidePersonName: false, sortKey: 10 },
                { id: 2, name: 'Moderation', serviceGroupId: 1, hidePersonName: false, sortKey: 20 },
            ]);
        }
        if (path === '/servicegroups') return json([{ id: 1, name: 'Programm', viewAll: true }]);
        if (path === '/resource/masterdata') return json({ resourceTypes: RESOURCE_TYPES, resources: RESOURCES });
        if (path === '/bookings') {
            const ids = new URL(request.url()).searchParams.getAll('resource_ids[]').map(Number);
            return json(ids.flatMap(bookings));
        }
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
    await openSection(page, 'measures');
    for (const [key, value] of Object.entries(box)) {
        const field = page.getByTestId(`inspector-${key}`);
        await field.fill(String(value));
        await field.blur();
    }
}

async function shoot(page: Page, name: string): Promise<void> {
    await page.addStyleTag({ content: '[data-testid^="demo-notice"] { display: none !important; }' });
    // Pictures and fonts; in the editor also the draft, which is saved 2 s after the last change (Plan.md 79, E).
    await page.waitForTimeout(2500);
    const status = page.getByTestId('save-status');
    if (await status.count()) await expect(status).not.toContainText('Sichert', { timeout: 15_000 });
    await page.screenshot({ path: `${OUT}/${name}.png` });
}

test('pictures for the documentation', async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    origin = new URL(baseURL!).origin;
    await fakeChurch(page);

    // Services appear only once an administrator allows them (0.6.0): the demo store gets settings that allow both.
    await page.goto('./'); // seeds the demo store
    await page.evaluate(() => {
        const key = 'infoscreen-designer.demo-store';
        const state = JSON.parse(localStorage.getItem(key)!) as {
            nextId: number;
            categories: { id: number; shorty: string }[];
            values: [number, { id: number; value: string }[]][];
        };
        const category = state.categories.find((c) => c.shorty === 'settings')!;
        const schema = (JSON.parse(state.values.flatMap(([, list]) => list)[0]!.value) as { schema: unknown }).schema;
        let entry = state.values.find(([id]) => id === category.id);
        if (!entry) state.values.push((entry = [category.id, []]));
        const existing = entry[1][0];
        const settings = existing ? (JSON.parse(existing.value) as Record<string, unknown>) : { schema, id: 'settings', kind: 'settings' };
        settings.allowedServiceIds = [1, 2];
        if (existing) existing.value = JSON.stringify(settings);
        else entry[1].push({ id: state.nextId++, value: JSON.stringify(settings) });
        localStorage.setItem(key, JSON.stringify(state));
    });

    // The look first: large appointments, so that the pictures show the cards.
    await page.goto('design');
    await page.getByTestId('appointments-large').check();
    // Two of the church's colours with names: the palette shows on the page, the swatches in the editor (Plan.md 64).
    for (const [i, [name, hex]] of [['Gemeindeblau', '#1d4ed8'], ['Sonnengelb', '#f5b301']].entries()) {
        await page.getByTestId('palette-add').click();
        const entry = page.getByTestId('palette-entry').nth(i);
        await entry.getByTestId('palette-name').fill(name!);
        await entry.locator('input.hex').fill(hex!);
        await entry.locator('input.hex').blur();
    }
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
    await addBlock(page, 'image');
    await page.getByTestId('block-inspector').getByTestId('pick-image').click();
    await page.getByTestId('media-library').locator('button.pick').first().click();
    await expect(page.getByTestId('media-library')).toBeHidden();
    await frame(page, { x: 0, y: 160, width: 1080, height: 608 });
    await page.getByTestId('grid').click({ position: { x: 5, y: 5 } });
    await addBlock(page, 'countdown');
    await frame(page, { x: 60, y: 900, width: 960, height: 520 });
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Veröffentlicht');

    // The first screen's playlist.
    await page.goto('./');
    await page.getByTestId('screen-card').filter({ hasText: 'Foyer' }).getByTestId('open-editor').click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await page.getByTestId('slide-item').nth(2).click();
    await page.getByTestId('frame-appointment-list').first().click();
    // The place goes before the room (0.17.1): where the appointment has a place, only that stands.
    await page.getByTestId('show-rooms').check();
    await expect(page.locator('.editor-stage').getByTestId('list-place').first()).toContainText('Kirchsaal');
    await expect(page.getByTestId('quick-menu')).toBeVisible(); // the short menu over the list (Plan.md 79, C1)
    await expect(page.getByTestId('save-status')).toContainText('Entwurf gesichert', { timeout: 15_000 });
    await shoot(page, 'editor');

    // Every block of the slide, with the field "Ausrichten" of the short menu open (Plan.md 79, D4).
    await page.getByTestId('grid').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('ControlOrMeta+a');
    await expect(page.getByTestId('selection-box')).toBeVisible();
    await page.getByTestId('quick-menu').getByTestId('quick-chip').click();
    await expect(page.getByTestId('quick-popover').getByTestId('arrange-top')).toBeVisible();
    await shoot(page, 'mehrere');
    await page.keyboard.press('Escape');
    await page.getByTestId('grid').click({ position: { x: 5, y: 5 } });

    // Groups of a group homepage: two a page, with leaders and their pictures (Plan.md 43).
    await page.getByTestId('add-slide').click();
    await addBlock(page, 'groups');
    await page.getByTestId('groups-homepage').selectOption('40');
    await frame(page, { x: 60, y: 60, width: 1800, height: 960 });
    await choose(page, 'groups-per-page', '2');
    // A font as a church would set it for two cards a page; the default (56 px) is meant for one.
    await openSection(page, 'font');
    await page.getByTestId('font-size').fill('44');
    await openSection(page, 'fields');
    await page.getByTestId('group-show-leaders').check();
    await page.getByTestId('group-show-leaderImages').check();
    await expect(page.locator('.editor-stage').getByTestId('group-card').first()).toBeVisible();
    await shoot(page, 'gruppen');

    // A slideshow of three library pictures (Plan.md 46), on a slide of its own.
    await page.getByTestId('add-slide').click();
    await addBlock(page, 'slideshow');
    await frame(page, { x: 160, y: 140, width: 1600, height: 800 });
    await page.getByTestId('block-inspector').getByTestId('pick-slideshow').click();
    const library = page.getByTestId('media-library');
    for (const name of ['jugendtreff', 'fruehstueck', 'konzertabend']) {
        await library.getByTestId('media-item').filter({ hasText: name }).locator('button.pick').click();
    }
    await library.getByTestId('media-add').click();
    await expect(library).toBeHidden();
    await openSection(page, 'slideshow-images');
    await expect(page.getByTestId('slideshow-row')).toHaveCount(3);
    await page.getByTestId('slideshow-seconds').fill('8');
    await page.getByTestId('slideshow-seconds').blur();
    await shoot(page, 'galerie');
    await page.getByTestId('slide-item').nth(3).click();
    await page.getByTestId('frame-groups').first().click();

    // The same slide as the TV shows it, in the full-screen preview.
    await page.getByTestId('open-preview').click();
    await expect(page.getByTestId('playlist-preview')).toBeVisible();
    await page.mouse.move(5, 5);
    await page.waitForTimeout(3000); // the controls step aside, as on a TV
    await shoot(page, 'vorschau');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('playlist-preview')).toBeHidden();

    // The room occupancy (Plan.md 46): three rooms, one booking running, the others to come.
    await page.getByTestId('add-slide').click();
    await addBlock(page, 'rooms');
    await frame(page, { x: 160, y: 140, width: 1600, height: 800 });
    await page.getByTestId('rooms-add-all').click();
    await openSection(page, 'room-list');
    await page.getByTestId('room-entry').nth(0).getByTestId('room-hint').fill('Erdgeschoss');
    await page.getByTestId('room-entry').nth(1).getByTestId('room-hint').fill('1. OG, links');
    await page.getByTestId('room-entry').nth(2).getByTestId('room-hint').fill('Untergeschoss');
    await expect(page.locator('.editor-stage').getByTestId('room-row')).toHaveCount(3);
    await shoot(page, 'raumbelegung');

    // Posts of ChurchTools groups (Plan.md 33).
    await page.getByTestId('add-slide').click();
    await addBlock(page, 'posts');
    await openSection(page, 'post-groups');
    await page.getByTestId('post-group-42').check();
    await page.getByTestId('post-group-44').check();
    await frame(page, { x: 160, y: 140, width: 1600, height: 800 });
    await expect(page.locator('.editor-stage').getByTestId('posts-card')).toContainText('Sommerfreizeit');
    await shoot(page, 'beitraege');
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Veröffentlicht');
    // One more step, kept as a draft: the tile under "Präsentationen" carries the mark "Entwurf" (Plan.md 79, E).
    await page.getByTestId('frame-posts').first().click();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('save-status')).toContainText('Entwurf gesichert', { timeout: 15_000 });

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

    // A band over every slide of the first screen – since 0.2.0 on its own page, "Hinweise" (Plan.md 34). Made only
    // now: the band lies over every slide, and the other pictures show the editor without it (user, 2026-10-09).
    await page.goto('hinweise');
    await page.getByTestId('new-notice').click();
    const notice = page.getByTestId('notice-dialog');
    await notice.getByTestId('banner-text').fill('Nach dem Gottesdienst: Kirchencafé im Foyer – herzlich willkommen!');
    // Standing for the picture: running text would be caught halfway in the frame.
    await notice.getByTestId('banner-mode').selectOption('static');
    await notice.getByTestId('notice-save').click();
    await expect(notice).toBeHidden();
    await expect(page.getByTestId('notice-card').first()).toBeVisible();
    await shoot(page, 'hinweise');
});

test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('the editor with its bars', async ({ page, baseURL }) => {
        origin = new URL(baseURL!).origin;
        await fakeChurch(page);
        await page.goto('./');
        await page.getByTestId('screen-card').filter({ hasText: 'Foyer' }).getByTestId('open-editor').click();
        const sh = await openSlides(page);
        await sh.getByTestId('slide-item').nth(2).click(); // the appointments
        await page.getByTestId('frame-appointment-list').first().tap();
        // The block's row over the slide row (Plan.md 79, C2); the big sheet opens only with "Alle Einstellungen".
        await expect(page.getByTestId('phone-block-row')).toBeVisible();
        await shoot(page, 'handy');
    });
});
