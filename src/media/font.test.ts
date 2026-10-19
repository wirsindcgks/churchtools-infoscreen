import { describe, expect, it } from 'vitest';
import { FONT_MAX_BYTES, fontProblem, suggestFontName } from './font';

describe('fontProblem', () => {
    it('accepts the four formats, in any case', () => {
        for (const name of ['a.woff2', 'a.woff', 'a.ttf', 'a.otf', 'Haus-Bold.WOFF2']) {
            expect(fontProblem({ name, size: 1000 })).toBeNull();
        }
    });

    it('refuses another format, also one that merely contains the ending', () => {
        for (const name of ['a.pdf', 'a.woff2.zip', 'woff2', 'a.eot', 'a.svg']) {
            expect(fontProblem({ name, size: 1000 })).toBe('Nur Schriften als WOFF2, WOFF, TTF oder OTF werden unterstützt.');
        }
    });

    it('takes 5 MB and refuses more', () => {
        expect(fontProblem({ name: 'a.ttf', size: FONT_MAX_BYTES })).toBeNull();
        expect(fontProblem({ name: 'a.ttf', size: FONT_MAX_BYTES + 1 })).toBe('„a.ttf" ist größer als 5 MB.');
    });
});

describe('suggestFontName', () => {
    it('takes the file name without ending, dashes and underscores as spaces', () => {
        expect(suggestFontName('Hausschrift-Regular.woff2')).toBe('Hausschrift Regular');
        expect(suggestFontName('haus_schrift.ttf')).toBe('haus schrift');
    });

    it('cuts at 40 characters and never returns an empty name', () => {
        expect(suggestFontName(`${'a'.repeat(60)}.otf`)).toHaveLength(40);
        expect(suggestFontName('.woff2')).toBe('Eigene Schrift');
    });
});
