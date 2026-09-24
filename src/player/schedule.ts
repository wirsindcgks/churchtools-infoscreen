/**
 * Which playlist runs now (Plan.md, Playlists und Zeitpläne). The player
 * decides this itself so that it keeps working offline.
 */
import type { Appointment } from '../appointments/normalize';
import { zonedParts } from '../appointments/zoned';
import type { ScreenDoc } from '../model/schema';

export interface ScheduleContext {
    now: Date;
    timeZone: string;
    /** Until the device clock is confirmed against the server, only the default runs. */
    clockConfirmed: boolean;
    appointments: Appointment[];
}

export function activePlaylistId(screen: ScreenDoc, context: ScheduleContext): string {
    if (!context.clockConfirmed) return screen.defaultPlaylistId;
    // Earlier rules win on overlap – a fixed order, not the accident of JSON order.
    for (const rule of screen.schedule) {
        if (rule.kind === 'time' && matchesTimeRule(rule, context)) return rule.playlistId;
        if (rule.kind === 'appointment' && matchesAppointmentRule(rule, context)) return rule.playlistId;
    }
    return screen.defaultPlaylistId;
}

type TimeRule = Extract<ScreenDoc['schedule'][number], { kind: 'time' }>;
type AppointmentRule = Extract<ScreenDoc['schedule'][number], { kind: 'appointment' }>;

function matchesTimeRule(rule: TimeRule, { now, timeZone }: ScheduleContext): boolean {
    const p = zonedParts(now, timeZone);
    if (!rule.weekdays.includes(p.weekday)) return false;
    const minute = p.hour * 60 + p.minute;
    return minute >= toMinutes(rule.from) && minute < toMinutes(rule.to);
}

function matchesAppointmentRule(rule: AppointmentRule, { now, appointments }: ScheduleContext): boolean {
    const calendars = new Set(rule.calendarIds);
    return appointments.some(
        (a) =>
            calendars.has(a.calendarId) &&
            now.getTime() >= a.start.getTime() - rule.minutesBefore * 60_000 &&
            now.getTime() < a.end.getTime() + rule.minutesAfter * 60_000,
    );
}

function toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number) as [number, number];
    return h * 60 + m;
}
