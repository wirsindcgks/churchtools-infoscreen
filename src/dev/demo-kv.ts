/**
 * The store of demo mode (development without Custom Modules, T1): memory
 * with a copy in this browser's storage, so that the designer tab and a
 * player tab see the same screens. Every write is announced to the other
 * tabs, and an open player reloads its configuration at once.
 *
 * Never used in production: there the screens live in ChurchTools.
 */
import { MemoryKv, type MemoryKvState } from '../store/memory-kv';

const STORAGE_KEY = 'infoscreen-designer.demo-store';
const CHANNEL = 'infoscreen-designer.demo';

class PersistentMemoryKv extends MemoryKv {
    private readonly channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);

    /** Another tab may have written since: read the shared copy before every read. */
    private reload(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) this.restore(JSON.parse(stored) as MemoryKvState);
        } catch {
            // Keep what this tab has.
        }
    }

    override async listCategories() {
        this.reload();
        return super.listCategories();
    }

    override async listValues(categoryId: number) {
        this.reload();
        return super.listValues(categoryId);
    }

    private persist(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot()));
        } catch {
            // Storage refused (private window): the demo then lives in this tab only.
        }
        this.channel?.postMessage('changed');
    }

    override async createCategory(category: { shorty: string; name: string }) {
        const created = await super.createCategory(category);
        this.persist();
        return created;
    }

    override async createValue(categoryId: number, value: string) {
        const created = await super.createValue(categoryId, value);
        this.persist();
        return created;
    }

    override async updateValue(categoryId: number, valueId: number, value: string) {
        await super.updateValue(categoryId, valueId, value);
        this.persist();
    }

    override async deleteValue(categoryId: number, valueId: number) {
        await super.deleteValue(categoryId, valueId);
        this.persist();
    }
}

export function createDemoKv(): { kv: MemoryKv; restored: boolean } {
    const kv = new PersistentMemoryKv();
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            kv.restore(JSON.parse(stored) as MemoryKvState);
            return { kv, restored: true };
        }
    } catch {
        // Unreadable copy: start over with a fresh demo.
    }
    return { kv, restored: false };
}

/** Calls back whenever another tab changed the demo store. Returns an unsubscribe function. */
export function onDemoChange(callback: () => void): () => void {
    if (typeof BroadcastChannel === 'undefined') return () => {};
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => callback();
    return () => channel.close();
}

export function resetDemo(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Nothing stored.
    }
}
