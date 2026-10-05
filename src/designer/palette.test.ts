import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from '../model/schema';
import { makeSlide, textBlock } from '../model/testing';
import { paletteColors, slideColors, slideSwatches } from './palette';

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

describe('slideColors', () => {
    const withColor = (id: string, color: string) => {
        const block = textBlock(id);
        return { ...block, style: { ...(block as { style: object }).style, color } } as typeof block;
    };

    it('collects text colours and fills in order of appearance, gradient stops included', () => {
        const slide = makeSlide({
            background: { kind: 'gradient', angle: 90, stops: [{ color: '#111111', at: 0 }, { color: '#222222', at: 1 }] } as never,
            blocks: [withColor('a', '#aa0000'), withColor('b', '#00bb00')],
        });
        expect(slideColors(slide, []).map((c) => c.color)).toEqual(['#111111', '#222222', '#aa0000', '#00bb00']);
    });

    it('finds a block background nested anywhere, names a colour by its hex value', () => {
        const slide = makeSlide({ blocks: [{ ...textBlock('a'), background: { kind: 'solid', color: '#abcdef' } } as never] });
        expect(slideColors(slide, []).filter((c) => c.color === '#abcdef')).toEqual([{ name: '#abcdef', color: '#abcdef' }]);
    });

    it('lists a colour once, ignoring case', () => {
        const slide = makeSlide({ background: { kind: 'solid', color: '#AABBCC' }, blocks: [withColor('a', '#aabbcc')] });
        expect(slideColors(slide, [])).toHaveLength(1);
    });

    it('leaves out the excluded colours, ignoring case', () => {
        const slide = makeSlide({ background: { kind: 'solid', color: '#000000' }, blocks: [withColor('a', '#FFFFFF'), withColor('b', '#123456')] });
        expect(slideColors(slide, ['#ffffff', '#000000']).map((c) => c.color)).toEqual(['#123456']);
    });

    it('stops at 12', () => {
        const blocks = Array.from({ length: 15 }, (_, i) => withColor(`b${i}`, `#0000${i.toString(16).padStart(2, '0')}`));
        expect(slideColors(makeSlide({ blocks }), [])).toHaveLength(12);
    });

    it('ignores values that are no hex colour', () => {
        const slide = makeSlide({ background: { kind: 'solid', color: 'transparent' }, blocks: [withColor('a', 'red'), withColor('b', 'rgb(1,2,3)')] });
        expect(slideColors(slide, [])).toEqual([]);
        expect(slideColors(null, [])).toEqual([]);
    });
});

describe('slideSwatches', () => {
    const withColor = (id: string, color: string) => {
        const block = textBlock(id);
        return { ...block, style: { ...(block as { style: object }).style, color } } as typeof block;
    };

    it('lists every colour of the slide, approved ones under their palette name (Plan.md 65)', () => {
        const slide = makeSlide({ background: { kind: 'solid', color: '#1E293B' }, blocks: [withColor('a', '#f5b301'), withColor('b', '#12ab34')] });
        const palette = [
            { name: 'Hintergrund', color: '#1e293b' },
            { name: 'Sonnengelb', color: '#F5B301' },
        ];
        expect(slideSwatches(slide, palette)).toEqual([
            { name: 'Hintergrund', color: '#1e293b' },
            { name: 'Sonnengelb', color: '#f5b301' },
            { name: '#12ab34', color: '#12ab34' },
        ]);
    });
});
