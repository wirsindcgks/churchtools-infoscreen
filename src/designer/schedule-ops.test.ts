import { describe, expect, it } from 'vitest';
import type { Appointment } from '../appointments/normalize';
import { zonedTimeToInstant } from '../appointments/zoned';
import { makePlaylist, makeScreen } from '../model/testing';
import type { AppointmentPoint } from '../model/schema';
import {
    createAppointmentRule,
    createTimeRule,
    dayTimeline,
    ruleSummary,
    scheduleProblems,
    weekdaysLabel,
    windowPatch,
} from './schedule-ops';

const TZ = 'Europe/Berlin';
// 2026-09-27 is a Sunday.
const SUNDAY = { year: 2026, month: 9, day: 27 };

function appointment(start: Date, end: Date, calendarId = 3): Appointment {
    return {
        key: 'a',
        baseId: 1,
        calendarId,
        calendarName: 'Gottesdienste',
        color: null,
        title: 'Gottesdienst',
        subtitle: '',
        start,
        end,
        allDay: false,
        startDate: '2026-09-27',
        endDate: '2026-09-27',
        startTime: null,
        endTime: null,
        multiDay: false,
        imageUrl: null,
    };
}

describe('scheduleProblems', () => {
    const playlists = [makePlaylist({ id: 'standard' }), makePlaylist({ id: 'gd', name: 'Gottesdienst' })];

    it('accepts a sound schedule', () => {
        const screen = makeScreen({ defaultPlaylistId: 'standard', schedule: [createTimeRule('gd')] });
        expect(scheduleProblems(screen, playlists)).toEqual([]);
    });

    it('names each rule that could never switch', () => {
        const screen = makeScreen({
            defaultPlaylistId: 'standard',
            schedule: [
                { kind: 'time', playlistId: 'gd', weekdays: [], from: '09:00', to: '12:00' },
                { kind: 'time', playlistId: 'gd', weekdays: [7], from: '22:00', to: '02:00' },
                { kind: 'appointment', playlistId: 'weg', calendarIds: [], minutesBefore: 0, minutesAfter: 0 },
            ],
        });
        const problems = scheduleProblems(screen, playlists);
        expect(problems).toEqual([
            'Regel 1: mindestens einen Wochentag wählen.',
            'Regel 2: „bis" muss nach „von" liegen – über Mitternacht zwei Regeln anlegen.',
            'Regel 3: Die Playlist gibt es nicht mehr.',
            'Regel 3: mindestens einen Kalender wählen.',
        ]);
    });
});

describe('scheduleProblems and formats (schema 1.4)', () => {
    it('refuses a playlist designed for another format than the screen', () => {
        const playlists = [
            makePlaylist({ id: 'quer', stage: { width: 1920, height: 1080 } }),
            makePlaylist({ id: 'hoch', stage: { width: 1080, height: 1920 } }),
        ];
        const screen = makeScreen({ defaultPlaylistId: 'hoch', schedule: [createTimeRule('hoch')] });
        expect(scheduleProblems(screen, playlists)).toEqual([
            'Die Standard-Playlist hat ein anderes Format als der Screen.',
            'Regel 1: Die Playlist hat ein anderes Format als der Screen.',
        ]);
        expect(scheduleProblems({ ...screen, defaultPlaylistId: 'quer', schedule: [] }, playlists)).toEqual([]);
    });
});

