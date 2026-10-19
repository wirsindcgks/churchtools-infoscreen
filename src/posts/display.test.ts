import { describe, expect, it } from 'vitest';
import { imageAspect, postImageArea, postPictures, relativeAge } from './display';

const BERLIN = 'Europe/Berlin';

describe('relativeAge', () => {
    it('says "heute" for a post from earlier the same calendar day', () => {
        const published = new Date('2026-09-25T06:00:00Z');
        const now = new Date('2026-09-25T20:00:00Z');
        expect(relativeAge(published, now, BERLIN)).toBe('heute');
    });

    it('says "gestern" for the day before', () => {
        const published = new Date('2026-09-24T20:00:00Z');
        const now = new Date('2026-09-25T06:00:00Z');
        expect(relativeAge(published, now, BERLIN)).toBe('gestern');
    });

    it('counts days for two to six days', () => {
        const now = new Date('2026-09-25T12:00:00Z');
        expect(relativeAge(new Date('2026-09-23T12:00:00Z'), now, BERLIN)).toBe('vor 2 Tagen');
        expect(relativeAge(new Date('2026-09-19T12:00:00Z'), now, BERLIN)).toBe('vor 6 Tagen');
    });

    it('falls back to the date without a weekday from the seventh day on', () => {
        const now = new Date('2026-09-25T12:00:00Z');
        expect(relativeAge(new Date('2026-09-18T12:00:00Z'), now, BERLIN)).toBe('Freitag, 18. September');
    });

    it('crosses midnight by the Berlin calendar day, not by elapsed hours', () => {
        // 2026-09-25 23:50 in Berlin (CEST, UTC+2)
        const published = new Date('2026-09-25T21:50:00Z');
        // 2026-09-26 00:10 in Berlin – twenty minutes later, but the next calendar day
        const now = new Date('2026-09-25T22:10:00Z');
        expect(relativeAge(published, now, BERLIN)).toBe('gestern');
    });
});

describe('imageAspect', () => {
    it('is square without a ratio', () => {
        expect(imageAspect(null)).toBe(1);
    });

    it('passes an aspect within Instagram\'s bounds through', () => {
        expect(imageAspect(1.5)).toBe(1.5);
    });

    it('clamps a taller image to 4:5', () => {
        expect(imageAspect(0.5)).toBe(0.8);
    });

    it('clamps a wider image to 1.91:1', () => {
        expect(imageAspect(3)).toBe(1.91);
    });
});

describe('postPictures', () => {
    it('falls back to the first picture for a state cached before `images`', () => {
        expect(postPictures({ imageUrl: 'u', imageRatio: 1.5 })).toEqual([{ url: 'u', ratio: 1.5 }]);
        expect(postPictures({ imageUrl: null, imageRatio: null })).toEqual([]);
        expect(postPictures({ images: [{ url: 'a', ratio: 1 }], imageUrl: 'u', imageRatio: 2 })).toEqual([{ url: 'a', ratio: 1 }]);
    });
});

describe('postImageArea (Plan.md 96)', () => {
    const wide = { url: 'wide', ratio: 1.9 };
    const square = { url: 'square', ratio: 1 };
    const tall = { url: 'tall', ratio: 0.8 };
    const landscape = { width: 1400, height: 700 };

    it('sizes the area like the card: full height, at most 60 % of the width across', () => {
        expect(postImageArea([square], landscape, { fit: 'cover', full: false })).toMatchObject({ width: 700, height: 700 });
        expect(postImageArea([wide], landscape, { fit: 'cover', full: false })).toMatchObject({ width: 840, height: 700 });
        expect(postImageArea([square], { width: 700, height: 1000 }, { fit: 'cover', full: false })).toMatchObject({ width: 700, height: 600 });
        expect(postImageArea([square], landscape, { fit: 'cover', full: true })).toMatchObject({ width: 1400, height: 700 });
        expect(postImageArea([], landscape, { fit: 'cover', full: false })).toBeNull();
    });

    it('fills with the first picture; "Ganz zeigen" takes the one with the least empty space', () => {
        expect(postImageArea([wide, square], landscape, { fit: 'cover', full: false })?.picture).toBe(wide);
        // Whole card as the area: a wide picture fits 2:1 better than a square one.
        expect(postImageArea([square, wide], landscape, { fit: 'contain', full: true })?.picture).toBe(wide);
        expect(postImageArea([tall, square, wide], landscape, { fit: 'contain', full: true })?.picture).toBe(wide);
    });

    it('keeps the earlier picture when two fit about equally', () => {
        const near = { url: 'near', ratio: 1.02 };
        expect(postImageArea([square, near], landscape, { fit: 'contain', full: false })?.picture).toBe(square);
        expect(postImageArea([near, square], landscape, { fit: 'contain', full: false })?.picture).toBe(near);
    });
});
