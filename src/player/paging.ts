/**
 * Appointment lists page by page (Plan.md, Nächste Schritte 23): how many
 * rows fit a block, how the rows split into pages, how long each page shows
 * and how long the slide must then stay so that every page is seen.
 */
import type { SlideDoc } from '../model/schema';

/** Seconds per page unless the block says otherwise. */
export const PAGE_SECONDS = 10;
/** "All" appointments, but not without end – a horizon of a year could hold thousands. */
export const SHOW_ALL_CAP = 200;

/**
 * Splits rows into pages by their measured heights – rows of the card layout
 * differ, with or without subtitle and place. When they need more than one
 * page, `reserve` stays free at the bottom for the page bar. Every page has
 * at least one row. Not measured yet (a height of 0): everything on one page,
 * the block clips.
 */
export function paginateByHeight<T>(
    items: readonly T[],
    heights: readonly number[],
    blockHeight: number,
    reserve: number,
): T[][] {
    if (!items.length) return [[]];
    const measured = items.map((_, i) => heights[i] ?? 0);
    if (measured.some((h) => !(h > 0))) return [[...items]];
    if (measured.reduce((sum, h) => sum + h, 0) <= blockHeight) return [[...items]];
    const room = blockHeight - reserve;
    const pages: T[][] = [];
    let page: T[] = [];
    let used = 0;
    items.forEach((item, i) => {
        const height = measured[i]!;
        if (page.length && used + height > room) {
            pages.push(page);
            page = [];
            used = 0;
        }
        page.push(item);
        used += height;
    });
    pages.push(page);
    return pages;
}

/** How long one page shows: its own time, or longer when the slide lasts longer anyway. */
export function pageInterval(pageSeconds: number, slideSeconds: number, pages: number): number {
    return Math.max(pageSeconds, slideSeconds / Math.max(1, pages));
}

/**
 * How long the slide stays: its duration, or as long as its paged lists need
 * to show every page. `pages` holds the page count each list block reported.
 */
export function slideSeconds(slide: SlideDoc, pages: Readonly<Record<string, number>>): number {
    let seconds = slide.durationSeconds;
    for (const block of slide.blocks) {
        if (block.type !== 'appointment-list' || !block.showAll) continue;
        const count = pages[block.id] ?? 1;
        // One page needs no more time than the slide has.
        if (count > 1) seconds = Math.max(seconds, count * (block.pageSeconds ?? PAGE_SECONDS));
    }
    return seconds;
}
