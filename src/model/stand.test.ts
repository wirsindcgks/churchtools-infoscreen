import { describe, expect, it } from 'vitest';
import { playlistStand } from './stand';

describe('playlistStand (Plan.md 111)', () => {
    const playlist = { updatedAt: '2026-10-05T10:00:00.000Z', slideIds: ['a', 'b'] };

    it('is the latest time of the playlist and its slides', () => {
        const slides = [
            { id: 'a', updatedAt: '2026-10-05T09:00:00.000Z' },
            { id: 'b', updatedAt: '2026-10-06T08:00:00.000Z' },
        ];
        expect(playlistStand(playlist, slides)).toBe('2026-10-06T08:00:00.000Z');
        expect(playlistStand(playlist, slides.slice(0, 1))).toBe('2026-10-05T10:00:00.000Z');
    });

    it('ignores slides of other playlists', () => {
        expect(playlistStand(playlist, [{ id: 'x', updatedAt: '2027-01-01T00:00:00.000Z' }])).toBe('2026-10-05T10:00:00.000Z');
    });

    it('is null without any time', () => {
        expect(playlistStand({ slideIds: ['a'] }, [{ id: 'a' }])).toBeNull();
    });
});
