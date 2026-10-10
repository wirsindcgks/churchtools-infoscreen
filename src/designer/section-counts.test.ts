import { beforeEach, describe, expect, it, vi } from 'vitest';

const listScreens = vi.fn();
const listPlaylists = vi.fn();
const listMedia = vi.fn();

vi.mock('../store/backend', () => ({ getRepository: async () => ({ repository: { listScreens, listPlaylists } }) }));
vi.mock('../media/library', () => ({
    wikiBackend: {},
    MediaLibrary: class {
        list = listMedia;
    },
}));
vi.mock('../player/data', () => ({ churchToolsPlayerData: { timeZone: async () => 'Europe/Berlin' } }));

import { bumpSectionCount, ensureSectionCounts, resetSectionCounts, screenCounts, sectionCounts, setScreenCounts, setSectionCount } from './section-counts';

const screen = (width: number, height: number) => ({ stage: { width, height } });
const overview = (banner?: { text: string; until?: string }) => ({ playlist: { banner: banner && { mode: 'static', ...banner } }, screens: [], media: [] });

beforeEach(() => {
    resetSectionCounts();
    listScreens.mockReset().mockResolvedValue([screen(1920, 1080), screen(1080, 1920), screen(1920, 1080)]);
    listPlaylists.mockReset().mockResolvedValue([overview(), overview({ text: 'laufend' }), overview({ text: 'abgelaufen', until: new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 16) })]);
    listMedia.mockReset().mockResolvedValue([{}, {}, {}, {}]);
});

describe('setScreenCounts', () => {
    it('counts the formats, and gives screens and schedules the same number', () => {
        setScreenCounts([screen(1920, 1080), screen(1080, 1920), screen(1920, 1080)]);
        expect(screenCounts.value).toEqual({ all: 3, portrait: 1, landscape: 2 });
        expect(sectionCounts.value).toMatchObject({ screens: 3, schedules: 3 });
    });
});

describe('bumpSectionCount', () => {
    it('changes a known number and leaves an unknown one unknown', () => {
        setSectionCount('playlists', 2);
        bumpSectionCount('playlists', 1);
        bumpSectionCount('media', 1);
        expect(sectionCounts.value).toEqual({ playlists: 3 });
    });
});

describe('ensureSectionCounts', () => {
    it('loads every missing number once', async () => {
        await ensureSectionCounts();
        expect(sectionCounts.value).toMatchObject({ screens: 3, schedules: 3, playlists: 3, media: 4 });
        expect(screenCounts.value?.all).toBe(3);
        await ensureSectionCounts();
        expect(listScreens).toHaveBeenCalledTimes(1);
        expect(listPlaylists).toHaveBeenCalledTimes(1);
        expect(listMedia).toHaveBeenCalledTimes(1);
    });

    it('counts the running notices, not the expired ones', async () => {
        await ensureSectionCounts();
        expect(sectionCounts.value.notices).toBe(1);
    });

    it('does not overwrite what a page set, and does not load what it need not', async () => {
        setScreenCounts([screen(1920, 1080)]);
        setSectionCount('playlists', 9);
        setSectionCount('notices', 2);
        setSectionCount('media', 7);
        await ensureSectionCounts();
        expect(sectionCounts.value).toEqual({ screens: 1, schedules: 1, playlists: 9, notices: 2, media: 7 });
        expect(listScreens).not.toHaveBeenCalled();
        expect(listPlaylists).not.toHaveBeenCalled();
        expect(listMedia).not.toHaveBeenCalled();
    });

    it('keeps a number a page set while the load was under way', async () => {
        let release: (value: unknown[]) => void = () => undefined;
        listPlaylists.mockReturnValue(new Promise((resolve) => (release = resolve)));
        const loading = ensureSectionCounts();
        setSectionCount('playlists', 5);
        release([overview()]);
        await loading;
        expect(sectionCounts.value.playlists).toBe(5);
    });

    it('leaves out a number whose load failed, without throwing, and asks the library only once', async () => {
        listMedia.mockRejectedValue(new Error('kein Wiki'));
        listScreens.mockRejectedValue(new Error('kaputt'));
        await expect(ensureSectionCounts()).resolves.toBeUndefined();
        expect(sectionCounts.value.media).toBeUndefined();
        expect(sectionCounts.value.screens).toBeUndefined();
        expect(sectionCounts.value.playlists).toBe(3);
        await ensureSectionCounts();
        expect(listMedia).toHaveBeenCalledTimes(1);
        expect(listScreens).toHaveBeenCalledTimes(2);
    });
});
