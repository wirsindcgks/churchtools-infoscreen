import { describe, expect, it } from 'vitest';
import { cropPan } from './crop';

describe('cropPan (Plan.md F2)', () => {
    // A 1600 × 900 picture in a 800 × 800 frame at "Füllen": 1422 × 800, so 622 px overhang across, none down.
    const box = { width: 800, height: 800 };
    const natural = { width: 1600, height: 900 };

    it('follows the finger: dragging right shows more of the left, so the place goes down', () => {
        const crop = cropPan({ x: 50, y: 50, zoom: 1 }, box, natural, 100, 0);
        expect(crop.x).toBeCloseTo(50 - (100 / (1600 * (800 / 900) - 800)) * 100, 1);
        expect(crop.x).toBeLessThan(50);
        expect(cropPan({ x: 50, y: 50, zoom: 1 }, box, natural, -100, 0).x).toBeGreaterThan(50);
    });

    it('stays within 0 … 100', () => {
        expect(cropPan({ x: 10, y: 50, zoom: 1 }, box, natural, 5000, 0).x).toBe(0);
        expect(cropPan({ x: 90, y: 50, zoom: 1 }, box, natural, -5000, 0).x).toBe(100);
    });

    it('leaves an axis without an overhang alone, and starts at the middle without a crop', () => {
        expect(cropPan({ x: 50, y: 30, zoom: 1 }, box, natural, 0, 200).y).toBe(30);
        expect(cropPan(undefined, box, natural, 0, 200)).toEqual({ x: 50, y: 50, zoom: 1 });
    });

    it('gets an overhang from the zoom and keeps the zoom', () => {
        const crop = cropPan({ x: 50, y: 50, zoom: 2 }, box, natural, 0, 100);
        expect(crop.zoom).toBe(2);
        expect(crop.y).toBeCloseTo(50 - (100 / (2 * 800 - 800)) * 100, 1);
    });

    it('does nothing for a picture of unknown size', () => {
        expect(cropPan({ x: 20, y: 20, zoom: 1 }, box, { width: 0, height: 0 }, 50, 50)).toEqual({ x: 20, y: 20, zoom: 1 });
    });
});
