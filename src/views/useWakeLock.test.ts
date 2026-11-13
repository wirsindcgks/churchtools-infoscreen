import { describe, expect, it, vi } from 'vitest';
import { keepScreenOn } from './useWakeLock';

function fakeDoc(state: DocumentVisibilityState = 'visible') {
    const listeners = new Set<() => void>();
    return {
        visibilityState: state,
        addEventListener: (_: string, fn: () => void) => listeners.add(fn),
        removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
        fire() {
            listeners.forEach((fn) => fn());
        },
        listeners,
    };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('keepScreenOn', () => {
    it('asks for the lock, again when the page comes back, and releases it at the end', async () => {
        const release = vi.fn(() => Promise.resolve());
        const request = vi.fn(() => Promise.resolve({ release }));
        const doc = fakeDoc();
        const stop = keepScreenOn({ request }, doc as never);
        await flush();
        expect(request).toHaveBeenCalledTimes(1);
        doc.fire();
        await flush();
        expect(request).toHaveBeenCalledTimes(2);
        stop();
        expect(release).toHaveBeenCalled();
        expect(doc.listeners.size).toBe(0);
    });

    it('does not ask while hidden, and lives without the API or with a refusal', async () => {
        const request = vi.fn(() => Promise.reject(new Error('NotAllowedError')));
        keepScreenOn({ request }, fakeDoc('hidden') as never);
        await flush();
        expect(request).not.toHaveBeenCalled();
        keepScreenOn({ request }, fakeDoc() as never);
        await flush();
        expect(request).toHaveBeenCalledTimes(1);
        expect(() => keepScreenOn(undefined, fakeDoc() as never)).not.toThrow();
    });
});
