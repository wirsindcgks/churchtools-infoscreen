/**
 * Turns `GET /calendars/appointments` into a flat list in local time.
 *
 * ChurchTools resolves series itself – one entry per occurrence, exceptions
 * removed, additional dates included (G19). This layer therefore does no
 * recurrence math: it reads `calculated` for the occurrence and `base` for
 * the description, and does everything else in the instance time zone.
 */
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
            calendar: { id: number; name: string; color?: string | null };
            image?: { imageUrl?: string | null } | null;
        };
        calculated: { startDate: string; endDate: string };
    };
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
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeAppointments(responses: AppointmentResponse[], timeZone: string): Appointment[] {
    const byKey = new Map<string, Appointment>();
    for (const response of responses) {
        const appointment = normalizeOne(response, timeZone);
        if (appointment) byKey.set(appointment.key, appointment);
    }
    return [...byKey.values()].sort(
        (a, b) =>
            a.start.getTime() - b.start.getTime() ||
            Number(b.allDay) - Number(a.allDay) ||
            a.title.localeCompare(b.title, 'de'),
    );
}

function normalizeOne(response: AppointmentResponse, timeZone: string): Appointment | null {
    const { base, calculated } = response.appointment;
    const start = parseInstant(calculated.startDate, timeZone);
    const endRaw = parseInstant(calculated.endDate, timeZone);
    if (!start || !endRaw) return null;

    const startDate = zonedDateKey(start, timeZone);
    // All-day entries come as pure dates with an inclusive end (G23): the entry
    // lasts until the end of that local day, not until its first minute.
    const endDate = base.allDay ? allDayEndDate(calculated.endDate, endRaw, timeZone) : zonedDateKey(endRaw, timeZone);
    const end = DATE_ONLY.test(calculated.endDate) ? startOfZonedDay(endRaw, timeZone, 1) : endRaw;

    return {
        key: `${base.id}@${start.toISOString()}`,
        baseId: base.id,
        calendarId: base.calendar.id,
        calendarName: base.calendar.name,
        color: base.calendar.color ?? null,
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
    };
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
