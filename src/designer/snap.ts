/**
 * Snapping while dragging and resizing on the stage.
 *
 * Alignment targets win over the grid: an edge or centre that comes close to
 * the stage edges, the stage centre or an edge/centre of another block snaps
 * there and shows a guide line. Next come gap targets (Plan.md 79, A3): the same
 * gap to a neighbour as a pair of other blocks has, or exactly between two of
 * them; at equal distance an edge or centre wins, because flush matters more.
 * Otherwise the edge snaps to the grid. Everything is in stage pixels.
 */
import { gapsBetween, type Measure } from './measure';

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

export type { Measure };

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

interface GapTarget {
    /** Where the snapped point has to be. */
    at: number;
    /** The gap(s) this makes equal to those of other pairs. */
    gaps: number[];
}

/**
 * Positions where a frame has the same gap to a neighbour as a pair of the other blocks, or – for a move –
 * lies exactly between two of them. `part` is the point that snaps: the start of a moved frame, or the edge a handle drags.
 */
function gapTargets(axis: 'x' | 'y', frame: Frame, part: 'move' | 'start' | 'end', options: SnapOptions): GapTarget[] {
    const cross = axis === 'x' ? 'y' : 'x';
    const from = (f: Frame, a: 'x' | 'y') => (a === 'x' ? f.x : f.y);
    const length = (f: Frame, a: 'x' | 'y') => (a === 'x' ? f.width : f.height);
    const near = options.others.filter((o) => from(o, cross) < from(frame, cross) + length(frame, cross) && from(o, cross) + length(o, cross) > from(frame, cross));
    const known = [...new Set(gapsBetween(options.others, axis).map((m) => m.value))];
    const size = part === 'move' ? length(frame, axis) : 0;
    const list: GapTarget[] = [];
    for (const o of near) {
        const oStart = from(o, axis);
        const oEnd = oStart + length(o, axis);
        for (const gap of known) {
            // Behind the neighbour: its end plus the gap; before it: its start minus the gap.
            if (part !== 'end') list.push({ at: oEnd + gap, gaps: [gap] });
            if (part === 'move') list.push({ at: oStart - gap - size, gaps: [gap] });
            if (part === 'end') list.push({ at: oStart - gap, gaps: [gap] });
        }
    }
    if (part === 'move') {
        for (const a of near) {
            for (const b of near) {
                const room = from(b, axis) - (from(a, axis) + length(a, axis)) - size;
                if (a === b || room <= 0) continue;
                list.push({ at: from(a, axis) + length(a, axis) + room / 2, gaps: [Math.floor(room / 2), Math.ceil(room / 2)] });
            }
        }
    }
    return list;
}

/** The nearest gap target for a point within the threshold. */
function nearestGap(point: number, targets: GapTarget[], threshold: number): { offset: number; gaps: number[] } | null {
    let best: { offset: number; gaps: number[] } | null = null;
    for (const target of targets) {
        const offset = target.at - point;
        if (Math.abs(offset) <= threshold && (!best || Math.abs(offset) < Math.abs(best.offset))) best = { offset, gaps: target.gaps };
    }
    return best;
}

/** After the snap: all gaps between blocks on this axis that equal the gap(s) just snapped to – to mark in the same colour. */
function equalGaps(frame: Frame, axis: 'x' | 'y', gaps: number[], options: SnapOptions): Measure[] {
    return gapsBetween([...options.others, frame], axis).filter((m) => gaps.includes(m.value));
}

/** Moves the whole frame: left, centre or right edge may snap; the size stays. */
export function snapMove(frame: Frame, options: SnapOptions): { frame: Frame; guides: Guide[]; spacings: Measure[] } {
    const guides: Guide[] = [];
    const result = { ...frame };
    const snappedGaps: [axis: 'x' | 'y', gaps: number[]][] = [];
    for (const axis of ['x', 'y'] as const) {
        const start = axis === 'x' ? frame.x : frame.y;
        const length = axis === 'x' ? frame.width : frame.height;
        const hit = nearest([start, start + length / 2, start + length], targets(axis, options), options.threshold);
        const gap = nearestGap(start, gapTargets(axis, frame, 'move', options), options.threshold);
        let snapped: number;
        if (hit && (!gap || Math.abs(hit.offset) <= Math.abs(gap.offset))) {
            snapped = start + hit.offset;
            guides.push({ axis, at: hit.at });
        } else if (gap) {
            snapped = start + gap.offset;
            snappedGaps.push([axis, gap.gaps]);
        } else {
            snapped = toGrid(start, options.grid);
        }
        if (axis === 'x') result.x = Math.round(snapped);
        else result.y = Math.round(snapped);
    }
    return { frame: result, guides, spacings: snappedGaps.flatMap(([axis, gaps]) => equalGaps(result, axis, gaps, options)) };
}

/** Resizes at a handle: only the edges the handle moves may snap. */
export function snapResize(
    frame: Frame,
    handle: Handle,
    options: SnapOptions,
): { frame: Frame; guides: Guide[]; spacings: Measure[] } {
    const guides: Guide[] = [];
    const snappedGaps: [axis: 'x' | 'y', gaps: number[]][] = [];
    let { x, y } = frame;
    let right = frame.x + frame.width;
    let bottom = frame.y + frame.height;

    const snapEdge = (axis: 'x' | 'y', value: number, part: 'start' | 'end'): number => {
        const hit = nearest([value], targets(axis, options), options.threshold);
        const gap = nearestGap(value, gapTargets(axis, frame, part, options), options.threshold);
        if (hit && (!gap || Math.abs(hit.offset) <= Math.abs(gap.offset))) {
            guides.push({ axis, at: hit.at });
            return Math.round(value + hit.offset);
        }
        if (gap) {
            snappedGaps.push([axis, gap.gaps]);
            return Math.round(value + gap.offset);
        }
        return toGrid(value, options.grid);
    };

    if (handle.includes('w')) x = snapEdge('x', x, 'start');
    if (handle.includes('e')) right = snapEdge('x', right, 'end');
    if (handle.includes('n')) y = snapEdge('y', y, 'start');
    if (handle.includes('s')) bottom = snapEdge('y', bottom, 'end');
    const result = { x, y, width: right - x, height: bottom - y };
    return { frame: result, guides, spacings: snappedGaps.flatMap(([axis, gaps]) => equalGaps(result, axis, gaps, options)) };
}

export const GRID_SIZES = [0, 10, 20, 40, 60] as const;
