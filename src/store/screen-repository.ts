/**
 * Stores screens as several KV values (Plan.md, E):
 *
 * - `screens`   one index value per screen (slug, stage, revision) – the administrators'
 * - `playlists` one value per playlist, one schedule per screen and the theme – the designers'
 * - `slides`    one value per slide; slides are referenced, never owned
 *
 * Playlists stand on their own (schema 1.4): screens choose them through
 * their schedule, and one playlist may run on several screens.
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
    sameStage,
    SCHEMA_VERSION,
    scheduleIdFor,
    withPlaylistDefaults,
    withSchedule,
    type AnyDoc,
    type MediaDoc,
    type PlaylistBundle,
    type PlaylistDoc,
    type ScheduleDoc,
    type ScheduleRule,
    type ScreenBundle,
    type ScreenDoc,
    type SettingsDoc,
    type SlideDoc,
    THEME_ID,
    type ThemeDoc,
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

export class PlaylistNotFoundError extends Error {
    constructor(readonly id: string) {
        super('Diese Playlist gibt es nicht (mehr).');
        this.name = 'PlaylistNotFoundError';
    }
}

/** A playlist that still runs somewhere is not deleted – a screen would lose its content. */
export class PlaylistInUseError extends Error {
    constructor(readonly screens: string[]) {
        super(`Die Playlist läuft noch auf ${screens.map((s) => `„${s}"`).join(', ')}. Erst dort im Zeitplan eine andere wählen.`);
        this.name = 'PlaylistInUseError';
    }
}

/** A screen as the playlist pages name it. */
export interface ScreenRef {
    id: string;
    slug: string;
    name: string;
}

export type StagedPlaylist = PlaylistDoc & { stage: { width: number; height: number }; revision: number };

/** A place a medium is shown: a slide of a playlist, and the screens that run the playlist. */
export interface MediaUse {
    playlist: { id: string; name: string };
    slide: { id: string; name: string };
    /** Empty for a playlist no screen shows – the image is still in use there. */
    screens: ScreenRef[];
}

/** A playlist as the playlists page shows it (Plan.md, Nächste Schritte 19). */
export interface PlaylistOverview {
    playlist: StagedPlaylist;
    firstSlide: SlideDoc | null;
    slideCount: number;
    media: MediaDoc[];
    /** Screens whose schedule shows it, as default or through a rule. */
    screens: ScreenRef[];
}

export interface LoadedPlaylist extends PlaylistBundle {
    playlist: StagedPlaylist;
    media: MediaDoc[];
    screens: ScreenRef[];
    issues: ReadIssue[];
}

/** What the designers last saved, by revision – the player's quick check (Plan.md, Nächste Schritte 26). */
export interface ContentRevisions {
    /** Revision of the screen's schedule document; null while it has none. */
    schedule: number | null;
    /** Revision of every playlist, by id; 0 for playlists from before schema 1.4. */
    playlists: Record<string, number>;
    /** Revision of the theme (schema 1.9); null while there is none. Missing from older designers' data. */
    theme?: number | null;
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
    /** The look of all screens (schema 1.9); null while nobody set one – then the defaults apply. */
    theme?: ThemeDoc | null;
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
    /** Name of the default playlist, which the tile opens. */
    playlistName: string | null;
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
            const playlist = playlists.get(screen.defaultPlaylistId);
            const playlistName = playlist ? withPlaylistDefaults(playlist, screens).name : null;
            return { screen, firstSlide, slideCount: own.length, media: [] as MediaDoc[], playlistName };
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

        const playlistIds = playlistIdsOf(screen);
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

        return { screen, schedule, playlists, slides, media, theme: running.theme?.doc ?? null, issues };
    }

    /**
     * Creates a screen – or rewrites it whole – with its playlists and slides
     * and returns the stored index document with its new revision. Everything
     * is validated and size-checked before the first write. The index belongs
     * to the administrators (Plan.md, F): designers save through
     * {@link savePlaylist} and {@link saveSchedule}.
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
     * The player's quick check (Plan.md, Nächste Schritte 26): one read of
     * the category `playlists` – where every designer save leaves a new
     * revision – instead of screens, playlists, slides and media. Only when
     * something changed does the player load the whole screen.
     */
    async contentRevisions(screenId: string): Promise<ContentRevisions> {
        const { playlists, schedules, theme } = await this.readPlaylistCategory();
        return {
            schedule: schedules.find((s) => s.doc.screenId === screenId)?.doc.revision ?? null,
            playlists: Object.fromEntries(playlists.map((p) => [p.doc.id, p.doc.revision ?? 0])),
            theme: theme ? (theme.doc.revision ?? 0) : null,
        };
    }

