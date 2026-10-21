import { describe, expect, it } from 'vitest';
import { dropRegion, emptyRegions, fitToRegions, frameFixed, type Region, FOOTER_SHARE, HEADER_SHARE, layoutRegions, REGION_GAPS, REGION_MARGIN, REGION_STEP } from './layout-regions';

type Two = [Region, Region];
type Four = [Region, Region, Region, Region];
const landscape = { width: 1920, height: 1080 };
const portrait = { width: 1080, height: 1920 };

describe('layoutRegions', () => {
    it('keeps its numbers', () => {
        expect([REGION_MARGIN, HEADER_SHARE, FOOTER_SHARE, REGION_STEP]).toEqual([40, 0.14, 0.1, 20]);
    });

    it('has no areas without a division, header and footer', () => {
        expect(layoutRegions(undefined, landscape)).toEqual([]);
        expect(layoutRegions({ split: 'none', header: false, footer: false }, landscape)).toEqual([]);
    });

    it('makes one main area of the rest when only header or footer is on', () => {
        // margin 40, header 160 (14 % of 1080 = 151 on the 20 px step), footer 100 (108)
        expect(layoutRegions({ split: 'none', header: true, footer: false }, landscape)).toEqual([
            { id: 'header', x: 40, y: 40, width: 1840, height: 160 },
            { id: 'main', x: 40, y: 240, width: 1840, height: 800 },
        ]);
        expect(layoutRegions({ split: 'none', header: false, footer: true }, landscape)).toEqual([
            { id: 'footer', x: 40, y: 940, width: 1840, height: 100 },
            { id: 'main', x: 40, y: 40, width: 1840, height: 860 },
        ]);
    });

    it('divides landscape into columns', () => {
        const halves = layoutRegions({ split: 'halves', header: false, footer: false }, landscape);
        expect(halves).toEqual([
            { id: 'a', x: 40, y: 40, width: 900, height: 1000 },
            { id: 'b', x: 980, y: 40, width: 900, height: 1000 },
        ]);
        const [a, b] = layoutRegions({ split: 'wide-narrow', header: false, footer: false }, landscape) as Two;
        expect([a.width, b.x, b.width]).toEqual([1200, 1280, 600]);
        const [c, d] = layoutRegions({ split: 'narrow-wide', header: false, footer: false }, landscape) as Two;
        expect([c.width, d.x, d.width]).toEqual([600, 680, 1200]);
    });

    it('divides portrait into rows', () => {
        const [a, b] = layoutRegions({ split: 'halves', header: false, footer: false }, portrait) as Two;
        expect(a).toEqual({ id: 'a', x: 40, y: 40, width: 1000, height: 900 });
        expect(b).toEqual({ id: 'b', x: 40, y: 980, width: 1000, height: 900 });
        const [w, n] = layoutRegions({ split: 'wide-narrow', header: true, footer: true }, portrait).slice(2) as Two;
        expect(w.height).toBeGreaterThan(n.height);
    });

    it('puts header and footer around the division', () => {
        const regions = layoutRegions({ split: 'wide-narrow', header: true, footer: true }, landscape);
        expect(regions.map((r) => r.id)).toEqual(['header', 'footer', 'a', 'b']);
        const [header, footer, a, b] = regions as Four;
        expect(a.y).toBe(header.y + header.height + 40);
        expect(a.y + a.height + 40).toBe(footer.y);
        expect(b.y).toBe(a.y);
        expect(footer.y + footer.height).toBe(1080 - 40);
        const [ph, pf] = layoutRegions({ split: 'none', header: true, footer: true }, portrait) as Two;
        expect([ph.height, pf.height]).toEqual([260, 200]);
    });

    it('takes margin and gap from the chosen step (Plan.md 92)', () => {
        expect(REGION_GAPS).toEqual({ none: 0, tight: 20, normal: 40, wide: 60 });
        const halves = (gap?: 'none' | 'tight' | 'normal' | 'wide') => layoutRegions({ split: 'halves', header: false, footer: false, gap }, landscape) as Two;
        expect(halves('normal')).toEqual(halves());
        // none: from edge to edge, the areas touch
        expect(halves('none')).toEqual([
            { id: 'a', x: 0, y: 0, width: 960, height: 1080 },
            { id: 'b', x: 960, y: 0, width: 960, height: 1080 },
        ]);
        // wide: 60 as margin and as gap, everything still fits
        expect(halves('wide')).toEqual([
            { id: 'a', x: 60, y: 60, width: 870, height: 960 },
            { id: 'b', x: 990, y: 60, width: 870, height: 960 },
        ]);
        const [header, main] = layoutRegions({ split: 'none', header: true, footer: false, gap: 'tight' }, landscape) as Two;
        expect(header).toMatchObject({ x: 20, y: 20 });
        expect(main.y).toBe(header.y + header.height + 20);
    });

    it('puts every edge on the 20 px grid, halves stay equal (Plan.md 104)', () => {
        for (const stage of [landscape, portrait]) {
            for (const gap of ['none', 'tight', 'normal', 'wide'] as const) {
                for (const split of ['none', 'halves', 'wide-narrow', 'narrow-wide'] as const) {
                    const regions = layoutRegions({ split, header: true, footer: true, gap }, stage);
                    const edges = regions.flatMap((r) => [r.x, r.y, r.x + r.width, r.y + r.height]);
                    // equal halves may leave the middle on the 10 px grid
                    expect(edges.every((e) => e % (split === 'halves' ? 10 : 20) === 0)).toBe(true);
                    if (split === 'halves') {
                        const [, , a, b] = regions as Four;
                        expect(stage.width > stage.height ? a.width === b.width : a.height === b.height).toBe(true);
                    }
                }
            }
        }
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

    it('is the area a block starts in, but not the one it was let go from', () => {
        expect(dropRegion(block('x', 1200), halves, [])?.id).toBe('b');
        expect(dropRegion(block('x', 1200), halves, [], { released: 'b' })).toBeUndefined();
        expect(dropRegion(block('x', 300), halves, [], { released: 'b' })?.id).toBe('a');
    });

    it('takes the area under the pointer, not under the middle of a block grabbed at its edge', () => {
        const big = { id: 'x', x: 400, y: 300, width: 800, height: 400 };
        expect(dropRegion(big, halves, [], { point: { x: 1150, y: 500 } })?.id).toBe('b');
        expect(dropRegion(big, halves, [], { point: { x: 300, y: 500 } })?.id).toBe('a');
        expect(dropRegion(big, halves, [], { point: { x: 960, y: 500 } })).toBeUndefined();
    });

    it('lets a backdrop over the whole stage leave the areas free', () => {
        const backdrop = { id: 'bg', x: 0, y: 0, width: 1920, height: 1080 };
        expect(dropRegion(block('x', 1200), halves, [backdrop], { stage: landscape })?.id).toBe('b');
        expect(dropRegion(block('x', 1200), halves, [backdrop])).toBeUndefined();
        expect(emptyRegions(halves, [backdrop], landscape).map((r) => r.id)).toEqual(['a', 'b']);
    });
});
