/**
 * Stores screens as several KV values (Plan.md, E):
 *
 * - `screens`   one index value per screen (slug, stage, revision) – the administrators'
 * - `playlists` one value per playlist, one schedule per screen, the theme and the templates (1.41) – the designers'
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
import { needsAppointmentRooms } from '../appointments/rooms';
import { appointmentServiceIds } from '../appointments/services';
import { httpStatus } from '../ct/client';
import { heartbeatTime, readHeartbeat, type HeartbeatDoc } from '../model/heartbeat';
import {
    readMedia,
    withOwnAddresses,
    readPlaylistOrSchedule,
    readScreen,
    readSettings,
    readSlide,
    SchemaTooNewError,
    serialize,
    type ReadIssue,
    type ReadResult,
} from '../model/read';
import { expandTemplates, templateIdsOf } from '../model/templates';
import {
    blockCalendarIds,
    CUSTOM_FONT_PREFIX,
    playlistIdsOf,
    sameStage,
    SCHEMA_VERSION,
    scheduleIdFor,
    stampBanner,
    withPlaylistDefaults,
    withSchedule,
    type AnyDoc,
    type Banner,
    type MediaDoc,
    type PlaylistBundle,
    type PlaylistDoc,
    type ScheduleDoc,
    type ScheduleRule,
    type ScreenBundle,
    type ScreenDoc,
    type SettingsDoc,
    type SlideDoc,
    type TemplateDoc,
    THEME_ID,
    type ThemeDoc,
} from '../model/schema';
import type { KvBackend, KvCategory, KvValue } from './kv';
import { LOCALE, tp } from '../i18n/player';
import { tr } from '../i18n/repository';
import { ChangelogStore, type ChangeEntry } from './changelog';
import { DraftStore } from './drafts';

export const CATEGORIES = {
    screens: { name: 'Screens', description: 'Infoscreen: ein Index-Wert je Screen' },
    playlists: { name: 'Playlists', description: 'Infoscreen: Reihenfolge der Slides' },
    slides: { name: 'Slides', description: 'Infoscreen: eine Slide mit ihren Blöcken' },
    media: { name: 'Medien', description: 'Infoscreen: Verweise auf ChurchTools-Dateien' },
    settings: { name: 'Einstellungen', description: 'Infoscreen: modulweite Einstellungen' },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

/**
 * The signs of life of the screens (Plan.md 59). Not in {@link CATEGORIES} on purpose: those are created
 * by whoever opens the designer or player first, and a device without the right to create categories
 * would get a `403` and stand still. This one is found by its shorty and created only by an administrator.
 */
export const STATUS_CATEGORY = {
    shorty: 'status',
    name: 'Status',
    description: 'Infoscreen: ein Lebenszeichen je Screen',
} as const;

/** The one settings document of a module. */
const SETTINGS_ID = 'settings';

/** Orphans younger than this may belong to a save in progress and are kept. */
export const ORPHAN_GRACE_MS = 60 * 60 * 1000;

export class ScreenNotFoundError extends Error {
    constructor(readonly slug: string) {
        super(tp.screenNotFound(slug));
        this.name = 'ScreenNotFoundError';
    }
}

export class SlugTakenError extends Error {
    constructor(readonly slug: string) {
        super(tr.slugTaken(slug));
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
        super(tr.conflict(current.revision, current.updatedBy));
        this.name = 'ConflictError';
    }
}

/** A shared slide someone else saved in between – from which playlist, by whom, when. */
export interface SlideConflictInfo {
    /** The name of the stored version. */
    slide: { id: string; name: string };
    /** The other playlist that saved it, when that can be told; null otherwise. */
    playlist: string | null;
    updatedBy?: string;
    updatedAt?: string;
}

/** Not a {@link ConflictError}: it is about one slide that several playlists show, not the playlist itself. */
export class SlideConflictError extends Error {
    constructor(readonly current: SlideConflictInfo) {
        super(tr.slideConflict(current.slide.name, current.playlist, current.updatedBy));
        this.name = 'SlideConflictError';
    }
}

export class PlaylistNotFoundError extends Error {
    constructor(readonly id: string) {
        super(tr.playlistNotFound);
        this.name = 'PlaylistNotFoundError';
    }
}

/** A playlist that still runs somewhere is not deleted – a screen would lose its content. */
export class PlaylistInUseError extends Error {
    constructor(readonly screens: string[]) {
        super(tr.playlistInUse(screens));
        this.name = 'PlaylistInUseError';
    }
}

/** A template that still sits on a slide is not deleted – the slide would lose its blocks. */
export class TemplateInUseError extends Error {
    constructor(readonly playlistNames: string[]) {
        super(tr.templateInUse(playlistNames));
        this.name = 'TemplateInUseError';
    }
}

