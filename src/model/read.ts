/**
 * Tolerant reading and strict writing of persisted documents.
 *
 * A player can run for weeks with old code and receive data from a newer
 * designer (Plan.md, E). Reading therefore never fails on something new:
 * unknown fields are dropped, unknown or broken blocks are skipped and
 * reported. Only a higher schema major version stops reading – the player
 * then reloads itself to fetch the new code.
 */
import * as v from 'valibot';
import {
    Block,
    ChangeDoc,
    ContentBlock,
    MediaDoc,
    PlaylistDoc,
    PlaylistDraftDoc,
    SCHEMA_VERSION,
    ScheduleDoc,
    ScreenDoc,
    SettingsDoc,
    SlideDoc,
    SlideDraftDoc,
    TemplateDoc,
    ThemeDoc,
    type AnyDoc,
    type Block as BlockValue,
    type ContentBlock as ContentBlockValue,
} from './schema';

/** One value of the KV store holds at most this many characters (G2). */
export const MAX_VALUE_LENGTH = 10_000;

export class SchemaTooNewError extends Error {
    constructor(readonly found: number) {
        super(`Daten mit Schema-Version ${found} sind neuer als dieser Stand (${SCHEMA_VERSION.major}).`);
        this.name = 'SchemaTooNewError';
    }
}

export class InvalidDocumentError extends Error {
    constructor(
        readonly kind: string,
        readonly details: string,
    ) {
        super(`Ungültiges Dokument (${kind}): ${details}`);
        this.name = 'InvalidDocumentError';
    }
}

export class ValueTooLargeError extends Error {
    constructor(
        readonly documentId: string,
        readonly length: number,
    ) {
        super(`„${documentId}" ist mit ${length} Zeichen zu groß (höchstens ${MAX_VALUE_LENGTH}).`);
        this.name = 'ValueTooLargeError';
    }
}

/** Something that was skipped while reading, for display in the designer or a log. */
export interface ReadIssue {
    documentId: string;
    message: string;
}

export interface ReadResult<T> {
    doc: T;
    issues: ReadIssue[];
}

function describe(issues: v.BaseIssue<unknown>[]): string {
    return issues.map((i) => `${v.getDotPath(i) ?? '(Wurzel)'}: ${i.message}`).join('; ');
}

function checkVersion(raw: unknown): void {
    const major = (raw as { schema?: { major?: unknown } } | null)?.schema?.major;
    if (typeof major === 'number' && major > SCHEMA_VERSION.major) {
        throw new SchemaTooNewError(major);
    }
}

function parseStrict<S extends v.GenericSchema>(schema: S, raw: unknown, kind: string): v.InferOutput<S> {
    const result = v.safeParse(schema, raw);
    if (!result.success) throw new InvalidDocumentError(kind, describe(result.issues));
    return result.output;
}

export function readScreen(raw: unknown): ScreenDoc {
    checkVersion(raw);
    return parseStrict(ScreenDoc, raw, 'screen');
}

export function readMedia(raw: unknown): MediaDoc {
    checkVersion(raw);
    return parseStrict(MediaDoc, raw, 'media');
}

/**
 * A media document with only addresses of the own instance: one that points elsewhere is emptied, and
 * the player shows its calm placeholder. Whoever may write media documents could otherwise make every
 * TV and every designer's browser call a foreign server. `origins` are the instance's own; relative
 * addresses count as its own, anything unreadable or without an origin (`data:`) does not.
 */
export function withOwnAddresses(doc: MediaDoc, origins: readonly string[]): MediaDoc {
    const own = (address: string): boolean => {
        try {
            return origins.includes(new URL(address, origins[0]).origin);
        } catch {
            return false;
        }
    };
    const { fileUrl, ...rest } = doc;
    return {
        ...rest,
        imageUrl: doc.imageUrl === '' || own(doc.imageUrl) ? doc.imageUrl : '',
        ...(fileUrl !== undefined && own(fileUrl) ? { fileUrl } : {}),
    };
}

export function readSettings(raw: unknown): SettingsDoc {
    checkVersion(raw);
    return parseStrict(SettingsDoc, raw, 'settings');
}

export function readPlaylist(raw: unknown): PlaylistDoc {
    checkVersion(raw);
    return parseStrict(PlaylistDoc, raw, 'playlist');
}

export function readSchedule(raw: unknown): ScheduleDoc {
    checkVersion(raw);
    return parseStrict(ScheduleDoc, raw, 'schedule');
}

export function readTheme(raw: unknown): ThemeDoc {
    checkVersion(raw);
    return parseStrict(ThemeDoc, raw, 'theme');
}

/** Blocks are parsed one by one so that one unknown block cannot take the document down. */
function readBlocks<S extends v.GenericSchema>(
    schema: S,
    rawBlocks: unknown[],
    documentId: string,
): { blocks: v.InferOutput<S>[]; issues: ReadIssue[] } {
    const issues: ReadIssue[] = [];
    const blocks: v.InferOutput<S>[] = [];
    rawBlocks.forEach((rawBlock, index) => {
        const result = v.safeParse(schema, rawBlock);
        if (result.success) {
            blocks.push(result.output);
            return;
        }
        const type = (rawBlock as { type?: unknown })?.type;
        issues.push({
            documentId,
            message: `Block ${index + 1} (${String(type)}) übersprungen: ${describe(result.issues)}`,
        });
    });
    return { blocks, issues };
}

