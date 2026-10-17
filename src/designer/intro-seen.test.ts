import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    window.localStorage.clear();
});

describe('intro-seen (Plan.md 81: the card shows until it was started, dismissed or closed)', () => {
    it('is unseen at first, remembers once marked and reads it back after a reload', async () => {
        const first = await import('./intro-seen');
        expect(first.introSeen.value).toBe(false);
        first.markIntroSeen();
        expect(first.introSeen.value).toBe(true);
        expect(window.localStorage.getItem('infoscreen-designer:intro-seen')).toBe('1');
        vi.resetModules();
        expect((await import('./intro-seen')).introSeen.value).toBe(true);
    });

    it('throws nothing without storage and only keeps the answer for this page', async () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        const seen = await import('./intro-seen');
        expect(seen.introSeen.value).toBe(false);
        expect(() => seen.markIntroSeen()).not.toThrow();
        expect(seen.introSeen.value).toBe(true);
    });
});
