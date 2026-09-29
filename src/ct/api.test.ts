import { describe, expect, it, vi } from 'vitest';
import { fetchGroupHomepage, fetchGroupHomepageList } from './api';

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
