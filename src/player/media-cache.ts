/**
 * Keeps the images of a screen in Cache Storage. After the first run a device
 * reads them from its own disk – whatever hardware it is – and still has them
 * during a network outage. Needs no service worker (G10): cached responses
 * become blob URLs, which the ChurchTools CSP allows (G15).
 *
 * Image addresses carry a content hash (G14), so an entry never goes stale;
 * what no slide shows any more is removed. Every failure leaves the original
 * address in use – the cache may make the player faster, never break it.
 */
export interface MediaCacheDeps {
    /** `null` where Cache Storage is missing, e.g. outside a secure context. */
    open: () => Promise<Cache | null>;
    fetch: (url: string) => Promise<Response>;
    toObjectUrl: (blob: Blob) => string;
    revoke: (objectUrl: string) => void;
}

const CACHE_NAME = 'infoscreen-media-v1';
/** Weak devices and a shared uplink: a few downloads at a time. */
const PARALLEL = 3;

/** In development the image service is reached through the dev proxy: the instance sends no CORS headers (G14). */
function fetchableUrl(url: string): string {
    if (import.meta.env.DEV) {
        const parsed = new URL(url);
        if (parsed.pathname.startsWith('/images/')) return parsed.pathname + parsed.search;
    }
    return url;
}

const browserDeps: MediaCacheDeps = {
    async open() {
        if (typeof caches === 'undefined') return null;
        // Asks the browser not to evict the cache under storage pressure; a refusal changes nothing else.
        void navigator.storage?.persist?.().catch(() => false);
        return caches.open(CACHE_NAME);
    },
    fetch: (url) => fetch(fetchableUrl(url), { credentials: 'omit' }),
    toObjectUrl: (blob) => URL.createObjectURL(blob),
    revoke: (objectUrl) => URL.revokeObjectURL(objectUrl),
};

export interface MediaCache {
    /**
     * Makes every listed image local and drops all others. Resolves to the
     * addresses that are local now (original → blob URL); calls run one after another.
     */
    sync(urls: string[]): Promise<Map<string, string>>;
}

export function createMediaCache(deps: MediaCacheDeps = browserDeps): MediaCache {
    const local = new Map<string, string>();
    let store: Promise<Cache | null> | undefined;
    let queue: Promise<unknown> = Promise.resolve();

    function cache(): Promise<Cache | null> {
        store ??= deps.open().catch(() => null);
        return store;
    }

    async function makeLocal(cache: Cache, url: string): Promise<void> {
        if (local.has(url)) return;
        let response = await cache.match(url);
        if (!response) {
            const fresh = await deps.fetch(url);
            if (!fresh.ok || fresh.type === 'opaque') return;
            await cache.put(url, fresh.clone());
            response = fresh;
        }
        local.set(url, deps.toObjectUrl(await response.blob()));
    }

    async function run(urls: string[]): Promise<Map<string, string>> {
        const store = await cache();
        if (!store) return new Map();
        const pending = [...urls];
        const worker = async (): Promise<void> => {
            for (let url = pending.shift(); url !== undefined; url = pending.shift()) {
                // Offline or refused: this image stays on its original address.
                await makeLocal(store, url).catch(() => undefined);
            }
        };
        await Promise.all(Array.from({ length: PARALLEL }, worker));

        const wanted = new Set(urls);
        for (const [url, objectUrl] of local) {
            if (wanted.has(url)) continue;
            deps.revoke(objectUrl);
            local.delete(url);
        }
        try {
            for (const request of await store.keys()) {
                if (!wanted.has(request.url)) await store.delete(request);
            }
        } catch {
            // Cleaning up is worth trying, not worth failing over.
        }
        return new Map(local);
    }

    return {
        sync(urls) {
            const next = queue.then(() => run(urls));
            queue = next.catch(() => undefined);
            return next;
        },
    };
}