describe('dayTimeline', () => {
    it('shows a time rule as its own stretch of the day', () => {
        const screen = makeScreen({ defaultPlaylistId: 'standard', schedule: [createTimeRule('gd')] });
        expect(dayTimeline(screen, SUNDAY, TZ, [])).toEqual([
            { start: 0, end: 540, playlistId: 'standard', ruleIndex: -1 },
            { start: 540, end: 720, playlistId: 'gd', ruleIndex: 0 },
            { start: 720, end: 1440, playlistId: 'standard', ruleIndex: -1 },
        ]);
        expect(dayTimeline(screen, { ...SUNDAY, day: 28 }, TZ, [])).toHaveLength(1); // Monday
    });

    it('lets the upper rule win and follows the appointment it is bound to', () => {
        const service = appointment(
            zonedTimeToInstant({ ...SUNDAY, hour: 10 }, TZ),
            zonedTimeToInstant({ ...SUNDAY, hour: 11, minute: 30 }, TZ),
        );
        const screen = makeScreen({
            defaultPlaylistId: 'standard',
            schedule: [
                { kind: 'appointment', playlistId: 'gd', calendarIds: [3], minutesBefore: 30, minutesAfter: 30 },
                { kind: 'time', playlistId: 'abend', weekdays: [7], from: '11:00', to: '20:00' },
            ],
        });
        expect(dayTimeline(screen, SUNDAY, TZ, [service])).toEqual([
            { start: 0, end: 570, playlistId: 'standard', ruleIndex: -1 },
            { start: 570, end: 720, playlistId: 'gd', ruleIndex: 0 },
            { start: 720, end: 1200, playlistId: 'abend', ruleIndex: 1 },
            { start: 1200, end: 1440, playlistId: 'standard', ruleIndex: -1 },
        ]);
    });
});

describe('rules in words', () => {
    it('names runs of days the way people say them', () => {
        expect(weekdaysLabel([1, 2, 3, 4, 5])).toBe('Mo–Fr');
        expect(weekdaysLabel([6, 7])).toBe('Sa, So');
        expect(weekdaysLabel([1, 3, 4, 5, 7])).toBe('Mo, Mi–Fr, So');
        expect(weekdaysLabel([1, 2, 3, 4, 5, 6, 7])).toBe('täglich');
    });

    it('sums up a rule in one line', () => {
        const names = (id: number) => ({ 3: 'Gottesdienste', 4: 'Jugend' })[id] ?? `Kalender ${id}`;
        expect(ruleSummary(createTimeRule('gd'), names)).toBe('So 09:00–12:00');
        expect(
            ruleSummary({ kind: 'appointment', playlistId: 'gd', calendarIds: [3, 4], minutesBefore: 30, minutesAfter: 15 }, names),
        ).toBe('30 Min. vor Beginn bis 15 Min. nach Ende von Terminen in Gottesdienste, Jugend');
        const farewell = { ...createAppointmentRule('gd', [3]), ...windowPatch({ anchor: 'start', minutes: 75 }, { anchor: 'end', minutes: 0 }) };
        expect(ruleSummary(farewell, names)).toBe('75 Min. nach Beginn bis Ende von Terminen in Gottesdienste');
    });

    it('keeps the nearest old-style window for players older than 1.5', () => {
        expect(windowPatch({ anchor: 'start', minutes: -30 }, { anchor: 'start', minutes: 10 })).toMatchObject({
            minutesBefore: 30,
            minutesAfter: 0,
        });
        expect(windowPatch({ anchor: 'end', minutes: -5 }, { anchor: 'end', minutes: 20 })).toMatchObject({
            minutesBefore: 0,
            minutesAfter: 20,
        });
    });

    it('refuses a window that can never open', () => {
        const playlists = [makePlaylist({ id: 'standard' }), makePlaylist({ id: 'gd' })];
        const rule = (from: AppointmentPoint, to: AppointmentPoint) => ({ ...createAppointmentRule('gd', [3]), ...windowPatch(from, to) });
        const screen = makeScreen({
            defaultPlaylistId: 'standard',
            schedule: [
                rule({ anchor: 'start', minutes: 10 }, { anchor: 'start', minutes: -30 }),
                rule({ anchor: 'end', minutes: 0 }, { anchor: 'start', minutes: 30 }),
                rule({ anchor: 'start', minutes: 75 }, { anchor: 'end', minutes: 0 }),
            ],
        });
        expect(scheduleProblems(screen, playlists)).toEqual([
            'Regel 1: „bis" muss nach „von" liegen.',
            'Regel 2: „bis" muss nach „von" liegen.',
        ]);
    });
});
