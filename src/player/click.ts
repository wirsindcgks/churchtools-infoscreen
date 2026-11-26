import { isRehearsalSheet } from '../agenda/songsheet';
import type { PositionSongsheet } from '../model/position';
import type { PlaylistDoc, SlideDoc } from '../model/schema';

/**
 * How the running presentation moves on at this screen (Plan.md 124 C): its setting – but only where the settings release the screen for
 * the click steering. Without the release no click could ever arrive, and "per click" would hold a screen on its first slide for good;
 * it then runs by time.
 */
export function effectiveAdvance(playlist: Pick<PlaylistDoc, 'advance'> | null | undefined, screenId: string, clickScreenIds: readonly string[] | undefined): 'time' | 'time-click' | 'click' {
    if (!playlist || !clickScreenIds?.includes(screenId)) return 'time';
    return playlist.advance ?? 'time';
}

/**
 * What the position says of the `songsheet` block of a slide (Plan.md 124 D): the first one counts. A rehearsal sheet is the source
 * "Probe"; one of the agenda is told apart by the event it follows (`events`, by block id, which the blocks report). Where the event is not
 * known the value is `true` – the phone then clicks the slides only. `undefined` without such a block.
 */
export function songsheetOf(slide: Pick<SlideDoc, 'blocks'>, events: Readonly<Record<string, number>>): PositionSongsheet | undefined {
    const block = slide.blocks.find((b): b is Extract<typeof b, { type: 'songsheet' }> => b.type === 'songsheet');
    if (!block) return undefined;
    if (isRehearsalSheet(block)) return { source: 'rehearsal' };
    const eventId = events[block.id];
    return eventId === undefined ? true : { source: 'agenda', eventId };
}

/** Whether "Vor" (`by` 1) or "Zurück" (-1) from slide `index` of `count` still moves: the ends hold, there is no wrap-around (Plan.md 124). */
export function canStepSlide(index: number, count: number, by: number): boolean {
    if (count < 1) return false;
    const at = ((index % count) + count) % count;
    return by > 0 ? at < count - 1 : by < 0 ? at > 0 : true;
}
