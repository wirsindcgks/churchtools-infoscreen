/**
 * Turns `GET /calendars/appointments` into a flat list in local time.
 *
 * ChurchTools resolves series itself – one entry per occurrence, exceptions
 * removed, additional dates included (G19). This layer therefore does no
 * recurrence math: it reads `calculated` for the occurrence and `base` for
 * the description, and does everything else in the instance time zone.
 */
import { calendarColor } from '../player/format';
import { BOOKING_CONFIRMED, type RoomInfo } from '../rooms/normalize';
import { servicesByAppointment, type AppointmentService, type ServiceInput } from './services';
import { startOfZonedDay, zonedDateKey, zonedTimeKey } from './zoned';

/** The fields of an appointment this code reads; the response has many more. */
export interface AppointmentResponse {
    appointment: {
        base: {
            id: number;
            title: string;
            subtitle?: string | null;
            description?: string | null;
            link?: string | null;
            allDay: boolean;
            /** "Only for signed-in users": the device is signed in, so these are left out (Plan.md 62, G49). */
            isInternal?: boolean;
            calendar: { id: number; name: string; color?: string | null };
            image?: { imageUrl?: string | null } | null;
            /** The place; ChurchTools composes the line itself, from separate fields. */
            address?: { name?: string | null; addition?: string | null } | null;
        };
        calculated: { startDate: string; endDate: string };
        /** With `include[]=bookings`; ChurchTools puts it beside `base`, read here in both places. */
        bookings?: BookingEntry[] | null;
    };
    bookings?: BookingEntry[] | null;
}

/** A booking of an appointment, as far as the room is read from it – nothing else is. */
interface BookingEntry {
    base?: { resourceId?: number | string | null; statusId?: number | null } | null;
    booking?: { base?: { resourceId?: number | string | null; statusId?: number | null } | null } | null;
}

