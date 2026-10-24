import { describe, expect, it, vi } from 'vitest';
import { keepPlayerStorage } from './service-worker';

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
