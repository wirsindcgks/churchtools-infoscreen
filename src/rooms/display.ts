/**
 * What a `rooms` block shows, worked out from the bookings, the block's rooms
 * and the clock – without a view, so that it can be tested (schema 1.16,
 * Plan.md, Nächste Schritte 46). The privacy switch "Titel zeigen" is applied
 * here: a room without it says "Belegt", whatever the title was.
 */
import { startOfZonedDay } from '../appointments/zoned';
import type { RoomEntry } from '../model/schema';
import { formatTime } from '../player/format';
import type { RoomBooking, RoomBookings } from './normalize';

export interface RoomLine {
    key: string;
    /** "10:00–11:30", or "ganztägig". */
    time: string;
    title: string;
    /** Running now: start ≤ now < end. */
    now: boolean;
    /** Starts tomorrow – only with two days. */
    tomorrow: boolean;
}

export interface RoomRow {
    resourceId: number;
    name: string;
    hint: string;
    lines: RoomLine[];
}

export interface DoorSign {
    name: string;
    hint: string;
    /** What is going on now, with "bis 11:30" (or "ganztägig"); null = free. */
    current: (RoomLine & { until: string }) | null;
    /** Free and something comes today: "bis 14:00"; else null. */
    freeUntil: string | null;
    /** Up to three after the current one. */
    next: RoomLine[];
}

export const DOOR_NEXT = 3;

export function timeText(booking: Pick<RoomBooking, 'allDay' | 'start' | 'end'>, timeZone: string): string {
    return booking.allDay ? 'ganztägig' : `${formatTime(booking.start, timeZone)}–${formatTime(booking.end, timeZone)}`;
}

function lineOf(booking: RoomBooking, entry: RoomEntry, now: Date, timeZone: string, tomorrowStart: number): RoomLine {
    return {
        key: `${booking.resourceId}-${booking.id}-${booking.start.getTime()}`,
        time: timeText(booking, timeZone),
        title: entry.showTitles && booking.title ? booking.title : 'Belegt',
        now: booking.start <= now && now < booking.end,
        tomorrow: booking.start.getTime() >= tomorrowStart,
    };
}

/** The bookings of a room that are not over and begin within the days shown, by start. */
function upcoming(room: RoomBookings, now: Date, timeZone: string, days: 1 | 2): RoomBooking[] {
    const until = startOfZonedDay(now, timeZone, days).getTime();
    return room.bookings
        .filter((b) => b.end > now && b.start.getTime() < until)
        .sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
}

/** The overview: the block's rooms in its order, each with what is left; rooms with nothing left drop out. */
export function overviewRows(
    rooms: readonly RoomBookings[],
    entries: readonly RoomEntry[],
    now: Date,
    timeZone: string,
    days: 1 | 2,
): RoomRow[] {
    const tomorrowStart = startOfZonedDay(now, timeZone, 1).getTime();
    const rows: RoomRow[] = [];
    for (const entry of entries) {
        const room = rooms.find((r) => r.resourceId === entry.resourceId);
        if (!room) continue;
        const lines = upcoming(room, now, timeZone, days).map((b) => lineOf(b, entry, now, timeZone, tomorrowStart));
        if (lines.length) rows.push({ resourceId: room.resourceId, name: room.name, hint: entry.hint.trim(), lines });
    }
    return rows;
}

/** The door sign of the first room; null when the block has none or its data is missing (no right, deleted). */
export function doorSign(
    rooms: readonly RoomBookings[],
    entries: readonly RoomEntry[],
    now: Date,
    timeZone: string,
    days: 1 | 2,
): DoorSign | null {
    const entry = entries[0];
    const room = entry && rooms.find((r) => r.resourceId === entry.resourceId);
    if (!entry || !room) return null;
    const tomorrowStart = startOfZonedDay(now, timeZone, 1).getTime();
    const bookings = upcoming(room, now, timeZone, days);
    const running = bookings.find((b) => b.start <= now);
    const rest = bookings.filter((b) => b !== running);
    const nextToday = rest.find((b) => b.start.getTime() < tomorrowStart);
    return {
        name: room.name,
        hint: entry.hint.trim(),
        current: running
            ? { ...lineOf(running, entry, now, timeZone, tomorrowStart), until: running.allDay ? 'ganztägig' : `bis ${formatTime(running.end, timeZone)}` }
            : null,
        freeUntil: !running && nextToday ? `bis ${formatTime(nextToday.start, timeZone)}` : null,
        next: rest.slice(0, DOOR_NEXT).map((b) => lineOf(b, entry, now, timeZone, tomorrowStart)),
    };
}

/** What the overview says when no room has a booking left. */
export function emptyText(days: 1 | 2): string {
    return days === 2 ? 'Heute und morgen sind keine Räume belegt.' : 'Heute sind keine Räume belegt.';
}
