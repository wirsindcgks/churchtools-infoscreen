import { describe, expect, it } from 'vitest';
import type { ControlDoc } from '../agenda/control';
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
