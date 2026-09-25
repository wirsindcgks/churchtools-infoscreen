import { beforeEach, describe, expect, it } from 'vitest';
import { ValueTooLargeError } from '../model/read';
import { makePlaylist, makeScreen, makeSlide, textBlock } from '../model/testing';
import type { ScreenBundle } from '../model/schema';
import { MemoryKv } from './memory-kv';
import {
    ConflictError,
    ORPHAN_GRACE_MS,
    PlaylistInUseError,
    PlaylistNotFoundError,
    ScreenNotFoundError,
    ScreenRepository,
    SlugTakenError,
} from './screen-repository';

function bundle(overrides: Partial<ScreenBundle> = {}): ScreenBundle {
    return {
        screen: makeScreen(),
        playlists: [makePlaylist({ slideIds: ['slide-1', 'slide-2'] })],
        slides: [makeSlide({ id: 'slide-1', blocks: [textBlock('t1')] }), makeSlide({ id: 'slide-2', name: 'Termine' })],
        ...overrides,
    };
}

const save = { updatedBy: 'Anna' };

describe('ScreenRepository', () => {
    let kv: MemoryKv;
    let repo: ScreenRepository;

    beforeEach(() => {
        kv = new MemoryKv();
        repo = new ScreenRepository(kv);
    });

    it('creates its categories once', async () => {
        await repo.ensureCategories();
        await new ScreenRepository(kv).ensureCategories();
        expect((await kv.listCategories()).map((c) => c.shorty)).toEqual([
            'screens',
            'playlists',
            'slides',
            'media',
            'settings',
        ]);
    });

    it('saves a new screen and loads it by slug', async () => {
        const saved = await repo.saveScreen(bundle(), { ...save, expectedRevision: null });
        expect(saved.revision).toBe(1);

        const loaded = await repo.loadScreen('foyer-links');
        expect(loaded.issues).toEqual([]);
        expect(loaded.screen.updatedBy).toBe('Anna');
        expect(loaded.playlists[0]?.slideIds).toEqual(['slide-1', 'slide-2']);
        expect(loaded.slides.map((s) => s.id).sort()).toEqual(['slide-1', 'slide-2']);
    });

    it('writes slides first, then playlists, the index last', async () => {
        const ids = await repo.ensureCategories();
        kv.writes.length = 0;
        await repo.saveScreen(bundle(), { ...save, expectedRevision: null });
        expect(kv.writes.map((w) => ('categoryId' in w ? w.categoryId : -1))).toEqual([
            ids.slides,
            ids.slides,
            ids.playlists,
            ids.screens,
        ]);
    });

    it('keeps the old screen visible when a save breaks off before the index', async () => {
        await repo.saveScreen(bundle(), { ...save, expectedRevision: null });
        const next = bundle({
            playlists: [makePlaylist({ slideIds: ['slide-3'] })],
            slides: [makeSlide({ id: 'slide-3', name: 'Neu' })],
        });
        kv.failFromWrite = kv.writes.length + 2; // slide and playlist succeed, index fails
        await expect(repo.saveScreen(next, { ...save, expectedRevision: 1 })).rejects.toThrow('simulated');

        kv.failFromWrite = null;
        const loaded = await repo.loadScreen('foyer-links');
        expect(loaded.screen.revision).toBe(1);
        // The playlist was updated in place – a known limit, see Befunde.md G22.
        expect(loaded.issues).toEqual([]);
    });

    it('detects a concurrent edit instead of overwriting it', async () => {
        await repo.saveScreen(bundle(), { ...save, expectedRevision: null });
        await repo.saveScreen(bundle(), { updatedBy: 'Ben', expectedRevision: 1 });

        const stale = repo.saveScreen(bundle(), { ...save, expectedRevision: 1 });
        await expect(stale).rejects.toBeInstanceOf(ConflictError);
        await expect(stale).rejects.toThrow('Ben');
    });

    it('keeps slugs unique', async () => {
        await repo.saveScreen(bundle(), { ...save, expectedRevision: null });
        const other = bundle({ screen: makeScreen({ id: 'screen-2' }) });
        await expect(repo.saveScreen(other, { ...save, expectedRevision: null })).rejects.toBeInstanceOf(
            SlugTakenError,
        );
    });

    it('checks size limits before the first write', async () => {
        await repo.ensureCategories();
        kv.writes.length = 0;
        const huge = bundle({
            slides: [
                makeSlide({ id: 'slide-1' }),
                makeSlide({ id: 'slide-2', blocks: [textBlock('big', 'x'.repeat(10_000))] }),
            ],
        });
        await expect(repo.saveScreen(huge, { ...save, expectedRevision: null })).rejects.toBeInstanceOf(
            ValueTooLargeError,
        );
        expect(kv.writes).toEqual([]);
    });

    it('refuses to save a playlist that references a slide not in the bundle', async () => {
        const broken = bundle({ slides: [makeSlide({ id: 'slide-1' })] });
        await expect(repo.saveScreen(broken, { ...save, expectedRevision: null })).rejects.toThrow('slide-2');
    });

    it('lets two playlists share a slide', async () => {
        await repo.saveScreen(bundle(), { ...save, expectedRevision: null });
        const second = bundle({
            screen: makeScreen({ id: 'screen-2', slug: 'foyer-rechts', defaultPlaylistId: 'playlist-2' }),
            playlists: [makePlaylist({ id: 'playlist-2', slideIds: ['slide-1'] })],
            slides: [makeSlide({ id: 'slide-1', blocks: [textBlock('t1')] })],
        });
        await repo.saveScreen(second, { ...save, expectedRevision: null });

        const slideValues = await kv.listValues((await repo.ensureCategories()).slides);
        expect(slideValues).toHaveLength(2);
        expect((await repo.loadScreen('foyer-rechts')).slides.map((s) => s.id)).toEqual(['slide-1']);
    });

    it('reports a missing slide instead of failing the whole screen', async () => {
        await repo.saveScreen(bundle(), { ...save, expectedRevision: null });
        const ids = await repo.ensureCategories();
        const [first] = await kv.listValues(ids.slides);
        await kv.deleteValue(ids.slides, first!.id);

        const loaded = await repo.loadScreen('foyer-links');
        expect(loaded.slides).toHaveLength(1);
        expect(loaded.issues.map((i) => i.message)).toEqual(['Slide fehlt.']);
    });

    it('counts an own header logo as a use of that image, so deleting it warns (schema 1.1)', async () => {
        const header = {
            id: 'h',
            type: 'church-header' as const,
            x: 0,
            y: 0,
            width: 800,
            height: 100,
            showLogo: true,
            showName: true,
            logoMediaId: 'logo-weiss',
            style: { fontFamily: 'sans', fontSize: 40, fontWeight: 400 as const, color: '#fff', align: 'left' as const },
        };
        await repo.saveMedia({
            schema: { major: 1, minor: 1 },
            kind: 'media',
            id: 'logo-weiss',
            name: 'Logo weiß',
            fileId: 7,
            imageUrl: 'https://gemeinde.example/images/7/abc',
        });
        await repo.saveScreen(bundle({ slides: [makeSlide({ id: 'slide-1', blocks: [header] }), makeSlide({ id: 'slide-2' })] }), {
            ...save,
            expectedRevision: null,
        });
        expect(await repo.mediaUsage('logo-weiss')).toHaveLength(1);
        expect((await repo.loadScreen('foyer-links')).media.map((m) => m.id)).toEqual(['logo-weiss']);
    });

    it('lists each screen with its first enabled slide and the number of slides', async () => {
        const slides = [
            makeSlide({ id: 'slide-1', enabled: false }),
            makeSlide({ id: 'slide-2', name: 'Termine' }),
        ];
        await repo.saveScreen(bundle({ slides }), { ...save, expectedRevision: null });
        const [overview] = await repo.listScreenOverviews();
        expect(overview?.screen.slug).toBe('foyer-links');
        expect(overview?.firstSlide?.id).toBe('slide-2');
        expect(overview?.slideCount).toBe(2);
        expect(overview?.media).toEqual([]);
    });

    it('lists no overviews and reads nothing more when there is no screen', async () => {
        expect(await repo.listScreenOverviews()).toEqual([]);
    });

    describe('playlists on their own and schedules (schema 1.4, Plan.md 17 and 19)', () => {
        async function created() {
            const screen = await repo.saveScreen(bundle(), { ...save, expectedRevision: null });
            return { screen, loaded: await repo.loadScreen('foyer-links') };
        }
        const PORTRAIT = { width: 1080, height: 1920 };
        const LANDSCAPE = { width: 1920, height: 1080 };

        it('keeps a screen without schedule document running on the values of its index', async () => {
            const { loaded } = await created();
            expect(loaded.schedule).toBeNull();
            expect(loaded.screen.defaultPlaylistId).toBe(makePlaylist().id);
        });

        it('gives an old playlist the format and name of the screen that shows it, until it is saved', async () => {
            await created();
            const [overview] = await repo.listPlaylists();
            expect(overview?.playlist).toMatchObject({ name: 'Foyer links', stage: LANDSCAPE, revision: 0 });
            expect(overview?.screens.map((s) => s.slug)).toEqual(['foyer-links']);
            expect(overview?.slideCount).toBe(2);
        });

        it('creates a playlist that runs nowhere yet and keeps it through a tidy-up', async () => {
            const made = await repo.createPlaylist({ name: 'Gottesdienst', stage: LANDSCAPE }, 'Anna');
            const loaded = await repo.loadPlaylist(made.id);
            expect(loaded.playlist).toMatchObject({ name: 'Gottesdienst', revision: 1, updatedBy: 'Anna' });
            expect(loaded.slides).toHaveLength(1);
            expect(loaded.screens).toEqual([]);
            await repo.collectOrphans(new Date(Date.now() + ORPHAN_GRACE_MS + 1000));
            expect((await repo.loadPlaylist(made.id)).slides).toHaveLength(1);
        });

        it('saves a playlist with its slides – screens and schedules stay as they are', async () => {
            const { screen } = await created();
            const loaded = await repo.loadPlaylist(makePlaylist().id);
            const ids = await repo.ensureCategories();
            kv.writes.length = 0;
            const saved = await repo.savePlaylist(
                { playlist: { ...loaded.playlist, name: 'Wochenüberblick' }, slides: loaded.slides },
                { expectedRevision: 0, updatedBy: 'Gestalterin' },
            );
            expect(saved).toMatchObject({ revision: 1, updatedBy: 'Gestalterin', stage: LANDSCAPE });
            const category = (w: (typeof kv.writes)[number]) => ('categoryId' in w ? w.categoryId : null);
            expect(kv.writes.some((w) => category(w) === ids.screens)).toBe(false);
            expect(category(kv.writes.at(-1)!)).toBe(ids.playlists); // the playlist last
            const again = await repo.loadScreen('foyer-links');
            expect(again.screen.revision).toBe(screen.revision);
            expect(again.playlists[0]).toMatchObject({ name: 'Wochenüberblick', revision: 1 });
        });

        it('detects two designers saving the same playlist', async () => {
            await created();
            const loaded = await repo.loadPlaylist(makePlaylist().id);
            await repo.savePlaylist(loaded, { expectedRevision: 0, updatedBy: 'Ben' });
            await expect(repo.savePlaylist(loaded, { expectedRevision: 0, updatedBy: 'Anna' })).rejects.toMatchObject({
                name: 'ConflictError',
                current: { revision: 1, updatedBy: 'Ben' },
            });
            await expect(repo.savePlaylist(loaded, { expectedRevision: 1, updatedBy: 'Anna' })).resolves.toMatchObject({ revision: 2 });
        });

        it('lets several screens show one playlist, chosen in their schedules', async () => {
            const { screen } = await created();
            const other = await repo.saveScreen(
                bundle({
                    screen: makeScreen({ id: 'screen-2', slug: 'cafe', name: 'Café', defaultPlaylistId: 'eigene' }),
                    playlists: [makePlaylist({ id: 'eigene', slideIds: ['slide-2'] })],
                    slides: [makeSlide({ id: 'slide-2' })],
                }),
                { ...save, expectedRevision: null },
            );
            const shared = await repo.createPlaylist({ name: 'Gottesdienst', stage: LANDSCAPE }, 'Anna');
            for (const s of [screen, other]) {
                await repo.saveSchedule(s.id, { defaultPlaylistId: shared.id, rules: [] }, { expectedRevision: null, updatedBy: 'Anna' });
            }
            const overview = (await repo.listPlaylists()).find((o) => o.playlist.id === shared.id);
            expect(overview?.screens.map((s) => s.name)).toEqual(['Café', 'Foyer links']);
            expect((await repo.loadScreen('cafe')).playlists.map((p) => p.id)).toEqual([shared.id]);
            await expect(repo.deletePlaylist(shared.id)).rejects.toBeInstanceOf(PlaylistInUseError);
        });

        it('saves a schedule against its own revision and refuses a playlist of another format', async () => {
            const { screen } = await created();
            const evening = await repo.createPlaylist({ name: 'Abend', stage: LANDSCAPE }, 'Anna');
            const tall = await repo.createPlaylist({ name: 'Hochkant', stage: PORTRAIT }, 'Anna');
            const rules = [{ kind: 'time' as const, playlistId: evening.id, weekdays: [5], from: '18:00', to: '22:00' }];
            const saved = await repo.saveSchedule(
                screen.id,
                { defaultPlaylistId: makePlaylist().id, rules },
                { expectedRevision: null, updatedBy: 'Gestalterin' },
            );
            expect(saved).toMatchObject({ kind: 'schedule', revision: 1, rules });
            const again = await repo.loadScreen('foyer-links');
            expect(again.screen.schedule).toEqual(rules);
            expect(again.playlists.map((p) => p.id)).toEqual([makePlaylist().id, evening.id]);
            expect(again.screen.revision).toBe(screen.revision); // the administrators' document is untouched
            // The tile knows every playlist the screen may show, to show the one that runs now (Plan.md 17).
            const [overview] = await repo.listScreenOverviews();
            expect(Object.keys(overview!.playlists).sort()).toEqual([makePlaylist().id, evening.id].sort());
            expect(overview!.playlists[evening.id]).toMatchObject({ name: 'Abend', slideCount: 1 });
            expect(overview!.playlists[evening.id]!.firstSlide).not.toBeNull();

            await expect(
                repo.saveSchedule(screen.id, { defaultPlaylistId: tall.id, rules: [] }, { expectedRevision: 1, updatedBy: 'X' }),
            ).rejects.toThrow(/anderes Format/);
            await expect(
                repo.saveSchedule(screen.id, { defaultPlaylistId: evening.id, rules: [] }, { expectedRevision: null, updatedBy: 'X' }),
            ).rejects.toBeInstanceOf(ConflictError);
        });

        it('deletes a playlist no screen shows; its slides go with the next tidy-up', async () => {
            const made = await repo.createPlaylist({ name: 'Entwurf', stage: LANDSCAPE }, 'Anna');
            await repo.deletePlaylist(made.id);
            await expect(repo.loadPlaylist(made.id)).rejects.toBeInstanceOf(PlaylistNotFoundError);
            expect(await repo.collectOrphans(new Date(Date.now() + ORPHAN_GRACE_MS + 1000))).toEqual({ playlists: 0, slides: 1 });
        });

        it('saves screen settings against the index revision only', async () => {
            const { screen } = await created();
            await repo.saveSchedule(screen.id, { defaultPlaylistId: makePlaylist().id, rules: [] }, { expectedRevision: null, updatedBy: 'Gestalterin' });
            const renamed = await repo.saveScreenSettings(
                screen.id,
                { name: 'Foyer rechts', overscanPercent: 3 },
                { expectedRevision: screen.revision, updatedBy: 'Admin' },
            );
            expect(renamed).toMatchObject({ name: 'Foyer rechts', overscanPercent: 3, revision: screen.revision + 1 });
            await expect(
                repo.saveScreenSettings(screen.id, { name: 'Alt' }, { expectedRevision: screen.revision, updatedBy: 'Admin' }),
            ).rejects.toBeInstanceOf(ConflictError);
            expect((await repo.loadScreen('foyer-links')).schedule?.revision).toBe(1); // schedule untouched
        });

        it('collects the schedule of a deleted screen, but keeps its playlists', async () => {
            const { screen } = await created();
            await repo.saveSchedule(screen.id, { defaultPlaylistId: makePlaylist().id, rules: [] }, { expectedRevision: null, updatedBy: 'Gestalterin' });
            await repo.deleteScreen('foyer-links');
            await repo.collectOrphans(new Date(Date.now() + ORPHAN_GRACE_MS + 1000));
            expect((await repo.listPlaylists()).map((o) => o.playlist.id)).toEqual([makePlaylist().id]);
            const ids = await repo.ensureCategories();
            expect(await kv.listValues(ids.playlists)).toHaveLength(1);
        });

        it('tells the player cheaply what was last saved: one read of the playlists (Plan.md 26)', async () => {
            const { screen } = await created();
            const ids = await repo.ensureCategories();
            expect(await repo.contentRevisions(screen.id)).toEqual({ schedule: null, playlists: { [makePlaylist().id]: 0 }, theme: null });
            const loaded = await repo.loadPlaylist(makePlaylist().id);
            await repo.savePlaylist(loaded, { expectedRevision: 0, updatedBy: 'Anna' });
            await repo.saveSchedule(screen.id, { defaultPlaylistId: makePlaylist().id, rules: [] }, { expectedRevision: null, updatedBy: 'Anna' });
            kv.reads.length = 0;
            expect(await repo.contentRevisions(screen.id)).toEqual({ schedule: 1, playlists: { [makePlaylist().id]: 1 }, theme: null });
            expect(kv.reads).toEqual([ids.playlists]);
        });

        it('keeps one theme for all screens beside the playlists, checked against its revision (Plan.md 27)', async () => {
            const { screen } = await created();
            expect(await repo.loadTheme()).toBeNull();
            const look = { corners: 'square' as const, accent: '#e11d48', text: '#111111', background: '#f8fafc', appointments: 'large' as const, imageRatio: '4:3' as const };
            const first = await repo.saveTheme(look, { expectedRevision: null, updatedBy: 'Anna' });
            expect(first).toMatchObject({ ...look, id: 'theme', kind: 'theme', revision: 1, updatedBy: 'Anna' });
            await expect(repo.saveTheme(look, { expectedRevision: null, updatedBy: 'Ben' })).rejects.toBeInstanceOf(ConflictError);
            await repo.saveTheme({ ...look, corners: 'round' }, { expectedRevision: 1, updatedBy: 'Ben' });

            // One document, not a playlist; the screen brings it along, the quick check sees its revision.
            expect((await repo.listPlaylists()).map((o) => o.playlist.id)).toEqual([makePlaylist().id]);
            const ids = await repo.ensureCategories();
            expect(await kv.listValues(ids.playlists)).toHaveLength(2);
            expect((await repo.loadScreen(screen.slug)).theme).toMatchObject({ corners: 'round', revision: 2 });
            expect((await repo.contentRevisions(screen.id)).theme).toBe(2);
            // A new playlist's first slide starts in the theme's background.
            const made = await repo.createPlaylist({ name: 'Neu', stage: { width: 1920, height: 1080 } }, 'Anna');
            const slide = (await repo.loadPlaylist(made.id)).slides[0]!;
            expect(slide.background).toEqual({ kind: 'solid', color: '#f8fafc' });
        });

        it('counts a calendar that only a schedule rule uses (for the device rights)', async () => {
            const { screen } = await created();
            const rules = [
                { kind: 'appointment' as const, playlistId: makePlaylist().id, calendarIds: [9], minutesBefore: 30, minutesAfter: 60 },
            ];
            await repo.saveSchedule(screen.id, { defaultPlaylistId: makePlaylist().id, rules }, { expectedRevision: null, updatedBy: 'Gestalterin' });
            expect(await repo.calendarIdsInUse()).toContain(9);
        });
    });

    it('throws for an unknown slug', async () => {
        await expect(repo.loadScreen('gibt-es-nicht')).rejects.toBeInstanceOf(ScreenNotFoundError);
    });

    it('collects orphans only after the grace period', async () => {
        const savedAt = new Date('2026-10-04T08:00:00Z');
        await repo.saveScreen(bundle(), { ...save, expectedRevision: null, now: savedAt });
        await repo.deleteScreen('foyer-links');

        const soon = new Date(savedAt.getTime() + ORPHAN_GRACE_MS / 2);
        expect(await repo.collectOrphans(soon)).toEqual({ playlists: 0, slides: 0 });

        // The playlist stays – it is content of its own (schema 1.4); its slides are still in it.
        const later = new Date(savedAt.getTime() + ORPHAN_GRACE_MS * 2);
        expect(await repo.collectOrphans(later)).toEqual({ playlists: 0, slides: 0 });
    });
});