function rawBlocksOf(raw: unknown): unknown[] {
    return Array.isArray((raw as { blocks?: unknown })?.blocks) ? (raw as { blocks: unknown[] }).blocks : [];
}

/** A template (1.41, Plan.md 87): blocks are read like a slide's, but one that is a template itself is skipped. */
export function readTemplate(raw: unknown): ReadResult<TemplateDoc> {
    checkVersion(raw);
    const template = parseStrict(TemplateDoc, { ...(raw as object), blocks: [] }, 'template');
    const { blocks, issues } = readBlocks<typeof ContentBlock>(ContentBlock, rawBlocksOf(raw), template.id);
    return { doc: { ...template, blocks: blocks as ContentBlockValue[] }, issues };
}

/**
 * The category `playlists` holds playlists, since schema 1.2 schedule documents, since 1.9 the theme and since
 * 1.41 templates. The issues are those of a template's skipped blocks.
 */
export function readPlaylistOrSchedule(raw: unknown): ReadResult<PlaylistDoc | ScheduleDoc | ThemeDoc | TemplateDoc> {
    const kind = (raw as { kind?: unknown } | null)?.kind;
    if (kind === 'schedule') return { doc: readSchedule(raw), issues: [] };
    if (kind === 'theme') return { doc: readTheme(raw), issues: [] };
    if (kind === 'template') return readTemplate(raw);
    return { doc: readPlaylist(raw), issues: [] };
}

/**
 * Before 1.34 a list showed rooms as cards only (Plan.md 82). A list written then keeps that look: `roomsInRows: false`
 * on every list that asks for rooms and is not sure to be cards (no `layout` follows the theme, which is unknown here).
 * The slide then counts as 1.34, so that switching "Raum zeigen" on again sticks.
 */
function migrateRoomsInRows(raw: unknown, rawBlocks: unknown[]): { blocks: unknown[]; migrated: boolean } {
    const schema = (raw as { schema?: { major?: unknown; minor?: unknown } } | null)?.schema;
    const old = !schema || (schema.major === 1 && typeof schema.minor === 'number' && schema.minor < 34);
    if (!old) return { blocks: rawBlocks, migrated: false };
    const blocks = rawBlocks.map((b) => {
        const block = b as { type?: unknown; showRooms?: unknown; layout?: unknown } | null;
        return block?.type === 'appointment-list' && block.showRooms === true && block.layout !== 'cards' ? { ...block, roomsInRows: false } : b;
    });
    return { blocks, migrated: true };
}

/** Blocks are parsed one by one so that one unknown block cannot take the slide down. */
export function readSlide(raw: unknown): ReadResult<SlideDoc> {
    checkVersion(raw);
    const { blocks: rawBlocks, migrated } = migrateRoomsInRows(raw, rawBlocksOf(raw));
    const slide = parseStrict(SlideDoc, { ...(raw as object), blocks: [] }, 'slide');
    if (migrated) slide.schema = { ...SCHEMA_VERSION };

    const { blocks, issues } = readBlocks<typeof Block>(Block, rawBlocks, slide.id);
    return { doc: { ...slide, blocks: blocks as BlockValue[] }, issues };
}

/**
 * A draft of the category `drafts` (Plan.md 79): a playlist's or a slide's. The slide inside goes through
 * {@link readSlide}, so an old draft is treated like an old slide after a schema update.
 */
export function readDraft(
    raw: unknown,
): ReadResult<PlaylistDraftDoc> | ReadResult<SlideDraftDoc> {
    checkVersion(raw);
    const kind = (raw as { kind?: unknown } | null)?.kind;
    if (kind === 'playlist-draft') return { doc: parseStrict(PlaylistDraftDoc, raw, 'playlist-draft'), issues: [] };
    if (kind !== 'slide-draft') throw new InvalidDocumentError('draft', `Unbekannte Art „${String(kind)}".`);
    const inner = readSlide((raw as { slide?: unknown }).slide);
    const doc = parseStrict(SlideDraftDoc, { ...(raw as object), slide: { ...inner.doc, blocks: [] } }, 'slide-draft');
    return { doc: { ...doc, slide: inner.doc }, issues: inner.issues };
}

/** An entry of the category `protokoll` (Plan.md 100). */
export function readChange(raw: unknown): ChangeDoc {
    checkVersion(raw);
    return parseStrict(ChangeDoc, raw, 'change');
}

/**
 * Serializes a document for storage. Strict: what the designer writes must be
 * fully valid, and the size limit is checked here – before any write – so it
 * never matters whether the server would reject or silently truncate (C4).
 */
export function serialize(doc: AnyDoc | ChangeDoc): string {
    const schemas = {
        screen: ScreenDoc,
        playlist: PlaylistDoc,
        schedule: ScheduleDoc,
        slide: SlideDoc,
        media: MediaDoc,
        settings: SettingsDoc,
        theme: ThemeDoc,
        template: TemplateDoc,
        'playlist-draft': PlaylistDraftDoc,
        'slide-draft': SlideDraftDoc,
        change: ChangeDoc,
    } as const;
    const schema = schemas[doc.kind];
    const valid = parseStrict(schema, doc, doc.kind);
    const text = JSON.stringify(valid);
    if (text.length > MAX_VALUE_LENGTH) throw new ValueTooLargeError(doc.id, text.length);
    return text;
}
