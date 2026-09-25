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
    readPlaylistOrSchedule,
    readScreen,
    readSettings,
    readSlide,
    SchemaTooNewError,
    serialize,
    type ReadIssue,
} from '../model/read';
import {
    playlistIdsOf,
    SCHEMA_VERSION,
    scheduleIdFor,
    withSchedule,
    type AnyDoc,
    type MediaDoc,
    type PlaylistDoc,
    type ScheduleDoc,
    type ScreenBundle,
    type ScreenDoc,
    type SettingsDoc,
    type SlideDoc,
} from '../model/schema';
import type { KvBackend, KvCategory, KvValue } from './kv';

export const CATEGORIES = {
    screens: { name: 'Screens', description: 'Infoscreen: ein Index-Wert je Screen' },
    playlists: { name: 'Playlists', description: 'Infoscreen: Reihenfolge der Slides' },
    slides: { name: 'Slides', description: 'Infoscreen: eine Slide mit ihren Blöcken' },
    media: { name: 'Medien', description: 'Infoscreen: Verweise auf ChurchTools-Dateien' },
    settings: { name: 'Einstellungen', description: 'Infoscreen: modulweite Einstellungen' },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

/** The one settings document of a module. */
const SETTINGS_ID = 'settings';

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

/** What someone else saved in between – enough to ask which version should count. */
export interface ConflictInfo {
    name: string;
    revision: number;
    updatedBy?: string;
    updatedAt?: string;
}

export class ConflictError extends Error {
    constructor(readonly current: ConflictInfo) {
        super(
            `Der Screen wurde inzwischen geändert (Stand ${current.revision}` +
                (current.updatedBy ? `, von ${current.updatedBy}` : '') +
                ').',
        );
        this.name = 'ConflictError';
    }
}

export interface LoadedScreen extends ScreenBundle {
    /**
     * The designers' part (schema 1.2), already applied to `screen`; null
     * while nobody saved content since the update. Its revision is what the
     * editor saves against.
     */
    schedule: ScheduleDoc | null;
    /** Media referenced by the slides, for the player to resolve image blocks. */
    media: MediaDoc[];
    issues: ReadIssue[];
}

/** A screen as the start page shows it (Plan.md, Nächste Schritte 10). */
export interface ScreenOverview {
    screen: ScreenDoc;
    /** The first enabled slide of the default playlist; null for a screen without slides. */
    firstSlide: SlideDoc | null;
    slideCount: number;
    /** Media the first slide shows. */
    media: MediaDoc[];
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

    /**
     * The categories this person can see, without creating any. A missing one
     * either does not exist yet or is hidden by missing rights (G20).
     */
    async visibleCategories(): Promise<Partial<Record<CategoryKey, number>>> {
        const existing = await this.kv.listCategories();
        const result: Partial<Record<CategoryKey, number>> = {};
        for (const key of Object.keys(CATEGORIES) as CategoryKey[]) {
            const found = existing.find((c) => c.shorty === key);
            if (found) result[key] = found.id;
        }
        return result;
    }

    /** The screens as they run – with their schedules applied – sorted by name. */
    async listScreens(): Promise<ScreenDoc[]> {
        const { screens } = await this.readRunningScreens();
        return screens.map((s) => s.doc).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    }

    /**
     * Every screen with what the start page shows of it: the first slide the
     * TV would show and how many there are. Reads each category once, however
     * many screens there are – `loadScreen` per screen would read them all again.
     */
    async listScreenOverviews(): Promise<ScreenOverview[]> {
        const running = await this.readRunningScreens();
        const screens = running.screens.map((s) => s.doc).sort((a, b) => a.name.localeCompare(b.name, 'de'));
        if (!screens.length) return [];
        const playlists = new Map(running.playlists.map((p) => [p.doc.id, p.doc]));
        const slides = new Map((await this.readSlides()).docs.map((s) => [s.doc.id, s.doc]));

        const overviews = screens.map((screen) => {
            const own = (playlists.get(screen.defaultPlaylistId)?.slideIds ?? [])
                .map((id) => slides.get(id))
                .filter((s): s is SlideDoc => s !== undefined);
            const firstSlide = own.find((s) => s.enabled) ?? own[0] ?? null;
            return { screen, firstSlide, slideCount: own.length, media: [] as MediaDoc[] };
        });

        const mediaIds = new Set(overviews.flatMap((o) => (o.firstSlide ? referencedMedia(o.firstSlide) : [])));
        if (mediaIds.size) {
            const media = (await this.readAll('media', readMedia)).docs.map((m) => m.doc);
            for (const o of overviews) {
                const ids = o.firstSlide ? referencedMedia(o.firstSlide) : [];
                o.media = media.filter((m) => ids.includes(m.id));
            }
        }
        return overviews;
    }

    async loadScreen(slug: string): Promise<LoadedScreen> {
        const running = await this.readRunningScreens();
        const found = running.screens.find((s) => s.doc.slug === slug);
        if (!found) throw new ScreenNotFoundError(slug);
        const { doc: screen, schedule } = found;
        const issues = [...running.issues];

        const slidesRead = await this.readSlides();
        issues.push(...slidesRead.issues);

        const playlistIds = playlistIdsOf(screen, schedule);
        const byId = new Map(running.playlists.map((p) => [p.doc.id, p.doc]));
        const playlists = playlistIds.map((id) => byId.get(id)).filter((p): p is PlaylistDoc => !!p);
        for (const id of playlistIds) {
            if (!byId.has(id)) issues.push({ documentId: id, message: 'Playlist fehlt.' });
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

        return { screen, schedule, playlists, slides, media, issues };
    }

    /**
     * Creates a screen – or rewrites it whole – with its playlists and slides
     * and returns the stored index document with its new revision. Everything
     * is validated and size-checked before the first write. The index belongs
     * to the administrators (Plan.md, F): designers save through
     * {@link saveContent}.
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

    /**
     * The designers' save (Plan.md, F; Nächste Schritte 15): slides, playlists
     * and the schedule document – never the screen's index, which belongs to
     * the administrators. The schedule document is written last and carries
     * the revision, so a save that breaks off halfway changes nothing visible
     * and two designers saving the same screen notice each other.
     *
     * `expectedRevision` is the schedule document's revision the editor
     * started from; null when there was none yet.
     */
    async saveContent(bundle: ScreenBundle, options: SaveOptions): Promise<ScheduleDoc> {
        const now = (options.now ?? new Date()).toISOString();
        const stamp = <T extends AnyDoc>(doc: T): T => ({ ...doc, updatedAt: now });
        const slides = bundle.slides.map(stamp);
        const playlists = bundle.playlists.map(stamp);
        this.checkReferences(bundle.screen, playlists, slides);

        const running = await this.readRunningScreens();
        const current = running.screens.find((s) => s.doc.id === bundle.screen.id);
        if (!current) throw new ScreenNotFoundError(bundle.screen.slug);
        const existing = current.schedule;
        if (existing ? existing.revision !== options.expectedRevision : options.expectedRevision !== null) {
            throw new ConflictError({
                name: current.doc.name,
                revision: existing?.revision ?? 0,
                updatedBy: existing?.updatedBy,
                updatedAt: existing?.updatedAt,
            });
        }
        const schedule: ScheduleDoc = {
            schema: { ...SCHEMA_VERSION },
            kind: 'schedule',
            id: scheduleIdFor(bundle.screen.id),
            screenId: bundle.screen.id,
            defaultPlaylistId: bundle.screen.defaultPlaylistId,
            rules: bundle.screen.schedule,
            playlistIds: playlists.map((p) => p.id),
            revision: (existing?.revision ?? 0) + 1,
            updatedBy: options.updatedBy,
            updatedAt: now,
        };
        const serialized = {
            slides: slides.map((doc) => ({ doc, text: serialize(doc) })),
            playlists: playlists.map((doc) => ({ doc, text: serialize(doc) })),
            schedule: serialize(schedule),
        };

        const ids = await this.ensureCategories();
        const storedSlides = await this.valueIdsById('slides');
        for (const { doc, text } of serialized.slides) await this.upsert(ids.slides, storedSlides.get(doc.id), text);
        const storedPlaylists = await this.valueIdsById('playlists');
        for (const { doc, text } of serialized.playlists) {
            await this.upsert(ids.playlists, storedPlaylists.get(doc.id), text);
        }
        // Last: until this write succeeds, the old schedule and its revision stay authoritative.
        await this.upsert(ids.playlists, storedPlaylists.get(schedule.id), serialized.schedule);
        return schedule;
    }

    /**
     * The administrators' part of a screen (Plan.md, F): name and overscan,
     * written to the index only. Checked against the index revision, so two
     * administrators do not overwrite each other unnoticed.
     */
    async saveScreenSettings(
        screenId: string,
        patch: { name?: string; overscanPercent?: number },
        options: SaveOptions,
    ): Promise<ScreenDoc> {
        const ids = await this.ensureCategories();
        const { docs } = await this.readScreens();
        const existing = docs.find((s) => s.doc.id === screenId);
        if (!existing) throw new ScreenNotFoundError(screenId);
        if (existing.doc.revision !== options.expectedRevision) throw new ConflictError(existing.doc);
        const screen: ScreenDoc = {
            ...existing.doc,
            ...patch,
            revision: existing.doc.revision + 1,
            updatedBy: options.updatedBy,
            updatedAt: (options.now ?? new Date()).toISOString(),
        };
        await this.upsert(ids.screens, existing.valueId, serialize(screen));
        return screen;
    }

    async listMedia(): Promise<MediaDoc[]> {
        return (await this.readAll('media', readMedia)).docs.map((m) => m.doc);
    }

    /** The module settings; none yet is not an error, it is the state before the setup. */
    async loadSettings(): Promise<SettingsDoc | null> {
        const { docs } = await this.readAll('settings', readSettings);
        return docs.find((d) => d.doc.id === SETTINGS_ID)?.doc ?? null;
    }

    async saveSettings(doc: Omit<SettingsDoc, 'id' | 'kind'>): Promise<void> {
        const ids = await this.ensureCategories();
        const text = serialize({ ...doc, id: SETTINGS_ID, kind: 'settings' });
        const stored = await this.valueIdsById('settings');
        await this.upsert(ids.settings, stored.get(SETTINGS_ID), text);
    }

    /** Every calendar a screen shows or switches on – what a device must be able to read. */
    async calendarIdsInUse(): Promise<number[]> {
        const [{ screens }, slides] = await Promise.all([this.readRunningScreens(), this.readSlides()]);
        const ids = new Set<number>();
        for (const block of slides.docs.flatMap((s) => s.doc.blocks)) {
            if (block.type === 'appointment-list' || block.type === 'next-appointment') block.calendarIds.forEach((id) => ids.add(id));
        }
        for (const rule of screens.flatMap((s) => s.doc.schedule)) {
            if (rule.kind === 'appointment') rule.calendarIds.forEach((id) => ids.add(id));
        }
        return [...ids].sort((a, b) => a - b);
    }

    async saveMedia(doc: MediaDoc): Promise<void> {
        const ids = await this.ensureCategories();
        const text = serialize(doc);
        const stored = await this.valueIdsById('media');
        await this.upsert(ids.media, stored.get(doc.id), text);
    }

    async deleteMedia(id: string): Promise<void> {
        const ids = await this.ensureCategories();
        const valueId = (await this.valueIdsById('media')).get(id);
        if (valueId !== undefined) await this.kv.deleteValue(ids.media, valueId);
    }

    /** Where a medium is shown – asked before deleting it, so nobody deletes blind. */
    async mediaUsage(mediaId: string): Promise<{ screen: string; slide: string }[]> {
        const running = await this.readRunningScreens();
        const screens = running.screens;
        const playlists = running.playlists.map((p) => p.doc);
        const slides = (await this.readSlides()).docs.map((s) => s.doc);
        const usedIn = slides.filter((slide) => referencedMedia(slide).includes(mediaId));
        const result: { screen: string; slide: string }[] = [];
        for (const slide of usedIn) {
            const owners = screens.filter((screen) =>
                playlists.some(
                    (p) =>
                        p.slideIds.includes(slide.id) && playlistIdsOf(screen.doc, screen.schedule).includes(p.id),
                ),
            );
            for (const screen of owners) result.push({ screen: screen.doc.name, slide: slide.name });
        }
        return result;
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
        const running = await this.readRunningScreens();
        // An unreadable screen or schedule might reference anything.
        if (running.issues.length) return { playlists: 0, slides: 0 };
        const screens = running.screens;
        const playlists = { docs: running.playlists };
        const slides = await this.readSlides();

        const isOld = (doc: AnyDoc) => !doc.updatedAt || now.getTime() - Date.parse(doc.updatedAt) > ORPHAN_GRACE_MS;
        const usedPlaylists = new Set(screens.flatMap((s) => playlistIdsOf(s.doc, s.schedule)));
        const deadPlaylists = playlists.docs.filter((p) => !usedPlaylists.has(p.doc.id) && isOld(p.doc));
        const livePlaylists = playlists.docs.filter((p) => !deadPlaylists.includes(p));
        const usedSlides = new Set(livePlaylists.flatMap((p) => p.doc.slideIds));
        const deadSlides = slides.docs.filter((s) => !usedSlides.has(s.doc.id) && isOld(s.doc));

        // The schedule of a deleted screen goes with it; it counts as a playlist-category value.
        const screenIds = new Set(screens.map((s) => s.doc.id));
        const deadSchedules = running.schedules.filter((s) => !screenIds.has(s.doc.screenId) && isOld(s.doc));
        for (const s of deadSchedules) await this.kv.deleteValue(ids.playlists, s.valueId);
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

    private async valueIdsById(key: 'slides' | 'playlists' | 'media' | 'settings'): Promise<Map<string, number>> {
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

    /** The category `playlists`, split into playlists and schedule documents (schema 1.2). */
    private async readPlaylistCategory() {
        const read = await this.readAll('playlists', readPlaylistOrSchedule);
        const playlists: Stored<PlaylistDoc>[] = [];
        const schedules: Stored<ScheduleDoc>[] = [];
        for (const stored of read.docs) {
            if (stored.doc.kind === 'schedule') schedules.push(stored as Stored<ScheduleDoc>);
            else playlists.push(stored as Stored<PlaylistDoc>);
        }
        return { playlists, schedules, issues: read.issues };
    }

    /** The screens with their schedule documents applied – what devices show and designers edit. */
    private async readRunningScreens() {
        const [screens, category] = await Promise.all([this.readScreens(), this.readPlaylistCategory()]);
        const byScreen = new Map(category.schedules.map((s) => [s.doc.screenId, s.doc]));
        return {
            screens: screens.docs.map((s) => {
                const schedule = byScreen.get(s.doc.id) ?? null;
                return { valueId: s.valueId, doc: withSchedule(s.doc, schedule), schedule };
            }),
            playlists: category.playlists,
            schedules: category.schedules,
            issues: [...screens.issues, ...category.issues],
        };
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
    const ids = slide.blocks.flatMap((b) => {
        if (b.type === 'image' && b.mediaId) return [b.mediaId];
        if (b.type === 'church-header' && b.logoMediaId) return [b.logoMediaId];
        return [];
    });
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
