import { EXTENSION_KEY } from '../config';
import { httpStatus } from '../ct/client';
import { seedDemo } from '../dev/demo';
import { createDemoKv, onDemoChange, resetDemo } from '../dev/demo-kv';
import { ChurchToolsKv, findCustomModule } from './churchtools-kv';
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
    // In development the demo is the default, also once the module exists: dev server and e2e
    // tests would otherwise write into the real data of the test instance without anyone noticing.
    // VITE_USE_MODULE=true in .env opts in (LocalTests.md).
    const demoFirst = import.meta.env.DEV && import.meta.env.VITE_USE_MODULE !== 'true';
    if (!demoFirst && (await moduleExists())) {
        return { repository: new ScreenRepository(new ChurchToolsKv(EXTENSION_KEY)), demo: false };
    }
    // Written as a positive branch so that the release build drops the demo entirely.
    if (import.meta.env.DEV) {
        const { kv, restored } = createDemoKv();
        const repository = new ScreenRepository(kv);
        if (!restored) await seedDemo(repository);
        return { repository, demo: true };
    }
    throw new Error('Das Custom Module ist auf dieser Instanz nicht verfügbar.');
}

async function moduleExists(): Promise<boolean> {
    try {
        return (await findCustomModule(EXTENSION_KEY)) !== null;
    } catch (error) {
        // Only a 404 means "no Custom Modules at all" (T1); an unreachable instance must not look like one.
        if (httpStatus(error) === 404) return false;
        throw error;
    }
}

/**
 * Calls back when screens were saved elsewhere and a player should look again
 * right away. Only demo mode can tell; with ChurchTools as the store, players
 * find changes on their regular configuration refresh.
 */
export function onStoreChanged(callback: () => void): () => void {
    return import.meta.env.DEV ? onDemoChange(callback) : () => {};
}

/** Drops the demo screens of this browser; does nothing outside development. */
export function resetDemoStore(): void {
    if (import.meta.env.DEV) resetDemo();
}
