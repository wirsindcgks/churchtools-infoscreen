/**
 * Distances on the stage (Plan.md 79, A1–A3): from a block to its neighbours and to the stage edge while it is
 * dragged, between two blocks (Alt), and between neighbouring pairs for the snap to equal gaps. Pure, in stage pixels.
 */
import type { Frame } from './snap';

/**
 * A distance to show. `axis` is the direction the line runs in: 'x' is a horizontal line from `from` to `to`
 * at the height `at`, 'y' a vertical one at the position `at`. `value` is the length in whole stage pixels.
 */
export interface Measure {
    axis: 'x' | 'y';
    from: number;
    to: number;
    at: number;
    value: number;
}

type Axis = 'x' | 'y';
type Size = { width: number; height: number };

const other = (axis: Axis): Axis => (axis === 'x' ? 'y' : 'x');
const start = (f: Frame, axis: Axis): number => (axis === 'x' ? f.x : f.y);
const end = (f: Frame, axis: Axis): number => (axis === 'x' ? f.x + f.width : f.y + f.height);

/** Where two spans overlap, or null if they only touch or lie apart. */
function overlap(a: Frame, b: Frame, axis: Axis): [number, number] | null {
    const from = Math.max(start(a, axis), start(b, axis));
    const to = Math.min(end(a, axis), end(b, axis));
    return from < to ? [from, to] : null;
}

function measure(axis: Axis, from: number, to: number, at: number): Measure {
    return { axis, from, to, at, value: Math.round(to - from) };
}

/**
 * The distance to the nearest block in each of the four directions – edge to edge, among the blocks whose span
 * overlaps the frame's on the other axis; without one, to the stage edge. Where the frame overlaps a block in a
 * direction, nothing is measured that way. A distance of 0 is not shown.
 */
export function neighbourGaps(frame: Frame, others: readonly Frame[], stage: Size): Measure[] {
    const result: Measure[] = [];
    for (const axis of ['x', 'y'] as const) {
        const cross = other(axis);
        const size = axis === 'x' ? stage.width : stage.height;
        const centre = (start(frame, cross) + end(frame, cross)) / 2;
        // A block the frame overlaps – a background picture, a card it sits on – is no neighbour: the distances
        // look past it to the next block or the edge (Plan.md 79, A1; seen on a full-bleed background).
        const beside = others.filter((o) => overlap(frame, o, cross) && !overlap(frame, o, axis));

        // After the frame: the block that starts first among those reaching past its end.
        const after = beside.filter((o) => end(o, axis) > end(frame, axis)).sort((a, b) => start(a, axis) - start(b, axis))[0];
        if (after) {
            if (start(after, axis) >= end(frame, axis)) {
                const [c0, c1] = overlap(frame, after, cross)!;
                result.push(measure(axis, end(frame, axis), start(after, axis), (c0 + c1) / 2));
            }
        } else {
            result.push(measure(axis, end(frame, axis), size, centre));
        }

        // Before the frame: the block that ends last among those starting before its start.
        const before = beside.filter((o) => start(o, axis) < start(frame, axis)).sort((a, b) => end(b, axis) - end(a, axis))[0];
        if (before) {
            if (end(before, axis) <= start(frame, axis)) {
                const [c0, c1] = overlap(frame, before, cross)!;
                result.push(measure(axis, end(before, axis), start(frame, axis), (c0 + c1) / 2));
            }
        } else {
            result.push(measure(axis, 0, start(frame, axis), centre));
        }
    }
    return result.filter((m) => m.value > 0);
}

/**
 * The distances between two blocks: the gap if they lie beside each other (on each axis they are apart),
 * the four inner distances if one lies inside the other, nothing if they only overlap in part.
 */
export function pairGaps(a: Frame, b: Frame): Measure[] {
    for (const [inner, outer] of [[a, b], [b, a]] as const) {
        const inside = (['x', 'y'] as const).every((axis) => start(inner, axis) >= start(outer, axis) && end(inner, axis) <= end(outer, axis));
        if (!inside) continue;
        const midX = inner.x + inner.width / 2;
        const midY = inner.y + inner.height / 2;
        return [
            measure('x', outer.x, inner.x, midY),
            measure('x', end(inner, 'x'), end(outer, 'x'), midY),
            measure('y', outer.y, inner.y, midX),
            measure('y', end(inner, 'y'), end(outer, 'y'), midX),
        ].filter((m) => m.value > 0);
    }
    const result: Measure[] = [];
    for (const axis of ['x', 'y'] as const) {
        const cross = other(axis);
        const [first, second] = start(a, axis) <= start(b, axis) ? [a, b] : [b, a];
        if (end(first, axis) > start(second, axis)) continue; // they overlap on this axis
        const shared = overlap(a, b, cross);
        // Apart on both axes (diagonal): the line sits between the two nearest edges.
        const at = shared
            ? (shared[0] + shared[1]) / 2
            : (Math.min(end(a, cross), end(b, cross)) + Math.max(start(a, cross), start(b, cross))) / 2;
        result.push(measure(axis, end(first, axis), start(second, axis), at));
    }
    return result.filter((m) => m.value > 0);
}

/**
 * The gaps between neighbouring pairs of blocks – pairs whose spans overlap on the other axis and with no
 * further block between them. What the snap to equal gaps looks for (A3).
 */
export function gapsBetween(frames: readonly Frame[], axis: Axis): Measure[] {
    const cross = other(axis);
    const result: Measure[] = [];
    for (const p of frames) {
        for (const q of frames) {
            if (p === q || end(p, axis) > start(q, axis)) continue;
            const shared = overlap(p, q, cross);
            if (!shared) continue;
            const between = frames.some(
                (r) => r !== p && r !== q && start(r, axis) >= end(p, axis) && end(r, axis) <= start(q, axis) && start(r, cross) < shared[1] && end(r, cross) > shared[0],
            );
            if (between) continue;
            result.push(measure(axis, end(p, axis), start(q, axis), (shared[0] + shared[1]) / 2));
        }
    }
    return result.filter((m) => m.value > 0);
}
