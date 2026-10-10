import { describe, expect, it } from 'vitest';
import { handleAbove, handleReach, outerFrame, resizeRotated, snapAngle } from './rotate';

describe('outerFrame (Plan.md F1)', () => {
    const frame = { x: 100, y: 100, width: 400, height: 100 };

    it('is the frame itself without a turn', () => {
        expect(outerFrame(frame)).toEqual(frame);
        expect(outerFrame({ ...frame, rotation: 0 })).toEqual(frame);
    });

    it('swaps width and height at 90° about the same middle', () => {
        expect(outerFrame({ ...frame, rotation: 90 })).toEqual({ x: 250, y: -50, width: 100, height: 400 });
    });

    it('grows at 45° to the sum of the sides over the root of two', () => {
        const box = outerFrame({ ...frame, rotation: 45 });
        expect(box.width).toBeCloseTo((500 / Math.SQRT2), 2);
        expect(box.height).toBeCloseTo(500 / Math.SQRT2, 2);
        expect(box.x + box.width / 2).toBeCloseTo(300, 2);
        expect(box.y + box.height / 2).toBeCloseTo(150, 2);
    });

    it('does not care for the direction of the turn', () => {
        expect(outerFrame({ ...frame, rotation: -90 })).toEqual(outerFrame({ ...frame, rotation: 90 }));
    });
});

describe('snapAngle (Plan.md F1)', () => {
    it('snaps to multiples of 45° within 5°', () => {
        expect(snapAngle(43, false)).toBe(45);
        expect(snapAngle(-48, false)).toBe(-45);
        expect(snapAngle(92, false)).toBe(90);
        expect(snapAngle(4, false)).toBe(0);
    });

    it('leaves the angle alone farther away, and always with Shift (free), in whole degrees', () => {
        expect(snapAngle(40, false)).toBe(40);
        expect(snapAngle(43, true)).toBe(43);
        expect(snapAngle(43.6, true)).toBe(44);
    });

    it('keeps the result in -180 … 180 and gives 180 for -180', () => {
        expect(snapAngle(-180, false)).toBe(180);
        expect(snapAngle(180, false)).toBe(180);
        expect(snapAngle(-178, false)).toBe(180);
        expect(snapAngle(181, true)).toBe(-179);
        expect(snapAngle(270, true)).toBe(-90);
        expect(snapAngle(-181, true)).toBe(179);
    });
});

describe('resizeRotated (Plan.md F1)', () => {
    const frame = { x: 100, y: 100, width: 400, height: 100 };
    const corner = (f: { x: number; y: number; width: number; height: number }, rotation: number, sx: number, sy: number) => {
        const a = (rotation * Math.PI) / 180;
        const px = (sx * f.width) / 2;
        const py = (sy * f.height) / 2;
        return {
            x: f.x + f.width / 2 + px * Math.cos(a) - py * Math.sin(a),
            y: f.y + f.height / 2 + px * Math.sin(a) + py * Math.cos(a),
        };
    };

    it('works like a plain resize without a turn', () => {
        expect(resizeRotated(frame, 0, 'se', 30, 20)).toEqual({ x: 100, y: 100, width: 430, height: 120 });
        expect(resizeRotated(frame, 0, 'nw', 30, 20)).toEqual({ x: 130, y: 120, width: 370, height: 80 });
    });

    it("at 90° the pointer's way goes into the block's own axes and the opposite edge stays", () => {
        // Turned a quarter, the block's east side points down: a way down widens it.
        const next = resizeRotated(frame, 90, 'e', 0, 50);
        expect(next.width).toBe(450);
        expect(next.height).toBe(100);
        const before = corner(frame, 90, -1, 0);
        const after = corner(next, 90, -1, 0);
        expect(after.x).toBeCloseTo(before.x, 0);
        expect(after.y).toBeCloseTo(before.y, 0);
    });

    it('at 30° keeps the opposite corner of a corner handle in place', () => {
        const next = resizeRotated(frame, 30, 'se', 40, 25);
        const before = corner(frame, 30, -1, -1);
        const after = corner(next, 30, -1, -1);
        expect(after.x).toBeCloseTo(before.x, 0);
        expect(after.y).toBeCloseTo(before.y, 0);
        expect(next.width).not.toBe(frame.width);
    });

    it('keeps the minimum size', () => {
        expect(resizeRotated(frame, 45, 'e', -1000, 0)).toMatchObject({ width: 20, height: 100 });
    });
});

describe('handleReach', () => {
    const frame = { x: 100, y: 100, width: 200, height: 100 };

    it('reaches above an upright block by its lift and radius', () => {
        expect(handleReach(frame, 28, 6)).toEqual({ above: 34, below: 0 });
    });

    it('reaches below a block turned upside down', () => {
        expect(handleReach({ ...frame, rotation: 180 }, 62, 8)).toEqual({ above: 0, below: 70 });
    });

    it('stays beside a block turned a quarter', () => {
        expect(handleReach({ ...frame, rotation: 90 }, 28, 6)).toEqual({ above: 0, below: 0 });
    });
});

describe('handleAbove', () => {
    const stage = { width: 1920, height: 1080 };
    const frame = { x: 100, y: 100, width: 200, height: 100 };

    it('stays below where there is room', () => {
        expect(handleAbove(frame, 28, 9, stage)).toBe(false);
    });

    it('goes above a block at the bottom edge', () => {
        expect(handleAbove({ ...frame, y: 970 }, 28, 9, stage)).toBe(true);
    });

    it('stays below where it fits neither below nor above', () => {
        expect(handleAbove({ ...frame, y: 10, height: 1060 }, 28, 9, stage)).toBe(false);
    });

    it('turns with the block: a quarter turn at the left edge puts it on the other side', () => {
        expect(handleAbove({ ...frame, x: -50, rotation: 90 }, 28, 9, stage)).toBe(true);
        expect(handleAbove({ ...frame, x: -50, rotation: -90 }, 28, 9, stage)).toBe(false);
    });
});
