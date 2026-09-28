/**
 * Pure decisions of the service worker (Plan.md, 37; G10): what belongs to a
 * player page, what may be cached, and under which key. Nothing here touches
 * `self`, `caches` or `fetch` – that lives in `sw.ts`, so these decisions stay
 * testable without a worker.
 */

const TOKEN_PARAM = 'login_token';

/** The address a page is cached and looked up under: without the login token and without a fragment. */
export function pageCacheKey(url: string): string {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.searchParams.delete(TOKEN_PARAM);
    const sorted = [...parsed.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
    parsed.search = new URLSearchParams(sorted).toString();
    return parsed.toString();
}

/** Whether `url` navigates to the player, i.e. its path is exactly `${base}player`. */
export function isPlayerNavigation(url: string, base: string): boolean {
    return new URL(url).pathname === `${base}player`;
}

/** Whether `html` is the player page: it loads a script of the own bundle, unlike ChurchTools's login page. */
export function looksLikePlayerPage(html: string, base: string): boolean {
    const marker = `${base}assets/`;
    for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
        if (match[1]?.includes(marker)) return true;
    }
    return false;
}

export type Classification = 'player-page' | 'own-asset' | 'host-asset' | 'pass';

/** What the fetch handler sees of a request – kept minimal so tests need no real `Request`. */
export interface RequestLike {
    method: string;
    url: string;
    /** `Request.destination`: `'document'` for a navigation, else e.g. `'script'`, `'style'`, `'font'`, `'image'`. */
    destination: string;
    /** Origin of this worker (`self.location.origin`), to tell the own origin from every other one. */
    origin: string;
    /**
     * For a subresource, the address of the page that requested it – from the worker's
     * `event.clientId` via `clients.get()`. `null` for a navigation itself, where it is unused.
     */
    clientUrl: string | null;
}

const SUBRESOURCE_DESTINATIONS = new Set(['script', 'style', 'font']);

/**
 * Only `GET`, only the own origin. A navigation is either the player or `'pass'` (the designer, unchanged).
 * A subresource is only ours to cache when a player page asked for it – a script tag on the designer, or
 * anything that is not a script, style or font (the API, `/logo`, the image service, images themselves),
 * is `'pass'`: `event.respondWith` is never called for it, and the request goes to the network untouched.
 */
export function classify(request: RequestLike, base: string): Classification {
    if (request.method !== 'GET') return 'pass';
    let url: URL;
    try {
        url = new URL(request.url);
    } catch {
        return 'pass';
    }
    if (url.origin !== request.origin) return 'pass';
    if (url.pathname.startsWith('/api/') || url.pathname === '/logo' || url.pathname.startsWith('/images/')) {
        return 'pass';
    }

    if (request.destination === 'document') {
        return isPlayerNavigation(url.toString(), base) ? 'player-page' : 'pass';
    }
    if (!SUBRESOURCE_DESTINATIONS.has(request.destination)) return 'pass';
    if (!request.clientUrl || !isPlayerNavigation(request.clientUrl, base)) return 'pass';
    return url.pathname.startsWith(`${base}assets/`) ? 'own-asset' : 'host-asset';
}

/** What matters of a response before deciding whether to keep it – no real `Response` needed in a test. */
export interface CandidateResponse {
    status: number;
    contentType: string | null;
    /** The response body, only read when `status` and `contentType` already look right. */
    html: string;
}

/**
 * Whether a response to a player navigation may be cached under `pageCacheKey`: it must be the page
 * itself, never ChurchTools's login page, which answers the very same address with `200` as well.
 * Used both when a navigation's own fetch succeeds and when `activate` refreshes an already open tab.
 */
export function shouldCachePlayerPage(response: CandidateResponse, base: string): boolean {
    return response.status === 200 && (response.contentType ?? '').includes('text/html') && looksLikePlayerPage(response.html, base);
}

/** Name of the cache for one worker version – old versions are told apart by their prefix. */
export const CACHE_PREFIX = 'infoscreen-player-';

export function cacheName(version: string): string {
    return `${CACHE_PREFIX}${version}`;
}
