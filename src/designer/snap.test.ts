import { describe, expect, it } from 'vitest';
import { snapMove, snapResize, type SnapOptions } from './snap';

const base: SnapOptions = { grid: 20, threshold: 8, stage: { width: 1920, height: 1080 }, others: [] };

describe('snapMove', () => {
    it('snaps to the grid when no alignment target is near', () => {
        const { frame, guides } = snapMove({ x: 213, y: 187, width: 400, height: 200 }, base);
        expect([frame.x, frame.y]).toEqual([220, 180]);
        expect(guides).toEqual([]);
    });

    it('centres on the stage and shows a guide', () => {
        // Centre at 963 – within 8 px of the stage centre 960.
        const { frame, guides } = snapMove({ x: 763, y: 301, width: 400, height: 200 }, base);
        expect(frame.x).toBe(760);
        expect(guides).toContainEqual({ axis: 'x', at: 960 });
    });

    it('aligns with the edge of another block, which beats the grid', () => {
        const others = [{ x: 105, y: 600, width: 300, height: 100 }];
        const { frame, guides } = snapMove({ x: 110, y: 300, width: 200, height: 100 }, { ...base, others });
        expect(frame.x).toBe(105); // left edges aligned, not the grid value 100 or 120
        expect(guides).toContainEqual({ axis: 'x', at: 105 });
    });

    it('snaps the right edge to the stage edge', () => {
        const { frame } = snapMove({ x: 1515, y: 300, width: 400, height: 200 }, base);
        expect(frame.x + frame.width).toBe(1920);
    });

    it('keeps free positioning with the grid switched off', () => {
        const { frame } = snapMove({ x: 213.4, y: 187.6, width: 400, height: 200 }, { ...base, grid: 0, threshold: 0 });
        expect([frame.x, frame.y]).toEqual([213, 188]);
    });
});

describe('snapResize', () => {
    it('snaps only the edges the handle moves', () => {
        const { frame } = snapResize({ x: 213, y: 187, width: 407, height: 198 }, 'se', base);
        expect([frame.x, frame.y]).toEqual([213, 187]);
        expect([frame.x + frame.width, frame.y + frame.height]).toEqual([620, 380]);
    });

    it('snaps a left edge dragged near another block', () => {
        const others = [{ x: 500, y: 0, width: 100, height: 100 }];
        const { frame, guides } = snapResize({ x: 596, y: 200, width: 204, height: 100 }, 'w', { ...base, others });
        expect(frame.x).toBe(600);
        expect(frame.x + frame.width).toBe(800);
        expect(guides).toContainEqual({ axis: 'x', at: 600 });
    });
});

describe('gap targets (Plan.md 79, A3)', () => {
    const row = [
        { x: 100, y: 400, width: 200, height: 100 },
        { x: 400, y: 400, width: 200, height: 100 },
    ];
    const frame = { x: 0, y: 410, width: 200, height: 100 };

    it('snaps the third block of a row to the gap of the first two', () => {
        // The pair has a gap of 100; the third at 703 is 3 px off the gap-100 position 700.
        const { frame: snapped, spacings } = snapMove({ ...frame, x: 703 }, { ...base, others: row, grid: 0 });
        expect(snapped.x).toBe(700);
        expect(spacings.map((m) => m.value)).toEqual([100, 100]);
        expect(spacings.map((m) => [m.from, m.to])).toEqual([
            [300, 400],
            [600, 700],
        ]);
    });

    it('snaps exactly between two blocks', () => {
        const others = [
            { x: 100, y: 400, width: 100, height: 100 },
            { x: 700, y: 400, width: 100, height: 100 },
        ];
        // Room between: 200..700 = 500; a 100 wide block fits with 200 each side at x = 400.
        const { frame: snapped, spacings } = snapMove({ x: 405, y: 410, width: 100, height: 100 }, { ...base, others, grid: 0 });
        expect(snapped.x).toBe(400);
        expect(spacings.map((m) => m.value)).toEqual([200, 200]);
    });

    it('lets a nearer edge target win over the gap target', () => {
        const others = [...row, { x: 703, y: 700, width: 50, height: 50 }];
        // Gap target at 700 is 3 px away, the left edge of the block at 703 is 0 px away.
        const { frame: snapped, guides } = snapMove({ ...frame, x: 703 }, { ...base, others, grid: 0 });
        expect(snapped.x).toBe(703);
        expect(guides).toContainEqual({ axis: 'x', at: 703 });
    });

    it('lets the edge target win at the very same distance', () => {
        // Frame at 697: the gap position 700 is 3 px away, so is the left edge of the block at 694.
        const others = [...row, { x: 694, y: 700, width: 50, height: 50 }];
        const { frame: snapped, spacings } = snapMove({ ...frame, x: 697 }, { ...base, others, grid: 0 });
        expect(snapped.x).toBe(694);
        expect(spacings).toEqual([]);
    });

    it('has no effect without overlap on the other axis', () => {
        const { frame: snapped, spacings } = snapMove({ ...frame, y: 900, x: 703 }, { ...base, others: row, grid: 0 });
        expect(snapped.x).toBe(703);
        expect(spacings).toEqual([]);
    });

    it('leaves the grid in charge when nothing is near', () => {
        const { frame: snapped, spacings } = snapMove({ ...frame, x: 1213 }, { ...base, others: row });
        expect(snapped.x).toBe(1220);
        expect(spacings).toEqual([]);
    });

    it('snaps a dragged edge to the gap, too', () => {
        // The right edge of a block resized from x 700 to 897; gap 100 to the block at 1000.
        const others = [...row, { x: 1000, y: 400, width: 100, height: 100 }];
        const { frame: snapped, spacings } = snapResize({ x: 700, y: 410, width: 197, height: 100 }, 'e', { ...base, others, grid: 0 });
        expect(snapped.x + snapped.width).toBe(900);
        expect(spacings.length).toBeGreaterThan(0);
    });
});
