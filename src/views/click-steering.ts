import { CLICK_KEEP, type ClickAction, type ClickDoc } from '../agenda/control';
import type { ClickPosition, PositionDoc } from '../model/position';

/** The pure parts of the click steering of the phone page (Plan.md 124 D): the pace of reading and the clicks written. */

/** How long after the own last click the position is read every second; later every {@link SLOW_POLL_MS}. */
export const FAST_POLL_MS = 1000;
export const SLOW_POLL_MS = 3000;
export const FAST_POLL_WINDOW_MS = 15_000;
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

/** Whether the position the screen reported has caught up with the own click: its `seq` is the own one or higher. */
export function positionSettled(position: Pick<PositionDoc, 'seq'> | null, ownSeq: number | null): boolean {
    return ownSeq !== null && position !== null && position.seq >= ownSeq;
}

/** The slide of `position` moved by `by`; `null` where the slide is not in the list or at its ends – the player does not wrap round (Plan.md 124). */
export function movedSlide(position: Pick<ClickPosition, 'slideId' | 'slides'>, by: 1 | -1): string | null {
    const at = position.slides.findIndex((s) => s.id === position.slideId);
    return at < 0 ? null : (position.slides[at + by]?.id ?? null);
}
