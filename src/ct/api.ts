import { churchtoolsClient } from '@churchtools/churchtools-client';
import type { AgendaItemResponse, LivePositionResponse } from '../agenda/live';
import type { AppointmentResponse } from '../appointments/normalize';
import type { EventResponse, ServiceGroupResponse, ServiceResponse } from '../appointments/services';
import { zonedDateKey } from '../appointments/zoned';
import { httpStatus } from './client';
import { isValidHomepageHash, normalizeHomepageList, type HomepageEntry } from '../groups/normalize';
import type { PostResponse } from '../posts/normalize';
import { BOOKING_CONFIRMED, type ResourceMasterdata } from '../rooms/normalize';
import { LOCALE } from '../i18n/player';

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
    options: { bookings?: boolean; tags?: boolean } = {},
): Promise<AppointmentResponse[]> {
    if (calendarIds.length === 0) return Promise.resolve([]);
    return churchtoolsClient.get<AppointmentResponse[]>('/calendars/appointments', {
        calendar_ids: calendarIds,
        from: zonedDateKey(from, timeZone),
        to: zonedDateKey(to, timeZone),
        only_allow_authenticated: 'true',
        // The bookings of the appointments, for their rooms (without the right the list is empty, not a 403), and their tags (G59).
        ...(options.bookings || options.tags ? { include: [...(options.bookings ? ['bookings'] : []), ...(options.tags ? ['tags'] : [])] } : {}),
    });
}

/** An appointment tag: the colour is a semantic ChurchTools name such as `basic` or `blue`, not hex (G59). */
export interface AppointmentTag {
    id: number;
    name: string;
    color?: string | null;
}

/** All appointment tags; the device user reads them without a right of its own (G59). */
export function fetchAppointmentTags(): Promise<AppointmentTag[]> {
    return churchtoolsClient.get<AppointmentTag[]>('/tags/appointment');
}

/**
 * The events between two local dates with their services (`eventServices`). One request:
 * without `direction` the range is not paged (G68). `to` counts only up to its midnight, so the
 * day of `to` itself is left out (G68).
 * Without the right to see the events of a calendar the answer is a 403 or an empty list (G46).
 */
export function fetchEvents(from: Date, to: Date, timeZone: string): Promise<EventResponse[]> {
    return churchtoolsClient.get<EventResponse[]>('/events', {
        from: zonedDateKey(from, timeZone),
        to: zonedDateKey(to, timeZone),
        include: 'eventServices',
    });
}

/** One event of `GET /events` as the live agenda reads it (Plan.md 118): its time and the calendar it belongs to. */
export interface AgendaEventResponse {
    id?: number | null;
    startDate?: string | null;
    endDate?: string | null;
    isCanceled?: boolean | null;
    /** The name of the event (G-measured 2026-11-11). */
    name?: string | null;
    /** The calendar as a link object; its `domainIdentifier` is the calendar id as a string. */
    calendar?: { domainIdentifier?: string | null } | null;
}

/** The events between two local dates, without their services (Plan.md 118); `to` counts up to its midnight (G68). */
export function fetchEventList(from: Date, to: Date, timeZone: string): Promise<AgendaEventResponse[]> {
    return churchtoolsClient.get<AgendaEventResponse[]>('/events', { from: zonedDateKey(from, timeZone), to: zonedDateKey(to, timeZone) });
}

/** The agenda of an event (Plan.md 118). A `404` means the event has none; the points come in the delivered order. */
export async function fetchAgenda(eventId: number): Promise<{ calendarId?: number | null; items?: AgendaItemResponse[] | null }> {
    return churchtoolsClient.get(`/events/${eventId}/agenda`);
}

/** A song of `GET /events/{id}/agenda/songs` as the block "Liedblatt" reads it: its arrangements with their files (Plan.md 121 B, G82). */
export interface AgendaSongResponse {
    id?: number | null;
    arrangements?: { id?: number | null; description?: string | null; files?: { name?: string | null; fileUrl?: string | null }[] | null }[] | null;
}

