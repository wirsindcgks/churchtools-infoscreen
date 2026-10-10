/**
 * Where the short menu stands (Plan.md 79, C1). All numbers are screen pixels in the editor's host; the menu is
 * drawn outside the scaled stage, so it keeps its size at every zoom.
 */

/** A rectangle in host pixels. */
export interface Rect {
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface Size {
    width: number;
    height: number;
}

export type MenuPlace = 'above' | 'below' | 'inside';

/**
 * Centred above the block with `gap` of air if that fits into the host; else below it; else inside, at the block's top edge.
 * Sideways it is kept within the host (a menu wider than the host starts at its left edge). `clear` keeps it that much
 * further from the block above and below, clear of the rotate handle (Plan.md F1).
 */
export function quickMenuPlace(
    frame: Rect,
    menu: Size,
    host: Size,
    gap = 8,
    clear: { above: number; below: number } = { above: 0, below: 0 },
): { left: number; top: number; place: MenuPlace } {
    const left = Math.max(0, Math.min(frame.left + frame.width / 2 - menu.width / 2, host.width - menu.width));
    const above = frame.top - clear.above - gap - menu.height;
    if (above >= 0) return { left, top: above, place: 'above' };
    const below = frame.top + frame.height + clear.below + gap;
    if (below + menu.height <= host.height) return { left, top: below, place: 'below' };
    return { left, top: frame.top + gap, place: 'inside' };
}

/**
 * Where the open field of a chip goes: left-aligned with the chip, moved sideways to stay within the host (`dx` is the
 * shift from the chip's left edge), and below the menu – above it if there is not room below and more above.
 */
export function quickFieldPlace(chip: Rect, menu: Rect, field: Size, host: Rect, gap = 8): { dx: number; above: boolean } {
    const left = Math.max(host.left, Math.min(chip.left, host.left + host.width - field.width));
    const below = host.top + host.height - (menu.top + menu.height) - gap;
    const over = menu.top - host.top - gap;
    return { dx: left - chip.left, above: field.height > below && over > below };
}
