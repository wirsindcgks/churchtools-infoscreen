import type { AgendaEvent } from './live';
import { sheetOf, type SongSheet } from './songsheet';

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

/**
 * The song the musicians chose for the rehearsal (Plan.md 121, "Proben"): one value for all rehearsal screens, independent of any
 * event. Tells itself apart from the choices per event by `kind` and the missing `eventId`; each side leaves the values of the other.
 */
export interface RehearsalDoc {
    kind: 'rehearsal';
    songId: number;
    arrangementId: number;
    /** Index into `sheet.sections` of the transposed sheet. */
    section: number;
    /** ISO time of the choice. */
    at: string;
    /** Name of the musician. */
    by?: string;
    /**
     * "Lied beenden" (user, 2026-11-13): no song any more – the screens show the QR code, the phone pages the search. Song, arrangement
     * and part are then 0.
     */
    ended?: true;
}

/** Reads one value tolerantly: `null` for anything that is no rehearsal choice (a choice per event included); never throws. */
export function readRehearsal(raw: unknown): RehearsalDoc | null {
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
    if (r.kind !== 'rehearsal') return null;
    if (r.ended === true) {
        if (typeof r.at !== 'string' || Number.isNaN(Date.parse(r.at))) return null;
        const end: RehearsalDoc = { kind: 'rehearsal', songId: 0, arrangementId: 0, section: 0, at: r.at, ended: true };
        if (typeof r.by === 'string' && r.by) end.by = r.by;
        return end;
    }
    const songId = whole(r.songId, 1);
    const arrangementId = whole(r.arrangementId, 0);
    const section = whole(r.section, 0);
    if (songId === null || arrangementId === null || section === null) return null;
    if (typeof r.at !== 'string' || Number.isNaN(Date.parse(r.at))) return null;
    const doc: RehearsalDoc = { kind: 'rehearsal', songId, arrangementId, section, at: r.at };
    if (typeof r.by === 'string' && r.by) doc.by = r.by;
    return doc;
}

/** The rehearsal choice with the latest `at`; `null` where there is none. */
export function latestRehearsal(values: readonly { value: string }[]): RehearsalDoc | null {
    let latest: RehearsalDoc | null = null;
    for (const { value } of values) {
        const doc = readRehearsal(value);
        if (doc && (!latest || Date.parse(doc.at) > Date.parse(latest.at))) latest = doc;
    }
    return latest;
}

/**
 * The override of a screen by the musicians (Plan.md 125 B): they choose a presentation for a screen until a time. Tells itself apart
 * from the other values by `kind`; the player follows it only where the settings release screen and presentation.
 */
export interface OverrideDoc {
    kind: 'override';
    /** `ScreenDoc.id`. */
    screenId: string;
    /** `PlaylistDoc.id`; empty at "Probe beenden". */
    playlistId: string;
    /** ISO time until which the override runs; at "Probe beenden" the same as `at`. */
    until: string;
    /** ISO time of the choice. */
    at: string;
    /** Name of the musician. */
    by?: string;
    /** "Probe beenden": no override any more. */
    ended?: true;
}

