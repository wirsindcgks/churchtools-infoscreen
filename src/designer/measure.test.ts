import { describe, expect, it } from 'vitest';
import { gapsBetween, neighbourGaps, pairGaps, sizeLabelPlace } from './measure';

const stage = { width: 1920, height: 1080 };
const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

describe('neighbourGaps', () => {
    it('measures to the nearest block in each direction, edge to edge', () => {
        const frame = box(500, 400, 200, 100);
        const others = [box(100, 400, 100, 100), box(900, 420, 100, 50), box(1200, 400, 100, 100), box(520, 100, 100, 100), box(520, 800, 100, 100)];
        const gaps = neighbourGaps(frame, others, stage);
        expect(gaps).toContainEqual({ axis: 'x', from: 200, to: 500, at: 450, value: 300 });
        // The nearer of two blocks to the right.
        expect(gaps).toContainEqual({ axis: 'x', from: 700, to: 900, at: 445, value: 200 });
        expect(gaps).not.toContainEqual(expect.objectContaining({ to: 1200 }));
        expect(gaps).toContainEqual({ axis: 'y', from: 200, to: 400, at: 570, value: 200 });
        expect(gaps).toContainEqual({ axis: 'y', from: 500, to: 800, at: 570, value: 300 });
    });

    it('measures to the stage edge where no block lies in the way', () => {
        const gaps = neighbourGaps(box(500, 400, 200, 100), [box(100, 800, 100, 100)], stage);
        expect(gaps).toHaveLength(4);
        expect(gaps).toContainEqual({ axis: 'x', from: 0, to: 500, at: 450, value: 500 });
        expect(gaps).toContainEqual({ axis: 'x', from: 700, to: 1920, at: 450, value: 1220 });
        expect(gaps).toContainEqual({ axis: 'y', from: 0, to: 400, at: 600, value: 400 });
        expect(gaps).toContainEqual({ axis: 'y', from: 500, to: 1080, at: 600, value: 580 });
    });

    it('ignores blocks that do not overlap on the other axis', () => {
        const gaps = neighbourGaps(box(500, 400, 200, 100), [box(800, 600, 100, 100)], stage);
        expect(gaps).toContainEqual({ axis: 'x', from: 700, to: 1920, at: 450, value: 1220 });
    });

    it('looks past a block the frame overlaps', () => {
        const gaps = neighbourGaps(box(500, 400, 200, 100), [box(650, 420, 200, 50)], stage);
        expect(gaps).toContainEqual({ axis: 'x', from: 700, to: 1920, at: 450, value: 1220 });
        expect(gaps).toContainEqual({ axis: 'x', from: 0, to: 500, at: 450, value: 500 });
    });

    it('a full-bleed background hides no distance', () => {
        const gaps = neighbourGaps(box(500, 400, 200, 100), [box(0, 0, 1920, 1080)], stage);
        expect(gaps.map((g) => g.value).sort((x, y) => x - y)).toEqual([400, 500, 580, 1220]);
    });

    it('shows no distance of 0', () => {
        const gaps = neighbourGaps(box(0, 400, 200, 100), [], stage);
        expect(gaps.filter((g) => g.axis === 'x' && g.to === 0)).toEqual([]);
    });
});

describe('pairGaps', () => {
    it('gives the gap between blocks beside each other', () => {
        expect(pairGaps(box(0, 0, 100, 100), box(300, 50, 100, 100))).toEqual([{ axis: 'x', from: 100, to: 300, at: 75, value: 200 }]);
        // The order does not matter.
        expect(pairGaps(box(300, 50, 100, 100), box(0, 0, 100, 100))).toEqual([{ axis: 'x', from: 100, to: 300, at: 75, value: 200 }]);
    });

    it('gives the four inner distances when one lies inside the other', () => {
        const gaps = pairGaps(box(100, 100, 200, 100), box(0, 0, 500, 400));
        expect(gaps.map((g) => [g.axis, g.value])).toEqual([
            ['x', 100],
            ['x', 200],
            ['y', 100],
            ['y', 200],
        ]);
    });

    it('measures nothing between blocks that overlap in part', () => {
        expect(pairGaps(box(0, 0, 200, 200), box(100, 100, 200, 200))).toEqual([]);
    });
});

describe('gapsBetween', () => {
    it('collects gaps of neighbouring pairs only', () => {
        const gaps = gapsBetween([box(0, 0, 100, 100), box(200, 0, 100, 100), box(500, 0, 100, 100)], 'x');
        expect(gaps.map((g) => g.value)).toEqual([100, 200]);
    });

    it('skips pairs without overlap on the other axis', () => {
        expect(gapsBetween([box(0, 0, 100, 100), box(200, 300, 100, 100)], 'x')).toEqual([]);
    });
});

describe('sizeLabelPlace', () => {
    const scale = 0.5; // one screen pixel is two stage pixels
    const down = (frame: ReturnType<typeof box>) => ({ axis: 'y' as const, from: frame.y + frame.height, to: 1080, at: frame.x + frame.width / 2, value: 0 });

    it('goes below the block where nothing hangs from its lower edge', () => {
        const frame = box(500, 400, 200, 100);
        expect(sizeLabelPlace(frame, [], stage, scale)).toEqual({ top: 516, place: 'below' });
        // A distance elsewhere does not matter: upwards, or sideways.
        const up = { axis: 'y' as const, from: 0, to: 400, at: 600, value: 400 };
        const side = { axis: 'x' as const, from: 0, to: 500, at: 500, value: 500 };
        expect(sizeLabelPlace(frame, [up, side], stage, scale).place).toBe('below');
    });

    it('moves inside at the lower edge where a distance runs down from it', () => {
        const frame = box(500, 400, 200, 100); // 50 px tall on screen
        expect(sizeLabelPlace(frame, [down(frame)], stage, scale)).toEqual({ top: 500 - 64, place: 'inside-bottom' });
    });

    it('moves inside at the lower edge where the stage ends there', () => {
        const frame = box(500, 950, 200, 130);
        expect(sizeLabelPlace(frame, [], stage, scale)).toEqual({ top: 1080 - 64, place: 'inside-bottom' });
    });

    it('goes above a block too low to hold it', () => {
        const frame = box(500, 400, 200, 40); // 20 px tall on screen
        expect(sizeLabelPlace(frame, [down(frame)], stage, scale)).toEqual({ top: 400 - 64, place: 'above' });
    });

    it('goes inside at the upper edge where there is no room above either', () => {
        const frame = box(500, 20, 200, 40);
        expect(sizeLabelPlace(frame, [down(frame)], stage, scale)).toEqual({ top: 36, place: 'inside-top' });
    });
});
