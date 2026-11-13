import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeScreen, makeSlide } from '../model/testing';
import type { Block } from '../model/schema';
import type { Post } from '../posts/normalize';
import * as api from '../ct/api';
import * as client from '../ct/client';
import { sheetOf } from '../agenda/songsheet';
import { agendaNeeds, appointmentNeeds, churchToolsPlayerData, loadArrangementSheet, groupNeeds, mergePosts, peopleAny, peopleNeeds, postNeeds, readableAppointments, readPeopleGroups, sheetsNeeded } from './data';

vi.mock('../ct/api', () => ({
    fetchAgenda: vi.fn(),
    fetchAgendaSongs: vi.fn(),
    fetchSheetText: vi.fn(),
    fetchSong: vi.fn(),
    fetchEventList: vi.fn(),
    fetchLivePosition: vi.fn(),
    LiveAgendaDeniedError: class LiveAgendaDeniedError extends Error {},
    fetchPublicCalendars: vi.fn(),
    fetchAppointments: vi.fn(),
    fetchEvents: vi.fn(),
    fetchServices: vi.fn(),
    fetchServiceGroups: vi.fn(),
    fetchResourceMasterdata: vi.fn(),
    fetchBookings: vi.fn(),
    fetchChurchLogoUrl: vi.fn(),
    fetchGroupHomepage: vi.fn(),
    fetchGroupHomepageList: vi.fn(),
    fetchGroupMembers: vi.fn(),
    fetchPersons: vi.fn(),
    fetchPersonFields: vi.fn(async () => []),
    fetchPosts: vi.fn(),
    fetchTimeZone: vi.fn(),
}));

vi.mock('../ct/client', async (importOriginal) => ({ ...(await importOriginal<typeof import('../ct/client')>()), currentPerson: vi.fn() }));

const calendar = (id: number) => ({ id, name: `Kalender ${id}` });

