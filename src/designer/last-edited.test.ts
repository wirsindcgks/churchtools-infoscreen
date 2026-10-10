import { describe, expect, it } from 'vitest';
import { clockTime, lastEdited, relativeWhen } from './last-edited';

describe('lastEdited', () => {
    it('writes the time in summer time of the church', () => {
        // 12:32 UTC is 14:32 in Berlin in October.
        const edited = lastEdited('2026-10-05T12:32:00Z', 'Anna Beispiel', 'Europe/Berlin');
        expect(edited?.when).toBe('05.10.2026, 14:32');
        expect(edited?.whenTitle).toBe('Zuletzt geändert am 5. Oktober 2026 um 14:32');
        expect(edited?.by).toBe('Anna Beispiel');
        expect(edited?.byTitle).toBe('Zuletzt geändert von Anna Beispiel');
    });

    it('writes the time in winter time of the church', () => {
        expect(lastEdited('2026-12-24T12:32:00Z', null, 'Europe/Berlin')?.when).toBe('24.12.2026, 13:32');
    });

    it('follows the given time zone', () => {
        expect(lastEdited('2026-10-05T12:32:00Z', null, 'America/New_York')?.when).toBe('05.10.2026, 08:32');
    });

    it('keeps the name when the date is invalid or missing', () => {
        for (const at of ['kein Datum', '', null, undefined]) {
            expect(lastEdited(at, 'Anna', 'Europe/Berlin')).toEqual({
                when: null,
                whenTitle: null,
                by: 'Anna',
                byTitle: 'Zuletzt geändert von Anna',
            });
        }
    });

    it('keeps the date when the name is missing', () => {
        for (const by of [null, undefined, '', '  ']) {
            const edited = lastEdited('2026-10-05T12:32:00Z', by, 'Europe/Berlin');
            expect(edited?.when).toBe('05.10.2026, 14:32');
            expect(edited?.by).toBeNull();
            expect(edited?.byTitle).toBeNull();
        }
    });

    it('is null when both are missing', () => {
        expect(lastEdited(null, null, 'Europe/Berlin')).toBeNull();
        expect(lastEdited('kaputt', '', 'Europe/Berlin')).toBeNull();
    });

    it('opens the tooltips with the verb it is given', () => {
        const edited = lastEdited('2026-10-05T12:32:00Z', 'Anna', 'Europe/Berlin', 'Hochgeladen');
        expect(edited?.whenTitle).toBe('Hochgeladen am 5. Oktober 2026 um 14:32');
        expect(edited?.byTitle).toBe('Hochgeladen von Anna');
    });
});

describe('relativeWhen', () => {
    const now = new Date('2026-10-10T10:00:00Z'); // 12:00 in Berlin

    it('says today and yesterday, counted in the time zone', () => {
        expect(relativeWhen('2026-10-10T12:32:00Z', 'Europe/Berlin', now)).toBe('heute 14:32');
        expect(relativeWhen('2026-10-09T12:32:00Z', 'Europe/Berlin', now)).toBe('gestern 14:32');
        // 23:30 UTC on the 9th is already the 10th in Berlin
        expect(relativeWhen('2026-10-09T23:30:00Z', 'Europe/Berlin', now)).toBe('heute 01:30');
        expect(relativeWhen('2026-10-09T23:30:00Z', 'America/New_York', now)).toBe('gestern 19:30');
    });

    it('writes the date otherwise, with the year only when it is another one', () => {
        expect(relativeWhen('2026-10-05T12:32:00Z', 'Europe/Berlin', now)).toBe('05.10., 14:32');
        expect(relativeWhen('2025-12-24T12:32:00Z', 'Europe/Berlin', now)).toBe('24.12.2025, 13:32');
    });

    it('writes the clock time in the time zone', () => {
        expect(clockTime('2026-10-05T12:32:00Z', 'Europe/Berlin')).toBe('14:32');
    });
});
