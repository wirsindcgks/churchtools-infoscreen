/**
 * One size for every progress bar, whatever the block's font size ("ein Maß für alle Fortschrittsbalken", user 2026-11-25).
 * The yardstick is the bar of the whole presentation (ProgressBar.vue); the page bars of lists, posts, gallery and
 * songsheet match it in stage pixels. All sizes derive from the number's font size, as `em` does in the CSS.
 */

/** Font size of the page number; the track (`0.3em`) and the gaps (`0.6em`, segments `0.3em`) scale from it. */
export const PROGRESS_FONT_PX = 24;
/** Thickness of the track: 0.3em of the number. */
export const PROGRESS_TRACK_PX = PROGRESS_FONT_PX * 0.3;
/** Distance of the bar blocks draw over their content (gallery, posts, songsheet) from the block's edges. */
export const PROGRESS_INSET_PX = 16;
/** Air below and right of a list's page number, so the glyphs (the block clips them) are not cut off: 0.2em. */
export const PROGRESS_PAD_PX = PROGRESS_FONT_PX * 0.2;
/**
 * Air between the last row and the number above it: a little more than the 0.4em the old reserve (0.9em) left over the
 * number's 0.55em – the bar must not touch the row's divider line.
 */
const AIR_PX = 10;
/** Air above the edge line: the old reserve left 0.2em of the block font over the 0.165em line, at the usual 45 px font about 9 px. */
const EDGE_AIR_PX = 9;

/**
 * Room a paged list keeps free at the bottom. With the number: its line (1em), the air below it and the air above
 * (about 39 px, as the old 0.9 × block font did at the usual size). At the edge: only the track and some air (about 16 px).
 */
export function progressReserve(edge: boolean): number {
    return edge ? Math.round(PROGRESS_TRACK_PX + EDGE_AIR_PX) : PROGRESS_FONT_PX + PROGRESS_PAD_PX + AIR_PX;
}