/** All songs of the agenda with all arrangements and files, in one call. Without right 313 the list is empty or the answer a `403` (G82). */
export async function fetchAgendaSongs(eventId: number): Promise<AgendaSongResponse[]> {
    return churchtoolsClient.get(`/events/${eventId}/agenda/songs`);
}

/** The address of a file on the own origin: the answer carries the address of the instance, the module runs on it (and behind the proxy in development). */
export function ownFileUrl(fileUrl: string): string {
    const parsed = new URL(fileUrl, `${window.location.origin}/`);
    return `${window.location.origin}${parsed.pathname}${parsed.search}`;
}

/** The text of a file of an arrangement, over the session of the page (`302` with the cookie, then `200`, G82); the byte order mark is dropped. */
export async function fetchSheetText(fileUrl: string): Promise<string> {
    const response = await fetch(ownFileUrl(fileUrl), { credentials: 'include' });
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { response: { status: response.status } });
    return new TextDecoder('utf-8').decode(await response.arrayBuffer());
}

/** The live position cannot be read for lack of a right: `403`, or `200` with `status: "fail"` (G81). */
export class LiveAgendaDeniedError extends Error {}

function readLivePosition(eventId: number): Promise<LivePositionResponse> {
    return churchtoolsClient.oldApi('churchservice/ajax', 'loadAgendaLivePosition', { event_id: eventId }) as Promise<LivePositionResponse>;
}

/** The old interface answers a missing right as `403` or as `200` with `status: "fail"` – the client rejects the latter with the response (G81). */
function liveAgendaError(error: unknown): unknown {
    const status = httpStatus(error);
    const answer = (error as { response?: { data?: { status?: unknown; message?: unknown } } } | null)?.response?.data;
    if (status === 403 || (status === 200 && answer?.status === 'fail')) {
        return new LiveAgendaDeniedError(typeof answer?.message === 'string' ? answer.message : 'Keine Berechtigung für die Live-Agenda.');
    }
    return error;
}

/**
 * The position of the live agenda, over the old interface (G81, the only one there is): the client brings the CSRF token
 * itself. After a `401` the stored token may be stale – it is dropped once and the call repeated. A missing right comes as
 * `LiveAgendaDeniedError`.
 */
