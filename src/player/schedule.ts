/**
 * Which playlist runs now (Plan.md, Playlists und Zeitpläne). The player
 * decides this itself so that it keeps working offline.
 */
import type { Appointment } from '../appointments/normalize';
import { zonedParts } from '../appointments/zoned';
import type { AppointmentPoint, ScreenDoc } from '../model/schema';

export interface ScheduleContext {
    now: Date;
    timeZone: string;
    /** Until the device clock is confirmed against the server, only the default runs. */
    clockConfirmed: boolean;
    appointments: Appointment[];
}

export function activePlaylistId(screen: ScreenDoc, context: ScheduleContext): string {
    const index = matchingRuleIndex(screen, context);
    return index < 0 ? screen.defaultPlaylistId : screen.schedule[index]!.playlistId;
}

/** The rule that decides now, or -1 when the default playlist runs. */
export function matchingRuleIndex(screen: ScreenDoc, context: ScheduleContext): number {
    if (!context.clockConfirmed) return -1;
    // Earlier rules win on overlap – a fixed order, not the accident of JSON order.
    return screen.schedule.findIndex(
        (rule) =>
            (rule.kind === 'time' && matchesTimeRule(rule, context)) ||
            (rule.kind === 'appointment' && matchesAppointmentRule(rule, context)),
    );
}

type TimeRule = Extract<ScreenDoc['schedule'][number], { kind: 'time' }>;
type AppointmentRule = Extract<ScreenDoc['schedule'][number], { kind: 'appointment' }>;

function matchesTimeRule(rule: TimeRule, { now, timeZone }: ScheduleContext): boolean {
    const p = zonedParts(now, timeZone);
    if (!rule.weekdays.includes(p.weekday)) return false;
    const minute = p.hour * 60 + p.minute;
    return minute >= toMinutes(rule.from) && minute < toMinutes(rule.to);
}

/**
 * Where an appointment rule's window begins and ends. Rules from before
 * schema 1.5 run from `minutesBefore` the start to `minutesAfter` the end.
 */
export function ruleWindow(rule: AppointmentRule): { from: AppointmentPoint; to: AppointmentPoint } {
    return {
        from: rule.from ?? { anchor: 'start', minutes: -rule.minutesBefore },
        to: rule.to ?? { anchor: 'end', minutes: rule.minutesAfter },
    };
}

function instant(point: AppointmentPoint, appointment: { start: Date; end: Date }): number {
    return (point.anchor === 'start' ? appointment.start : appointment.end).getTime() + point.minutes * 60_000;
}

function matchesAppointmentRule(rule: AppointmentRule, { now, appointments }: ScheduleContext): boolean {
    const calendars = new Set(rule.calendarIds);
    const { from, to } = ruleWindow(rule);
    return appointments.some(
        (a) => calendars.has(a.calendarId) && now.getTime() >= instant(from, a) && now.getTime() < instant(to, a),
    );
}

function toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number) as [number, number];
    return h * 60 + m;
}
