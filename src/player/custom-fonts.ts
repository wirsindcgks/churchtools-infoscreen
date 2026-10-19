/**
 * Loads the church's own fonts (schema 1.46, Plan.md 103; G64). Each file is fetched once, kept in Cache Storage and
 * registered in `document.fonts` from its bytes – not as `url(...)`: the way over the ArrayBuffer is not subject to the
 * Content-Security-Policy, and a device without a network reads the file from its own storage after a restart.
 *
 * Every failure leaves the font out: text in it then draws in Lato (`fontStack`), the screen never stops.
 */
import type { CustomFont } from '../model/schema';
import { customFamily, setCustomFonts } from './fonts';
import { videoSrc } from './video';

export interface CustomFontsDeps {
    /** `null` where Cache Storage is missing, e.g. outside a secure context. */
    open: () => Promise<Cache | null>;
    fetch: (url: string) => Promise<Response>;
    /** Registers the face; rejects when the bytes are no font. Resolves to the call that takes it out again. */
    register: (family: string, data: ArrayBuffer, weight: number) => Promise<() => void>;
}

const CACHE_NAME = 'infoscreen-font-v1';

const browserDeps: CustomFontsDeps = {
    async open() {
        if (typeof caches === 'undefined') return null;
        return caches.open(CACHE_NAME);
    },
    // The download address wants the session of the instance; in development the dev proxy brings it (same path as videos).
    fetch: (url) => fetch(videoSrc({ fileUrl: url }) ?? url, { credentials: 'same-origin' }),
    async register(family, data, weight) {
        const face = new FontFace(family, data, { weight: String(weight) });
        await face.load();
        document.fonts.add(face);
        return () => void document.fonts.delete(face);
    },
};

export interface CustomFonts {
    /** Makes every listed font available and drops all others; calls run one after another and never reject. */
    sync(fonts: readonly CustomFont[]): Promise<void>;
}

interface Wanted {
    id: string;
    url: string;
    family: string;
    weight: number;
}

function wantedFaces(fonts: readonly CustomFont[]): Wanted[] {
    return fonts.flatMap((font) =>
        ([400, 600, 700] as const).flatMap((weight) => {
            const file = font.files[weight];
            return file ? [{ id: `${font.key}@${weight}`, url: file.fileUrl, family: customFamily(font.key), weight }] : [];
        }),
    );
}

export function createCustomFonts(deps: CustomFontsDeps = browserDeps): CustomFonts {
    const registered = new Map<string, { url: string; remove: () => void }>();
    let store: Promise<Cache | null> | undefined;
    let queue: Promise<unknown> = Promise.resolve();

    function cache(): Promise<Cache | null> {
        store ??= deps.open().catch(() => null);
        return store;
    }

    /** From the device's storage when it is there – also without a network –, else from the instance, and then stored. */
    async function bytes(store: Cache | null, url: string): Promise<ArrayBuffer | null> {
        const stored = await store?.match(url).catch(() => undefined);
        if (stored) return stored.arrayBuffer();
        const response = await deps.fetch(url);
        if (!response.ok || response.type === 'opaque') return null;
        // A refusal to store (quota) does not keep the font off the screen.
        await store?.put(url, response.clone()).catch(() => undefined);
        return response.arrayBuffer();
    }

    async function run(fonts: readonly CustomFont[]): Promise<void> {
        const store = await cache();
        const wanted = wantedFaces(fonts);
        const ids = new Set(wanted.map((w) => w.id));
        for (const [id, face] of registered) {
            const now = wanted.find((w) => w.id === id);
            if (ids.has(id) && now?.url === face.url) continue;
            face.remove();
            registered.delete(id);
        }
        for (const face of wanted) {
            if (registered.has(face.id)) continue;
            try {
                const data = await bytes(store, face.url);
                if (!data) continue;
                registered.set(face.id, { url: face.url, remove: await deps.register(face.family, data, face.weight) });
            } catch {
                // Offline without a copy, refused, or no font: this face stays out, the text draws in Lato.
                // A copy that is no font must not be kept: the next run fetches it again.
                await store?.delete(face.url).catch(() => undefined);
            }
        }
        if (!store) return;
        try {
            const urls = new Set(wanted.map((w) => new URL(w.url, location.href).href));
            for (const request of await store.keys()) {
                if (!urls.has(request.url)) await store.delete(request);
            }
        } catch {
            // Cleaning up is worth trying, not worth failing over.
        }
    }

    return {
        sync(fonts) {
            const next = queue.then(() => run(fonts)).catch(() => undefined);
            queue = next;
            return next;
        },
    };
}

const shared = createCustomFonts();

/**
 * Makes the fonts of a loaded design known (for `fontDef`) and loads their files: the one call the player and
 * every designer page that shows text make once the design is there. Resolves when the files are in.
 */
export function applyCustomFonts(theme: { customFonts?: readonly CustomFont[] } | null | undefined): Promise<void> {
    setCustomFonts(theme?.customFonts);
    return shared.sync(theme?.customFonts ?? []);
}
