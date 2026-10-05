import { describe, expect, it } from 'vitest';
import type { TextStyle } from '../model/schema';
import { textStyle, calendarColor, formatDate, formatShortDate, formatTime, servicesLine, sizedImageUrl, WIDEST_DATE, textOn } from './format';

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
});

describe('calendarColor', () => {
    it('passes CSS colour names on as they are, like the WordPress plugin', () => {
        expect(calendarColor('black')).toBe('black');
        expect(calendarColor(' Black ')).toBe('black');
    });

    it('completes hex with or without the hash to #rrggbb', () => {
        expect(calendarColor('16a765')).toBe('#16a765');
        expect(calendarColor('#B99AFF')).toBe('#b99aff');
        expect(calendarColor('#abc')).toBe('#aabbcc');
    });

    it('maps the names of the ChurchTools palette that CSS does not know', () => {
        expect(calendarColor('sky')).toBe('#0ea5e9');
        expect(calendarColor('emerald')).toBe('#10b981');
    });

    it('gives null for anything else', () => {
        expect(calendarColor('url(x)')).toBeNull();
        expect(calendarColor('')).toBeNull();
        expect(calendarColor(null)).toBeNull();
        expect(calendarColor(undefined)).toBeNull();
    });
});

describe('textOn', () => {
    it('takes white on dark and dark on light colours', () => {
        expect(textOn('#000000')).toBe('#ffffff');
        expect(textOn('#ffffff')).toBe('#111827');
        expect(textOn('black')).toBe('#ffffff');
        expect(textOn('white')).toBe('#111827');
    });

    it('follows the WCAG luminance, not the perceived brightness of a mid tone', () => {
        // #16a765: L = 0.2126 · 0.008 + 0.7152 · 0.386 + 0.0722 · 0.130 ≈ 0.287, above the threshold 0.179.
        expect(textOn('#16a765')).toBe('#111827');
        // #1d3557 lies far below it.
        expect(textOn('#1d3557')).toBe('#ffffff');
    });

    it('takes white without a usable colour', () => {
        expect(textOn(null)).toBe('#ffffff');
        expect(textOn('nonsense')).toBe('#ffffff');
    });
});

describe('servicesLine (Plan.md 51)', () => {
    const appointment = {
        services: [
            { serviceId: 1, name: 'Predigt', people: ['Anna Beispiel'] },
            { serviceId: 2, name: 'Moderation', people: ['Ben Muster', 'Cora Test'] },
            { serviceId: 3, name: 'Ton', people: ['Dirk Probe'] },
        ],
    };

    it('joins the services with " · " and the people with ", "', () => {
        expect(servicesLine(appointment, [1, 2])).toBe('Predigt: Anna Beispiel · Moderation: Ben Muster, Cora Test');
    });

    it('shows only the services the block chose, in the order of the appointment', () => {
        expect(servicesLine(appointment, [3, 2])).toBe('Moderation: Ben Muster, Cora Test · Ton: Dirk Probe');
    });

    it('is null when there is nothing to show', () => {
        expect(servicesLine(appointment, [])).toBeNull();
        expect(servicesLine(appointment, undefined)).toBeNull();
        expect(servicesLine(appointment, [9])).toBeNull();
        expect(servicesLine({}, [1])).toBeNull();
    });
});

describe('WIDEST_DATE', () => {
    it('is no shorter than any day of a year, in text length (the date column of the cards)', () => {
        const widest = formatDate(WIDEST_DATE, 'Europe/Berlin');
        expect(widest).toBe('Donnerstag, 30. September');
        for (let day = 0; day < 366; day++) {
            const instant = new Date(Date.UTC(2028, 0, 1 + day, 12));
            expect(formatDate(instant, 'Europe/Berlin').length).toBeLessThanOrEqual(widest.length);
        }
        for (let day = 0; day < 365; day++) {
            const instant = new Date(Date.UTC(2027, 0, 1 + day, 12));
            expect(formatDate(instant, 'Europe/Berlin').length).toBeLessThanOrEqual(widest.length);
        }
    });
});

describe('textStyle', () => {
    const style: TextStyle = { fontFamily: 'sans', fontSize: 40, fontWeight: 400, color: '#ffffff', align: 'left' };

    it('sets capitals only when asked (Plan.md 65)', () => {
        expect(textStyle(style)).not.toHaveProperty('textTransform');
        expect(textStyle({ ...style, uppercase: false })).not.toHaveProperty('textTransform');
        expect(textStyle({ ...style, uppercase: true }).textTransform).toBe('uppercase');
    });
});
