import { describe, expect, it } from 'vitest';
import { startOfZonedDay, zonedDateKey, zonedParts, zonedTimeKey, zonedTimeToInstant } from './zoned';

const BERLIN = 'Europe/Berlin';

describe('zoned time in Europe/Berlin', () => {
    it('shows 11:00 before and after the autumn change, as ChurchTools stores it (G19)', () => {
        expect(zonedTimeKey(new Date('2026-10-11T09:00:00Z'), BERLIN)).toBe('11:00');
        expect(zonedTimeKey(new Date('2026-10-25T10:00:00Z'), BERLIN)).toBe('11:00');
    });

    it('converts local time to UTC with the offset valid on that day', () => {
        expect(zonedTimeToInstant({ year: 2026, month: 10, day: 11, hour: 11 }, BERLIN).toISOString()).toBe(
            '2026-10-11T09:00:00.000Z',
        );
        expect(zonedTimeToInstant({ year: 2026, month: 10, day: 25, hour: 11 }, BERLIN).toISOString()).toBe(
            '2026-10-25T10:00:00.000Z',
        );
    });

    it('resolves a wall time skipped in spring to the first instant after the gap', () => {
        // 2027-03-28 02:30 does not exist in Berlin; clocks jump from 02:00 to 03:00.
        const instant = zonedTimeToInstant({ year: 2027, month: 3, day: 28, hour: 2, minute: 30 }, BERLIN);
        expect(zonedTimeKey(instant, BERLIN)).toBe('03:30');
    });

    it('finds the local midnight on the day of the change (23 or 25 hours long)', () => {
        const start = startOfZonedDay(new Date('2026-10-25T12:00:00Z'), BERLIN);
        const next = startOfZonedDay(new Date('2026-10-25T12:00:00Z'), BERLIN, 1);
        expect(start.toISOString()).toBe('2026-10-24T22:00:00.000Z');
        expect(next.toISOString()).toBe('2026-10-25T23:00:00.000Z');
        expect((next.getTime() - start.getTime()) / 3_600_000).toBe(25);
    });

    it('uses the local date, not the UTC date, around midnight', () => {
        expect(zonedDateKey(new Date('2026-12-31T23:30:00Z'), BERLIN)).toBe('2027-01-01');
    });

    it('reports ISO weekdays', () => {
        expect(zonedParts(new Date('2026-10-04T09:00:00Z'), BERLIN).weekday).toBe(7); // Sunday
    });

    it('works for any IANA zone ChurchTools reports', () => {
        expect(zonedTimeKey(new Date('2026-10-04T09:00:00Z'), 'America/New_York')).toBe('05:00');
    });
});