export interface Appointment {
    /** Unique per occurrence: a series shares `baseId`, not `key`. */
    key: string;
    baseId: number;
    calendarId: number;
    calendarName: string;
    color: string | null;
    title: string;
    subtitle: string;
    start: Date;
    end: Date;
    allDay: boolean;
    /** Local dates, `YYYY-MM-DD`; for all-day entries `endDate` is the last day, inclusive. */
    startDate: string;
    endDate: string;
    /** Local times, `HH:mm`; null for all-day entries. */
    startTime: string | null;
    endTime: string | null;
    multiDay: boolean;
    /** Image service address; request it with both `w` and `h` (G14). */
    imageUrl: string | null;
    /**
     * Where, as needed on site: the place's name and its addition ("Gemeindezentrum, Saal") –
     * as the WordPress plugin shows it; street and city say little in the own foyer.
     */
    location: string | null;
    /** The description as plain text, markup removed. */
    description: string;
    /**
     * The names of the rooms booked for it (confirmed bookings of resources of the type room),
     * by `sortKey`, then name. Only names: no booking title, no description (Plan.md, 50).
     * Missing where rooms were not asked for or none is booked.
     */
    rooms?: string[];
    /**
     * Who takes which service – names only, no id of a person, no image, no comment (Plan.md, 51).
     * By `sortKey` of the service, then name. Missing where services were not asked for or nobody is assigned.
     */
    services?: AppointmentService[];
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** `rooms`: the rooms of the stammdaten (`roomsOf`); without them no appointment gets a room. `serviceInput`: likewise for services (Plan.md, 51). */
export function normalizeAppointments(
    responses: AppointmentResponse[],
    timeZone: string,
    rooms: RoomInfo[] = [],
    serviceInput?: ServiceInput,
): Appointment[] {
    const byKey = new Map<string, Appointment>();
    for (const response of responses) {
        const appointment = normalizeOne(response, timeZone, rooms);
        if (appointment) byKey.set(appointment.key, appointment);
    }
    if (serviceInput) {
        for (const [key, services] of servicesByAppointment(serviceInput)) {
            const appointment = byKey.get(key);
            if (appointment) appointment.services = services;
        }
    }
    return [...byKey.values()].sort(
        (a, b) =>
            a.start.getTime() - b.start.getTime() ||
            Number(b.allDay) - Number(a.allDay) ||
            a.title.localeCompare(b.title, 'de'),
    );
}

function normalizeOne(response: AppointmentResponse, timeZone: string, rooms: RoomInfo[]): Appointment | null {
    const { base, calculated } = response.appointment;
    if (base.isInternal === true) return null;
    const start = parseInstant(calculated.startDate, timeZone);
    const endRaw = parseInstant(calculated.endDate, timeZone);
    if (!start || !endRaw) return null;

    const startDate = zonedDateKey(start, timeZone);
    // All-day entries come as pure dates with an inclusive end (G23): the entry
    // lasts until the end of that local day, not until its first minute.
    const endDate = base.allDay ? allDayEndDate(calculated.endDate, endRaw, timeZone) : zonedDateKey(endRaw, timeZone);
    const end = DATE_ONLY.test(calculated.endDate) ? startOfZonedDay(endRaw, timeZone, 1) : endRaw;

    const roomNames = bookedRooms(response.bookings ?? response.appointment.bookings, rooms);

    return {
        key: `${base.id}@${start.toISOString()}`,
        baseId: base.id,
        calendarId: base.calendar.id,
        calendarName: base.calendar.name,
        color: calendarColor(base.calendar.color),
        title: base.title,
        subtitle: base.subtitle ?? '',
        start,
        end,
        allDay: base.allDay,
        startDate,
        endDate: endDate < startDate ? startDate : endDate,
        startTime: base.allDay ? null : zonedTimeKey(start, timeZone),
        endTime: base.allDay ? null : zonedTimeKey(end, timeZone),
        multiDay: endDate > startDate,
        imageUrl: base.image?.imageUrl ?? null,
        location: [base.address?.name, base.address?.addition].map((part) => part?.trim()).filter(Boolean).join(', ') || null,
        description: plainText(base.description ?? ''),
        ...(roomNames.length ? { rooms: roomNames } : {}),
    };
}

/** Names of the rooms with a confirmed booking, each once, in the order of `rooms`. */
function bookedRooms(bookings: BookingEntry[] | null | undefined, rooms: RoomInfo[]): string[] {
    if (!bookings?.length || !rooms.length) return [];
    const booked = new Set<number>();
    for (const entry of bookings) {
        const base = entry?.booking?.base ?? entry?.base;
        if (base?.statusId !== BOOKING_CONFIRMED) continue;
        booked.add(Number(base.resourceId));
    }
    return rooms.filter((r) => booked.has(r.id)).map((r) => r.name);
}

/** Text without tags and entities, on one line – enough for three lines on a TV. */
export function plainText(value: string): string {
    return value
        .replace(/<br\s*\/?>|<\/p>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseInstant(value: string, timeZone: string): Date | null {
    if (DATE_ONLY.test(value)) {
        const [year, month, day] = value.split('-').map(Number) as [number, number, number];
        return startOfZonedDay(new Date(Date.UTC(year, month - 1, day, 12)), timeZone);
    }
    const instant = new Date(value);
    return Number.isNaN(instant.getTime()) ? null : instant;
}

/** Pure dates are measured (G23); an end at local midnight is only a fallback reading. */
function allDayEndDate(raw: string, end: Date, timeZone: string): string {
    if (DATE_ONLY.test(raw)) return raw;
    const isLocalMidnight = zonedTimeKey(end, timeZone) === '00:00';
    return zonedDateKey(isLocalMidnight ? new Date(end.getTime() - 1) : end, timeZone);
}

export interface UpcomingOptions {
    now: Date;
    timeZone: string;
    /** Whole local days from today, including today. */
    horizonDays: number;
    limit: number;
    calendarIds?: number[];
}

/**
 * What a list block shows: appointments that have not ended yet – a service
 * that is running stays on screen – and start before the horizon ends.
 */
export function selectUpcoming(appointments: Appointment[], options: UpcomingOptions): Appointment[] {
    const horizonEnd = startOfZonedDay(options.now, options.timeZone, options.horizonDays);
    const calendars = options.calendarIds ? new Set(options.calendarIds) : null;
    return appointments
        .filter((a) => a.end > options.now && a.start < horizonEnd)
        .filter((a) => !calendars || calendars.has(a.calendarId))
        .slice(0, options.limit);
}
