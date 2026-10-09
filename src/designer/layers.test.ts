import { describe, expect, it } from 'vitest';
import { createBlock, moveAround, reorderAround } from './ops';
import { blockSummary, layerRows, shorten } from './layers';

const stage = { width: 1920, height: 1080 };
const lookup = {
    mediaName: (id: string) => (id === 'm1' ? 'Pfingsten.jpg' : undefined),
    calendarName: (id: number) => (id === 7 ? 'Gottesdienst' : undefined),
    roomName: (id: number) => (id === 3 ? 'Saal' : undefined),
};

describe('layers (Plan.md 79, B3)', () => {
    it('lists the top layer first – the last block of the slide', () => {
        const blocks = [createBlock('text', stage), createBlock('shape', stage), createBlock('clock', stage)];
        const rows = layerRows(blocks);
        expect(rows.map((r) => r.block.type)).toEqual(['clock', 'shape', 'text']);
        expect(rows.map((r) => r.index)).toEqual([2, 1, 0]);
    });

    it('says what a block holds in a short line', () => {
        const text = { ...createBlock('text', stage), text: 'Herzlich willkommen zum Gottesdienst am Sonntag' } as ReturnType<typeof createBlock>;
        expect(blockSummary(text, lookup)).toBe('Herzlich willkommen zum Gotte…');
        expect(blockSummary(text, lookup)).toHaveLength(30);
        expect(blockSummary({ ...createBlock('image', stage), mediaId: 'm1' } as never, lookup)).toBe('Pfingsten.jpg');
        expect(blockSummary({ ...createBlock('appointment-list', stage, [7]) } as never, lookup)).toBe('Gottesdienst');
        expect(blockSummary({ ...createBlock('web', stage), url: 'https://example.org/seite' } as never, lookup)).toBe('example.org/seite');
        expect(blockSummary(createBlock('shape', stage), lookup)).toBe('');
        expect(shorten('  a\n b  ')).toBe('a b');
    });

    it('moves a block among the free places and leaves a locked one where it is', () => {
        const locked = (i: number) => i === 1;
        expect(moveAround(['X', 'L', 'B', 'C'], 0, 2, locked)).toEqual(['B', 'L', 'X', 'C']);
        expect(moveAround(['X', 'L', 'B', 'C'], 3, 0, locked)).toEqual(['C', 'L', 'X', 'B']);
        expect(reorderAround(3, 0, 1)).toEqual([1, 0, 2]);
    });
});
