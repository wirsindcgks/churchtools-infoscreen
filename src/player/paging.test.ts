import { describe, expect, it } from 'vitest';
import { makeSlide } from '../model/testing';
import type { Block } from '../model/schema';
import { pageInterval, paginate, rowsPerPage, slideSeconds } from './paging';

const style = { fontFamily: 'sans', fontSize: 40, fontWeight: 400 as const, color: '#fff', align: 'left' as const };
const list = (overrides: Partial<Extract<Block, { type: 'appointment-list' }>> = {}): Block => ({
    id: 'liste',
    type: 'appointment-list',
    x: 0,
    y: 0,
    width: 1000,
    height: 600,
    calendarIds: [1],
    horizonDays: 14,
    limit: 5,
    showAll: true,
    style,
    ...overrides,
});

describe('paging an appointment list', () => {
    it('fits whole rows, keeping room for the page number only when there are pages', () => {
        expect(rowsPerPage(600, 70, 5)).toBe(8); // all fit: no page number needed
        expect(rowsPerPage(600, 70, 20)).toBe(7); // 600 - 52.5 leaves room for 7
        expect(rowsPerPage(600, 0, 12)).toBe(12); // not measured yet: show all, the block clips
        expect(rowsPerPage(40, 70, 3)).toBe(1); // never zero rows
    });

    it('splits rows into pages, an empty list into one empty page', () => {
        expect(paginate([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
        expect(paginate([], 7)).toEqual([[]]);
    });

    it('gives a page its own time, or an even share of a longer slide', () => {
        expect(pageInterval(10, 8, 3)).toBe(10);
        expect(pageInterval(10, 30, 2)).toBe(15);
    });

    it('keeps the slide until every page has shown', () => {
        const slide = makeSlide({ durationSeconds: 8, blocks: [list()] });
        expect(slideSeconds(slide, { liste: 3 })).toBe(30); // 3 pages × 10 s
        expect(slideSeconds(slide, { liste: 1 })).toBe(8); // one page: the slide's own duration
        expect(slideSeconds(slide, {})).toBe(8); // not yet measured
        expect(slideSeconds({ ...slide, durationSeconds: 45 }, { liste: 3 })).toBe(45);
        expect(slideSeconds(makeSlide({ durationSeconds: 8, blocks: [list({ showAll: false })] }), { liste: 3 })).toBe(8);
        expect(slideSeconds(makeSlide({ durationSeconds: 8, blocks: [list({ pageSeconds: 5 })] }), { liste: 3 })).toBe(15);
    });
});
