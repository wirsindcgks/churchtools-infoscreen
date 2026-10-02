import { describe, expect, it, vi } from 'vitest';
import { makeScreen, makeSlide } from '../model/testing';
import type { Block } from '../model/schema';
import type { Post } from '../posts/normalize';
import * as api from '../ct/api';
import { appointmentNeeds, churchToolsPlayerData, groupNeeds, mergePosts, postNeeds, readableAppointments } from './data';

vi.mock('../ct/api', () => ({
    fetchAppointments: vi.fn(),
    fetchEvents: vi.fn(),
    fetchServices: vi.fn(),
    fetchServiceGroups: vi.fn(),
    fetchResourceMasterdata: vi.fn(),
    fetchBookings: vi.fn(),
    fetchChurchLogoUrl: vi.fn(),
    fetchGroupHomepage: vi.fn(),
    fetchGroupHomepageList: vi.fn(),
    fetchPosts: vi.fn(),
    fetchTimeZone: vi.fn(),
}));

const forbidden = () => Object.assign(new Error('403'), { response: { status: 403 } });

const style = { fontFamily: 'sans', fontSize: 56, fontWeight: 400 as const, color: '#fff', align: 'left' as const };
const postsBlock = (overrides: Partial<Extract<Block, { type: 'posts' }>> = {}): Block => ({
    id: 'p',
    type: 'posts',
    x: 0,
    y: 0,
    width: 1400,
    height: 700,
    groupIds: [31],
    limit: 3,
    maxAgeDays: 30,
    layout: 'card',
    showImage: true,
    showAuthor: false,
    style,
    ...overrides,
});

const groups = (overrides: Partial<Extract<Block, { type: 'groups' }>> = {}): Block => ({
    id: 'gruppen',
    type: 'groups',
    x: 0,
    y: 0,
    width: 1400,
    height: 700,
    parentGroupId: 10,
    groupIds: [],
    layout: 'card',
    perPage: 1,
    show: { name: true, image: true, when: true, targetGroup: true, category: true, note: true, leaders: false, leaderImages: false, places: true, qr: true },
    style,
    ...overrides,
});

describe('postNeeds', () => {
    it('ignores posts blocks without a group', () => {
        expect(postNeeds([makeSlide({ blocks: [postsBlock({ groupIds: [] })] })])).toEqual([]);
    });

    it('groups blocks that share the same, sorted set of groups into one entry with the largest limit', () => {
        const slide = makeSlide({
            blocks: [
                postsBlock({ id: 'a', groupIds: [31, 25], limit: 3 }),
                postsBlock({ id: 'b', groupIds: [25, 31], limit: 5 }), // same set, different order
                postsBlock({ id: 'c', groupIds: [28], limit: 2 }),
            ],
        });
        expect(postNeeds([slide])).toEqual([
            { groupIds: [25, 31], limit: 5 },
            { groupIds: [28], limit: 2 },
        ]);
    });
});

describe('mergePosts', () => {
    const post = (id: number): Post => ({
        id,
        groupId: 31,
        groupName: 'ISD-Beitragstest',
        color: null,
        groupInitials: 'I',
        groupImageUrl: null,
        title: `Beitrag ${id}`,
        content: '',
        publishedAt: new Date('2026-09-25T08:00:00Z'),
        expiresAt: null,
        author: null,
        imageUrl: null,
        imageRatio: null,
    });

    it('dedupes posts fetched under different needs by id', () => {
        expect(mergePosts([[post(1), post(2)], [post(2), post(3)]]).map((p) => p.id).sort()).toEqual([1, 2, 3]);
    });
});

