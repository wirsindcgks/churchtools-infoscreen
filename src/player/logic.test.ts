import { describe, expect, it } from 'vitest';
import { normalizeAppointments } from '../appointments/normalize';
import { makeScreen } from '../model/testing';
import { checkClock } from './clock';
import { activePlaylistId } from './schedule';
import { fitStage } from './stage';
import { backoffDelay, msUntilNightlyReload, TimeoutError, withJitter, withTimeout } from './timing';

const BERLIN = 'Europe/Berlin';

describe('fitStage', () => {
    it('fills a matching viewport exactly', () => {
        expect(fitStage({ width: 3840, height: 2160 }, { width: 1920, height: 1080 })).toEqual({
            scale: 2,
            offsetX: 0,
            offsetY: 0,
        });
    });

    it('letterboxes instead of cropping when the aspect ratio differs', () => {
        const fit = fitStage({ width: 1920, height: 1200 }, { width: 1920, height: 1080 });
        expect(fit.scale).toBe(1);
        expect(fit.offsetY).toBe(60);
    });

    it('shows a portrait stage on a landscape TV without cropping', () => {
        const fit = fitStage({ width: 1920, height: 1080 }, { width: 1080, height: 1920 });
        expect(fit.scale).toBeCloseTo(0.5625);
        expect(fit.offsetX).toBeCloseTo((1920 - 1080 * 0.5625) / 2);
    });

    it('shrinks the stage by the overscan correction on each side', () => {
        const fit = fitStage({ width: 1920, height: 1080 }, { width: 1920, height: 1080 }, 5);
        expect(fit.scale).toBeCloseTo(0.9);
        expect(fit.offsetX).toBeCloseTo(96);
    });
});

describe('activePlaylistId', () => {
    const service = normalizeAppointments(
        [
            {
                appointment: {
                    base: { id: 4, title: 'Gottesdienst', allDay: false, calendar: { id: 2, name: 'Gottesdienst' } },
                    calculated: { startDate: '2026-10-25T10:00:00Z', endDate: '2026-10-25T11:30:00Z' },
                },
            },
        ],
        BERLIN,
    );
    const screen = makeScreen({
        defaultPlaylistId: 'standard',
        schedule: [
            { kind: 'appointment', playlistId: 'vorher', calendarIds: [2], minutesBefore: 30, minutesAfter: 0 },
            { kind: 'time', playlistId: 'mittag', weekdays: [7], from: '11:30', to: '13:00' },
        ],
    });
    const at = (iso: string, clockConfirmed = true) =>
        activePlaylistId(screen, { now: new Date(iso), timeZone: BERLIN, clockConfirmed, appointments: service });

    it('switches 30 minutes before a service, following the appointment', () => {
        expect(at('2026-10-25T09:29:00Z')).toBe('standard');
        expect(at('2026-10-25T09:30:00Z')).toBe('vorher');
    });

    it('lets the earlier rule win on overlap', () => {
        // 12:00 local is inside the service (until 12:30) and inside the time rule.
        expect(at('2026-10-25T11:00:00Z')).toBe('vorher');
        expect(at('2026-10-25T11:45:00Z')).toBe('mittag');
    });

    it('falls back to the default when nothing matches', () => {
        expect(at('2026-10-26T11:45:00Z')).toBe('standard');
    });

    it('never leaves the default while the clock is unconfirmed', () => {
        expect(at('2026-10-25T09:30:00Z', false)).toBe('standard');
    });
});

