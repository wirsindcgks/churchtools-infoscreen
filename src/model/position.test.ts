import { describe, expect, it } from 'vitest';
import { fitPositionSlides, hasSlides, readPosition } from './position';

const doc = {
    kind: 'position',
    screenId: 's1',
    playlistId: 'p1',
    advance: 'click',
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

describe('readPosition: name, time of the click and source of the songsheet (Plan.md 124 D)', () => {
    it('reads by and clickAt, and leaves out what is damaged', () => {
        expect(readPosition({ ...doc, by: 'Anna', clickAt: '2026-11-26T09:59:55Z' })).toEqual({ ...doc, by: 'Anna', clickAt: '2026-11-26T09:59:55Z' });
        const read = readPosition({ ...doc, by: '', clickAt: 'gestern' })!;
        expect(read.by).toBeUndefined();
        expect(read.clickAt).toBeUndefined();
        expect(readPosition({ ...doc, by: 4 })!.by).toBeUndefined();
    });

    it('reads the source of the songsheet; the old value true and an unreadable one count as unknown', () => {
        expect(readPosition({ ...doc, songsheet: { source: 'agenda', eventId: 12 } })!.songsheet).toEqual({ source: 'agenda', eventId: 12 });
        expect(readPosition({ ...doc, songsheet: { source: 'rehearsal' } })!.songsheet).toEqual({ source: 'rehearsal' });
        expect(readPosition({ ...doc, songsheet: true })!.songsheet).toBe(true);
        expect(readPosition({ ...doc, songsheet: { source: 'agenda' } })!.songsheet).toBe(true);
        expect(readPosition({ ...doc, songsheet: { source: 'agenda', eventId: 0 } })!.songsheet).toBe(true);
        for (const none of [false, 'ja', 3, null, { source: 'x' }, {}]) expect(readPosition({ ...doc, songsheet: none })!.songsheet).toBeUndefined();
    });
});

describe('readPosition: presentation, mode, rehearsal and no slides (Plan.md 135 B)', () => {
    const byTime = { kind: 'position', screenId: 's1', playlistId: 'p1', playlistName: 'Ablauf', advance: 'time', seq: 0, at: '2026-11-26T10:00:00Z' };

    it('reads a value of before: no name, no mode – the mode is "click", it was only written where clicks count', () => {
        const old: Record<string, unknown> = { ...doc };
        delete old.advance;
        const read = readPosition(old)!;
        expect(read.advance).toBe('click');
        expect(read.playlistName).toBeUndefined();
        expect(read.rehearsal).toBeUndefined();
        expect(hasSlides(read)).toBe(true);
    });

    it('reads a position by time without slides – only there they may be missing', () => {
        const read = readPosition(byTime)!;
        expect(read).toEqual(byTime);
        expect(hasSlides(read)).toBe(false);
        expect(readPosition({ ...byTime, advance: 'click' })).toBeNull();
        expect(readPosition({ ...byTime, advance: 'time-click' })).toBeNull();
        // Slides, where there are, are read in any mode.
        expect(hasSlides(readPosition({ ...doc, advance: 'time' })!)).toBe(true);
        // Half of the slides count as none.
        expect(hasSlides(readPosition({ ...byTime, slideId: 'sl1' })!)).toBe(false);
    });

    it('reads name and rehearsal, and leaves out what is damaged', () => {
        const rehearsal = { until: '2026-11-26T12:00:00Z', by: 'Anna' };
        expect(readPosition({ ...byTime, rehearsal })!.rehearsal).toEqual(rehearsal);
        expect(readPosition({ ...byTime, rehearsal: { until: '2026-11-26T12:00:00Z' } })!.rehearsal).toEqual({ until: '2026-11-26T12:00:00Z' });
        for (const bad of [{ until: 'bald' }, { by: 'Anna' }, 'ja', null, 4]) expect(readPosition({ ...byTime, rehearsal: bad })!.rehearsal).toBeUndefined();
        expect(readPosition({ ...byTime, playlistName: 4 })!.playlistName).toBeUndefined();
        expect(readPosition({ ...byTime, advance: 'sonst' })).toBeNull();
    });

    it('cuts the name of the presentation like the names of the slides, and fits a value without slides', () => {
        const read = readPosition({ ...byTime, playlistName: 'n'.repeat(90) })!;
        expect(fitPositionSlides(read).playlistName).toHaveLength(40);
        expect(fitPositionSlides(read).slides).toBeUndefined();
    });
});
