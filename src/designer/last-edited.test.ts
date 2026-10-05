import { describe, expect, it } from 'vitest';
import { lastEdited } from './last-edited';

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
