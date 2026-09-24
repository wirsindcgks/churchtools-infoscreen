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
    PlaylistDoc,
    SCHEMA_VERSION,
    ScreenDoc,
    SlideDoc,
    type AnyDoc,
    type Block as BlockValue,
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

export function readPlaylist(raw: unknown): PlaylistDoc {
    checkVersion(raw);
    return parseStrict(PlaylistDoc, raw, 'playlist');
}

/** Blocks are parsed one by one so that one unknown block cannot take the slide down. */
export function readSlide(raw: unknown): ReadResult<SlideDoc> {
    checkVersion(raw);
    const rawBlocks: unknown[] = Array.isArray((raw as { blocks?: unknown })?.blocks)
        ? (raw as { blocks: unknown[] }).blocks
        : [];
    const slide = parseStrict(SlideDoc, { ...(raw as object), blocks: [] }, 'slide');

    const issues: ReadIssue[] = [];
    const blocks: BlockValue[] = [];
    rawBlocks.forEach((rawBlock, index) => {
        const result = v.safeParse(Block, rawBlock);
        if (result.success) {
            blocks.push(result.output);
            return;
        }
        const type = (rawBlock as { type?: unknown })?.type;
        issues.push({
            documentId: slide.id,
            message: `Block ${index + 1} (${String(type)}) übersprungen: ${describe(result.issues)}`,
        });
    });
    return { doc: { ...slide, blocks }, issues };
}

/**
 * Serializes a document for storage. Strict: what the designer writes must be
 * fully valid, and the size limit is checked here – before any write – so it
 * never matters whether the server would reject or silently truncate (C4).
 */
export function serialize(doc: AnyDoc): string {
    const schema = doc.kind === 'screen' ? ScreenDoc : doc.kind === 'playlist' ? PlaylistDoc : SlideDoc;
    const valid = parseStrict(schema, doc, doc.kind);
    const text = JSON.stringify(valid);
    if (text.length > MAX_VALUE_LENGTH) throw new ValueTooLargeError(doc.id, text.length);
    return text;
}
