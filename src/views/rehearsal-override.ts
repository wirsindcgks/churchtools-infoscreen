import type { OverrideDoc } from '../agenda/control';
import type { PositionDoc } from '../model/position';
import { OVERRIDE_MAX_MS } from '../player/schedule';

/** The pure parts of the rehearsal on the phone page (Plan.md 135 D): what is written for "Probe starten", "+n Std" and "Beenden", and what the card shows meanwhile. */

/** The durations to choose when starting, and the preselected one (Plan.md 125). */
export const REHEARSAL_HOURS = [1, 2, 3];
export const DEFAULT_HOURS = 2;
/** Added by the buttons in the card while a rehearsal runs. */
export const EXTEND_HOURS = [1, 2];
/** How long the page holds its own write over the position of the screen: the player reads the values every 20 seconds and reports then. */
export const PENDING_MAX_MS = 60_000;

const HOUR_MS = 60 * 60 * 1000;

/** What the card knows of a running rehearsal. */
export interface ShownRehearsal {
    until: string;
    by?: string;
    /** The rehearsal presentation that runs; "Verlängern" writes it again. */
    playlistId: string;
}

function withAuthor(doc: OverrideDoc, by: string): OverrideDoc {
    if (by) doc.by = by;
    return doc;
}

/** The end of a rehearsal of `hours` from `now`, never later than the limit of 4 hours from now. */
function cappedEnd(endMs: number, now: number): string {
    return new Date(Math.min(endMs, now + OVERRIDE_MAX_MS)).toISOString();
}

/** "Probe starten": the presentation on the screen for `hours` from now. */
export function startOverride(screenId: string, playlistId: string, hours: number, now: number, by: string): OverrideDoc {
    return withAuthor({ kind: 'override', screenId, playlistId, until: cappedEnd(now + hours * HOUR_MS, now), at: new Date(now).toISOString() }, by);
}

/** "+1 Std", "+2 Std": the end moves by `hours` – from the end that stands, not from now –, but stays within 4 hours from now. */
export function extendOverride(screenId: string, shown: ShownRehearsal, hours: number, now: number, by: string): OverrideDoc {
    const base = Math.max(Date.parse(shown.until), now);
    return withAuthor({ kind: 'override', screenId, playlistId: shown.playlistId, until: cappedEnd(base + hours * HOUR_MS, now), at: new Date(now).toISOString() }, by);
}

/** "Beenden": the screen goes back to the schedule. */
export function endOverride(screenId: string, now: number, by: string): OverrideDoc {
    const at = new Date(now).toISOString();
    return withAuthor({ kind: 'override', screenId, playlistId: '', until: at, at, ended: true }, by);
}

/**
 * What the card shows: the rehearsal the screen reports, with the own last write laid over it until the screen reports it (or a minute
 * has passed). `pending` – the last write of this page for this screen.
 */
export function shownRehearsal(position: PositionDoc | null, pending: OverrideDoc | null, now: number): ShownRehearsal | null {
    const reported = position?.rehearsal ? { ...position.rehearsal, playlistId: position.playlistId } : null;
    if (!pending || now - Date.parse(pending.at) > PENDING_MAX_MS) return reported;
    if (pending.ended) return null;
    // The screen has caught up once it reports an end as late as the written one.
    if (reported && Date.parse(reported.until) >= Date.parse(pending.until) - 1000) return reported;
    return { until: pending.until, playlistId: pending.playlistId, ...(pending.by ? { by: pending.by } : {}) };
}

/**
 * Whether the screen has taken the own last write (user, 2026-11-27: after "Probe starten" and "Beenden" nothing seemed to happen, while
 * the screen took up to half a minute): `waiting` – not yet, `late` – not within a minute (is it on?), `null` – taken, or nothing written.
 */
export function transferState(position: PositionDoc | null, pending: OverrideDoc | null, now: number): 'waiting' | 'late' | null {
    if (!pending) return null;
    const reported = position?.rehearsal;
    const taken = pending.ended ? !reported : !!reported && Date.parse(reported.until) >= Date.parse(pending.until) - 1000;
    if (taken) return null;
    return now - Date.parse(pending.at) > PENDING_MAX_MS ? 'late' : 'waiting';
}