describe('appointment rules with their own window (schema 1.5)', () => {
    // Service 12:00–13:30 local (10:00–11:30 UTC); how long it really takes varies.
    const service = normalizeAppointments(
        [
            {
                appointment: {
                    base: { id: 4, title: 'Gottesdienst', allDay: false, calendar: { id: 2, name: 'Gottesdienst' } },
                    calculated: { startDate: '2026-10-25T10:00:00Z', endDate: '2026-10-25T11:30:00Z' },
                },
            },
        ],
        BERLIN,
    );
    const screen = makeScreen({
        defaultPlaylistId: 'standard',
        schedule: [
            // Greeting: 30 min before the start until 10 min after it.
            {
                kind: 'appointment',
                playlistId: 'begruessung',
                calendarIds: [2],
                minutesBefore: 30,
                minutesAfter: 0,
                from: { anchor: 'start', minutes: -30 },
                to: { anchor: 'start', minutes: 10 },
            },
            // Farewell: from 75 min after the start – however long the service runs – for half an hour.
            {
                kind: 'appointment',
                playlistId: 'abschied',
                calendarIds: [2],
                minutesBefore: 0,
                minutesAfter: 0,
                from: { anchor: 'start', minutes: 75 },
                to: { anchor: 'start', minutes: 105 },
            },
        ],
    });
    const at = (iso: string) =>
        activePlaylistId(screen, { now: new Date(iso), timeZone: BERLIN, clockConfirmed: true, appointments: service });

    it('greets before the start and stops shortly after it', () => {
        expect(at('2026-10-25T09:29:00Z')).toBe('standard');
        expect(at('2026-10-25T09:30:00Z')).toBe('begruessung');
        expect(at('2026-10-25T10:09:00Z')).toBe('begruessung');
        expect(at('2026-10-25T10:10:00Z')).toBe('standard');
    });

    it('says goodbye a fixed time after the start, not at the end the calendar guesses', () => {
        expect(at('2026-10-25T11:14:00Z')).toBe('standard');
        expect(at('2026-10-25T11:15:00Z')).toBe('abschied');
        expect(at('2026-10-25T11:44:00Z')).toBe('abschied');
        expect(at('2026-10-25T11:45:00Z')).toBe('standard');
    });

    it('reads a rule from before 1.5 as before the start to after the end', () => {
        const old = makeScreen({
            defaultPlaylistId: 'standard',
            schedule: [{ kind: 'appointment', playlistId: 'rund', calendarIds: [2], minutesBefore: 15, minutesAfter: 15 }],
        });
        const run = (iso: string) =>
            activePlaylistId(old, { now: new Date(iso), timeZone: BERLIN, clockConfirmed: true, appointments: service });
        expect(run('2026-10-25T09:45:00Z')).toBe('rund');
        expect(run('2026-10-25T11:44:00Z')).toBe('rund');
        expect(run('2026-10-25T11:45:00Z')).toBe('standard');
    });
});

describe('timing', () => {
    it('spreads intervals by at most 20 percent', () => {
        expect(withJitter(1000, () => 0)).toBe(800);
        expect(withJitter(1000, () => 1)).toBe(1200);
    });

    it('backs off exponentially, capped, and honours Retry-After', () => {
        expect([1, 2, 3].map((n) => backoffDelay(10_000, n))).toEqual([10_000, 20_000, 40_000]);
        expect(backoffDelay(10_000, 20)).toBe(30 * 60_000);
        expect(backoffDelay(10_000, 1, 120_000)).toBe(120_000);
    });

    it('gives up on a request that hangs', async () => {
        await expect(withTimeout(new Promise(() => {}), 10)).rejects.toBeInstanceOf(TimeoutError);
        await expect(withTimeout(Promise.resolve('ok'), 10)).resolves.toBe('ok');
    });

    it('schedules the nightly reload between 03:00 and 04:00 local time', () => {
        const now = new Date(2026, 9, 4, 22, 0);
        const ms = msUntilNightlyReload(now, () => 0.5);
        expect(new Date(now.getTime() + ms).getHours()).toBe(3);
        expect(ms).toBeGreaterThan(0);
    });
});

describe('checkClock', () => {
    it('confirms a clock close to the server', () => {
        expect(checkClock('Sun, 04 Oct 2026 09:00:30 GMT', new Date('2026-10-04T09:00:00Z')).confirmed).toBe(true);
    });

    it('rejects a clock stuck at the last shutdown', () => {
        const state = checkClock('Sun, 04 Oct 2026 09:00:00 GMT', new Date('2026-10-01T22:14:00Z'));
        expect(state.confirmed).toBe(false);
        expect(state.skewMs).toBeGreaterThan(0);
    });

    it('stays unconfirmed without a Date header', () => {
        expect(checkClock(null, new Date()).confirmed).toBe(false);
    });
});
