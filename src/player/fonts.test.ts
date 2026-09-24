import { describe, expect, it } from 'vitest';
import { DEFAULT_FONT, fontDef, FONTS, fontStack, registerFonts } from './fonts';

describe('fonts', () => {
    it('offers at most ten fonts, each under a name of its own', () => {
        expect(FONTS.length).toBeLessThanOrEqual(10);
        expect(new Set(FONTS.map((f) => f.key)).size).toBe(FONTS.length);
        // A plain "Lato" would merge with the Lato ChurchTools defines on its page.
        for (const font of FONTS) expect(font.family).toMatch(/^ISD /);
    });

    it('uses the ChurchTools font for new blocks, as the built-in info screen does', () => {
        expect(fontDef(DEFAULT_FONT).label).toContain('Lato');
    });

    it('keeps screens of schema 1.0 readable: the old keys point to bundled fonts', () => {
        expect(fontDef('sans').key).toBe('lato');
        expect(fontDef('serif').key).toBe('source-serif-4');
        expect(fontDef('mono').key).toBe('lato');
    });

    it('falls back to the default font for unknown keys', () => {
        expect(fontStack('comic')).toBe(fontStack(DEFAULT_FONT));
        expect(fontStack('barlow-semi-condensed')).toBe('"ISD Barlow Semi Condensed", sans-serif');
    });

    it('delivers every face from the own bundle, never from a font service', () => {
        for (const face of FONTS.flatMap((f) => f.faces)) expect(face.url).not.toMatch(/^https?:/);
    });

    it('registers Latin and Latin Extended for every font, without downloading anything', () => {
        const added: FontFace[] = [];
        class FakeFontFace {
            constructor(
                readonly family: string,
                readonly source: string,
                readonly descriptors: FontFaceDescriptors,
            ) {}
        }
        const original = globalThis.FontFace;
        globalThis.FontFace = FakeFontFace as unknown as typeof FontFace;
        try {
            registerFonts({ add: (face: FontFace) => added.push(face) } as unknown as FontFaceSet);
        } finally {
            globalThis.FontFace = original;
        }
        expect(added).toHaveLength(FONTS.reduce((n, f) => n + f.faces.length, 0));
        const lato = added.filter((f) => f.family === 'ISD Lato') as unknown as FakeFontFace[];
        expect(lato.map((f) => f.descriptors.weight)).toEqual(['400', '400', '700', '700']);
        expect(lato.every((f) => f.descriptors.display === 'block')).toBe(true);
    });
});
