/**
 * Drafts of playlists and slides (Plan.md 79, Paket E): what a designer changed and has not published.
 * They live in their own category `drafts`, which devices cannot see – a TV cannot show a draft, not even
 * through a mistake in the player.
 */
import { httpStatus } from '../ct/client';
import { tr } from '../i18n/repository';
import {
    readDraft,
    SchemaTooNewError,
    serialize,
    type ReadIssue,
} from '../model/read';
import {
    SCHEMA_VERSION,
    type PlaylistDraftDoc,
    type SlideDoc,
    type SlideDraftDoc,
} from '../model/schema';
import type { KvBackend, KvValue } from './kv';

/**
 * Not in `CATEGORIES` on purpose, like `STATUS_CATEGORY`: those are created by whoever opens the designer
 * first, and a designer without the right to create categories would get an error. This one is found by
 * its shorty and created only by an administrator (setup page) or the demo.
 */
export const DRAFTS_CATEGORY = {
    shorty: 'drafts',
    name: 'Entwürfe',
    description: 'Infoscreen: Entwürfe der Präsentationen, nur für Gestalter',
} as const;

export interface DraftConflictInfo {
    revision: number;
    updatedBy: string;
    updatedAt: string;
}

/** Someone saved the draft of this playlist after the revision the caller went out from. */
export class DraftConflictError extends Error {
    constructor(readonly current: DraftConflictInfo) {
        super(tr.draftConflict(current.revision, current.updatedBy));
        this.name = 'DraftConflictError';
    }
}

/** No category `drafts`, or no right on it. Never a reason to log in again (G56). */
export class DraftsUnavailableError extends Error {
    constructor() {
        super(tr.draftsUnavailable);
        this.name = 'DraftsUnavailableError';
    }
}

export interface PlaylistDraft {
    playlist: PlaylistDraftDoc;
    /** The slide drafts of this playlist whose slide is in `playlist.slideIds`, in that order. */
    slides: SlideDoc[];
    issues: ReadIssue[];
}

export interface DraftChange {
    playlistId: string;
    name: string;
    slideIds: string[];
    /** The slides to write as drafts; every other slide draft of this playlist is deleted. */
    slides: SlideDoc[];
}

export interface DraftSaveOptions {
    /** The revision of the playlist draft the change goes out from; 0 = there is none yet. */
    expectedRevision: number;
    updatedBy: string;
    now?: Date;
}

interface Entry {
    value: KvValue;
    doc: PlaylistDraftDoc | SlideDraftDoc;
    slide?: SlideDoc;
    issues: ReadIssue[];
}

/** A missing right comes as `401` or `403` – the `401` even says „Session abgelaufen" (G56). */
function missingRight(error: unknown): boolean {
    const status = httpStatus(error);
    return status === 401 || status === 403;
}

export class DraftStore {
    /** The `drafts` category, once found; a missing one is looked for again – it may appear later. */
    private id: number | null = null;

    constructor(private readonly kv: KvBackend) {}

    /** The id of the `drafts` category, or null while there is none this person can see. Creates nothing. */
    async categoryId(): Promise<number | null> {
        if (this.id !== null) return this.id;
        const found = (await this.kv.listCategories()).find((c) => c.shorty === DRAFTS_CATEGORY.shorty);
        this.id = found?.id ?? null;
        return this.id;
    }

    /**
     * Like {@link categoryId}, but creates the category when it is missing. Meant for an administrator and
     * the demo; without the right to create categories it gives null instead of failing.
     */
    async ensureCategory(): Promise<number | null> {
        try {
            const existing = await this.categoryId();
            if (existing !== null) return existing;
            this.id = (await this.kv.createCategory({ ...DRAFTS_CATEGORY })).id;
            return this.id;
        } catch (error) {
            console.warn('Die Kategorie „Entwürfe" konnte nicht angelegt werden:', error);
            return null;
        }
    }

    /** The draft of a playlist; null without the category or without a draft. */
    async load(playlistId: string): Promise<PlaylistDraft | null> {
        return this.guarded(async () => {
            const categoryId = await this.categoryId();
            if (categoryId === null) return null;
            const { entries, issues } = await this.readEntries(categoryId);
            const playlist = entries.find((e) => e.doc.kind === 'playlist-draft' && e.doc.id === playlistId)
                ?.doc as PlaylistDraftDoc | undefined;
            if (!playlist) return null;
            const byId = new Map<string, SlideDoc>();
            for (const entry of entries) {
                if (entry.doc.kind === 'slide-draft' && entry.doc.playlistId === playlistId && entry.slide) {
                    byId.set(entry.slide.id, entry.slide);
                    issues.push(...entry.issues);
                }
            }
            const slides = playlist.slideIds.flatMap((id) => byId.get(id) ?? []);
            return { playlist, slides, issues };
        });
    }

