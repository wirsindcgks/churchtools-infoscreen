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