    /** The look of all screens; null while nobody set one (Plan.md, Nächste Schritte 27). */
    async loadTheme(): Promise<ThemeDoc | null> {
        return (await this.readPlaylistCategory()).theme?.doc ?? null;
    }

    /**
     * The designers' save of the look (Plan.md, 27), against its revision like
     * a playlist: two designers changing it at once notice each other.
     * `expectedRevision` is null while there is none yet.
     */
    async saveTheme(theme: Omit<ThemeDoc, 'id' | 'kind' | 'schema'>, options: SaveOptions): Promise<ThemeDoc> {
        const { theme: stored } = await this.readPlaylistCategory();
        const current = stored ? (stored.doc.revision ?? 0) : null;
        if (current !== options.expectedRevision) {
            throw new ConflictError({
                name: 'Design',
                revision: current ?? 0,
                updatedBy: stored?.doc.updatedBy,
                updatedAt: stored?.doc.updatedAt,
            });
        }
        const doc: ThemeDoc = {
            ...theme,
            schema: { ...SCHEMA_VERSION },
            kind: 'theme',
            id: THEME_ID,
            revision: (current ?? 0) + 1,
            updatedBy: options.updatedBy,
            updatedAt: (options.now ?? new Date()).toISOString(),
        };
        const text = serialize(doc);
        const ids = await this.ensureCategories();
        await this.upsert(ids.playlists, stored?.valueId, text);
        return doc;
    }

    /** Every playlist with what the playlists page shows of it, sorted by name. */
    async listPlaylists(): Promise<PlaylistOverview[]> {
        const running = await this.readRunningScreens();
        const screens = running.screens.map((s) => s.doc);
        const slides = new Map((await this.readSlides()).docs.map((s) => [s.doc.id, s.doc]));
        const overviews = running.playlists.map(({ doc }) => {
            const own = doc.slideIds.map((id) => slides.get(id)).filter((s): s is SlideDoc => s !== undefined);
            return {
                playlist: withPlaylistDefaults(doc, screens),
                firstSlide: own.find((s) => s.enabled) ?? own[0] ?? null,
                slideCount: own.length,
                media: [] as MediaDoc[],
                screens: screensShowing(doc.id, screens),
            };
        });
        const mediaIds = new Set(overviews.flatMap((o) => (o.firstSlide ? referencedMedia(o.firstSlide) : [])));
        if (mediaIds.size) {
            const media = (await this.readAll('media', readMedia)).docs.map((m) => m.doc);
            for (const o of overviews) {
                const ids = o.firstSlide ? referencedMedia(o.firstSlide) : [];
                o.media = media.filter((m) => ids.includes(m.id));
            }
        }
        return overviews.sort((a, b) => a.playlist.name.localeCompare(b.playlist.name, 'de'));
    }

    /** One playlist with its slides and media – what the editor opens. */
    async loadPlaylist(id: string): Promise<LoadedPlaylist> {
        const running = await this.readRunningScreens();
        const stored = running.playlists.find((p) => p.doc.id === id);
        if (!stored) throw new PlaylistNotFoundError(id);
        const screens = running.screens.map((s) => s.doc);
        const issues = [...running.issues];

        const slidesRead = await this.readSlides();
        issues.push(...slidesRead.issues);
        const byId = new Map(slidesRead.docs.map((s) => [s.doc.id, s.doc]));
        const slides = stored.doc.slideIds.map((sid) => byId.get(sid)).filter((s): s is SlideDoc => !!s);
        for (const sid of stored.doc.slideIds) {
            if (!byId.has(sid)) issues.push({ documentId: sid, message: 'Slide fehlt.' });
        }

        const mediaIds = new Set(slides.flatMap(referencedMedia));
        const mediaRead = mediaIds.size ? await this.readAll('media', readMedia) : { docs: [], issues: [] };
        const media = mediaRead.docs.map((m) => m.doc).filter((m) => mediaIds.has(m.id));
        return {
            playlist: withPlaylistDefaults(stored.doc, screens),
            slides,
            media,
            screens: screensShowing(id, screens),
            issues: [...issues, ...mediaRead.issues],
        };
    }

