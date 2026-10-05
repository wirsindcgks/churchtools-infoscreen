import { describe, expect, it } from 'vitest';
import type { Banner } from '../model/schema';
import { makePlaylist, makeScreen } from '../model/testing';
import type { PlaylistOverview, StagedPlaylist } from '../store/screen-repository';
import { bannerFaded, groupBanners, noticeTimeline, untilLabel } from './notices';
import { createTimeRule } from './schedule-ops';

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

describe('noticeTimeline (Plan.md 69)', () => {
    // 2026-09-27 is a Sunday.
    const SUNDAY = { year: 2026, month: 9, day: 27 };
    const NOW = new Date('2026-09-27T08:00:00Z');
    const foyer = { id: 'screen-1', slug: 'foyer', name: 'Foyer' };
    const cafe = { id: 'screen-2', slug: 'cafe', name: 'Café' };

    function groupOf(overviews: PlaylistOverview[]) {
        return groupBanners(overviews, NOW, TZ)[0]!;
    }
    /** The visible stretches of a day as [start, end]. */
    function visible(day: ReturnType<typeof noticeTimeline>[number]): [number, number][] {
        return day.segments.filter((s) => s.visible).map((s) => [s.start, s.end]);
    }

    it('shows a band on a playlist that only runs by a Sunday rule just there', () => {
        const group = groupOf([overview({ id: 'gd', banner: banner() }, [foyer])]);
        const screen = makeScreen({ id: 'screen-1', defaultPlaylistId: 'standard', schedule: [createTimeRule('gd')] });
        const days = noticeTimeline(group, [screen], SUNDAY, 7, TZ, []);
        expect(days).toHaveLength(7);
        expect(days[0]?.weekday).toBe(7);
        expect(visible(days[0]!)).toEqual([[540, 720]]);
        expect(days[0]?.segments.find((s) => s.visible)?.screenIds).toEqual(['screen-1']);
        for (const day of days.slice(1)) expect(visible(day)).toEqual([]);
    });

    it('cuts at until: to the minute on its day, nothing after', () => {
        const b = banner({ until: '2026-09-27T10:30' });
        const group = groupOf([overview({ id: 'standard', banner: b }, [foyer])]);
        const screen = makeScreen({ id: 'screen-1', defaultPlaylistId: 'standard' });
        const days = noticeTimeline(group, [screen], { ...SUNDAY, day: 26 }, 3, TZ, []);
        expect(visible(days[0]!)).toEqual([[0, 1440]]);
        expect(visible(days[1]!)).toEqual([[0, 630]]);
        expect(visible(days[2]!)).toEqual([]);
    });

    it('unites screens and names both where they overlap', () => {
        const group = groupOf([overview({ id: 'gd', banner: banner() }, [foyer, cafe])]);
        const a = makeScreen({ id: 'screen-1', defaultPlaylistId: 'standard', schedule: [createTimeRule('gd')] });
        const b = makeScreen({
            id: 'screen-2',
            defaultPlaylistId: 'standard',
            schedule: [{ ...createTimeRule('gd'), from: '10:00', to: '14:00' }],
        });
        const day = noticeTimeline(group, [a, b], SUNDAY, 1, TZ, [])[0]!;
        expect(day.segments.filter((s) => s.visible)).toEqual([
            { start: 540, end: 600, visible: true, screenIds: ['screen-1'] },
            { start: 600, end: 720, visible: true, screenIds: ['screen-1', 'screen-2'] },
            { start: 720, end: 840, visible: true, screenIds: ['screen-2'] },
        ]);
    });

    it('shows nothing when no screen runs a playlist of the group', () => {
        const group = groupOf([overview({ id: 'orphan', banner: banner() })]);
        const screen = makeScreen({ defaultPlaylistId: 'standard' });
        const days = noticeTimeline(group, [screen], SUNDAY, 7, TZ, []);
        for (const day of days) expect(day.segments).toEqual([{ start: 0, end: 1440, visible: false, screenIds: [] }]);
    });
});
