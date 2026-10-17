import { describe, expect, it } from 'vitest';
import { dropRegion, emptyRegions, fitToRegions, frameFixed, type Region, FOOTER_SHARE, HEADER_SHARE, layoutRegions, REGION_GAPS, REGION_MARGIN } from './layout-regions';

type Two = [Region, Region];
type Four = [Region, Region, Region, Region];
const landscape = { width: 1920, height: 1080 };
const portrait = { width: 1080, height: 1920 };

describe('layoutRegions', () => {
    it('keeps its numbers', () => {
        expect([REGION_MARGIN, HEADER_SHARE, FOOTER_SHARE]).toEqual([0.04, 0.14, 0.1]);
    });

    it('has no areas without a division, header and footer', () => {
        expect(layoutRegions(undefined, landscape)).toEqual([]);
        expect(layoutRegions({ split: 'none', header: false, footer: false }, landscape)).toEqual([]);
    });

    it('makes one main area of the rest when only header or footer is on', () => {
        // margin 43 (4 % of 1080), header 151
        expect(layoutRegions({ split: 'none', header: true, footer: false }, landscape)).toEqual([
            { id: 'header', x: 43, y: 43, width: 1834, height: 151 },
            { id: 'main', x: 43, y: 237, width: 1834, height: 800 },
        ]);
        expect(layoutRegions({ split: 'none', header: false, footer: true }, landscape)).toEqual([
            { id: 'footer', x: 43, y: 929, width: 1834, height: 108 },
            { id: 'main', x: 43, y: 43, width: 1834, height: 843 },
        ]);
    });

    it('divides landscape into columns', () => {
        const halves = layoutRegions({ split: 'halves', header: false, footer: false }, landscape);
        expect(halves).toEqual([
            { id: 'a', x: 43, y: 43, width: 896, height: 994 },
            { id: 'b', x: 982, y: 43, width: 895, height: 994 },
        ]);
        const [a, b] = layoutRegions({ split: 'wide-narrow', header: false, footer: false }, landscape) as Two;
        expect(a.width).toBeGreaterThan(b.width);
        expect(a.width).toBe(Math.round((1834 - 43) * (2 / 3)));
        expect(a.x + a.width + 43).toBe(b.x);
        expect(b.x + b.width).toBe(1877);
        const [c, d] = layoutRegions({ split: 'narrow-wide', header: false, footer: false }, landscape) as Two;
        expect(c.width).toBeLessThan(d.width);
    });

    it('divides portrait into rows', () => {
        const [a, b] = layoutRegions({ split: 'halves', header: false, footer: false }, portrait) as Two;
        expect(a).toMatchObject({ x: 43, y: 43, width: 994 });
        expect(b.y).toBe(a.y + a.height + 43);
        expect(b.y + b.height).toBe(1920 - 43);
        const [w, n] = layoutRegions({ split: 'wide-narrow', header: false, footer: false }, portrait) as Two;
        expect(w.height).toBeGreaterThan(n.height);
    });

    it('puts header and footer around the division', () => {
        const regions = layoutRegions({ split: 'wide-narrow', header: true, footer: true }, landscape);
        expect(regions.map((r) => r.id)).toEqual(['header', 'footer', 'a', 'b']);
        const [header, footer, a, b] = regions as Four;
        expect(a.y).toBe(header.y + header.height + 43);
        expect(a.y + a.height + 43).toBe(footer.y);
        expect(b.y).toBe(a.y);
        expect(footer.y + footer.height).toBe(1080 - 43);
    });

    it('takes margin and gap from the chosen step (Plan.md 92)', () => {
        expect(REGION_GAPS).toEqual({ none: 0, tight: 0.02, normal: 0.04, wide: 0.06 });
        const halves = (gap?: 'none' | 'tight' | 'normal' | 'wide') => layoutRegions({ split: 'halves', header: false, footer: false, gap }, landscape) as Two;
        expect(halves('normal')).toEqual(halves());
        // none: from edge to edge, the areas touch
        expect(halves('none')).toEqual([
            { id: 'a', x: 0, y: 0, width: 960, height: 1080 },
            { id: 'b', x: 960, y: 0, width: 960, height: 1080 },
        ]);
        // wide: 65 (6 % of 1080) as margin and as gap, everything still fits
        const [a, b] = halves('wide');
        expect(a).toMatchObject({ x: 65, y: 65, height: 950 });
        expect(b.x).toBe(a.x + a.width + 65);
        expect(b.x + b.width).toBe(1920 - 65);
        const [header, main] = layoutRegions({ split: 'none', header: true, footer: false, gap: 'tight' }, landscape) as Two;
        expect(header).toMatchObject({ x: 22, y: 22 });
        expect(main.y).toBe(header.y + header.height + 22);
    });
});

