import { CLICK_KEEP, stepPart, stepSection, type ClickAction, type ClickDoc, type PartRef } from '../agenda/control';
import type { AgendaEvent } from '../agenda/live';
import type { SongSheet } from '../agenda/songsheet';
import type { PositionDoc } from '../model/position';

/** The pure parts of the area "Bildschirm" of the phone page (Plan.md 124 D). */

/** How long after the own last click the position is read every second; later every {@link SLOW_POLL_MS}. */
export const FAST_POLL_MS = 1000;
export const SLOW_POLL_MS = 3000;
export const FAST_POLL_WINDOW_MS = 15_000;
/** The parts of the songs (choice of the agenda, rehearsal song) are read at most this often – not with every reading of the position. */
export const PARTS_POLL_MS = 3000;
/** An own click the screen did not confirm within this time no longer counts for the display (the screen is off, the player stands still). */
export const OPTIMISTIC_MAX_MS = 20_000;

/** Waiting time until the next reading of the position: every second for 15 seconds after the own last click, else every 3 seconds (G16: 600 requests a minute and address). */
export function pollDelay(lastClickMs: number | null, nowMs: number): number {
    return lastClickMs !== null && nowMs - lastClickMs <= FAST_POLL_WINDOW_MS ? FAST_POLL_MS : SLOW_POLL_MS;
}

/**
 * The click value after one more click: `seq` one above the highest there is, the last {@link CLICK_KEEP} − 1 actions of before kept (none
 * if they were meant for another presentation – the player would apply them to the wrong one, but `seq` keeps rising) and the new one
 * appended. So no click is lost which came between two reads of the player.
 */
export function buildClick(current: ClickDoc | null, input: { screenId: string; playlistId: string; action: Omit<ClickAction, 'seq'>; at: string; by?: string }): ClickDoc {
    const top = current?.actions.reduce((most, a) => Math.max(most, a.seq), 0) ?? 0;
    const kept = current && current.playlistId === input.playlistId ? current.actions.slice(-(CLICK_KEEP - 1)) : [];
    const doc: ClickDoc = {
        kind: 'click',
        screenId: input.screenId,
        playlistId: input.playlistId,
        actions: [...kept, { ...input.action, seq: top + 1 }],
        at: input.at,
    };
    if (input.by) doc.by = input.by;
    return doc;
}

/** Runs the tasks one after the other, in the order they were given; a failing task does not stop the ones behind it. Returns the result of the task. */
export function createQueue(): <T>(task: () => Promise<T>) => Promise<T> {
    let tail: Promise<unknown> = Promise.resolve();
    return (task) => {
        const run = tail.then(task, task);
        tail = run.catch(() => undefined);
        return run;
    };
}

/** What a click of "Vor" or "Zurück" does. */
export type StepDecision =
    | { kind: 'part'; part: PartRef }
    | { kind: 'section'; section: number }
    | { kind: 'slide'; do: 'next' | 'previous' }
    /** The song ends here (Plan.md 124): the click stays – neither the next song nor the next slide. */
    | { kind: 'none' };

/**
 * Where the parts of a songsheet come from, as far as the phone page has read them. A missing entry is "not read yet": no decision then.
 * `null` – there are no parts to step (no event found, nothing left in the agenda, no song or no text chosen for the rehearsal).
 */
export interface StepSources {
    /** `part` – the part on show (or `null` where the agenda stands before any). */
    agenda?: { event: AgendaEvent; part: PartRef | null } | null;
    rehearsal?: { sheet: SongSheet; section: number | null } | null;
}

/**
 * Whether a click goes to the parts of a song or to the screen. On a slide with a songsheet whose source the position names, "Vor" and
 * "Zurück" step the parts first (`stepPart` for the agenda, `stepSection` for the rehearsal). At the last part of a song "Vor" stays
 * (`none`), at the first "Zurück" too – the song changes with the agenda or by the choice of a musician, not by a click. Only where
 * there are no parts to step (no event, nothing left in the agenda, no song) the click goes to the screen. Without a songsheet, with an
 * unknown one (`true`, the value of before) or while the screen is black (a click then only lifts the black) it only clicks the slides.
 * `null` where the parts are not read yet.
 */
export function decideStep(songsheet: PositionDoc['songsheet'], black: boolean, sources: StepSources, direction: 1 | -1): StepDecision | null {
    const slide: StepDecision = { kind: 'slide', do: direction === 1 ? 'next' : 'previous' };
    const NONE: StepDecision = { kind: 'none' };
    if (black || !songsheet || songsheet === true) return slide;
    if (songsheet.source === 'agenda') {
        if (sources.agenda === undefined) return null;
        if (sources.agenda === null) return slide;
        const current = sources.agenda.part;
        const part = stepPart(sources.agenda.event, current, direction);
        // Not over the border of a song – from a part outside the flow forward `stepPart` would lead to the next song, which stays too.
        return part && (!current || part.itemIndex === current.itemIndex) ? { kind: 'part', part } : NONE;
    }
    if (sources.rehearsal === undefined) return null;
    if (sources.rehearsal === null) return slide;
    const section = stepSection(sources.rehearsal.sheet, sources.rehearsal.section, direction);
    return section === null ? NONE : { kind: 'section', section };
}

/** Whether the position the screen reported has caught up with the own click: its `seq` is the own one or higher. */
export function positionSettled(position: Pick<PositionDoc, 'seq'> | null, ownSeq: number | null): boolean {
    return ownSeq !== null && position !== null && position.seq >= ownSeq;
}

/** The slide of `position` moved by `by`; `null` where the slide is not in the list or at its ends – the player does not wrap round (Plan.md 124). */
export function movedSlide(position: Pick<PositionDoc, 'slideId' | 'slides'>, by: 1 | -1): string | null {
    const at = position.slides.findIndex((s) => s.id === position.slideId);
    return at < 0 ? null : (position.slides[at + by]?.id ?? null);
}
