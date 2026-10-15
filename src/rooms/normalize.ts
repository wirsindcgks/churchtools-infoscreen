/**
 * Turns ChurchTools bookings into the flat shape the `rooms` block shows
 * (schema 1.16, Plan.md, Nächste Schritte 46; measured in G45).
 *
 * The privacy rule sits here, not in the view: a booking keeps room, start,
 * end, "all day" and title – nothing else. `description`, `subtitle`, `note`,
 * `caption`, `location`, `onBehalfOfPid`, `answeredPid`, `meta`,
 * `appointment` and the embedded resource never leave this file, so they
 * reach neither the screen nor the offline copy. Only confirmed bookings
 * count, whatever the server was asked for.
 */
import { LOCALE, tp } from '../i18n/player';

/** `statusId` of a confirmed booking (G45: 1 waits, 2 confirmed, 3 rejected). */
export const BOOKING_CONFIRMED = 2;
/** The key of the resource type "Raum" – the translated name changes with the language (G45). */
export const ROOM_TYPE_KEY = 'resource.type.room';

/** One entry of `GET /bookings`, as far as this code reads it. */
interface BookingResponse {
    booking?: { base?: BookingBase | null; calculated?: { startDate?: string | null; endDate?: string | null } | null } | null;
    base?: BookingBase | null;
    calculated?: { startDate?: string | null; endDate?: string | null } | null;
}

interface BookingBase {
    id?: number | string | null;
    title?: string | null;
    resourceId?: number | string | null;
    statusId?: number | null;
    allDay?: boolean | null;
    startDate?: string | null;
    endDate?: string | null;
}

/** `GET /resource/masterdata`, as far as this code reads it. */
export interface ResourceMasterdata {
    resourceTypes?: { id?: number; name?: string | null; nameTranslated?: string | null; sortKey?: number | null }[] | null;
    resources?: {
        id?: number;
        name?: string | null;
        nameTranslated?: string | null;
        sortKey?: number | null;
        resourceTypeId?: number | null;
    }[] | null;
}

/** A room to choose in the inspector. */
export interface RoomInfo {
    id: number;
    name: string;
}

export interface RoomBooking {
    id: number;
    resourceId: number;
    /** Null for a booking without a title (or with spaces only). */
    title: string | null;
    start: Date;
    end: Date;
    allDay: boolean;
}

export interface RoomBookings {
    resourceId: number;
    name: string;
    bookings: RoomBooking[];
}

/** A resource type as the settings offer it (Plan.md 86): its name and the names of its resources. */
export interface ResourceTypeInfo {
    id: number;
    name: string;
    resources: string[];
}

/**
 * The resource types that count as rooms (schema 1.35, Plan.md 86): the chosen ones that still exist; without a
 * choice the type "Raum". Empty – an instance without that type, or nothing chosen – means: no resource is a room.
 */
export function roomTypeIdsOf(masterdata: unknown, chosen?: readonly number[]): number[] {
    const types = ((masterdata ?? {}) as ResourceMasterdata).resourceTypes ?? [];
    const known = types.filter((t) => typeof t?.id === 'number');
    const ids = chosen ? known.filter((t) => chosen.includes(t.id!)) : known.filter((t) => t.name === ROOM_TYPE_KEY);
    return ids.map((t) => t.id!);
}

/** Every resource type with its resources, by `sortKey`, then name – for the choice in the settings. */
export function resourceTypesOf(masterdata: unknown): ResourceTypeInfo[] {
    const data = (masterdata ?? {}) as ResourceMasterdata;
    return (data.resourceTypes ?? [])
        .filter((t) => typeof t?.id === 'number')
        .sort((a, b) => (a.sortKey ?? Infinity) - (b.sortKey ?? Infinity) || (a.name ?? '').localeCompare(b.name ?? '', LOCALE))
        .map((t) => ({
            id: t.id!,
            name: (t.nameTranslated ?? t.name ?? '').trim() || String(t.id),
            resources: roomsOf(data, [t.id!]).map((r) => r.name),
        }));
}

/**
 * The resources of the types that count as rooms (`roomTypeIdsOf`), by `sortKey`, then name. Name = the
 * translated one where there is one. `chosenTypeIds` is the choice of the settings; missing = the type "Raum".
 */
export function roomsOf(masterdata: unknown, chosenTypeIds?: readonly number[]): RoomInfo[] {
    const data = (masterdata ?? {}) as ResourceMasterdata;
    const roomTypeIds = new Set(roomTypeIdsOf(data, chosenTypeIds));
    return (data.resources ?? [])
        .filter((r) => typeof r?.id === 'number' && r.resourceTypeId != null && roomTypeIds.has(r.resourceTypeId))
        .sort((a, b) => (a.sortKey ?? Infinity) - (b.sortKey ?? Infinity) || (a.name ?? '').localeCompare(b.name ?? '', LOCALE))
        .map((r) => ({ id: r.id!, name: (r.nameTranslated ?? r.name ?? '').trim() || tp.rooms.fallbackName(r.id!) }));
}

/**
 * The confirmed bookings of a response, each cut down to `RoomBooking`. Times
 * come from `calculated` (what ChurchTools worked out for a series), else from
 * `base`. Bookings without a readable time drop out.
 */
export function normalizeBookings(raw: unknown[]): RoomBooking[] {
    const bookings: RoomBooking[] = [];
    for (const entry of raw as BookingResponse[]) {
        const base = entry?.booking?.base ?? entry?.base;
        if (!base || base.statusId !== BOOKING_CONFIRMED) continue;
        const calculated = entry.booking?.calculated ?? entry.calculated;
        const start = new Date(calculated?.startDate ?? base.startDate ?? '');
        const end = new Date(calculated?.endDate ?? base.endDate ?? '');
        const id = Number(base.id);
        const resourceId = Number(base.resourceId);
        if (!Number.isInteger(id) || !Number.isInteger(resourceId)) continue;
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
        bookings.push({
            id,
            resourceId,
            title: (base.title ?? '').trim() || null,
            start,
            end,
            allDay: base.allDay === true,
        });
    }
    return bookings;
}

/** JSON round trips turn dates into strings; bring them back. */
export function reviveRooms(rooms: RoomBookings[]): RoomBookings[] {
    return rooms.map((room) => ({
        ...room,
        bookings: room.bookings.map((b) => ({ ...b, start: new Date(b.start), end: new Date(b.end) })),
    }));
}
