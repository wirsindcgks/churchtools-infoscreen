/**
 * Stores screens as several KV values (Plan.md, E):
 *
 * - `screens`   one index value per screen (slug, stage, playlists, revision)
 * - `playlists` one value per playlist
 * - `slides`    one value per slide; slides are referenced, never owned
 *
 * Saving writes several values without a transaction. The index is written
 * last, so a save that breaks off halfway leaves the old screen visible
 * instead of a broken one. Concurrent edits are detected through `revision`,
 * not prevented: between reading and writing a window remains (Risiko 6).
 */
import {
    readMedia,
    readPlaylist,
    readScreen,
    readSlide,
    SchemaTooNewError,
    serialize,
    type ReadIssue,
} from '../model/read';
import type { AnyDoc, MediaDoc, PlaylistDoc, ScreenBundle, ScreenDoc, SlideDoc } from '../model/schema';
import type { KvBackend, KvCategory, KvValue } from './kv';

export const CATEGORIES = {
    screens: { name: 'Screens', description: 'Infoscreen: ein Index-Wert je Screen' },
    playlists: { name: 'Playlists', description: 'Infoscreen: Reihenfolge der Slides' },
    slides: { name: 'Slides', description: 'Infoscreen: eine Slide mit ihren Blöcken' },
    media: { name: 'Medien', description: 'Infoscreen: Verweise auf ChurchTools-Dateien' },
    settings: { name: 'Einstellungen', description: 'Infoscreen: modulweite Einstellungen' },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

/** Orphans younger than this may belong to a save in progress and are kept. */
export const ORPHAN_GRACE_MS = 60 * 60 * 1000;

export class ScreenNotFoundError extends Error {
    constructor(readonly slug: string) {
        super(`Es gibt keinen Screen „${slug}".`);
        this.name = 'ScreenNotFoundError';
    }
}

export class SlugTakenError extends Error {
    constructor(readonly slug: string) {
        super(`Die Adresse „${slug}" ist schon vergeben.`);
        this.name = 'SlugTakenError';
    }
}

export class ConflictError extends Error {
    constructor(readonly current: ScreenDoc) {
        super(
            `Der Screen wurde inzwischen geändert (Stand ${current.revision}` +
                (current.updatedBy ? `, von ${current.updatedBy}` : '') +
                ').',
        );
        this.name = 'ConflictError';
    }
}

export interface LoadedScreen extends ScreenBundle {
    /** Media referenced by the slides, for the player to resolve image blocks. */
    media: MediaDoc[];
    issues: ReadIssue[];
}

interface Stored<T> {
    valueId: number;
    doc: T;
}

export interface SaveOptions {
    /** Revision the editor started from; `null` creates a new screen. */
    expectedRevision: number | null;
    updatedBy: string;
    now?: Date;
}

export class ScreenRepository {
    private categoryIds: Promise<Record<CategoryKey, number>> | null = null;

    constructor(private readonly kv: KvBackend) {}

    /** Creates missing categories on first use, like the setup assistant of ct-pass-store. */
    ensureCategories(): Promise<Record<CategoryKey, number>> {
        this.categoryIds ??= this.createMissingCategories().catch((error: unknown) => {
            this.categoryIds = null;
            throw error;
        });
        return this.categoryIds;
    }

    async listScreens(): Promise<ScreenDoc[]> {
        const { docs } = await this.readScreens();
        return docs.map((s) => s.doc).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    }

    async loadScreen(slug: string): Promise<LoadedScreen> {
        const { docs, issues } = await this.readScreens();
        const screen = docs.find((s) => s.doc.slug === slug)?.doc;
        if (!screen) throw new ScreenNotFoundError(slug);

        const playlistsRead = await this.readAll('playlists', readPlaylist);
        const slidesRead = await this.readSlides();
        issues.push(...playlistsRead.issues, ...slidesRead.issues);

        const playlistIds = new Set([screen.defaultPlaylistId, ...screen.schedule.map((r) => r.playlistId)]);
        const playlists = playlistsRead.docs.map((p) => p.doc).filter((p) => playlistIds.has(p.id));
        for (const id of playlistIds) {
            if (!playlists.some((p) => p.id === id)) issues.push({ documentId: id, message: 'Playlist fehlt.' });
        }

        const slideIds = new Set(playlists.flatMap((p) => p.slideIds));
        const slides = slidesRead.docs.map((s) => s.doc).filter((s) => slideIds.has(s.id));
        for (const id of slideIds) {
            if (!slides.some((s) => s.id === id)) issues.push({ documentId: id, message: 'Slide fehlt.' });
        }

        const mediaIds = new Set(slides.flatMap(referencedMedia));
        const mediaRead = mediaIds.size ? await this.readAll('media', readMedia) : { docs: [], issues: [] };
        issues.push(...mediaRead.issues);
        const media = mediaRead.docs.map((m) => m.doc).filter((m) => mediaIds.has(m.id));
        for (const id of mediaIds) {
            if (!media.some((m) => m.id === id)) issues.push({ documentId: id, message: 'Medium fehlt.' });
        }

        return { screen, playlists, slides, media, issues };
    }

    /**
     * Saves a screen with its playlists and slides and returns the stored index
     * document with its new revision. Everything is validated and size-checked
     * before the first write.
     */
    async saveScreen(bundle: ScreenBundle, options: SaveOptions): Promise<ScreenDoc> {
        const now = (options.now ?? new Date()).toISOString();
        const stamp = <T extends AnyDoc>(doc: T): T => ({ ...doc, updatedAt: now });
        const slides = bundle.slides.map(stamp);
        const playlists = bundle.playlists.map(stamp);
        const nextRevision = (options.expectedRevision ?? 0) + 1;
        const screen: ScreenDoc = { ...stamp(bundle.screen), revision: nextRevision, updatedBy: options.updatedBy };

        this.checkReferences(screen, playlists, slides);
        const serialized = {
            slides: slides.map((doc) => ({ doc, text: serialize(doc) })),
            playlists: playlists.map((doc) => ({ doc, text: serialize(doc) })),
            screen: serialize(screen),
        };

        const ids = await this.ensureCategories();
        const { docs: screens } = await this.readScreens();
        const existing = screens.find((s) => s.doc.id === screen.id);
        const slugOwner = screens.find((s) => s.doc.slug === screen.slug);
        if (slugOwner && slugOwner.doc.id !== screen.id) throw new SlugTakenError(screen.slug);
        if (existing ? existing.doc.revision !== options.expectedRevision : options.expectedRevision !== null) {
            if (existing) throw new ConflictError(existing.doc);
            throw new ScreenNotFoundError(screen.slug);
        }

        const storedSlides = await this.valueIdsById('slides');
        for (const { doc, text } of serialized.slides) {
            await this.upsert(ids.slides, storedSlides.get(doc.id), text);
        }
        const storedPlaylists = await this.valueIdsById('playlists');
        for (const { doc, text } of serialized.playlists) {
            await this.upsert(ids.playlists, storedPlaylists.get(doc.id), text);
        }
        // Last: until this write succeeds, the old index stays authoritative.
        await this.upsert(ids.screens, existing?.valueId, serialized.screen);
        return screen;
    }

    async listMedia(): Promise<MediaDoc[]> {
        return (await this.readAll('media', readMedia)).docs.map((m) => m.doc);
    }

    async saveMedia(doc: MediaDoc): Promise<void> {
        const ids = await this.ensureCategories();
        const text = serialize(doc);
        const stored = await this.valueIdsById('media');
        await this.upsert(ids.media, stored.get(doc.id), text);
    }

    /** Removes only the index; playlists and slides become orphans for {@link collectOrphans}. */
    async deleteScreen(slug: string): Promise<void> {
        const ids = await this.ensureCategories();
        const { docs } = await this.readScreens();
        const target = docs.find((s) => s.doc.slug === slug);
        if (!target) throw new ScreenNotFoundError(slug);
        await this.kv.deleteValue(ids.screens, target.valueId);
    }

    /**
     * Deletes playlists no screen references and slides no playlist references.
     * Orphans younger than the grace period are kept: they may have been written
     * by a save whose index write has not happened yet.
     */
    async collectOrphans(now = new Date()): Promise<{ playlists: number; slides: number }> {
        const ids = await this.ensureCategories();
        const { docs: screens, issues } = await this.readScreens();
        if (issues.length) return { playlists: 0, slides: 0 }; // an unreadable screen might reference anything
        const playlists = await this.readAll('playlists', readPlaylist);
        const slides = await this.readSlides();

        const isOld = (doc: AnyDoc) => !doc.updatedAt || now.getTime() - Date.parse(doc.updatedAt) > ORPHAN_GRACE_MS;
        const usedPlaylists = new Set(
            screens.flatMap((s) => [s.doc.defaultPlaylistId, ...s.doc.schedule.map((r) => r.playlistId)]),
        );
        const deadPlaylists = playlists.docs.filter((p) => !usedPlaylists.has(p.doc.id) && isOld(p.doc));
        const livePlaylists = playlists.docs.filter((p) => !deadPlaylists.includes(p));
        const usedSlides = new Set(livePlaylists.flatMap((p) => p.doc.slideIds));
        const deadSlides = slides.docs.filter((s) => !usedSlides.has(s.doc.id) && isOld(s.doc));

        for (const p of deadPlaylists) await this.kv.deleteValue(ids.playlists, p.valueId);
        for (const s of deadSlides) await this.kv.deleteValue(ids.slides, s.valueId);
        return { playlists: deadPlaylists.length, slides: deadSlides.length };
    }

    private checkReferences(screen: ScreenDoc, playlists: PlaylistDoc[], slides: SlideDoc[]): void {
        const playlistIds = new Set(playlists.map((p) => p.id));
        const needed = [screen.defaultPlaylistId, ...screen.schedule.map((r) => r.playlistId)];
        const missingPlaylist = needed.find((id) => !playlistIds.has(id));
        if (missingPlaylist) throw new Error(`Playlist ${missingPlaylist} fehlt im Speicherstand.`);
        const slideIds = new Set(slides.map((s) => s.id));
        const missingSlide = playlists.flatMap((p) => p.slideIds).find((id) => !slideIds.has(id));
        if (missingSlide) throw new Error(`Slide ${missingSlide} fehlt im Speicherstand.`);
    }

    private async upsert(categoryId: number, valueId: number | undefined, text: string): Promise<void> {
        if (valueId === undefined) await this.kv.createValue(categoryId, text);
        else await this.kv.updateValue(categoryId, valueId, text);
    }

    private async valueIdsById(key: 'slides' | 'playlists' | 'media'): Promise<Map<string, number>> {
        const ids = await this.ensureCategories();
        const values = await this.kv.listValues(ids[key]);
        const map = new Map<string, number>();
        for (const value of values) {
            const id = parseId(value);
            if (id) map.set(id, value.id);
        }
        return map;
    }

    private readScreens() {
        return this.readAll('screens', readScreen);
    }

    private async readSlides() {
        const ids = await this.ensureCategories();
        const values = await this.kv.listValues(ids.slides);
        const docs: Stored<SlideDoc>[] = [];
        const issues: ReadIssue[] = [];
        for (const value of values) {
            try {
                const { doc, issues: slideIssues } = readSlide(JSON.parse(value.value));
                docs.push({ valueId: value.id, doc });
                issues.push(...slideIssues);
            } catch (error) {
                rethrowIfTooNew(error);
                issues.push({ documentId: `slides/${value.id}`, message: errorMessage(error) });
            }
        }
        return { docs, issues };
    }

    private async readAll<T>(key: CategoryKey, read: (raw: unknown) => T) {
        const ids = await this.ensureCategories();
        const values = await this.kv.listValues(ids[key]);
        const docs: Stored<T>[] = [];
        const issues: ReadIssue[] = [];
        for (const value of values) {
            try {
                docs.push({ valueId: value.id, doc: read(JSON.parse(value.value)) });
            } catch (error) {
                rethrowIfTooNew(error);
                issues.push({ documentId: `${key}/${value.id}`, message: errorMessage(error) });
            }
        }
        return { docs, issues };
    }

    private async createMissingCategories(): Promise<Record<CategoryKey, number>> {
        const existing: KvCategory[] = await this.kv.listCategories();
        const result = {} as Record<CategoryKey, number>;
        for (const [shorty, meta] of Object.entries(CATEGORIES) as [CategoryKey, (typeof CATEGORIES)[CategoryKey]][]) {
            const found = existing.find((c) => c.shorty === shorty);
            result[shorty] = found ? found.id : (await this.kv.createCategory({ shorty, ...meta })).id;
        }
        return result;
    }
}

function referencedMedia(slide: SlideDoc): string[] {
    const ids = slide.blocks.flatMap((b) => (b.type === 'image' ? [b.mediaId] : []));
    if (slide.background.kind === 'media') ids.push(slide.background.mediaId);
    return ids;
}

function parseId(value: KvValue): string | null {
    try {
        const id = (JSON.parse(value.value) as { id?: unknown }).id;
        return typeof id === 'string' ? id : null;
    } catch {
        return null;
    }
}

function rethrowIfTooNew(error: unknown): void {
    if (error instanceof SchemaTooNewError) throw error;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
