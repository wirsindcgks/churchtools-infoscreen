import type { AgendaEvent } from './live';
import { sheetOf } from './songsheet';

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

/** A choice older than this, for another event, is cleaned up with the next write. */
const STALE_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * What a write of `doc` does to the stored values: the value of the same event is changed (of several, the latest; the rest go),
 * none means create. Readable choices of other events older than two days go, too. What is unreadable stays.
 */
export function planControlWrite(values: readonly { id: number; value: string }[], doc: ControlDoc, nowMs: number): { updateId: number | null; removeIds: number[] } {
    const same: { id: number; at: number }[] = [];
    const removeIds: number[] = [];
    for (const { id, value } of values) {
        const read = readControl(value);
        if (!read) continue;
        const at = Date.parse(read.at);
        if (read.eventId === doc.eventId) same.push({ id, at });
        else if (at < nowMs - STALE_MS) removeIds.push(id);
    }
    same.sort((a, b) => b.at - a.at);
    return { updateId: same[0]?.id ?? null, removeIds: [...removeIds, ...same.slice(1).map((v) => v.id)] };
}

/** A part of a song in the agenda: the point (index into `event.items`) and the section of its sheet. */
export interface PartRef {
    itemIndex: number;
    section: number;
}

/**
 * The parts of the songs with a sheet, in the order of the agenda; the neighbour of `current` in `direction`, over the border of
 * a song to the next or previous song. `null` at the end. Without `current`, forward gives the first part, back gives `null`.
 * Parts outside the flow of the song (`extra`, Plan.md 121 H) are no steps: from one of them forward leads to the next song, back to
 * the last step of the same song.
 */
export function stepPart(event: AgendaEvent, current: PartRef | null, direction: 1 | -1): PartRef | null {
    const parts: PartRef[] = [];
    let extra = false;
    event.items.forEach((item, itemIndex) => {
        if (!item.song) return;
        const sections = sheetOf(item)?.sections ?? [];
        sections.forEach((section, index) => {
            if (!section.extra) parts.push({ itemIndex, section: index });
            else if (current?.itemIndex === itemIndex && current.section === index) extra = true;
        });
    });
    if (!current) return direction === 1 ? (parts[0] ?? null) : null;
    if (extra) {
        if (direction === 1) return parts.find((p) => p.itemIndex > current.itemIndex) ?? null;
        return parts.filter((p) => p.itemIndex === current.itemIndex).at(-1) ?? null;
    }
    const at = parts.findIndex((p) => p.itemIndex === current.itemIndex && p.section === current.section);
    if (at < 0) return null;
    return parts[at + direction] ?? null;
}
