import { describe, expect, it } from 'vitest';
import { effectiveTransition, pictureMotion } from './slideshow';

describe('slideshow motion (schema 1.19)', () => {
    it('plays the old transition zoom as a fade', () => {
        expect(effectiveTransition({ transition: 'zoom' })).toBe('fade');
        for (const transition of ['fade', 'slide', 'wipe', 'none'] as const) expect(effectiveTransition({ transition })).toBe(transition);
    });

    it('stands still without a motion, whatever the transition', () => {
        for (const transition of ['fade', 'slide', 'wipe', 'none'] as const) expect(pictureMotion({ transition, motion: 'none' }, 0)).toBe('none');
    });

    it('zooms in or out on every picture', () => {
        expect(pictureMotion({ transition: 'slide', motion: 'in' }, 3)).toBe('in');
        expect(pictureMotion({ transition: 'wipe', motion: 'out' }, 2)).toBe('out');
    });

    it('alternates, starting with in', () => {
        const block = { transition: 'fade', motion: 'alternate' } as const;
        expect([0, 1, 2, 3].map((i) => pictureMotion(block, i))).toEqual(['in', 'out', 'in', 'out']);
    });

    it('takes the old transition zoom without a motion as zooming in', () => {
        expect(pictureMotion({ transition: 'zoom', motion: 'none' }, 0)).toBe('in');
        expect(pictureMotion({ transition: 'zoom', motion: 'none' }, 1)).toBe('in');
    });

    it('lets a motion set next to the old zoom win', () => {
        expect(pictureMotion({ transition: 'zoom', motion: 'out' }, 0)).toBe('out');
        expect(pictureMotion({ transition: 'zoom', motion: 'alternate' }, 1)).toBe('out');
    });
});
