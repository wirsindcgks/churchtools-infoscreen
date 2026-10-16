import { describe, expect, it } from 'vitest';
import { emptyRegions, type Region, FOOTER_SHARE, HEADER_SHARE, layoutRegions, REGION_MARGIN } from './layout-regions';

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
