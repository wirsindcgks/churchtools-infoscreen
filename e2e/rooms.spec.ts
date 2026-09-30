import { expect, test, type Page, type Route } from '@playwright/test';
import { addBlock } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * The block "Raumbelegung" (Plan.md 46) in demo mode. ChurchTools' answers are made up here: rooms and
 * bookings at a fixed clock (Saturday, 10:30 Berlin time), so that "now" is the same on every run.
 * Nothing of this reaches the instance; what the file does not answer gets a 404.
 */
const NOW = new Date('2026-10-03T08:30:00Z');

const TYPES = [
    { id: 1, name: 'resource.type.room', nameTranslated: 'Raum', sortKey: 10 },
    { id: 2, name: 'resource.type.item', nameTranslated: 'Gegenstand', sortKey: 20 },
];
const LONG_NAME = 'Großer Gemeindesaal im Erdgeschoss mit Bühne, Empore und Nebenräumen';
const ROOMS = [
    { id: 1, name: 'Saal', nameTranslated: 'Saal', sortKey: 10, resourceTypeId: 1 },
    { id: 2, name: 'Gruppenraum 1', nameTranslated: 'Gruppenraum 1', sortKey: 20, resourceTypeId: 1 },
    { id: 3, name: 'Jugendkeller', nameTranslated: 'Jugendkeller', sortKey: 30, resourceTypeId: 1 },
    { id: 4, name: 'Beamer', nameTranslated: 'Beamer', sortKey: 5, resourceTypeId: 2 },
];

/** A booking as `/bookings` sends it – with fields the block must never show. */
function booking(id: number, resourceId: number, title: string, from: string, to: string, statusId = 2) {
    const base = {
        id,
        title,
        resourceId,
        statusId,
        allDay: false,
        startDate: `2026-10-03T${from}:00Z`,
        endDate: `2026-10-03T${to}:00Z`,
        description: 'Geheime Beschreibung',
        onBehalfOfPid: 77,
    };
    return { booking: { base, calculated: { startDate: base.startDate, endDate: base.endDate } } };
}
const BOOKINGS: Record<number, unknown[]> = {
    1: [booking(1, 1, 'Gottesdienst', '07:30', '09:30'), booking(2, 1, 'Chorprobe', '12:00', '13:00')],
    2: [
        booking(3, 2, 'Gespräch Familie Beispiel', '12:00', '13:30'),
        booking(4, 2, 'Noch nicht bestätigt', '14:00', '15:00', 1),
    ],
    3: [],
};

/**
 * An appointment as `/calendars/appointments` sends it with `include[]=bookings`: the bookings beside `base`,
 * with fields that must never show – a confirmed room, a confirmed item, a waiting room.
 */
const APPOINTMENT = {
    appointment: {
        base: {
            id: 9,
            title: 'Sonntagsgottesdienst',
            allDay: false,
            calendar: { id: 1, name: 'Gottesdienste', color: '#2e7d8c' },
            address: { name: 'Kirchsaal' },
        },
        calculated: { startDate: '2026-10-04T08:00:00Z', endDate: '2026-10-04T09:30:00Z' },
    },
    bookings: [
        { base: { id: 11, title: 'Geheimer Buchungstitel', resourceId: 1, statusId: 2, description: 'Geheim', onBehalfOfPid: 77 } },
        { base: { id: 12, title: 'Beamer-Buchung', resourceId: 4, statusId: 2 } },
        { base: { id: 13, title: 'Noch nicht bestätigt', resourceId: 2, statusId: 1 } },
    ],
};

interface Church {
    rooms?: typeof ROOMS;
    /** Rooms whose bookings answer 403, as for a device without the right (G45). */
    forbidden?: number[];
    bookingRequests: URLSearchParams[];
    /** The requests for appointments, to see whether the bookings were asked for. */
    appointmentRequests?: URLSearchParams[];
}

