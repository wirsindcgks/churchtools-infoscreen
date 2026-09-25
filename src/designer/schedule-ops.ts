/**
 * The designers' schedule (Plan.md, Nächste Schritte 17): new rules, what
 * keeps a schedule from being saved, and which playlist runs over a day –
 * evaluated with the player's own rule matching, so the preview cannot
 * disagree with the TV.
 */
import type { Appointment } from '../appointments/normalize';
import { zonedTimeToInstant } from '../appointments/zoned';
import type { PlaylistDoc, ScheduleRule, ScreenDoc } from '../model/schema';
import { matchingRuleIndex } from '../player/schedule';

export type TimeRule = Extract<ScheduleRule, { kind: 'time' }>;
export type AppointmentRule = Extract<ScheduleRule, { kind: 'appointment' }>;

/** ISO weekdays, 1 = Monday – the order the rules store them in. */
export const WEEKDAYS = [
    { day: 1, short: 'Mo', long: 'Montag' },
    { day: 2, short: 'Di', long: 'Dienstag' },
    { day: 3, short: 'Mi', long: 'Mittwoch' },
    { day: 4, short: 'Do', long: 'Donnerstag' },
    { day: 5, short: 'Fr', long: 'Freitag' },
    { day: 6, short: 'Sa', long: 'Samstag' },
    { day: 7, short: 'So', long: 'Sonntag' },
] as const;

export function createTimeRule(playlistId: string): TimeRule {
    return { kind: 'time', playlistId, weekdays: [7], from: '09:00', to: '12:00' };
}

export function createAppointmentRule(playlistId: string, calendarIds: number[]): AppointmentRule {
    return { kind: 'appointment', playlistId, calendarIds: [...calendarIds], minutesBefore: 30, minutesAfter: 15 };
}

export function toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number) as [number, number];
    return h * 60 + m;
}

export function fromMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    return `${String(h).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** What keeps the schedule from being saved, in words a designer can act on. */
export function scheduleProblems(screen: ScreenDoc, playlists: PlaylistDoc[]): string[] {
    const known = new Set(playlists.map((p) => p.id));
    const problems: string[] = [];
    if (!known.has(screen.defaultPlaylistId)) problems.push('Die Standard-Playlist fehlt.');
    screen.schedule.forEach((rule, index) => {
        const label = `Regel ${index + 1}`;
        if (!known.has(rule.playlistId)) problems.push(`${label}: Die Playlist gibt es nicht mehr.`);
        if (rule.kind === 'time') {
            if (!rule.weekdays.length) problems.push(`${label}: mindestens einen Wochentag wählen.`);
            if (!/^\d{2}:\d{2}$/.test(rule.from) || !/^\d{2}:\d{2}$/.test(rule.to)) {
                problems.push(`${label}: Uhrzeiten als SS:MM angeben.`);
            } else if (toMinutes(rule.to) <= toMinutes(rule.from)) {
                problems.push(`${label}: „bis" muss nach „von" liegen – über Mitternacht zwei Regeln anlegen.`);
            }
        } else if (!rule.calendarIds.length) {
            problems.push(`${label}: mindestens einen Kalender wählen.`);
        }
    });
    for (const p of playlists) {
        if (!p.name.trim()) problems.push('Jede Playlist braucht einen Namen.');
    }
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
