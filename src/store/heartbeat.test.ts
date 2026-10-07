import { describe, expect, it, vi } from 'vitest';
import type { HeartbeatDoc } from '../model/heartbeat';
import { MemoryKv } from './memory-kv';
import { ScreenRepository } from './screen-repository';

// The signs of life of the screens (Plan.md 59).

const beat = (screen: string, at: string, overrides: Partial<HeartbeatDoc> = {}): HeartbeatDoc => ({
    kind: 'heartbeat',
    screen,
    at,
    version: '0.17.0',
    playlistId: 'p1',
    clockConfirmed: true,
    ...overrides,
});

async function withStatus() {
    const kv = new MemoryKv();
    const repo = new ScreenRepository(kv);
    const id = await repo.ensureStatusCategory();
    return { kv, repo, id: id! };
}

const valuesOf = async (kv: MemoryKv, id: number) => (await kv.listValues(id)).map((v) => JSON.parse(v.value) as HeartbeatDoc);

describe('the status category', () => {
    it('is not one of the categories every user creates', async () => {
        const kv = new MemoryKv();
        await new ScreenRepository(kv).ensureCategories();
        const shorties = (await kv.listCategories()).map((c) => c.shorty);
        expect(shorties).not.toContain('status');
        expect(shorties).toHaveLength(5);
    });

    it('is only looked for, not created, by statusCategoryId', async () => {
        const kv = new MemoryKv();
        const repo = new ScreenRepository(kv);
        expect(await repo.statusCategoryId()).toBeNull();
        expect(kv.writes).toEqual([]);
    });

    it('finds a category that appears later', async () => {
        const kv = new MemoryKv();
        const repo = new ScreenRepository(kv);
        expect(await repo.statusCategoryId()).toBeNull();
        const created = await kv.createCategory({ shorty: 'status', name: 'Status' });
        expect(await repo.statusCategoryId()).toBe(created.id);
    });

    it('is created by ensureStatusCategory, once', async () => {
        const kv = new MemoryKv();
        const repo = new ScreenRepository(kv);
        const id = await repo.ensureStatusCategory();
        expect(id).not.toBeNull();
        expect(await repo.ensureStatusCategory()).toBe(id);
        expect(kv.writes).toEqual([{ op: 'createCategory', shorty: 'status' }]);
    });

    it('gives null, quietly, when creating is refused', async () => {
        const kv = new MemoryKv();
        kv.failFromWrite = 0;
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(await new ScreenRepository(kv).ensureStatusCategory()).toBeNull();
        warn.mockRestore();
    });
});

describe('writeHeartbeat', () => {
    it('creates the value, then changes the same one', async () => {
        const { kv, repo, id } = await withStatus();
        await repo.writeHeartbeat(beat('foyer', '2026-10-05T10:00:00Z'));
        await repo.writeHeartbeat(beat('foyer', '2026-10-05T10:05:00Z'));
        const values = await valuesOf(kv, id);
        expect(values).toHaveLength(1);
        expect(values[0]!.at).toBe('2026-10-05T10:05:00Z');
        expect(kv.writes.filter((w) => w.op === 'createValue')).toHaveLength(1);
    });

    it('finds its value again after a restart, without creating a second', async () => {
        const { kv, id } = await withStatus();
        await new ScreenRepository(kv).writeHeartbeat(beat('foyer', '2026-10-05T10:00:00Z'));
        await new ScreenRepository(kv).writeHeartbeat(beat('foyer', '2026-10-05T10:05:00Z'));
        expect(await valuesOf(kv, id)).toHaveLength(1);
    });

    it('keeps one value per screen', async () => {
        const { kv, repo, id } = await withStatus();
        await repo.writeHeartbeat(beat('foyer', '2026-10-05T10:00:00Z'));
        await repo.writeHeartbeat(beat('saal', '2026-10-05T10:01:00Z'));
        await repo.writeHeartbeat(beat('foyer', '2026-10-05T10:05:00Z'));
        expect((await valuesOf(kv, id)).map((v) => v.screen).sort()).toEqual(['foyer', 'saal']);
    });

    it('does nothing without the category', async () => {
        const kv = new MemoryKv();
        await new ScreenRepository(kv).writeHeartbeat(beat('foyer', '2026-10-05T10:00:00Z'));
        expect(kv.writes).toEqual([]);
    });

    it('lets a refusal through – the player swallows it', async () => {
        const { kv, repo } = await withStatus();
        kv.failFromWrite = kv.writes.length;
        await expect(repo.writeHeartbeat(beat('foyer', '2026-10-05T10:00:00Z'))).rejects.toThrow();
    });
});

describe('listHeartbeats', () => {
    it('is null without a visible category', async () => {
        expect(await new ScreenRepository(new MemoryKv()).listHeartbeats()).toBeNull();
    });

    it('is empty for a category without values', async () => {
        const { repo } = await withStatus();
        expect((await repo.listHeartbeats())!.size).toBe(0);
    });

    it('gives the latest per slug and skips what is no sign of life', async () => {
        const { kv, repo, id } = await withStatus();
        await kv.createValue(id, JSON.stringify(beat('foyer', '2026-10-05T10:00:00Z')));
        await kv.createValue(id, JSON.stringify(beat('foyer', '2026-10-05T10:09:00Z')));
        await kv.createValue(id, JSON.stringify(beat('foyer', '2026-10-05T10:03:00Z')));
        await kv.createValue(id, JSON.stringify(beat('saal', 'kein Datum')));
        await kv.createValue(id, 'kein JSON');
        await kv.createValue(id, JSON.stringify({ kind: 'etwas anderes' }));
        await kv.createValue(id, JSON.stringify(null));
        const list = (await repo.listHeartbeats())!;
        expect(list.get('foyer')!.at).toBe('2026-10-05T10:09:00Z');
        expect(list.get('saal')!.at).toBe('kein Datum');
        expect(list.size).toBe(2);
    });
});
