import { describe, expect, it } from 'vitest';
import type { SlideDoc } from '../model/schema';
import { canStepSlide, songsheetOf } from './click';

const block = (id: string, type: string, extra: Record<string, unknown> = {}) => ({ id, type, ...extra }) as unknown as SlideDoc['blocks'][number];

describe('songsheetOf (Plan.md 124 D)', () => {
    it('has no source without a songsheet block', () => {
        expect(songsheetOf({ blocks: [block('t', 'text')] }, { s: 3 })).toBeUndefined();
    });

    it('names the event the first songsheet block follows', () => {
        expect(songsheetOf({ blocks: [block('t', 'text'), block('a', 'songsheet'), block('b', 'songsheet')] }, { a: 3, b: 4 })).toEqual({ source: 'agenda', eventId: 3 });
    });

    it('names the rehearsal for a block with that source, whatever event is reported', () => {
        expect(songsheetOf({ blocks: [block('a', 'songsheet', { source: 'rehearsal' })] }, { a: 3 })).toEqual({ source: 'rehearsal' });
    });

    it('is unknown (true) where the block has not reported an event', () => {
        expect(songsheetOf({ blocks: [block('a', 'songsheet')] }, {})).toBe(true);
    });
});

describe('canStepSlide (Plan.md 124: the ends hold)', () => {
    it('steps inside the list', () => {
        expect(canStepSlide(1, 3, 1)).toBe(true);
        expect(canStepSlide(1, 3, -1)).toBe(true);
    });

    it('does not wrap round: forward on the last and back on the first slide do nothing', () => {
        expect(canStepSlide(2, 3, 1)).toBe(false);
        expect(canStepSlide(0, 3, -1)).toBe(false);
        expect(canStepSlide(0, 3, 1)).toBe(true);
        expect(canStepSlide(2, 3, -1)).toBe(true);
    });

    it('does not step without slides, and with a single one only stays', () => {
        expect(canStepSlide(0, 0, 1)).toBe(false);
        expect(canStepSlide(0, 1, 1)).toBe(false);
        expect(canStepSlide(0, 1, -1)).toBe(false);
    });
});
