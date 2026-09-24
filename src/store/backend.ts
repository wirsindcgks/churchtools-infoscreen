import { churchtoolsClient } from '@churchtools/churchtools-client';
import { EXTENSION_KEY } from '../config';
import { httpStatus } from '../ct/client';
import { seedDemo } from '../dev/demo';
import { ChurchToolsKv } from './churchtools-kv';
import type { KvBackend } from './kv';
import { MemoryKv } from './memory-kv';
import { ScreenRepository } from './screen-repository';

export interface RepositoryHandle {
    repository: ScreenRepository;
    /** True while the in-memory demo stands in for Custom Modules (development only). */
    demo: boolean;
}

let handle: Promise<RepositoryHandle> | null = null;

/**
 * Uses the KV store of this extension when the module exists. In development
 * without Custom Modules (T1) it falls back to an in-memory store seeded with
 * a demo screen – in production there is no silent fallback.
 */
export function getRepository(): Promise<RepositoryHandle> {
    handle ??= create().catch((error: unknown) => {
        handle = null;
        throw error;
    });
    return handle;
}

async function create(): Promise<RepositoryHandle> {
    if (await moduleExists()) {
        return { repository: new ScreenRepository(new ChurchToolsKv(EXTENSION_KEY)), demo: false };
    }
    if (!import.meta.env.DEV) {
        throw new Error('Das Custom Module ist auf dieser Instanz nicht verfügbar.');
    }
    const kv: KvBackend = new MemoryKv();
    const repository = new ScreenRepository(kv);
    await seedDemo(repository);
    return { repository, demo: true };
}

async function moduleExists(): Promise<boolean> {
    try {
        await churchtoolsClient.get(`/custommodules/${EXTENSION_KEY}`);
        return true;
    } catch (error) {
        // Only a 404 means "no module"; an unreachable instance must not look like one.
        if (httpStatus(error) === 404) return false;
        throw error;
    }
}
