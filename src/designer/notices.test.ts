import { describe, expect, it } from 'vitest';
import type { Banner } from '../model/schema';
import { makePlaylist } from '../model/testing';
import type { PlaylistOverview, StagedPlaylist } from '../store/screen-repository';
import { bannerFaded, groupBanners, untilLabel } from './notices';

const TZ = 'Europe/Berlin';
const STAGE = { width: 1920, height: 1080 };

function banner(overrides: Partial<Banner> = {}): Banner {
    return {
        text: 'Heute Parkplatz gesperrt',
        mode: 'scroll',
        position: 'bottom',
        height: 90,
        speed: 140,
        background: '#1e293b',
        style: { fontFamily: 'lato', fontSize: 32, fontWeight: 600, color: '#ffffff', align: 'left' },
        ...overrides,
    };
}

function overview(overrides: Partial<StagedPlaylist> = {}, screens: PlaylistOverview['screens'] = []): PlaylistOverview {
    const playlist: StagedPlaylist = { ...makePlaylist(), stage: STAGE, revision: 1, ...overrides };
    return { playlist, firstSlide: null, slideCount: 0, media: [], screens, editedAt: null, editedBy: null };
}

describe('groupBanners (Plan.md, Nächste Schritte 34)', () => {
    it('groups playlists whose band reads exactly the same, merging their screens', () => {
        const same = banner();
        const overviews = [
            overview({ id: 'a', banner: same }, [{ id: 's1', slug: 'foyer', name: 'Foyer' }]),
            overview({ id: 'b', banner: same }, [{ id: 's1', slug: 'foyer', name: 'Foyer' }, { id: 's2', slug: 'cafe', name: 'Café' }]),
            overview({ id: 'c' }), // no band at all – left out
        ];
        const groups = groupBanners(overviews, new Date('2026-01-01T10:00:00Z'), TZ);
        expect(groups).toHaveLength(1);
        expect(groups[0]?.playlists.map((p) => p.playlist.id)).toEqual(['a', 'b']);
        expect(groups[0]?.screens.map((s) => s.id)).toEqual(['s1', 's2']);
    });

    it('keeps playlists with different bands apart', () => {
        const overviews = [
            overview({ id: 'a', banner: banner({ text: 'Parkplatz gesperrt' }) }),
            overview({ id: 'b', banner: banner({ text: 'Kirchencafé heute im Foyer' }) }),
        ];
        const groups = groupBanners(overviews, new Date('2026-01-01T10:00:00Z'), TZ);
        expect(groups).toHaveLength(2);
        expect(groups.map((g) => g.banner.text).sort()).toEqual(['Kirchencafé heute im Foyer', 'Parkplatz gesperrt']);
    });

    it('groups bands that differ only in their stamp and shows the newest one (Plan.md 66)', () => {
        const overviews = [
            overview({ id: 'a', banner: banner({ updatedAt: '2026-01-01T08:00:00.000Z', updatedBy: 'Anna' }) }),
            overview({ id: 'b', banner: banner({ updatedAt: '2026-01-01T09:00:00.000Z', updatedBy: 'Ben' }) }),
            overview({ id: 'c', banner: banner() }), // saved before schema 1.23
        ];
        const groups = groupBanners(overviews, new Date('2026-01-01T10:00:00Z'), TZ);
        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatchObject({ updatedAt: '2026-01-01T09:00:00.000Z', updatedBy: 'Ben' });
    });

    it('leaves the stamp out for bands saved before schema 1.23', () => {
        const groups = groupBanners([overview({ id: 'a', banner: banner() })], new Date('2026-01-01T10:00:00Z'), TZ);
        expect(groups[0]?.updatedAt).toBeUndefined();
        expect(groups[0]?.updatedBy).toBeUndefined();
    });

    it('marks a band whose "until" has passed as expired, apart from a running one', () => {
        // "Vorbei" lies within the 7-day grace period of Plan.md 38 – it still shows, just as expired.
        const overviews = [
            overview({ id: 'a', banner: banner({ text: 'Vorbei', until: '2025-12-28T10:00' }) }),
            overview({ id: 'b', banner: banner({ text: 'Läuft noch', until: '2099-01-01T10:00' }) }),
        ];
        const groups = groupBanners(overviews, new Date('2026-01-01T10:00:00Z'), TZ);
        expect(groups).toHaveLength(2);
        expect(groups.find((g) => g.banner.text === 'Vorbei')?.expired).toBe(true);
        expect(groups.find((g) => g.banner.text === 'Läuft noch')?.expired).toBe(false);
    });
});

describe('bannerFaded (Plan.md, Nächste Schritte 38)', () => {
    it('still shows a band 6 days 23 hours after "until", but not once a full 7 days have passed', () => {
        const b = banner({ until: '2026-01-10T18:00' });
        // Berlin sits at UTC+1 in January – the wall time is one hour ahead of the instant.
        const almost = new Date('2026-01-17T16:00:00Z'); // wall time 2026-01-17T17:00, 6d23h after "until"
        const exactly = new Date('2026-01-17T17:00:00Z'); // wall time 2026-01-17T18:00, a full 7 days after
        expect(bannerFaded(b, almost, TZ)).toBe(false);
        expect(bannerFaded(b, exactly, TZ)).toBe(true);
    });

    it('carries the 7 days over a month change', () => {
        const b = banner({ until: '2026-01-28T10:00' });
        const almost = new Date('2026-02-04T08:59:00Z'); // wall time 2026-02-04T09:59
        const exactly = new Date('2026-02-04T09:00:00Z'); // wall time 2026-02-04T10:00, 7 days later
        expect(bannerFaded(b, almost, TZ)).toBe(false);
        expect(bannerFaded(b, exactly, TZ)).toBe(true);
    });

    it('carries the 7 calendar days across the time change at the end of October, without a fixed offset', () => {
        // "until" falls before the change (CEST, UTC+2); the fade date falls after it (CET, UTC+1) – the
        // naive wall-time text stays "2026-10-29T18:00" either way, the instant behind it does not.
        const b = banner({ until: '2026-10-22T18:00' });
        const almost = new Date('2026-10-29T16:59:00Z'); // wall time 2026-10-29T17:59 (Berlin at UTC+1)
        const exactly = new Date('2026-10-29T17:00:00Z'); // wall time 2026-10-29T18:00, a full 7 days later
        expect(bannerFaded(b, almost, TZ)).toBe(false);
        expect(bannerFaded(b, exactly, TZ)).toBe(true);
    });

    it('never fades a band without an "until"', () => {
        const b = banner();
        expect(bannerFaded(b, new Date('2099-01-01T00:00:00Z'), TZ)).toBe(false);
    });
});

describe('groupBanners leaving faded bands out (Plan.md, Nächste Schritte 38)', () => {
    it('drops a band 7 days past "until" entirely, not even under "Abgelaufen"', () => {
        const overviews = [overview({ id: 'a', banner: banner({ until: '2026-01-10T18:00' }) })];
        const groups = groupBanners(overviews, new Date('2026-01-17T17:00:00Z'), TZ);
        expect(groups).toHaveLength(0);
    });
});

describe('untilLabel', () => {
    it('shows the church wall time as it stands, without converting a time zone', () => {
        expect(untilLabel('2026-09-27T18:00')).toMatch(/^bis .*27\.09\..*18:00$/);
    });

    it('says "ohne Ende" without one', () => {
        expect(untilLabel(undefined)).toBe('ohne Ende');
        expect(untilLabel('')).toBe('ohne Ende');
    });
});
