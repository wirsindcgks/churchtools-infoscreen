import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_VALUE_LENGTH } from '../model/read';
import { DEFAULT_THEME } from '../model/schema';
import { makePlaylist, makeScreen, makeSlide, makeTemplate } from '../model/testing';
import { buildChange, CHANGELOG_CATEGORY, CHANGELOG_DAYS, ChangelogStore, type ChangeEntry } from './changelog';
import { MemoryKv } from './memory-kv';
import { ScreenRepository } from './screen-repository';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-21T12:00:00Z');
const anna = { updatedBy: 'Anna' };

const entry = (overrides: Partial<ChangeEntry> = {}): ChangeEntry => ({
    area: 'playlist',
    targetId: 'p1',
    targetName: 'Sonntag',
    action: 'published',
    by: 'Anna',
    now: NOW,
    ...overrides,
});

/** Refuses the deletion of values, like a designer without the right to edit. */
class NoDeleteKv extends MemoryKv {
    override async deleteValue(): Promise<void> {
        throw Object.assign(new Error('Forbidden'), { response: { status: 403 } });
    }
}

describe('ChangelogStore', () => {
    let kv: MemoryKv;
    let store: ChangelogStore;

    beforeEach(async () => {
        kv = new MemoryKv();
        store = new ChangelogStore(kv);
        await store.ensureCategory();
    });

    it('finds its category by shorty and creates it only on request', async () => {
        const bare = new ChangelogStore(new MemoryKv());
        expect(await bare.categoryId()).toBeNull();
        const id = await bare.ensureCategory();
        expect(id).not.toBeNull();
        expect(await bare.categoryId()).toBe(id);
        expect(CHANGELOG_CATEGORY.shorty).toBe('protokoll');
    });

    it('gives null instead of failing when the category cannot be created', async () => {
        const failing = new MemoryKv();
        failing.failFromWrite = 0;
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        expect(await new ChangelogStore(failing).ensureCategory()).toBeNull();
    });

    it('writes one value per entry and lists them newest first', async () => {
        await store.record(entry({ now: new Date(NOW.getTime() - 2 * DAY), targetName: 'Alt' }));
        await store.record(entry({ targetName: 'Neu', personId: 7, details: ['changed:Begrüßung'] }));
        const list = await store.list(NOW);
        expect(list?.map((c) => c.targetName)).toEqual(['Neu', 'Alt']);
        expect(list?.[0]).toMatchObject({ kind: 'change', by: 'Anna', personId: 7, area: 'playlist', action: 'published', details: ['changed:Begrüßung'] });
    });

    it('lists only the last 30 days', async () => {
        await store.record(entry({ now: new Date(NOW.getTime() - (CHANGELOG_DAYS + 1) * DAY), targetName: 'Zu alt' }));
        await store.record(entry({ now: new Date(NOW.getTime() - (CHANGELOG_DAYS - 1) * DAY), targetName: 'Noch da' }));
        expect((await store.list(NOW))?.map((c) => c.targetName)).toEqual(['Noch da']);
    });

    it('says null, not an empty list, without the category', async () => {
        expect(await new ChangelogStore(new MemoryKv()).list(NOW)).toBeNull();
        expect(await store.list(NOW)).toEqual([]);
    });

    it('writes nothing and says nothing without the category', async () => {
        const bare = new MemoryKv();
        await new ChangelogStore(bare).record(entry());
        expect(bare.writes).toEqual([]);
    });

    it('never throws when writing fails', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        kv.failFromWrite = kv.writes.length;
        await expect(store.record(entry())).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalled();
    });

    it('prune deletes only the old entries', async () => {
        await store.record(entry({ now: new Date(NOW.getTime() - 40 * DAY), targetName: 'Alt' }));
        await store.record(entry({ now: new Date(NOW.getTime() - 5 * DAY), targetName: 'Jung' }));
        expect(await store.prune(NOW)).toBe(1);
        const left = await kv.listValues((await store.categoryId())!);
        expect(left.map((v) => JSON.parse(v.value).targetName)).toEqual(['Jung']);
    });

    it('prune survives a refused deletion – the list hides the old ones anyway', async () => {
        const refusing = new NoDeleteKv();
        const guarded = new ChangelogStore(refusing);
        await guarded.ensureCategory();
        await guarded.record(entry({ now: new Date(NOW.getTime() - 40 * DAY), targetName: 'Alt' }));
        await guarded.record(entry({ targetName: 'Neu' }));
        expect(await guarded.prune(NOW)).toBe(0);
        expect((await guarded.list(NOW))?.map((c) => c.targetName)).toEqual(['Neu']);
    });

    it('cuts texts and details so the value stays under 10,000 characters', async () => {
        const long = 'ä'.repeat(500);
        const doc = buildChange(entry({ targetName: long, by: long, details: Array.from({ length: 80 }, () => long) }));
        expect(JSON.stringify(doc).length).toBeLessThan(MAX_VALUE_LENGTH);
        expect(doc.targetName.length).toBe(100);
        expect(doc.details).toHaveLength(30);
        expect(doc.details?.at(-1)).toBe('more:51');
        await store.record(entry({ targetName: long, details: Array.from({ length: 80 }, () => long) }));
        expect(await store.list(NOW)).toHaveLength(1);
    });
});

