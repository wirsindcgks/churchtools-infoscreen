import { describe, expect, it } from 'vitest';
import type { Banner } from '../model/schema';
import { makePlaylist } from '../model/testing';
import type { PlaylistOverview, StagedPlaylist } from '../store/screen-repository';
import { groupBanners, untilLabel } from './notices';

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
    return { playlist, firstSlide: null, slideCount: 0, media: [], screens };
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

    it('marks a band whose "until" has passed as expired, apart from a running one', () => {
        const overviews = [
            overview({ id: 'a', banner: banner({ text: 'Vorbei', until: '2020-01-01T10:00' }) }),
            overview({ id: 'b', banner: banner({ text: 'Läuft noch', until: '2099-01-01T10:00' }) }),
        ];
        const groups = groupBanners(overviews, new Date('2026-01-01T10:00:00Z'), TZ);
        expect(groups).toHaveLength(2);
        expect(groups.find((g) => g.banner.text === 'Vorbei')?.expired).toBe(true);
        expect(groups.find((g) => g.banner.text === 'Läuft noch')?.expired).toBe(false);
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
