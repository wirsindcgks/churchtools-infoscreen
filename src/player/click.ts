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

/**
 * What the position says of the songsheet where the presentation runs by time (Plan.md 135 B): the one of the presentation, not of the slide
 * on show – the first block of the first slide that has one. The slide changes all the time and the position is not written for that; a
 * value that followed the slide would change with every round of a presentation of which one slide has a songsheet.
 */
export function songsheetOfSlides(slides: readonly Pick<SlideDoc, 'blocks'>[], events: Readonly<Record<string, number>>): PositionSongsheet | undefined {
    for (const slide of slides) {
        const sheet = songsheetOf(slide, events);
        if (sheet) return sheet;
    }
    return undefined;
}

/** Whether this screen reports where it stands (Plan.md 135 B): when the settings release it for the rehearsal override or the click steering. */
export function reportsPosition(screenId: string, rehearsalScreenIds: readonly string[] | undefined, clickScreenIds: readonly string[] | undefined): boolean {
    return !!rehearsalScreenIds?.includes(screenId) || !!clickScreenIds?.includes(screenId);
}

/**
 * Whether "Vor" (`by` 1) or "Zurück" (-1) from slide `index` of `count` still moves (Plan.md 124): "Vor" on the last slide starts over at the
 * first (user, 2026-11-27), "Zurück" on the first holds. One slide alone does not move.
 */
export function canStepSlide(index: number, count: number, by: number): boolean {
    if (count < 1) return false;
    const at = ((index % count) + count) % count;
    return by > 0 ? count > 1 : by < 0 ? at > 0 : true;
}
