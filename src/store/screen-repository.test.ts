import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValueTooLargeError } from '../model/read';
import { makePlaylist, makeScreen, makeSlide, textBlock } from '../model/testing';
import type { Banner, ScreenBundle } from '../model/schema';
import { MemoryKv } from './memory-kv';
import {
    ConflictError,
    ORPHAN_GRACE_MS,
    PlaylistInUseError,
    PlaylistNotFoundError,
    ScreenNotFoundError,
    ScreenRepository,
    SlideConflictError,
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
        expect(loaded.issues.map((i) => i.message)).toEqual(['Folie fehlt.']);
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

    it('counts every image of a slideshow as a use, and loads them (schema 1.15)', async () => {
        const slideshow = { id: 'dia', type: 'slideshow' as const, x: 0, y: 0, width: 1200, height: 675, mediaIds: ['bild-1', 'bild-2'], fit: 'cover' as const, seconds: 6, transition: 'fade' as const, motion: 'none' as const };
        for (const [n, id] of ['bild-1', 'bild-2', 'bild-3'].entries()) {
            await repo.saveMedia({
                schema: { major: 1, minor: 15 },
                kind: 'media',
                id,
                name: id,
                fileId: 20 + n,
                imageUrl: `https://gemeinde.example/images/${20 + n}/abc`,
            });
        }
        await repo.saveScreen(bundle({ slides: [makeSlide({ id: 'slide-1', blocks: [slideshow] }), makeSlide({ id: 'slide-2' })] }), {
            ...save,
            expectedRevision: null,
        });
        expect(await repo.mediaUsage('bild-1')).toHaveLength(1);
        expect(await repo.mediaUsage('bild-2')).toHaveLength(1);
        expect(await repo.mediaUsage('bild-3')).toHaveLength(0);
        expect((await repo.loadScreen('foyer-links')).media.map((m) => m.id).sort()).toEqual(['bild-1', 'bild-2']);
    });

    it('counts a video as a use, loads it, and knows whether any is shown (schema 1.18)', async () => {
        const video = { id: 'film', type: 'video' as const, x: 0, y: 0, width: 1280, height: 720, mediaId: 'clip-1', fit: 'contain' as const, sound: false };
        expect(await repo.videoInUse()).toBe(false);
        for (const [n, id] of ['clip-1', 'clip-2'].entries()) {
            await repo.saveMedia({
                schema: { major: 1, minor: 18 },
                kind: 'media',
                id,
                name: `${id}.mp4`,
                fileId: 30 + n,
                imageUrl: '',
                mediaType: 'video',
                fileUrl: `https://gemeinde.example/?q=public/filedownload&id=${30 + n}&filename=abc`,
                durationSeconds: 12,
            });
        }
        await repo.saveScreen(bundle({ slides: [makeSlide({ id: 'slide-1', blocks: [{ ...video, mediaId: undefined }] }), makeSlide({ id: 'slide-2' })] }), {
            ...save,
            expectedRevision: null,
        });
        // A video block nobody has chosen a video for needs nothing yet.
        expect(await repo.videoInUse()).toBe(false);
        await repo.saveScreen(bundle({ slides: [makeSlide({ id: 'slide-1', blocks: [video] }), makeSlide({ id: 'slide-2' })] }), {
            ...save,
            expectedRevision: 1,
        });
        expect(await repo.videoInUse()).toBe(true);
        expect(await repo.mediaUsage('clip-1')).toHaveLength(1);
        expect(await repo.mediaUsage('clip-2')).toHaveLength(0);
        expect((await repo.loadScreen('foyer-links')).media.map((m) => m.id)).toEqual(['clip-1']);
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

        it('gives a playlist without a format that of the screen that shows it, until it is saved', async () => {
            await created();
            const [overview] = await repo.listPlaylists();
            expect(overview?.playlist).toMatchObject({ name: 'Standard', stage: LANDSCAPE, revision: 0 });
            expect(overview?.screens.map((s) => s.slug)).toEqual(['foyer-links']);
            expect(overview?.slideCount).toBe(2);
        });

        it('tells when a playlist was last edited – also through a linked slide saved elsewhere', async () => {
            const made = await repo.createPlaylist({ name: 'Gottesdienst', stage: LANDSCAPE }, 'Anna', new Date('2026-09-01T08:00:00Z'));
            const twin = await repo.duplicatePlaylist(made.id, 'Ben', new Date('2026-09-02T08:00:00Z'), { linked: true });
            const find = async (id: string) => (await repo.listPlaylists()).find((o) => o.playlist.id === id);
            expect(await find(made.id)).toMatchObject({ editedAt: '2026-09-01T08:00:00.000Z', editedBy: 'Anna' });
            expect(await find(twin.id)).toMatchObject({ editedAt: '2026-09-02T08:00:00.000Z', editedBy: 'Ben' });

            const { playlist, slides } = await repo.loadPlaylist(twin.id);
            await repo.savePlaylist(
                { playlist, slides },
                { expectedRevision: playlist.revision, updatedBy: 'Ben', now: new Date('2026-09-03T08:00:00Z') },
            );
            // The slide is shown by both: the first playlist changed too – by Ben, who saved the slide from the twin (Plan.md 66).
            expect(await find(made.id)).toMatchObject({ editedAt: '2026-09-03T08:00:00.000Z', editedBy: 'Ben' });
            expect(await find(twin.id)).toMatchObject({ editedAt: '2026-09-03T08:00:00.000Z', editedBy: 'Ben' });
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

        describe('saveBanners – the band of "Hinweise" (Plan.md, Nächste Schritte 34)', () => {
            async function twoPlaylists() {
                await created();
                const second = await repo.createPlaylist({ name: 'Zweite', stage: LANDSCAPE }, 'Anna');
                return { first: makePlaylist().id, second: second.id };
            }

            it('sets the band on several playlists at once, without touching their slides', async () => {
                const { first, second } = await twoPlaylists();
                const before = await repo.loadPlaylist(first);
                const saved = await repo.saveBanners(
                    [
                        { playlistId: first, expectedRevision: 0, banner: banner() },
                        { playlistId: second, expectedRevision: 1, banner: banner() },
                    ],
                    { updatedBy: 'Anna' },
                );
                expect(saved.map((p) => p.revision)).toEqual([1, 2]);
                expect(saved.every((p) => p.banner?.text === 'Heute Parkplatz gesperrt')).toBe(true);
                const again = await repo.loadPlaylist(first);
                expect(again.slides).toEqual(before.slides);
            });

            it('removes the band from one playlist, keeping it on another', async () => {
                const { first, second } = await twoPlaylists();
                await repo.saveBanners(
                    [
                        { playlistId: first, expectedRevision: 0, banner: banner() },
                        { playlistId: second, expectedRevision: 1, banner: banner() },
                    ],
                    { updatedBy: 'Anna' },
                );
                await repo.saveBanners([{ playlistId: first, expectedRevision: 1, banner: null }], { updatedBy: 'Anna' });
                const [loadedFirst, loadedSecond] = await Promise.all([repo.loadPlaylist(first), repo.loadPlaylist(second)]);
                expect(loadedFirst.playlist.banner).toBeUndefined();
                expect(loadedSecond.playlist.banner?.text).toBe('Heute Parkplatz gesperrt');
            });

            it('stamps a band when it changes, not when only the playlist is saved (Plan.md 66)', async () => {
                const { first } = await twoPlaylists();
                await repo.saveBanners([{ playlistId: first, expectedRevision: 0, banner: banner() }], {
                    updatedBy: 'Anna',
                    now: new Date('2026-10-05T08:00:00Z'),
                });
                const stamped = { updatedAt: '2026-10-05T08:00:00.000Z', updatedBy: 'Anna' };
                expect((await repo.loadPlaylist(first)).playlist.banner).toMatchObject(stamped);

                // Ben saves the playlist for a slide – the band stays as Anna left it.
                const loaded = await repo.loadPlaylist(first);
                await repo.savePlaylist(loaded, { expectedRevision: 1, updatedBy: 'Ben', now: new Date('2026-10-05T09:00:00Z') });
                expect((await repo.loadPlaylist(first)).playlist.banner).toMatchObject(stamped);

                // Ben changes the text in the editor – now the band is his.
                const edited = await repo.loadPlaylist(first);
                edited.playlist.banner = { ...edited.playlist.banner!, text: 'Parkplatz wieder frei' };
                await repo.savePlaylist(edited, { expectedRevision: 2, updatedBy: 'Ben', now: new Date('2026-10-05T10:00:00Z') });
                expect((await repo.loadPlaylist(first)).playlist.banner).toMatchObject({
                    updatedAt: '2026-10-05T10:00:00.000Z',
                    updatedBy: 'Ben',
                });
            });

            it('writes nothing when one of several revisions is stale', async () => {
                const { first, second } = await twoPlaylists();
                // Someone else saved the second playlist in between – its revision is now 2, not the assumed 1.
                await repo.savePlaylist(await repo.loadPlaylist(second), { expectedRevision: 1, updatedBy: 'Ben' });

                await expect(
                    repo.saveBanners(
                        [
                            { playlistId: first, expectedRevision: 0, banner: banner() },
                            { playlistId: second, expectedRevision: 1, banner: banner() },
                        ],
                        { updatedBy: 'Anna' },
                    ),
                ).rejects.toBeInstanceOf(ConflictError);
                expect((await repo.loadPlaylist(first)).playlist.banner).toBeUndefined();
            });
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

        it('discards the draft of a deleted playlist with it, and still deletes when that fails', async () => {
            await repo.drafts.ensureCategory();
            const made = await repo.createPlaylist({ name: 'Entwurf', stage: LANDSCAPE }, 'Anna');
            await repo.drafts.save(
                { playlistId: made.id, name: 'Neu', slideIds: [], slides: [], dropSlideIds: [] },
                { expectedRevision: 0, updatedBy: 'Anna' },
            );
            await repo.deletePlaylist(made.id);
            expect(await repo.drafts.load(made.id)).toBeNull();

            const second = await repo.createPlaylist({ name: 'Zweite', stage: LANDSCAPE }, 'Anna');
            vi.spyOn(repo.drafts, 'discard').mockRejectedValue(new Error('weg'));
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            await repo.deletePlaylist(second.id);
            await expect(repo.loadPlaylist(second.id)).rejects.toBeInstanceOf(PlaylistNotFoundError);
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
            const look = { corners: 'square' as const, accent: '#e11d48', text: '#111111', background: '#f8fafc', font: 'oswald', appointments: 'large' as const, imageRatio: '4:3' as const, cards: 'tint' as const, cardColor: '#1e293b', cardOpacity: 80 };
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

    it('collects the rooms every rooms block shows, once and sorted (schema 1.16, for the device rights)', async () => {
        expect(await repo.roomIdsInUse()).toEqual([]);
        const block = (id: string, ids: number[]) => ({
            id,
            type: 'rooms' as const,
            x: 0,
            y: 0,
            width: 1400,
            height: 700,
            rooms: ids.map((resourceId) => ({ resourceId, hint: '', showTitles: true })),
            layout: 'overview' as const,
            days: 1 as const,
            style: { fontFamily: 'sans', fontSize: 44, fontWeight: 400 as const, color: '#fff', align: 'left' as const },
        });
        await repo.saveScreen(
            bundle({ slides: [makeSlide({ id: 'slide-1', blocks: [block('a', [5, 2])] }), makeSlide({ id: 'slide-2', blocks: [block('b', [2, 3])] })] }),
            { ...save, expectedRevision: null },
        );
        expect(await repo.roomIdsInUse()).toEqual([2, 3, 5]);
    });

    it('knows whether a block shows the rooms of its appointments (Plan.md 50, for the device rights)', async () => {
        expect(await repo.appointmentRoomsInUse()).toBe(false);
        const style = { fontFamily: 'sans', fontSize: 44, fontWeight: 400 as const, color: '#fff', align: 'left' as const };
        const frame = { x: 0, y: 0, width: 1400, height: 700, calendarIds: [2], style };
        const blocks = (showRooms: boolean, layout: 'rows' | 'cards') => [
            { id: 'l', type: 'appointment-list' as const, ...frame, horizonDays: 14, limit: 5, layout, showRooms },
        ];
        await repo.saveScreen(
            bundle({ slides: [makeSlide({ id: 'slide-1', blocks: blocks(true, 'rows') }), makeSlide({ id: 'slide-2' })] }),
            { ...save, expectedRevision: null },
        );
        expect(await repo.appointmentRoomsInUse()).toBe(false);
        await repo.saveScreen(
            bundle({ slides: [makeSlide({ id: 'slide-1', blocks: blocks(true, 'cards') }), makeSlide({ id: 'slide-2' })] }),
            { ...save, expectedRevision: 1 },
        );
        expect(await repo.appointmentRoomsInUse()).toBe(true);
    });

    it('collects the calendars of the blocks that show services (Plan.md 51, for the device rights)', async () => {
        expect(await repo.serviceCalendarIdsInUse()).toEqual([]);
        const style = { fontFamily: 'sans', fontSize: 44, fontWeight: 400 as const, color: '#fff', align: 'left' as const };
        const frame = { x: 0, y: 0, width: 1400, height: 700, style };
        const blocks = [
            { id: 'n', type: 'next-appointment' as const, ...frame, calendarIds: [7, 3], showImage: true, services: [1] },
            { id: 'l', type: 'appointment-list' as const, ...frame, calendarIds: [5], horizonDays: 14, limit: 5, layout: 'cards' as const },
            { id: 'r', type: 'appointment-list' as const, ...frame, calendarIds: [6], horizonDays: 14, limit: 5, layout: 'rows' as const, services: [1] },
        ];
        await repo.saveScreen(bundle({ slides: [makeSlide({ id: 'slide-1', blocks }), makeSlide({ id: 'slide-2' })] }), { ...save, expectedRevision: null });
        expect(await repo.serviceCalendarIdsInUse()).toEqual([3, 7]);
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

    describe('linked slides (Plan.md 49)', () => {
        const savedAt = new Date('2026-10-04T08:00:00Z');
        const later = (minutes: number) => new Date(savedAt.getTime() + minutes * 60_000);
        const A = makePlaylist().id;

        /** Playlist A of the screen and B, a linked duplicate of it: both show the same two slides. */
        async function linkedPair() {
            await repo.saveScreen(bundle(), { ...save, expectedRevision: null, now: savedAt });
            const b = await repo.duplicatePlaylist(A, 'Anna', later(1), { linked: true });
            return { b: b.id };
        }
        const withName = <T extends { slides: { id: string; name: string }[] }>(loaded: T, id: string, name: string): T => ({
            ...loaded,
            slides: loaded.slides.map((s) => (s.id === id ? { ...s, name } : s)),
        });

        it('writes only the slides it is told changed', async () => {
            await repo.saveScreen(bundle(), { ...save, expectedRevision: null, now: savedAt });
            const loaded = await repo.loadPlaylist(A);
            kv.writes.length = 0;
            await repo.savePlaylist(withName(loaded, 'slide-1', 'Neu'), {
                expectedRevision: 0,
                updatedBy: 'Anna',
                changedSlideIds: ['slide-1'],
            });
            expect(kv.writes).toHaveLength(2); // the slide, then the playlist
            const after = await repo.loadPlaylist(A);
            expect(after.slides.find((x) => x.id === 'slide-1')?.name).toBe('Neu');
            expect(after.slides.find((x) => x.id === 'slide-2')?.updatedAt).toBe(savedAt.toISOString());
        });

        it('throws before the first write when a shared slide was saved from another playlist', async () => {
            const { b } = await linkedPair();
            const inA = await repo.loadPlaylist(A);
            const inB = await repo.loadPlaylist(b);
            await repo.savePlaylist(withName(inB, 'slide-1', 'Von Ben'), {
                expectedRevision: inB.playlist.revision,
                updatedBy: 'Ben',
                now: later(5),
                changedSlideIds: ['slide-1'],
            });
            kv.writes.length = 0;
            const attempt = repo.savePlaylist(withName(inA, 'slide-2', 'Von Anna'), {
                expectedRevision: 0,
                updatedBy: 'Anna',
                now: later(9),
                changedSlideIds: ['slide-1', 'slide-2'],
            });
            await expect(attempt).rejects.toBeInstanceOf(SlideConflictError);
            await expect(attempt).rejects.toMatchObject({
                current: { slide: { id: 'slide-1', name: 'Von Ben' }, playlist: 'Standard (Kopie)', updatedBy: 'Ben' },
            });
            expect(kv.writes).toHaveLength(0);
            expect((await repo.loadPlaylist(A)).slides.find((x) => x.id === 'slide-2')?.name).toBe('Termine');
        });

        it('lets an unshared slide through even if its stored copy is newer', async () => {
            await repo.saveScreen(bundle(), { ...save, expectedRevision: null, now: savedAt });
            const stale = await repo.loadPlaylist(A);
            const current = await repo.loadPlaylist(A);
            await repo.savePlaylist(current, { expectedRevision: 0, updatedBy: 'Ben', now: later(5) });
            await expect(
                repo.savePlaylist(withName(stale, 'slide-1', 'Neu'), {
                    expectedRevision: 1,
                    updatedBy: 'Anna',
                    now: later(9),
                    changedSlideIds: ['slide-1'],
                }),
            ).resolves.toMatchObject({ revision: 2 });
        });

        it('tells for each slide which other playlists show it, sorted by name', async () => {
            const { b } = await linkedPair();
            const c = await repo.duplicatePlaylist(A, 'Anna', later(2), { linked: true });
            await repo.savePlaylist(
                { ...(await repo.loadPlaylist(c.id)), playlist: { ...(await repo.loadPlaylist(c.id)).playlist, name: 'Aula' } },
                { expectedRevision: 1, updatedBy: 'Anna', now: later(3), changedSlideIds: [] },
            );
            const inA = await repo.loadPlaylist(A);
            expect(inA.sharedWith['slide-1']?.map((p) => p.name)).toEqual(['Aula', 'Standard (Kopie)']);
            const own = await repo.createPlaylist({ name: 'Allein', stage: { width: 1920, height: 1080 } }, 'Anna');
            expect((await repo.loadPlaylist(own.id)).sharedWith).toEqual({});
            expect((await repo.loadPlaylist(b)).sharedWith['slide-2']?.map((p) => p.id)).toContain(A);
        });

        it('duplicates linked: the same slide ids, no slide written; by default copies', async () => {
            const { b } = await linkedPair();
            const ids = await repo.ensureCategories();
            const linked = await repo.loadPlaylist(b);
            expect(linked.playlist.slideIds).toEqual(['slide-1', 'slide-2']);
            expect(await kv.listValues(ids.slides)).toHaveLength(2);

            const copy = await repo.duplicatePlaylist(A, 'Anna', later(3));
            expect(copy.slideIds.some((id) => id === 'slide-1' || id === 'slide-2')).toBe(false);
            expect(await kv.listValues(ids.slides)).toHaveLength(4);
        });

        it('keeps shared slides while any playlist shows them when tidying up', async () => {
            const { b } = await linkedPair();
            await repo.deleteScreen('foyer-links');
            await repo.deletePlaylist(A);
            const soon = later(ORPHAN_GRACE_MS / 60_000 + 60 * 24);
            expect(await repo.collectOrphans(soon)).toEqual({ playlists: 0, slides: 0 });
            expect((await repo.loadPlaylist(b)).slides).toHaveLength(2);
            await repo.deletePlaylist(b);
            expect(await repo.collectOrphans(soon)).toEqual({ playlists: 0, slides: 2 });
        });
    });

    describe('the services an administrator allows (Plan.md 58)', () => {
        const settings = { schema: { major: 1, minor: 20 }, id: 'settings', kind: 'settings' };

        it('comes with the loaded screen', async () => {
            await repo.saveScreen(bundle(), { ...save, expectedRevision: null });
            expect((await repo.loadScreen('foyer-links')).allowedServiceIds).toEqual([]); // no settings yet
            await repo.saveSettings({ schema: { major: 1, minor: 20 }, designerGroupId: 4 });
            expect((await repo.loadScreen('foyer-links')).allowedServiceIds).toEqual([]); // no field
            await repo.saveSettings({ schema: { major: 1, minor: 20 }, allowedServiceIds: [3, 7] });
            expect((await repo.loadScreen('foyer-links')).allowedServiceIds).toEqual([3, 7]);
        });

        it('is none when the settings cannot be read – the screen still loads', async () => {
            await repo.saveScreen(bundle(), { ...save, expectedRevision: null });
            await repo.saveSettings({ schema: { major: 1, minor: 20 }, allowedServiceIds: [3] });
            const settingsId = (await repo.ensureCategories()).settings;
            const listValues = kv.listValues.bind(kv);
            kv.listValues = async (categoryId) => {
                if (categoryId === settingsId) throw new Error('403');
                return listValues(categoryId);
            };
            const loaded = await repo.loadScreen('foyer-links');
            expect(loaded.allowedServiceIds).toEqual([]);
            expect(loaded.screen.slug).toBe('foyer-links');
        });

        it('is none when the settings document is broken', async () => {
            await repo.saveScreen(bundle(), { ...save, expectedRevision: null });
            const ids = await repo.ensureCategories();
            await kv.createValue(ids.settings, JSON.stringify({ ...settings, allowedServiceIds: ['x'] }));
            expect((await repo.loadScreen('foyer-links')).allowedServiceIds).toEqual([]);
        });
    });
});
