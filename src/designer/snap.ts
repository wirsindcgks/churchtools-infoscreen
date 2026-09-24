/**
 * Snapping while dragging and resizing on the stage.
 *
 * Alignment targets win over the grid: an edge or centre that comes close to
 * the stage edges, the stage centre or an edge/centre of another block snaps
 * there and shows a guide line. Otherwise the edge snaps to the grid.
 * Everything is in stage pixels.
 */
export interface Frame {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Guide {
    axis: 'x' | 'y';
    /** Stage pixel position of the line. */
    at: number;
}

export interface SnapOptions {
    /** Grid size in stage pixels; 0 turns the grid off. */
    grid: number;
    /** How close (in stage pixels) an edge must come to snap to a target. */
    threshold: number;
    stage: { width: number; height: number };
    /** The other blocks on the slide. */
    others: Frame[];
}

export type Handle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

function targets(axis: 'x' | 'y', options: SnapOptions): number[] {
    const size = axis === 'x' ? options.stage.width : options.stage.height;
    const list = [0, size / 2, size];
    for (const o of options.others) {
        const start = axis === 'x' ? o.x : o.y;
        const length = axis === 'x' ? o.width : o.height;
        list.push(start, start + length / 2, start + length);
    }
    return list;
}

/** The nearest target for any of the given points, if one is within the threshold. */
function nearest(points: number[], candidates: number[], threshold: number): { offset: number; at: number } | null {
    let best: { offset: number; at: number } | null = null;
    for (const point of points) {
        for (const at of candidates) {
            const offset = at - point;
            if (Math.abs(offset) <= threshold && (!best || Math.abs(offset) < Math.abs(best.offset))) {
                best = { offset, at };
            }
        }
    }
    return best;
}

function toGrid(value: number, grid: number): number {
    return grid > 0 ? Math.round(value / grid) * grid : Math.round(value);
}

/** Moves the whole frame: left, centre or right edge may snap; the size stays. */
export function snapMove(frame: Frame, options: SnapOptions): { frame: Frame; guides: Guide[] } {
    const guides: Guide[] = [];
    const result = { ...frame };
    for (const axis of ['x', 'y'] as const) {
        const start = axis === 'x' ? frame.x : frame.y;
        const length = axis === 'x' ? frame.width : frame.height;
        const hit = nearest([start, start + length / 2, start + length], targets(axis, options), options.threshold);
        const snapped = hit ? start + hit.offset : toGrid(start, options.grid);
        if (hit) guides.push({ axis, at: hit.at });
        if (axis === 'x') result.x = Math.round(snapped);
        else result.y = Math.round(snapped);
    }
    return { frame: result, guides };
}

/** Resizes at a handle: only the edges the handle moves may snap. */
export function snapResize(frame: Frame, handle: Handle, options: SnapOptions): { frame: Frame; guides: Guide[] } {
    const guides: Guide[] = [];
    let { x, y } = frame;
    let right = frame.x + frame.width;
    let bottom = frame.y + frame.height;

    const snapEdge = (axis: 'x' | 'y', value: number): number => {
        const hit = nearest([value], targets(axis, options), options.threshold);
        if (hit) {
            guides.push({ axis, at: hit.at });
            return Math.round(value + hit.offset);
        }
        return toGrid(value, options.grid);
    };

    if (handle.includes('w')) x = snapEdge('x', x);
    if (handle.includes('e')) right = snapEdge('x', right);
    if (handle.includes('n')) y = snapEdge('y', y);
    if (handle.includes('s')) bottom = snapEdge('y', bottom);
    return { frame: { x, y, width: right - x, height: bottom - y }, guides };
}

export const GRID_SIZES = [0, 10, 20, 40, 60] as const;