describe('ScreenRepository writes the changelog after a successful save (Plan.md 100)', () => {
    let kv: MemoryKv;
    let repo: ScreenRepository;

    const lines = async () => {
        await repo.changelogSettled();
        return ((await repo.changelog.list(new Date())) ?? []).map((c) => `${c.area}:${c.action}:${c.targetName}`).sort();
    };

    beforeEach(async () => {
        kv = new MemoryKv();
        repo = new ScreenRepository(kv);
        await repo.changelog.ensureCategory();
        repo.actor = async () => ({ by: 'Anna', personId: 4 });
    });

    it('has one entry per operation, with the person', async () => {
        const screen = await repo.saveScreen(
            { screen: makeScreen(), playlists: [makePlaylist({ slideIds: ['slide-1'] })], slides: [makeSlide({ id: 'slide-1' })] },
            { ...anna, expectedRevision: null },
        );
        const created = await repo.createPlaylist({ name: 'Advent', stage: { width: 1920, height: 1080 } }, 'Anna');
        const copy = await repo.duplicatePlaylist(created.id, 'Anna');
        await repo.deletePlaylist(copy.id);
        const loaded = await repo.loadPlaylist(created.id);
        await repo.savePlaylist({ playlist: loaded.playlist, slides: loaded.slides }, { ...anna, expectedRevision: 1 });
        await repo.saveSchedule(screen.id, { defaultPlaylistId: created.id, rules: [] }, { ...anna, expectedRevision: null });
        await repo.saveScreenSettings(screen.id, { name: 'Eingang' }, { ...anna, expectedRevision: 1 });
        await repo.saveBanners([{ playlistId: created.id, expectedRevision: 2, banner: null }], anna);
        await repo.saveTheme(DEFAULT_THEME, { ...anna, expectedRevision: null });
        await repo.saveTemplate(makeTemplate({ id: 't1', name: 'Kopf' }), { ...anna, expectedRevision: null });
        await repo.deleteTemplate('t1');
        await repo.saveMedia({ schema: { major: 1, minor: 1 }, kind: 'media', id: 'm1', name: 'Logo', fileId: 7, imageUrl: 'https://x.example/7' });
        await repo.deleteMedia('m1');
        await repo.saveSettings({ schema: { major: 1, minor: 1 } });
        await repo.deleteScreen(screen.slug);

        expect(await lines()).toEqual([
            'screen:created:' + screen.name,
            'playlist:created:Advent',
            'playlist:duplicated:Advent (Kopie)',
            'playlist:deleted:Advent (Kopie)',
            'playlist:published:Advent',
            'screen:schedule:' + screen.name,
            'screen:settings:Eingang',
            'playlist:banners:Advent',
            'theme:saved:Design',
            'template:created:Kopf',
            'template:deleted:Kopf',
            'media:created:Logo',
            'media:deleted:Logo',
            'settings:settings:Einstellungen',
            'screen:deleted:Eingang',
        ].sort());
        const first = (await repo.changelog.list(new Date()))![0]!;
        expect(first).toMatchObject({ by: 'Anna', personId: 4 });
    });

    it('names the slides a publication changed, added and removed', async () => {
        const base = await repo.saveScreen(
            { screen: makeScreen(), playlists: [makePlaylist({ slideIds: ['a', 'b'] })], slides: [makeSlide({ id: 'a', name: 'Eins' }), makeSlide({ id: 'b', name: 'Zwei' })] },
            { ...anna, expectedRevision: null },
        );
        expect(base.revision).toBe(1);
        const playlist = { ...makePlaylist({ slideIds: ['a', 'c'], revision: 0 }), stage: { width: 1920, height: 1080 } };
        await repo.savePlaylist(
            { playlist, slides: [makeSlide({ id: 'a', name: 'Eins' }), makeSlide({ id: 'c', name: 'Drei' })] },
            { ...anna, expectedRevision: 0, changedSlideIds: ['a', 'c'] },
        );
        await repo.changelogSettled();
        const published = (await repo.changelog.list(new Date()))!.find((c) => c.action === 'published');
        expect(published?.details).toEqual(['changed:Eins', 'added:Drei', 'removed:1']);
    });

    it('lets the save succeed when the changelog cannot be written', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const changelogId = (await repo.changelog.categoryId())!;
        const create = kv.createValue.bind(kv);
        kv.createValue = async (categoryId, value) => {
            if (categoryId === changelogId) throw new Error('Forbidden');
            return create(categoryId, value);
        };
        const created = await repo.createPlaylist({ name: 'Advent', stage: { width: 1920, height: 1080 } }, 'Anna');
        await repo.changelogSettled();
        expect(created.name).toBe('Advent');
        expect((await repo.loadPlaylist(created.id)).playlist.name).toBe('Advent');
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('stays silent without the category and leaves drafts and heartbeats out', async () => {
        const bare = new MemoryKv();
        const plain = new ScreenRepository(bare);
        await plain.createPlaylist({ name: 'Advent', stage: { width: 1920, height: 1080 } }, 'Anna');
        await plain.changelogSettled();
        expect(bare.writes.some((w) => w.op === 'createCategory' && w.shorty === 'protokoll')).toBe(false);
        expect(await plain.changelog.list(new Date())).toBeNull();
    });
});