    /**
     * Writes the change as the next revision. Slide drafts first (those no longer in the change are deleted), the playlist draft last: only that one
     * carries the revision, and a save that broke off in between leaves the old revision to try again.
     */
    async save(change: DraftChange, options: DraftSaveOptions): Promise<PlaylistDraftDoc> {
        return this.guarded(async () => {
            const categoryId = await this.categoryId();
            if (categoryId === null) throw new DraftsUnavailableError();
            const { entries } = await this.readEntries(categoryId);
            const existing = entries.find((e) => e.doc.kind === 'playlist-draft' && e.doc.id === change.playlistId);
            const current = (existing?.doc as PlaylistDraftDoc | undefined)?.revision ?? 0;
            if (current !== options.expectedRevision) {
                const doc = existing?.doc as PlaylistDraftDoc;
                throw new DraftConflictError({
                    revision: current,
                    updatedBy: doc?.updatedBy ?? '',
                    updatedAt: doc?.updatedAt ?? '',
                });
            }

            const updatedAt = (options.now ?? new Date()).toISOString();
            const schema = { ...SCHEMA_VERSION };
            const playlist: PlaylistDraftDoc = {
                schema,
                kind: 'playlist-draft',
                id: change.playlistId,
                name: change.name,
                slideIds: change.slideIds,
                revision: current + 1,
                updatedBy: options.updatedBy,
                updatedAt,
            };
            const slideDocs: SlideDraftDoc[] = change.slides.map((slide) => ({
                schema,
                kind: 'slide-draft',
                id: `${change.playlistId}/${slide.id}`,
                playlistId: change.playlistId,
                slide,
                updatedBy: options.updatedBy,
                updatedAt,
            }));
            // Everything is serialized before the first write: one value too large stops the whole save.
            const slideTexts = slideDocs.map((doc) => ({ id: doc.id, text: serialize(doc) }));
            const playlistText = serialize(playlist);

            for (const { id, text } of slideTexts) {
                const found = entries.find((e) => e.doc.kind === 'slide-draft' && e.doc.id === id);
                if (found) await this.kv.updateValue(categoryId, found.value.id, text);
                else await this.kv.createValue(categoryId, text);
            }
            const written = new Set(slideDocs.map((doc) => doc.id));
            for (const entry of entries) {
                if (entry.doc.kind === 'slide-draft' && entry.doc.playlistId === change.playlistId && !written.has(entry.doc.id)) {
                    await this.kv.deleteValue(categoryId, entry.value.id);
                }
            }
            if (existing) await this.kv.updateValue(categoryId, existing.value.id, playlistText);
            else await this.kv.createValue(categoryId, playlistText);
            return playlist;
        });
    }

    /** Deletes the draft of a playlist and all its slide drafts. Without the category there is nothing to do. */
    async discard(playlistId: string): Promise<void> {
        await this.guarded(async () => {
            const categoryId = await this.categoryId();
            if (categoryId === null) return;
            const { entries } = await this.readEntries(categoryId);
            for (const entry of entries) {
                const own =
                    entry.doc.kind === 'playlist-draft' ? entry.doc.id === playlistId : entry.doc.playlistId === playlistId;
                if (own) await this.kv.deleteValue(categoryId, entry.value.id);
            }
        });
    }

    /** Who last saved a draft, and when, per playlist with one. Empty without the category or the right to see it. */
    async list(): Promise<Map<string, { updatedBy: string; updatedAt: string }>> {
        const result = new Map<string, { updatedBy: string; updatedAt: string }>();
        try {
            const categoryId = await this.categoryId();
            if (categoryId === null) return result;
            for (const { doc } of (await this.readEntries(categoryId)).entries) {
                if (doc.kind === 'playlist-draft') result.set(doc.id, { updatedBy: doc.updatedBy, updatedAt: doc.updatedAt });
            }
        } catch (error) {
            if (!missingRight(error)) throw error;
            return new Map();
        }
        return result;
    }

    private async guarded<T>(run: () => Promise<T>): Promise<T> {
        try {
            return await run();
        } catch (error) {
            if (missingRight(error)) throw new DraftsUnavailableError();
            throw error;
        }
    }

    private async readEntries(categoryId: number): Promise<{ entries: Entry[]; issues: ReadIssue[] }> {
        const entries: Entry[] = [];
        const issues: ReadIssue[] = [];
        for (const value of await this.kv.listValues(categoryId)) {
            try {
                const read = readDraft(JSON.parse(value.value));
                const slide = read.doc.kind === 'slide-draft' ? read.doc.slide : undefined;
                entries.push({ value, doc: read.doc, slide, issues: read.issues });
            } catch (error) {
                if (error instanceof SchemaTooNewError) throw error;
                issues.push({
                    documentId: `drafts/${value.id}`,
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        }
        return { entries, issues };
    }
}
