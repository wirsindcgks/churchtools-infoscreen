import { describe, expect, it, vi } from 'vitest';
import { makeSlide } from '../model/testing';
import type { Block, MediaDoc } from '../model/schema';
import { screenVideoUrls, videoSrc } from './video';
import { createVideoCache, type VideoCacheDeps } from './video-cache';

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
    async delete(request: string | { url: string }) {
        return this.entries.delete(typeof request === 'string' ? request : request.url);
    }
}

const A = 'https://ct.example/?q=public/filedownload&id=1&filename=aaa';
const B = 'https://ct.example/?q=public/filedownload&id=2&filename=bbb';

function video(body = 'video-bytes', init: { status?: number; type?: string | null; length?: number } = {}): Response {
    const headers: Record<string, string> = { 'Content-Length': String(init.length ?? body.length) };
    if (init.type !== null) headers['Content-Type'] = init.type ?? 'video/mp4';
    return new Response(body, { status: init.status ?? 200, headers });
}

function setup(store: FakeCache | null = new FakeCache()) {
    const deps = {
        open: async () => store as unknown as Cache | null,
        fetch: vi.fn(async () => video()),
        estimate: vi.fn(async () => ({ quota: 10 * 1024 ** 3, usage: 0 })),
    } satisfies VideoCacheDeps;
    return { deps, store, cache: createVideoCache(deps) };
}

describe('video cache', () => {
    it('stores each video once and leaves a stored one alone', async () => {
        const { deps, store, cache } = setup();
        await cache.sync([A, B]);
        expect([...store!.entries.keys()]).toEqual([A, B]);
        expect(deps.fetch).toHaveBeenCalledTimes(2);

        await cache.sync([A, B]);
        expect(deps.fetch).toHaveBeenCalledTimes(2);
    });

    it('stores nothing for a refusal, an opaque answer or an unknown type', async () => {
        const { deps, store, cache } = setup();
        deps.fetch.mockResolvedValueOnce(video('denied', { status: 403 }));
        deps.fetch.mockResolvedValueOnce(video('html', { type: 'text/html' }));
        await cache.sync([A, B]);
        expect(store!.entries.size).toBe(0);

        const opaque = video();
        Object.defineProperty(opaque, 'type', { value: 'opaque' });
        deps.fetch.mockResolvedValueOnce(opaque);
        await cache.sync([A]);
        expect(store!.entries.size).toBe(0);
    });

    it('stores nothing when the content is shorter than announced or the length is missing', async () => {
        const { deps, store, cache } = setup();
        deps.fetch.mockResolvedValueOnce(video('short', { length: 5000 }));
        await cache.sync([A]);
        expect(store!.entries.size).toBe(0);

        deps.fetch.mockResolvedValueOnce(new Response('x', { status: 200, headers: { 'Content-Type': 'video/mp4' } }));
        await cache.sync([B]);
        expect(store!.entries.size).toBe(0);
    });

    it('stores nothing when the download breaks off', async () => {
        const { deps, store, cache } = setup();
        store!.put = async () => {
            throw new TypeError('network error');
        };
        await expect(cache.sync([A, B])).resolves.toBeUndefined();
        expect(deps.fetch).toHaveBeenCalledTimes(2);
        expect(store!.entries.size).toBe(0);
    });

    it('keeps a video that does not fit on the network and warns', async () => {
        const { deps, store, cache } = setup();
        deps.estimate.mockResolvedValue({ quota: 300 * 1024 ** 2, usage: 100 * 1024 ** 2 });
        deps.fetch.mockResolvedValueOnce(video('big', { length: 100 * 1024 ** 2 }));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        await cache.sync([A]);
        expect(store!.entries.size).toBe(0);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('downloads one video at a time', async () => {
        const { deps, cache } = setup();
        let running = 0;
        let most = 0;
        deps.fetch.mockImplementation(async () => {
            most = Math.max(most, ++running);
            await new Promise((resolve) => setTimeout(resolve, 5));
            running--;
            return video();
        });
        await Promise.all([cache.sync([A, B]), cache.sync([A])]);
        expect(most).toBe(1);
    });

    it('forgets videos no slide shows any more', async () => {
        const { store, cache } = setup();
        await cache.sync([A, B]);
        await cache.sync([B]);
        expect([...store!.entries.keys()]).toEqual([B]);
    });

    it('survives a failing download and a missing Cache Storage', async () => {
        const { deps, store, cache } = setup();
        deps.fetch.mockRejectedValueOnce(new TypeError('offline'));
        await cache.sync([A, B]);
        expect([...store!.entries.keys()]).toEqual([B]);

        await expect(setup(null).cache.sync([A])).resolves.toBeUndefined();
    });
});

describe('screenVideoUrls', () => {
    const base: MediaDoc = { schema: makeSlide().schema, kind: 'media', id: 'm1', name: 'Foyer', fileId: 1, imageUrl: 'https://ct.example/images/1/aaa' };
    const clip: MediaDoc = { ...base, id: 'clip', imageUrl: '', mediaType: 'video', fileUrl: A };
    const block = (id: string, mediaId?: string): Block => ({ id, type: 'video', x: 0, y: 0, width: 800, height: 600, mediaId, fit: 'contain', sound: false });

    it('collects the videos of the video blocks, each once', () => {
        const slides = [makeSlide({ blocks: [block('b1', 'clip')] }), makeSlide({ blocks: [block('b2', 'clip')] })];
        // In development the address goes through the proxy; in the build it is `fileUrl` itself.
        expect(screenVideoUrls(slides, [base, clip])).toEqual([videoSrc(clip)]);
    });

    it('skips empty blocks, missing media and images', () => {
        const slides = [makeSlide({ blocks: [block('b1'), block('b2', 'gone'), block('b3', 'm1')] })];
        expect(screenVideoUrls(slides, [base, clip])).toEqual([]);
    });
});
