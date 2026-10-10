import { describe, expect, it } from 'vitest';
import { align, alignTarget, distribute, distributeBlocker, unitsOf } from './arrange';

const f = (x: number, y: number, width: number, height: number, locked = false) => ({ x, y, width, height, locked });
const target = { x: 100, y: 50, width: 400, height: 300 };

describe('align', () => {
    const frames = [{ x: 0, y: 0, width: 100, height: 40 }, { x: 300, y: 200, width: 50, height: 61 }];
    it('moves every frame to each edge and keeps the order', () => {
        expect(align(frames, 'left', target).map((r) => r.x)).toEqual([100, 100]);
        expect(align(frames, 'right', target).map((r) => r.x)).toEqual([400, 450]);
        expect(align(frames, 'center', target).map((r) => r.x)).toEqual([250, 275]);
        expect(align(frames, 'top', target).map((r) => r.y)).toEqual([50, 50]);
        expect(align(frames, 'bottom', target).map((r) => r.y)).toEqual([310, 289]);
        expect(align(frames, 'middle', target).map((r) => r.y)).toEqual([180, 170]);
    });
    it('changes only the one coordinate', () => {
        expect(align(frames, 'left', target)[1]).toEqual({ x: 100, y: 200, width: 50, height: 61 });
    });
});

describe('distribute', () => {
    it('leaves fewer than three alone', () => {
        const two = [{ x: 0, y: 0, width: 10, height: 10 }, { x: 50, y: 0, width: 10, height: 10 }];
        expect(distribute(two, 'x')).toEqual(two);
    });
    it('makes the gaps equal with unequal sizes and gives the rest to the last gap', () => {
        const frames = [
            { x: 0, y: 0, width: 100, height: 10 },
            { x: 130, y: 0, width: 30, height: 10 },
            { x: 150, y: 0, width: 50, height: 10 },
            { x: 301, y: 0, width: 20, height: 10 },
        ];
        // 321 - 200 = 121 free over three gaps: 40 each, 1 over.
        const r = distribute(frames, 'x');
        expect(r.map((q) => q.x)).toEqual([0, 140, 210, 301]);
    });
    it('returns in the original order and works with overlap', () => {
        const frames = [
            { x: 200, y: 0, width: 100, height: 10 },
            { x: 0, y: 0, width: 100, height: 10 },
            { x: 10, y: 0, width: 100, height: 10 },
        ];
        const r = distribute(frames, 'x');
        // Sorted: 0, 10, 200: free = 300 - 300 = 0, so the middle one (x 10) goes to 100.
        expect(r.map((q) => q.x)).toEqual([200, 0, 100]);
        const over = distribute([{ x: 0, y: 0, width: 100, height: 1 }, { x: 10, y: 0, width: 100, height: 1 }, { x: 50, y: 0, width: 100, height: 1 }], 'x');
        expect(over.map((q) => q.x)).toEqual([0, 25, 50]);
    });
    it('works along y', () => {
        const r = distribute([{ x: 0, y: 0, width: 1, height: 10 }, { x: 0, y: 5, width: 1, height: 10 }, { x: 0, y: 90, width: 1, height: 10 }], 'y');
        expect(r.map((q) => q.y)).toEqual([0, 45, 90]);
    });
});

describe('distributeBlocker', () => {
    const row = (lockedAt: number | null) => [0, 1, 2].map((i) => f(i * 100, 0, 50, 50, i === lockedAt));
    it('needs three', () => {
        expect(distributeBlocker(row(null).slice(0, 2), 'x')).toBe('few');
    });
    it('blocks on a locked one inside, not outside', () => {
        expect(distributeBlocker(row(null), 'x')).toBeNull();
        expect(distributeBlocker(row(1), 'x')).toBe('locked');
        expect(distributeBlocker(row(0), 'x')).toBeNull();
        expect(distributeBlocker(row(2), 'x')).toBeNull();
        // Outside along x (last), inside along y.
        expect(distributeBlocker([f(0, 0, 10, 10), f(100, 5, 10, 10, true), f(200, 100, 10, 10)], 'y')).toBe('locked');
        expect(distributeBlocker([f(0, 0, 10, 10), f(100, 5, 10, 10, true), f(200, 100, 10, 10)], 'x')).toBe('locked');
        expect(distributeBlocker([f(0, 0, 10, 10), f(100, 5, 10, 10, true), f(50, 100, 10, 10)], 'x')).toBeNull();
        expect(distributeBlocker([f(0, 0, 10, 10), f(100, 5, 10, 10, true), f(50, 100, 10, 10)], 'y')).toBe('locked');
    });
});

describe('alignTarget', () => {
    const stage = { width: 1920, height: 1080 };
    it('is the stage for one block, none if it is locked', () => {
        expect(alignTarget([f(10, 10, 5, 5)], stage)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
        expect(alignTarget([f(10, 10, 5, 5, true)], stage)).toBeNull();
    });
    it('is the box around all, or around the locked ones if there are any', () => {
        expect(alignTarget([f(0, 0, 10, 10), f(90, 40, 10, 10)], stage)).toEqual({ x: 0, y: 0, width: 100, height: 50 });
        expect(alignTarget([f(0, 0, 10, 10), f(90, 40, 10, 10, true), f(500, 500, 5, 5)], stage)).toEqual({ x: 90, y: 40, width: 10, height: 10 });
    });
    it('is none when all are locked', () => {
        expect(alignTarget([f(0, 0, 10, 10, true), f(90, 40, 10, 10, true)], stage)).toBeNull();
    });
});

describe('unitsOf', () => {
    const b = (id: string, x: number, groupId?: string, locked = false) => ({ id, x, y: 0, width: 100, height: 50, groupId, locked });
    it('makes one unit of a group, with the box around its members', () => {
        const units = unitsOf([b('a', 0, 'g'), b('c', 500), b('b', 200, 'g')]);
        expect(units.map((u) => u.ids)).toEqual([['a', 'b'], ['c']]);
        expect(units[0]).toMatchObject({ x: 0, y: 0, width: 300, height: 50, locked: false });
    });
    it('keeps a member chosen alone a block of its own', () => {
        expect(unitsOf([b('a', 0, 'g'), b('c', 500)]).map((u) => u.ids)).toEqual([['a'], ['c']]);
    });
    it('locks the unit when a member is locked', () => {
        expect(unitsOf([b('a', 0, 'g', true), b('b', 200, 'g')])[0]!.locked).toBe(true);
    });
});