describe('readableAppointments', () => {
    it('asks once when every calendar is readable', async () => {
        const fetch = vi.fn(async (ids: number[]) => ids.map((id) => ({ id })));
        expect(await readableAppointments([1, 5], fetch)).toEqual([{ id: 1 }, { id: 5 }]);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('leaves out only the forbidden calendar when ChurchTools refuses the whole request (G35)', async () => {
        const fetch = vi.fn(async (ids: number[]) => {
            if (ids.includes(5)) throw forbidden();
            return ids.map((id) => ({ id }));
        });
        expect(await readableAppointments([1, 5, 4], fetch)).toEqual([{ id: 1 }, { id: 4 }]);
    });

    it('passes other errors through, e.g. a network failure', async () => {
        const fetch = vi.fn(async () => {
            throw new Error('Network Error');
        });
        await expect(readableAppointments([1, 5], fetch)).rejects.toThrow('Network Error');
    });

    it('does not ask calendars individually on a 429, and passes it through unchanged (G16)', async () => {
        const rateLimited = Object.assign(new Error('429'), { response: { status: 429, headers: {} } });
        const fetch = vi.fn(async () => {
            throw rateLimited;
        });
        await expect(readableAppointments([1, 5], fetch)).rejects.toBe(rateLimited);
        expect(fetch).toHaveBeenCalledTimes(1); // no per-calendar retry: a 429 is not "one calendar is forbidden"
    });
});

describe('groupNeeds (Plan.md 43)', () => {
    it('names each parent group once, sorted; blocks without a homepage do not count', () => {
        const slides = [
            makeSlide({ blocks: [groups({ id: 'a', parentGroupId: 10 }), groups({ id: 'b', parentGroupId: 8 })] }),
            makeSlide({ blocks: [groups({ id: 'c', parentGroupId: 10 }), groups({ id: 'd', parentGroupId: undefined })] }),
        ];
        expect(groupNeeds(slides)).toEqual([8, 10]);
        expect(groupNeeds([makeSlide({ blocks: [] })])).toEqual([]);
    });
});

describe('appointmentNeeds – rooms (Plan.md 50)', () => {
    const base = { x: 0, y: 0, width: 1400, height: 700, calendarIds: [2], style };
    const next = (overrides: Partial<Extract<Block, { type: 'next-appointment' }>> = {}): Block => ({ id: 'n', type: 'next-appointment', ...base, showImage: true, ...overrides });
    const list = (overrides: Partial<Extract<Block, { type: 'appointment-list' }>> = {}): Block => ({
        id: 'l',
        type: 'appointment-list',
        ...base,
        horizonDays: 14,
        limit: 5,
        ...overrides,
    });
    const rooms = (...blocks: Block[]) => appointmentNeeds(makeScreen(), [makeSlide({ blocks })], []).rooms;

    it('wants rooms for a next appointment that shows them, in both layouts', () => {
        expect(rooms(next())).toBe(false);
        expect(rooms(next({ showRooms: true }))).toBe(true);
        expect(rooms(next({ showRooms: true, layout: 'classic' }))).toBe(true);
        expect(rooms(next({ showRooms: true, layout: 'card' }))).toBe(true);
    });

    it('wants rooms for a list only as cards – or following the theme, which is not known here', () => {
        expect(rooms(list({ showRooms: true, layout: 'rows' }))).toBe(false);
        expect(rooms(list({ showRooms: true, layout: 'cards' }))).toBe(true);
        expect(rooms(list({ showRooms: true }))).toBe(true);
        expect(rooms(list({ layout: 'cards' }))).toBe(false);
    });

    it('never wants rooms for a countdown', () => {
        const countdown: Block = { id: 'c', type: 'countdown', ...base, showTitle: true, runningText: 'Läuft', showRooms: true } as Block;
        expect(rooms(countdown)).toBe(false);
    });
});

describe('appointmentNeeds – services (Plan.md 51)', () => {
    const base = { x: 0, y: 0, width: 1400, height: 700, calendarIds: [2], style };
    const next = (overrides: Partial<Extract<Block, { type: 'next-appointment' }>> = {}): Block => ({ id: 'n', type: 'next-appointment', ...base, showImage: true, ...overrides });
    const list = (overrides: Partial<Extract<Block, { type: 'appointment-list' }>> = {}): Block => ({
        id: 'l',
        type: 'appointment-list',
        ...base,
        horizonDays: 14,
        limit: 5,
        ...overrides,
    });
    const ALL = [3, 4, 5, 7];
    const services = (...blocks: Block[]) => appointmentNeeds(makeScreen(), [makeSlide({ blocks })], ALL).services;

    it('lists the services of all blocks, sorted and each once', () => {
        expect(services(next(), list())).toEqual([]);
        expect(services(next({ services: [7, 3] }), list({ id: 'l2', layout: 'cards', services: [3, 5] }))).toEqual([3, 5, 7]);
    });

    it('asks only for the services an administrator allowed – none without an allowance', () => {
        const blocks = [next({ services: [7, 3] }), list({ id: 'l2', layout: 'cards', services: [3, 5] })];
        const needs = (allowed: number[] | undefined) => appointmentNeeds(makeScreen(), [makeSlide({ blocks })], allowed).services;
        expect(needs([3, 7])).toEqual([3, 7]);
        expect(needs([5])).toEqual([5]);
        expect(needs([])).toEqual([]);
        expect(needs(undefined)).toEqual([]);
    });

    it('counts a list only where it shows cards – and the next appointment in both layouts', () => {
        expect(services(list({ layout: 'rows', services: [3] }))).toEqual([]);
        expect(services(list({ services: [3] }))).toEqual([3]);
        expect(services(next({ layout: 'classic', services: [4] }))).toEqual([4]);
        expect(services(next({ layout: 'card', services: [4] }))).toEqual([4]);
    });

    it('never counts a countdown', () => {
        const countdown = { id: 'c', type: 'countdown', ...base, showTitle: true, runningText: 'Läuft', services: [3] } as Block;
        expect(services(countdown)).toEqual([]);
    });
});

describe('churchToolsPlayerData.appointments – services (Plan.md 51)', () => {
    const appointment = {
        appointment: {
            base: { id: 9, title: 'Gottesdienst', allDay: false, calendar: { id: 2, name: 'Gottesdienst', color: 'black' } },
            calculated: { startDate: '2026-10-04T08:00:00Z', endDate: '2026-10-04T09:30:00Z' },
        },
    };
    const event = {
        appointmentId: 9,
        startDate: '2026-10-04T08:00:00Z',
        eventServices: [{ serviceId: 1, person: null, name: 'Anna Beispiel', isAccepted: true }],
    };
    const from = new Date('2026-10-01T00:00:00Z');
    const to = new Date('2026-10-30T00:00:00Z');

    it('keeps the appointments when the events cannot be loaded', async () => {
        vi.mocked(api.fetchAppointments).mockResolvedValue([appointment]);
        vi.mocked(api.fetchEvents).mockRejectedValue(forbidden());
        vi.mocked(api.fetchServices).mockResolvedValue([{ id: 1, name: 'Predigt', serviceGroupId: 1 }]);
        vi.mocked(api.fetchServiceGroups).mockResolvedValue([{ id: 1, viewAll: true }]);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const list = await churchToolsPlayerData.appointments([2], from, to, 'Europe/Berlin', { services: [1] });
        expect(list).toHaveLength(1);
        expect(list[0]).not.toHaveProperty('services');
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('adds the services when everything loads – and asks for none when none is chosen', async () => {
        vi.mocked(api.fetchAppointments).mockResolvedValue([appointment]);
        vi.mocked(api.fetchEvents).mockResolvedValue([event]);
        vi.mocked(api.fetchServices).mockResolvedValue([{ id: 1, name: 'Predigt', serviceGroupId: 1 }]);
        vi.mocked(api.fetchServiceGroups).mockResolvedValue([{ id: 1, viewAll: true }]);
        const [a] = await churchToolsPlayerData.appointments([2], from, to, 'Europe/Berlin', { services: [1] });
        expect(a?.services).toEqual([{ serviceId: 1, name: 'Predigt', people: ['Anna Beispiel'] }]);
        vi.mocked(api.fetchEvents).mockClear();
        await churchToolsPlayerData.appointments([2], from, to, 'Europe/Berlin', { services: [] });
        expect(api.fetchEvents).not.toHaveBeenCalled();
    });
});