    /** A new playlist with one empty slide – an empty playlist would show nothing. */
    async createPlaylist(
        options: { name: string; stage: { width: number; height: number } },
        updatedBy: string,
        now = new Date(),
    ): Promise<StagedPlaylist> {
        const slide: SlideDoc = {
            schema: { ...SCHEMA_VERSION },
            kind: 'slide',
            id: crypto.randomUUID(),
            name: 'Neue Slide',
            durationSeconds: 10,
            enabled: true,
            // In the theme's colour (Plan.md, 27), like every slide added in the editor.
            background: { kind: 'solid', color: (await this.loadTheme().catch(() => null))?.background ?? '#1e293b' },
            blocks: [],
            updatedAt: now.toISOString(),
        };
        const playlist: StagedPlaylist = {
            schema: { ...SCHEMA_VERSION },
            kind: 'playlist',
            id: crypto.randomUUID(),
            name: options.name.trim() || 'Neue Playlist',
            slideIds: [slide.id],
            stage: { ...options.stage },
            revision: 1,
            updatedBy,
            updatedAt: now.toISOString(),
        };
        const texts = { slide: serialize(slide), playlist: serialize(playlist) };
        const ids = await this.ensureCategories();
        await this.kv.createValue(ids.slides, texts.slide);
        await this.kv.createValue(ids.playlists, texts.playlist);
        return playlist;
    }

    /**
     * The designers' save (Plan.md, F): one playlist and its slides. Slides
     * first, the playlist last and with the revision – a save that breaks off
     * halfway leaves the old order visible, and two designers saving the same
     * playlist notice each other. Screens and schedules stay untouched.
     */
    async savePlaylist(bundle: PlaylistBundle, options: SaveOptions): Promise<StagedPlaylist> {
        const now = (options.now ?? new Date()).toISOString();
        const slideIds = new Set(bundle.slides.map((s) => s.id));
        const missing = bundle.playlist.slideIds.find((id) => !slideIds.has(id));
        if (missing) throw new Error(`Slide ${missing} fehlt im Speicherstand.`);

        const running = await this.readRunningScreens();
        const stored = running.playlists.find((p) => p.doc.id === bundle.playlist.id);
        if (!stored) throw new PlaylistNotFoundError(bundle.playlist.id);
        const current = stored.doc.revision ?? 0;
        if (current !== (options.expectedRevision ?? 0)) {
            throw new ConflictError({
                name: withPlaylistDefaults(stored.doc, running.screens.map((s) => s.doc)).name,
                revision: current,
                updatedBy: stored.doc.updatedBy,
                updatedAt: stored.doc.updatedAt,
            });
        }
        const playlist: StagedPlaylist = {
            ...bundle.playlist,
            revision: current + 1,
            updatedBy: options.updatedBy,
            updatedAt: now,
        };
        const slides = bundle.slides.map((doc) => serialize({ ...doc, updatedAt: now }));
        const text = serialize(playlist);

        const ids = await this.ensureCategories();
        const storedSlides = await this.valueIdsById('slides');
        for (const [i, doc] of bundle.slides.entries()) await this.upsert(ids.slides, storedSlides.get(doc.id), slides[i]!);
        await this.kv.updateValue(ids.playlists, stored.valueId, text);
        return playlist;
    }

    /** Deletes a playlist no screen shows; its slides go with the next tidy-up unless another playlist shows them. */
    async deletePlaylist(id: string): Promise<void> {
        const running = await this.readRunningScreens();
        const stored = running.playlists.find((p) => p.doc.id === id);
        if (!stored) return;
        const users = screensShowing(id, running.screens.map((s) => s.doc));
        if (users.length) throw new PlaylistInUseError(users.map((s) => s.name));
        const ids = await this.ensureCategories();
        await this.kv.deleteValue(ids.playlists, stored.valueId);
    }

