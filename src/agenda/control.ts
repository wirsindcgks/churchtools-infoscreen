/**
 * The choice of the musicians (Plan.md 121 E): which part of which song a stage monitor shows big. One value per event in the
 * category `steuerung`, written from the phone page and read by the player. Not a schema document – no version, and the reader
 * skips what it does not understand. Pure functions – what is fetched lives in `src/store/screen-repository.ts`.
 */

/** The part chosen for an event. */
export interface ControlDoc {
    eventId: number;
    /** Index into the live list of the event (`event.items`); 0 is the placeholder. */
    itemIndex: number;
    /** The arrangement of the point when it was chosen; the choice is void once the agenda plays another. */
    arrangementId?: number;
    /** Index into `sheet.sections` of the transposed sheet. */
    section: number;
    /** ISO time of the choice. */
    at: string;
    /** Name of the musician. */
    by?: string;
}

/**
 * The choices of the musicians. Not in `CATEGORIES` on purpose, like the signs of life: found by its shorty and created only by an
 * administrator.
 */
export const CONTROL_CATEGORY = {
    shorty: 'steuerung',
    name: 'Steuerung',
    description: 'Infoscreen: der Liedteil je Termin, von den Musikern gewählt',
} as const;

function whole(value: unknown, least: number): number | null {
    return typeof value === 'number' && Number.isInteger(value) && value >= least ? value : null;
}

/** Reads one value (a JSON string or the object) tolerantly: `null` for anything that is not a usable choice; never throws. */
export function readControl(raw: unknown): ControlDoc | null {
    let value = raw;
    if (typeof value === 'string') {
        try {
            value = JSON.parse(value);
        } catch {
            return null;
        }
    }
    if (typeof value !== 'object' || value === null) return null;
    const r = value as Record<string, unknown>;
    const eventId = whole(r.eventId, 1);
    const itemIndex = whole(r.itemIndex, 0);
    const section = whole(r.section, 0);
    if (eventId === null || itemIndex === null || section === null) return null;
    if (typeof r.at !== 'string' || Number.isNaN(Date.parse(r.at))) return null;
    const doc: ControlDoc = { eventId, itemIndex, section, at: r.at };
    const arrangementId = whole(r.arrangementId, 0);
    if (arrangementId !== null) doc.arrangementId = arrangementId;
    if (typeof r.by === 'string' && r.by) doc.by = r.by;
    return doc;
}

/** By event, the choice with the latest `at`; values that are no choice are skipped. */
export function controlsByEvent(values: readonly { value: string }[]): Record<number, ControlDoc> {
    const latest: Record<number, ControlDoc> = {};
    for (const { value } of values) {
        const doc = readControl(value);
        if (!doc) continue;
        const before = latest[doc.eventId];
        if (!before || Date.parse(doc.at) > Date.parse(before.at)) latest[doc.eventId] = doc;
    }
    return latest;
}
