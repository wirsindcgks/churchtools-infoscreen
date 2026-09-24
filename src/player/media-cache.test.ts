import { describe, expect, it, vi } from 'vitest';
import { makeSlide } from '../model/testing';
import type { Block, MediaDoc } from '../model/schema';
import { screenImageUrls } from './images';
import { createMediaCache, type MediaCacheDeps } from './media-cache';

/** Just enough of Cache Storage: keyed by absolute URL, like the real one. */
class FakeCache {
    readonly entries = new Map<string, Response>();
    async match(url: string) {
        return this.entries.get(url)?.clone();
    }
    async put(url: string, response: Response) {
        this.entries.set(url, response);
    }
    async keys() {
        return [...this.entries.keys()].map((url) => ({ url }));
    }
    async delete(request: { url: string }) {
        return this.entries.delete(request.url);
    }
}

const A = 'https://ct.example/images/1/aaa?w=1920&h=1080&fit=crop';
const B = 'https://ct.example/images/2/bbb?w=800&h=600&fit=max';

function setup(store: FakeCache | null = new FakeCache()) {
    let counter = 0;
    const deps = {
        open: async () => store as unknown as Cache | null,
        fetch: vi.fn(async (url: string) => new Response(`bytes of ${url}`, { status: 200 })),
        toObjectUrl: vi.fn(() => `blob:local/${++counter}`),
        revoke: vi.fn(),
    } satisfies MediaCacheDeps;
    return { deps, store, cache: createMediaCache(deps) };
}

describe('media cache', () => {
    it('downloads each image once and serves it locally from then on', async () => {
        const { deps, store, cache } = setup();
        const first = await cache.sync([A, B]);
        expect(first.get(A)).toMatch(/^blob:/);
        expect(deps.fetch).toHaveBeenCalledTimes(2);

        // A restart: new page, same device storage – nothing goes over the network.
        const again = setup(store);
        const second = await again.cache.sync([A, B]);
        expect(again.deps.fetch).not.toHaveBeenCalled();
        expect([...second.keys()]).toEqual([A, B]);
    });

    it('keeps an image on its original address when the download fails', async () => {
        const { deps, cache } = setup();
        deps.fetch.mockImplementation(async (url: string) => {
            if (url === A) throw new TypeError('offline');
            return new Response('ok');
        });
        const local = await cache.sync([A, B]);
        expect(local.has(A)).toBe(false);
        expect(local.has(B)).toBe(true);
    });

    it('does not store error responses', async () => {
        const { deps, store, cache } = setup();
        deps.fetch.mockResolvedValue(new Response('gone', { status: 404 }));
        expect((await cache.sync([A])).size).toBe(0);
        expect(store?.entries.size).toBe(0);
    });

    it('forgets images no slide shows any more', async () => {
        const { deps, store, cache } = setup();
        const before = await cache.sync([A, B]);
        await cache.sync([B]);
        expect(deps.revoke).toHaveBeenCalledWith(before.get(A));
        expect([...(store?.entries.keys() ?? [])]).toEqual([B]);
    });

    it('works without Cache Storage, just without the speed-up', async () => {
        const { deps, cache } = setup(null);
        expect((await cache.sync([A])).size).toBe(0);
        expect(deps.fetch).not.toHaveBeenCalled();
    });

    it('runs overlapping calls one after another', async () => {
        const { store, cache } = setup();
        const [, last] = await Promise.all([cache.sync([A]), cache.sync([B])]);
        expect([...last.keys()]).toEqual([B]);
        expect([...(store?.entries.keys() ?? [])]).toEqual([B]);
    });
});

describe('screenImageUrls', () => {
    const media: MediaDoc[] = [
        { schema: makeSlide().schema, kind: 'media', id: 'm1', name: 'Foyer', fileId: 1, imageUrl: 'https://ct.example/images/1/aaa' },
    ];
    const image = (id: string, mediaId: string): Block => ({
        id,
        type: 'image',
        x: 0,
        y: 0,
        width: 800,
        height: 600,
        mediaId,
        fit: 'cover',
    });

    it('collects backgrounds and image blocks in the sizes the stage requests, each once', () => {
        const slides = [
            makeSlide({ id: 's1', background: { kind: 'media', mediaId: 'm1' }, blocks: [image('b1', 'm1')] }),
            makeSlide({ id: 's2', background: { kind: 'media', mediaId: 'm1' } }),
        ];
        const urls = screenImageUrls(slides, media, { width: 1920, height: 1080 });
        expect(urls).toEqual([
            'https://ct.example/images/1/aaa?w=1920&h=1080&fit=crop',
            'https://ct.example/images/1/aaa?w=800&h=600&fit=max',
        ]);
    });

    it('skips images whose media is gone or not chosen yet', () => {
        const slides = [makeSlide({ blocks: [image('b1', 'missing'), image('b2', '')] })];
        expect(screenImageUrls(slides, media, { width: 1920, height: 1080 })).toEqual([]);
    });
});
