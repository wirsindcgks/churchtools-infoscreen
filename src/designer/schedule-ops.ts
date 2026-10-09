/**
 * The designers' schedule (Plan.md, Nächste Schritte 17): new rules, what
 * keeps a schedule from being saved, and which playlist runs over a day –
 * evaluated with the player's own rule matching, so the preview cannot
 * disagree with the TV.
 */
import type { Appointment } from '../appointments/normalize';
import { zonedParts, zonedTimeToInstant } from '../appointments/zoned';
import { t } from '../i18n/designer';
import { sameStage, type AppointmentPoint, type PlaylistDoc, type ScheduleRule, type ScreenDoc } from '../model/schema';
import { matchingRuleIndex, ruleWindow } from '../player/schedule';

export type TimeRule = Extract<ScheduleRule, { kind: 'time' }>;
export type AppointmentRule = Extract<ScheduleRule, { kind: 'appointment' }>;

/** ISO weekdays, 1 = Monday – the order the rules store them in. */
export const WEEKDAYS: readonly { day: number; short: string; long: string }[] = t.schedules.weekdays.map(([short, long], index) => ({
    day: index + 1,
    short,
    long,
}));

export function createTimeRule(playlistId: string): TimeRule {
    return { kind: 'time', playlistId, weekdays: [7], from: '09:00', to: '12:00' };
}

export function createAppointmentRule(playlistId: string, calendarIds: number[]): AppointmentRule {
    return {
        kind: 'appointment',
        playlistId,
        calendarIds: [...calendarIds],
        // Around the appointment, as rules were before 1.5; the presets offer the others.
        ...windowPatch(WINDOW_PRESETS[3].from, WINDOW_PRESETS[3].to),
    };
}

/** Common windows around an appointment, as one click each (Plan.md, 22). */
export const WINDOW_PRESETS = [
    { key: 'before', label: t.schedules.presets.before, from: { anchor: 'start', minutes: -30 }, to: { anchor: 'start', minutes: 0 } },
    { key: 'during', label: t.schedules.presets.during, from: { anchor: 'start', minutes: 0 }, to: { anchor: 'end', minutes: 0 } },
    { key: 'after', label: t.schedules.presets.after, from: { anchor: 'end', minutes: 0 }, to: { anchor: 'end', minutes: 30 } },
    { key: 'around', label: t.schedules.presets.around, from: { anchor: 'start', minutes: -30 }, to: { anchor: 'end', minutes: 15 } },
] as const satisfies readonly { key: string; label: string; from: AppointmentPoint; to: AppointmentPoint }[];

/**
 * The fields of an appointment rule for a window: `from` and `to` (schema
 * 1.5), and the nearest window a player older than 1.5 understands –
 * before the start to after the end – until it reloads the new version.
 */
export function windowPatch(
    from: AppointmentPoint,
    to: AppointmentPoint,
): Pick<AppointmentRule, 'from' | 'to' | 'minutesBefore' | 'minutesAfter'> {
    return {
        from: { ...from },
        to: { ...to },
        minutesBefore: from.anchor === 'start' ? Math.max(0, -from.minutes) : 0,
        minutesAfter: to.anchor === 'end' ? Math.max(0, to.minutes) : 0,
    };
}

/** "30 Min. vor Beginn", "Ende", "75 Min. nach Beginn". */
export function pointLabel(point: AppointmentPoint): string {
    const anchor = point.anchor === 'start' ? t.common.point.start : t.common.point.end;
    if (point.minutes === 0) return anchor;
    return t.schedules.pointOffset(Math.abs(point.minutes), point.minutes < 0, anchor);
}

/** Whether a window can never open: its end lies before its beginning for any appointment. */
function windowEmpty(from: AppointmentPoint, to: AppointmentPoint): boolean {
    if (from.anchor === to.anchor) return to.minutes <= from.minutes;
    // From an end-relative point to a start-relative one: open only for appointments shorter than the gap.
    return from.anchor === 'end' && to.anchor === 'start';
}

export function toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number) as [number, number];
    return h * 60 + m;
}

