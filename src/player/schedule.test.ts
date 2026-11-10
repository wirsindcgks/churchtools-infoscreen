import { describe, expect, it } from 'vitest';
import { liveItems, type AgendaEvent, type AgendaFeed, type LivePosition } from '../agenda/live';
import type { Appointment } from '../appointments/normalize';
import { makeScreen } from '../model/testing';
import type { ScreenDoc } from '../model/schema';
import { activePlaylistId, agendaRuleBufferMs, agendaRuleCalendars, matchingRuleIndex } from './schedule';

const START = Date.parse('2026-11-10T10:00:00Z');
const MIN = 60_000;

const appointment = (): Appointment =>
    ({ calendarId: 2, start: new Date(START), end: new Date(START + 60 * MIN) }) as Appointment;

// Two points with a duration (5 and 10 minutes), the last one is the second.
const event: AgendaEvent = {
    eventId: 7,
    calendarId: 2,
    startMs: START,
    endMs: START + 60 * MIN,
    items: liveItems([
        { title: 'Begrüßung', duration: 300 },
        { title: 'Segen', duration: 600 },
    ]),
};

const screenWith = (buffer: number): ScreenDoc =>
    makeScreen({
        defaultPlaylistId: 'standard',
        schedule: [
            {
                kind: 'appointment',
                playlistId: 'gd',
                calendarIds: [2],
                minutesBefore: 30,
                minutesAfter: buffer,
                from: { anchor: 'start', minutes: -30 },
                to: { anchor: 'agendaEnd', minutes: buffer },
            },
        ],
    });

const at = (minutes: number) => new Date(START + minutes * MIN);
const position = (index: number, switchedMinutes: number): LivePosition => ({
    index,
    set: true,
    switchMs: START + switchedMinutes * MIN,
    addSeconds: 0,
    offsetMs: 0,
});
const feed = (positions: AgendaFeed['positions'], events = [event]): AgendaFeed => ({ events, positions });
const run = (minutes: number, agenda?: AgendaFeed, buffer = 30) =>
    matchingRuleIndex(screenWith(buffer), {
        now: at(minutes),
        timeZone: 'Europe/Berlin',
        clockConfirmed: true,
        appointments: [appointment()],
        ...(agenda ? { agenda } : {}),
    });

describe('a rule that ends with the agenda', () => {
    it('ends with the appointment without agenda data (the designer)', () => {
        expect(run(-30)).toBe(0);
        expect(run(59)).toBe(0);
        expect(run(60)).toBe(-1);
    });

    it('ends once the last point with a duration has run out', () => {
        // The second point began at minute 5 and lasts 10 minutes.
        expect(run(14, feed({ 7: position(2, 5) }))).toBe(0);
        expect(run(15, feed({ 7: position(2, 5) }))).toBe(-1);
        expect(run(16, feed({ 7: position(3, 5) }))).toBe(-1);
    });

    it('stays on while the position is before the last point', () => {
        expect(run(40, feed({ 7: position(1, 0) }))).toBe(0);
    });

    it('runs until the end plus the buffer when the event has no agenda', () => {
        expect(run(89, feed({}, []))).toBe(0);
        expect(run(90, feed({}, []))).toBe(-1);
    });

    it('falls back to the end plus the buffer when nobody switches', () => {
        expect(run(89, feed({}))).toBe(0);
        expect(run(90, feed({}))).toBe(-1);
        expect(run(89, feed({ 7: null }))).toBe(0);
    });

    it('picks the default playlist after the end', () => {
        const context = { now: at(20), timeZone: 'Europe/Berlin', clockConfirmed: true, appointments: [appointment()], agenda: feed({ 7: position(2, 5) }) };
        expect(activePlaylistId(screenWith(30), context)).toBe('standard');
        expect(activePlaylistId(screenWith(30), { ...context, now: at(10) })).toBe('gd');
    });

    it('names its calendars and the largest buffer', () => {
        expect(agendaRuleCalendars(screenWith(30))).toEqual([2]);
        expect(agendaRuleBufferMs(screenWith(30))).toBe(30 * MIN);
        expect(agendaRuleCalendars(makeScreen({ schedule: [] }))).toEqual([]);
        expect(agendaRuleBufferMs(makeScreen({ schedule: [] }))).toBe(0);
    });
});
