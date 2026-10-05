import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from '../model/schema';
import { paletteColors } from './palette';

const theme = { ...DEFAULT_THEME, accent: '#3b82f6', text: '#ffffff', background: '#1e293b' };

describe('paletteColors', () => {
    it('offers the three theme colours first, then the palette', () => {
        const list = paletteColors({ ...theme, palette: [{ name: 'Sonnengelb', color: '#f5b301' }] });
        expect(list).toEqual([
            { name: 'Akzent', color: '#3b82f6' },
            { name: 'Text', color: '#ffffff' },
            { name: 'Hintergrund', color: '#1e293b' },
            { name: 'Sonnengelb', color: '#f5b301' },
        ]);
    });

    it('offers just the three without a palette, and nothing without a theme', () => {
        expect(paletteColors(theme).map((c) => c.name)).toEqual(['Akzent', 'Text', 'Hintergrund']);
        expect(paletteColors(null)).toEqual([]);
    });

    it('lists a colour once, ignoring case, under its first name', () => {
        const list = paletteColors({ ...theme, palette: [{ name: 'Weiss', color: '#FFFFFF' }, { name: 'Gelb', color: '#f5b301' }, { name: 'Gelb 2', color: '#F5B301' }] });
        expect(list.map((c) => c.name)).toEqual(['Akzent', 'Text', 'Hintergrund', 'Gelb']);
    });

    it('shows the hex value for an empty name', () => {
        expect(paletteColors({ ...theme, palette: [{ name: '', color: '#f5b301' }] }).at(-1)).toEqual({ name: '#f5b301', color: '#f5b301' });
    });
});