async function fakeChurch(page: Page, church: Church = { bookingRequests: [] }): Promise<Church> {
    await page.clock.setFixedTime(NOW);
    await page.route('**/api/**', (route: Route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname.replace(/^.*?\/api/, '');
        const json = (data: unknown) => route.fulfill({ json: { data } });
        if (request.method() !== 'GET') return json({});
        if (path === '/config') return json({ timezone: 'Europe/Berlin' });
        if (path === '/whoami') return json({ id: 1, firstName: 'Anna', lastName: 'Beispiel' });
        if (path === '/info') return json({ siteName: 'Gemeinde am Markt' });
        if (path === '/calendars') return json([{ id: 1, name: 'Gottesdienste', color: '#2e7d8c' }]);
        if (path === '/calendars/appointments') {
            church.appointmentRequests?.push(url.searchParams);
            // The bookings only where they were asked for – as ChurchTools does.
            return json([url.searchParams.has('include[]') ? APPOINTMENT : { appointment: APPOINTMENT.appointment }]);
        }
        if (path === '/permissions/global') return json({ churchcore: { 'administer persons': true } });
        if (path === '/resource/masterdata') return json({ resourceTypes: TYPES, resources: church.rooms ?? ROOMS });
        if (path === '/bookings') {
            church.bookingRequests.push(url.searchParams);
            const ids = url.searchParams.getAll('resource_ids[]').map(Number);
            if (ids.some((id) => church.forbidden?.includes(id))) {
                return route.fulfill({ status: 403, json: { message: 'Du darfst das Objekt nicht sehen.' } });
            }
            return json(ids.flatMap((id) => BOOKINGS[id] ?? []));
        }
        return route.fulfill({ status: 404, json: { message: 'nicht gemacht' } });
    });
    return church;
}

/** A new rooms block on a slide of its own. */
async function newRoomsBlock(page: Page, ownSlide = true): Promise<void> {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    if (ownSlide) await page.getByTestId('add-slide').click();
    await addBlock(page, 'rooms');
    await expect(page.getByTestId('block-inspector')).toBeVisible();
}

/** A new block of this type on a slide of its own. */
async function newBlock(page: Page, type: string): Promise<void> {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await page.getByTestId('add-slide').click();
    await addBlock(page, type);
    await expect(page.getByTestId('block-inspector')).toBeVisible();
}

const stage = (page: Page) => page.locator('.editor-stage');

test('choose rooms, see the bookings, and keep the titles private where asked', async ({ page }) => {
    const church = await fakeChurch(page);
    await newRoomsBlock(page);

    // Nothing chosen yet: a calm placeholder, and the choice offers rooms only – no Beamer.
    await expect(stage(page).getByTestId('rooms-placeholder')).toHaveText('Räume wählen');
    const add = page.getByTestId('rooms-add');
    await expect(add.locator('option')).toHaveText(['+ Raum', 'Saal', 'Gruppenraum 1', 'Jugendkeller']);
    await add.selectOption('2');
    await expect(page.getByTestId('room-entry')).toHaveCount(1);
    await page.getByTestId('rooms-add-all').click();
    await expect(page.getByTestId('room-name')).toHaveText(['Gruppenraum 1', 'Saal', 'Jugendkeller']);
    await expect(page.getByTestId('rooms-count')).toHaveText('3 von 30');
    await expect(page.getByTestId('rooms-add')).toBeDisabled();

    // One request per room, for confirmed bookings only.
    await expect.poll(() => church.bookingRequests.length).toBeGreaterThanOrEqual(3);
    for (const request of church.bookingRequests) {
        expect(request.getAll('resource_ids[]')).toHaveLength(1);
        expect(request.getAll('status_ids[]')).toEqual(['2']);
    }

    // Saal first (the order of the list is the order on the stage).
    await page.getByTestId('room-entry').nth(1).getByTestId('room-up').click();
    await expect(page.getByTestId('room-name')).toHaveText(['Saal', 'Gruppenraum 1', 'Jugendkeller']);
    await page.getByTestId('room-entry').nth(0).getByTestId('room-hint').fill('EG, links');

    // Jugendkeller has nothing today: it drops out. The running booking is marked, the pending one is not there.
    const rows = stage(page).getByTestId('room-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Saal');
    await expect(rows.nth(0)).toContainText('EG, links');
    const running = rows.nth(0).locator('[data-now]');
    await expect(running).toContainText('09:30–11:30');
    await expect(running).toContainText('Gottesdienst');
    await expect(rows.nth(0)).toContainText('Chorprobe');
    await expect(rows.nth(1)).toContainText('Gespräch Familie Beispiel');
    await expect(stage(page)).not.toContainText('Noch nicht bestätigt');
    await expect(stage(page)).not.toContainText('Geheime Beschreibung');
    await page.screenshot({ path: 'test-results/rooms-overview.png' });

    // Switching the title off for the room with the name in it: "Belegt".
    await page.getByTestId('room-entry').nth(1).getByTestId('room-titles').uncheck();
    await expect(rows.nth(1)).toContainText('Belegt');
    await expect(stage(page)).not.toContainText('Familie Beispiel');
    await expect(rows.nth(0)).toContainText('Gottesdienst');
    await page.getByTestId('room-entry').nth(1).locator('.info-btn').click();
    await expect(page.getByRole('note').filter({ hasText: 'Gespräch Familie X' })).toBeVisible();
});

