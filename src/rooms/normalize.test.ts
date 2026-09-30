import { describe, expect, it } from 'vitest';
import { normalizeBookings, reviveRooms, roomsOf, type RoomBookings } from './normalize';

/** A booking as `/bookings` sends it (G45) – with everything the block must never take. */
function booking(overrides: Record<string, unknown> = {}, calculated: Record<string, unknown> | null = {}) {
    const base = {
        id: 1,
        title: 'Gottesdienst',
        subtitle: 'Untertitel',
        caption: 'Gottesdienst',
        location: 'Ort',
        note: 'Notiz',
        description: 'Beschreibung mit Namen',
        resourceId: 3,
        statusId: 2,
        allDay: false,
        startDate: '2026-09-27T08:30:00Z',
        endDate: '2026-09-27T11:00:00Z',
        onBehalfOfPid: 77,
        answeredPid: 78,
        appointment: { id: 1, title: 'Gottesdienst', calendarId: 2 },
        meta: { createdPerson: { id: 1 } },
        resource: { id: 3, name: 'Raum 01' },
        ...overrides,
    };
    return { booking: { base, calculated: calculated === null ? undefined : { startDate: base.startDate, endDate: base.endDate, ...calculated } }, base };
}

describe('normalizeBookings (Plan.md 46, privacy)', () => {
    it('keeps exactly room, start, end, all day and title – nothing that describes a person or the occasion', () => {
        const [b] = normalizeBookings([booking()]);
        expect(Object.keys(b!).sort()).toEqual(['allDay', 'end', 'id', 'resourceId', 'start', 'title']);
        expect(b).toEqual({
            id: 1,
            resourceId: 3,
            title: 'Gottesdienst',
            start: new Date('2026-09-27T08:30:00Z'),
            end: new Date('2026-09-27T11:00:00Z'),
            allDay: false,
        });
        expect(JSON.stringify(b)).not.toMatch(/Beschreibung|Notiz|Untertitel|77|78/);
    });

    it('drops every booking that is not confirmed, even when the server sent it', () => {
        const list = normalizeBookings([booking({ id: 1, statusId: 1 }), booking({ id: 2, statusId: 3 }), booking({ id: 3, statusId: 2 })]);
        expect(list.map((b) => b.id)).toEqual([3]);
    });

    it('takes the times of a series from `calculated`, else from `base`', () => {
        const [a] = normalizeBookings([booking({}, { startDate: '2026-10-04T08:30:00Z', endDate: '2026-10-04T11:00:00Z' })]);
        expect(a!.start).toEqual(new Date('2026-10-04T08:30:00Z'));
        const [b] = normalizeBookings([booking({}, null)]);
        expect(b!.start).toEqual(new Date('2026-09-27T08:30:00Z'));
    });

    it('carries "all day", and turns an empty or blank title into null', () => {
        const [a, b, c] = normalizeBookings([booking({ id: 1, allDay: true }), booking({ id: 2, title: '   ' }), booking({ id: 3, title: null })]);
        expect(a!.allDay).toBe(true);
        expect(b!.title).toBeNull();
        expect(c!.title).toBeNull();
    });

    it('drops a booking without a readable time or id', () => {
        expect(normalizeBookings([booking({ startDate: 'kaputt' }, null), booking({ id: 'x' }), {}, null as never])).toEqual([]);
    });
});

describe('roomsOf', () => {
    const masterdata = {
        resourceTypes: [
            { id: 1, name: 'resource.type.room', nameTranslated: 'Raum' },
            { id: 2, name: 'resource.type.item', nameTranslated: 'Gegenstand' },
            { id: 9, name: 'resource.type.other', nameTranslated: 'Raum' },
        ],
        resources: [
            { id: 2, name: 'Küche', nameTranslated: 'Küche', sortKey: 20, resourceTypeId: 1 },
            { id: 1, name: 'Saal', nameTranslated: 'Saal', sortKey: 10, resourceTypeId: 1 },
            { id: 5, name: 'Beamer', nameTranslated: 'Beamer', sortKey: 5, resourceTypeId: 2 },
            { id: 6, name: 'Anderer Typ', sortKey: 1, resourceTypeId: 9 },
            { id: 4, name: 'Bbb', nameTranslated: 'Beta', sortKey: 30, resourceTypeId: 1 },
            { id: 3, name: 'Aaa', sortKey: 30, resourceTypeId: 1 },
        ],
    };

    it('lists only resources of the type with the key "resource.type.room", by sort key, then name', () => {
        expect(roomsOf(masterdata)).toEqual([
            { id: 1, name: 'Saal' },
            { id: 2, name: 'Küche' },
            { id: 3, name: 'Aaa' },
            { id: 4, name: 'Beta' },
        ]);
    });

    it('is empty without rooms, types or data – what a caller without the right gets (G45)', () => {
        expect(roomsOf({ resourceTypes: masterdata.resourceTypes, resources: [] })).toEqual([]);
        expect(roomsOf({ resources: masterdata.resources })).toEqual([]);
        expect(roomsOf(null)).toEqual([]);
    });
});

describe('reviveRooms', () => {
    it('brings dates back from a JSON round trip', () => {
        const rooms: RoomBookings[] = [
            { resourceId: 1, name: 'Saal', bookings: [{ id: 1, resourceId: 1, title: null, start: new Date('2026-09-27T08:30:00Z'), end: new Date('2026-09-27T09:30:00Z'), allDay: false }] },
        ];
        const revived = reviveRooms(JSON.parse(JSON.stringify(rooms)));
        expect(revived).toEqual(rooms);
        expect(revived[0]!.bookings[0]!.start).toBeInstanceOf(Date);
    });
});