function isoTime(value: unknown): value is string {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/** Reads one value tolerantly: `null` for anything that is no override; never throws. */
export function readOverride(raw: unknown): OverrideDoc | null {
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
    if (r.kind !== 'override') return null;
    if (typeof r.screenId !== 'string' || !r.screenId || !isoTime(r.at)) return null;
    let doc: OverrideDoc;
    if (r.ended === true) {
        doc = { kind: 'override', screenId: r.screenId, playlistId: '', until: r.at, at: r.at, ended: true };
    } else {
        if (typeof r.playlistId !== 'string' || !r.playlistId || !isoTime(r.until)) return null;
        doc = { kind: 'override', screenId: r.screenId, playlistId: r.playlistId, until: r.until, at: r.at };
    }
    if (typeof r.by === 'string' && r.by) doc.by = r.by;
    return doc;
}

/** The override of this screen with the latest `at` (an ended one counts); `null` where there is none. */
export function latestOverride(values: readonly { value: string }[], screenId: string): OverrideDoc | null {
    let latest: OverrideDoc | null = null;
    for (const { value } of values) {
        const doc = readOverride(value);
        if (doc && doc.screenId === screenId && (!latest || Date.parse(doc.at) > Date.parse(latest.at))) latest = doc;
    }
    return latest;
}

/** By screen, the override with the latest `at` (an ended one counts); values that are no override are skipped. */
export function overridesByScreen(values: readonly { value: string }[]): Record<string, OverrideDoc> {
    const latest: Record<string, OverrideDoc> = {};
    for (const { value } of values) {
        const doc = readOverride(value);
        if (!doc) continue;
        const before = latest[doc.screenId];
        if (!before || Date.parse(doc.at) > Date.parse(before.at)) latest[doc.screenId] = doc;
    }
    return latest;
}

/** An override of another screen that ended, or whose time ran out more than this ago, is cleaned up with the next write. */
export const OVERRIDE_STALE_MS = 60 * 60 * 1000;

/**
 * What a write of an override for `screenId` does: of the readable overrides of the same screen the latest `at` is changed (none means
 * create), the rest go – one value per screen. That also ends the limit of Plan.md 125 B: a phone with a fast clock wrote an `at` that
 * hid all later values as the latest; the next write now replaces exactly that value. Overrides of other screens go when they ended or
 * ran out more than an hour ago; running ones stay. Everything else (song choices, rehearsal choice, catalog, unreadable) stays.
 */
export function planOverrideWrite(values: readonly { id: number; value: string }[], screenId: string, nowMs: number): { updateId: number | null; removeIds: number[] } {
    const same: { id: number; at: number }[] = [];
    const removeIds: number[] = [];
    for (const { id, value } of values) {
        const read = readOverride(value);
        if (!read) continue;
        if (read.screenId === screenId) same.push({ id, at: Date.parse(read.at) });
        else if (read.ended || Date.parse(read.until) < nowMs - OVERRIDE_STALE_MS) removeIds.push(id);
    }
    same.sort((a, b) => b.at - a.at);
    return { updateId: same[0]?.id ?? null, removeIds: [...removeIds, ...same.slice(1).map((v) => v.id)] };
}

/** One click of the click steering (Plan.md 124 C). */
export interface ClickAction {
    /** Rises with every click of the screen; the player applies what is above the last one it knows. */
    seq: number;
    do: 'next' | 'previous' | 'black' | 'goto';
    /** `SlideDoc.id` – only at `goto`. */
    slideId?: string;
}

/** How many of the latest clicks the value keeps – so that none is lost which came between two reads of the player. */
export const CLICK_KEEP = 10;
/** A click older than this does not count any more (a player that was off, a phone that waited for the network). */
export const CLICK_MAX_AGE_MS = 2 * 60 * 1000;
/** How far after `now` the time of a click may lie (clocks differ). */
export const CLICK_CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * The clicks on a screen by the musicians (Plan.md 124 C): one value per screen in `steuerung`, written from the phone page, read by the
 * player of a screen released for the click steering. Tells itself apart from the other values by `kind`.
 */
export interface ClickDoc {
    kind: 'click';
    /** `ScreenDoc.id`. */
    screenId: string;
    /** `PlaylistDoc.id` the clicks were meant for; the player applies them only while it runs this presentation. */
    playlistId: string;
    /** The latest clicks (at most {@link CLICK_KEEP}) by `seq`, rising. */
    actions: ClickAction[];
    /** ISO time of the latest click. */
    at: string;
    /** Name of the musician. */
    by?: string;
}

/** Reads one value tolerantly: `null` for anything that is no click value; damaged actions are left out; never throws. */
export function readClick(raw: unknown): ClickDoc | null {
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
    if (r.kind !== 'click') return null;
    if (typeof r.screenId !== 'string' || !r.screenId || typeof r.playlistId !== 'string' || !r.playlistId || !isoTime(r.at)) return null;
    const actions: ClickAction[] = [];
    for (const entry of Array.isArray(r.actions) ? r.actions : []) {
        if (typeof entry !== 'object' || entry === null) continue;
        const e = entry as Record<string, unknown>;
        const seq = whole(e.seq, 0);
        if (seq === null) continue;
        if (e.do === 'next' || e.do === 'previous' || e.do === 'black') actions.push({ seq, do: e.do });
        else if (e.do === 'goto' && typeof e.slideId === 'string' && e.slideId) actions.push({ seq, do: 'goto', slideId: e.slideId });
    }
    actions.sort((a, b) => a.seq - b.seq);
    const doc: ClickDoc = { kind: 'click', screenId: r.screenId, playlistId: r.playlistId, actions: actions.slice(-CLICK_KEEP), at: r.at };
    if (typeof r.by === 'string' && r.by) doc.by = r.by;
    return doc;
}

/** The click value of this screen with the latest `at`; `null` where there is none. */
export function latestClick(values: readonly { value: string }[], screenId: string): ClickDoc | null {
    let latest: ClickDoc | null = null;
    for (const { value } of values) {
        const doc = readClick(value);
        if (doc && doc.screenId === screenId && (!latest || Date.parse(doc.at) > Date.parse(latest.at))) latest = doc;
    }
    return latest;
}

/** What a write of the click value of `screenId` does: the latest value of that screen is changed (none means create), its doubles go. Nothing else is touched. */
export function planClickWrite(values: readonly { id: number; value: string }[], screenId: string): { updateId: number | null; removeIds: number[] } {
    const same: { id: number; at: number }[] = [];
    for (const { id, value } of values) {
        const read = readClick(value);
        if (read && read.screenId === screenId) same.push({ id, at: Date.parse(read.at) });
    }
    same.sort((a, b) => b.at - a.at);
    return { updateId: same[0]?.id ?? null, removeIds: same.slice(1).map((v) => v.id) };
}

/**
 * The clicks the player applies now (Plan.md 124 C) and the `seq` it has applied afterwards. `lastSeq` is `null` at the first read after
 * the start or a change of the presentation: nothing is caught up, the latest `seq` counts as applied. Later, an action counts if its
 * `seq` is above `lastSeq`, the value is meant for the running presentation and its `at` is no older than {@link CLICK_MAX_AGE_MS}
 * and no further ahead than {@link CLICK_CLOCK_TOLERANCE_MS}. `nowMs` is the time of ChurchTools (the device clock corrected by the skew).
 */
export function pendingClicks(doc: ClickDoc | null, lastSeq: number | null, runningPlaylistId: string, nowMs: number): { seq: number; actions: ClickAction[] } {
    const top = doc?.actions.reduce((most, a) => Math.max(most, a.seq), 0) ?? 0;
    if (!doc || lastSeq === null) return { seq: lastSeq === null ? top : lastSeq, actions: [] };
    const seq = Math.max(lastSeq, top);
    if (doc.playlistId !== runningPlaylistId) return { seq, actions: [] };
    const at = Date.parse(doc.at);
    if (nowMs - at > CLICK_MAX_AGE_MS || at - nowMs > CLICK_CLOCK_TOLERANCE_MS) return { seq, actions: [] };
    return { seq, actions: doc.actions.filter((a) => a.seq > lastSeq) };
}

/** What a write of a rehearsal choice does: the latest rehearsal value is changed (none means create), further ones go. Nothing else is touched. */
export function planRehearsalWrite(values: readonly { id: number; value: string }[], nowMs: number): { updateId: number | null; removeIds: number[] } {
    void nowMs;
    const found: { id: number; at: number }[] = [];
    for (const { id, value } of values) {
        const read = readRehearsal(value);
        if (read) found.push({ id, at: Date.parse(read.at) });
    }
    found.sort((a, b) => b.at - a.at);
    return {
        updateId: found[0]?.id ?? null,
        removeIds: found.slice(1).map((v) => v.id),
    };
}

/**
 * The list of what the musicians may override from the phone (Plan.md 125 A): the screens and rehearsal presentations an administrator
 * released, with their names – the musicians' group sees neither screens nor presentations. One value in `steuerung`, written when the
 * administrator saves the release. Tells itself apart from the other values by `kind`.
 */
export interface RehearsalCatalogDoc {
    kind: 'rehearsalCatalog';
    screens: { id: string; name: string }[];
    playlists: { id: string; name: string }[];
    /** Since Plan.md 124 B: the screens released for the click steering. Missing in older values = none; older readers ignore it. */
    clickScreens: { id: string; name: string }[];
    /** ISO time of the write. */
    at: string;
}

function namedIds(raw: unknown): { id: string; name: string }[] | null {
    if (!Array.isArray(raw)) return null;
    const out: { id: string; name: string }[] = [];
    for (const entry of raw) {
        if (typeof entry !== 'object' || entry === null) continue;
        const e = entry as Record<string, unknown>;
        if (typeof e.id !== 'string' || !e.id) continue;
        out.push({ id: e.id, name: typeof e.name === 'string' ? e.name : '' });
    }
    return out;
}

/** Reads one value tolerantly: `null` for anything that is no catalog (the other values of `steuerung` included); never throws. Entries without an id are left out. */
export function readRehearsalCatalog(raw: unknown): RehearsalCatalogDoc | null {
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
    if (r.kind !== 'rehearsalCatalog') return null;
    if (typeof r.at !== 'string' || Number.isNaN(Date.parse(r.at))) return null;
    const screens = namedIds(r.screens);
    const playlists = namedIds(r.playlists);
    if (!screens || !playlists) return null;
    // Tolerant: a value from before the click steering has no list, a damaged one counts as none.
    return { kind: 'rehearsalCatalog', screens, playlists, clickScreens: namedIds(r.clickScreens) ?? [], at: r.at };
}

/** The catalog with the latest `at`; `null` where there is none. */
export function latestRehearsalCatalog(values: readonly { value: string }[]): RehearsalCatalogDoc | null {
    let latest: RehearsalCatalogDoc | null = null;
    for (const { value } of values) {
        const doc = readRehearsalCatalog(value);
        if (doc && (!latest || Date.parse(doc.at) > Date.parse(latest.at))) latest = doc;
    }
    return latest;
}

/** What a write of the catalog does: the latest catalog value is changed (none means create), further ones go. Nothing else is touched. */
export function planRehearsalCatalogWrite(values: readonly { id: number; value: string }[]): { updateId: number | null; removeIds: number[] } {
    const found: { id: number; at: number }[] = [];
    for (const { id, value } of values) {
        const read = readRehearsalCatalog(value);
        if (read) found.push({ id, at: Date.parse(read.at) });
    }
    found.sort((a, b) => b.at - a.at);
    return { updateId: found[0]?.id ?? null, removeIds: found.slice(1).map((v) => v.id) };
}

/**
 * The neighbour of `section` in `direction` within one song; `null` at its borders. Parts outside the flow (`extra`) are no steps: from
 * one of them forward leads to the next step after it, back to the last step before it (like `stepPart`).
 */
export function stepSection(sheet: SongSheet | null, section: number | null, direction: 1 | -1): number | null {
    const sections = sheet?.sections ?? [];
    const steps = sections.flatMap((s, n) => (s.extra ? [] : [n]));
    if (section === null) return direction === 1 ? (steps[0] ?? null) : null;
    if (sections[section]?.extra) {
        return direction === 1 ? (steps.find((n) => n > section) ?? null) : (steps.filter((n) => n < section).at(-1) ?? null);
    }
    const at = steps.indexOf(section);
    if (at < 0) return null;
    return steps[at + direction] ?? null;
}
