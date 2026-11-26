import { MAX_VALUE_LENGTH } from './read';

/**
 * Where a screen stands (Plan.md 124 C): one value per screen in the category `status`, written by a TV with a device login while it is
 * released for the click steering and its presentation does not run by time alone. The phone page reads it for "Folie 3 von 12" and the
 * list of slides. Not a schema document – no version, and the reader skips what it does not understand, like the signs of life next to it.
 */
export interface PositionDoc {
    kind: 'position';
    /** `ScreenDoc.id`. */
    screenId: string;
    /** `PlaylistDoc.id` of the running presentation. */
    playlistId: string;
    /** `SlideDoc.id` on show. */
    slideId: string;
    /** Place of the slide among the slides shown, from 1 (`placeInRotation`). */
    number: number;
    total: number;
    /** The slides shown, in order, for the list to tap. */
    slides: { id: string; name: string }[];
    /** The slide has a block `songsheet` – the phone then steps through its parts first. */
    songsheet?: true;
    /** The stage is black. */
    black?: true;
    /** The `seq` of the click applied last; 0 where none was. */
    seq: number;
    /** ISO time of ChurchTools, not of the device clock. */
    at: string;
}

/** The longest name of a slide in the value. */
const NAME_MAX = 40;

function whole(value: unknown, least: number): number | null {
    return typeof value === 'number' && Number.isInteger(value) && value >= least ? value : null;
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
    if (typeof r.slideId !== 'string' || !r.slideId) return null;
    if (typeof r.at !== 'string' || Number.isNaN(Date.parse(r.at))) return null;
    const number = whole(r.number, 0);
    const total = whole(r.total, 0);
    if (number === null || total === null) return null;
    const slides: { id: string; name: string }[] = [];
    for (const entry of Array.isArray(r.slides) ? r.slides : []) {
        if (typeof entry !== 'object' || entry === null) continue;
        const e = entry as Record<string, unknown>;
        if (typeof e.id !== 'string' || !e.id) continue;
        slides.push({ id: e.id, name: typeof e.name === 'string' ? e.name : '' });
    }
    const doc: PositionDoc = { kind: 'position', screenId: r.screenId, playlistId: r.playlistId, slideId: r.slideId, number, total, slides, seq: whole(r.seq, 0) ?? 0, at: r.at };
    if (r.songsheet === true) doc.songsheet = true;
    if (r.black === true) doc.black = true;
    return doc;
}

/** Names cut to {@link NAME_MAX}, and from the end as many slides left out as the value needs to stay within the size of a value. */
export function fitPositionSlides(position: PositionDoc): PositionDoc {
    const slides = position.slides.map((s) => ({ id: s.id, name: s.name.slice(0, NAME_MAX) }));
    const fitted = { ...position, slides };
    while (fitted.slides.length && JSON.stringify(fitted).length > MAX_VALUE_LENGTH - 500) fitted.slides = fitted.slides.slice(0, -Math.max(1, Math.ceil(fitted.slides.length / 10)));
    return fitted;
}