/** A place a template is used: the slides of a playlist, published or as drafts. */
export interface TemplateUse {
    playlist: { id: string; name: string };
    slideIds: string[];
    draft: boolean;
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

/** A place a custom font is used (Plan.md 103): the blocks of one slide, or the banner of the playlist (`slide` null). */
export interface FontUse {
    playlist: { id: string; name: string };
    slide: { id: string; name: string } | null;
    /** How many blocks of the slide use it; 1 for the banner. */
    blocks: number;
}

/** A playlist as the playlists page shows it (Plan.md, Nächste Schritte 19). */
export interface PlaylistOverview {
    playlist: StagedPlaylist;
    firstSlide: SlideDoc | null;
    slideCount: number;
    media: MediaDoc[];
    /** Screens whose schedule shows it, as default or through a rule. */
    screens: ScreenRef[];
    /**
     * The last save that changed what it shows: its own or, later, that of one
     * of its slides through another playlist (Plan.md 49). Null before any.
     */
    editedAt: string | null;
    /** Who saved then – for a linked slide saved elsewhere since, who saved it there; null for documents without a name. */
    editedBy: string | null;
}

export interface LoadedPlaylist extends PlaylistBundle {
    playlist: StagedPlaylist;
    media: MediaDoc[];
    screens: ScreenRef[];
    /** By slide id of this playlist: the other playlists that show it too; only slides with at least one. */
    sharedWith: Record<string, { id: string; name: string }[]>;
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
    /** Revision of every template of the category (schema 1.41), by id. Missing from older designers' data. */
    templates?: Record<string, number>;
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
    /**
     * The templates the slides use (schema 1.41, Plan.md 87) – the slides are already expanded, this is for the
     * player's quick check. An offline copy of an older player lacks it.
     */
    templates?: TemplateDoc[];
    /**
     * The services an administrator allows on screens (schema 1.20, Plan.md 58); empty without settings.
     * An offline copy of an older player lacks it – read it with `?? []`.
     */
    allowedServiceIds: number[];
    /** The resource types that count as rooms (schema 1.35, Plan.md 86); missing = the type "Raum". */
    roomTypeIds?: number[];
    /** The non-public calendars an administrator released for screens (schema 1.40, Plan.md 85 b); missing = none. */
    screenCalendarIds?: number[];
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
    /** Name of the default playlist. */
    playlistName: string | null;
    /**
     * Every playlist the screen may show – the default and those of its rules
     * – by id, so the tile can show the one that runs now (Plan.md 17).
     */
    playlists: Record<string, ScreenPlaylist>;
}

/** A playlist of a screen, as its tile shows it. */
export interface ScreenPlaylist {
    id: string;
    name: string;
    /** The first enabled slide; null for a playlist without slides. */
    firstSlide: SlideDoc | null;
    slideCount: number;
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
    /** {@link ScreenRepository.savePlaylist} only: the slides to write; without it all of them are. */
    changedSlideIds?: readonly string[];
}

export class ScreenRepository {
    private categoryIds: Promise<Record<CategoryKey, number>> | null = null;
    /** The `status` category, once found; a missing one is looked for again – it may appear later. */
    private statusId: number | null = null;
    /** Value ids of the signs of life by slug, to spare the read. */
    private readonly heartbeatValueIds = new Map<string, number>();
    /** The drafts of playlists and slides (Plan.md 79, Paket E). */
    readonly drafts: DraftStore;
    /** The changelog (Plan.md 100): written after a save has succeeded, never part of it. */
    readonly changelog: ChangelogStore;
    /** Who is working, for the changelog: the name as in `updatedBy`, and the person. Set where the repository is made. */
    actor: (() => Promise<{ by: string; personId?: number } | null>) | null = null;
    private readonly logging = new Set<Promise<void>>();

    /**
     * `mediaOrigins`: the origins media addresses may point to – the instance's own (`withOwnAddresses`).
     * Without them every address passes: development and tests, where the instance sits behind a proxy.
     */
    constructor(
        private readonly kv: KvBackend,
        private readonly mediaOrigins: readonly string[] = [],
    ) {
        this.drafts = new DraftStore(kv);
        this.changelog = new ChangelogStore(kv);
    }

    /**
     * Writes a line of the changelog without making the caller wait; a failure here never reaches the save it
     * follows. `by` overrides the name of the actor, as the caller knows it from `updatedBy`.
     */
    private log(entry: Omit<ChangeEntry, 'by' | 'personId'> & { by?: string }): void {
        const task = (async () => {
            try {
                const actor = await this.actor?.();
                await this.changelog.record({
                    ...entry,
                    by: entry.by || actor?.by || '',
                    ...(actor?.personId === undefined ? {} : { personId: actor.personId }),
                });
            } catch (error) {
                console.warn('Die Änderung konnte nicht protokolliert werden:', error);
            }
        })();
        this.logging.add(task);
        void task.finally(() => this.logging.delete(task));
    }

    /** Resolves when every changelog line started so far is written or has failed. For tests. */
    async changelogSettled(): Promise<void> {
        while (this.logging.size) await Promise.all([...this.logging]);
    }

    private readonly readOwnMedia = (raw: unknown): MediaDoc => {
        const doc = readMedia(raw);
        return this.mediaOrigins.length ? withOwnAddresses(doc, this.mediaOrigins) : doc;
    };

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

    /** The id of the `status` category, or null while this person cannot see one. Creates nothing. */
    async statusCategoryId(): Promise<number | null> {
        if (this.statusId !== null) return this.statusId;
        const found = (await this.kv.listCategories()).find((c) => c.shorty === STATUS_CATEGORY.shorty);
        this.statusId = found?.id ?? null;
        return this.statusId;
    }

    /**
     * Like {@link statusCategoryId}, but creates the category when it is missing. Meant for an administrator;
     * without the right to create categories it gives null instead of failing.
     */
    async ensureStatusCategory(): Promise<number | null> {
        try {
            const existing = await this.statusCategoryId();
            if (existing !== null) return existing;
            this.statusId = (await this.kv.createCategory({ ...STATUS_CATEGORY })).id;
            return this.statusId;
        } catch (error) {
            console.warn('Die Kategorie „Status" konnte nicht angelegt werden:', error);
            return null;
        }
    }

