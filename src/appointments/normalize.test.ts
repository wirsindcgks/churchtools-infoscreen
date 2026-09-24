import { describe, expect, it } from 'vitest';
import { hasFixture, loadFixture } from '../test-support/fixtures';
import { normalizeAppointments, selectUpcoming, type AppointmentResponse } from './normalize';

const BERLIN = 'Europe/Berlin';

function response(
    id: number,
    startDate: string,
    endDate: string,
    extra: Partial<AppointmentResponse['appointment']['base']> = {},
): AppointmentResponse {
    return {
        appointment: {
            base: {
                id,
                title: `Termin ${id}`,
                allDay: false,
                calendar: { id: 2, name: 'Gottesdienst', color: 'black' },
                image: null,
                ...extra,
            },
            calculated: { startDate, endDate },
        },
    };
}

describe('normalizeAppointments', () => {
    it('keeps each occurrence of a series apart and sorts by start', () => {
        const list = normalizeAppointments(
            [
                response(4, '2026-10-11T09:00:00Z', '2026-10-11T10:30:00Z'),
                response(4, '2026-10-04T09:00:00Z', '2026-10-04T10:30:00Z'),
                response(4, '2026-10-04T09:00:00Z', '2026-10-04T10:30:00Z'), // duplicate
            ],
            BERLIN,
        );
        expect(list.map((a) => a.startDate)).toEqual(['2026-10-04', '2026-10-11']);
        expect(new Set(list.map((a) => a.baseId))).toEqual(new Set([4]));
    });

    it('shows local times', () => {
        const [a] = normalizeAppointments([response(1, '2026-10-25T10:00:00Z', '2026-10-25T11:30:00Z')], BERLIN);
        expect([a?.startTime, a?.endTime]).toEqual(['11:00', '12:30']);
    });

    it('marks an evening event that runs past midnight as multi-day', () => {
        const [a] = normalizeAppointments([response(1, '2026-10-02T18:00:00Z', '2026-10-02T23:30:00Z')], BERLIN);
        expect([a?.startDate, a?.endDate, a?.multiDay]).toEqual(['2026-10-02', '2026-10-03', true]);
    });

    it('reads an all-day end at local midnight as exclusive', () => {
        const [a] = normalizeAppointments(
            [response(1, '2026-10-02T22:00:00Z', '2026-10-03T22:00:00Z', { allDay: true })],
            BERLIN,
        );
        expect([a?.startDate, a?.endDate, a?.multiDay, a?.startTime]).toEqual([
            '2026-10-03',
            '2026-10-03',
            false,
            null,
        ]);
    });

    it('accepts date-only all-day values as inclusive local dates', () => {
        const [a] = normalizeAppointments(
            [response(1, '2026-10-03', '2026-10-05', { allDay: true })],
            BERLIN,
        );
        expect([a?.startDate, a?.endDate, a?.multiDay]).toEqual(['2026-10-03', '2026-10-05', true]);
    });

    it('lists all-day entries before timed ones on the same start', () => {
        const list = normalizeAppointments(
            [
                response(1, '2026-10-02T22:00:00Z', '2026-10-02T23:00:00Z'),
                response(2, '2026-10-02T22:00:00Z', '2026-10-03T22:00:00Z', { allDay: true }),
            ],
            BERLIN,
        );
        expect(list.map((a) => a.baseId)).toEqual([2, 1]);
    });

    it('drops entries with unreadable dates', () => {
        expect(normalizeAppointments([response(1, 'bald', 'später')], BERLIN)).toEqual([]);
    });
});

describe('selectUpcoming', () => {
    const list = normalizeAppointments(
        [
            response(1, '2026-10-04T09:00:00Z', '2026-10-04T10:30:00Z'),
            response(2, '2026-10-05T17:00:00Z', '2026-10-05T19:00:00Z', {
                calendar: { id: 4, name: 'Leitung' },
            }),
            response(3, '2026-10-11T09:00:00Z', '2026-10-11T10:30:00Z'),
        ],
        BERLIN,
    );

    it('keeps an appointment that is running right now', () => {
        const now = new Date('2026-10-04T10:00:00Z');
        const result = selectUpcoming(list, { now, timeZone: BERLIN, horizonDays: 1, limit: 10 });
        expect(result.map((a) => a.baseId)).toEqual([1]);
    });

    it('counts the horizon in whole local days', () => {
        const now = new Date('2026-10-04T12:00:00Z');
        const result = selectUpcoming(list, { now, timeZone: BERLIN, horizonDays: 2, limit: 10 });
        expect(result.map((a) => a.baseId)).toEqual([2]);
    });

    it('filters calendars and applies the limit', () => {
        const now = new Date('2026-10-01T00:00:00Z');
        const options = { now, timeZone: BERLIN, horizonDays: 30 };
        expect(selectUpcoming(list, { ...options, limit: 10, calendarIds: [2] }).map((a) => a.baseId)).toEqual([
            1, 3,
        ]);
        expect(selectUpcoming(list, { ...options, limit: 1 }).map((a) => a.baseId)).toEqual([1]);
    });
});

describe.skipIf(!hasFixture('api/appointments-series.json'))('recorded series from the test instance (G19)', () => {
    const recorded = () =>
        normalizeAppointments(
            loadFixture<{ data: AppointmentResponse[] }>('api/appointments-series.json').data,
            BERLIN,
        ).filter((a) => a.baseId === 4);

    it('keeps the service at 11:00 local time across the autumn change', () => {
        const times = new Set(recorded().map((a) => a.startTime));
        expect(times).toEqual(new Set(['11:00']));
    });

    it('leaves out the exception and includes the additional date', () => {
        const dates = recorded().map((a) => a.startDate);
        expect(dates).not.toContain('2026-10-18');
        expect(dates).toContain('2026-11-04');
        expect(dates).toHaveLength(9);
    });

    it('carries the image service address of the series', () => {
        expect(recorded().every((a) => a.imageUrl?.includes('/images/'))).toBe(true);
    });
});
