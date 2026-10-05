import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Block } from '../model/schema';
import { makeSlide } from '../model/testing';

// The client is stubbed: what `PlayerData.rooms` asks of ChurchTools, and what it does with the answers.
const get = vi.hoisted(() => vi.fn());
vi.mock('@churchtools/churchtools-client', () => ({ churchtoolsClient: { get, setBaseUrl: vi.fn() } }));

import { fetchBookings } from '../ct/api';
import { churchToolsPlayerData, roomNeeds } from './data';

const forbidden = () => Object.assign(new Error('403'), { response: { status: 403 } });
const serverError = () => Object.assign(new Error('500'), { response: { status: 500 } });

const masterdata = {
    resourceTypes: [
        { id: 1, name: 'resource.type.room', nameTranslated: 'Raum' },
        { id: 2, name: 'resource.type.item', nameTranslated: 'Gegenstand' },
    ],
    resources: [
        { id: 1, name: 'Saal', nameTranslated: 'Saal', sortKey: 10, resourceTypeId: 1 },
        { id: 3, name: 'Raum 01', nameTranslated: 'Raum 01', sortKey: 30, resourceTypeId: 1 },
        { id: 5, name: 'Beamer', nameTranslated: 'Beamer', sortKey: 50, resourceTypeId: 2 },
    ],
};

function booking(id: number, resourceId: number, start: string, end: string, statusId = 2) {
    const base = { id, title: `Buchung ${id}`, resourceId, statusId, allDay: false, startDate: start, endDate: end, description: 'geheim' };
    return { booking: { base, calculated: { startDate: start, endDate: end } } };
}

const TZ = 'Europe/Berlin';
const FROM = new Date('2026-10-02T22:00:00Z'); // 2026-10-03 00:00 Berlin
const TO = new Date('2026-10-03T22:00:00Z');

/** Answers by path; `bookings` by the room asked for. */
function stubClient(bookings: Record<number, () => unknown[] | never>, masterdataAnswer: unknown = masterdata): void {
    get.mockImplementation(async (path: string, params?: { resource_ids?: number[] }) => {
        if (path === '/resource/masterdata') return masterdataAnswer;
        if (path === '/bookings') return bookings[params!.resource_ids![0]!]!();
        throw new Error(`unexpected ${path}`);
    });
}

