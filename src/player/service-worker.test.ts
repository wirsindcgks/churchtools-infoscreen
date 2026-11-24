import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keepPlayerStorage, watchForNewVersion, type VersionWatchContainer } from './service-worker';

describe('keepPlayerStorage – the copy must survive a full SD card (docs/Ausfall.md)', () => {
    it('asks to keep the storage when it is not kept yet', async () => {
        const storage = { persisted: vi.fn(async () => false), persist: vi.fn(async () => true) };
        await keepPlayerStorage(storage);
        expect(storage.persist).toHaveBeenCalledTimes(1);
    });

    it('asks nothing when the storage is kept already', async () => {
        const storage = { persisted: vi.fn(async () => true), persist: vi.fn(async () => true) };
        await keepPlayerStorage(storage);
        expect(storage.persist).not.toHaveBeenCalled();
    });

    it('stays quiet on the screen without the API or when the browser says no', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(keepPlayerStorage(undefined)).resolves.toBeUndefined();
        await expect(keepPlayerStorage({ persisted: async () => false, persist: async () => false })).resolves.toBeUndefined();
        await expect(keepPlayerStorage({ persisted: () => Promise.reject(new Error('no')), persist: async () => true })).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledTimes(2);
        warn.mockRestore();
    });
});

describe('watchForNewVersion – a newer player on the TV within a quarter of an hour (Plan.md 117)', () => {
    function fakeContainer(controlled: boolean) {
        const listeners = new Set<() => void>();
        const update = vi.fn(async () => undefined);
        const container = {
            controller: controlled ? ({} as ServiceWorker) : null,
            getRegistration: vi.fn(async () => ({ update }) as unknown as ServiceWorkerRegistration),
            addEventListener: vi.fn((_type: string, listener: () => void) => listeners.add(listener)),
            removeEventListener: vi.fn((_type: string, listener: () => void) => listeners.delete(listener)),
        } as unknown as VersionWatchContainer;
        return { container, update, change: () => listeners.forEach((l) => l()), listeners };
    }

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('asks the browser for the worker every interval and reports a takeover of a controlled page', async () => {
        const { container, update, change, listeners } = fakeContainer(true);
        const onNew = vi.fn();
        const stop = watchForNewVersion('/base/', onNew, 1000, container);
        await vi.advanceTimersByTimeAsync(2500);
        expect(container.getRegistration).toHaveBeenCalledWith('/base/');
        expect(update).toHaveBeenCalledTimes(2);
        change();
        expect(onNew).toHaveBeenCalledTimes(1);
        stop();
        expect(listeners.size).toBe(0);
        await vi.advanceTimersByTimeAsync(5000);
        expect(update).toHaveBeenCalledTimes(2);
    });

    it('takes the first takeover of a page without a worker for none – only the next one is a new version', () => {
        const { container, change } = fakeContainer(false);
        const onNew = vi.fn();
        const stop = watchForNewVersion('/base/', onNew, 1000, container);
        change();
        expect(onNew).not.toHaveBeenCalled();
        change();
        expect(onNew).toHaveBeenCalledTimes(1);
        stop();
    });

    it('does nothing without the API', () => {
        expect(() => watchForNewVersion('/base/', vi.fn(), 1000, undefined)()).not.toThrow();
    });
});
