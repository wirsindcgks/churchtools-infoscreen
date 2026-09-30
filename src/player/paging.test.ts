import { describe, expect, it } from 'vitest';
import { makeSlide } from '../model/testing';
import type { Block } from '../model/schema';
import { GROUP_SECONDS, pageInterval, paginateByHeight, POST_SECONDS, slideSeconds } from './paging';

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

const groups = (overrides: Partial<Extract<Block, { type: 'groups' }>> = {}): Block => ({
    id: 'gruppen',
    type: 'groups',
    x: 0,
    y: 0,
    width: 1400,
    height: 700,
    parentGroupId: 10,
    groupIds: [],
    layout: 'card',
    perPage: 1,
    show: { name: true, image: true, when: true, targetGroup: true, category: true, note: true, leaders: false, leaderImages: false, places: true, qr: true },
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

describe('paging a slideshow (Plan.md 46)', () => {
    const show = (overrides: Partial<Extract<Block, { type: 'slideshow' }>> = {}): Block => ({
        id: 'dia',
        type: 'slideshow',
        x: 0,
        y: 0,
        width: 1200,
        height: 675,
        mediaIds: ['a', 'b', 'c', 'd'],
        fit: 'cover',
        seconds: 6,
        transition: 'fade',
        ...overrides,
    });

    it('keeps the slide until every image has run once', () => {
        expect(slideSeconds(makeSlide({ durationSeconds: 10, blocks: [show()] }), {})).toBe(24);
        expect(slideSeconds(makeSlide({ durationSeconds: 10, blocks: [show({ seconds: 4 })] }), {})).toBe(16);
    });

    it('leaves a slide alone that is longer than the images need', () => {
        expect(slideSeconds(makeSlide({ durationSeconds: 60, blocks: [show()] }), {})).toBe(60);
    });

    it('needs no more time than the slide has for one image', () => {
        expect(slideSeconds(makeSlide({ durationSeconds: 10, blocks: [show({ mediaIds: ['a'] })] }), {})).toBe(10);
    });

    it('prefers the count the block reports over the stored list', () => {
        const slide = makeSlide({ durationSeconds: 10, blocks: [show()] });
        expect(slideSeconds(slide, { dia: 2 })).toBe(12);
        expect(slideSeconds(slide, { dia: 1 })).toBe(10);
    });
});

describe('paging a groups block (Plan.md 43)', () => {
    it('keeps the slide until every group or page has shown, as a card and as a list', () => {
        const card = makeSlide({ durationSeconds: 8, blocks: [groups()] });
        expect(slideSeconds(card, { gruppen: 4 })).toBe(4 * GROUP_SECONDS);
        expect(slideSeconds(card, { gruppen: 1 })).toBe(8);
        expect(slideSeconds(card, {})).toBe(8);
        const listed = makeSlide({ durationSeconds: 8, blocks: [groups({ layout: 'list', pageSeconds: 6 })] });
        expect(slideSeconds(listed, { gruppen: 2 })).toBe(12);
    });
});
