/**
 * Keeps the videos of a screen in Cache Storage, next to the images (`media-cache.ts`) but under its own name:
 * the service worker (`../sw/sw.ts`) answers the `<video>`'s requests, byte ranges included, from there – a video
 * then plays without a network, also after a restart (Plan.md, 102; G63). The player fills the cache, the worker
 * only reads: a download of up to 128 MB over a weak WLAN may outlast what a browser lets a worker live for.
 *
 * The address carries the file name with its content hash, so an entry never goes stale; what no slide shows any
 * more is removed. Every failure leaves things as they are – the video then plays from the network.
 */
export interface VideoCacheDeps {
    /** `null` where Cache Storage is missing, e.g. outside a secure context. */
    open: () => Promise<Cache | null>;
    fetch: (url: string) => Promise<Response>;
    /** Quota and usage of the origin's storage; `null` where the browser cannot tell. */
    estimate: () => Promise<{ quota: number; usage: number } | null>;
}

/** Same name as `VIDEO_CACHE_NAME` in `../sw/logic.ts`: the worker bundle shares no module with the app, so it is written twice. */
const VIDEO_CACHE_NAME = 'infoscreen-video-v1';

/** What stays free besides the video: the images, the offline copy, and the browser's own needs. */
const RESERVE_BYTES = 256 * 1024 * 1024;

const browserDeps: VideoCacheDeps = {
    async open() {
        if (typeof caches === 'undefined') return null;
        return caches.open(VIDEO_CACHE_NAME);
    },
    // No `Range`: the whole file is stored, the worker slices it later.
    fetch: (url) => fetch(url, { credentials: 'same-origin' }),
    async estimate() {
        const { quota, usage } = (await navigator.storage?.estimate?.()) ?? {};
        return quota === undefined || usage === undefined ? null : { quota, usage };
    },
};

export interface VideoCache {
    /** Makes every listed video local and drops all others; calls run one after another and never reject. */
    sync(urls: string[]): Promise<void>;
}

export function createVideoCache(deps: VideoCacheDeps = browserDeps): VideoCache {
    let store: Promise<Cache | null> | undefined;
    let queue: Promise<unknown> = Promise.resolve();

    function cache(): Promise<Cache | null> {
        store ??= deps.open().catch(() => null);
        return store;
    }

    async function fits(size: number): Promise<boolean> {
        const storage = await deps.estimate().catch(() => null);
        return !storage || size + RESERVE_BYTES <= storage.quota - storage.usage;
    }

    async function download(cache: Cache, url: string): Promise<void> {
        if (await cache.match(url)) return;
        const response = await deps.fetch(url);
        const length = Number(response.headers.get('content-length'));
        const complete =
            response.status === 200 &&
            response.type !== 'opaque' &&
            (response.headers.get('content-type') ?? '').startsWith('video/') &&
            Number.isInteger(length) &&
            length > 0;
        if (!complete) {
            await response.body?.cancel().catch(() => undefined);
            return;
        }
        if (!(await fits(length))) {
            await response.body?.cancel().catch(() => undefined);
            console.warn(`Video ${url} passt nicht in den Speicher des Geräts und kommt weiter aus dem Netz.`);
            return;
        }
        // An interrupted download rejects here, so a partial file is never stored under the address.
        await cache.put(url, response);
        const stored = await cache.match(url);
        if (!stored || (await stored.blob()).size !== length) await cache.delete(url);
    }

    async function run(urls: string[]): Promise<void> {
        const store = await cache();
        if (!store) return;
        const wanted = new Set(urls.map((url) => new URL(url, location.href).href));
        for (const url of urls) {
            // Offline or refused: this video stays on the network.
            await download(store, url).catch(() => undefined);
        }
        try {
            for (const request of await store.keys()) {
                if (!wanted.has(request.url)) await store.delete(request);
            }
        } catch {
            // Cleaning up is worth trying, not worth failing over.
        }
    }

    return {
        sync(urls) {
            const next = queue.then(() => run(urls)).catch(() => undefined);
            queue = next;
            return next;
        },
    };
}
