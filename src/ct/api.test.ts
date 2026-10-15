import { churchtoolsClient } from '@churchtools/churchtools-client';
import { describe, expect, it, vi } from 'vitest';
import { fetchAppointments, fetchAppointmentTags, fetchGroupHomepage, fetchGroupHomepageList, fetchPublicCalendars } from './api';

vi.mock('@churchtools/churchtools-client', () => ({ churchtoolsClient: { get: vi.fn(async () => []) } }));

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
