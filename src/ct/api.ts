import { churchtoolsClient } from '@churchtools/churchtools-client';
import type { AppointmentResponse } from '../appointments/normalize';
import { zonedDateKey } from '../appointments/zoned';
import { isValidHomepageHash, normalizeHomepageList, type HomepageEntry } from '../groups/normalize';
import type { PostResponse } from '../posts/normalize';

/**
 * The instance time zone. Readable anonymously and therefore by the device
 * user too; the device's own zone is only a last resort with a warning.
 */
export async function fetchTimeZone(): Promise<string> {
    const config = await churchtoolsClient.get<{ timezone?: string }>('/config');
    if (config.timezone) return config.timezone;
    const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.warn(`ChurchTools meldet keine Zeitzone, verwende ${fallback}.`);
    return fallback;
}

/**
 * Appointments of the given calendars between two instants. `calendar_ids[]`
 * is mandatory (400 otherwise); axios encodes the array in exactly that form.
 * `from` and `to` are local dates of the instance.
 */
export function fetchAppointments(
    calendarIds: number[],
    from: Date,
    to: Date,
    timeZone: string,
): Promise<AppointmentResponse[]> {
    if (calendarIds.length === 0) return Promise.resolve([]);
    return churchtoolsClient.get<AppointmentResponse[]>('/calendars/appointments', {
        calendar_ids: calendarIds,
        from: zonedDateKey(from, timeZone),
        to: zonedDateKey(to, timeZone),
        only_allow_authenticated: 'true',
    });
}

/**
 * The church logo as an image service address without size, or null without
 * a logo. `/logo` is anonymous but always answers 150×150, whatever `w` and
 * `h` say; it redirects to the image service, which honours them (G29). So
 * the redirect target is what counts – and it changes with the logo, which
 * makes it a cache key that needs no expiry rule of its own.
 */
export async function fetchChurchLogoUrl(baseUrl: string, fetcher: typeof fetch = fetch): Promise<string | null> {
    const response = await fetcher(`${baseUrl}/logo`, { cache: 'no-store', credentials: 'omit' });
    // What /logo answers without a logo is unmeasured: anything but an image means "none".
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) return null;
    const target = new URL(response.url);
    if (!/\/images\/\d+\//.test(target.pathname)) return null;
    target.search = '';
    return target.toString();
}

export interface Calendar {
    id: number;
    name: string;
    color?: string | null;
    isPublic?: boolean;
}

/** Calendars the signed-in person may see; the device user sees what its group grants (G21). */
export function fetchCalendars(): Promise<Calendar[]> {
    return churchtoolsClient.get<Calendar[]>('/calendars');
}

/**
 * Posts of the given groups, newest first. Anonymous callers and the device
 * account see the same as anyone: public posts of public groups, nothing
 * from restricted ones (G37) – exactly what the player shows.
 */
export function fetchPosts(groupIds: number[], limit: number): Promise<PostResponse[]> {
    if (groupIds.length === 0) return Promise.resolve([]);
    return churchtoolsClient.get<PostResponse[]>('/posts', { group_ids: groupIds, limit });
}

export interface PostGroup {
    id: number;
    name: string;
    visibility: string;
}

interface GroupResponse {
    id: number;
    name: string;
    settings?: { postsEnabled?: boolean; visibility?: string } | null;
}

/** Groups with posts switched on, for the inspector's group picker – sorted by name. */
export async function fetchPostGroups(): Promise<PostGroup[]> {
    const groups = await churchtoolsClient.getAllPages<GroupResponse>('/groups');
    return groups
        .filter((g) => g.settings?.postsEnabled)
        .map((g) => ({ id: g.id, name: g.name, visibility: g.settings?.visibility ?? 'restricted' }))
        .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/**
 * Group homepages are read anonymously, with the browser's cookies left out –
 * the device then shows exactly what any visitor sees (G40). And in German:
 * ChurchTools names weekdays and target groups in the language of each
 * request's `Accept-Language`, signed in or not, and in the instance's own
 * without one (measured 2026-09-29). A TV whose system is set to English
 * showed "Sunday" beside "Noch 3 Plätze frei"; the module speaks German.
 * The ChurchTools client can set neither, so this uses `fetch` like
 * `fetchChurchLogoUrl`.
 */
async function getAnonymously<T>(baseUrl: string, path: string, fetcher: typeof fetch): Promise<T> {
    const response = await fetcher(`${baseUrl}/api${path}`, {
        cache: 'no-store',
        credentials: 'omit',
        headers: { Accept: 'application/json', 'Accept-Language': 'de' },
    });
    if (!response.ok) {
        throw Object.assign(new Error(`${path}: HTTP ${response.status}`), {
            response: { status: response.status, headers: { 'retry-after': response.headers.get('retry-after') ?? undefined } },
        });
    }
    return ((await response.json()) as { data: T }).data;
}

/** The enabled group homepages, each with its parent group, its title and the hash to fetch it by. */
export async function fetchGroupHomepageList(baseUrl: string, fetcher: typeof fetch = fetch): Promise<HomepageEntry[]> {
    return normalizeHomepageList(await getAnonymously<unknown[]>(baseUrl, '/grouphomepages', fetcher));
}

/** One homepage with the groups ChurchTools shows the public (G40). The hash is checked before it goes into the path. */
export function fetchGroupHomepage(baseUrl: string, hash: string, fetcher: typeof fetch = fetch): Promise<unknown> {
    if (!isValidHomepageHash(hash)) return Promise.reject(new Error('Ungültige Kennung einer Gruppen-Homepage.'));
    return getAnonymously<unknown>(baseUrl, `/grouphomepages/${hash}`, fetcher);
}
