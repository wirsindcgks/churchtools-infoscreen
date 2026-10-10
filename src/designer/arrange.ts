/**
 * Aligning and distributing several blocks (Plan.md 79, D4): pure functions on frames, the store applies the result.
 */
import { boundingBox } from './ops';

export type Frame = { x: number; y: number; width: number; height: number };
type Lockable = Frame & { locked?: boolean };

export type Edge = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type Axis = 'x' | 'y';

/** Every frame moved to the edge (or the middle) of the target; same order, only x or y changes. */
export function align(frames: readonly Frame[], edge: Edge, target: Frame): Frame[] {
    return frames.map((f) => {
        switch (edge) {
            case 'left':
                return { ...f, x: target.x };
            case 'center':
                return { ...f, x: Math.round(target.x + (target.width - f.width) / 2) };
            case 'right':
                return { ...f, x: target.x + target.width - f.width };
            case 'top':
                return { ...f, y: target.y };
            case 'middle':
                return { ...f, y: Math.round(target.y + (target.height - f.height) / 2) };
            case 'bottom':
                return { ...f, y: target.y + target.height - f.height };
        }
    });
}

/** The indexes of the frames in the order they lie along the axis; a tie keeps the original order. */
function lineUp(frames: readonly Frame[], axis: Axis): number[] {
    return frames.map((_, i) => i).sort((a, b) => frames[a]![axis] - frames[b]![axis] || a - b);
}

const sizeOf = (axis: Axis): 'width' | 'height' => (axis === 'x' ? 'width' : 'height');

/**
 * The first and the last stay, the gaps between all are the same (whole pixels; the rest goes to the last gap). Overlap
 * works with the same sum. Fewer than three come back unchanged; the result is in the original order.
 */
export function distribute(frames: readonly Frame[], axis: Axis): Frame[] {
    if (frames.length < 3) return frames.map((f) => ({ ...f }));
    const size = sizeOf(axis);
    const order = lineUp(frames, axis);
    const first = frames[order[0]!]!;
    const last = frames[order[order.length - 1]!]!;
    const sizes = frames.reduce((sum, f) => sum + f[size], 0);
    const gap = Math.floor((last[axis] + last[size] - first[axis] - sizes) / (frames.length - 1));
    const result = frames.map((f) => ({ ...f }));
    let at = first[axis] + first[size] + gap;
    for (const i of order.slice(1, -1)) {
        result[i]![axis] = at;
        at += frames[i]![size] + gap;
    }
    return result;
}

/** Why distributing is not possible: fewer than three, or a locked block between the outer ones. */
export function distributeBlocker(frames: readonly Lockable[], axis: Axis): null | 'few' | 'locked' {
    if (frames.length < 3) return 'few';
    const order = lineUp(frames, axis);
    return order.slice(1, -1).some((i) => frames[i]!.locked) ? 'locked' : null;
}

/**
 * What the chosen blocks align to: the stage for one; for several the box around the locked ones among them, else around
 * all. Null where nothing may move (the only block or all of them locked).
 */
export function alignTarget(chosen: readonly Lockable[], stage: { width: number; height: number }): Frame | null {
    if (!chosen.length || chosen.every((f) => f.locked)) return null;
    if (chosen.length === 1) return { x: 0, y: 0, width: stage.width, height: stage.height };
    const locked = chosen.filter((f) => f.locked);
    return boundingBox(locked.length ? locked : chosen);
}

/** What aligning and distributing move: one block, or a group as a whole (its box); locked if any member is. */
export type Unit = Frame & { ids: string[]; locked: boolean };

/**
 * The chosen blocks as units (user, 2026-10-10): a group with two or more chosen members behaves like one block – alone it
 * aligns to the stage, among others it moves as a whole and counts as one when distributing. A member chosen alone is a
 * block of its own. In the order of the blocks.
 */
export function unitsOf(chosen: readonly (Lockable & { id: string; groupId?: string })[]): Unit[] {
    const members = new Map<string, number>();
    for (const b of chosen) if (b.groupId) members.set(b.groupId, (members.get(b.groupId) ?? 0) + 1);
    const units = new Map<string, (typeof chosen)[number][]>();
    for (const b of chosen) {
        const key = b.groupId && members.get(b.groupId)! > 1 ? `group:${b.groupId}` : `block:${b.id}`;
        units.set(key, [...(units.get(key) ?? []), b]);
    }
    return [...units.values()].map((list) => ({ ...boundingBox(list)!, ids: list.map((b) => b.id), locked: list.some((b) => !!b.locked) }));
}

