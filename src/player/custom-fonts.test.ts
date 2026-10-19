import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CustomFont } from '../model/schema';
import { createCustomFonts, applyCustomFonts, type CustomFontsDeps } from './custom-fonts';
import { fontDef, setCustomFonts } from './fonts';

/** Just enough of Cache Storage: keyed by absolute URL, like the real one. */
class FakeCache {
    readonly entries = new Map<string, Response>();
    async match(url: string) {
        return this.entries.get(url)?.clone();
    }
    async put(url: string, response: Response) {
        this.entries.set(url, response);
    }
    async keys() {
        return [...this.entries.keys()].map((url) => ({ url }));
    }
    async delete(request: string | { url: string }) {
        return this.entries.delete(typeof request === 'string' ? request : request.url);
    }
}

const url = (id: number) => `https://ct.example/?q=public/filedownload&id=${id}&filename=h${id}`;
const file = (id: number) => ({ fileId: id, fileUrl: url(id), name: `f${id}.woff2` });
const font = (key: string, ids: { 400: number; 600?: number; 700?: number }): CustomFont => ({
    key,
    name: key,
    files: { 400: file(ids[400]), ...(ids[600] ? { 600: file(ids[600]) } : {}), ...(ids[700] ? { 700: file(ids[700]) } : {}) },
});

function setup(store: FakeCache | null = new FakeCache()) {
    const registered = new Map<string, string>();
    const deps = {
        open: async () => store as unknown as Cache | null,
        fetch: vi.fn(async (address: string) => new Response(`bytes:${address}`, { status: 200, headers: { 'Content-Type': 'application/unknown' } })),
        register: vi.fn(async (family: string, data: ArrayBuffer, weight: number) => {
            const id = `${family}@${weight}`;
            registered.set(id, new TextDecoder().decode(data));
            return () => void registered.delete(id);
        }),
    } satisfies CustomFontsDeps;
    return { deps, store, registered, fonts: createCustomFonts(deps) };
}

describe('custom fonts', () => {
    afterEach(() => setCustomFonts([]));

    it('fetches each file once, keeps it in storage and registers it per cut under its own name', async () => {
        const { deps, store, registered, fonts } = setup();
        await fonts.sync([font('custom-a', { 400: 1, 700: 2 })]);
        expect([...registered.keys()]).toEqual(['ISD custom-a@400', 'ISD custom-a@700']);
        expect([...store!.entries.keys()]).toEqual([url(1), url(2)]);
        expect(deps.fetch).toHaveBeenCalledTimes(2);

        await fonts.sync([font('custom-a', { 400: 1, 700: 2 })]);
        expect(deps.fetch).toHaveBeenCalledTimes(2);
        expect(deps.register).toHaveBeenCalledTimes(2);
    });

    it('registers from storage when the network is gone, also after a restart', async () => {
        const store = new FakeCache();
        await setup(store).fonts.sync([font('custom-a', { 400: 1 })]);

        const restarted = setup(store);
        restarted.deps.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
        await restarted.fonts.sync([font('custom-a', { 400: 1 })]);
        expect(restarted.deps.fetch).not.toHaveBeenCalled();
        expect([...restarted.registered.keys()]).toEqual(['ISD custom-a@400']);
        expect(restarted.registered.get('ISD custom-a@400')).toBe(`bytes:${url(1)}`);
    });

    it('leaves a font out when the file cannot be had, never throws, and tries again with the next call', async () => {
        const { deps, store, registered, fonts } = setup();
        deps.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        deps.fetch.mockResolvedValueOnce(new Response('denied', { status: 403 }));
        await expect(fonts.sync([font('custom-a', { 400: 1 }), font('custom-b', { 400: 2 })])).resolves.toBeUndefined();
        expect(registered.size).toBe(0);
        expect(store!.entries.size).toBe(0);

        await fonts.sync([font('custom-a', { 400: 1 })]);
        expect([...registered.keys()]).toEqual(['ISD custom-a@400']);
    });

    it('leaves a font out and forgets its copy when the bytes are no font', async () => {
        const { deps, store, registered, fonts } = setup();
        deps.register.mockRejectedValueOnce(new Error('not a font'));
        await fonts.sync([font('custom-a', { 400: 1 })]);
        expect(registered.size).toBe(0);
        expect(store!.entries.size).toBe(0);
    });

    it('still registers a font where Cache Storage is missing', async () => {
        const { registered, fonts } = setup(null);
        await fonts.sync([font('custom-a', { 400: 1 })]);
        expect([...registered.keys()]).toEqual(['ISD custom-a@400']);
    });

    it('tidies up: a removed font leaves the page and the storage, a replaced file is fetched anew', async () => {
        const { deps, store, registered, fonts } = setup();
        await fonts.sync([font('custom-a', { 400: 1 }), font('custom-b', { 400: 2 })]);
        await fonts.sync([font('custom-a', { 400: 3 })]);
        expect([...registered.keys()]).toEqual(['ISD custom-a@400']);
        expect(registered.get('ISD custom-a@400')).toBe(`bytes:${url(3)}`);
        expect([...store!.entries.keys()]).toEqual([url(3)]);
        expect(deps.fetch).toHaveBeenCalledTimes(3);

        await fonts.sync([]);
        expect(registered.size).toBe(0);
        expect(store!.entries.size).toBe(0);
    });

    it('applyCustomFonts makes the keys known to fontDef at once', async () => {
        const listed = font('custom-q', { 400: 1 });
        // The shared instance uses the browser; without Cache Storage and FontFace it ends quietly and leaves the font out.
        await applyCustomFonts({ customFonts: [listed] });
        expect(fontDef('custom-q').label).toBe('custom-q');
        await applyCustomFonts(null);
        expect(fontDef('custom-q').key).toBe('lato');
    });
});