beforeEach(() => {
    vi.mocked(api.fetchPublicCalendars).mockResolvedValue([calendar(2), calendar(3)]);
});

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
    showGroup: true,
    showTitle: true,
    showText: true,
    showDate: true,
    imageFit: 'cover',
    imageFocus: 'center',
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
    sort: 'weekday',
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

    it('wants rooms for a list in every layout, rows included (schema 1.34)', () => {
        expect(rooms(list({ showRooms: true, layout: 'rows' }))).toBe(true);
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

describe('churchToolsPlayerData.appointments – only public calendars (Plan.md 73)', () => {
    const from = new Date('2026-10-01T00:00:00Z');
    const to = new Date('2026-10-30T00:00:00Z');

    it('asks only for public calendars', async () => {
        vi.mocked(api.fetchPublicCalendars).mockResolvedValue([
            calendar(2),
        ]);
        vi.mocked(api.fetchAppointments).mockClear();
        vi.mocked(api.fetchAppointments).mockResolvedValue([]);
        await churchToolsPlayerData.appointments([2, 3, 4, 5, 9], from, to, 'Europe/Berlin');
        expect(api.fetchAppointments).toHaveBeenCalledTimes(1);
        expect(vi.mocked(api.fetchAppointments).mock.calls[0]![0]).toEqual([2]);
    });

    it('makes no appointment request without a public calendar', async () => {
        vi.mocked(api.fetchPublicCalendars).mockResolvedValue([calendar(2)]);
        vi.mocked(api.fetchAppointments).mockClear();
        expect(await churchToolsPlayerData.appointments([3], from, to, 'Europe/Berlin')).toEqual([]);
        expect(api.fetchAppointments).not.toHaveBeenCalled();
    });

    it('adds the calendars an administrator released – and still only those (Plan.md 85 b)', async () => {
        vi.mocked(api.fetchPublicCalendars).mockResolvedValue([calendar(2)]);
        vi.mocked(api.fetchAppointments).mockClear();
        vi.mocked(api.fetchAppointments).mockResolvedValue([]);
        await churchToolsPlayerData.appointments([2, 3, 4], from, to, 'Europe/Berlin', { releasedCalendarIds: [3] });
        expect(vi.mocked(api.fetchAppointments).mock.calls[0]![0]).toEqual([2, 3]);
    });

    it('keeps an internal appointment of a released calendar off the screen (Plan.md 85 b)', async () => {
        const raw = (id: number, isInternal: boolean) => ({
            appointment: {
                base: { id, title: `T${id}`, allDay: false, isInternal, calendar: { id: 3, name: 'Leitung', color: 'black' } },
                calculated: { startDate: '2026-10-04T08:00:00Z', endDate: '2026-10-04T09:30:00Z' },
            },
        });
        vi.mocked(api.fetchPublicCalendars).mockResolvedValue([calendar(2)]);
        vi.mocked(api.fetchAppointments).mockResolvedValue([raw(1, true), raw(2, false)]);
        const list = await churchToolsPlayerData.appointments([3], from, to, 'Europe/Berlin', { releasedCalendarIds: [3] });
        expect(list.map((a) => a.title)).toEqual(['T2']);
    });

    it('fails when the calendars cannot be read', async () => {
        vi.mocked(api.fetchPublicCalendars).mockRejectedValue(new Error('offline'));
        await expect(churchToolsPlayerData.appointments([2], from, to, 'Europe/Berlin')).rejects.toThrow('offline');
    });
});

describe('appointmentNeeds – tags (Plan.md 82 C)', () => {
    const base = { x: 0, y: 0, width: 1400, height: 700, calendarIds: [2], style };
    const next = (overrides: Partial<Extract<Block, { type: 'next-appointment' }>> = {}): Block => ({ id: 'n', type: 'next-appointment', ...base, showImage: true, ...overrides });
    const countdown = (hideTagIds?: number[]): Block => ({ id: 'c', type: 'countdown', ...base, showTitle: true, runningText: 'Läuft', hideTagIds }) as Block;
    const tags = (...blocks: Block[]) => appointmentNeeds(makeScreen(), [makeSlide({ blocks })], []).tags;

    it('wants tags as soon as one block hides some', () => {
        expect(tags(next())).toBe(false);
        expect(tags(next({ hideTagIds: [] }))).toBe(false);
        expect(tags(next({ hideTagIds: [3] }))).toBe(true);
        expect(tags(next(), countdown())).toBe(false);
        expect(tags(next(), countdown([3]))).toBe(true);
    });
});

describe('people (Plan.md 112)', () => {
    const peopleBlock: Block = {
        id: 'p',
        type: 'people',
        x: 0,
        y: 0,
        width: 1400,
        height: 700,
        roleIds: [],
        fieldKeys: [],
        sort: 'last-name',
        showImage: true,
        layout: 'card',
        columns: 3,
        rows: 2,
        style,
    };

    it('is needed when a slide has the block, and only then – the standard group and the ones named, each once', () => {
        expect(peopleNeeds([makeSlide({ blocks: [peopleBlock] })])).toEqual({ standard: true, groupIds: [], personFieldKeys: [] });
        expect(peopleAny(peopleNeeds([makeSlide({ blocks: [postsBlock()] }), makeSlide({ blocks: [] })]))).toBe(false);
        const named = [{ ...peopleBlock, id: 'q', sourceGroupId: 51 }, { ...peopleBlock, id: 'r', sourceGroupId: 51 }, { ...peopleBlock, id: 's', sourceGroupId: 7 }];
        expect(peopleNeeds([makeSlide({ blocks: named })])).toEqual({ standard: false, groupIds: [7, 51], personFieldKeys: [] });
    });

    it('reads only the standard group and the released ones; any other group comes back unreleased without a request', async () => {
        const read = vi.fn(async (groupId: number) => ({ groupId, denied: false, people: [], roles: [], fields: [] }));
        const groups = await readPeopleGroups({ standard: true, groupIds: [51, 99], personFieldKeys: [] }, { peopleGroupId: 40, peopleGroupIds: [51] }, read);
        expect(read.mock.calls.map((c) => c[0]).sort()).toEqual([40, 51]);
        expect(groups.find((g) => g.groupId === 40)).toMatchObject({ standard: true, denied: false });
        expect(groups.find((g) => g.groupId === 51)).toMatchObject({ denied: false });
        expect(groups.find((g) => g.groupId === 51)?.standard).toBeUndefined();
        expect(groups.find((g) => g.groupId === 99)).toMatchObject({ unreleased: true, denied: true, people: [] });
        // Without a standard group set up a block without a group finds none; one that names the standard group still reads it.
        expect(await readPeopleGroups({ standard: true, groupIds: [], personFieldKeys: [] }, {}, read)).toEqual([]);
        const named = await readPeopleGroups({ standard: false, groupIds: [40], personFieldKeys: [] }, { peopleGroupId: 40 }, read);
        expect(named).toMatchObject([{ groupId: 40, standard: true }]);
    });

    const member = (personId: number, first: string) => ({ personId, groupTypeRoleId: 5, groupMemberStatus: 'active', person: { domainAttributes: { firstName: first, lastName: 'X' } } });

    it('reads the members through the group alone and leaves out the account that asks', async () => {
        vi.mocked(client.currentPerson).mockResolvedValue({ id: 22 } as Awaited<ReturnType<typeof client.currentPerson>>);
        vi.mocked(api.fetchGroupMembers).mockResolvedValue({ members: [member(22, 'Foyer'), member(1, 'Anna')], roles: [], fieldDefs: [] });
        const group = await churchToolsPlayerData.people(40);
        expect(api.fetchGroupMembers).toHaveBeenCalledWith(40);
        expect(api.fetchPersons).not.toHaveBeenCalled();
        expect(group.denied).toBe(false);
        expect(group.people.map((p) => p.name)).toEqual(['Anna X']);
    });

    it('hands the field definitions on: an option shows by its name', async () => {
        const withField = { ...member(1, 'Anna'), fields: [{ id: 3, name: 'Farbe', value: '16', sortKey: 1 }] };
        const fieldDefs = [{ type: 'group', field: { id: 3, name: 'Farbe', fieldTypeCode: 'select', options: [{ id: '16', name: 'Blau' }] } }];
        vi.mocked(client.currentPerson).mockResolvedValue({ id: 22 } as Awaited<ReturnType<typeof client.currentPerson>>);
        vi.mocked(api.fetchGroupMembers).mockResolvedValue({ members: [withField], roles: [], fieldDefs });
        const group = await churchToolsPlayerData.people(40);
        expect(group.people[0]!.fields).toEqual({ '3': 'Blau' });
    });

    it('leaves out the device accounts the setup names as well', async () => {
        vi.mocked(client.currentPerson).mockResolvedValue({ id: 22 } as Awaited<ReturnType<typeof client.currentPerson>>);
        vi.mocked(api.fetchGroupMembers).mockResolvedValue({ members: [member(22, 'Foyer'), member(23, 'Cafe'), member(1, 'Anna')], roles: [], fieldDefs: [] });
        expect((await churchToolsPlayerData.people(40, [23])).people.map((p) => p.name)).toEqual(['Anna X']);
    });

    it('keeps the account that asks in the designer preview – there it is a person, not a device', async () => {
        vi.mocked(client.currentPerson).mockResolvedValue({ id: 1 } as Awaited<ReturnType<typeof client.currentPerson>>);
        vi.mocked(api.fetchGroupMembers).mockResolvedValue({ members: [member(22, 'Foyer'), member(1, 'Anna')], roles: [], fieldDefs: [] });
        expect((await churchToolsPlayerData.people(40, [22], false)).people.map((p) => p.name)).toEqual(['Anna X']);
    });

    it('answers a 403 with a group marked as denied – not as an empty one', async () => {
        vi.mocked(api.fetchGroupMembers).mockRejectedValue(forbidden());
        expect(await churchToolsPlayerData.people(40)).toEqual({ groupId: 40, denied: true, people: [], roles: [], fields: [] });
    });

    it('needs the person fields the blocks chose, in the order they first appear and each once (schema 1.54, 1.59)', () => {
        const blocks = [{ ...peopleBlock, personFieldKeys: ['city', 'email' as const] }, { ...peopleBlock, id: 'q', personFieldKeys: ['email' as const] }] as Block[];
        expect(peopleNeeds([makeSlide({ blocks })]).personFieldKeys).toEqual(['city', 'email']);
        const named = [{ ...peopleBlock, nameFormat: '{nickname} ({firstName}) {job}' }] as Block[];
        expect(peopleNeeds([makeSlide({ blocks: named })]).personFieldKeys).toEqual(['nickname', 'job']);
        const free = [{ ...peopleBlock, personFieldKeys: ['nickname'] }] as Block[];
        expect(peopleNeeds([makeSlide({ blocks: free })]).personFieldKeys).toEqual(['nickname']);
    });

    it('reads a chosen person field only if it is released – the rest of a group is read as before', async () => {
        const read = vi.fn(async (groupId: number) => ({ groupId, denied: false, people: [], roles: [], fields: [] }));
        const needs = { standard: true, groupIds: [], personFieldKeys: ['email', 'city', 'zip'] };
        await readPeopleGroups(needs, { peopleGroupId: 40, personFieldKeys: ['city', 'birthday'] }, read);
        expect(read).toHaveBeenCalledWith(40, ['city']);
        read.mockClear();
        await readPeopleGroups(needs, { peopleGroupId: 40 }, read);
        expect(read).toHaveBeenCalledWith(40, []);
    });

    it('asks /persons once for the people of the cards and keeps only the released and chosen keys – the year of a birthday never stays', async () => {
        vi.mocked(client.currentPerson).mockResolvedValue({ id: 22 } as Awaited<ReturnType<typeof client.currentPerson>>);
        vi.mocked(api.fetchGroupMembers).mockResolvedValue({ members: [member(22, 'Foyer'), member(1, 'Anna'), member(2, 'Ben')], roles: [], fieldDefs: [] });
        vi.mocked(api.fetchPersons).mockResolvedValue([
            { id: 1, email: 'anna@example.org', mobile: '0170 1', birthday: '1980-05-17', street: 'Weg 1', guid: 'x' },
            { id: 2, email: '', birthday: null },
        ]);
        const group = await churchToolsPlayerData.people(40, [], true, ['email', 'birthday']);
        expect(api.fetchPersons).toHaveBeenCalledTimes(1);
        expect(api.fetchPersons).toHaveBeenCalledWith([1, 2]);
        expect(group.personFieldKeys).toEqual(['email', 'birthday']);
        expect(group.people[0]!.personFields).toEqual({ email: 'anna@example.org', birthday: '17.05.' });
        expect(group.people[1]!.personFields).toEqual({});
        expect(JSON.stringify(group)).not.toMatch(/1980|Weg 1|0170|guid/);
    });

    it('reads a free field like the nickname with the types of /fields (Plan.md 115) – and goes on without the definitions', async () => {
        vi.mocked(client.currentPerson).mockResolvedValue({ id: 22 } as Awaited<ReturnType<typeof client.currentPerson>>);
        vi.mocked(api.fetchGroupMembers).mockResolvedValue({ members: [member(1, 'Anna')], roles: [], fieldDefs: [] });
        vi.mocked(api.fetchPersons).mockResolvedValue([{ id: 1, nickname: 'Anni', entry: '2010-03-05' }]);
        vi.mocked(api.fetchPersonFields).mockResolvedValue([{ key: 'entry', name: 'Eintritt', type: 'date', category: 'f_church', hidden: false, isActive: true, secLevel: 1 }]);
        expect((await churchToolsPlayerData.people(40, [], true, ['nickname', 'entry'])).people[0]!.personFields).toEqual({ nickname: 'Anni', entry: '05.03.2010' });
        vi.mocked(api.fetchPersonFields).mockRejectedValue(new Error('offline'));
        expect((await churchToolsPlayerData.people(40, [], true, ['nickname', 'entry'])).people[0]!.personFields).toEqual({ nickname: 'Anni', entry: '2010-03-05' });
    });

    it('does not read /persons without a chosen released field, and shows empty fields without the right (403)', async () => {
        vi.mocked(api.fetchPersons).mockClear();
        vi.mocked(api.fetchGroupMembers).mockResolvedValue({ members: [member(1, 'Anna')], roles: [], fieldDefs: [] });
        expect((await churchToolsPlayerData.people(40, [], false, [])).personFieldKeys).toBeUndefined();
        expect(api.fetchPersons).not.toHaveBeenCalled();
        vi.mocked(api.fetchPersons).mockRejectedValue(forbidden());
        const group = await churchToolsPlayerData.people(40, [], false, ['email']);
        expect(group.denied).toBe(false);
        expect(group.people[0]!.personFields).toEqual({});
    });

    it('lets other errors fail, so the controller keeps the last people', async () => {
        vi.mocked(api.fetchGroupMembers).mockRejectedValue(new Error('Netz'));
        await expect(churchToolsPlayerData.people(40)).rejects.toThrow('Netz');
    });
});

describe('the live agenda (schema 1.61, Plan.md 118)', () => {
    const agendaBlock = (calendarIds: number[]): Block => ({ id: 'a', type: 'agenda', x: 0, y: 0, width: 1400, height: 700, calendarIds, showCountdown: true, showDelay: true, showNext: true, showNote: false, showResponsible: false, showSong: true, showSignal: true, showClock: false, style });

    it('reads the calendars of the agenda blocks, each once and sorted – and nothing without such a block', () => {
        expect(agendaNeeds([makeSlide({ blocks: [agendaBlock([3, 2]), agendaBlock([2])] })])).toEqual([2, 3]);
        expect(agendaNeeds([makeSlide({ blocks: [postsBlock()] })])).toEqual([]);
    });

    it('lists the events of the chosen calendars with their agenda in the order of the live view; one without an agenda or right drops out', async () => {
        vi.mocked(api.fetchEventList).mockResolvedValue([
            { id: 1, startDate: '2026-11-10T10:00:00Z', endDate: '2026-11-10T11:00:00Z', calendar: { domainIdentifier: '2' } },
            { id: 2, startDate: '2026-11-10T12:00:00Z', endDate: '2026-11-10T13:00:00Z', calendar: { domainIdentifier: '2' } },
            { id: 3, startDate: '2026-11-10T14:00:00Z', endDate: '2026-11-10T15:00:00Z', calendar: { domainIdentifier: '2' } },
            { id: 4, startDate: '2026-11-10T14:00:00Z', endDate: '2026-11-10T15:00:00Z', calendar: { domainIdentifier: '9' } },
            { id: 5, startDate: '2026-11-10T16:00:00Z', endDate: '2026-11-10T17:00:00Z', isCanceled: true, calendar: { domainIdentifier: '2' } },
        ]);
        vi.mocked(api.fetchAgenda).mockImplementation(async (id) => {
            if (id === 2) throw Object.assign(new Error('404'), { response: { status: 404 } });
            if (id === 3) throw forbidden();
            return { items: [{ type: 'header', title: 'Eingang' }, { title: 'Begrüßung', duration: 300 }] };
        });
        const events = await churchToolsPlayerData.agendaEvents([2], new Date('2026-11-10T00:00:00Z'), new Date('2026-11-11T00:00:00Z'), 'UTC');
        expect(events).toEqual([
            { eventId: 1, calendarId: 2, startMs: Date.parse('2026-11-10T10:00:00Z'), endMs: Date.parse('2026-11-10T11:00:00Z'), items: [expect.objectContaining({ title: '' }), expect.objectContaining({ title: 'Begrüßung', duration: 300 })] },
        ]);
        expect(api.fetchAgenda).not.toHaveBeenCalledWith(4);
        expect(api.fetchAgenda).not.toHaveBeenCalledWith(5);
    });

    describe('the text of the songs for the block "Liedblatt" (Plan.md 121 B)', () => {
        const day = [new Date('2026-11-10T00:00:00Z'), new Date('2026-11-11T00:00:00Z')] as const;
        const songBlock = (): Block => ({ id: 's', type: 'songsheet', x: 0, y: 0, width: 1400, height: 700, calendarIds: [2], showChords: true, pageByTime: false, style });
        const withSong = (arrangementId: number) => {
            vi.mocked(api.fetchEventList).mockResolvedValue([{ id: 1, startDate: '2026-11-10T10:00:00Z', endDate: '2026-11-10T11:00:00Z', calendar: { domainIdentifier: '2' } }]);
            vi.mocked(api.fetchAgenda).mockResolvedValue({ items: [{ type: 'song', duration: 200, song: { title: 'Lied', arrangementId, key: 'C' } }] });
        };
        const file = (name: string, url: string) => ({ name, fileUrl: `https://gemeinde.example/?q=public/filedownload&id=1&filename=${url}` });
        const songs = (arrangementId: number, files: { name: string; fileUrl: string }[]) => [{ id: 9, arrangements: [{ id: arrangementId, files }] }];
        const ofFirstPoint = async () => (await churchToolsPlayerData.agendaEvents([2], ...day, 'UTC', { sheets: true }))[0]!.items[1]!;

        it('asks for the blocks on the slides', () => {
            expect(sheetsNeeded([makeSlide({ blocks: [songBlock()] })])).toBe(true);
            expect(sheetsNeeded([makeSlide({ blocks: [agendaBlock([2])] })])).toBe(false);
            expect(agendaNeeds([makeSlide({ blocks: [songBlock()] })])).toEqual([2]);
        });

        it('leaves a songsheet with the source "Probe" out of what the agenda needs (Plan.md 121, "Proben")', () => {
            const rehearsal = { ...songBlock(), source: 'rehearsal' } as Block;
            expect(sheetsNeeded([makeSlide({ blocks: [rehearsal] })])).toBe(false);
            expect(agendaNeeds([makeSlide({ blocks: [rehearsal] })])).toEqual([]);
            expect(agendaNeeds([makeSlide({ blocks: [rehearsal, songBlock()] })])).toEqual([2]);
        });

        describe('the song of the rehearsal', () => {
            const doc = (arrangementId: number) => ({ kind: 'rehearsal' as const, songId: 5, arrangementId, section: 0, at: '2026-11-10T10:00:00Z' });
            const arrangement = (id: number, extra: object = {}) => ({ id, name: 'Akustisch', key: 'A', isDefault: false, description: 'C, V1', files: [file('a.cho', `cho${id}`)], ...extra });
            const chordPro = '{key: G}\n{comment: Verse 1}\n[G]Eins\n\n{comment: Chorus}\n[C]Zwei';

            it('is the raw file, and the block draws the same parts as the phone page', async () => {
                const mine = arrangement(31);
                vi.mocked(api.fetchSong).mockResolvedValue({ id: 5, name: 'Lied', arrangements: [mine] });
                vi.mocked(api.fetchSheetText).mockResolvedValue(chordPro);
                const item = (await churchToolsPlayerData.rehearsalItem(doc(31)))!;
                expect(item).toMatchObject({ title: 'Lied', song: true, duration: 0, arrangementId: 31, songDetails: { key: 'A', arrangement: 'Akustisch' } });
                // Raw: the key of the file, not the one of the arrangement – `sheetOf` transposes and applies the flow.
                expect(item.sheet?.key).toBe('G');
                const onScreen = sheetOf(item)!;
                const onPhone = (await loadArrangementSheet(mine))!;
                expect(onScreen.sections.map((x) => x.label)).toEqual(onPhone.sections.map((x) => x.label));
                expect(onScreen.sections.map((x) => x.label)).toEqual(['Refrain', 'Strophe 1']);
                expect(onScreen.key).toBe('A');
            });

            it('has no sheet without a file, names no default arrangement, and is null where the song is not readable', async () => {
                vi.mocked(api.fetchSong).mockResolvedValue({ id: 5, name: 'Lied', arrangements: [arrangement(32, { files: [], isDefault: true })] });
                const item = (await churchToolsPlayerData.rehearsalItem(doc(32)))!;
                expect(item.sheet).toBeUndefined();
                expect(item.songDetails).toEqual({ key: 'A' });
                vi.mocked(api.fetchSong).mockRejectedValueOnce(forbidden());
                expect(await churchToolsPlayerData.rehearsalItem(doc(33))).toBeNull();
                vi.mocked(api.fetchSong).mockRejectedValueOnce(Object.assign(new Error('404'), { response: { status: 404 } }));
                expect(await churchToolsPlayerData.rehearsalItem(doc(33))).toBeNull();
                vi.mocked(api.fetchSong).mockRejectedValueOnce(new Error('Netz'));
                await expect(churchToolsPlayerData.rehearsalItem(doc(33))).rejects.toThrow('Netz');
            });

            it('remembers a complete point per song and arrangement', async () => {
                vi.mocked(api.fetchSong).mockClear();
                vi.mocked(api.fetchSong).mockResolvedValue({ id: 5, name: 'Lied', arrangements: [arrangement(34)] });
                vi.mocked(api.fetchSheetText).mockResolvedValue(chordPro);
                await churchToolsPlayerData.rehearsalItem(doc(34));
                await churchToolsPlayerData.rehearsalItem(doc(34));
                expect(api.fetchSong).toHaveBeenCalledTimes(1);
            });
        });

        it('reads the file by its kind – ChordPro before .sng before .txt – and hangs the sheet at the point of its arrangement', async () => {
            withSong(21);
            vi.mocked(api.fetchAgendaSongs).mockResolvedValue(songs(21, [file('a.txt', 'one'), file('a.sng', 'two'), file('a.pdf', 'pdf'), file('a.CHO', 'three')]));
            vi.mocked(api.fetchSheetText).mockResolvedValue('{key: D}\n{comment: Verse 1}\n[D]Erfunden');
            const item = await ofFirstPoint();
            expect(api.fetchSheetText).toHaveBeenCalledTimes(1);
            expect(vi.mocked(api.fetchSheetText).mock.calls[0]![0]).toContain('filename=three');
            expect(item.arrangementId).toBe(21);
            expect(item.sheet?.key).toBe('D');
            expect(item.sheet?.sections[0]).toMatchObject({ label: 'Strophe 1' });
        });

        it('falls back to the lyrics of .sng, then .txt, and remembers a file by its address', async () => {
            withSong(22);
            vi.mocked(api.fetchSheetText).mockClear();
            vi.mocked(api.fetchAgendaSongs).mockResolvedValue(songs(22, [file('a.txt', 'one'), file('a.sng', 'two')]));
            vi.mocked(api.fetchSheetText).mockResolvedValue('\uFEFF#Title=Lied\n---\nVerse 1\nErfundene Zeile\n');
            expect((await ofFirstPoint()).sheet?.sections[0]?.lines[0]?.text).toBe('Erfundene Zeile');
            expect(vi.mocked(api.fetchSheetText).mock.calls[0]![0]).toContain('filename=two');
            await ofFirstPoint();
            expect(api.fetchSheetText).toHaveBeenCalledTimes(1);
        });

        it('leaves the points without a sheet where the device may not read the songs: 403, an empty list, no file', async () => {
            withSong(23);
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
            vi.mocked(api.fetchSheetText).mockClear();
            vi.mocked(api.fetchAgendaSongs).mockRejectedValueOnce(forbidden());
            expect((await ofFirstPoint()).sheet).toBeUndefined();
            vi.mocked(api.fetchAgendaSongs).mockResolvedValueOnce([]);
            expect((await ofFirstPoint()).sheet).toBeUndefined();
            vi.mocked(api.fetchAgendaSongs).mockResolvedValueOnce(songs(23, [file('a.pdf', 'pdf')]));
            expect((await ofFirstPoint()).sheet).toBeUndefined();
            expect(api.fetchSheetText).not.toHaveBeenCalled();
            expect(warn).toHaveBeenCalledTimes(1);
            warn.mockRestore();
        });

        it('lets another failure of the list fail the load, but not one of a file', async () => {
            withSong(24);
            vi.mocked(api.fetchAgendaSongs).mockRejectedValueOnce(new Error('Netz'));
            await expect(ofFirstPoint()).rejects.toThrow('Netz');
            vi.mocked(api.fetchAgendaSongs).mockResolvedValue(songs(24, [file('a.txt', 'broken')]));
            vi.mocked(api.fetchSheetText).mockRejectedValueOnce(new Error('weg'));
            expect((await ofFirstPoint()).sheet).toBeUndefined();
        });

        it('reads nothing without the option', async () => {
            withSong(25);
            vi.mocked(api.fetchAgendaSongs).mockClear();
            const events = await churchToolsPlayerData.agendaEvents([2], ...day, 'UTC');
            expect(events[0]!.items[1]!.sheet).toBeUndefined();
            expect(api.fetchAgendaSongs).not.toHaveBeenCalled();
        });
    });

    it('names per calendar the first event with an agenda: not cancelled, by start, 404/403 skipped, at most six reads, other errors fail (Plan.md 123)', async () => {
        const at = (id: number, hour: number, calendar: number, extra: object = {}) => ({ id, name: `Termin ${id}`, startDate: `2026-11-15T${String(hour).padStart(2, '0')}:00:00Z`, endDate: `2026-11-15T${String(hour + 1).padStart(2, '0')}:00:00Z`, calendar: { domainIdentifier: String(calendar) }, ...extra });
        vi.mocked(api.fetchEventList).mockResolvedValue([at(3, 12, 2), at(1, 8, 2, { isCanceled: true }), at(2, 9, 2), at(4, 10, 5), at(5, 11, 5), at(6, 7, 9, { name: null })]);
        vi.mocked(api.fetchAgenda).mockClear();
        vi.mocked(api.fetchAgenda).mockImplementation(async (id) => {
            if (id === 2) throw Object.assign(new Error('404'), { response: { status: 404 } });
            if (id === 4) throw forbidden();
            return { items: [] };
        });
        const day = [new Date('2026-11-12T00:00:00Z'), new Date('2026-11-26T00:00:00Z')] as const;
        const found = await churchToolsPlayerData.upcomingAgendas([2, 5, 9], ...day, 'UTC');
        expect(found).toEqual([
            { calendarId: 9, startMs: Date.parse('2026-11-15T07:00:00Z'), title: '' },
            { calendarId: 5, startMs: Date.parse('2026-11-15T11:00:00Z'), title: 'Termin 5' },
            { calendarId: 2, startMs: Date.parse('2026-11-15T12:00:00Z'), title: 'Termin 3' },
        ]);
        expect(api.fetchAgenda).not.toHaveBeenCalledWith(1);

        // Never more than six reads, however many events there are.
        vi.mocked(api.fetchEventList).mockResolvedValue(Array.from({ length: 20 }, (_, i) => at(100 + i, 8, 2)));
        vi.mocked(api.fetchAgenda).mockClear();
        vi.mocked(api.fetchAgenda).mockRejectedValue(Object.assign(new Error('404'), { response: { status: 404 } }));
        expect(await churchToolsPlayerData.upcomingAgendas([2], ...day, 'UTC')).toEqual([]);
        expect(api.fetchAgenda).toHaveBeenCalledTimes(6);

        vi.mocked(api.fetchAgenda).mockRejectedValue(new Error('Netz'));
        await expect(churchToolsPlayerData.upcomingAgendas([2], ...day, 'UTC')).rejects.toThrow('Netz');
    });

    it('reads the position with the offset to the server clock; without the right it is null, other errors fail', async () => {
        vi.mocked(api.fetchLivePosition).mockResolvedValueOnce({ pos_id: '3', switchdate: '2026-11-10T10:00:00Z', addseconds: '0', currentTime: Date.now() - 2000 });
        const position = await churchToolsPlayerData.agendaPosition(1);
        expect(position).toMatchObject({ index: 3, set: true });
        expect(position!.offsetMs).toBeGreaterThanOrEqual(2000);
        vi.mocked(api.fetchLivePosition).mockRejectedValueOnce(new api.LiveAgendaDeniedError('nein'));
        expect(await churchToolsPlayerData.agendaPosition(1)).toBeNull();
        vi.mocked(api.fetchLivePosition).mockRejectedValueOnce(new Error('Netz'));
        await expect(churchToolsPlayerData.agendaPosition(1)).rejects.toThrow('Netz');
    });
});
