import { describe, expect, it } from 'vitest';
import { liveItems, type AgendaEvent, type AgendaFeed, type LivePosition } from '../agenda/live';
import type { Appointment } from '../appointments/normalize';
import { makeScreen } from '../model/testing';
import type { ScreenDoc } from '../model/schema';
import type { OverrideDoc } from '../agenda/control';
import { activeOverride, activePlaylistId, agendaRuleBufferMs, agendaRuleCalendars, matchingRuleIndex, OVERRIDE_MAX_MS, type ScheduleContext } from './schedule';

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

describe('an override by the musicians (Plan.md 125 B)', () => {
    const release = { screenIds: ['screen-1'], playlistIds: ['probe'] };
    const doc = (overrides: Partial<OverrideDoc> = {}): OverrideDoc => ({
        kind: 'override',
        screenId: 'screen-1',
        playlistId: 'probe',
        at: at(-10).toISOString(),
        until: at(110).toISOString(),
        ...overrides,
    });
    const rule = (kind: 'appointment' | 'time'): ScreenDoc['schedule'][number] =>
        kind === 'appointment'
            ? ({ kind, playlistId: 'gd', calendarIds: [2], minutesBefore: 30, minutesAfter: 0, from: { anchor: 'start', minutes: -30 }, to: { anchor: 'end', minutes: 0 } })
            : ({ kind, playlistId: 'gd', weekdays: [1, 2, 3, 4, 5, 6, 7], from: '00:00', to: '23:59' });
    const screen = (...rules: ScreenDoc['schedule']) => makeScreen({ defaultPlaylistId: 'standard', schedule: rules });
    const ctx = (minutes: number, overrides: Partial<ScheduleContext> = {}): ScheduleContext => ({
        now: at(minutes),
        timeZone: 'Europe/Berlin',
        clockConfirmed: true,
        appointments: [appointment()],
        ...overrides,
    });
    const id = (s: ScreenDoc, d: OverrideDoc | null | undefined, minutes: number, rel = release, extra: Partial<ScheduleContext> = {}) =>
        activePlaylistId(s, ctx(minutes, { override: { doc: d, release: rel }, ...extra }));

    it('applies when everything fits', () => {
        expect(id(screen(), doc(), 0)).toBe('probe');
        expect(activeOverride(screen(), doc(), release, ctx(0))).toEqual(doc());
    });
    it('does not apply without confirmed clock, release, or matching screen and presentation', () => {
        expect(id(screen(), doc(), 0, release, { clockConfirmed: false })).toBe('standard');
        expect(id(screen(), doc(), 0, { screenIds: [], playlistIds: ['probe'] })).toBe('standard');
        expect(id(screen(), doc(), 0, { screenIds: ['screen-1'], playlistIds: ['other'] })).toBe('standard');
        expect(id(screen(), doc({ screenId: 'screen-2' }), 0)).toBe('standard');
        expect(id(screen(), doc({ ended: true, playlistId: '' }), 0)).toBe('standard');
        expect(id(screen(), null, 0)).toBe('standard');
        expect(id(screen(), undefined, 0)).toBe('standard');
    });
    it('ends with `until`, at the latest after four hours', () => {
        expect(id(screen(), doc(), 109)).toBe('probe');
        expect(id(screen(), doc(), 110)).toBe('standard');
        const long = doc({ until: at(24 * 60).toISOString() });
        const limit = (OVERRIDE_MAX_MS - 10 * MIN) / MIN;
        expect(id(screen(), long, limit - 1)).toBe('probe');
        expect(id(screen(), long, limit)).toBe('standard');
    });
    it('does not apply when the choice lies more than five minutes in the future', () => {
        expect(id(screen(), doc({ at: at(10).toISOString() }), 0)).toBe('standard');
        expect(id(screen(), doc({ at: at(4).toISOString() }), 0)).toBe('probe');
    });
    it('is ended for good by an appointment rule whose window began after the choice', () => {
        const s = screen(rule('time'), rule('appointment'));
        // window begins at -30 min of the appointment (START - 30 min = at(-30))
        expect(id(s, doc({ at: at(-40).toISOString() }), 0)).toBe('gd'); // time rule matches first, but the override is gone
        expect(id(s, doc({ at: at(-40).toISOString() }), 100)).toBe('gd');
        expect(id(screen(rule('appointment')), doc({ at: at(-30).toISOString() }), 0)).toBe('probe'); // began exactly at `at`
        expect(id(screen(rule('appointment')), doc({ at: at(-20).toISOString() }), 0)).toBe('probe');
        // does not come back after the window ended
        expect(id(screen(rule('appointment')), doc({ at: at(-40).toISOString(), until: at(500).toISOString() }), 200)).toBe('standard');
    });
    it('is not ended by a time rule', () => {
        expect(id(screen(rule('time')), doc(), 0)).toBe('probe');
    });
    it('changes nothing without an override in the context', () => {
        expect(activePlaylistId(screen(), ctx(0))).toBe('standard');
    });
});
