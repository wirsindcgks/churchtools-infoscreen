import { churchtoolsClient } from '@churchtools/churchtools-client';
import type { AppointmentResponse } from '../appointments/normalize';
import type { EventResponse, ServiceGroupResponse, ServiceResponse } from '../appointments/services';
import { zonedDateKey } from '../appointments/zoned';
import { isValidHomepageHash, normalizeHomepageList, type HomepageEntry } from '../groups/normalize';
import type { PostResponse } from '../posts/normalize';
import { BOOKING_CONFIRMED, type ResourceMasterdata } from '../rooms/normalize';

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
    options: { bookings?: boolean } = {},
): Promise<AppointmentResponse[]> {
    if (calendarIds.length === 0) return Promise.resolve([]);
    return churchtoolsClient.get<AppointmentResponse[]>('/calendars/appointments', {
        calendar_ids: calendarIds,
        from: zonedDateKey(from, timeZone),
        to: zonedDateKey(to, timeZone),
        only_allow_authenticated: 'true',
        // The bookings of the appointments, for their rooms; without the right the list is empty, not a 403.
        ...(options.bookings ? { include: ['bookings'] } : {}),
    });
}

/**
 * The events between two local dates with their services (`eventServices`). One request:
 * how `/events` pages is not measured (G46) – a window longer than the page would lose events.
 * Without the right to see the events of a calendar the answer is a 403 or an empty list (G46).
 */
export function fetchEvents(from: Date, to: Date, timeZone: string): Promise<EventResponse[]> {
    return churchtoolsClient.get<EventResponse[]>('/events', {
        from: zonedDateKey(from, timeZone),
        to: zonedDateKey(to, timeZone),
        include: 'eventServices',
    });
}

/** The services of ChurchTools, unprotected stammdaten (G46). */
export function fetchServices(): Promise<ServiceResponse[]> {
    return churchtoolsClient.get<ServiceResponse[]>('/services');
}

/** The service groups, with `viewAll` – "Ohne Berechtigung einsehbar" (G46). */
export function fetchServiceGroups(): Promise<ServiceGroupResponse[]> {
    return churchtoolsClient.get<ServiceGroupResponse[]>('/servicegroups');
}

/**
 * The stammdaten of the resources (types and resources), as far as the
 * caller may see them – a caller without the right sees no resource (G45).
 */
export function fetchResourceMasterdata(): Promise<ResourceMasterdata> {
    return churchtoolsClient.get<ResourceMasterdata>('/resource/masterdata');
}

/**
 * The confirmed bookings of one room. One request per room: a missing right
 * fails the whole request with 403, however many rooms it names (G45).
 * `status_ids[]=2` is set on purpose – without it ChurchTools also sends
 * bookings that still wait. `from` and `to` are local dates of the instance;
 * `to` is still inclusive.
 */
export function fetchBookings(resourceId: number, from: Date, to: Date, timeZone: string): Promise<unknown[]> {
    return churchtoolsClient.get<unknown[]>('/bookings', {
        resource_ids: [resourceId],
        status_ids: [BOOKING_CONFIRMED],
        from: zonedDateKey(from, timeZone),
        to: zonedDateKey(to, timeZone),
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
}

/** Where a church releases a calendar to the public user; shown wherever a calendar is missing (Plan.md 73, G53). */
export const PUBLIC_CALENDAR_PATH = 'Berechtigungen → Benutzer → „Öffentlicher Benutzer" → Kalender → „Einzelnen Kalender sehen"';

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

/** The header that marks a request of `getAnonymously`; the dev proxy sends such requests without the login token. */
export const ANONYMOUS_HEADER = 'X-Infoscreen-Anonymous';

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
        // Marks the request as anonymous, for the dev proxy and the e2e tests; ChurchTools ignores the header (G53).
        // Not `X-OnlyAuthenticated`: ChurchTools answers 401 to any value of it, `0` included.
        headers: { Accept: 'application/json', 'Accept-Language': 'de', [ANONYMOUS_HEADER]: '1' },
    });
    if (!response.ok) {
        throw Object.assign(new Error(`${path}: HTTP ${response.status}`), {
            response: { status: response.status, headers: { 'retry-after': response.headers.get('retry-after') ?? undefined } },
        });
    }
    return ((await response.json()) as { data: T }).data;
}

/**
 * The calendars the public user may see – that is what "public" means (Plan.md 73, G53). Every signed-in
 * account sees them too. The one place that rule lives.
 */
export function fetchPublicCalendars(baseUrl: string, fetcher: typeof fetch = fetch): Promise<Calendar[]> {
    return getAnonymously<Calendar[]>(baseUrl, '/calendars', fetcher);
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
