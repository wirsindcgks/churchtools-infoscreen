import { describe, expect, it } from 'vitest';
import { makeSlide } from '../model/testing';
import type { Block } from '../model/schema';
import { pageInterval, paginateByHeight, POST_SECONDS, slideSeconds } from './paging';

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
const posts = (overrides: Partial<Extract<Block, { type: 'posts' }>> = {}): Block => ({
    id: 'beitraege',
    type: 'posts',
    x: 0,
    y: 0,
    width: 1400,
    height: 700,
    groupIds: [31],
    limit: 3,
    maxAgeDays: 30,
    layout: 'card',
    showImage: true,
    showAuthor: false,
    style,
    ...overrides,
});

describe('paging an appointment list', () => {
    it('fills pages by the measured heights of the rows, keeping room for the page bar only when there are pages', () => {
        const rows = [1, 2, 3, 4, 5];
        expect(paginateByHeight(rows, [100, 100, 100, 100, 100], 600, 40)).toEqual([rows]); // all fit: no bar
        // 600 - 40 leaves 560: rows of 200, 150, 150 fit, the next 150 goes on.
        expect(paginateByHeight(rows, [200, 150, 150, 150, 100], 600, 40)).toEqual([[1, 2, 3], [4, 5]]);
        expect(paginateByHeight(rows, [100, 0, 100, 100, 100], 300, 40)).toEqual([rows]); // not measured yet: the block clips
        expect(paginateByHeight([1, 2], [700, 700], 600, 40)).toEqual([[1], [2]]); // never an empty page
        expect(paginateByHeight([], [], 600, 40)).toEqual([[]]);
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

    it('keeps the slide until a card-layout posts block has shown every post', () => {
        const slide = makeSlide({ durationSeconds: 8, blocks: [posts()] });
        expect(slideSeconds(slide, { beitraege: 3 })).toBe(3 * POST_SECONDS);
        expect(slideSeconds(slide, { beitraege: 1 })).toBe(8); // one post: the slide's own duration
        expect(slideSeconds(slide, {})).toBe(8); // not yet measured
        expect(slideSeconds(makeSlide({ durationSeconds: 8, blocks: [posts({ layout: 'list' })] }), { beitraege: 3 })).toBe(8);
        expect(slideSeconds(makeSlide({ durationSeconds: 8, blocks: [posts({ pageSeconds: 5 })] }), { beitraege: 3 })).toBe(15);
    });
});
