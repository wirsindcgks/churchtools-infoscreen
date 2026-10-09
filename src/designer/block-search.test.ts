import { describe, expect, it } from 'vitest';
import { searchBlocks } from './block-search';
import { PALETTE } from './ops';

describe('searchBlocks (Plan.md 79, C7)', () => {
    it('an empty search finds all, in the order of the palette', () => {
        expect(searchBlocks('')).toEqual(PALETTE.map(([type]) => type));
        expect(searchBlocks('   ')).toHaveLength(PALETTE.length);
    });
    it('finds by name', () => {
        expect(searchBlocks('raum')).toContain('rooms');
    });
    it('"flaeche" finds the shape, "ä" finds "ae" and the other way round', () => {
        expect(searchBlocks('flaeche')).toContain('shape');
        expect(searchBlocks('fläche')).toContain('shape');
        expect(searchBlocks('naechste')).toContain('next-appointment');
        expect(searchBlocks('Nächste')).toContain('next-appointment');
    });
    it('finds by the sentence', () => {
        expect(searchBlocks('kalender')).toContain('appointment-list');
    });
    it('ignores case', () => {
        expect(searchBlocks('QR-CODE')).toEqual(searchBlocks('qr-code'));
        expect(searchBlocks('qr-code')).toContain('qr');
    });
    it('no match is empty', () => {
        expect(searchBlocks('xyzzy')).toEqual([]);
    });
});
