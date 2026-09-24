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