test('the door sign shows the first room: now, then what follows – or free', async ({ page }) => {
    await fakeChurch(page);
    await newRoomsBlock(page);
    await page.getByTestId('rooms-add-all').click();
    await page.getByTestId('rooms-layout').selectOption('door');
    await expect(page.getByTestId('rooms-door-hint')).toHaveText('Das Türschild zeigt den ersten Raum der Liste.');

    const door = stage(page).getByTestId('rooms-door');
    await expect(door.getByTestId('door-name')).toHaveText('Saal');
    await expect(door.getByTestId('door-current')).toHaveText('Gottesdienst');
    await expect(door.getByTestId('door-state')).toContainText('Jetzt');
    await expect(door.getByTestId('door-state')).toContainText('bis 11:30');
    await expect(door.getByTestId('door-line')).toHaveCount(1);
    await expect(door.getByTestId('door-next')).toContainText('Danach');
    await expect(door.getByTestId('door-next')).toContainText('14:00–15:00');
    await expect(door.getByTestId('door-next')).toContainText('Chorprobe');
    await page.screenshot({ path: 'test-results/rooms-door.png' });

    // The second room: free now, until its next booking.
    await page.getByTestId('room-entry').nth(1).getByTestId('room-up').click();
    await expect(door.getByTestId('door-name')).toHaveText('Gruppenraum 1');
    await expect(door.getByTestId('door-current')).toHaveText('Frei');
    await expect(door.getByTestId('door-state')).toContainText('bis 14:00');
    // The third has nothing at all: free without "until", and no "Danach".
    await page.getByTestId('room-entry').nth(2).getByTestId('room-up').click();
    await page.getByTestId('room-entry').nth(1).getByTestId('room-up').click();
    await expect(door.getByTestId('door-name')).toHaveText('Jugendkeller');
    await expect(door.getByTestId('door-current')).toHaveText('Frei');
    await expect(door.getByTestId('door-state')).not.toContainText('bis');
    await expect(door.getByTestId('door-next')).toHaveCount(0);
});

test('an empty day says so, and two days mark tomorrow', async ({ page }) => {
    await fakeChurch(page);
    await newRoomsBlock(page);
    await page.getByTestId('rooms-add').selectOption('3'); // only the Jugendkeller, no booking
    await expect(stage(page).getByTestId('rooms-empty')).toHaveText('Heute sind keine Räume belegt.');
    await page.getByTestId('rooms-days').selectOption('2');
    await expect(stage(page).getByTestId('rooms-empty')).toHaveText('Heute und morgen sind keine Räume belegt.');
});

test('rooms that answer 403 are "nicht verfügbar", not an empty day', async ({ page }) => {
    await fakeChurch(page, { forbidden: [3], bookingRequests: [] });
    await newRoomsBlock(page);
    await page.getByTestId('rooms-add').selectOption('3');
    await expect(stage(page).getByTestId('rooms-unreadable')).toHaveText('Raumbelegung nicht verfügbar');
    await expect(stage(page).getByTestId('rooms-empty')).toHaveCount(0);
    // One readable room is enough for the usual rows; the forbidden one simply drops out.
    await page.getByTestId('rooms-add').selectOption('1');
    await expect(stage(page).getByTestId('room-row')).toHaveCount(1);
    await expect(stage(page).getByTestId('rooms-unreadable')).toHaveCount(0);
});

test('without a right to any room the inspector says how to get it', async ({ page }) => {
    await fakeChurch(page, { rooms: [ROOMS[3]!] as typeof ROOMS, bookingRequests: [] }); // an item only
    await newRoomsBlock(page);
    await expect(page.getByTestId('rooms-none')).toContainText('Keine Räume sichtbar.');
    await expect(page.getByTestId('rooms-none')).toContainText('Infoscreen-Designer');
    await expect(page.getByTestId('rooms-add')).toHaveCount(0);
    await expect(stage(page).getByTestId('rooms-placeholder')).toHaveText('Räume wählen');
});

