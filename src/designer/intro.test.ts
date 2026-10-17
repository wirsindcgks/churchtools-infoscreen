import { describe, expect, it } from 'vitest';
import { bubblePlace, firstVisible, isVisible, type Box } from './intro';

const view = { width: 1000, height: 800 };
const bubble = { width: 300, height: 150 };
const box = (left: number, top: number, width: number, height: number): Box => ({ left, top, width, height });

function inside(spot: { left: number; top: number }): boolean {
    return spot.left >= 0 && spot.top >= 0 && spot.left + bubble.width <= view.width && spot.top + bubble.height <= view.height;
}

describe('bubblePlace (Plan.md 81)', () => {
    it('goes below the place when there is room', () => {
        expect(bubblePlace(box(100, 50, 200, 40), bubble, view)).toEqual({ left: 100, top: 102 });
    });

    it('goes above when there is no room below', () => {
        const spot = bubblePlace(box(100, 700, 200, 40), bubble, view);
        expect(spot.top).toBe(700 - 150 - 12);
        expect(inside(spot)).toBe(true);
    });

    it('goes beside a tall column, right first', () => {
        const spot = bubblePlace(box(0, 60, 240, 700), bubble, view);
        expect(spot.left).toBe(252);
        expect(inside(spot)).toBe(true);
    });

    it('goes left of a tall column at the right edge', () => {
        const spot = bubblePlace(box(700, 60, 290, 700), bubble, view);
        expect(spot.left).toBe(700 - 300 - 12);
        expect(inside(spot)).toBe(true);
    });

    it('goes to the middle when nothing fits, and also without a place', () => {
        const centre = { left: 350, top: 325 };
        expect(bubblePlace(box(0, 0, 1000, 800), bubble, view)).toEqual(centre);
        expect(bubblePlace(null, bubble, view)).toEqual(centre);
    });

    it('stays inside the window, even for a place at the very edge or a bubble larger than the window', () => {
        expect(inside(bubblePlace(box(950, 20, 40, 30), bubble, view))).toBe(true);
        const spot = bubblePlace(box(10, 10, 20, 20), { width: 2000, height: 2000 }, view);
        expect(spot).toEqual({ left: 8, top: 8 });
    });
});

describe('visible places (Plan.md 81)', () => {
    it('counts a place with width and height that lies in the window', () => {
        expect(isVisible(box(10, 10, 50, 20), view)).toBe(true);
        expect(isVisible(box(10, 10, 0, 20), view)).toBe(false);
        expect(isVisible(box(10, 10, 50, 0), view)).toBe(false);
        expect(isVisible(box(1200, 10, 50, 20), view)).toBe(false);
        expect(isVisible(box(-100, 10, 50, 20), view)).toBe(false);
        expect(isVisible(null, view)).toBe(false);
    });

    it('takes the first visible one and reports a missing place as -1', () => {
        expect(firstVisible([null, box(0, 0, 0, 0), box(5, 5, 40, 40), box(9, 9, 9, 9)], view)).toBe(2);
        expect(firstVisible([null, box(0, 0, 0, 0)], view)).toBe(-1);
    });
});
