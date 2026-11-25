import { describe, expect, it } from 'vitest';
import { embeddedPlaylistIds, shownSlideIds, shownStand } from './embeds';
import { makePlaylist } from './testing';

describe('a presentation inside another (Plan.md 120)', () => {
    const main = makePlaylist({ id: 'main', slideIds: ['m1', 'm2'] });
    const outer = (position: number, more = {}) => makePlaylist({ id: 'outer', slideIds: ['a', 'b'], embeds: [{ playlistId: 'main', position }], ...more });

    it('puts the slides of the main part at its position', () => {
        expect(shownSlideIds(outer(0), [main])).toEqual(['m1', 'm2', 'a', 'b']);
        expect(shownSlideIds(outer(1), [main])).toEqual(['a', 'm1', 'm2', 'b']);
        expect(shownSlideIds(outer(2), [main])).toEqual(['a', 'b', 'm1', 'm2']);
        expect(shownSlideIds(outer(9), [main])).toEqual(['a', 'b', 'm1', 'm2']);
    });

    it('shows only the own slides without embeds, and keeps the order of several at one position', () => {
        expect(shownSlideIds(makePlaylist({ slideIds: ['a', 'b'] }), [main])).toEqual(['a', 'b']);
        const other = makePlaylist({ id: 'other', slideIds: ['o1'] });
        const both = makePlaylist({ id: 'outer', slideIds: ['a'], embeds: [{ playlistId: 'other', position: 1 }, { playlistId: 'main', position: 1 }] });
        expect(shownSlideIds(both, [main, other])).toEqual(['a', 'o1', 'm1', 'm2']);
    });

    it('skips an unknown presentation, itself, another format and a second level', () => {
        expect(shownSlideIds(outer(1), [])).toEqual(['a', 'b']);
        expect(shownSlideIds(outer(1, { embeds: [{ playlistId: 'outer', position: 1 }] }), [])).toEqual(['a', 'b']);
        const square = { ...main, stage: { width: 1080, height: 1080 } };
        expect(shownSlideIds(outer(1, { stage: { width: 1920, height: 1080 } }), [square])).toEqual(['a', 'b']);
        const deep = { ...main, embeds: [{ playlistId: 'third', position: 0 }] };
        const third = makePlaylist({ id: 'third', slideIds: ['t1'] });
        expect(shownSlideIds(outer(1), [deep, third])).toEqual(['a', 'm1', 'm2', 'b']);
    });

    it('names the presentations to load as well, one level deep', () => {
        const deep = { ...main, embeds: [{ playlistId: 'third', position: 0 }] };
        expect(embeddedPlaylistIds([outer(0)])).toEqual(['main']);
        expect(embeddedPlaylistIds([outer(0), deep])).toEqual(['third']);
        expect(embeddedPlaylistIds([main])).toEqual([]);
    });

    it('reports a publish of the main part as the state the outer one shows', () => {
        const slides = [{ id: 'a', updatedAt: '2026-11-01T10:00:00Z' }, { id: 'm1', updatedAt: '2026-11-03T10:00:00Z' }];
        const own = outer(1, { updatedAt: '2026-11-02T10:00:00Z' });
        expect(shownStand(own, [{ ...main, updatedAt: '2026-11-01T00:00:00Z' }], slides)).toBe('2026-11-03T10:00:00Z');
        expect(shownStand(own, [{ ...main, updatedAt: '2026-11-04T00:00:00Z' }], slides)).toBe('2026-11-04T00:00:00Z');
        expect(shownStand({ ...own, embeds: [] }, [main], slides)).toBe('2026-11-02T10:00:00Z');
    });
});
