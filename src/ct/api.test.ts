import { churchtoolsClient } from '@churchtools/churchtools-client';
import { describe, expect, it, vi } from 'vitest';
import { fetchAppointments, fetchAppointmentTags, fetchGroupHomepage, fetchGroupHomepageList, fetchGroupMembers, fetchLivePosition, fetchPersonFields, fetchPublicCalendars, fetchSecurityLevels, LiveAgendaDeniedError } from './api';

vi.mock('@churchtools/churchtools-client', () => ({ churchtoolsClient: { get: vi.fn(async () => []), getAllPages: vi.fn(async () => []), oldApi: vi.fn(async () => ({})) } }));

const BASE = 'https://example.church.tools';

function answer(data: unknown, status = 200): Response {
    return new Response(JSON.stringify({ data }), { status, headers: { 'content-type': 'application/json' } });
}

describe('group homepages are read anonymously (Plan.md 43)', () => {
    it('leaves the session out – what any visitor sees – and asks for German, whatever the browser speaks', async () => {
        const fetcher = vi.fn<typeof fetch>(async () =>
            answer([{ title: 'Hauskreise', apiUrl: `${BASE}/api/grouphomepages/abc123`, domainAttributes: { parentGroupId: 10 } }]),
        );
        expect(await fetchGroupHomepageList(BASE, fetcher)).toEqual([{ parentGroupId: 10, title: 'Hauskreise', hash: 'abc123' }]);
        expect(fetcher).toHaveBeenCalledWith(`${BASE}/api/grouphomepages`, expect.objectContaining({ credentials: 'omit', cache: 'no-store' }));
        expect(fetcher.mock.calls[0]![1]!.headers).toMatchObject({ 'Accept-Language': 'de' });
    });

    it('fetches one homepage by its hash, and refuses a hash that is not letters and digits', async () => {
        const fetcher = vi.fn<typeof fetch>(async () => answer({ groups: [] }));
        expect(await fetchGroupHomepage(BASE, 'abc123', fetcher)).toEqual({ groups: [] });
        expect(fetcher).toHaveBeenCalledWith(`${BASE}/api/grouphomepages/abc123`, expect.objectContaining({ credentials: 'omit' }));
        await expect(fetchGroupHomepage(BASE, '../persons', fetcher)).rejects.toThrow('Ungültige Kennung');
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('fails with the status, so that a 429 is recognised', async () => {
        const fetcher = vi.fn<typeof fetch>(async () => answer(null, 429));
        await expect(fetchGroupHomepageList(BASE, fetcher)).rejects.toMatchObject({ response: { status: 429 } });
    });
});

describe('fetchPublicCalendars (Plan.md 73, G53)', () => {
    it('asks without the session and marks the request as anonymous', async () => {
        const fetcher = vi.fn<typeof fetch>(async () => answer([{ id: 2, name: 'Gottesdienst' }]));
        expect(await fetchPublicCalendars(BASE, fetcher)).toEqual([{ id: 2, name: 'Gottesdienst' }]);
        expect(fetcher).toHaveBeenCalledWith(`${BASE}/api/calendars`, expect.objectContaining({ credentials: 'omit' }));
        expect(fetcher.mock.calls[0]![1]!.headers).toMatchObject({ 'X-Infoscreen-Anonymous': '1' });
    });
});

describe('fetchAppointments asks for rooms and tags (Plan.md 82 C, G59)', () => {
    const from = new Date('2026-10-04T00:00:00Z');
    const to = new Date('2026-10-18T00:00:00Z');
    const includeOf = async (options: { bookings?: boolean; tags?: boolean }) => {
        vi.mocked(churchtoolsClient.get).mockClear();
        await fetchAppointments([2], from, to, 'Europe/Berlin', options);
        return (vi.mocked(churchtoolsClient.get).mock.calls[0]![1] as { include?: string[] }).include;
    };

    it('includes only what was asked for, both in one list', async () => {
        expect(await includeOf({})).toBeUndefined();
        expect(await includeOf({ bookings: true })).toEqual(['bookings']);
        expect(await includeOf({ tags: true })).toEqual(['tags']);
        expect(await includeOf({ bookings: true, tags: true })).toEqual(['bookings', 'tags']);
    });

    it('reads all appointment tags from /tags/appointment', async () => {
        vi.mocked(churchtoolsClient.get).mockClear();
        await fetchAppointmentTags();
        expect(vi.mocked(churchtoolsClient.get).mock.calls[0]![0]).toBe('/tags/appointment');
    });
});

describe('fetchPersonFields (Plan.md 112, Stück 3, G71)', () => {
    it('reads the name, the security level and the active flag as `GET /fields` sends them – "isActive" as text', async () => {
        vi.mocked(churchtoolsClient.get).mockResolvedValueOnce([
            { key: 'email', nameTranslated: 'E-Mail', secLevel: 1, isActive: '1', fieldTypeCode: 'text', fieldCategoryCode: 'f_address', hideInFrontend: false },
            { key: 'street', nameTranslated: 'Straße', secLevel: 2, isActive: '1', hideInFrontend: true },
            { key: 'mobile', name: 'mobile', secLevel: 1, isActive: '0' },
        ]);
        expect(await fetchPersonFields()).toEqual([
            { key: 'email', name: 'E-Mail', secLevel: 1, isActive: true, type: 'text', category: 'f_address', hidden: false },
            { key: 'street', name: 'Straße', secLevel: 2, isActive: true, type: '', category: '', hidden: true },
            { key: 'mobile', name: 'mobile', secLevel: 1, isActive: false, type: '', category: '', hidden: false },
        ]);
        expect(churchtoolsClient.get).toHaveBeenCalledWith('/fields');
    });
});

describe('fetchSecurityLevels (G73)', () => {
    it('reads id and name, ascending by id – the id is the sorting', async () => {
        vi.mocked(churchtoolsClient.get).mockResolvedValueOnce([
            { id: 20325, name: 'Leitung', sortKey: 3 },
            { id: 500, name: 'Offen', sortKey: 1 },
            { id: 10325 },
            { name: 'ohne ID' },
        ]);
        expect(await fetchSecurityLevels()).toEqual([
            { id: 500, name: 'Offen' },
            { id: 10325, name: '10325' },
            { id: 20325, name: 'Leitung' },
        ]);
        expect(churchtoolsClient.get).toHaveBeenCalledWith('/securitylevels');
    });
});

describe('fetchGroupMembers (G75)', () => {
    it('reads the field definitions and goes on without them when they cannot be read', async () => {
        vi.mocked(churchtoolsClient.getAllPages).mockResolvedValue([{ personId: 1 }]);
        vi.mocked(churchtoolsClient.get).mockImplementation((url: string) => (url.endsWith('/memberfields') ? Promise.reject(new Error('403')) : Promise.resolve([{ groupTypeRoleId: 5 }])));
        expect(await fetchGroupMembers(40)).toEqual({ members: [{ personId: 1 }], roles: [{ groupTypeRoleId: 5 }], fieldDefs: [] });
    });
});

describe('fetchLivePosition (Plan.md 118, G81)', () => {
    const oldApi = vi.mocked(churchtoolsClient.oldApi);

    it('asks the old interface for the position of the event', async () => {
        oldApi.mockResolvedValueOnce({ pos_id: '3' });
        expect(await fetchLivePosition(1)).toEqual({ pos_id: '3' });
        expect(oldApi).toHaveBeenLastCalledWith('churchservice/ajax', 'loadAgendaLivePosition', { event_id: 1 });
    });

    it('drops the stored token after a 401 and asks once more', async () => {
        const client = churchtoolsClient as unknown as { csrfToken?: string };
        client.csrfToken = 'stale';
        oldApi.mockRejectedValueOnce({ response: { status: 401 } }).mockResolvedValueOnce({ pos_id: '2' });
        expect(await fetchLivePosition(1)).toEqual({ pos_id: '2' });
        expect(client.csrfToken).toBeUndefined();
    });

    it('does not try a third time after a second 401', async () => {
        oldApi.mockClear();
        oldApi.mockRejectedValue({ response: { status: 401 } });
        await expect(fetchLivePosition(1)).rejects.toMatchObject({ response: { status: 401 } });
        expect(oldApi).toHaveBeenCalledTimes(2);
        oldApi.mockReset();
    });

    it('names a missing right: a 403, or a 200 with status "fail"', async () => {
        oldApi.mockRejectedValueOnce({ response: { status: 403 } });
        await expect(fetchLivePosition(1)).rejects.toBeInstanceOf(LiveAgendaDeniedError);
        oldApi.mockRejectedValueOnce({ response: { status: 200, data: { status: 'fail', message: 'Die Berechtigung fehlt.' } } });
        await expect(fetchLivePosition(1)).rejects.toThrow('Die Berechtigung fehlt.');
    });
});
