/**
 * Which playlist runs now (Plan.md, Playlists und Zeitpläne). The player
 * decides this itself so that it keeps working offline.
 */
import type { Appointment } from '../appointments/normalize';
import { zonedParts } from '../appointments/zoned';
import { endReached, serverNow, type AgendaFeed } from '../agenda/live';
import type { AppointmentEndPoint, AppointmentPoint, ScreenDoc } from '../model/schema';

export interface ScheduleContext {
    now: Date;
    timeZone: string;
    /** Until the device clock is confirmed against the server, only the default runs. */
    clockConfirmed: boolean;
    appointments: Appointment[];
    /**
     * The agendas and positions read by the player (Plan.md 118). Without it – the designer's preview – a rule "Ende des Ablaufs"
     * ends with the appointment.
     */
    agenda?: AgendaFeed;
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
export function ruleWindow(rule: AppointmentRule): { from: AppointmentPoint; to: AppointmentEndPoint } {
    return {
        from: rule.from ?? { anchor: 'start', minutes: -rule.minutesBefore },
        to: rule.to ?? { anchor: 'end', minutes: rule.minutesAfter },
    };
}

function instant(point: AppointmentEndPoint, appointment: { start: Date; end: Date }): number {
    return (point.anchor === 'start' ? appointment.start : appointment.end).getTime() + point.minutes * 60_000;
}

/** Whether the end of a rule's window has not come yet for this appointment. */
function beforeEnd(to: AppointmentEndPoint, appointment: Appointment, { now, agenda }: ScheduleContext): boolean {
    const nowMs = now.getTime();
    if (to.anchor !== 'agendaEnd') return nowMs < instant(to, appointment);
    const bufferMs = Math.max(0, to.minutes) * 60_000;
    if (!agenda) return nowMs < appointment.end.getTime();
    const event = agenda.events.find((e) => e.calendarId === appointment.calendarId && e.startMs === appointment.start.getTime());
    if (!event) return nowMs < appointment.end.getTime() + bufferMs;
    const position = agenda.positions[event.eventId] ?? undefined;
    return !endReached(event, position, serverNow(nowMs, position), bufferMs);
}

function matchesAppointmentRule(rule: AppointmentRule, context: ScheduleContext): boolean {
    const calendars = new Set(rule.calendarIds);
    const { from, to } = ruleWindow(rule);
    return context.appointments.some(
        (a) => calendars.has(a.calendarId) && context.now.getTime() >= instant(from, a) && beforeEnd(to, a, context),
    );
}

function toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number) as [number, number];
    return h * 60 + m;
}

/** The agenda-ended rules of a screen: the appointment rules whose end is the end of the live agenda. */
function agendaRules(screen: ScreenDoc) {
    return screen.schedule.flatMap((rule) => (rule.kind === 'appointment' && rule.to?.anchor === 'agendaEnd' ? [{ rule, to: rule.to }] : []));
}

/** The calendars of the rules that end with the live agenda, each once and sorted (Plan.md 118). */
export function agendaRuleCalendars(screen: ScreenDoc): number[] {
    return [...new Set(agendaRules(screen).flatMap(({ rule }) => rule.calendarIds))].sort((a, b) => a - b);
}

/** The largest buffer (ms) of those rules; 0 without any. */
export function agendaRuleBufferMs(screen: ScreenDoc): number {
    return Math.max(0, ...agendaRules(screen).map(({ to }) => Math.max(0, to.minutes) * 60_000));
}
