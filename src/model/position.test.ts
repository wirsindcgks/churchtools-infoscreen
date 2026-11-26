import { describe, expect, it } from 'vitest';
import { readPosition } from './position';

const doc = {
    kind: 'position',
    screenId: 's1',
    playlistId: 'p1',
    slideId: 'sl1',
    number: 1,
    total: 2,
    slides: [{ id: 'sl1', name: 'Eins' }],
    seq: 3,
    at: '2026-11-26T10:00:00Z',
};

describe('readPosition (Plan.md 124 C)', () => {
    it('reads a JSON string and an object', () => {
        expect(readPosition(doc)).toEqual(doc);
        expect(readPosition(JSON.stringify({ ...doc, songsheet: true, black: true }))).toEqual({ ...doc, songsheet: true, black: true });
    });

    it('is tolerant: a missing seq is 0, entries without an id are left out, no list is an empty one', () => {
        const read = readPosition({ ...doc, seq: undefined, slides: [{ name: 'x' }, 'y', { id: 'a' }], black: 'ja' });
        expect(read).toMatchObject({ seq: 0, slides: [{ id: 'a', name: '' }] });
        expect(read!.black).toBeUndefined();
        expect(readPosition({ ...doc, slides: 4 })!.slides).toEqual([]);
    });

    it('is no position without screen, presentation, slide, counts or time – and not a sign of life', () => {
        for (const bad of [{ screenId: '' }, { playlistId: 3 }, { slideId: '' }, { number: -1 }, { total: 1.5 }, { at: 'nie' }]) expect(readPosition({ ...doc, ...bad })).toBeNull();
        expect(readPosition('{kaputt')).toBeNull();
        expect(readPosition(null)).toBeNull();
        expect(readPosition({ kind: 'heartbeat', screen: 'demo', at: '2026-11-26T10:00:00Z' })).toBeNull();
    });
});
