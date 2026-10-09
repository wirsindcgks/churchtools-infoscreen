import { beforeEach, describe, expect, it } from 'vitest';
import { ValueTooLargeError } from '../model/read';
import { makeSlide, textBlock } from '../model/testing';
import { DRAFTS_CATEGORY, DraftConflictError, DraftsUnavailableError, DraftStore } from './drafts';
import type { KvBackend } from './kv';
import { MemoryKv } from './memory-kv';

const change = (overrides: Partial<Parameters<DraftStore['save']>[0]> = {}) => ({
    playlistId: 'p1',
    name: 'Sonntag',
    slideIds: ['s1', 's2'],
    slides: [makeSlide({ id: 's1' }), makeSlide({ id: 's2', name: 'Termine' })],
    ...overrides,
});
const anna = { expectedRevision: 0, updatedBy: 'Anna', now: new Date('2026-10-10T10:00:00Z') };

describe('DraftStore', () => {
    let kv: MemoryKv;
    let drafts: DraftStore;

    beforeEach(async () => {
        kv = new MemoryKv();
        drafts = new DraftStore(kv);
        await drafts.ensureCategory();
    });

    it('finds its category by shorty and creates it only on request', async () => {
        const bare = new DraftStore(new MemoryKv());
        expect(await bare.categoryId()).toBeNull();
        const id = await bare.ensureCategory();
        expect(id).not.toBeNull();
        expect(await bare.categoryId()).toBe(id);
        expect(DRAFTS_CATEGORY.shorty).toBe('drafts');
    });

    it('gives null instead of failing when the category cannot be created', async () => {
        const failing = new MemoryKv();
        failing.failFromWrite = 0;
        expect(await new DraftStore(failing).ensureCategory()).toBeNull();
    });

    it('saves and loads: only the slide drafts of its own playlist and from slideIds', async () => {
        await drafts.save(change(), anna);
        await drafts.save(change({ playlistId: 'p2', slideIds: ['s1'], slides: [makeSlide({ id: 's1', name: 'Fremd' })] }), anna);
        await drafts.save(change({ slideIds: ['s2'] }), { ...anna, expectedRevision: 1 });
        const loaded = await drafts.load('p1');
        expect(loaded?.playlist).toMatchObject({ id: 'p1', name: 'Sonntag', slideIds: ['s2'], revision: 2, updatedBy: 'Anna' });
        expect(loaded?.slides.map((s) => s.id)).toEqual(['s2']);
        expect(loaded?.slides[0]?.name).toBe('Termine');
        expect(loaded?.issues).toEqual([]);
    });

    it('counts the revision up and refuses a wrong expected one with name and time', async () => {
        const first = await drafts.save(change(), anna);
        expect(first.revision).toBe(1);
        const error = await drafts.save(change(), { ...anna, updatedBy: 'Ben' }).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(DraftConflictError);
        expect((error as DraftConflictError).current).toEqual({
            revision: 1,
            updatedBy: 'Anna',
            updatedAt: '2026-10-10T10:00:00.000Z',
        });
        expect((await drafts.save(change(), { ...anna, expectedRevision: 1, updatedBy: 'Ben' })).revision).toBe(2);
    });

    it('replaces the whole draft: a slide draft not in the change is deleted, other playlists keep theirs', async () => {
        await drafts.save(change(), anna);
        await drafts.save(change({ playlistId: 'p2', slideIds: ['s1'], slides: [makeSlide({ id: 's1', name: 'Fremd' })] }), anna);
        await drafts.save(change({ slides: [makeSlide({ id: 's2', name: 'Termine' })] }), { ...anna, expectedRevision: 1 });
        const loaded = await drafts.load('p1');
        expect(loaded?.slides.map((s) => s.id)).toEqual(['s2']);
        expect((await drafts.load('p2'))?.slides.map((s) => s.id)).toEqual(['s1']);
    });

    it('writes the playlist draft last', async () => {
        await drafts.save(change(), anna);
        kv.writes.length = 0;
        await drafts.save(change({ slides: [makeSlide({ id: 's1', name: 'Neu' })] }), {
            ...anna,
            expectedRevision: 1,
        });
        expect(kv.writes.map((w) => w.op)).toEqual(['updateValue', 'deleteValue', 'updateValue']);
        const playlist = kv.writes[2];
        const all = await kv.listValues((await drafts.categoryId())!);
        const last = JSON.parse(all.find((v) => v.id === (playlist as { valueId: number }).valueId)!.value) as { kind: string };
        expect(last.kind).toBe('playlist-draft');
    });

    it('stops before the first write when one value is too large', async () => {
        kv.writes.length = 0;
        const big = makeSlide({ id: 's2', blocks: [textBlock('a', 'x'.repeat(10_000))] });
        await expect(drafts.save(change({ slides: [makeSlide({ id: 's1' }), big] }), anna)).rejects.toBeInstanceOf(
            ValueTooLargeError,
        );
        expect(kv.writes).toEqual([]);
    });

    it('discards only its own playlist', async () => {
        await drafts.save(change(), anna);
        await drafts.save(change({ playlistId: 'p2', slideIds: ['s1'], slides: [makeSlide({ id: 's1' })] }), anna);
        await drafts.discard('p1');
        expect(await drafts.load('p1')).toBeNull();
        expect((await drafts.load('p2'))?.slides).toHaveLength(1);
        expect([...(await drafts.list()).keys()]).toEqual(['p2']);
    });

    it('lists who saved a draft and when', async () => {
        await drafts.save(change(), anna);
        expect(await drafts.list()).toEqual(
            new Map([['p1', { updatedBy: 'Anna', updatedAt: '2026-10-10T10:00:00.000Z' }]]),
        );
    });

    it('reports an unreadable value as an issue', async () => {
        await drafts.save(change(), anna);
        await kv.createValue((await drafts.categoryId())!, '{kaputt');
        expect((await drafts.load('p1'))?.issues).toHaveLength(1);
    });

    describe('without the category', () => {
        it('loads nothing, lists nothing, discards nothing, and cannot save', async () => {
            const bare = new DraftStore(new MemoryKv());
            expect(await bare.load('p1')).toBeNull();
            expect((await bare.list()).size).toBe(0);
            await expect(bare.discard('p1')).resolves.toBeUndefined();
            await expect(bare.save(change(), anna)).rejects.toBeInstanceOf(DraftsUnavailableError);
        });
    });

    describe('when ChurchTools refuses', () => {
        // A missing right comes as 401 „Session abgelaufen" (G56) – it must not look like a lost login.
        function refusing(status: number): DraftStore {
            const refuse = () => Promise.reject(Object.assign(new Error('refused'), { response: { status } }));
            const backend: KvBackend = {
                listCategories: () => Promise.resolve([{ id: 5, shorty: 'drafts', name: 'Entwürfe' }]),
                createCategory: refuse,
                listValues: refuse,
                createValue: refuse,
                updateValue: refuse,
                deleteValue: refuse,
            };
            return new DraftStore(backend);
        }

        it.each([401, 403])('turns a %i into DraftsUnavailableError', async (status) => {
            const store = refusing(status);
            await expect(store.load('p1')).rejects.toBeInstanceOf(DraftsUnavailableError);
            await expect(store.save(change(), anna)).rejects.toBeInstanceOf(DraftsUnavailableError);
            await expect(store.discard('p1')).rejects.toBeInstanceOf(DraftsUnavailableError);
            expect((await store.list()).size).toBe(0);
        });

        it('lets other errors through', async () => {
            await expect(refusing(500).load('p1')).rejects.toThrow('refused');
        });
    });
});
