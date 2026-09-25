import { describe, expect, it } from 'vitest';
import { imageAspect, relativeAge } from './display';

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