for (const size of [
    { width: 1440, height: 900 },
    { width: 1180, height: 820 },
    { width: 390, height: 844 },
]) {
    test(`the room section stays inside the inspector at ${size.width} x ${size.height}`, async ({ page }) => {
        await fakeChurch(page, {
            rooms: [{ id: 1, name: LONG_NAME, nameTranslated: LONG_NAME, sortKey: 1, resourceTypeId: 1 }, ...ROOMS.slice(1)],
            bookingRequests: [],
        });
        await page.setViewportSize(size);
        // The slide list is folded away on a tablet and a phone: the block goes onto the first slide.
        await newRoomsBlock(page, size.width === 1440);
        // Where the inspector is folded away, open it – as a sheet on the phone, as a column on the tablet.
        if (!(await page.getByTestId('rooms-add-all').isVisible())) {
            await page.getByTestId(size.width === 390 ? 'inspector-sheet-toggle' : 'tablet-inspector-toggle').click();
        }
        await page.getByTestId('rooms-add-all').click();
        await page.getByTestId('room-entry').first().getByTestId('room-hint').fill('z'.repeat(100));
        await page.getByTestId('room-entry').first().locator('.info-btn').click();
        await expect(page.getByTestId('room-entry')).toHaveCount(3);

        const frame = (await page.locator('aside.inspector').boundingBox())!;
        const inside = async (locator: ReturnType<Page['locator']>) => {
            const box = (await locator.boundingBox())!;
            expect(box.x).toBeGreaterThanOrEqual(frame.x - 0.5);
            expect(box.x + box.width).toBeLessThanOrEqual(Math.min(frame.x + frame.width, size.width) + 0.5);
        };
        for (const id of ['room-entry', 'room-name', 'room-hint', 'room-up', 'room-down', 'room-remove', 'room-titles']) {
            const all = page.getByTestId(id);
            for (let i = 0; i < (await all.count()); i++) await inside(all.nth(i));
        }
        await inside(page.getByTestId('rooms-add'));
        await inside(page.getByTestId('rooms-add-all'));
        await inside(page.getByRole('note').filter({ hasText: 'Gespräch Familie X' }).first());
        await page.screenshot({ path: `test-results/rooms-inspector-${size.width}.png` });
    });
}

test('the room at an appointment: beside the place, in both layouts of the next appointment', async ({ page }) => {
    const church = await fakeChurch(page, { bookingRequests: [], appointmentRequests: [] });
    await newBlock(page, 'next-appointment');

    // Asked for with the bookings – and only the confirmed room comes through, no title, no item.
    await expect.poll(() => church.appointmentRequests!.some((r) => r.getAll('include[]').includes('bookings'))).toBe(true);
    const place = stage(page).getByTestId('next-place');
    await page.getByTestId('next-layout').selectOption('card');
    await expect(place).toHaveText('Kirchsaal · Saal');
    await page.screenshot({ path: 'test-results/rooms-at-appointment.png' });
    await page.getByTestId('next-layout').selectOption('classic');
    await expect(place).toHaveText('Kirchsaal · Saal');
    await expect(stage(page)).not.toContainText('Geheimer Buchungstitel');
    await expect(stage(page)).not.toContainText('Beamer');

    // Off: the card shows the place alone, the plain layout none – as before.
    await page.getByTestId('show-rooms').uncheck();
    await expect(place).toHaveCount(0);
    await page.getByTestId('next-layout').selectOption('card');
    await expect(place).toHaveText('Kirchsaal');
    await page.getByTestId('show-rooms').check();
    await expect(place).toHaveText('Kirchsaal · Saal');
});

test('the room in the list of appointments: as cards, not as rows', async ({ page }) => {
    await fakeChurch(page, { bookingRequests: [], appointmentRequests: [] });
    await newBlock(page, 'appointment-list');

    await page.getByTestId('list-layout').selectOption('cards');
    await expect(stage(page).getByTestId('list-place')).toHaveText('Kirchsaal · Saal');
    await expect(page.getByTestId('show-rooms')).toBeVisible();

    await page.getByTestId('list-layout').selectOption('rows');
    await expect(stage(page).getByTestId('list-card')).toHaveCount(0);
    await expect(stage(page)).toContainText('Sonntagsgottesdienst');
    await expect(stage(page)).not.toContainText('Saal');
    await expect(page.getByTestId('show-rooms')).toHaveCount(0);
});
