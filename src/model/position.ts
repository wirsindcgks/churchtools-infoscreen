import { MAX_VALUE_LENGTH } from './read';

/**
 * Where a screen stands (Plan.md 124 C, 135 B): one value per screen in the category `status`, written by a TV with a device login while
 * it is released for the rehearsal override or the click steering. The phone page reads it – and only it – to know what the monitor shows:
 * the presentation, how it moves on, whether a rehearsal runs, the songsheet and, where clicks count, the slide. Not a schema document – no
 * version, and the reader skips what it does not understand, like the signs of life next to it.
 */
export interface PositionDoc {
    kind: 'position';
    /** `ScreenDoc.id`. */
    screenId: string;
    /** `PlaylistDoc.id` of the running presentation. */
    playlistId: string;
    /** Name of the running presentation, cut like the names of the slides; missing = unknown (a value of before Plan.md 135 B). */
    playlistName?: string;
    /**
     * How the presentation moves on at this screen (`effectiveAdvance`: "time" without the release for the click steering). Missing = a
     * value of before Plan.md 135 B, which was only written where clicks count: read as `click`.
     */
    advance: 'time' | 'time-click' | 'click';
    /** The musicians override the screen for a rehearsal (`activeOverride`): until when and who chose; missing = none. */
    rehearsal?: { until: string; by?: string };
    /** `SlideDoc.id` on show. Only where clicks count (`advance` not `time`); the same for `number`, `total` and `slides`. */
    slideId?: string;
    /** Place of the slide among the slides shown, from 1 (`placeInRotation`). */
    number?: number;
    total?: number;
    /** The slides shown, in order, for the list to tap. */
    slides?: { id: string; name: string }[];
    /**
     * The slide has a block `songsheet` – the phone then steps through its parts first; the first such block counts. Says where the parts
     * come from: the event of the agenda (`agenda`) or the song of the rehearsal (`rehearsal`). `true` – the value of before, or a block
     * whose event is not known – means "unknown": the phone clicks the slides only. Where the presentation runs by time it is the
     * presentation's, not the slide's: the first songsheet of any slide shown – the slide changes without a write.
     */
    songsheet?: PositionSongsheet;
    /** The stage is black. */
    black?: true;
    /** The `seq` of the click applied last; 0 where none was. */
    seq: number;
    /** Name of the musician who clicked last (`ClickDoc.by`); missing = unknown. */
    by?: string;
    /** ISO time of that click (`ClickDoc.at`), for "zuletzt Anna, vor 5 s"; missing = unknown. */
    clickAt?: string;
    /** ISO time of ChurchTools, not of the device clock. */
    at: string;
}

/** A position with the slides – where clicks count; what the phone steers by clicks. */
export type ClickPosition = PositionDoc & Required<Pick<PositionDoc, 'slideId' | 'number' | 'total' | 'slides'>>;

/** Whether the position carries the slides (it does not where the presentation runs by time). */
export function hasSlides(position: PositionDoc): position is ClickPosition {
    return position.slideId !== undefined && position.number !== undefined && position.total !== undefined && position.slides !== undefined;
}

/** Where the parts of a `songsheet` block on the slide come from (Plan.md 124 D). */
export type PositionSongsheet = true | { source: 'agenda'; eventId: number } | { source: 'rehearsal' };

/** The longest name of a slide in the value. */
const NAME_MAX = 40;

function whole(value: unknown, least: number): number | null {
    return typeof value === 'number' && Number.isInteger(value) && value >= least ? value : null;
}

/** `true` and anything unreadable that is set count as unknown, `undefined` where there is no block. */
function readSongsheet(raw: unknown): PositionSongsheet | undefined {
    if (typeof raw === 'object' && raw !== null) {
        const r = raw as Record<string, unknown>;
        if (r.source === 'rehearsal') return { source: 'rehearsal' };
        if (r.source === 'agenda') return typeof r.eventId === 'number' && Number.isInteger(r.eventId) && r.eventId > 0 ? { source: 'agenda', eventId: r.eventId } : true;
    }
    return raw === true ? true : undefined;
}

/** Reads one value tolerantly: `null` for anything that is not a usable position; entries of `slides` without an id are left out; never throws. */
export function readPosition(raw: unknown): PositionDoc | null {
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
    if (r.kind !== 'position') return null;
    if (typeof r.screenId !== 'string' || !r.screenId || typeof r.playlistId !== 'string' || !r.playlistId) return null;
    if (typeof r.at !== 'string' || Number.isNaN(Date.parse(r.at))) return null;
    const advance = r.advance === 'time' || r.advance === 'time-click' || r.advance === 'click' ? r.advance : 'click';
    const doc: PositionDoc = { kind: 'position', screenId: r.screenId, playlistId: r.playlistId, advance, seq: whole(r.seq, 0) ?? 0, at: r.at };
    if (typeof r.playlistName === 'string') doc.playlistName = r.playlistName;
    const rehearsal = r.rehearsal;
    if (typeof rehearsal === 'object' && rehearsal !== null) {
        const o = rehearsal as Record<string, unknown>;
        if (typeof o.until === 'string' && !Number.isNaN(Date.parse(o.until))) doc.rehearsal = { until: o.until, ...(typeof o.by === 'string' && o.by ? { by: o.by } : {}) };
    }
    // The slides count together or not at all; where clicks count a position without them is no position – as before.
    const number = whole(r.number, 0);
    const total = whole(r.total, 0);
    if (typeof r.slideId === 'string' && r.slideId && number !== null && total !== null) {
        const slides: { id: string; name: string }[] = [];
        for (const entry of Array.isArray(r.slides) ? r.slides : []) {
            if (typeof entry !== 'object' || entry === null) continue;
            const e = entry as Record<string, unknown>;
            if (typeof e.id !== 'string' || !e.id) continue;
            slides.push({ id: e.id, name: typeof e.name === 'string' ? e.name : '' });
        }
        doc.slideId = r.slideId;
        doc.number = number;
        doc.total = total;
        doc.slides = slides;
    } else if (advance !== 'time') return null;
    const sheet = readSongsheet(r.songsheet);
    if (sheet) doc.songsheet = sheet;
    if (typeof r.by === 'string' && r.by) doc.by = r.by;
    if (typeof r.clickAt === 'string' && !Number.isNaN(Date.parse(r.clickAt))) doc.clickAt = r.clickAt;
    if (r.black === true) doc.black = true;
    return doc;
}

/** Names cut to {@link NAME_MAX}, and from the end as many slides left out as the value needs to stay within the size of a value. */
export function fitPositionSlides(position: PositionDoc): PositionDoc {
    const fitted: PositionDoc = { ...position };
    if (position.playlistName !== undefined) fitted.playlistName = position.playlistName.slice(0, NAME_MAX);
    if (position.slides) {
        fitted.slides = position.slides.map((s) => ({ id: s.id, name: s.name.slice(0, NAME_MAX) }));
        while (fitted.slides.length && JSON.stringify(fitted).length > MAX_VALUE_LENGTH - 500) fitted.slides = fitted.slides.slice(0, -Math.max(1, Math.ceil(fitted.slides.length / 10)));
    }
    return fitted;
}
