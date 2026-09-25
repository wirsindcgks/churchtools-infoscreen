import { MAX_VALUE_LENGTH } from '../model/read';
import type { KvBackend, KvCategory, KvValue } from './kv';

export interface MemoryKvState {
    nextId: number;
    categories: KvCategory[];
    values: [number, KvValue[]][];
}

export type KvOperation =
    | { op: 'createCategory'; shorty: string }
    | { op: 'createValue' | 'updateValue' | 'deleteValue'; categoryId: number; valueId?: number };

/**
 * In-memory stand-in for the ChurchTools KV store, used by tests and by
 * development without Custom Modules. Records every write and can be told
 * to fail on a given write to simulate an interrupted save.
 */
export class MemoryKv implements KvBackend {
    private nextId = 1;
    private categories: KvCategory[] = [];
    private values = new Map<number, KvValue[]>();

    readonly writes: KvOperation[] = [];
    /** Categories whose values were listed, in order – for tests that count reads. */
    readonly reads: number[] = [];

    /** Plain copy of the stored state, e.g. to keep it across page loads. */
    snapshot(): MemoryKvState {
        return { nextId: this.nextId, categories: this.categories, values: [...this.values.entries()] };
    }

    restore(state: MemoryKvState): void {
        this.nextId = state.nextId;
        this.categories = state.categories.map((c) => ({ ...c }));
        this.values = new Map(state.values.map(([id, list]) => [id, list.map((v) => ({ ...v }))]));
    }

    /** Throw on the write with this index (0-based) and every one after it. */
    failFromWrite: number | null = null;

    async listCategories(): Promise<KvCategory[]> {
        return this.categories.map((c) => ({ ...c }));
    }

    async createCategory(category: { shorty: string; name: string }): Promise<KvCategory> {
        this.recordWrite({ op: 'createCategory', shorty: category.shorty });
        const created = { id: this.nextId++, shorty: category.shorty, name: category.name };
        this.categories.push(created);
        this.values.set(created.id, []);
        return { ...created };
    }

    async listValues(categoryId: number): Promise<KvValue[]> {
        this.reads.push(categoryId);
        return this.category(categoryId).map((v) => ({ ...v }));
    }

    async createValue(categoryId: number, value: string): Promise<KvValue> {
        const list = this.category(categoryId);
        this.checkLength(value);
        this.recordWrite({ op: 'createValue', categoryId });
        const created = { id: this.nextId++, value };
        list.push(created);
        return { ...created };
    }

    async updateValue(categoryId: number, valueId: number, value: string): Promise<void> {
        const entry = this.entry(categoryId, valueId);
        this.checkLength(value);
        this.recordWrite({ op: 'updateValue', categoryId, valueId });
        entry.value = value;
    }

    async deleteValue(categoryId: number, valueId: number): Promise<void> {
        const list = this.category(categoryId);
        this.entry(categoryId, valueId);
        this.recordWrite({ op: 'deleteValue', categoryId, valueId });
        this.values.set(
            categoryId,
            list.filter((v) => v.id !== valueId),
        );
    }

    private recordWrite(operation: KvOperation): void {
        if (this.failFromWrite !== null && this.writes.length >= this.failFromWrite) {
            throw new Error(`simulated failure on write ${this.writes.length}`);
        }
        this.writes.push(operation);
    }

    private checkLength(value: string): void {
        // How the real server reacts is unmeasured (C4); the repository checks before writing anyway.
        if (value.length > MAX_VALUE_LENGTH) throw new Error(`value exceeds ${MAX_VALUE_LENGTH} characters`);
    }

    private category(categoryId: number): KvValue[] {
        const list = this.values.get(categoryId);
        if (!list) throw new Error(`unknown category ${categoryId}`);
        return list;
    }

    private entry(categoryId: number, valueId: number): KvValue {
        const entry = this.category(categoryId).find((v) => v.id === valueId);
        if (!entry) throw new Error(`unknown value ${valueId} in category ${categoryId}`);
        return entry;
    }
}
