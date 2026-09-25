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
 * Rows that fit the block. When the rows need more than one page, the last
 * row's worth of height is kept free for the page number.
 */
export function rowsPerPage(blockHeight: number, rowHeight: number, rows: number): number {
    if (!(rowHeight > 0)) return Math.max(1, rows);
    const all = Math.floor(blockHeight / rowHeight);
    if (rows <= all) return Math.max(1, all);
    return Math.max(1, Math.floor((blockHeight - rowHeight * 0.75) / rowHeight));
}

export function paginate<T>(items: readonly T[], perPage: number): T[][] {
    const size = Math.max(1, Math.floor(perPage));
    const pages: T[][] = [];
    for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
    return pages.length ? pages : [[]];
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