describe('emptyRegions', () => {
    const regions = layoutRegions({ split: 'halves', header: true, footer: false }, landscape);

    it('is all of them without blocks', () => {
        expect(emptyRegions(regions, [])).toHaveLength(3);
    });

    it('counts a block by its centre', () => {
        const inA = { x: 100, y: 300, width: 200, height: 100 };
        expect(emptyRegions(regions, [inA]).map((r) => r.id)).toEqual(['header', 'b']);
        // Mostly in A, but the centre lies in B.
        const across = { x: 800, y: 300, width: 800, height: 100 };
        expect(emptyRegions(regions, [across]).map((r) => r.id)).toEqual(['header', 'a']);
    });

    it('counts a block centred in the gap for both columns it spans', () => {
        const wide = { x: 200, y: 400, width: 1520, height: 300 };
        expect(emptyRegions(regions, [wide]).map((r) => r.id)).toEqual(['header']);
    });
});

describe('fixed blocks', () => {
    const halves = layoutRegions({ split: 'halves', header: false, footer: false }, landscape);
    const [a, b] = halves as Two;
    const shape = (id: string, region?: 'a' | 'b' | 'main') => ({ id, type: 'shape', x: 0, y: 0, width: 100, height: 100, ...(region ? { region } : {}) });

    it('counts locked and bound blocks as fixed', () => {
        expect(frameFixed({})).toBe(false);
        expect(frameFixed({ locked: true })).toBe(true);
        expect(frameFixed({ region: 'a' })).toBe(true);
    });

    it('fills its area wherever its middle is', () => {
        expect(emptyRegions(halves, [{ ...shape('x', 'b'), x: 1500, y: 2000 }]).map((r) => r.id)).toEqual(['a']);
    });

    it('takes the new frame of the area, or lets go where the area is gone', () => {
        const wide = layoutRegions({ split: 'wide-narrow', header: false, footer: false }, landscape) as Two;
        const [fixed, free, gone] = fitToRegions([shape('f', 'a'), shape('p'), shape('g', 'main')], wide);
        expect(fixed).toMatchObject({ x: wide[0].x, y: wide[0].y, width: wide[0].width, height: wide[0].height, region: 'a' });
        expect(free).toEqual(shape('p'));
        expect(gone).not.toHaveProperty('region');
        expect(gone).toMatchObject({ x: 0, width: 100 });
        expect(a.width).not.toBe(wide[0].width);
    });

    it('moves only the corner of a template block', () => {
        const [moved] = fitToRegions([{ ...shape('t', 'b'), type: 'template' }], halves);
        expect(moved).toMatchObject({ x: b.x, y: b.y, width: 100, height: 100 });
    });
});

describe('dropRegion', () => {
    const halves = layoutRegions({ split: 'halves', header: false, footer: false }, landscape);
    const block = (id: string, x: number, extra: Record<string, unknown> = {}) => ({ id, x, y: 300, width: 200, height: 100, ...extra });

    it('is the empty area under the middle', () => {
        expect(dropRegion(block('x', 1200), halves, [block('x', 1200)])?.id).toBe('b');
    });

    it('is none for an occupied area, even by a block fixed elsewhere in it', () => {
        const other = block('o', 1300);
        expect(dropRegion(block('x', 1200), halves, [block('x', 1200), other])).toBeUndefined();
        expect(dropRegion(block('x', 1200), halves, [block('x', 1200), block('f', 0, { region: 'b' })])).toBeUndefined();
    });

    it('is none outside the areas, and for a locked or fixed block', () => {
        expect(dropRegion(block('x', 860), halves, [])).toBeUndefined();
        expect(dropRegion(block('x', 1200, { locked: true }), halves, [])).toBeUndefined();
        expect(dropRegion(block('x', 1200, { region: 'b' }), halves, [])).toBeUndefined();
    });

    it('is none for a block moved within the area it started in, and the area for one coming from outside', () => {
        expect(dropRegion(block('x', 1200), halves, [], block('x', 1100))).toBeUndefined();
        expect(dropRegion(block('x', 1200), halves, [], block('x', 300))?.id).toBe('b');
        expect(dropRegion(block('x', 1200), halves, [], block('x', 860))?.id).toBe('b');
    });
});
