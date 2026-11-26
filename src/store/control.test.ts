import { describe, expect, it } from 'vitest';
import type { ControlDoc, OverrideDoc, RehearsalCatalogDoc, RehearsalDoc } from '../agenda/control';
import { MemoryKv } from './memory-kv';
import { ScreenRepository } from './screen-repository';

const choice = (section: number, at: string, eventId = 5): ControlDoc => ({ eventId, itemIndex: 1, section, at });

describe('writeControl', () => {
    it('fails without the category', async () => {
        await expect(new ScreenRepository(new MemoryKv()).writeControl(choice(0, '2026-11-11T10:00:00Z'))).rejects.toThrow();
    });

    it('creates the value, then changes the same one', async () => {
        const kv = new MemoryKv();
        const repo = new ScreenRepository(kv);
        const id = (await repo.ensureControlCategory())!;
        await repo.writeControl(choice(0, '2026-11-11T10:00:00Z'));
        await repo.writeControl(choice(2, '2026-11-11T10:05:00Z'));
        expect(await kv.listValues(id)).toHaveLength(1);
        expect((await repo.readControls())[5]!.section).toBe(2);
        expect(kv.writes.filter((w) => w.op === 'createValue')).toHaveLength(1);
    });

    it('removes old choices of other events', async () => {
        const kv = new MemoryKv();
        const repo = new ScreenRepository(kv);
        const id = (await repo.ensureControlCategory())!;
        await kv.createValue(id, JSON.stringify(choice(0, '2020-01-01T10:00:00Z', 9)));
        await repo.writeControl(choice(1, new Date().toISOString()));
        expect(Object.keys(await repo.readControls())).toEqual(['5']);
    });
});

describe('writeRehearsal', () => {
    const rehearsal = (section: number, at: string): RehearsalDoc => ({ kind: 'rehearsal', songId: 7, arrangementId: 3, section, at });

    it('fails without the category and reads nothing', async () => {
        const repo = new ScreenRepository(new MemoryKv());
        await expect(repo.writeRehearsal(rehearsal(0, '2026-11-11T10:00:00Z'))).rejects.toThrow();
        expect(await repo.readRehearsal()).toBeNull();
    });

    it('changes the one value and leaves the choices per event alone, as they leave it', async () => {
        const kv = new MemoryKv();
        const repo = new ScreenRepository(kv);
        const id = (await repo.ensureControlCategory())!;
        await repo.writeControl(choice(1, '2020-01-01T10:00:00Z'));
        await repo.writeRehearsal(rehearsal(0, '2026-11-11T10:00:00Z'));
        await repo.writeRehearsal(rehearsal(2, '2026-11-11T10:05:00Z'));
        expect(await kv.listValues(id)).toHaveLength(2);
        expect((await repo.readRehearsal())!.section).toBe(2);
        await repo.writeControl(choice(3, new Date().toISOString(), 6));
        expect((await repo.readRehearsal())!.section).toBe(2);
        expect(Object.keys(await repo.readControls())).toEqual(['6']);
    });
});

describe('writeRehearsalCatalog (Plan.md 125 A)', () => {
    const catalog = (at: string, screens = [{ id: 's1', name: 'Probenraum' }]): RehearsalCatalogDoc => ({ kind: 'rehearsalCatalog', screens, playlists: [], clickScreens: [{ id: 's2', name: 'Bühne' }], at });

    it('fails without the category and reads nothing', async () => {
        const repo = new ScreenRepository(new MemoryKv());
        await expect(repo.writeRehearsalCatalog(catalog('2026-11-23T10:00:00Z'))).rejects.toThrow();
        expect(await repo.readRehearsalCatalog()).toBeNull();
    });

    it('changes the one value, writes empty lists too, and leaves every other value alone', async () => {
        const kv = new MemoryKv();
        const repo = new ScreenRepository(kv);
        const id = (await repo.ensureControlCategory())!;
        await repo.writeControl(choice(1, '2020-01-01T10:00:00Z'));
        await repo.writeRehearsal({ kind: 'rehearsal', songId: 7, arrangementId: 3, section: 0, at: '2020-01-01T10:00:00Z' });
        await kv.createValue(id, 'not ours');
        await repo.writeRehearsalCatalog(catalog('2026-11-23T10:00:00Z'));
        await repo.writeRehearsalCatalog(catalog('2026-11-23T10:05:00Z', []));
        expect(await kv.listValues(id)).toHaveLength(4);
        expect(await repo.readRehearsalCatalog()).toEqual(catalog('2026-11-23T10:05:00Z', []));
        expect((await repo.readRehearsal())!.songId).toBe(7);
        expect(Object.keys(await repo.readControls())).toEqual(['5']);
    });

    it('removes doubles and refuses a value that is too large', async () => {
        const kv = new MemoryKv();
        const repo = new ScreenRepository(kv);
        const id = (await repo.ensureControlCategory())!;
        await kv.createValue(id, JSON.stringify(catalog('2026-11-23T10:00:00Z')));
        await kv.createValue(id, JSON.stringify(catalog('2026-11-23T10:01:00Z')));
        await repo.writeRehearsalCatalog(catalog('2026-11-23T10:02:00Z'));
        expect(await kv.listValues(id)).toHaveLength(1);
        const big = Array.from({ length: 100 }, (_, i) => ({ id: `s${i}`, name: 'x'.repeat(100) }));
        await expect(repo.writeRehearsalCatalog(catalog('2026-11-23T10:03:00Z', big))).rejects.toThrow();
    });
});

describe('writeOverride and readRehearsalScreens (Plan.md 125 C)', () => {
    const override = (screenId: string, at: string, until: string): OverrideDoc => ({ kind: 'override', screenId, playlistId: 'p1', until, at });

    it('fails without the category and reads nothing', async () => {
        const repo = new ScreenRepository(new MemoryKv());
        await expect(repo.writeOverride(override('s1', '2026-11-11T10:00:00Z', '2026-11-11T12:00:00Z'))).rejects.toThrow();
        expect(await repo.readRehearsalScreens()).toEqual({ catalog: null, overrides: {} });
    });

    it('writes one value per screen and leaves the other values alone', async () => {
        const kv = new MemoryKv();
        const repo = new ScreenRepository(kv);
        const id = (await repo.ensureControlCategory())!;
        await repo.writeRehearsalCatalog({ kind: 'rehearsalCatalog', screens: [{ id: 's1', name: 'Probenraum' }], playlists: [], clickScreens: [], at: '2026-11-11T09:00:00Z' });
        await repo.writeRehearsal({ kind: 'rehearsal', songId: 7, arrangementId: 3, section: 0, at: '2026-11-11T09:30:00Z' });
        const soon = new Date(Date.now() + 3_600_000).toISOString();
        await repo.writeOverride(override('s1', new Date().toISOString(), soon));
        await repo.writeOverride(override('s1', new Date(Date.now() + 1000).toISOString(), soon));
        expect(await kv.listValues(id)).toHaveLength(3);
        const read = await repo.readRehearsalScreens();
        expect(read.catalog?.screens[0]!.name).toBe('Probenraum');
        expect(Object.keys(read.overrides)).toEqual(['s1']);
        expect((await repo.readRehearsal())!.songId).toBe(7);
    });
});