export async function fetchLivePosition(eventId: number): Promise<LivePositionResponse> {
    try {
        return await readLivePosition(eventId);
    } catch (error) {
        if (httpStatus(error) !== 401) throw liveAgendaError(error);
    }
    // The client keeps the token in a private field; without a token it fetches a new one with the next call.
    (churchtoolsClient as unknown as { csrfToken?: string }).csrfToken = undefined;
    return readLivePosition(eventId).catch((error: unknown) => {
        throw liveAgendaError(error);
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

/**
 * The members of the people group with their member fields (a list of `{ id, name, value, sortKey }`, G71) and the group's
 * roles (Plan.md 112). Only the members are essential: a `403` there is passed on, so the block can say that the right is
 * missing. The roles only name what the members carry – without them the block still shows names and pictures. The same
 * holds for the field definitions (`/memberfields`, G75): they give the types and the option names; without them a value shows as it comes.
 * `/persons` is asked only with a release and only for the fields a block chose – see `fetchPersons` (Plan.md 112, Stück 3).
 */
export async function fetchGroupMembers(groupId: number): Promise<{ members: unknown[]; roles: unknown[]; fieldDefs: unknown[] }> {
    const members = await churchtoolsClient.getAllPages<unknown>(`/groups/${groupId}/members`);
    const roles = await churchtoolsClient.get<unknown[]>(`/groups/${groupId}/roles`).catch(() => []);
    const fieldDefs = await churchtoolsClient.get<unknown[]>(`/groups/${groupId}/memberfields`).catch(() => []);
    return { members, roles: Array.isArray(roles) ? roles : [], fieldDefs: Array.isArray(fieldDefs) ? fieldDefs : [] };
}

/**
 * The persons with these ids, all pages (Plan.md 112, Stück 3). The answer carries every field of security level 1 the account
 * may read, not just the ones asked for – the caller keeps the released and chosen ones and lets go of the rest at once
 * (`personFieldValues`). Called only when an administrator released person fields and a block chose some (G71).
 */
export async function fetchPersons(ids: number[]): Promise<unknown[]> {
    if (!ids.length) return [];
    return churchtoolsClient.getAllPages<unknown>('/persons', { ids });
}

/** A person field of the instance, as `GET /fields` names it – for the setup's list, the designer's names and the player's values (Plan.md 115). */
export interface PersonFieldInfo {
    key: string;
    name: string;
    secLevel: number | null;
    isActive: boolean;
    /** `fieldTypeCode`: `text`, `date`, `number`, `checkbox`, `select` … */
    type: string;
    /** `fieldCategoryCode`: `f_address`, `f_church`, `f_group` … */
    category: string;
    /** `hideInFrontend`: the field is not shown in ChurchTools. */
    hidden: boolean;
}

/** The field definitions of the instance with their security level; the device gets them with `200` as well (G76). */
export async function fetchPersonFields(): Promise<PersonFieldInfo[]> {
    // Measured: `isActive` comes as the text "1", `secLevel` as a number.
    const list = await churchtoolsClient.get<
        { key?: string; nameTranslated?: string; name?: string; secLevel?: number | null; isActive?: unknown; fieldTypeCode?: unknown; fieldCategoryCode?: unknown; hideInFrontend?: unknown }[]
    >('/fields');
    return (Array.isArray(list) ? list : [])
        .filter((f) => typeof f.key === 'string')
        .map((f) => ({
            key: f.key!,
            name: f.nameTranslated || f.name || f.key!,
            secLevel: typeof f.secLevel === 'number' ? f.secLevel : null,
            isActive: f.isActive === true || f.isActive === 1 || f.isActive === '1',
            type: typeof f.fieldTypeCode === 'string' ? f.fieldTypeCode : '',
            category: typeof f.fieldCategoryCode === 'string' ? f.fieldCategoryCode : '',
            hidden: f.hideInFrontend === true || f.hideInFrontend === 1 || f.hideInFrontend === '1',
        }));
}

/** A security level of the instance. The id is the sorting (G73): levels build on each other, a lower id is seen with a higher one. */
export interface SecurityLevel {
    id: number;
    name: string;
}

/** The security levels, ascending by id. Read at every run, never remembered – the id changes when the levels are reordered (G73). */
export async function fetchSecurityLevels(): Promise<SecurityLevel[]> {
    const list = await churchtoolsClient.get<{ id?: unknown; name?: unknown }[]>('/securitylevels');
    return (Array.isArray(list) ? list : [])
        .filter((l): l is { id: number; name?: unknown } => typeof l.id === 'number')
        .map((l) => ({ id: l.id, name: typeof l.name === 'string' && l.name ? l.name : String(l.id) }))
        .sort((a, b) => a.id - b.id);
}

/**
 * The names of these groups, for the inspector's group choice and the setup (Plan.md 112, Stück 2a). A group the account may
 * not read is missing from the answer – the caller labels it by number.
 */
/** `ids` becomes `ids[]`, as the specification names it (axios encodes the array so, like `calendar_ids[]` above). */
export async function fetchGroupNames(ids: number[]): Promise<Map<number, string>> {
    if (!ids.length) return new Map();
    const list = await churchtoolsClient.getAllPages<{ id: number; name: string }>('/groups', { ids });
    return new Map(list.map((g) => [g.id, g.name]));
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
        .sort((a, b) => a.name.localeCompare(b.name, LOCALE));
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
        headers: { Accept: 'application/json', 'Accept-Language': LOCALE.split('-')[0]!, [ANONYMOUS_HEADER]: '1' },
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
