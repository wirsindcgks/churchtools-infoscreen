import { describe, expect, it } from 'vitest';
import { fitStage } from '../player/stage';
import { clampPan, MAX_ZOOM, viewOnto, WHOLE, zoomAt, zoomedFit } from './stage-zoom';

const stage = { width: 1920, height: 1080 };
const host = { width: 800, height: 600 };
const base = fitStage(host, stage); // 800 × 450, a rim of 75 above and below

/** The stage point under a host point. */
function under(fit: ReturnType<typeof zoomedFit>, x: number, y: number) {
    return { x: (x - fit.offsetX) / fit.scale, y: (y - fit.offsetY) / fit.scale };
}

describe('zoomedFit', () => {
    it('is the base at zoom 1 and scales and shifts otherwise', () => {
        expect(zoomedFit(base, WHOLE)).toEqual(base);
        const fit = zoomedFit(base, { zoom: 2, panX: -100, panY: -20 });
        expect(fit.scale).toBeCloseTo(base.scale * 2);
        expect(fit.offsetX).toBe(base.offsetX - 100);
        expect(fit.offsetY).toBe(base.offsetY - 20);
    });
});

describe('zoomAt', () => {
    it('keeps the point under the fingers where it was', () => {
        const point = { x: 300, y: 250 };
        const view = zoomAt(base, WHOLE, point, 2.5);
        const before = under(zoomedFit(base, WHOLE), point.x, point.y);
        const after = under(zoomedFit(base, view), point.x, point.y);
        expect(after.x).toBeCloseTo(before.x);
        expect(after.y).toBeCloseTo(before.y);
        // And once more from the zoomed view.
        const again = zoomAt(base, view, { x: 500, y: 320 }, 1.2);
        const a = under(zoomedFit(base, view), 500, 320);
        const b = under(zoomedFit(base, again), 500, 320);
        expect(b.x).toBeCloseTo(a.x);
        expect(b.y).toBeCloseTo(a.y);
    });

    it('stays within 1 to 4', () => {
        expect(zoomAt(base, WHOLE, { x: 400, y: 300 }, 10).zoom).toBe(MAX_ZOOM);
        expect(zoomAt(base, WHOLE, { x: 400, y: 300 }, 0.1, host)).toEqual(WHOLE);
        expect(zoomAt(base, { zoom: 2, panX: -300, panY: -100 }, { x: 400, y: 300 }, 0.1, host)).toEqual(WHOLE);
    });
});

describe('clampPan', () => {
    it('covers the host as far as it goes and lets no rim grow', () => {
        const view = clampPan(base, { zoom: 2, panX: 500, panY: 500 }, host);
        const fit = zoomedFit(base, view);
        expect(fit.offsetX).toBe(0); // 1600 wide > 800: left edge flush
        expect(fit.offsetY).toBe(0); // 900 high > 600: top edge flush
        const far = clampPan(base, { zoom: 2, panX: -5000, panY: -5000 }, host);
        const farFit = zoomedFit(base, far);
        expect(farFit.offsetX + stage.width * farFit.scale).toBe(800);
        expect(farFit.offsetY + stage.height * farFit.scale).toBe(600);
    });

    it('keeps a stage still smaller than the host in the middle', () => {
        const view = clampPan(base, { zoom: 1.2, panX: 40, panY: 40 }, host);
        const fit = zoomedFit(base, view);
        expect(fit.offsetY + (stage.height * fit.scale) / 2).toBeCloseTo(300);
    });

    it('has no pan at zoom 1', () => {
        expect(clampPan(base, { zoom: 1, panX: 30, panY: -30 }, host)).toEqual(WHOLE);
    });
});

describe('viewOnto', () => {
    it('fills 90 % of the host with the block, centred sideways, 16 px from the top', () => {
        const rect = { x: 480, y: 100, width: 960 };
        const view = viewOnto(base, rect, host, 0.9, 16);
        const fit = zoomedFit(base, view);
        expect(view.zoom).toBeGreaterThan(1);
        expect(rect.width * fit.scale).toBeCloseTo(720);
        expect(fit.offsetX + (rect.x + rect.width / 2) * fit.scale).toBeCloseTo(400);
        expect(fit.offsetY + rect.y * fit.scale).toBeCloseTo(16);
    });

    it('zooms at most 4 times', () => {
        expect(viewOnto(base, { x: 0, y: 0, width: 100 }, host, 0.9, 16).zoom).toBe(MAX_ZOOM);
    });
});
