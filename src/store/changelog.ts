/**
 * The changelog (Plan.md 100): who changed what, when – one value per change in its own category `protokoll`.
 * ChurchTools keeps no author with a value, so the designer writes the person down; the entries are no proof.
 * Writing never stops a save: a missing category, a missing right or any other error ends in a warning at most.
 */
import { httpStatus } from '../ct/client';
import {
    MAX_VALUE_LENGTH,
    readChange,
    serialize,
} from '../model/read';
import { SCHEMA_VERSION, type ChangeArea, type ChangeDoc } from '../model/schema';
import type { KvBackend, KvValue } from './kv';

/**
 * Not in `CATEGORIES` on purpose, like `drafts`: it is found by its shorty and created only by an administrator
 * (setup page) or the demo.
 */
export const CHANGELOG_CATEGORY = {
    shorty: 'protokoll',
    name: 'Protokoll',
    description: 'Infoscreen: wer wann was geändert hat',
} as const;

/** Entries older than this are deleted by whoever may, and hidden from everyone else. */
export const CHANGELOG_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_NAME = 100;
const MAX_DETAILS = 30;
const MAX_DETAIL = 120;

export interface ChangeEntry {
    area: ChangeArea;
    targetId: string;
    targetName: string;
    action: string;
    details?: string[];
    by: string;
    personId?: number;
    now?: Date;
}

/** A missing right comes as `401` or `403` – the `401` even says „Session abgelaufen" (G56). */
function missingRight(error: unknown): boolean {
    const status = httpStatus(error);
    return status === 401 || status === 403;
}

/** At most `max` characters (not bytes, G56), ending in „…" when cut. */
function clip(text: string, max: number): string {
    const chars = [...text];
    return chars.length <= max ? text : `${chars.slice(0, max - 1).join('')}…`;
}

/** Builds the document with every text cut to its limit; drops details until the value fits (G56). */
export function buildChange(entry: ChangeEntry): ChangeDoc {
    let details = (entry.details ?? []).map((d) => clip(d, MAX_DETAIL));
    if (details.length > MAX_DETAILS) {
        details = [...details.slice(0, MAX_DETAILS - 1), `more:${details.length - MAX_DETAILS + 1}`];
    }
    const doc: ChangeDoc = {
        schema: { ...SCHEMA_VERSION },
        kind: 'change',
        id: crypto.randomUUID(),
        at: (entry.now ?? new Date()).toISOString(),
        by: clip(entry.by, MAX_NAME),
        ...(entry.personId === undefined ? {} : { personId: entry.personId }),
        area: entry.area,
        targetId: clip(entry.targetId, MAX_NAME),
        targetName: clip(entry.targetName, MAX_NAME),
        action: clip(entry.action, 30),
        ...(details.length ? { details } : {}),
    };
    while (doc.details?.length && JSON.stringify(doc).length > MAX_VALUE_LENGTH) doc.details.pop();
    return doc;
}

export class ChangelogStore {
    /** The `protokoll` category, once found; a missing one is looked for again – it may appear later. */
    private id: number | null = null;

    constructor(private readonly kv: KvBackend) {}

    /** The id of the category, or null while there is none this person can see. Creates nothing. */
    async categoryId(): Promise<number | null> {
        if (this.id !== null) return this.id;
        const found = (await this.kv.listCategories()).find((c) => c.shorty === CHANGELOG_CATEGORY.shorty);
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
            this.id = (await this.kv.createCategory({ ...CHANGELOG_CATEGORY })).id;
            return this.id;
        } catch (error) {
            console.warn('Die Kategorie „Protokoll" konnte nicht angelegt werden:', error);
            return null;
        }
    }

    /** Writes one entry. Never throws: without the category nothing happens, any other error is only a warning. */
    async record(entry: ChangeEntry): Promise<void> {
        try {
            const categoryId = await this.categoryId();
            if (categoryId === null) return;
            await this.kv.createValue(categoryId, serialize(buildChange(entry)));
        } catch (error) {
            console.warn('Die Änderung konnte nicht protokolliert werden:', error);
        }
    }

    /**
     * The entries of the last {@link CHANGELOG_DAYS} days, newest first. Null while there is no category or no
     * right to see it – different from an empty list.
     */
    async list(now = new Date()): Promise<ChangeDoc[] | null> {
        const read = await this.readEntries();
        if (read === null) return null;
        const from = now.getTime() - CHANGELOG_DAYS * DAY_MS;
        return read
            .map((e) => e.doc)
            .filter((doc) => Date.parse(doc.at) >= from)
            .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    }

    /**
     * Deletes the entries older than {@link CHANGELOG_DAYS} days. Whoever may not delete (`401`/`403`) just
     * stops: {@link list} hides the old ones anyway. Gives the number deleted.
     */
    async prune(now = new Date()): Promise<number> {
        const categoryId = await this.categoryId();
        const read = categoryId === null ? null : await this.readEntries();
        if (categoryId === null || read === null) return 0;
        const cutoff = now.getTime() - CHANGELOG_DAYS * DAY_MS;
        let deleted = 0;
        for (const { value, doc } of read) {
            if (Date.parse(doc.at) >= cutoff) continue;
            try {
                await this.kv.deleteValue(categoryId, value.id);
                deleted += 1;
            } catch (error) {
                if (missingRight(error)) return deleted;
                throw error;
            }
        }
        return deleted;
    }

    private async readEntries(): Promise<{ value: KvValue; doc: ChangeDoc }[] | null> {
        try {
            const categoryId = await this.categoryId();
            if (categoryId === null) return null;
            const entries: { value: KvValue; doc: ChangeDoc }[] = [];
            for (const value of await this.kv.listValues(categoryId)) {
                try {
                    entries.push({ value, doc: readChange(JSON.parse(value.value)) });
                } catch {
                    // An entry this version cannot read is left alone.
                }
            }
            return entries;
        } catch (error) {
            if (missingRight(error)) return null;
            throw error;
        }
    }
}
