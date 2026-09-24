import { describe, expect, it } from 'vitest';
import { fontStack, formatDate, formatShortDate, formatTime, sizedImageUrl } from './format';

describe('sizedImageUrl', () => {
    it('always sets both dimensions, because w alone yields a 150 px high image (G14)', () => {
        const url = sizedImageUrl('https://example.church.tools/images/46/abc', 1760.4, 780);
        expect(new URL(url).searchParams.get('w')).toBe('1760');
        expect(new URL(url).searchParams.get('h')).toBe('780');
        expect(new URL(url).searchParams.get('fit')).toBe('max');
    });

    it('leaves non-http addresses alone', () => {
        expect(sizedImageUrl('data:image/png;base64,xyz', 10, 10)).toBe('data:image/png;base64,xyz');
    });
});

describe('German formatting in the instance time zone', () => {
    const service = new Date('2026-10-25T10:00:00Z');

    it('formats time and date for Berlin', () => {
        expect(formatTime(service, 'Europe/Berlin')).toBe('11:00');
        expect(formatDate(service, 'Europe/Berlin')).toBe('Sonntag, 25. Oktober');
        expect(formatShortDate(service, 'Europe/Berlin')).toBe('So., 25.10.');
    });

    it('falls back to the default font for unknown keys', () => {
        expect(fontStack('comic')).toBe(fontStack('sans'));
    });
});