    /**
     * Writes the sign of life of a screen: changes its value, or creates it when there is none yet.
     * Does nothing without the category. Errors are the caller's – the player swallows them.
     */
    async writeHeartbeat(doc: HeartbeatDoc): Promise<void> {
        const categoryId = await this.statusCategoryId();
        if (categoryId === null) return;
        const text = JSON.stringify(doc);
        const known = this.heartbeatValueIds.get(doc.screen);
        if (known !== undefined) {
            try {
                await this.kv.updateValue(categoryId, known, text);
                return;
            } catch (error) {
                // How ChurchTools answers for a deleted value is unmeasured beyond 404: look it up afresh next time.
                this.heartbeatValueIds.delete(doc.screen);
                if (httpStatus(error) !== 404) throw error;
            }
        }
        const current = (await this.readHeartbeats(categoryId)).get(doc.screen);
        if (current) {
            this.heartbeatValueIds.set(doc.screen, current.valueId);
            await this.kv.updateValue(categoryId, current.valueId, text);
            return;
        }
        this.heartbeatValueIds.set(doc.screen, (await this.kv.createValue(categoryId, text)).id);
    }

    /**
     * The latest sign of life per screen slug; null when this person cannot see the category –
     * the start page then shows nothing instead of a wrong "never".
     */
    async listHeartbeats(): Promise<Map<string, HeartbeatDoc> | null> {
        const categoryId = await this.statusCategoryId();
        if (categoryId === null) return null;
        const latest = await this.readHeartbeats(categoryId);
        return new Map([...latest].map(([slug, { doc }]) => [slug, doc]));
    }

    /** By slug, the value with the latest `at`; values that are not signs of life are skipped. */
    private async readHeartbeats(categoryId: number): Promise<Map<string, { valueId: number; doc: HeartbeatDoc }>> {
        const latest = new Map<string, { valueId: number; doc: HeartbeatDoc }>();
        for (const value of await this.kv.listValues(categoryId)) {
            let doc: HeartbeatDoc | null;
            try {
                doc = readHeartbeat(JSON.parse(value.value));
            } catch {
                continue;
            }
            if (!doc) continue;
            const before = latest.get(doc.screen);
            // An unreadable time loses against any readable one.
            const newer = !before || (heartbeatTime(doc) || -Infinity) > (heartbeatTime(before.doc) || -Infinity);
            if (newer) latest.set(doc.screen, { valueId: value.id, doc });
        }
        return latest;
    }

    /** The screens as they run – with their schedules applied – sorted by name. */
    async listScreens(): Promise<ScreenDoc[]> {
        const { screens } = await this.readRunningScreens();
        return screens.map((s) => s.doc).sort((a, b) => a.name.localeCompare(b.name, LOCALE));
    }

