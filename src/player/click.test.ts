import { describe, expect, it } from 'vitest';
import type { SlideDoc } from '../model/schema';
import { canStepSlide, reportsPosition, songsheetOf, songsheetOfSlides } from './click';

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

describe('songsheetOfSlides (Plan.md 135 B)', () => {
    const slides = [{ blocks: [block('t', 'text')] }, { blocks: [block('a', 'songsheet')] }, { blocks: [block('b', 'songsheet', { source: 'rehearsal' })] }];

    it('is the first songsheet of any slide – the presentation\'s, not the slide\'s on show', () => {
        expect(songsheetOfSlides(slides, { a: 3 })).toEqual({ source: 'agenda', eventId: 3 });
        expect(songsheetOfSlides([slides[0]!, slides[2]!], {})).toEqual({ source: 'rehearsal' });
    });

    it('is unknown where the block has not reported an event, and none without a songsheet', () => {
        expect(songsheetOfSlides(slides, {})).toBe(true);
        expect(songsheetOfSlides([slides[0]!], { a: 3 })).toBeUndefined();
        expect(songsheetOfSlides([], {})).toBeUndefined();
    });
});

describe('reportsPosition (Plan.md 135 B)', () => {
    it('is true for a screen released for the rehearsal or for the clicks', () => {
        expect(reportsPosition('s1', ['s1'], undefined)).toBe(true);
        expect(reportsPosition('s1', undefined, ['s1', 's2'])).toBe(true);
        expect(reportsPosition('s1', ['s2'], ['s2'])).toBe(false);
        expect(reportsPosition('s1', undefined, undefined)).toBe(false);
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