    /**
     * The designers' choice of what runs on a screen when (Plan.md, F;
     * Nächste Schritte 17): only the schedule document, against its own
     * revision. `expectedRevision` is null while the screen has none yet.
     */
    async saveSchedule(
        screenId: string,
        choice: { defaultPlaylistId: string; rules: ScheduleRule[] },
        options: SaveOptions,
    ): Promise<ScheduleDoc> {
        const running = await this.readRunningScreens();
        const current = running.screens.find((s) => s.doc.id === screenId);
        if (!current) throw new ScreenNotFoundError(screenId);
        const existing = current.schedule;
        if (existing ? existing.revision !== options.expectedRevision : options.expectedRevision !== null) {
            throw new ConflictError({
                name: current.doc.name,
                revision: existing?.revision ?? 0,
                updatedBy: existing?.updatedBy,
                updatedAt: existing?.updatedAt,
            });
        }
        const playlists = new Map(running.playlists.map((p) => [p.doc.id, p.doc]));
        const screens = running.screens.map((s) => s.doc);
        for (const id of [choice.defaultPlaylistId, ...choice.rules.map((r) => r.playlistId)]) {
            const playlist = playlists.get(id);
            if (!playlist) throw new PlaylistNotFoundError(id);
            const staged = withPlaylistDefaults(playlist, screens);
            if (!sameStage(staged.stage, current.doc.stage)) {
                throw new Error(`„${staged.name}" ist für ein anderes Format gestaltet als „${current.doc.name}".`);
            }
        }
        const schedule: ScheduleDoc = {
            schema: { ...SCHEMA_VERSION },
            kind: 'schedule',
            id: scheduleIdFor(screenId),
            screenId,
            defaultPlaylistId: choice.defaultPlaylistId,
            rules: choice.rules,
            revision: (existing?.revision ?? 0) + 1,
            updatedBy: options.updatedBy,
            updatedAt: (options.now ?? new Date()).toISOString(),
        };
        const text = serialize(schedule);
        const ids = await this.ensureCategories();
        const stored = running.schedules.find((s) => s.doc.screenId === screenId);
        await this.upsert(ids.playlists, stored?.valueId, text);
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

    /**
     * Where every medium is shown, by media id (Plan.md, Nächste Schritte 18):
     * one pass over screens, playlists and slides for the whole library, not
     * one per image. Derived, never stored – so it cannot go stale.
     */
    async mediaUses(): Promise<Map<string, MediaUse[]>> {
        const running = await this.readRunningScreens();
        const screens = running.screens.map((s) => s.doc);
        const slides = new Map((await this.readSlides()).docs.map((s) => [s.doc.id, s.doc]));
        const uses = new Map<string, MediaUse[]>();
        for (const { doc } of running.playlists) {
            const playlist = { id: doc.id, name: withPlaylistDefaults(doc, screens).name };
            const showing = screensShowing(doc.id, screens);
            for (const slide of doc.slideIds.map((id) => slides.get(id))) {
                if (!slide) continue;
                for (const mediaId of new Set(referencedMedia(slide))) {
                    const use = { playlist, slide: { id: slide.id, name: slide.name }, screens: showing };
                    uses.set(mediaId, [...(uses.get(mediaId) ?? []), use]);
                }
            }
        }
        return uses;
    }

    /** Where a medium is shown – asked before deleting it, so nobody deletes blind. */
    async mediaUsage(mediaId: string): Promise<{ playlist: string; slide: string }[]> {
        return ((await this.mediaUses()).get(mediaId) ?? []).map((u) => ({ playlist: u.playlist.name, slide: u.slide.name }));
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
     * Deletes slides no playlist references and the schedules of deleted
     * screens. Playlists stay even when no screen shows them (schema 1.4):
     * they are content in their own right and go only when deleted.
     * Orphans younger than the grace period are kept: they may have been
     * written by a save whose last write has not happened yet.
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
        const usedSlides = new Set(playlists.docs.flatMap((p) => p.doc.slideIds));
        const deadSlides = slides.docs.filter((s) => !usedSlides.has(s.doc.id) && isOld(s.doc));

        // The schedule of a deleted screen goes with it; it counts as a playlist-category value.
        const screenIds = new Set(screens.map((s) => s.doc.id));
        const deadSchedules = running.schedules.filter((s) => !screenIds.has(s.doc.screenId) && isOld(s.doc));
        for (const s of deadSchedules) await this.kv.deleteValue(ids.playlists, s.valueId);
        for (const s of deadSlides) await this.kv.deleteValue(ids.slides, s.valueId);
        return { playlists: 0, slides: deadSlides.length };
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

    /** The category `playlists`, split into playlists, schedule documents (schema 1.2) and the theme (1.9). */
    private async readPlaylistCategory() {
        const read = await this.readAll('playlists', readPlaylistOrSchedule);
        const playlists: Stored<PlaylistDoc>[] = [];
        const schedules: Stored<ScheduleDoc>[] = [];
        let theme: Stored<ThemeDoc> | null = null;
        for (const stored of read.docs) {
            if (stored.doc.kind === 'schedule') schedules.push(stored as Stored<ScheduleDoc>);
            else if (stored.doc.kind === 'theme') theme = stored as Stored<ThemeDoc>;
            else playlists.push(stored as Stored<PlaylistDoc>);
        }
        return { playlists, schedules, theme, issues: read.issues };
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
            theme: category.theme,
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

function screensShowing(playlistId: string, screens: readonly ScreenDoc[]): ScreenRef[] {
    return screens
        .filter((s) => playlistIdsOf(s).includes(playlistId))
        .map((s) => ({ id: s.id, slug: s.slug, name: s.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