beforeEach(() => {
    get.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('fetchBookings', () => {
    it('asks for one room, confirmed bookings only, by the instance dates', async () => {
        get.mockResolvedValue([]);
        await fetchBookings(3, FROM, TO, TZ);
        expect(get).toHaveBeenCalledWith('/bookings', {
            resource_ids: [3],
            status_ids: [2],
            from: '2026-10-03',
            to: '2026-10-04',
        });
    });
});

describe('PlayerData.rooms (Plan.md 46)', () => {
    it('names each room from the master data, asks once per room, and keeps the bookings', async () => {
        stubClient({
            1: () => [booking(1, 1, '2026-10-03T08:00:00Z', '2026-10-03T09:00:00Z')],
            3: () => [],
        });
        const rooms = await churchToolsPlayerData.rooms([1, 3], FROM, TO, TZ);
        expect(rooms.map((r) => [r.resourceId, r.name, r.bookings.length])).toEqual([
            [1, 'Saal', 1],
            [3, 'Raum 01', 0],
        ]);
        expect(get.mock.calls.filter(([path]) => path === '/resource/masterdata')).toHaveLength(1);
        expect(get.mock.calls.filter(([path]) => path === '/bookings')).toHaveLength(2);
        expect(Object.keys(rooms[0]!.bookings[0]!).sort()).toEqual(['allDay', 'end', 'id', 'resourceId', 'start', 'title']);
    });

    it('leaves out only the room that answers 403 – the others stay', async () => {
        stubClient({
            1: () => {
                throw forbidden();
            },
            3: () => [booking(2, 3, '2026-10-03T08:00:00Z', '2026-10-03T09:00:00Z')],
        });
        const rooms = await churchToolsPlayerData.rooms([1, 3], FROM, TO, TZ);
        expect(rooms.map((r) => r.resourceId)).toEqual([3]);
        expect(console.warn).toHaveBeenCalled();
    });

    it('fails on any other error – 500 is not "no right"', async () => {
        stubClient({
            1: () => {
                throw serverError();
            },
            3: () => [],
        });
        await expect(churchToolsPlayerData.rooms([1, 3], FROM, TO, TZ)).rejects.toThrow('500');
    });

    it('leaves out a room the master data does not name, and one that is no room – without asking for its bookings', async () => {
        stubClient({ 1: () => [] });
        const rooms = await churchToolsPlayerData.rooms([1, 5, 99], FROM, TO, TZ);
        expect(rooms.map((r) => r.resourceId)).toEqual([1]);
        expect(get.mock.calls.filter(([path]) => path === '/bookings')).toHaveLength(1);
    });

    it('is empty without rooms in the master data (a caller without the right, G45) and asks for nothing without ids', async () => {
        stubClient({}, { resourceTypes: masterdata.resourceTypes, resources: [] });
        expect(await churchToolsPlayerData.rooms([1, 3], FROM, TO, TZ)).toEqual([]);
        get.mockClear();
        expect(await churchToolsPlayerData.rooms([], FROM, TO, TZ)).toEqual([]);
        expect(get).not.toHaveBeenCalled();
    });

    it('cuts to the window: ChurchTools still counts `to` in, so the next day may come along', async () => {
        stubClient({
            1: () => [
                booking(1, 1, '2026-10-03T08:00:00Z', '2026-10-03T09:00:00Z'), // today
                booking(2, 1, '2026-10-03T22:00:00Z', '2026-10-03T23:00:00Z'), // tomorrow 00:00 Berlin: not in [from, to)
                booking(3, 1, '2026-10-02T20:00:00Z', '2026-10-02T21:00:00Z'), // yesterday
                booking(4, 1, '2026-10-02T21:00:00Z', '2026-10-03T00:30:00Z'), // overnight into today
                booking(5, 1, '2026-10-03T08:00:00Z', '2026-10-03T09:00:00Z', 1), // waiting: never
            ],
        });
        const [room] = await churchToolsPlayerData.rooms([1], FROM, TO, TZ);
        expect(room!.bookings.map((b) => b.id)).toEqual([1, 4]);
    });

    it('drops a booking of another room that came along', async () => {
        stubClient({ 1: () => [booking(1, 1, '2026-10-03T08:00:00Z', '2026-10-03T09:00:00Z'), booking(2, 3, '2026-10-03T08:00:00Z', '2026-10-03T09:00:00Z')] });
        const [room] = await churchToolsPlayerData.rooms([1], FROM, TO, TZ);
        expect(room!.bookings.map((b) => b.id)).toEqual([1]);
    });
});

const style = { fontFamily: 'sans', fontSize: 44, fontWeight: 400 as const, color: '#fff', align: 'left' as const };
const roomsBlock = (id: string, rooms: number[], days: 1 | 2 = 1): Block => ({
    id,
    type: 'rooms',
    x: 0,
    y: 0,
    width: 1400,
    height: 700,
    rooms: rooms.map((resourceId) => ({ resourceId, hint: '', showTitles: true })),
    layout: 'overview',
    days,
    style,
});

describe('roomNeeds', () => {
    it('names each room once, sorted, with the most days any block needs', () => {
        const slides = [
            makeSlide({ blocks: [roomsBlock('a', [3, 1]), roomsBlock('b', [1, 2], 2)] }),
            makeSlide({ blocks: [roomsBlock('c', [3])] }),
        ];
        expect(roomNeeds(slides)).toEqual({ resourceIds: [1, 2, 3], days: 2 });
    });

    it('ignores blocks without rooms – their days do not count either', () => {
        expect(roomNeeds([makeSlide({ blocks: [roomsBlock('a', [], 2)] })])).toEqual({ resourceIds: [], days: 1 });
        expect(roomNeeds([makeSlide({ blocks: [] })])).toEqual({ resourceIds: [], days: 1 });
    });
});

describe('the rooms of appointments (Plan.md 50)', () => {
    const appointment = (bookings?: unknown[]) => ({
        appointment: {
            base: { id: 4, title: 'Gottesdienst', allDay: false, calendar: { id: 2, name: 'Gottesdienst' } },
            calculated: { startDate: '2026-10-03T09:00:00Z', endDate: '2026-10-03T10:30:00Z' },
        },
        ...(bookings ? { bookings } : {}),
    });
    const booked = (resourceId: number) => ({ base: { id: resourceId, title: 'Geheim', resourceId, statusId: 2 } });

    function stub(masterdataAnswer: () => unknown): void {
        get.mockImplementation(async (path: string) => {
            if (path === '/calendars') return [{ id: 2, name: 'Gottesdienst', isPublic: true }];
            if (path === '/resource/masterdata') return masterdataAnswer();
            if (path === '/calendars/appointments') return [appointment([booked(3), booked(1)])];
            throw new Error(`unexpected ${path}`);
        });
    }

    it('asks for the bookings and the stammdaten only when rooms are wanted', async () => {
        stub(() => masterdata);
        const withRooms = await churchToolsPlayerData.appointments([2], FROM, TO, TZ, { rooms: true });
        expect(withRooms[0]!.rooms).toEqual(['Saal', 'Raum 01']);
        expect(get).toHaveBeenCalledWith('/calendars/appointments', expect.objectContaining({ include: ['bookings'] }));

        get.mockClear();
        const without = await churchToolsPlayerData.appointments([2], FROM, TO, TZ);
        expect(without[0]!.rooms).toBeUndefined();
        expect(get).toHaveBeenCalledTimes(2); // the calendars, then the appointments
        expect(get.mock.calls[1]![1]).not.toHaveProperty('include');
    });

    it('shows the appointments without rooms when the stammdaten fail', async () => {
        stub(() => {
            throw serverError();
        });
        const list = await churchToolsPlayerData.appointments([2], FROM, TO, TZ, { rooms: true });
        expect(list).toHaveLength(1);
        expect(list[0]!.rooms).toBeUndefined();
    });
});
