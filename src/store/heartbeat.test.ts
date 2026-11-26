import { describe, expect, it, vi } from 'vitest';
import type { HeartbeatDoc } from '../model/heartbeat';
import type { PositionDoc } from '../model/position';
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

describe('the position of a screen (Plan.md 124 C)', () => {
    const position = (seq: number, at: string, over: Partial<PositionDoc> = {}): PositionDoc => ({
        kind: 'position',
        screenId: 's1',
        playlistId: 'p1',
        advance: 'click',
        slideId: 'sl1',
        number: 1,
        total: 2,
        slides: [
            { id: 'sl1', name: 'Eins' },
            { id: 'sl2', name: 'Zwei' },
        ],
        seq,
        at,
        ...over,
    });

    it('does nothing without the category and reads nothing', async () => {
        const kv = new MemoryKv();
        const repo = new ScreenRepository(kv);
        await repo.writePosition(position(0, '2026-11-26T10:00:00Z'));
        expect(kv.writes).toEqual([]);
        expect(await repo.readPosition('s1')).toBeNull();
    });

    it('creates one value per screen, then changes it with one request', async () => {
        const { kv, repo, id } = await withStatus();
        await repo.writePosition(position(0, '2026-11-26T10:00:00Z'));
        await repo.writePosition(position(1, '2026-11-26T10:00:05Z', { slideId: 'sl2', number: 2, black: true, songsheet: true }));
        await repo.writePosition(position(0, '2026-11-26T10:00:06Z', { screenId: 's2' }));
        expect(await kv.listValues(id)).toHaveLength(2);
        expect(kv.writes.filter((w) => w.op === 'createValue')).toHaveLength(2);
        const read = await repo.readPosition('s1');
        expect(read).toMatchObject({ slideId: 'sl2', number: 2, total: 2, black: true, songsheet: true, seq: 1 });
        expect(read!.slides!.map((s) => s.name)).toEqual(['Eins', 'Zwei']);
    });

    it('is skipped by the signs of life – and skips them', async () => {
        const { repo } = await withStatus();
        await repo.writeHeartbeat(beat('demo', '2026-11-26T10:00:00Z'));
        await repo.writePosition(position(0, '2026-11-26T10:00:01Z'));
        const beats = await repo.listHeartbeats();
        expect([...beats!.keys()]).toEqual(['demo']);
        await repo.writeHeartbeat(beat('demo', '2026-11-26T10:05:00Z'));
        expect((await repo.readPosition('s1'))!.at).toBe('2026-11-26T10:00:01Z');
        expect(await repo.readPosition('demo')).toBeNull();
    });

    it('keeps a value within the limit of a value by leaving slides out', async () => {
        const { repo, kv, id } = await withStatus();
        const slides = Array.from({ length: 300 }, (_, i) => ({ id: `slide-${i}-${'x'.repeat(20)}`, name: 'n'.repeat(80) }));
        await repo.writePosition(position(0, '2026-11-26T10:00:00Z', { slides, total: 300 }));
        const stored = (await kv.listValues(id))[0]!.value;
        expect(stored.length).toBeLessThanOrEqual(10_000);
        const read = await repo.readPosition('s1');
        expect(read!.total).toBe(300);
        expect(read!.slides!.length).toBeGreaterThan(20);
        expect(read!.slides![0]!.name).toHaveLength(40);
    });
});
