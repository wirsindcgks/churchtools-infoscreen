import { beforeEach, describe, expect, it } from 'vitest';
import { ValueTooLargeError } from '../model/read';
import { makePlaylist, makeScreen, makeSlide, textBlock } from '../model/testing';
import type { ScreenBundle } from '../model/schema';
import { MemoryKv } from './memory-kv';
import {
    ConflictError,
    ORPHAN_GRACE_MS,
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

    describe('schedule documents (schema 1.2, Plan.md 15)', () => {
        async function created() {
            const screen = await repo.saveScreen(bundle(), { ...save, expectedRevision: null });
            return { screen, loaded: await repo.loadScreen('foyer-links') };
        }

        it('keeps a screen without schedule document running on the values of its index', async () => {
            const { loaded } = await created();
            expect(loaded.schedule).toBeNull();
            expect(loaded.screen.defaultPlaylistId).toBe(makePlaylist().id);
        });

        it('saves content as slides, playlists and a schedule document – the index stays as the administrator left it', async () => {
            const { screen, loaded } = await created();
            const ids = await repo.ensureCategories();
            kv.writes.length = 0;
            const saved = await repo.saveContent(loaded, { expectedRevision: null, updatedBy: 'Gestalterin' });
            expect(saved).toMatchObject({ kind: 'schedule', screenId: screen.id, revision: 1, updatedBy: 'Gestalterin' });
            const category = (w: (typeof kv.writes)[number]) => ('categoryId' in w ? w.categoryId : null);
            expect(kv.writes.some((w) => category(w) === ids.screens)).toBe(false);
            expect(category(kv.writes.at(-1)!)).toBe(ids.playlists); // the schedule last
            const again = await repo.loadScreen('foyer-links');
            expect(again.schedule?.revision).toBe(1);
            expect(again.screen.revision).toBe(screen.revision);
            expect(again.screen.updatedBy).toBe('Gestalterin'); // who saved last, for the tiles
        });

        it('lets the schedule document decide which playlist runs', async () => {
            const { loaded } = await created();
            const extra = makePlaylist({ id: 'abend', name: 'Abend', slideIds: ['slide-2'] });
            const content = {
                ...loaded,
                screen: {
                    ...loaded.screen,
                    defaultPlaylistId: 'abend',
                    schedule: [{ kind: 'time' as const, playlistId: loaded.screen.defaultPlaylistId, weekdays: [7], from: '09:00', to: '12:00' }],
                },
                playlists: [...loaded.playlists, extra],
            };
            await repo.saveContent(content, { expectedRevision: null, updatedBy: 'Gestalterin' });
            const again = await repo.loadScreen('foyer-links');
            expect(again.screen.defaultPlaylistId).toBe('abend');
            expect(again.screen.schedule).toHaveLength(1);
            expect(again.playlists.map((p) => p.id).sort()).toEqual(['abend', makePlaylist().id].sort());
        });

        it('keeps a playlist no rule uses yet, in the order the editor saved (schema 1.3)', async () => {
            const { loaded } = await created();
            const spare = makePlaylist({ id: 'reserve', name: 'Reserve', slideIds: ['slide-2'] });
            await repo.saveContent({ ...loaded, playlists: [spare, ...loaded.playlists] }, { expectedRevision: null, updatedBy: 'Gestalterin' });
            const again = await repo.loadScreen('foyer-links');
            expect(again.playlists.map((p) => p.id)).toEqual(['reserve', makePlaylist().id]);
            await repo.collectOrphans(new Date(Date.now() + ORPHAN_GRACE_MS + 1000));
            expect((await repo.loadScreen('foyer-links')).playlists.map((p) => p.id)).toContain('reserve');
        });

        it('collects a playlist the designers removed', async () => {
            const { loaded } = await created();
            const spare = makePlaylist({ id: 'reserve', name: 'Reserve', slideIds: ['slide-2'] });
            await repo.saveContent({ ...loaded, playlists: [...loaded.playlists, spare] }, { expectedRevision: null, updatedBy: 'Gestalterin' });
            await repo.saveContent(loaded, { expectedRevision: 1, updatedBy: 'Gestalterin' });
            await repo.collectOrphans(new Date(Date.now() + ORPHAN_GRACE_MS + 1000));
            const ids = await repo.ensureCategories();
            const stored = (await kv.listValues(ids.playlists)).map((v) => JSON.parse(v.value) as { id: string });
            expect(stored.map((d) => d.id)).not.toContain('reserve');
        });

        it('detects two designers saving the same screen', async () => {
            const { loaded } = await created();
            await repo.saveContent(loaded, { expectedRevision: null, updatedBy: 'Ben' });
            await expect(repo.saveContent(loaded, { expectedRevision: null, updatedBy: 'Anna' })).rejects.toMatchObject({
                name: 'ConflictError',
                current: { revision: 1, updatedBy: 'Ben' },
            });
            await expect(repo.saveContent(loaded, { expectedRevision: 1, updatedBy: 'Anna' })).resolves.toMatchObject({ revision: 2 });
        });

        it('saves screen settings against the index revision only', async () => {
            const { screen, loaded } = await created();
            await repo.saveContent(loaded, { expectedRevision: null, updatedBy: 'Gestalterin' });
            const renamed = await repo.saveScreenSettings(
                screen.id,
                { name: 'Foyer rechts', overscanPercent: 3 },
                { expectedRevision: screen.revision, updatedBy: 'Admin' },
            );
            expect(renamed).toMatchObject({ name: 'Foyer rechts', overscanPercent: 3, revision: screen.revision + 1 });
            await expect(
                repo.saveScreenSettings(screen.id, { name: 'Alt' }, { expectedRevision: screen.revision, updatedBy: 'Admin' }),
            ).rejects.toBeInstanceOf(ConflictError);
            expect((await repo.loadScreen('foyer-links')).schedule?.revision).toBe(1); // content untouched
        });

        it('collects the schedule of a deleted screen with its playlists', async () => {
            const { loaded } = await created();
            await repo.saveContent(loaded, { expectedRevision: null, updatedBy: 'Gestalterin' });
            await repo.deleteScreen('foyer-links');
            const later = new Date(Date.now() + ORPHAN_GRACE_MS + 1000);
            await repo.collectOrphans(later);
            const ids = await repo.ensureCategories();
            expect(await kv.listValues(ids.playlists)).toHaveLength(0);
        });

        it('counts a calendar that only a schedule rule uses (for the device rights)', async () => {
            const { loaded } = await created();
            const content = {
                ...loaded,
                screen: {
                    ...loaded.screen,
                    schedule: [
                        {
                            kind: 'appointment' as const,
                            playlistId: loaded.screen.defaultPlaylistId,
                            calendarIds: [9],
                            minutesBefore: 30,
                            minutesAfter: 60,
                        },
                    ],
                },
            };
            await repo.saveContent(content, { expectedRevision: null, updatedBy: 'Gestalterin' });
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

        const later = new Date(savedAt.getTime() + ORPHAN_GRACE_MS * 2);
        expect(await repo.collectOrphans(later)).toEqual({ playlists: 1, slides: 2 });
    });
});
