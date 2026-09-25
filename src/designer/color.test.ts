import { describe, expect, it } from 'vitest';
import { parseHex, pickerValue } from './color';

describe('parseHex', () => {
    it('accepts 3, 6 and 8 digits, with or without #, and normalises to lower case', () => {
        expect(parseHex('#1E3A5F')).toBe('#1e3a5f');
        expect(parseHex('1e3a5f')).toBe('#1e3a5f');
        expect(parseHex(' #FFF ')).toBe('#fff');
        expect(parseHex('#1e3a5f80')).toBe('#1e3a5f80');
    });

    it('refuses what is no hex colour', () => {
        for (const input of ['', '#', '#12', '#1234', '#12345', '#ggg', 'red', 'rgb(0,0,0)', '#1234567']) {
            expect(parseHex(input), input).toBeNull();
        }
    });
});

describe('pickerValue', () => {
    it('gives the picker the six digits it understands', () => {
        expect(pickerValue('#1e3a5f')).toBe('#1e3a5f');
        expect(pickerValue('#fa0')).toBe('#ffaa00');
        expect(pickerValue('#1e3a5f80')).toBe('#1e3a5f');
    });

    it('shows black for colours it cannot show, e.g. older CSS values', () => {
        expect(pickerValue('rgba(0, 0, 0, 0.5)')).toBe('#000000');
    });
});