    /**
     * Every screen with what the start page shows of it: the first slide the
     * TV would show and how many there are. Reads each category once, however
     * many screens there are – `loadScreen` per screen would read them all again.
     */
    async listScreenOverviews(): Promise<ScreenOverview[]> {
        const running = await this.readRunningScreens();
        const screens = running.screens.map((s) => s.doc).sort((a, b) => a.name.localeCompare(b.name, LOCALE));
        if (!screens.length) return [];
        const playlists = new Map(running.playlists.map((p) => [p.doc.id, p.doc]));
        const slides = new Map((await this.readSlides()).docs.map((s) => [s.doc.id, s.doc]));

        const overviews = screens.map((screen) => {
            const own: Record<string, ScreenPlaylist> = {};
            for (const id of playlistIdsOf(screen)) {
                const playlist = playlists.get(id);
                if (!playlist) continue;
                const shown = playlist.slideIds.map((s) => slides.get(s)).filter((s): s is SlideDoc => s !== undefined);
                own[id] = {
                    id,
                    name: withPlaylistDefaults(playlist, screens).name,
                    firstSlide: shown.find((s) => s.enabled) ?? shown[0] ?? null,
                    slideCount: shown.length,
                };
            }
            const standard = own[screen.defaultPlaylistId];
            return {
                screen,
                firstSlide: standard?.firstSlide ?? null,
                slideCount: standard?.slideCount ?? 0,
                media: [] as MediaDoc[],
                playlistName: standard?.name ?? null,
                playlists: own,
            };
        });

        const shownSlides = (o: ScreenOverview) => Object.values(o.playlists).flatMap((p) => (p.firstSlide ? [p.firstSlide] : []));
        const mediaIds = new Set(overviews.flatMap((o) => shownSlides(o).flatMap(referencedMedia)));
        if (mediaIds.size) {
            const media = (await this.readAll('media', this.readOwnMedia)).docs.map((m) => m.doc);
            for (const o of overviews) {
                const ids = new Set(shownSlides(o).flatMap(referencedMedia));
                o.media = media.filter((m) => ids.has(m.id));
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
            if (!byId.has(id)) issues.push({ documentId: id, message: tr.playlistMissing });
        }

        const slideIds = new Set(playlists.flatMap((p) => p.slideIds));
        const shown = slidesRead.docs.map((s) => s.doc).filter((s) => slideIds.has(s.id));
        for (const id of slideIds) {
            if (!shown.some((s) => s.id === id)) issues.push({ documentId: id, message: tr.slideMissing });
        }

        // Expanded before the media are collected, so that the pictures of a template come along (Plan.md 87).
        const templateById = new Map(running.templates.map((t) => [t.doc.id, t.doc]));
        const usedTemplateIds = new Set(shown.flatMap(templateIdsOf));
        for (const id of usedTemplateIds) {
            if (!templateById.has(id)) issues.push({ documentId: id, message: tr.templateMissing });
        }
        const slides = shown.map((s) => expandTemplates(s, templateById));
        const templates = [...usedTemplateIds].map((id) => templateById.get(id)).filter((t): t is TemplateDoc => !!t);

        const mediaIds = new Set(slides.flatMap(referencedMedia));
        const mediaRead = mediaIds.size ? await this.readAll('media', this.readOwnMedia) : { docs: [], issues: [] };
        issues.push(...mediaRead.issues);
        const media = mediaRead.docs.map((m) => m.doc).filter((m) => mediaIds.has(m.id));
        for (const id of mediaIds) {
            if (!media.some((m) => m.id === id)) issues.push({ documentId: id, message: tr.mediaMissing });
        }

        // Settings that cannot be read allow no service: the strict side. The rooms then follow the type "Raum".
        const settings = await this.loadSettings().catch(() => null);
        const allowedServiceIds = settings?.allowedServiceIds ?? [];
        const roomTypeIds = settings?.roomTypeIds;
        return { screen, schedule, playlists, slides, media, theme: running.theme?.doc ?? null, templates, allowedServiceIds, roomTypeIds, screenCalendarIds: settings?.screenCalendarIds, issues };
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
        this.log({
            area: 'screen',
            targetId: screen.id,
            targetName: screen.name,
            action: existing ? 'saved' : 'created',
            by: options.updatedBy,
            now: options.now,
        });
        return screen;
    }

    /**
     * The player's quick check (Plan.md, Nächste Schritte 26): one read of
     * the category `playlists` – where every designer save leaves a new
     * revision – instead of screens, playlists, slides and media. Only when
     * something changed does the player load the whole screen.
     */
    async contentRevisions(screenId: string): Promise<ContentRevisions> {
        const { playlists, schedules, theme, templates } = await this.readPlaylistCategory();
        return {
            schedule: schedules.find((s) => s.doc.screenId === screenId)?.doc.revision ?? null,
            playlists: Object.fromEntries(playlists.map((p) => [p.doc.id, p.doc.revision ?? 0])),
            theme: theme ? (theme.doc.revision ?? 0) : null,
            templates: Object.fromEntries(templates.map((t) => [t.doc.id, t.doc.revision])),
        };
    }

    /** Every template (schema 1.41, Plan.md 87), sorted by name. */
    async listTemplates(): Promise<TemplateDoc[]> {
        const { templates } = await this.readPlaylistCategory();
        return templates.map((t) => t.doc).sort((a, b) => a.name.localeCompare(b.name, LOCALE));
    }

    /**
     * The designers' save of a template, against its revision like the theme: `expectedRevision` is null while
     * it is new.
     */
    async saveTemplate(
        template: Omit<TemplateDoc, 'schema' | 'kind' | 'revision' | 'updatedBy' | 'updatedAt'>,
        options: SaveOptions,
    ): Promise<TemplateDoc> {
        const { templates } = await this.readPlaylistCategory();
        const stored = templates.find((t) => t.doc.id === template.id);
        const current = stored ? stored.doc.revision : null;
        if (current !== options.expectedRevision) {
            throw new ConflictError({
                name: stored?.doc.name ?? template.name,
                revision: current ?? 0,
                updatedBy: stored?.doc.updatedBy,
                updatedAt: stored?.doc.updatedAt,
            });
        }
        const doc: TemplateDoc = {
            ...template,
            schema: { ...SCHEMA_VERSION },
            kind: 'template',
            revision: (current ?? 0) + 1,
            updatedBy: options.updatedBy,
            updatedAt: (options.now ?? new Date()).toISOString(),
        };
        const text = serialize(doc);
        const ids = await this.ensureCategories();
        await this.upsert(ids.playlists, stored?.valueId, text);
        this.log({
            area: 'template',
            targetId: doc.id,
            targetName: doc.name,
            action: stored ? 'saved' : 'created',
            by: options.updatedBy,
            now: options.now,
        });
        return doc;
    }

    /**
     * Where every template is used, by template id (Plan.md 87): the published playlists with their slides and the
     * slide drafts. Derived, never stored – one pass like {@link mediaUses}.
     */
    async templateUses(): Promise<Map<string, TemplateUse[]>> {
        const running = await this.readRunningScreens();
        const screens = running.screens.map((s) => s.doc);
        const slides = new Map((await this.readSlides()).docs.map((s) => [s.doc.id, s.doc]));
        const names = new Map(running.playlists.map(({ doc }) => [doc.id, withPlaylistDefaults(doc, screens).name]));
        const uses = new Map<string, TemplateUse[]>();
        const add = (templateId: string, playlist: { id: string; name: string }, slideId: string, draft: boolean) => {
            const list = uses.get(templateId) ?? [];
            const found = list.find((u) => u.playlist.id === playlist.id && u.draft === draft);
            if (found) found.slideIds.push(slideId);
            else list.push({ playlist, slideIds: [slideId], draft });
            uses.set(templateId, list);
        };
        for (const { doc } of running.playlists) {
            const playlist = { id: doc.id, name: names.get(doc.id)! };
            for (const slide of doc.slideIds.map((id) => slides.get(id))) {
                if (slide) templateIdsOf(slide).forEach((id) => add(id, playlist, slide.id, false));
            }
        }
        for (const { playlistId, slide } of await this.drafts.listSlides()) {
            const playlist = { id: playlistId, name: names.get(playlistId) ?? tr.newPlaylist };
            templateIdsOf(slide).forEach((id) => add(id, playlist, slide.id, true));
        }
        return uses;
    }

    /** Deletes a template nobody uses – no slide, no draft; otherwise {@link TemplateInUseError} names the playlists. */
    async deleteTemplate(id: string): Promise<void> {
        const used = (await this.templateUses()).get(id) ?? [];
        if (used.length) {
            const names = used.map((u) => (u.draft ? tr.draftSuffix(u.playlist.name) : u.playlist.name));
            throw new TemplateInUseError([...new Set(names)].sort((a, b) => a.localeCompare(b, LOCALE)));
        }
        const ids = await this.ensureCategories();
        const stored = (await this.readPlaylistCategory()).templates.find((t) => t.doc.id === id);
        if (stored) {
            await this.kv.deleteValue(ids.playlists, stored.valueId);
            this.log({ area: 'template', targetId: id, targetName: stored.doc.name, action: 'deleted' });
        }
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
        this.log({ area: 'theme', targetId: THEME_ID, targetName: tr.themeName, action: 'saved', by: options.updatedBy, now: options.now });
        return doc;
    }

    /** Every playlist with what the playlists page shows of it, sorted by name. */
    async listPlaylists(): Promise<PlaylistOverview[]> {
        const running = await this.readRunningScreens();
        const screens = running.screens.map((s) => s.doc);
        const slides = new Map((await this.readSlides()).docs.map((s) => [s.doc.id, s.doc]));
        const overviews = running.playlists.map(({ doc }) => {
            const own = doc.slideIds.map((id) => slides.get(id)).filter((s): s is SlideDoc => s !== undefined);
            // ISO instants of one clock: the latest is the greatest string.
            const editedAt = [doc, ...own].reduce((latest, d) => ((d.updatedAt ?? '') > latest ? d.updatedAt! : latest), '');
            return {
                playlist: withPlaylistDefaults(doc, screens),
                firstSlide: own.find((s) => s.enabled) ?? own[0] ?? null,
                slideCount: own.length,
                media: [] as MediaDoc[],
                screens: screensShowing(doc.id, screens),
                editedAt: editedAt || null,
                // savePlaylist stamps a playlist and its slides alike – a newer slide names the playlist it was saved from.
                editedBy:
                    (doc.updatedAt === editedAt ? doc : running.playlists.find((p) => p.doc.updatedAt === editedAt)?.doc)?.updatedBy ||
                    null,
            };
        });
        const mediaIds = new Set(overviews.flatMap((o) => (o.firstSlide ? referencedMedia(o.firstSlide) : [])));
        if (mediaIds.size) {
            const media = (await this.readAll('media', this.readOwnMedia)).docs.map((m) => m.doc);
            for (const o of overviews) {
                const ids = o.firstSlide ? referencedMedia(o.firstSlide) : [];
                o.media = media.filter((m) => ids.includes(m.id));
            }
        }
        return overviews.sort((a, b) => a.playlist.name.localeCompare(b.playlist.name, LOCALE));
    }

    /**
     * One playlist with its slides and media – what the editor opens. `extraSlideIds` are slides of a draft that
     * are not published yet (linked ones taken over): `sharedWith` is worked out for them as well.
     */
    async loadPlaylist(id: string, extraSlideIds: string[] = []): Promise<LoadedPlaylist> {
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
            if (!byId.has(sid)) issues.push({ documentId: sid, message: tr.slideMissing });
        }

        const mediaIds = new Set(slides.flatMap(referencedMedia));
        const mediaRead = mediaIds.size ? await this.readAll('media', this.readOwnMedia) : { docs: [], issues: [] };
        const media = mediaRead.docs.map((m) => m.doc).filter((m) => mediaIds.has(m.id));
        const sharedWith: LoadedPlaylist['sharedWith'] = {};
        for (const sid of new Set([...stored.doc.slideIds, ...extraSlideIds])) {
            const others = running.playlists
                .filter((p) => p.doc.id !== id && p.doc.slideIds.includes(sid))
                .map((p) => ({ id: p.doc.id, name: withPlaylistDefaults(p.doc, screens).name }))
                .sort((a, b) => a.name.localeCompare(b.name, LOCALE));
            if (others.length) sharedWith[sid] = others;
        }
        return {
            playlist: withPlaylistDefaults(stored.doc, screens),
            slides,
            media,
            screens: screensShowing(id, screens),
            sharedWith,
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
            name: tr.newSlide,
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
            name: options.name.trim() || tr.newPlaylist,
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
        this.log({ area: 'playlist', targetId: playlist.id, targetName: playlist.name, action: 'created', by: updatedBy, now });
        return playlist;
    }

    /**
     * A copy of a playlist with copies of its slides – changing the copy never
     * changes the original. With `linked` the copy shows the very same slides
     * instead (Plan.md 49): nothing is written for them. Screens are not told:
     * the copy runs nowhere until a schedule chooses it.
     */
    async duplicatePlaylist(
        id: string,
        updatedBy: string,
        now = new Date(),
        options: { linked?: boolean } = {},
    ): Promise<StagedPlaylist> {
        const source = await this.loadPlaylist(id);
        const time = now.toISOString();
        const byId = new Map(source.slides.map((s) => [s.id, s]));
        const slides = source.playlist.slideIds.flatMap((slideId) => {
            const slide = byId.get(slideId);
            if (!slide) return [];
            return [options.linked ? slide : copySlide(slide, time)];
        });
        const playlist: StagedPlaylist = {
            schema: { ...SCHEMA_VERSION },
            kind: 'playlist',
            id: crypto.randomUUID(),
            name: tr.copyOf(source.playlist.name),
            slideIds: slides.map((s) => s.id),
            stage: { ...source.playlist.stage },
            ...(source.playlist.progress ? { progress: true } : {}),
            ...(source.playlist.progressPlacement === 'edge' ? { progressPlacement: 'edge' as const } : {}),
            ...(source.playlist.progressStyle === 'segments' ? { progressStyle: 'segments' as const } : {}),
            revision: 1,
            updatedBy,
            updatedAt: time,
        };
        const ids = await this.ensureCategories();
        if (!options.linked) for (const slide of slides) await this.kv.createValue(ids.slides, serialize(slide));
        await this.kv.createValue(ids.playlists, serialize(playlist));
        this.log({
            area: 'playlist',
            targetId: playlist.id,
            targetName: playlist.name,
            action: 'duplicated',
            details: [`source:${source.playlist.name}`],
            by: updatedBy,
            now,
        });
        return playlist;
    }

    /**
     * The designers' save (Plan.md, F): one playlist and its slides. Slides
     * first, the playlist last and with the revision – a save that breaks off
     * halfway leaves the old order visible, and two designers saving the same
     * playlist notice each other. Screens and schedules stay untouched.
     *
     * With `changedSlideIds` only those slides are written (Plan.md 49): a
     * slide that another playlist shows too must not be overwritten with the
     * stale copy this editor loaded. Of the slides to write, a shared one is
     * checked against its `updatedAt` first; everything is checked before the
     * first write.
     */
    async savePlaylist(bundle: PlaylistBundle, options: SaveOptions): Promise<StagedPlaylist> {
        const now = (options.now ?? new Date()).toISOString();
        const slideIds = new Set(bundle.slides.map((s) => s.id));
        const missing = bundle.playlist.slideIds.find((id) => !slideIds.has(id));
        if (missing) throw new Error(tr.slideMissingInStore(missing));

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
        if (bundle.playlist.banner) playlist.banner = stampBanner(stored.doc.banner, bundle.playlist.banner, options.updatedBy, now);
        const changed = options.changedSlideIds ? new Set(options.changedSlideIds) : null;
        const toWrite = bundle.slides.filter((doc) => !changed || changed.has(doc.id));

        const screens = running.screens.map((s) => s.doc);
        const others = running.playlists.filter((p) => p.doc.id !== bundle.playlist.id);
        const sharedIds = new Set(others.flatMap((p) => p.doc.slideIds));
        const shared = toWrite.filter((doc) => sharedIds.has(doc.id));
        if (shared.length) {
            const storedDocs = new Map((await this.readSlides()).docs.map((s) => [s.doc.id, s.doc]));
            for (const doc of shared) {
                const onDisk = storedDocs.get(doc.id);
                if (!onDisk || onDisk.updatedAt === doc.updatedAt) continue;
                // savePlaylist stamps a playlist and its slides with the same time – that finds who saved the slide.
                const saver = others.find((p) => p.doc.slideIds.includes(doc.id) && p.doc.updatedAt === onDisk.updatedAt);
                throw new SlideConflictError({
                    slide: { id: onDisk.id, name: onDisk.name },
                    playlist: saver ? withPlaylistDefaults(saver.doc, screens).name : null,
                    updatedBy: saver?.doc.updatedBy,
                    updatedAt: onDisk.updatedAt,
                });
            }
        }
        const slides = toWrite.map((doc) => serialize({ ...doc, updatedAt: now }));
        const text = serialize(playlist);

        const ids = await this.ensureCategories();
        const storedSlides = await this.valueIdsById('slides');
        for (const [i, doc] of toWrite.entries()) await this.upsert(ids.slides, storedSlides.get(doc.id), slides[i]!);
        await this.kv.updateValue(ids.playlists, stored.valueId, text);
        const before = new Set(stored.doc.slideIds);
        const names = new Map(bundle.slides.map((s) => [s.id, s.name]));
        const removed = stored.doc.slideIds.filter((id) => !playlist.slideIds.includes(id)).length;
        this.log({
            area: 'playlist',
            targetId: playlist.id,
            targetName: playlist.name,
            action: 'published',
            details: [
                ...toWrite.filter((s) => before.has(s.id)).map((s) => `changed:${s.name}`),
                ...playlist.slideIds.filter((id) => !before.has(id)).map((id) => `added:${names.get(id) ?? ''}`),
                ...(removed ? [`removed:${removed}`] : []),
            ],
            by: options.updatedBy,
            now: options.now,
        });
        return playlist;
    }

    /**
     * Sets or clears the band on several playlists at once, for "Hinweise"
     * (Plan.md, Nächste Schritte 34): only the playlist documents, never
     * their slides. Every revision is checked before anything is written, so
     * a conflict on one playlist does not leave the others half-saved.
     */
    async saveBanners(
        changes: { playlistId: string; expectedRevision: number; banner: Banner | null }[],
        options: { updatedBy: string; now?: Date },
    ): Promise<StagedPlaylist[]> {
        const now = (options.now ?? new Date()).toISOString();
        const running = await this.readRunningScreens();
        const targets = changes.map((change) => {
            const stored = running.playlists.find((p) => p.doc.id === change.playlistId);
            if (!stored) throw new PlaylistNotFoundError(change.playlistId);
            const current = stored.doc.revision ?? 0;
            if (current !== change.expectedRevision) {
                throw new ConflictError({
                    name: withPlaylistDefaults(stored.doc, running.screens.map((s) => s.doc)).name,
                    revision: current,
                    updatedBy: stored.doc.updatedBy,
                    updatedAt: stored.doc.updatedAt,
                });
            }
            return { change, stored };
        });

        const ids = await this.ensureCategories();
        const saved: StagedPlaylist[] = [];
        for (const { change, stored } of targets) {
            const playlist: StagedPlaylist = {
                ...withPlaylistDefaults(stored.doc, running.screens.map((s) => s.doc)),
                schema: { ...SCHEMA_VERSION },
                revision: (stored.doc.revision ?? 0) + 1,
                updatedBy: options.updatedBy,
                updatedAt: now,
            };
            if (change.banner) playlist.banner = stampBanner(stored.doc.banner, change.banner, options.updatedBy, now);
            else delete playlist.banner;
            await this.kv.updateValue(ids.playlists, stored.valueId, serialize(playlist));
            saved.push(playlist);
            this.log({
                area: 'playlist',
                targetId: playlist.id,
                targetName: playlist.name,
                action: 'banners',
                details: [change.banner ? 'banner:set' : 'banner:cleared'],
                by: options.updatedBy,
                now: options.now,
            });
        }
        return saved;
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
        this.log({ area: 'playlist', targetId: id, targetName: stored.doc.name, action: 'deleted' });
        try {
            await this.drafts.discard(id);
        } catch (error) {
            console.warn('Der Entwurf der Präsentation konnte nicht verworfen werden:', error);
        }
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
                throw new Error(tr.otherFormat(staged.name, current.doc.name));
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
        this.log({
            area: 'screen',
            targetId: screenId,
            targetName: current.doc.name,
            action: 'schedule',
            details: [`rules:${choice.rules.length}`],
            by: options.updatedBy,
            now: options.now,
        });
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
        this.log({
            area: 'screen',
            targetId: screen.id,
            targetName: screen.name,
            action: 'settings',
            details: [
                ...(patch.name !== undefined && patch.name !== existing.doc.name ? [`renamed:${existing.doc.name}`] : []),
                ...(patch.overscanPercent !== undefined && patch.overscanPercent !== existing.doc.overscanPercent ? ['overscan'] : []),
            ],
            by: options.updatedBy,
            now: options.now,
        });
        return screen;
    }

    async listMedia(): Promise<MediaDoc[]> {
        return (await this.readAll('media', this.readOwnMedia)).docs.map((m) => m.doc);
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
        this.log({ area: 'settings', targetId: SETTINGS_ID, targetName: tr.settingsName, action: 'settings' });
    }

    /** Every calendar a screen shows or switches on – what a device must be able to read. */
    async calendarIdsInUse(): Promise<number[]> {
        const [{ screens }, slides] = await Promise.all([this.readRunningScreens(), this.readShownSlides()]);
        const ids = new Set<number>();
        for (const block of slides.flatMap((s) => s.blocks)) {
            blockCalendarIds(block).forEach((id) => ids.add(id));
        }
        for (const rule of screens.flatMap((s) => s.doc.schedule)) {
            if (rule.kind === 'appointment') rule.calendarIds.forEach((id) => ids.add(id));
        }
        return [...ids].sort((a, b) => a - b);
    }

    /** The calendars of every block that shows services – what a device must see the events of (Plan.md 51). */
    async serviceCalendarIdsInUse(): Promise<number[]> {
        const slides = await this.readShownSlides();
        const ids = new Set<number>();
        for (const block of slides.flatMap((s) => s.blocks)) {
            if (appointmentServiceIds(block).length) blockCalendarIds(block).forEach((id) => ids.add(id));
        }
        return [...ids].sort((a, b) => a - b);
    }

    /** Every room a screen's `rooms` blocks show – what a device must be able to see (G45). */
    async roomIdsInUse(): Promise<number[]> {
        const slides = await this.readShownSlides();
        const ids = new Set<number>();
        for (const block of slides.flatMap((s) => s.blocks)) {
            if (block.type === 'rooms') block.rooms.forEach((r) => ids.add(r.resourceId));
        }
        return [...ids].sort((a, b) => a - b);
    }

    /** Whether any block shows the rooms of its appointments – then a device must see every room (Plan.md 50). */
    async appointmentRoomsInUse(): Promise<boolean> {
        const slides = await this.readShownSlides();
        return needsAppointmentRooms(slides.flatMap((s) => s.blocks));
    }

    /** Whether any slide shows a video – then a device must see the wiki category (Plan.md 52). */
    async videoInUse(): Promise<boolean> {
        const slides = await this.readShownSlides();
        return slides.some((s) => s.blocks.some((b) => b.type === 'video' && !!b.mediaId));
    }

    async saveMedia(doc: MediaDoc): Promise<void> {
        const ids = await this.ensureCategories();
        const text = serialize(doc);
        const stored = await this.valueIdsById('media');
        await this.upsert(ids.media, stored.get(doc.id), text);
        this.log({ area: 'media', targetId: doc.id, targetName: doc.name, action: stored.has(doc.id) ? 'saved' : 'created' });
    }

    async deleteMedia(id: string): Promise<void> {
        const ids = await this.ensureCategories();
        const valueId = (await this.valueIdsById('media')).get(id);
        if (valueId === undefined) return;
        const name = (await this.listMedia().catch(() => [])).find((m) => m.id === id)?.name ?? id;
        await this.kv.deleteValue(ids.media, valueId);
        this.log({ area: 'media', targetId: id, targetName: name, action: 'deleted' });
    }

    /**
     * Where every medium is shown, by media id (Plan.md, Nächste Schritte 18):
     * one pass over screens, playlists and slides for the whole library, not
     * one per image. Derived, never stored – so it cannot go stale.
     */
    async mediaUses(): Promise<Map<string, MediaUse[]>> {
        const running = await this.readRunningScreens();
        const screens = running.screens.map((s) => s.doc);
        const slides = new Map((await this.readShownSlides()).map((s) => [s.id, s]));
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

    /**
     * Where each custom font is used, by font key: the slides of the playlists and their banners (Plan.md 103). Asked
     * before a font is deleted, so nobody deletes blind. Drafts and unused templates are not counted.
     */
    async fontUses(): Promise<Map<string, FontUse[]>> {
        const running = await this.readRunningScreens();
        const screens = running.screens.map((s) => s.doc);
        const slides = new Map((await this.readShownSlides()).map((s) => [s.id, s]));
        const uses = new Map<string, FontUse[]>();
        const add = (key: string, use: FontUse) => {
            if (key.startsWith(CUSTOM_FONT_PREFIX)) uses.set(key, [...(uses.get(key) ?? []), use]);
        };
        for (const { doc } of running.playlists) {
            const playlist = { id: doc.id, name: withPlaylistDefaults(doc, screens).name };
            if (doc.banner) add(doc.banner.style.fontFamily, { playlist, slide: null, blocks: 1 });
            for (const slide of doc.slideIds.map((id) => slides.get(id))) {
                if (!slide) continue;
                const counts = new Map<string, number>();
                for (const block of slide.blocks) {
                    const key = (block as { style?: { fontFamily?: string } }).style?.fontFamily;
                    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
                }
                for (const [key, blocks] of counts) add(key, { playlist, slide: { id: slide.id, name: slide.name }, blocks });
            }
        }
        return uses;
    }

    /** Removes only the index; playlists and slides become orphans for {@link collectOrphans}. */
    async deleteScreen(slug: string): Promise<void> {
        const ids = await this.ensureCategories();
        const { docs } = await this.readScreens();
        const target = docs.find((s) => s.doc.slug === slug);
        if (!target) throw new ScreenNotFoundError(slug);
        await this.kv.deleteValue(ids.screens, target.valueId);
        this.log({ area: 'screen', targetId: target.doc.id, targetName: target.doc.name, action: 'deleted' });
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
        if (missingPlaylist) throw new Error(tr.playlistMissingInStore(missingPlaylist));
        const slideIds = new Set(slides.map((s) => s.id));
        const missingSlide = playlists.flatMap((p) => p.slideIds).find((id) => !slideIds.has(id));
        if (missingSlide) throw new Error(tr.slideMissingInStore(missingSlide));
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

    /** The category `playlists`, split into playlists, schedule documents (schema 1.2), the theme (1.9) and templates (1.41). */
    private async readPlaylistCategory() {
        const read = await this.readAllResults('playlists', readPlaylistOrSchedule);
        const playlists: Stored<PlaylistDoc>[] = [];
        const schedules: Stored<ScheduleDoc>[] = [];
        const templates: Stored<TemplateDoc>[] = [];
        let theme: Stored<ThemeDoc> | null = null;
        for (const stored of read.docs) {
            if (stored.doc.kind === 'schedule') schedules.push(stored as Stored<ScheduleDoc>);
            else if (stored.doc.kind === 'theme') theme = stored as Stored<ThemeDoc>;
            else if (stored.doc.kind === 'template') templates.push(stored as Stored<TemplateDoc>);
            else playlists.push(stored as Stored<PlaylistDoc>);
        }
        return { playlists, schedules, theme, templates, issues: read.issues };
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
            templates: category.templates,
            issues: [...screens.issues, ...category.issues],
        };
    }

    /** The slides as devices show them: every template block already expanded (schema 1.41). */
    private async readShownSlides(): Promise<SlideDoc[]> {
        const [slides, { templates }] = await Promise.all([this.readSlides(), this.readPlaylistCategory()]);
        const byId = new Map(templates.map((t) => [t.doc.id, t.doc]));
        return slides.docs.map((s) => expandTemplates(s.doc, byId));
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

    private readAll<T>(key: CategoryKey, read: (raw: unknown) => T) {
        return this.readAllResults(key, (raw) => ({ doc: read(raw), issues: [] }));
    }

    /** Like {@link readAll} for readers that report what they skipped inside a document (templates, 1.41). */
    private async readAllResults<T>(key: CategoryKey, read: (raw: unknown) => ReadResult<T>) {
        const ids = await this.ensureCategories();
        const values = await this.kv.listValues(ids[key]);
        const docs: Stored<T>[] = [];
        const issues: ReadIssue[] = [];
        for (const value of values) {
            try {
                const result = read(JSON.parse(value.value));
                docs.push({ valueId: value.id, doc: result.doc });
                issues.push(...result.issues);
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
        if (b.type === 'slideshow') return b.mediaIds;
        if (b.type === 'video' && b.mediaId) return [b.mediaId];
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

/** A slide with fresh ids for itself and its blocks, under its own name. */
export function copySlide(slide: SlideDoc, updatedAt?: string): SlideDoc {
    const copy = JSON.parse(JSON.stringify(slide)) as SlideDoc;
    return {
        ...copy,
        schema: { ...SCHEMA_VERSION },
        id: crypto.randomUUID(),
        blocks: copy.blocks.map((b) => ({ ...b, id: crypto.randomUUID() })),
        ...(updatedAt ? { updatedAt } : {}),
    };
}

function screensShowing(playlistId: string, screens: readonly ScreenDoc[]): ScreenRef[] {
    return screens
        .filter((s) => playlistIdsOf(s).includes(playlistId))
        .map((s) => ({ id: s.id, slug: s.slug, name: s.name }))
        .sort((a, b) => a.name.localeCompare(b.name, LOCALE));
}