export function fromMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    return `${String(h).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * What keeps the schedule from being saved, in words a designer can act on.
 * A playlist designed for another format than the screen's would be cut or
 * letterboxed, so it counts as a problem too.
 */
export function scheduleProblems(screen: ScreenDoc, playlists: PlaylistDoc[]): string[] {
    const known = new Map(playlists.map((p) => [p.id, p]));
    const fits = (id: string) => {
        const stage = known.get(id)?.stage;
        return !stage || sameStage(stage, screen.stage);
    };
    const problems: string[] = [];
    if (!known.has(screen.defaultPlaylistId)) problems.push(t.schedules.problems.defaultMissing);
    else if (!fits(screen.defaultPlaylistId)) problems.push(t.schedules.problems.defaultOtherFormat);
    screen.schedule.forEach((rule, index) => {
        const label = t.schedules.rule(index + 1);
        if (!known.has(rule.playlistId)) problems.push(t.schedules.problems.playlistGone(label));
        else if (!fits(rule.playlistId)) problems.push(t.schedules.problems.otherFormat(label));
        if (rule.kind === 'time') {
            if (!rule.weekdays.length) problems.push(t.schedules.problems.noWeekday(label));
            if (!/^\d{2}:\d{2}$/.test(rule.from) || !/^\d{2}:\d{2}$/.test(rule.to)) {
                problems.push(t.schedules.problems.timeFormat(label));
            } else if (toMinutes(rule.to) <= toMinutes(rule.from)) {
                problems.push(t.schedules.problems.timeOrder(label));
            }
        } else {
            if (!rule.calendarIds.length) problems.push(t.schedules.problems.noCalendar(label));
            const { from, to } = ruleWindow(rule);
            if (windowEmpty(from, to)) problems.push(t.schedules.problems.windowOrder(label));
        }
    });
    return [...new Set(problems)];
}

/** One stretch of a day during which the same playlist runs. */
export interface DaySegment {
    /** Minutes after local midnight; `end` is exclusive. */
    start: number;
    end: number;
    playlistId: string;
    /** The deciding rule, -1 for the default playlist. */
    ruleIndex: number;
}

/**
 * Which playlist runs over one local day, sampled every `step` minutes – a
 * rule shorter than a step can be missed, which suits a preview strip.
 */
export function dayTimeline(
    screen: ScreenDoc,
    date: { year: number; month: number; day: number },
    timeZone: string,
    appointments: Appointment[],
    step = 15,
): DaySegment[] {
    const segments: DaySegment[] = [];
    for (let minute = 0; minute < 24 * 60; minute += step) {
        const now = zonedTimeToInstant({ ...date, hour: Math.floor(minute / 60), minute: minute % 60 }, timeZone);
        const ruleIndex = matchingRuleIndex(screen, { now, timeZone, clockConfirmed: true, appointments });
        const playlistId = ruleIndex < 0 ? screen.defaultPlaylistId : screen.schedule[ruleIndex]!.playlistId;
        const last = segments.at(-1);
        if (last && last.ruleIndex === ruleIndex && last.playlistId === playlistId) last.end = minute + step;
        else segments.push({ start: minute, end: minute + step, playlistId, ruleIndex });
    }
    return segments;
}

/** One local day of a week strip: its date, ISO weekday (1 = Monday) and what runs over it. */
export interface WeekDay {
    date: { year: number; month: number; day: number };
    weekday: number;
    segments: DaySegment[];
}

/**
 * `dayTimeline` for `days` consecutive local days from `start` (day 0). The days are counted on the
 * calendar and each resolved in the zone on its own, so a daylight saving change inside the week
 * cannot shift a later day.
 */
export function weekTimeline(
    screen: ScreenDoc,
    start: { year: number; month: number; day: number },
    days: number,
    timeZone: string,
    appointments: Appointment[],
): WeekDay[] {
    return Array.from({ length: days }, (_, offset) => {
        // Date.UTC normalizes day overflow, so adding days across month ends is safe.
        const counted = new Date(Date.UTC(start.year, start.month - 1, start.day + offset));
        const date = { year: counted.getUTCFullYear(), month: counted.getUTCMonth() + 1, day: counted.getUTCDate() };
        const weekday = zonedParts(zonedTimeToInstant({ ...date, hour: 12 }, timeZone), timeZone).weekday;
        return { date, weekday, segments: dayTimeline(screen, date, timeZone, appointments) };
    });
}

/** Colors for the playlists of a schedule, shared by the dialog and the schedules page. */
export const PALETTE = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2', '#65a30d', '#dc2626'];

/**
 * A color per playlist: the default first, then the rules' playlists in order, each once, wrapping
 * around the palette. Playlists outside `existing` (when given) take no color and no place in the order.
 */
export function playlistColors(
    defaultPlaylistId: string,
    rules: readonly { playlistId: string }[],
    existing?: ReadonlySet<string>,
): Map<string, string> {
    const ids = [...new Set([defaultPlaylistId, ...rules.map((r) => r.playlistId)])].filter((id) => !existing || existing.has(id));
    return new Map(ids.map((id, index) => [id, PALETTE[index % PALETTE.length]!]));
}

/** "Mo–Fr", "Sa, So", "täglich" – how the schedules page names the days of a rule. */
export function weekdaysLabel(days: readonly number[]): string {
    const sorted = [...new Set(days)].sort((a, b) => a - b);
    if (!sorted.length) return t.schedules.noDays;
    if (sorted.length === 7) return t.schedules.daily;
    const runs: number[][] = [];
    for (const day of sorted) {
        const run = runs.at(-1);
        if (run && run.at(-1) === day - 1) run.push(day);
        else runs.push([day]);
    }
    const short = (day: number) => WEEKDAYS[day - 1]!.short;
    return runs
        .map((run) => (run.length >= 3 ? `${short(run[0]!)}–${short(run.at(-1)!)}` : run.map(short).join(', ')))
        .join(', ');
}

/** A rule in one line: "So 09:00–12:00" or "30 Min. vor Beginn bis 10 Min. nach Beginn von Terminen in Gottesdienste". */
export function ruleSummary(rule: ScheduleRule, calendarName: (id: number) => string): string {
    if (rule.kind === 'time') return `${weekdaysLabel(rule.weekdays)} ${rule.from}–${rule.to}`;
    const calendars = rule.calendarIds.map(calendarName).join(', ');
    const { from, to } = ruleWindow(rule);
    return t.schedules.appointmentSummary(pointLabel(from), pointLabel(to), calendars);
}
