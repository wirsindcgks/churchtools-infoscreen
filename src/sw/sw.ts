/**
 * The service worker itself (Plan.md, 37; G10): keeps the player's page and its files around so that a
 * device restarting **during** a network outage shows the last good state instead of the browser's error
 * page (ChurchTools answers the document with `Cache-Control: no-store`, so the browser's own cache never
 * holds it). Registered only by the player (`../player/service-worker.ts`), never by the designer.
 *
 * Kept free of the DOM lib's `ServiceWorkerGlobalScope` gap: TypeScript's `lib.dom.d.ts` has no
 * `Clients`/`Client`/`ExtendableEvent` (those live in `lib.webworker.d.ts`, which cannot be mixed with
 * `dom` in one project – the app needs `dom`). The handful of missing shapes are declared locally below
 * instead, so this file type-checks under the very same `tsconfig.json` as the rest of the app.
 *
 * Bundled to `dist/sw.js` as one classic script (`vite.config.ts`) – no `import`/`export` may survive in
 * it, so it never imports anything from the app; only `./logic`, its sibling, which stays free of any
 * global (`self`, `caches`, `fetch`) so its decisions are unit-testable without a worker.
 */
import { cacheName, CACHE_PREFIX, classify, isPlayerNavigation, pageCacheKey, shouldCachePlayerPage } from './logic';

interface SwExtendableEvent extends Event {
    waitUntil(promise: Promise<unknown>): void;
}

interface SwFetchEvent extends SwExtendableEvent {
    readonly request: Request;
    /** Id of the client (page) that issued the request; empty for a navigation itself. */
    readonly clientId: string;
    respondWith(response: Response | PromiseLike<Response>): void;
}

interface SwMessageEvent extends SwExtendableEvent {
    readonly data: unknown;
    readonly ports: readonly MessagePort[];
}

interface SwClient {
    readonly id: string;
    readonly url: string;
}

interface SwClients {
    matchAll(options?: { type?: 'window' | 'worker' | 'sharedworker' | 'all' }): Promise<SwClient[]>;
    get(id: string): Promise<SwClient | undefined>;
    claim(): Promise<void>;
}

interface SwGlobalScope {
    skipWaiting(): Promise<void>;
    readonly clients: SwClients;
    addEventListener(type: 'install' | 'activate', listener: (event: SwExtendableEvent) => void): void;
    addEventListener(type: 'fetch', listener: (event: SwFetchEvent) => void): void;
    addEventListener(type: 'message', listener: (event: SwMessageEvent) => void): void;
}

// `self` is typed as `Window` in the DOM lib; the double assertion is the one place that bridges to the
// service worker shape declared above.
const scope = self as unknown as SwGlobalScope;

/** `import.meta.env.BASE_URL` is a build-time constant (`vite.config.ts`), same as in the app. */
const BASE = import.meta.env.BASE_URL;
/** Same constant the "Über"-page shows (`vite.config.ts`); a new build always gets a new cache. */
const CURRENT_CACHE = cacheName(__APP_VERSION__);
const NAVIGATION_TIMEOUT_MS = 10_000;
const CACHEABLE_SUBRESOURCE_DESTINATIONS = new Set(['script', 'style', 'font']);

/** Rejects after `ms` milliseconds; a copy of `src/player/timing.ts`'s helper – this file imports nothing from the app. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Keine Antwort nach ${ms} ms.`)), ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error: unknown) => {
                clearTimeout(timer);
                reject(error as Error);
            },
        );
    });
}

/**
 * Stores a network response as the player page, iff it really is one (`shouldCachePlayerPage`) – never
 * ChurchTools's login page, which answers the very same address with `200` when there is no session.
 * Used both for a navigation's own fetch and for the refresh of an already open tab on `activate`.
 */
async function cachePlayerPageIfMatching(cache: Cache, url: string, response: Response): Promise<void> {
    const contentType = response.headers.get('content-type');
    if (response.status !== 200 || !contentType?.includes('text/html')) return;
    const html = await response.clone().text();
    if (!shouldCachePlayerPage({ status: response.status, contentType, html }, BASE)) return;
    await cache.put(pageCacheKey(url), response.clone());
}

/** Deletes the caches of every other version – a new one never reuses or reads an old one. */
async function deleteOldCaches(): Promise<void> {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CURRENT_CACHE).map((key) => caches.delete(key)));
}

/**
 * Right after activating: a tab already showing the player would otherwise wait for the next navigation
 * (at the earliest the nightly reload) before this version's cache holds anything. A plain `fetch` here –
 * not the intercepted `event.request` of a navigation – follows the login redirect (G9) itself and lands
 * on the real page.
 */
async function refreshOpenPlayerPages(cache: Cache): Promise<void> {
    const clients = await scope.clients.matchAll({ type: 'window' });
    await Promise.all(
        clients
            .filter((client) => isPlayerNavigation(client.url, BASE))
            .map(async (client) => {
                try {
                    const response = await fetch(client.url, { credentials: 'same-origin', cache: 'no-store' });
                    await cachePlayerPageIfMatching(cache, client.url, response);
                } catch {
                    // Offline right after an update: the old cache stays until the next success.
                }
            }),
    );
}

scope.addEventListener('install', (event) => {
    event.waitUntil(scope.skipWaiting());
});

scope.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            await deleteOldCaches();
            await scope.clients.claim();
            await refreshOpenPlayerPages(await caches.open(CURRENT_CACHE));
        })(),
    );
});

/** Network first, with a time limit; the cached page only when the network fails or is too slow. */
async function handlePlayerNavigation(request: Request): Promise<Response> {
    const cache = await caches.open(CURRENT_CACHE);
    try {
        const response = await withTimeout(fetch(request), NAVIGATION_TIMEOUT_MS);
        // A redirect (still carrying the login token, or the opaque one a navigation's own fetch gets for
        // it) is passed through unchanged – the browser follows it itself and asks again without the token.
        if (!response.redirected && response.type !== 'opaqueredirect') {
            await cachePlayerPageIfMatching(cache, request.url, response);
        }
        return response;
    } catch {
        const cached = await cache.match(pageCacheKey(request.url));
        return cached ?? Response.error();
    }
}

/**
 * A script, style or font of the own bundle or of ChurchTools, asked for by a player page – the only case
 * `classify` needs the requesting client's address for, which is only available asynchronously
 * (`clients.get`). `respondWith` must already have been called by then (see below); a `'pass'` result –
 * the same file requested by the designer – resolves to a plain, uncached `fetch`, indistinguishable from
 * never having intercepted it at all.
 */
async function handleSubresource(event: SwFetchEvent): Promise<Response> {
    const client = event.clientId ? await scope.clients.get(event.clientId) : undefined;
    const classification = classify(
        {
            method: event.request.method,
            url: event.request.url,
            destination: event.request.destination,
            origin: location.origin,
            clientUrl: client?.url ?? null,
        },
        BASE,
    );
    if (classification === 'own-asset') {
        const cache = await caches.open(CURRENT_CACHE);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.status === 200) await cache.put(event.request, response.clone());
        return response;
    }
    if (classification === 'host-asset') {
        const cache = await caches.open(CURRENT_CACHE);
        try {
            const response = await fetch(event.request);
            if (response.status === 200) await cache.put(event.request, response.clone());
            return response;
        } catch (error) {
            const cached = await cache.match(event.request);
            if (cached) return cached;
            throw error;
        }
    }
    return fetch(event.request);
}

scope.addEventListener('fetch', (event) => {
    const request = event.request;
    // Everything below mirrors `classify`'s synchronously decidable guards (method, origin, the API/logo/
    // image service, which destinations even qualify) – only the one case that truly needs the requesting
    // client's address (see `handleSubresource`) is ever intercepted without already knowing the answer.
    if (request.method !== 'GET') return;
    let url: URL;
    try {
        url = new URL(request.url);
    } catch {
        return;
    }
    if (url.origin !== location.origin) return;
    if (url.pathname.startsWith('/api/') || url.pathname === '/logo' || url.pathname.startsWith('/images/')) return;

    if (request.destination === 'document') {
        if (isPlayerNavigation(url.toString(), BASE)) event.respondWith(handlePlayerNavigation(request));
        return; // the designer, or any other page of the module: untouched
    }
    if (!CACHEABLE_SUBRESOURCE_DESTINATIONS.has(request.destination)) return;
    event.respondWith(handleSubresource(event));
});

/** Answers `{ type: 'has-page', url }` with whether that address is cached – used by `canReload()` (`../player/controller.ts`). */
scope.addEventListener('message', (event) => {
    const data = event.data as { type?: string; url?: string } | null;
    const port = event.ports[0];
    if (!port || data?.type !== 'has-page' || typeof data.url !== 'string') return;
    const url = data.url;
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CURRENT_CACHE);
            port.postMessage(Boolean(await cache.match(pageCacheKey(url))));
        })(),
    );
});
